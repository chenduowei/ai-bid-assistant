/**
 * v0.35.2：三处细节的行为测试
 *   1. 备注从「选填信息」挪到必填区最后一行（仍是选填）；
 *   2. 定位到项目不再挂 2 秒背景闪烁（styles.css 也没有那条动画了）；
 *   3. 保存后的定位带一次性柔光，且 Realtime 回声重建卡片时接着放、不从头闪一下。
 * 与 render.test.js 一样只加载 index.html 骨架 + js/ui.js，不碰网络与 Supabase。
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
// linkedom 没有滚动 API —— 记下调用参数即可断言“滚到哪、怎么滚”。
const scrollCalls = [];
window.Element.prototype.scrollIntoView = function scrollIntoView(options) {
  scrollCalls.push({ el: this, options });
};

/* ============ 1. 备注位置 ============ */

test("备注在必填区最后一行，不在折叠的选填区里", () => {
  const notes = document.getElementById("notes");
  assert.ok(notes, "表单里的备注字段还在");
  const field = notes.closest(".field");
  const section = field.closest(".form-section");
  assert.equal(
    section.querySelector(".form-section-title").textContent.trim(),
    "必填信息"
  );
  assert.equal(
    section.querySelector(".form-group").lastElementChild,
    field,
    "备注应是必填组的最后一行"
  );
  assert.equal(
    document.getElementById("optionalBody").contains(notes),
    false,
    "备注不应再留在选填区"
  );
});

test("备注仍是选填：没有 required、标签写明（选填）", () => {
  const notes = document.getElementById("notes");
  assert.equal(notes.hasAttribute("required"), false);
  assert.equal(notes.closest("form").hasAttribute("novalidate"), true);
  const label = document.querySelector('label[for="notes"]');
  assert.match(label.textContent, /选填/);
  assert.equal(label.querySelector(".req-dot"), null, "选填字段不该有必填红点");
});

