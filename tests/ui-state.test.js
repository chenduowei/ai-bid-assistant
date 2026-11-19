import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveRestoreDecision,
  emptyStateKind,
  createKeyedQueue,
  formDraftKey,
  readFormDrafts,
  writeFormDrafts,
  pickFormDraft,
  pruneFormDrafts,
  FORM_DRAFTS_KEY,
  FORM_DRAFT_KEY,
  FORM_DRAFT_TTL_MS,
} from "../js/utils.js";

/* ============ v0.35.0：恢复备份的“取消”终于真的是取消 ============ */

test("resolveRestoreDecision：三态直通，确认框返回值翻译正确", () => {
  assert.equal(resolveRestoreDecision("overwrite"), "overwrite");
  assert.equal(resolveRestoreDecision("insert-only"), "insert-only");
  assert.equal(resolveRestoreDecision("abort"), "abort");
  assert.equal(resolveRestoreDecision("confirm"), "overwrite");
  assert.equal(resolveRestoreDecision(true), "overwrite");
  assert.equal(resolveRestoreDecision("alt"), "insert-only");
});

test("resolveRestoreDecision：取消 / Esc / 点遮罩 / 空值一律 abort（以前 false 被当成“只补新增”照旧写库）", () => {
  for (const value of ["cancel", false, null, undefined, "", "whatever", 0]) {
    assert.equal(resolveRestoreDecision(value), "abort");
  }
});

/* ============ v0.35.0：空状态分叉 ============ */

test("emptyStateKind：有搜索 / 筛选说“没有匹配的项目”，没有才说“还没有项目”", () => {
  assert.equal(emptyStateKind(true), "no-match");
  assert.equal(emptyStateKind(false), "empty");
  assert.equal(emptyStateKind(undefined), "empty");
});

/* ============ v0.35.0：同一项目的写入串行 ============ */

test("createKeyedQueue：同一 key 的两次写按提交顺序执行（后一次在前一次落地后才开始）", async () => {
  const queue = createKeyedQueue();
  const order = [];
  let releaseFirst;
  const first = queue.run("p1", async () => {
    order.push("first-start");
    await new Promise((resolve) => {
      releaseFirst = resolve;
    });
    order.push("first-end");
    return "A";
  });
  const second = queue.run("p1", async () => {
    // 关键：此刻第一次还没结束，若并发这里会先于 first-end 出现
    order.push("second-start");
    return "B";
  });
  // run 通过微任务排队，先让第一次任务真正开始
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(order, ["first-start"]);
  releaseFirst();
  assert.equal(await first, "A");
  assert.equal(await second, "B");
  assert.deepEqual(order, ["first-start", "first-end", "second-start"]);
});

test("createKeyedQueue：不同 key 互不阻塞；一次失败不卡死后面的写", async () => {
  const queue = createKeyedQueue();
  let releaseSlow;
  const slow = queue.run("slow", () =>
    new Promise((resolve) => {
      releaseSlow = resolve;
    })
  );
  const fast = await queue.run("fast", async () => "ok");
  assert.equal(fast, "ok");
  releaseSlow();

  await assert.rejects(
    queue.run("p2", async () => {
      throw new Error("boom");
    })
  );
  const after = await queue.run("p2", async () => "still-runs");
  assert.equal(after, "still-runs");
  await slow;
});

test("createKeyedQueue：patch 函数在轮到它时才求值，拿得到前一次的结果", async () => {
  const queue = createKeyedQueue();
  let local = { checklist: [{ id: "a", done: false }, { id: "b", done: false }] };
  const patch = (id) =>
    queue.run("p", async () => {
      local = {
        checklist: local.checklist.map((it) =>
          it.id === id ? { ...it, done: true } : it
        ),
      };
      return local;
    });
  await Promise.all([patch("a"), patch("b")]);
  assert.deepEqual(
    local.checklist.map((it) => it.done),
    [true, true]
  );
});

/* ============ v0.35.0：草稿按编辑对象各存一份 ============ */

const fakeStorage = (initial = {}) => {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
};

const draft = (editingId, name, savedAt = Date.now()) => ({
  v: 1,
  editingId,
  savedAt,
  fields: { name },
  aiResult: null,
});

test("formDraftKey：新建用 new，编辑用 id:xxx", () => {
  assert.equal(formDraftKey(null), "new");
  assert.equal(formDraftKey("abc"), "id:abc");
});

test("草稿 Map：两个项目的草稿互不覆盖，读回各自那份", () => {
  const storage = fakeStorage();
  const drafts = {};
  drafts[formDraftKey(null)] = draft(null, "新建草稿");
  drafts[formDraftKey("p1")] = draft("p1", "A 项目一半");
  writeFormDrafts(storage, drafts);

  const read = readFormDrafts(storage);
  assert.equal(pickFormDraft(read, null).fields.name, "新建草稿");
  assert.equal(pickFormDraft(read, "p1").fields.name, "A 项目一半");
  assert.equal(pickFormDraft(read, "p2"), null);
  assert.ok(read[FORM_DRAFTS_KEY] === undefined);
});

test("草稿 Map：旧版单份草稿自动搬进来（按 editingId 归类）并删掉旧键", () => {
  const legacy = draft("p9", "旧草稿");
  const storage = fakeStorage({ [FORM_DRAFT_KEY]: JSON.stringify(legacy) });
  const read = readFormDrafts(storage);
  assert.equal(pickFormDraft(read, "p9").fields.name, "旧草稿");
  assert.equal(storage.getItem(FORM_DRAFT_KEY), null);
});

test("草稿 Map：过期 / 损坏的草稿被清掉，正常的留着", () => {
  const now = Date.now();
  const drafts = {
    [formDraftKey("old")]: draft("old", "过期", now - FORM_DRAFT_TTL_MS - 1),
    [formDraftKey("ok")]: draft("ok", "正常", now - 1000),
    [formDraftKey("bad")]: { v: 2, savedAt: now },
  };
  const pruned = pruneFormDrafts(drafts, now);
  assert.deepEqual(Object.keys(pruned), [formDraftKey("ok")]);
  assert.equal(pickFormDraft(drafts, "old", now), null);
  assert.equal(pickFormDraft(drafts, "ok", now).fields.name, "正常");
});

test("草稿 Map：删掉最后一份时连存储键一起清掉", () => {
  const storage = fakeStorage();
  writeFormDrafts(storage, { [formDraftKey(null)]: draft(null, "x") });
  assert.ok(storage.getItem(FORM_DRAFTS_KEY));
  writeFormDrafts(storage, {});
  assert.equal(storage.getItem(FORM_DRAFTS_KEY), null);
});
