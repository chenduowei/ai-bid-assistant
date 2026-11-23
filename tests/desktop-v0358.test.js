/**
 * v0.35.8：电脑端深度打磨 + 双端精修的行为测试。
 * 与 css-cascade.test.js 的分工：那边守「样式表的顺序/覆盖」，这里守
 *   1) 渲染层真的产出了新结构（风险等级中文、证据操作成组、× 不再是灰底按钮）；
 *   2) index.html 的图标与容器结构（emoji 清干净、.side-rail 包住临期+表单）；
 *   3) styles.css 里这次新增的几条关键规则落点（桌面两栏、手机两行截断、证据组右对齐）。
 * 只加载 index.html 骨架 + ui.js，不跑 app.js、不碰网络。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
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

const { createUi } = await import("../js/ui.js");

const IDS = [
  "list", "filterResultCount", "search", "statusFilter", "resultFilter", "sortBy",
  "toastWrap", "syncStatus", "upcomingList", "upcomingDesc", "deadlineTip", "refundTip",
  "trashList", "guaranteeList", "guaranteeCount", "guaranteeTotals",
  "calendarGrid", "calendarDayList", "calendarTitle", "calendarDayTitle", "calendarView",
  "totalCount", "registeringCount", "makingCount", "openedCount", "inTransitGuarantee",
  "upcomingCount", "winRate", "collapseAllBtn", "offlineBanner", "backToTopBtn",
  "goToBottomBtn", "themeBtn",
];
const elements = {};
for (const id of IDS) elements[id] = document.getElementById(id);

const state = {
  projects: [],
  expandedIds: new Set(["p1"]),
  collapsedSections: new Set(),
  expandedSections: new Set(["checklist"]),
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
  contact: "张三",
  status: "制作中",
  notes: "",
  result: "",
  checklist: [],
  ...over,
});

const render = () => {
  elements.search.value = "";
  for (const sel of [elements.statusFilter, elements.resultFilter]) {
    for (const opt of sel.querySelectorAll("option")) {
      if (opt.getAttribute("value") === "all") opt.setAttribute("selected", "");
      else opt.removeAttribute("selected");
    }
  }
  ui.render();
};

test("风险等级：界面显示中文（高 / 中 / 低），不再把 high / medium 印在胶囊里", () => {
  state.projects = [
    project({
      riskPoints: [
        { level: "high", text: "资质要求严格", page: 3, quote: "" },
        { level: "medium", text: "有效期偏短", page: 5, quote: "" },
        { level: "low", text: "格式瑕疵", page: null, quote: "" },
        { level: "weird", text: "未知等级", page: null, quote: "" },
      ],
    }),
  ];
  render();
  const chips = [...elements.list.querySelectorAll(".risk-level")].map((e) => e.textContent.trim());
  assert.deepEqual(chips, ["高", "中", "低", "中"]);
  const htmlText = elements.list.innerHTML;
  assert.doesNotMatch(htmlText, />high</);
  assert.doesNotMatch(htmlText, />medium</);
  // 颜色仍按等级走（CSS 类名不变）
  assert.equal(elements.list.querySelector(".risk-level.high").textContent.trim(), "高");
});

test("证据行：核对与删除包成一组（.evidence-actions），窄屏折行时整组一起走", () => {
  state.projects = [
    project({
      riskPoints: [{ level: "high", text: "资质要求严格", page: 12, quote: "投标人须具备…" }],
    }),
  ];
  render();
  const meta = elements.list.querySelector(".risk-points .evidence-meta");
  assert.ok(meta, "风险点下应有证据行");
  const group = meta.querySelector(".evidence-actions");
  assert.ok(group, "核对 / 删除应在 .evidence-actions 里");
  assert.ok(group.querySelector(".verify-btn"), "组里要有核对按钮");
  assert.ok(group.querySelector(".evidence-del"), "组里要有删除按钮");
  // 两个操作之外的东西不在这组里
  assert.equal(group.children.length, 2);
});

test("删除结论的 ×：不再是灰底 secondary 按钮（避免看着像第二个复选框）", () => {
  state.projects = [
    project({
      riskPoints: [{ level: "medium", text: "有效期偏短", page: 5, quote: "" }],
    }),
  ];
  render();
  const del = elements.list.querySelector(".evidence-del");
  assert.ok(del);
  assert.equal(del.classList.contains("btn"), false);
  assert.equal(del.classList.contains("secondary"), false);
  assert.match(del.getAttribute("aria-label") || "", /删除/);
});

test("index.html：菜单 / 设置 / 解析里的 emoji 已换成内联 SVG 图标", () => {
  const emoji = ["📥", "📤", "🗑", "💰", "🏅", "📅", "⚙", "🤖", "↩", "⏹", "💾", "♻", "🌙", "☀"];
  // 注释里提到旧版本的历史说明不算（只看真正会渲染出去的标记）
  const markup = html.replace(/<!--[\s\S]*?-->/g, "");
  for (const e of emoji) {
    assert.equal(markup.includes(e), false, `index.html 里还留着 emoji ${e}`);
  }
  // 关键入口都带图标
  for (const id of ["importBtn", "exportBtn", "trashMenuBtn", "guaranteeMenuBtn", "qualMenuBtn", "calendarMenuBtn", "aiSettingsBtn"]) {
    const el = document.getElementById(id);
    assert.ok(el.querySelector("svg"), `${id} 应有内联 SVG 图标`);
  }
  // 主题按钮：月亮 / 太阳两份图标 + 可更新的文字（ui.applyTheme 只改文字）
  const theme = document.getElementById("themeBtn");
  assert.ok(theme.querySelector(".theme-moon"));
  assert.ok(theme.querySelector(".theme-sun"));
  assert.ok(theme.querySelector(".btn-label"));
});

test("index.html：右栏容器 .side-rail 包住「临期 + 新增」，项目列表仍是它的兄弟且在其后", () => {
  const rail = document.querySelector(".side-rail");
  assert.ok(rail, "应有 .side-rail 包裹层");
  assert.ok(rail.querySelector(".upcoming-panel"), "临期事项在右栏里");
  assert.ok(rail.querySelector(".form-panel"), "新增 / 编辑在右栏里");
  const view = document.getElementById("dashboardView");
  const kids = [...view.children].map((e) => e.className);
  assert.equal(kids.includes("side-rail"), true);
  // 列表必须排在右栏之后（手机端文档流顺序不变：临期 → 表单 → 列表）
  assert.ok([...view.children].indexOf(document.querySelector(".list-panel")) > [...view.children].indexOf(rail));
});

test("styles.css：桌面两栏版式与关键规则落点", () => {
  // 右栏容器在窄屏透明，孩子照旧走文档流
  assert.match(css, /\.side-rail \{ display: contents; \}/);
  // 桌面网格：左列表 / 右信息栏
  assert.match(css, /"list {3}rail"/);
  // 表单展开时铺满整行（:has 提高不到桌面布局时不至于半张空）
  assert.match(css, /:has\(\.form-panel\.expanded\)/);
  // 证据操作组右对齐
  assert.match(css, /\.evidence-actions \{[^}]*margin-left: auto;/);
  // 手机端长名称：行高 1.4 + max-height 2.8em（第三行不再露头）
  const mobileName = css.slice(css.indexOf("@media (max-width: 680px)"));
  assert.match(mobileName, /\.project-head \.project-name \{[\s\S]*?line-height: 1\.4;[\s\S]*?max-height: 2\.8em;/);
  // 桌面断点只出现一次，便于维护
  assert.equal((css.match(/@media \(min-width: 1024px\)/g) || []).length, 1);
});

test("styles.css：桌面断点里的临期事项改成竖排（不再横向滚动裁切）", () => {
  const desktop = css.slice(css.indexOf("@media (min-width: 1024px)"));
  assert.match(desktop, /\.upcoming-list \{[\s\S]*?flex-direction: column;/);
  assert.match(desktop, /\.upcoming-list \{[\s\S]*?overflow: visible;/);
});
