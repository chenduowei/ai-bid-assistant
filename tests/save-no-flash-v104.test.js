/**
 * v1.0.4：编辑保存后界面闪烁的回归测试（三处成因各一组）。
 *   1. Realtime 把刚保存的那一行原样推回来时，不再 upsert + 定向重绘（js/projects.js）；
 *   2. focusProjectInList 在卡片已存在于 DOM、只是要展开时，不 replaceWith 整张卡片（js/ui.js）；
 *   3. .project-item 不再带 content-visibility: auto / contain-intrinsic-size（css/views.css）。
 * 与 form-locate.test.js 同一套最小环境：只加载 index.html 骨架 + js/ui.js，不碰网络与 Supabase。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { readCssBundle } from "./css-bundle.mjs";
import { installHeroTimerFake } from "./hero-timer-fake.mjs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readCssBundle();
const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");

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
const scrollCalls = [];
window.Element.prototype.scrollIntoView = function scrollIntoView(options) {
  scrollCalls.push({ el: this, options });
};

/* ============ 1. Realtime 回声去重（js/projects.js） ============ */

// 一行完整的 listColumns 数据（与库里推回来的一模一样）。
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
  checklist: [{ id: "c1", text: "资质原件", done: false, source: "manual" }],
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
  pdf_parsed_at: "2026-11-26T08:00:00+00:00",
  created_at: "2026-11-20T08:00:00+00:00",
  updated_at: "2026-11-26T08:00:00+00:00",
  ...over,
});

const { createProjectsApi } = await import("../js/projects.js");

const makeProjectsApi = () => {
  const state = {
    projects: [],
    user: { id: "u1" },
    offlineSnapshot: false,
    selectedIds: new Set(),
  };
  const renders = [];
  const api = createProjectsApi({
    getClient: () => {
      throw new Error("本文件只测 Realtime 增量应用，不该碰网络");
    },
    getState: () => state,
    setState: (patch) => Object.assign(state, patch),
    ui: {
      renderAfterWrite: ({ changedIds } = {}) => renders.push(changedIds),
      render: () => renders.push("render"),
      showToast: () => {},
      setSyncStatus: () => {},
    },
  });
  return { api, state, renders };
};

test("v1.0.4：第一次收到 INSERT 正常入库并定向重绘一次", () => {
  const { api, state, renders } = makeProjectsApi();
  assert.equal(api.applyRealtimeChange({ eventType: "INSERT", new: dbRow() }), true);
  assert.equal(state.projects.length, 1);
  assert.equal(state.projects[0].name, "某市人民医院综合楼");
  assert.deepEqual(renders, [["p1"]]);
});

test("v1.0.4：自己保存后原样回推的 UPDATE 不再重绘（卡片不会二次重建）", () => {
  const { api, state, renders } = makeProjectsApi();
  api.applyRealtimeChange({ eventType: "INSERT", new: dbRow() });
  const before = state.projects;
  renders.length = 0;

  const applied = api.applyRealtimeChange({
    eventType: "UPDATE",
    // 只多了 updated_at（没有 UI 键，toUiProject 不映射），业务字段一模一样
    new: dbRow({ updated_at: "2026-11-27T01:02:03+00:00" }),
  });

  assert.equal(applied, true, "回声算应用成功，不能回落全量重拉");
  assert.deepEqual(renders, [], "一次重绘都不该有");
  assert.equal(state.projects, before, "连 state.projects 的数组引用都不换");
});

test("v1.0.4：回声里没有 pdfText —— 本地按需拉过的全文不会被回声抹掉", () => {
  const { api, state, renders } = makeProjectsApi();
  api.applyRealtimeChange({ eventType: "INSERT", new: dbRow() });
  state.projects[0].pdfText = "很长很长的招标全文……";
  renders.length = 0;

  api.applyRealtimeChange({ eventType: "UPDATE", new: dbRow() });

  assert.deepEqual(renders, []);
  assert.equal(state.projects[0].pdfText, "很长很长的招标全文……");
});

test("v1.0.4：真的改了字段的回声照旧入库并重绘这张卡片", () => {
  const { api, state, renders } = makeProjectsApi();
  api.applyRealtimeChange({ eventType: "INSERT", new: dbRow() });
  renders.length = 0;

  api.applyRealtimeChange({
    eventType: "UPDATE",
    new: dbRow({ name: "某市人民医院综合楼（二次）" }),
  });

  assert.deepEqual(renders, [["p1"]]);
  assert.equal(state.projects[0].name, "某市人民医院综合楼（二次）");
});

