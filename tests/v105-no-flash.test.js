/**
 * v1.0.5：列表挪动与删除 / 恢复闪烁的回归测试（三处成因各一组）。
 *   1. syncListDom 位置没变的卡片不再调 insertBefore / appendChild 挪一遍（js/ui.js）——
 *      对已在树里的节点重复插入会先摘再插，浏览器把这一次当作新的入场，重播 item-in；
 *   2. applyRealtimeChange 收到「本地已经不存在」的那一行的 deleted_at 回声 / DELETE 回声时
 *      直接返回，不再二次 removeLocalProjects + 重绘（js/projects.js）；
 *   3. renderTrashList 的回收站条目带 no-enter，恢复 / 彻底删除后刷新回收站不再重播入场动画。
 * 与 save-no-flash-v104.test.js 同一套最小环境：只加载 index.html 骨架 + js/ui.js，不碰网络。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { readCssBundle } from "./css-bundle.mjs";
import { installHeroTimerFake } from "./hero-timer-fake.mjs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readCssBundle();

const { window, document } = parseHTML(html);
globalThis.window = window;
globalThis.document = document;
globalThis.CSS = { escape: (s) => String(s).replace(/["\\]/g, "\\$&") };
window.matchMedia = () => ({ matches: true });
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
window.Element.prototype.scrollIntoView = function scrollIntoView() {};

/* ============ 1. syncListDom 不再挪位置没变的卡片（js/ui.js） ============ */

const IDS = [
  "list", "filterResultCount", "search", "statusFilter", "resultFilter", "sortBy",
  "toastWrap", "syncStatus", "upcomingList", "upcomingDesc", "deadlineTip", "refundTip",
  "trashList", "trashLimit", "guaranteeList", "guaranteeCount", "guaranteeTotals",
  "calendarGrid", "calendarDayList", "calendarTitle", "calendarDayTitle", "calendarView",
  "totalCount", "registeringCount", "makingCount", "openedCount", "inTransitGuarantee",
  "upcomingCount", "winRate", "collapseAllBtn", "offlineBanner", "scrollProgress",
  "backToTopBtn", "goToBottomBtn", "themeBtn",
  "confirmDialog", "confirmDialogTitle", "confirmDialogMessage", "confirmDialogCancel",
  "confirmDialogOk", "confirmDialogAlt", "confirmDialogActions", "confirmDialogTyping",
  "confirmDialogPhrase", "confirmDialogInput",
];
const elements = {};
for (const id of IDS) elements[id] = document.getElementById(id);

const setSelect = (el, value) => {
  for (const opt of el.querySelectorAll("option")) {
    if (opt.getAttribute("value") === value) opt.setAttribute("selected", "");
    else opt.removeAttribute("selected");
  }
};
elements.search.value = "";
setSelect(elements.statusFilter, "all");
setSelect(elements.sortBy, "date-desc");
setSelect(elements.resultFilter, "all");

const state = {
  projects: [],
  user: { id: "u1", email: "u1@example.com" },
  expandedIds: new Set(),
  collapsedSections: new Set(),
  expandedSections: new Set(),
  selectMode: false,
  selectedIds: new Set(),
  listLimit: 50,
  trashLimit: 50,
  calYear: 2026,
  calMonth: 10,
  calSelected: "2026-11-27",
  offlineSnapshot: false,
};

const { createUi } = await import("../js/ui.js");
installHeroTimerFake();
const ui = createUi(elements, () => state);

const project = (over = {}) => ({
  id: "p1",
  date: "2026-12-02",
  bidTime: "",
  type: "房建工程",
  name: "某市人民医院综合楼",
  biddingCompany: "青海一建",
  contact: "张三",
  status: "制作中",
  notes: "",
  result: "",
  checklist: [],
  ...over,
});

const nodeOf = (id) =>
  elements.list.querySelector(`.project-item[data-id="${id}"]`);
const idsInList = () =>
  [...elements.list.querySelectorAll(".project-item")].map((el) => el.dataset.id);

