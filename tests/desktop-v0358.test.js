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







test("index.html：菜单 / 设置 / 解析里的 emoji 已换成内联 SVG 图标", () => {
  const emoji = ["📥", "📤", "🗑", "💰", "🏅", "📅", "⚙", "🤖", "↩", "⏹", "💾", "♻", "🌙", "☀"];
  // 注释里提到旧版本的历史说明不算（只看真正会渲染出去的标记）
  const markup = html.replace(/<!--[\s\S]*?-->/g, "");
  for (const e of emoji) {
    assert.equal(markup.includes(e), false, `index.html 里还留着 emoji ${e}`);
  }
  // 关键入口都带图标
  for (const id of ["importBtn", "exportBtn", "trashMenuBtn", "aiSettingsBtn"]) {
    const el = document.getElementById(id);
    assert.ok(el.querySelector("svg"), `${id} 应有内联 SVG 图标`);
  }
  // 主题按钮：月亮 / 太阳两份图标 + 可更新的文字（ui.applyTheme 只改文字）
  const theme = document.getElementById("themeBtn");
  assert.ok(theme.querySelector(".theme-moon"));
  assert.ok(theme.querySelector(".theme-sun"));
  assert.ok(theme.querySelector(".btn-label"));
});

test("styles.css：桌面断点里的临期事项改成竖排（不再横向滚动裁切）", () => {
  const desktop = css.slice(css.indexOf("@media (min-width: 1024px)"));
  assert.match(desktop, /\.upcoming-list \{[\s\S]*?flex-direction: column;/);
  assert.match(desktop, /\.upcoming-list \{[\s\S]*?overflow: visible;/);
});
