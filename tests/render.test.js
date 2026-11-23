/**
 * v0.35.0：渲染层的最小 DOM 测试（node --test + linkedom，无编译）。
 * 覆盖这次审查里“只在渲染与交互层才看得到”的几条：
 *   - 搜/筛无结果时说“没有匹配的项目”，不是“还没有项目”；
 *   - 项目行容器不再冒充 role=button，行尾箭头是真正的按钮；
 *   - 详情区状态是带 aria-pressed 的三选一；
 *   - 即将到期按“事项”计数（含驼峰截止字段）；
 *   - 回收站剩余天数、保证金合计；
 *   - 三出口确认框的返回值。
 * 只加载 index.html 的骨架（不执行 app.js），不碰网络与 Supabase。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const { window, document } = parseHTML(html);

// ui.js 只在函数体里用 document / window / CSS，import 前把这些挂到全局即可。
globalThis.window = window;
globalThis.document = document;
globalThis.CSS = { escape: (s) => String(s).replace(/["\\]/g, "\\$&") };
window.matchMedia = () => ({ matches: true }); // 减少动效 → 统计直接赋值，不跑 rAF
// ui.js 的提醒窗口读 localStorage（Node 里没有）——给一个内存替身。
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { createUi } = await import("../js/ui.js");

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

// linkedom 的 <select> 只有 value getter：直接点选 option。
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
  expandedIds: new Set(),
  collapsedSections: new Set(),
  selectMode: false,
  selectedIds: new Set(),
  listLimit: 50,
  trashLimit: 50,
  calYear: 2026,
  calMonth: 10,
  calSelected: "2026-11-19",
  offlineSnapshot: false,
};
const ui = createUi(elements, () => state);

const project = (over = {}) => ({
  id: "p1",
  date: "2026-11-25",
  bidTime: "",
  type: "房建工程",
  name: "某市人民医院综合楼",
  biddingCompany: "青海一建",
  tenderer: "",
  amount: "",
  guarantee: "",
  contact: "张三",
  status: "制作中",
  notes: "",
  result: "",
  checklist: [],
  ...over,
});

const render = (filters = {}) => {
  elements.search.value = filters.keyword || "";
  setSelect(elements.statusFilter, filters.status || "all");
  setSelect(elements.resultFilter, filters.result || "all");
  ui.render();
};

test("搜不到时列表说“没有匹配的项目”，并给一键清除，而不是“还没有项目”", () => {
  state.projects = [project()];
  render({ keyword: "zzz不存在" });
  const listHtml = elements.list.innerHTML;
  assert.match(listHtml, /没有匹配的项目/);
  assert.doesNotMatch(listHtml, /还没有项目/);
  assert.match(listHtml, /data-action="clear-filters"/);
  assert.match(elements.filterResultCount.textContent, /筛选结果：0 个（共 1 个）/);
});

test("真的没有项目（且无筛选）时才说“还没有项目”", () => {
  state.projects = [];
  render();
  assert.match(elements.list.innerHTML, /还没有项目/);
  assert.doesNotMatch(elements.list.innerHTML, /没有匹配的项目/);
});

test("结果筛选未命中同样走“没有匹配的项目”", () => {
  state.projects = [project({ status: "已开标", result: "未中标" })];
  render({ result: "已中标" });
  assert.match(elements.list.innerHTML, /没有匹配的项目/);
});

test("项目行：容器不再 role=button，行尾箭头是真按钮且带 aria-expanded", () => {
  state.projects = [project()];
  state.expandedIds = new Set();
  render();
  const head = elements.list.querySelector(".project-head");
  assert.equal(head.getAttribute("role"), null);
  assert.equal(head.getAttribute("tabindex"), null);
  const chevron = elements.list.querySelector(".project-chevron-btn");
  assert.equal(chevron.tagName, "BUTTON");
  assert.equal(chevron.getAttribute("aria-expanded"), "false");
  assert.match(chevron.getAttribute("aria-label"), /展开/);
});

test("详情区：项目状态是带 aria-pressed 的三选一", () => {
  state.projects = [project({ status: "制作中" })];
  state.expandedIds = new Set(["p1"]);
  render();
  const chips = [...elements.list.querySelectorAll(".status-chip")];
  assert.deepEqual(chips.map((c) => c.dataset.status), ["报名中", "制作中", "已开标"]);
  assert.deepEqual(chips.map((c) => c.getAttribute("aria-pressed")), ["false", "true", "false"]);
  assert.ok(chips[1].classList.contains("active"));
});

test("即将到期：卡片数字与面板条数同一口径（事项），驼峰截止字段也算", () => {
  state.projects = [
    project({ id: "p1", date: "2026-11-20", registrationDeadline: "2026-11-19" }),
    project({ id: "p2", date: "2026-11-21" }),
  ];
  // 固定“今天”，避免运行日期不同导致窗口判断漂移
  const RealDate = Date;
  const fixed = new RealDate("2026-11-19T08:00:00");
  globalThis.Date = class extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [fixed]));
    }
    static now() {
      return fixed.getTime();
    }
  };
  try {
    render();
    // p1 的报名截止（今天）+ 开标（明天），p2 开标（后天）→ 3 条事项
    const rows = elements.upcomingList.querySelectorAll(".upcoming-item");
    assert.equal(rows.length, 3);
    assert.equal(elements.upcomingCount.textContent, "3");
  } finally {
    globalThis.Date = RealDate;
  }
});

test("回收站：显示还剩几天自动删除（≤3 天标红）", () => {
  const RealDate = Date;
  const fixed = new RealDate("2026-11-19T12:00:00");
  globalThis.Date = class extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [fixed]));
    }
    static now() {
      return fixed.getTime();
    }
  };
  try {
    ui.renderTrashList([
      { id: "t1", name: "刚删的", date: "2026-11-01", deletedAt: "2026-11-18T12:00:00" },
      { id: "t2", name: "快到期", date: "2026-10-01", deletedAt: "2026-10-22T12:00:00" },
    ]);
  } finally {
    globalThis.Date = RealDate;
  }
  const text = elements.trashList.textContent;
  assert.match(text, /还剩 29 天自动删除/);
  assert.match(text, /还剩 2 天自动删除/);
  assert.equal(elements.trashList.querySelectorAll(".trash-expire.urgent").length, 1);
});

test("保证金清单：头部给待退还合计（元换算成万元）", () => {
  state.projects = [
    project({ id: "g1", status: "已开标", guaranteeStatus: "已缴纳", guaranteeAmount: 5, guaranteeUnit: "万元" }),
    project({ id: "g2", status: "已开标", guaranteeStatus: "已缴纳", guaranteeAmount: 20000, guaranteeUnit: "元" }),
  ];
  render();
  assert.match(elements.guaranteeTotals.textContent, /待退还合计 7\.00 万元（2 项）/);
});

test("三出口确认框：确定 / 次按钮 / 取消分别返回 confirm / alt / cancel", async () => {
  const p1 = ui.confirmDialog({
    title: "恢复方式",
    message: "m",
    confirmText: "覆盖已有",
    altText: "只补新增",
    cancelText: "取消恢复",
  });
  assert.equal(elements.confirmDialogAlt.textContent, "只补新增");
  assert.equal(elements.confirmDialogCancel.textContent, "取消恢复");
  assert.ok(elements.confirmDialogActions.classList.contains("three"));
  elements.confirmDialogAlt.onclick();
  assert.equal(await p1, "alt");
  // 关闭后恢复两出口，下一次普通确认框仍返回布尔
  assert.ok(!elements.confirmDialogActions.classList.contains("three"));
  const p2 = ui.confirmDialog({ message: "普通确认" });
  elements.confirmDialogOk.onclick();
  assert.equal(await p2, true);
});

test("未展开的项目卡片：详情区带 inert（不可聚焦、不被读屏读出）", () => {
  state.projects = [project()];
  state.expandedIds = new Set();
  render();
  const collapsed = elements.list.querySelector(".project-details .collapse-inner");
  assert.ok(collapsed.hasAttribute("inert"));

  state.expandedIds = new Set(["p1"]);
  render();
  const opened = elements.list.querySelector(".project-details .collapse-inner");
  assert.equal(opened.hasAttribute("inert"), false);
});

test("日历视图隐藏时不重建日历网格（切到日历视图再渲染才动）", () => {
  state.projects = [project()];
  state.expandedIds = new Set();
  elements.calendarView.classList.add("hidden");
  elements.calendarGrid.innerHTML = '<span id="sentinel"></span>';
  render();
  // 隐藏时 render() 不碰日历格：上一步放进去的哨兵还在
  assert.ok(elements.calendarGrid.querySelector("#sentinel"));

  elements.calendarView.classList.remove("hidden");
  render();
  assert.equal(elements.calendarGrid.querySelector("#sentinel"), null);
  elements.calendarView.classList.add("hidden");
});

test("中标率：只在有结果时显示，并标在工具栏", () => {
  state.projects = [
    project({ id: "a", result: "已中标" }),
    project({ id: "b", result: "未中标" }),
    project({ id: "c", result: "" }),
  ];
  render();
  assert.match(elements.winRate.textContent, /中标率 50%（1\/2）/);
  assert.ok(!elements.winRate.classList.contains("hidden"));
  state.projects = [project({ result: "" })];
  render();
  assert.ok(elements.winRate.classList.contains("hidden"));
});