/** 记录 listEl 上的 insertBefore / appendChild（项目卡片会被浏览器当成“重新插入”）。 */
const spyListMoves = () => {
  const calls = [];
  const listEl = elements.list;
  const origInsert = listEl.insertBefore.bind(listEl);
  const origAppend = listEl.appendChild.bind(listEl);
  listEl.insertBefore = (node, ref) => {
    calls.push({ type: "insertBefore", id: node?.dataset?.id || null });
    return origInsert(node, ref);
  };
  listEl.appendChild = (node) => {
    calls.push({ type: "appendChild", id: node?.dataset?.id || null });
    return origAppend(node);
  };
  const restore = () => {
    delete listEl.insertBefore;
    delete listEl.appendChild;
  };
  return {
    calls,
    // 只要项目卡片（有 data-id）被动过就算
    cardMoves: () => calls.filter((c) => c.id),
    restore,
  };
};

test("v1.0.5：没有任何改动时 syncListDom 一次都不挪卡片（不重播 item-in）", () => {
  state.projects = [
    project({ id: "p1", date: "2026-12-07", name: "果洛州卫生应急" }),
    project({ id: "p2", date: "2026-12-05", name: "德令哈老旧小区改造" }),
    project({ id: "p3", date: "2026-12-03", name: "乌兰县管网" }),
    project({ id: "p4", date: "2026-12-01", name: "格尔木仓储" }),
  ];
  state.expandedIds = new Set();
  ui.render();
  const before = idsInList();
  const nodes = new Map(before.map((id) => [id, nodeOf(id)]));

  const spy = spyListMoves();
  try {
    // 定向渲染、changedIds 为空 —— 删除 / 恢复 / 回声之后最常见的走法。
    ui.renderAfterWrite({ changedIds: [] });
  } finally {
    spy.restore();
  }

  assert.deepEqual(spy.cardMoves(), [], "位置没变的卡片不该被 insertBefore / appendChild");
  assert.deepEqual(idsInList(), before, "顺序不变");
  for (const [id, node] of nodes) {
    assert.equal(nodeOf(id), node, `${id} 必须是同一个 DOM 节点（没有 replaceWith）`);
  }
});

test("v1.0.5：只有真的要换位的那张卡片被挪，其余原地不动", () => {
  // date-desc：[p1, p2, p3, p4]；把 p2 改成最旧 → [p1, p3, p4, p2]
  state.projects = [
    project({ id: "p1", date: "2026-12-07" }),
    project({ id: "p2", date: "2026-12-05" }),
    project({ id: "p3", date: "2026-12-03" }),
    project({ id: "p4", date: "2026-12-01" }),
  ];
  state.expandedIds = new Set();
  ui.render();
  assert.deepEqual(idsInList(), ["p1", "p2", "p3", "p4"]);
  const untouched = ["p1", "p3", "p4"].map((id) => [id, nodeOf(id)]);

  state.projects = state.projects.map((p) =>
    p.id === "p2" ? { ...p, date: "2026-11-30" } : p
  );
  const spy = spyListMoves();
  try {
    ui.renderAfterWrite({ changedIds: ["p2"] });
  } finally {
    spy.restore();
  }

  assert.deepEqual(idsInList(), ["p1", "p3", "p4", "p2"], "最终顺序正确");
  for (const [id, node] of untouched) {
    assert.equal(nodeOf(id), node, `${id} 不该被替换`);
  }
  const movedIds = new Set(spy.cardMoves().map((c) => c.id));
  assert.deepEqual([...movedIds], ["p2"], "只有 p2 被挪（其余卡片原地不动）");
});

