/**
 * v1.0.6：项目卡片展开 / 收起的丝滑度回归测试。
 * 用户实测「点开项目时列表整体向下挪一点，不够丝滑，有掉帧感」的三处根因各钉一组：
 *   1. 第 0 帧的边距跳变：详情区的 margin / padding / border-top 只在 .expanded 上、
 *      且不参与 0fr 高度裁切，点开瞬间长出 34px 把下面的列表硬顶下去（css/views.css、css/breakpoints.css）。
 *      v1.0.6 企图给 .project-item.expanded 的 6px 外边距加过渡来缓解，v1.0.7 直接去掉这段
 *      外边距（行位置点开前后完全不动），过渡里也不再有 margin。
 *   2. 拼详情 HTML 与起跑 grid-template-rows 过渡挤在同一帧（app.js、js/ui.js）。
 *   3. .collapse 在本文件里写了三遍，最后一遍把弹簧曲线覆盖成 --ease-out、把内层过渡整条换掉
 *      （css/components.css）。
 * 与 render.test.js 同一套最小环境：只加载 index.html 骨架 + js/ui.js，不碰网络与 Supabase。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { readCssBundle } from "./css-bundle.mjs";
import { parseCssRules } from "../scripts/check-css.mjs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readCssBundle();
const appSource = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const uiSource = readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");

const { window, document } = parseHTML(html);
globalThis.window = window;
globalThis.document = document;
globalThis.CSS = { escape: (s) => String(s).replace(/["\\]/g, "\\$&") };
window.matchMedia = () => ({ matches: true }); // 减少动效 → 统计直接赋值，不跑 rAF
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
elements.search.value = "";
for (const [sel, val] of [["statusFilter", "all"], ["sortBy", "date-desc"], ["resultFilter", "all"]]) {
  for (const opt of elements[sel].querySelectorAll("option")) {
    if (opt.getAttribute("value") === val) opt.setAttribute("selected", "");
    else opt.removeAttribute("selected");
  }
}
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
  date: "2026-12-02",
  bidTime: "09:30",
  type: "房建工程",
  name: "某市人民医院综合楼",
  biddingCompany: "青海一建",
  tenderer: "",
  amount: "",
  guarantee: "",
  contact: "张三",
  status: "制作中",
  notes: "需要现场踏勘",
  result: "",
  checklist: [],
  registrationDeadline: "2026-11-28",
  ...over,
});

const itemOf = (id) =>
  elements.list.querySelector(`.project-item[data-id="${id}"]`);

const renderWith = (expandedIds) => {
  state.projects = [project(), project({ id: "p2", name: "德令哈老旧小区改造" })];
  state.expandedIds = new Set(expandedIds);
  ui.render();
};

/* ============ 1. 详情内容全部收在一个内层容器里（0fr 才能精确裁到 0px） ============ */

test("v1.0.6：展开态详情区只有一个内层容器，内容全部在里面", () => {
  renderWith(["p1"]);
  const inner = itemOf("p1").querySelector(".collapse-inner");
  assert.equal(inner.children.length, 1, "详情内容必须只有一层包裹，不能有裸在 .collapse-inner 里的节点");
  const body = inner.firstElementChild;
  assert.ok(body.classList.contains("project-details-body"), "内层容器是 .project-details-body");
  assert.ok(body.querySelector(".kv-list"), "定义列表在容器内");
  assert.equal(body.querySelectorAll(".kv-row").length, 8, "七行基础信息 + 一行报名截止");
  assert.ok(body.querySelector(".deadline-line"), "最近截止也在容器内");
});

test("v1.0.6：折叠态详情区仍为空且 inert（懒生成不变）", () => {
  renderWith([]);
  const inner = itemOf("p1").querySelector(".collapse-inner");
  assert.equal(inner.innerHTML.trim(), "");
  assert.ok(inner.hasAttribute("inert"));
});

/* ============ 2. 第 0 帧不再有 margin / padding / border 突变 ============ */

const rules = parseCssRules(css);
const unconditional = (selector) =>
  rules.filter((r) => r.selector === selector && r.media.length === 0);
const declOf = (rule, prop) => rule?.decls.find((d) => d.prop === prop)?.value;

test("v1.0.6：详情区的水平留白恒定，上下 padding / border 一律为 0", () => {
  const innerRule = unconditional(".project-details > .collapse-inner");
  assert.ok(innerRule.length, "必须有 .project-details > .collapse-inner（不再是 :expanded 才生效）");
  const rule = innerRule[0];
  assert.equal(declOf(rule, "margin"), "0 var(--sp-4)", "水平留白常驻，上下 0");
  assert.equal(declOf(rule, "padding"), "0");
  assert.equal(declOf(rule, "border"), "0");
  // 旧写法（只在 .expanded 上突变三件套）必须彻底消失
  const legacy = rules.filter(
    (r) =>
      r.selector.includes(".project-details") &&
      r.selector.includes(".collapse-inner") &&
      r.selector.includes(".expanded")
  );
  assert.deepEqual(legacy.map((r) => r.selector), [], "不能再用 .expanded > .collapse-inner 突变留白");
});

