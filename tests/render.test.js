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
  expandedSections: new Set(),
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

// v0.35.4：手机端让状态三选一平铺一行的样式靠 kv-row-status 这一类挂钩，
// 它只出现在「项目状态」那一行（其余 kv 行仍是左标签 + 右值）。
test("详情区：v0.40.0 按开标时间/项目类型/投标公司 + 项目名称 + 联系人/中标结果/备注排布", () => {
  const { listEl, ui } = setupList();
  ui.renderList();
  const item = listEl.querySelector(".project-item");
  ui.fillProjectDetails(item, baseProject);
  const rows = [...item.querySelectorAll(".kv-row")];
  assert.ok(rows.some((r) => r.classList.contains("kv-row-time")));
  assert.ok(rows.some((r) => r.classList.contains("kv-row-type")));
  assert.ok(rows.some((r) => r.classList.contains("kv-row-company")));
  assert.ok(rows.some((r) => r.classList.contains("kv-row-name")));
  assert.ok(item.querySelector(".project-head-actions .status-quick-inline"));
});

// v0.35.6：卡片元信息行只剩「日期开标 · 类型」，投标公司包进 .project-sub-company
// 由手机端隐去；详情区把与卡头重复的「项目名称 / 项目类型」挂上对应的 kv-row-* 类。
test("项目卡：投标公司单独包在 .project-sub-company 里（手机端隐去）", () => {
  state.projects = [project({ biddingCompany: "青海一建建筑工程有限责任公司" })];
  state.expandedIds = new Set();
  render();
  const sub = elements.list.querySelector(".project-sub");
  assert.ok(sub, "卡片副标题仍在");
  assert.match(sub.textContent, /开标/);
  const company = sub.querySelector(".project-sub-company");
  assert.ok(company, "投标公司要包一层 .project-sub-company");
  assert.match(company.textContent, /青海一建建筑工程有限责任公司/);
  // 桌面端顺序不变：公司仍在副标题末尾
  assert.ok(sub.textContent.trim().endsWith("青海一建建筑工程有限责任公司"));
});

test("详情区：项目名称 / 项目类型带走样式的挂点，备注带 kv-row-note", () => {
  state.projects = [project({ name: "某某项目", type: "市政工程", notes: "资质原件已备齐" })];
  state.expandedIds = new Set(["p1"]);
  render();
  const rowOfLabel = (label) =>
    [...elements.list.querySelectorAll(".kv-row")].find(
      (r) => r.querySelector(".kv-label")?.textContent === label
    );
  assert.ok(rowOfLabel("项目名称").classList.contains("kv-row-name"));
  assert.ok(rowOfLabel("项目类型").classList.contains("kv-row-type"));
  assert.ok(rowOfLabel("备注").classList.contains("kv-row-note"));
});

test("详情区：展开后 body 带 detail-open（手机端据此收起浮动「＋」）", () => {
  state.projects = [project()];
  state.expandedIds = new Set(["p1"]);
  render();
  assert.ok(document.body.classList.contains("detail-open"));
  state.expandedIds = new Set();
  render();
  assert.equal(document.body.classList.contains("detail-open"), false);
});

test("即将到期：手机端收起态的摘要写清事项数与最近一条", () => {
  state.projects = [
    project({ id: "p1", date: "2026-11-20", registrationDeadline: "2026-11-19" }),
    project({ id: "p2", date: "2026-11-21" }),
  ];
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
    const summary = document.getElementById("upcomingSummary");
    assert.ok(summary, "index.html 里应有 #upcomingSummary");
    // v0.35.6：摘要与标题排成一行，文案压到「近 7 天 · 报名截止 今天」
    // （事项数交给上面的「临近」统计卡，这里不再重复，360 才不会截掉「今天」）
    assert.match(summary.textContent, /近 7 天/);
    assert.match(summary.textContent, /报名截止 今天/);
    assert.doesNotMatch(summary.textContent, /个截止/);
    // 摘要按钮包住整行（手机端是它把横条收起来的）
    const btn = document.getElementById("upcomingSummaryBtn");
    assert.equal(btn.getAttribute("aria-controls"), "upcomingList");
    assert.ok(summary.closest("#upcomingSummaryBtn"));
  } finally {
    globalThis.Date = RealDate;
  }
});