test("v1.0.5：新建卡片的插入照旧工作（no-enter，按序插到位）", () => {
  state.projects = [
    project({ id: "p1", date: "2026-12-07" }),
    project({ id: "p2", date: "2026-12-01" }),
  ];
  state.expandedIds = new Set();
  ui.render();
  assert.deepEqual(idsInList(), ["p1", "p2"]);

  // 新插入一单，日期落在中间 → 应该插到 p1 后面
  state.projects = [...state.projects, project({ id: "p3", date: "2026-12-04" })];
  const spy = spyListMoves();
  try {
    ui.renderAfterWrite({ changedIds: [] });
  } finally {
    spy.restore();
  }

  assert.deepEqual(idsInList(), ["p1", "p3", "p2"]);
  const p3 = nodeOf("p3");
  assert.ok(p3, "新卡片在列表里");
  assert.equal(p3.classList.contains("no-enter"), true, "新卡片带 no-enter，不播入场");
  assert.deepEqual(
    spy.cardMoves().map((c) => c.id),
    ["p3"],
    "只插新卡片，不碰已有卡片"
  );
});

/* ============ 2. 删除 / 恢复的回声不再二次重绘（js/projects.js） ============ */

const dbRow = (over = {}) => ({
  id: "p1",
  user_id: "u1",
  bid_date: "2026-12-02",
  bid_time: "09:30:00",
  project_type: "房建工程",
  name: "某市人民医院综合楼",
  bidding_company: "青海一建",
  tenderer: "某市卫健委",
  amount: "1200 万",
  guarantee: "银行保函",
  contact: "张三",
  status: "制作中",
  notes: "",
  deleted_at: null,
  checklist: [],
  amount_value: 1200,
  amount_unit: "万元",
  guarantee_amount: 20,
  guarantee_unit: "万元",
  guarantee_status: "未缴纳",
  registration_deadline: null,
  inquiry_deadline: null,
  clarification_deadline: null,
  guarantee_deadline: null,
  result: "",
  pdf_filename: "招标文件.pdf",
  pdf_parsed_at: null,
  created_at: "2026-11-20T08:00:00+00:00",
  updated_at: "2026-11-26T08:00:00+00:00",
  ...over,
});

const { createProjectsApi } = await import("../js/projects.js");

const uiProject = (id, name) => ({
  id,
  date: "2026-12-02",
  bidTime: "",
  type: "房建工程",
  name: name || `项目${id}`,
  biddingCompany: "青海一建",
  contact: "张三",
  status: "制作中",
  notes: "",
  result: "",
  checklist: [],
});

const makeProjectsApi = () => {
  const st = {
    projects: [],
    user: { id: "u1" },
    offlineSnapshot: false,
    selectedIds: new Set(),
  };
  const renders = [];
  // update().eq().eq() 与 delete().eq().eq() 都只回 { error: null }；
  // restore 走 .select(...).single()，返回给定的行。
  let restoredRow = null;
  const okChain = () => ({
    eq: () => ({ eq: async () => ({ error: null }) }),
  });
  const fakeClient = {
    from: () => ({
      update: () => ({
        eq: () => ({
          eq: () => ({
            select: () => ({
              single: async () => ({ data: restoredRow, error: null }),
            }),
          }),
        }),
      }),
      delete: okChain,
    }),
  };
  const api = createProjectsApi({
    getClient: () => fakeClient,
    getState: () => st,
    setState: (patch) => Object.assign(st, patch),
    ui: {
      renderAfterWrite: ({ changedIds } = {}) => renders.push(changedIds),
      render: () => renders.push("render"),
      showToast: () => {},
      setSyncStatus: () => {},
      confirmDialog: async () => true,
    },
  });
  return {
    api,
    state: st,
    renders,
    setRestoredRow: (row) => {
      restoredRow = row;
    },
    // 造一张回收站条目
    putInTrash: (id) => {
      st.projects = st.projects.filter((p) => p.id !== id);
      renders.length = 0;
    },
  };
};

test("v1.0.5：自己删除后 deleted_at 回声不再重绘（删除只闪一次）", () => {
  const { api, state, renders } = makeProjectsApi();
  state.projects = [uiProject("p1"), uiProject("p2")];

  // 本端删掉 p1（回收站里的软删除）—— 本地移除 + 一次定向渲染
  state.projects = state.projects.filter((p) => p.id !== "p1");
  renders.length = 0;

  const applied = api.applyRealtimeChange({
    eventType: "UPDATE",
    new: dbRow({ id: "p1", deleted_at: "2026-11-27T03:00:00+00:00" }),
  });

  assert.equal(applied, true, "回声算应用成功，不能回落全量重拉");
  assert.deepEqual(renders, [], "本地已经移除过了，不该再重绘一次");
  assert.deepEqual(state.projects.map((p) => p.id), ["p2"]);
});