test("v1.0.4：清单（jsonb 数组）一致时同样视为回声，不一致则更新", () => {
  const { api, state, renders } = makeProjectsApi();
  api.applyRealtimeChange({ eventType: "INSERT", new: dbRow() });
  renders.length = 0;
  api.applyRealtimeChange({ eventType: "UPDATE", new: dbRow() });
  assert.deepEqual(renders, [], "同序同内容的清单不应触发重绘");

  api.applyRealtimeChange({
    eventType: "UPDATE",
    new: dbRow({
      checklist: [{ id: "c1", text: "资质原件", done: true, source: "manual" }],
    }),
  });
  assert.deepEqual(renders, [["p1"]], "勾选状态真变了就要重绘");
  assert.equal(state.projects[0].checklist[0].done, true);
});

/* ============ 2. 定位不替换 DOM 节点（js/ui.js） ============ */

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
// linkedom 的 <select>.value 只有 getter（浏览器里是可写的）—— focusProjectInList 清筛选时
// 会直接 assign 它，这里给两个下拉补一个能同步 selected 的 setter。
const makeSelectWritable = (el) => {
  let current = "all";
  Object.defineProperty(el, "value", {
    configurable: true,
    get: () => current,
    set: (next) => {
      current = String(next);
      setSelect(el, current);
    },
  });
};
makeSelectWritable(elements.statusFilter);
makeSelectWritable(elements.resultFilter);

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

test("v1.0.4：卡片已在 DOM 里时定位只就地展开，不换节点、不重播入场动画", () => {
  state.projects = [project({ id: "p1" }), project({ id: "p2", name: "德令哈老旧小区改造" })];
  state.expandedIds = new Set();
  ui.render();
  const before = nodeOf("p2");
  assert.ok(before, "渲染后卡片在列表里");
  assert.equal(before.classList.contains("expanded"), false);
  scrollCalls.length = 0;

  ui.focusProjectInList("p2");

  assert.equal(nodeOf("p2"), before, "DOM 节点必须是同一个（没有 replaceWith）");
  assert.equal(before.classList.contains("expanded"), true);
  assert.equal(
    before.querySelector(".project-details").classList.contains("expanded"),
    true,
    "详情区展开"
  );
  assert.equal(
    before.querySelector(".collapse-inner").hasAttribute("inert"),
    false,
    "展开后详情不再 inert"
  );
  assert.match(
    before.querySelector(".collapse-inner").innerHTML,
    /德令哈老旧小区改造/,
    "详情 HTML 已补填（里面有项目名）"
  );
  assert.equal(
    before.querySelector(".project-chevron-btn").getAttribute("aria-expanded"),
    "true"
  );
  assert.equal(state.expandedIds.has("p2"), true);
  assert.deepEqual(scrollCalls.at(-1).options, { behavior: "smooth", block: "center" });
  assert.equal(
    before.classList.contains("no-enter"),
    true,
    "no-enter 留着 —— 摘掉会让 animation 从 none 换回 item-in，当场重播一次淡入"
  );
});

test("v1.0.4：目标已被筛掉时照旧清筛选、重建列表并展开定位", () => {
  state.projects = [
    project({ id: "p1", name: "果洛州卫生应急" }),
    project({ id: "p2", name: "德令哈老旧小区改造" }),
  ];
  state.expandedIds = new Set();
  elements.search.value = "果洛";
  ui.render();
  assert.equal(nodeOf("p2"), null, "搜索把 p2 筛掉了");
  scrollCalls.length = 0;

  ui.focusProjectInList("p2");

  assert.equal(elements.search.value, "", "定位时清掉搜索");
  const node = nodeOf("p2");
  assert.ok(node, "p2 回到列表");
  assert.equal(node.classList.contains("expanded"), true);
  assert.equal(state.expandedIds.has("p2"), true);
  assert.equal(scrollCalls.at(-1).options.behavior, "smooth");
});