// v0.35.7：废标检查清单默认收起（手机与电脑同一套）——展开详情时先给一条紧凑标题栏
// （清单名 + 已完成 X/Y + 箭头），点整条展开；展开态记在 state.expandedSections。
test("清单默认收起：容器带 collapsed、aria-expanded=false，清单内容仍在 DOM 里", () => {
  state.expandedIds = new Set(["p1"]);
  state.expandedSections = new Set();
  state.projects = [
    project({
      checklist: [
        { id: "c1", text: "营业执照副本复印件加盖公章", done: true, source: "manual" },
        { id: "c2", text: "法人授权委托书及被授权人身份证", done: false, source: "manual" },
      ],
    }),
  ];
  render();
  const box = elements.list.querySelector(".checklist");
  assert.ok(box.classList.contains("collapsed"));
  assert.equal(box.classList.contains("expanded"), false);
  const toggle = box.querySelector(".checklist-toggle");
  assert.ok(toggle, "标题栏本身必须是按钮（整条可点）");
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.equal(toggle.dataset.action, "toggle-section");
  assert.equal(toggle.dataset.section, "checklist");
  // 进度条：清单名 + 已完成 X/Y
  assert.match(box.querySelector(".checklist-title").textContent, /废标检查清单/);
  assert.match(box.querySelector(".checklist-count").textContent, /已完成 1\/2/);
  // 内容在 DOM 里（收起是 CSS 收的高度，不是移除节点）——展开时才有过渡
  const body = box.querySelector(".checklist-body");
  assert.ok(body, "应有 .checklist-body");
  assert.equal(body.id, toggle.getAttribute("aria-controls"));
  assert.ok(body.firstElementChild.classList.contains("checklist-body-inner"));
  assert.equal(body.querySelectorAll(".checklist-item").length, 2);
  // 收起时不露「清空」（CSS 隐藏，但按钮仍在 DOM 里等展开）
  assert.ok(box.querySelector('[data-action="clear-checklist"]'));
});

test("清单点开后带 expanded、aria-expanded=true；收起时风险与条款仍是默认展开", () => {
  state.expandedIds = new Set(["p1"]);
  state.expandedSections = new Set(["p1:checklist"]);
  state.collapsedSections = new Set();
  state.projects = [
    project({
      checklist: [{ id: "c1", text: "营业执照副本复印件加盖公章", done: false, source: "manual" }],
      riskSummary: "招标文件对业绩要求较严。",
    }),
  ];
  render();
  const box = elements.list.querySelector(".checklist");
  assert.ok(box.classList.contains("expanded"));
  assert.equal(box.querySelector(".checklist-toggle").getAttribute("aria-expanded"), "true");
  assert.equal(box.querySelector(".checklist-count").textContent.trim(), "已完成 0/1");
  // 风险卡不受清单影响，仍是默认展开
  const risk = elements.list.querySelector(".risk-report");
  assert.ok(risk);
  assert.equal(risk.classList.contains("collapsed"), false);
  assert.equal(risk.classList.contains("expanded"), true);
});

// v0.35.7：长项目名在卡头最多两行会被截，详情区要能看全。
test("详情区：长项目名完整渲染在 .kv-row-name 里（不省略）", () => {
  const longName = "西宁市城东区第七中学教学楼加固改造及室外消防管网、道路恢复工程（第二次）";
  state.expandedIds = new Set(["p1"]);
  state.expandedSections = new Set();
  state.projects = [project({ name: longName })];
  render();
  const row = [...elements.list.querySelectorAll(".kv-row")].find(
    (r) => r.querySelector(".kv-label")?.textContent === "项目名称"
  );
  assert.ok(row, "详情区必须有「项目名称」一行");
  assert.ok(row.classList.contains("kv-row-name"));
  assert.equal(row.querySelector(".kv-value").textContent, longName);
});

// v0.35.5：清单条目改成 label 包勾选框 + 文字 —— 手机端整行可点（原来只有 18px 方框能勾）。
test("清单条目：勾选框与文字包在同一个 label 里（手机端整行可点）", () => {
  state.projects = [
    project({
      checklist: [{ id: "c1", text: "营业执照副本复印件加盖公章", done: false, source: "manual" }],
    }),
  ];
  state.expandedIds = new Set(["p1"]);
  render();
  const item = elements.list.querySelector(".checklist-item");
  assert.ok(item);
  const label = item.querySelector("label.checklist-main");
  assert.ok(label, "勾选框与文字必须包在 label.checklist-main 里");
  assert.ok(label.querySelector('input[type="checkbox"]'));
  assert.match(label.textContent, /营业执照副本/);
  // 勾选框不再是 .checklist-item 的直接子元素
  assert.equal([...item.children].some((c) => c.tagName === "INPUT"), false);
  assert.ok(item.querySelector(".checklist-source"));
  assert.ok(item.querySelector(".checklist-del"));
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

test("中标率：只在「已开标」且有结果时显示，并标在工具栏", () => {
  state.projects = [
    project({ id: "a", status: "已开标", result: "已中标" }),
    project({ id: "b", status: "已开标", result: "未中标" }),
    project({ id: "c", status: "已开标", result: "" }),
  ];
  render({ status: "已开标" });
  assert.match(elements.winRate.textContent, /中标率 50%（1\/2）/);
  assert.ok(!elements.winRate.classList.contains("hidden"));
  state.projects = [project({ status: "已开标", result: "" })];
  render({ status: "已开标" });
  assert.ok(elements.winRate.classList.contains("hidden"));
});