test("v1.0.6：留白与分隔线交给内层容器，随高度一起展开", () => {
  const bodyRule = unconditional(".project-details-body");
  assert.ok(bodyRule.length, "基础样式里应有 .project-details-body");
  assert.equal(declOf(bodyRule[0], "padding"), "12px 0 20px");
  assert.equal(declOf(bodyRule[0], "border-top"), "1px solid var(--border)");
  // 手机端（≤680）与桌面宽屏（≥1024）各一档，改断点时不会被连坐
  const inMedia = (cond) =>
    rules.find((r) => r.selector === ".project-details-body" && r.media.some((m) => cond.test(m)));
  assert.equal(declOf(inMedia(/max-width:\s*680px/), "padding"), "2px 0 12px");
  assert.equal(declOf(inMedia(/min-width:\s*1024px/), "padding"), "4px 0 14px");
});

test("v1.0.7：.project-item 的过渡清单合成一份，且里边距已退出过渡", () => {
  const withTransition = rules.filter((r) => r.media.length === 0 &&
    declOf(r, "transition") !== undefined &&
    r.selector.split(",").map((s) => s.trim()).includes(".project-item"));
  assert.equal(withTransition.length, 1, "本文件只能有一条 .project-item 的 transition（此前两条互相覆盖）");
  const t = declOf(withTransition[0], "transition");
  for (const prop of ["border-radius", "background-color", "box-shadow", "transform"]) {
    assert.match(t, new RegExp(prop), `.project-item 的过渡要包含 ${prop}`);
  }
  // v1.0.7：展开态不再带 margin，过渡里也就不该再有 margin（详见 v107-no-expand-shift.test.js）
  assert.equal(/\bmargin\b/.test(t), false, "margin 已不是可动属性");
});

/* ============ 3. .collapse 只剩一份，弹簧曲线不再被覆盖 ============ */

test("v1.0.6：.collapse 的 transition 只定义一次，且用弹簧曲线", () => {
  const collapseRules = unconditional(".collapse");
  assert.equal(collapseRules.length, 1, "components.css 里 .collapse 只能有一份（原来三份）");
  const t = declOf(collapseRules[0], "transition");
  assert.match(t, /grid-template-rows var\(--dur-slow\) var\(--ease-spring\)/);
  assert.match(t, /opacity var\(--dur-quick\) var\(--ease-standard\)/);
  const collapseInner = unconditional(".collapse-inner");
  assert.equal(collapseInner.length, 1, ".collapse-inner 也只能有一份");
  const inner = collapseInner[0];
  assert.equal(declOf(inner, "min-height"), "0");
  assert.equal(declOf(inner, "overflow"), "hidden");
  assert.equal(declOf(inner, "padding"), "0");
  assert.equal(declOf(inner, "margin"), "0");
});

/* ============ 4. 先填内容、算完布局，再起跑过渡 ============ */

test("v1.0.6：toggleProjectDetails 先补详情并强制布局，再加 expanded", () => {
  const src = appSource.slice(
    appSource.indexOf("const toggleProjectDetails"),
    appSource.indexOf("const FORM_COLLAPSE_SETTLE_MS")
  );
  const fill = src.indexOf("ui.fillProjectDetails(item, project)");
  const flush = src.indexOf("void details.offsetHeight");
  const expand = src.indexOf('details.classList.toggle("expanded"');
  assert.ok(fill > -1, "展开时要补填详情");
  assert.ok(flush > -1, "补填后要读一次 offsetHeight 强制同步布局");
  assert.ok(expand > -1);
  assert.ok(fill < expand, "补详情必须在加 .expanded 之前（同一帧里不再边解析边起跑）");
  assert.ok(flush < expand, "强制布局也要在加 .expanded 之前");
});

test("v1.0.6：focusProjectInList 的就地展开同样先填后展开", () => {
  const src = uiSource.slice(
    uiSource.indexOf("const expandProjectCard"),
    uiSource.indexOf("const renderProjectItem")
  );
  const fill = src.indexOf("fillProjectDetails(itemEl, project)");
  const flush = src.indexOf("void details.offsetHeight");
  const expand = src.indexOf('details.classList.add("expanded")');
  assert.ok(fill > -1 && flush > -1 && expand > -1);
  assert.ok(fill < expand && flush < expand);
});