test("v1.0.4：只改了展开 / 滚动 —— 保存后那张卡片不再被 replaceWith", () => {
  // ui.js 里定位分支的两种走法：DOM 里已有 → changedIds 为空（只对账，不碰这张卡）；
  // 不在 DOM 里（被筛掉 / 在“加载更多”后面）才传 [projectId] 重建。
  const uiSource = readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");
  const focusSrc = uiSource.slice(
    uiSource.indexOf("const focusProjectInList"),
    uiSource.indexOf("const updateCountdowns")
  );
  assert.match(focusSrc, /const existing = locateNode\(projectId\)/);
  assert.match(focusSrc, /const withinPage = /);
  assert.match(focusSrc, /renderAfterWrite\(\{ changedIds: \[\] \}\)/);
  assert.match(focusSrc, /expandProjectCard\(/);
});

/* ============ 2b. 保存 → 回声 → 定位：同一张卡片只重建一次（整体串起来） ============ */

test("v1.0.4：保存一次只重建一次卡片 —— 回声与定位都不再换节点", async () => {
  // 库里回来的那一行（与 valide 过的表单字段一致即可：本地与回声都从这一行派生，
  // 只要两次拿到的行一样，就会被判为回声）。
  const savedRow = {
    id: "p2",
    user_id: "u1",
    bid_date: "2026-12-02",
    bid_time: "09:30:00",
    project_type: "房建工程",
    name: "德令哈老旧小区改造（改）",
    bidding_company: "青海一建",
    tenderer: null,
    amount: null,
    guarantee: null,
    contact: "张三",
    status: "制作中",
    notes: null,
    deleted_at: null,
    checklist: [],
    amount_value: null,
    amount_unit: "万元",
    guarantee_amount: null,
    guarantee_unit: "万元",
    guarantee_status: "未缴纳",
    registration_deadline: null,
    inquiry_deadline: null,
    clarification_deadline: null,
    guarantee_deadline: null,
    result: null,
    pdf_filename: "",
    pdf_parsed_at: null,
    created_at: "2026-11-20T08:00:00+00:00",
    updated_at: "2026-11-27T02:00:00+00:00",
  };
  const fakeClient = {
    from: () => ({
      select: () => ({ limit: async () => ({ error: null, data: [] }) }),
      update: () => ({
        eq: () => ({
          eq: () => ({
            select: () => ({
              single: async () => ({ data: savedRow, error: null }),
            }),
          }),
        }),
      }),
    }),
  };
  const api = createProjectsApi({
    getClient: () => fakeClient,
    getState: () => state,
    setState: (patch) => Object.assign(state, patch),
    ui,
  });

  state.projects = [
    project({ id: "p1", name: "果洛州卫生应急" }),
    project({ id: "p2", name: "德令哈老旧小区改造" }),
  ];
  state.expandedIds = new Set();
  ui.render();

  const formProject = {
    id: "p2",
    bid_date: "2026-12-02",
    bid_time: "09:30",
    project_type: "房建工程",
    name: "德令哈老旧小区改造（改）",
    bidding_company: "青海一建",
    contact: "张三",
    status: "制作中",
  };
  const savedId = await api.saveProject(formProject, "p2");
  assert.equal(savedId, "p2");
  const afterSave = nodeOf("p2");
  assert.ok(afterSave, "保存后卡片还在列表里");
  assert.equal(
    state.projects.find((p) => p.id === "p2").name,
    "德令哈老旧小区改造（改）"
  );

  // 1. Realtime 把同一行推回来 —— 不应再重建
  assert.equal(
    api.applyRealtimeChange({ eventType: "UPDATE", new: { ...savedRow } }),
    true
  );
  assert.equal(nodeOf("p2"), afterSave, "回声不应替换卡片节点");

  // 2. 380ms 后的定位 —— 就地展开，不应再重建
  ui.focusProjectInList("p2");
  assert.equal(nodeOf("p2"), afterSave, "定位不应替换卡片节点");
  assert.equal(afterSave.classList.contains("expanded"), true);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(nodeOf("p2"), afterSave);
});

/* ============ 3. CSS：project-item 不再 content-visibility ============ */

test("v1.0.4：.project-item 去掉了 content-visibility: auto 与 contain-intrinsic-size", () => {
  assert.doesNotMatch(css, /content-visibility/);
  assert.doesNotMatch(css, /contain-intrinsic-size/);
  const block = css.match(/\.project-item \{[^}]*\}/);
  assert.ok(block, ".project-item 规则还在");
  assert.match(block[0], /animation: item-in/);
  assert.match(block[0], /border-bottom: 1px solid var\(--border\)/);
});