test("v1.0.5：别的设备把项目移进回收站时照旧移除并重绘一次", () => {
  const { api, state, renders } = makeProjectsApi();
  state.projects = [uiProject("p1"), uiProject("p2")];
  renders.length = 0;

  const applied = api.applyRealtimeChange({
    eventType: "UPDATE",
    new: dbRow({ id: "p1", deleted_at: "2026-11-27T03:00:00+00:00" }),
  });

  assert.equal(applied, true);
  assert.deepEqual(renders, [[]], "真删了，要重绘一次");
  assert.deepEqual(state.projects.map((p) => p.id), ["p2"]);
});

test("v1.0.5：自己彻底删除后的 DELETE 回声不再重绘", () => {
  const { api, state, renders } = makeProjectsApi();
  state.projects = [uiProject("p2")]; // p1 早在回收站，不在主列表
  renders.length = 0;

  const applied = api.applyRealtimeChange({
    eventType: "DELETE",
    old: { id: "p1" },
  });

  assert.equal(applied, true);
  assert.deepEqual(renders, [], "本地本来就没有这条，不该重绘");
  assert.deepEqual(state.projects.map((p) => p.id), ["p2"]);
});

test("v1.0.5：别的设备彻底删除仍在列表里的项目时照旧移除并重绘", () => {
  const { api, state, renders } = makeProjectsApi();
  state.projects = [uiProject("p1"), uiProject("p2")];
  renders.length = 0;

  api.applyRealtimeChange({ eventType: "DELETE", old: { id: "p1" } });

  assert.deepEqual(renders, [[]]);
  assert.deepEqual(state.projects.map((p) => p.id), ["p2"]);
});

test("v1.0.5：恢复只提交一次，随后原样推回来的回声不再重绘", async () => {
  const ctx = makeProjectsApi();
  const row = dbRow({ id: "p1", deleted_at: null });
  ctx.setRestoredRow(row);
  ctx.state.projects = [];
  ctx.renders.length = 0;

  const ok = await ctx.api.restoreProject("p1");
  assert.equal(ok, true);
  assert.deepEqual(ctx.renders, [["p1"]], "恢复本地提交一次、只重绘这一张卡");
  assert.deepEqual(ctx.state.projects.map((p) => p.id), ["p1"]);

  ctx.renders.length = 0;
  const applied = ctx.api.applyRealtimeChange({
    eventType: "UPDATE",
    new: dbRow({ id: "p1", deleted_at: null }),
  });
  assert.equal(applied, true);
  assert.deepEqual(ctx.renders, [], "恢复的回声不该再重绘");
});

/* ============ 3. 回收站刷新不再重播入场动画（js/ui.js + css/views.css） ============ */

test("v1.0.5：回收站条目带 no-enter（恢复 / 彻底删除后刷新不再闪）", () => {
  ui.renderTrashList([
    { id: "t1", name: "刚删的", date: "2026-11-01", deletedAt: "2026-11-26T12:00:00" },
    { id: "t2", name: "快到期", date: "2026-10-01", deletedAt: "2026-10-22T12:00:00" },
  ]);
  const items = [...elements.trashList.querySelectorAll(".project-item")];
  assert.equal(items.length, 2);
  for (const el of items) {
    assert.equal(el.classList.contains("project-item"), true);
    assert.equal(el.classList.contains("no-enter"), true, `${el.dataset.id || "?"} 应带 no-enter`);
  }
});

test("v1.0.5：.project-item.no-enter 确实把入场动画关掉（回收站靠它不闪）", () => {
  assert.match(css, /\.project-item\.no-enter\s*\{\s*animation:\s*none;?\s*\}/);
});
