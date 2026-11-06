import { test } from "node:test";
import assert from "node:assert/strict";
import { upsertById, removeByIds } from "../js/utils.js";

const p = (id, date) => ({ id, date, name: `项目${id}` });

test("upsertById：新增一行后按开标时间升序排", () => {
  const list = [p("a", "2026-11-10"), p("c", "2026-11-20")];
  const out = upsertById(list, p("b", "2026-11-15"));
  assert.deepEqual(
    out.map((x) => x.id),
    ["a", "b", "c"]
  );
  // 原数组不动
  assert.equal(list.length, 2);
});

test("upsertById：已存在的行原地替换并重排", () => {
  const list = [p("a", "2026-11-10"), p("b", "2026-11-15")];
  const out = upsertById(list, { id: "b", date: "2026-11-25", name: "改期" });
  assert.deepEqual(
    out.map((x) => x.id),
    ["a", "b"]
  );
  assert.equal(out[1].name, "改期");
  const out2 = upsertById(list, { id: "a", date: "2026-12-01", name: "改期" });
  assert.deepEqual(
    out2.map((x) => x.id),
    ["b", "a"]
  );
});

test("removeByIds：只删指定 id，其余不动", () => {
  const list = [p("a", "2026-11-10"), p("b", "2026-11-15"), p("c", "2026-11-20")];
  assert.deepEqual(
    removeByIds(list, ["b"]).map((x) => x.id),
    ["a", "c"]
  );
  assert.deepEqual(
    removeByIds(list, ["a", "c", "不存在"]).map((x) => x.id),
    ["b"]
  );
  assert.equal(removeByIds(list, []).length, 3);
});