test("选填区计数 12 → 11，且与 DOM、OPTIONAL_FIELDS 三处一致", () => {
  const domFields = document.querySelectorAll(
    "#optionalBody .form-group > .field"
  );
  assert.equal(domFields.length, 11);
  assert.equal(document.getElementById("optionalCount").textContent.trim(), "11");
  const block = appSource.match(/const OPTIONAL_FIELDS = \[([\s\S]*?)\];/)[1];
  const jsFields = [...block.matchAll(/"([A-Za-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(
    jsFields,
    [...domFields].map((f) => f.querySelector("[id]").id)
  );
  assert.equal(jsFields.includes("notes"), false);
});

/* ============ 2. 定位不再闪 ============ */

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

const { createUi } = await import("../js/ui.js");
// v0.54.0：先装假定时器 —— 本文件调 ui.render() 且 p2 在 2026-11-28（未来），
// renderHero 会启动真 1 秒 interval、把 node --test 进程钉住；只桩
// setInterval/clearInterval，sleep 用的 setTimeout 不动。
installHeroTimerFake();
const ui = createUi(elements, () => state);

const project = (over = {}) => ({
  id: "p1",
  date: "2026-11-25",
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nodeOf = (id) =>
  elements.list.querySelector(`.project-item[data-id="${id}"]`);

test("定位项目只用平滑滚动 + 展开，不再挂 2 秒闪烁高亮", async () => {
  state.projects = [
    project({ id: "p1", date: "2026-11-20" }),
    project({ id: "p2", date: "2026-11-28", name: "德令哈老旧小区改造" }),
  ];
  state.expandedIds = new Set();
  ui.render();
  scrollCalls.length = 0;

  ui.focusProjectInList("p2");

  // 展开详情：位置靠“展开了哪一张”说明，而不是靠亮一下
  assert.equal(state.expandedIds.has("p2"), true);
  const node = nodeOf("p2");
  assert.ok(node.classList.contains("expanded"), "目标卡片应展开");
  assert.deepEqual(scrollCalls.at(-1).options, { behavior: "smooth", block: "center" });

  // 全程不出现旧的高亮类（旧实现是 300ms 挂上、2300ms 摘掉）
  assert.equal(node.classList.contains("project-highlight"), false);
  await sleep(360);
  assert.equal(node.classList.contains("project-highlight"), false);
  assert.equal(nodeOf("p2").classList.contains("project-highlight"), false);
  assert.equal(nodeOf("p2").classList.contains("save-glow"), false);
});

test("styles.css 删掉了闪烁那套动画", () => {
  assert.doesNotMatch(css, /project-highlight/);
  assert.doesNotMatch(css, /highlight-fade/);
  assert.doesNotMatch(css, /2s ease-in-out both/);
});

/* ============ 3. 保存后的柔光与定位 ============ */

test("保存后定位带一次性柔光，随后自动摘掉", async () => {
  state.projects = [project({ id: "p1" }), project({ id: "p2", name: "果洛州卫生应急" })];
  state.expandedIds = new Set();
  ui.render();
  scrollCalls.length = 0;

  ui.focusProjectInList("p2", { glow: true });
  assert.ok(scrollCalls.at(-1).options.behavior === "smooth");
  assert.equal(nodeOf("p2").classList.contains("save-glow"), false, "滚动的第一帧先别亮");

  await sleep(320);
  assert.equal(nodeOf("p2").classList.contains("save-glow"), true);

  await sleep(1500);
  assert.equal(nodeOf("p2").classList.contains("save-glow"), false);
  assert.equal(nodeOf("p2").classList.contains("no-enter"), false);
});

test("柔光放到一半被 Realtime 回声重建：新卡片接着放，不从头再来", async () => {
  state.projects = [project({ id: "p1" }), project({ id: "p2", name: "某市政道路" })];
  state.expandedIds = new Set();
  ui.render();

  ui.focusProjectInList("p2", { glow: true });
  await sleep(320);
  const before = nodeOf("p2");
  assert.equal(before.classList.contains("save-glow"), true);

  // 回声：同一行数据从库里回来 → 定向渲染替换这张卡片
  ui.renderAfterWrite({ changedIds: ["p2"] });
  const after = nodeOf("p2");
  assert.notEqual(after, before, "卡片确实被重建了");
  assert.equal(after.classList.contains("save-glow"), true, "柔光要接着放");
  assert.match(
    after.style.animationDelay,
    /^-\d+ms$/,
    "用负延迟从当前进度继续，而不是 0ms 重新淡入"
  );

  await sleep(1600);
  assert.equal(nodeOf("p2").classList.contains("save-glow"), false);
});

/* ============ 4. 保存路径：等收起动画落定再定位 ============ */

test("保存成功后不是同一帧定位：等表单收起落定，且用户再打开表单会作废", () => {
  assert.match(appSource, /const FORM_COLLAPSE_SETTLE_MS = 380;/);
  assert.match(appSource, /locateProjectAfterSave\(savedId\)/);
  assert.doesNotMatch(
    appSource,
    /resetForm\(\);\s*\n\s*ui\.focusProjectInList\(savedId\);/,
    "旧的同帧定位会落到列表底部"
  );
  // “保存后再切换编辑对象”会把表单重新打开 —— 延迟定位必须能被取消
  const revealAt = appSource.indexOf("const revealForm = () => {");
  assert.ok(revealAt > 0, "找到 revealForm");
  assert.match(
    appSource.slice(revealAt, revealAt + 400),
    /cancelPendingLocate\(\)/,
    "revealForm 开头要作废待执行的定位"
  );
});

test("柔光照顾 prefers-reduced-motion：减动效时不播动画", () => {
  const block = css.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/);
  assert.ok(block, "有减动效的媒体查询");
  assert.match(block[0], /\.project-item\.save-glow \{ animation: none; \}/);
  assert.match(css, /@keyframes save-glow/);
});
