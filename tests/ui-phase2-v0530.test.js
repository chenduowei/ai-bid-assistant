/**
 * v0.53.0：UI 打磨第二期 —— 倒计时英雄区（分钟级）+ 顶栏收尾。
 * 只加载 index.html 骨架 + js/ui.js（linkedom），不跑 app.js、不碰网络。
 * 守的是：英雄区 DOM 与分钟级渲染（无项目整区隐藏、有项目填数且不启动
 * 1 秒定时器）、顶栏两按钮已进菜单、字体统一、页眉版本号隐藏、临期事项
 * 卡片直开临期提醒抽屉，以及版本号 0.53.0 全仓一致。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { readCssBundle } from "./css-bundle.mjs";
import { parseCssRules } from "../scripts/check-css.mjs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const uiJs = readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");
const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
);
const css = readCssBundle();
const rules = parseCssRules(css);
const declOf = (rule, prop) =>
  rule?.decls.find((d) => d.prop === prop)?.normValue;
const rulesFor = (selector, mediaPart) =>
  rules.filter(
    (r) =>
      r.selector === selector &&
      (mediaPart ? r.media.join(" ").includes(mediaPart) : r.media.length === 0)
  );

const { window, document } = parseHTML(html);
globalThis.window = window;
globalThis.document = document;
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { createUi } = await import("../js/ui.js");

/** 按真实 elements 映射从 linkedom 文档里取元素（缺失为 null，与 app.js 同口径）。 */
const buildElements = (doc) => {
  const elements = {};
  doc.querySelectorAll("[id]").forEach((el) => {
    elements[el.id] = el;
  });
  return elements;
};

const FUTURE_PROJECT = {
  id: "hero-1",
  name: "某某市政道路改造及配套管网建设工程监理服务采购项目（第二标段）超长名称测试",
  date: "2030-11-28",
  bidTime: "09:30",
  status: "制作中",
};

test("v0.53.0：英雄区 DOM 已就位 —— 页头下方、统计区上方，带齐 7 个 id，默认隐藏", () => {
  const hero = document.getElementById("bpHero");
  assert.ok(hero, "应有 #bpHero");
  assert.equal(hero.tagName, "SECTION");
  assert.equal(hero.hidden, true, "默认 hidden，等 renderHero 有项目才显示");
  for (const id of [
    "bpHeroLabel",
    "bpHeroName",
    "bpHeroBadge",
    "bpHeroTime",
    "bpHeroCount",
    "bpHeroAction",
  ]) {
    assert.ok(document.getElementById(id), `应有 #${id}`);
  }
  // 位置：页头（header）之后、统计区之前
  const dashboard = document.getElementById("dashboardView");
  const kids = [...dashboard.children].map((el) => el.id || el.className);
  const heroIdx = kids.indexOf("bpHero");
  const statsIdx = kids.findIndex((c) => String(c).includes("stats"));
  assert.ok(heroIdx > -1 && statsIdx > heroIdx, "英雄区应在统计区上方");
  assert.equal(document.getElementById("bpHeroCount").getAttribute("aria-live"), "off");
  assert.equal(document.getElementById("bpHeroName").getAttribute("tabindex"), "0");
  assert.ok(
    document.getElementById("bpHeroName").classList.contains("bp-clamp-2"),
    "项目名两行截断"
  );
  assert.equal(
    document.getElementById("bpHeroLabel").textContent.trim(),
    "最近一场开标"
  );
});

test("v0.53.0：renderHero —— 无待开标项目时整区隐藏，不留空白卡", () => {
  const elements = buildElements(document);
  const ui = createUi(elements, () => ({ projects: [], viewMode: "list" }));
  ui.renderHero();
  const hero = document.getElementById("bpHero");
  assert.equal(hero.hidden, true, "无项目时 hidden");
  assert.equal(hero.getAttribute("hidden"), "");

  const ui2 = createUi(elements, () => ({
    projects: [{ ...FUTURE_PROJECT, status: "已开标" }],
    viewMode: "list",
  }));
  ui2.renderHero();
  assert.equal(hero.hidden, true, "只剩已开标项目时也隐藏");
});

test("v0.53.0：renderHero —— 有待开标项目时显示并填数（分钟级，不启动 1 秒定时器）", () => {
  const elements = buildElements(document);
  const ui = createUi(elements, () => ({
    projects: [FUTURE_PROJECT],
    viewMode: "list",
  }));
  ui.renderHero();
  const hero = document.getElementById("bpHero");
  assert.equal(hero.hidden, false);
  assert.equal(
    document.getElementById("bpHeroName").textContent,
    FUTURE_PROJECT.name
  );
  assert.equal(
    document.getElementById("bpHeroName").dataset.projectId,
    FUTURE_PROJECT.id
  );
  assert.match(
    document.getElementById("bpHeroTime").textContent,
    /开标/
  );
  assert.match(
    document.getElementById("bpHeroCount").textContent,
    /^\d+天 \d{2}:\d{2}:\d{2}$/,
    "倒计时为「N天 HH:MM:SS」"
  );
  assert.equal(
    document.getElementById("bpHeroAction").hidden,
    false,
    "有项目时显示查看按钮"
  );
  // 分钟级：renderHero 不启动 1 秒定时器（秒级跳动留待后续一期）。
  const renderHeroSrc = uiJs.slice(
    uiJs.indexOf("const renderHero"),
    uiJs.indexOf("const renderAfterWrite")
  );
  assert.doesNotMatch(renderHeroSrc, /startHeroTimer\(\)/);
  // 分钟级刷新仍在：app.js 的 60 秒定时器调 renderHero。
  assert.match(appJs, /ui\.renderHero\?\.\(\)/);
});

test("v0.53.0：英雄区样式 —— 深蓝底 + 28px 网格 + 金色等宽倒计时，手机 36px", () => {
  assert.match(css, /\.bp-hero\s*\{[^}]*background-color:\s*var\(--bp-ink\)/);
  assert.match(css, /background-size:\s*28px 28px/);
  assert.match(
    css,
    /\.bp-hero-count\s*\{[^}]*color:\s*var\(--bp-gold\)[^}]*font-family:\s*var\(--bp-mono\)/
  );
  assert.match(css, /\.bp-hero-count\s*\{[^}]*font-size:\s*48px/);
  const mobile = rulesFor(".bp-hero-count", "max-width: 680px");
  assert.ok(mobile.length > 0, "680px 断点里应有倒计时字号");
  assert.equal(declOf(mobile[0], "font-size"), "36px");
  assert.doesNotMatch(css, /\.bp-hero:not\(\.is-empty\)::before/);
  // 桌面网格给英雄区留了行（banner → hero → stats → list）。
  assert.match(css, /"banner"\s*"hero"\s*"stats"\s*"list"/);
});

test("v0.53.0：顶栏收尾 —— 临期提醒与切换为深色已进菜单，顶栏只留新增与汉堡", () => {
  const menu = document.getElementById("headerMenu");
  const topActions = document.querySelector(".header-top-actions");
  assert.ok(menu.querySelector("#upcomingDrawerBtn"), "菜单里应有临期提醒");
  assert.ok(menu.querySelector("#themeBtn"), "菜单里应有切换为深色");
  assert.ok(menu.querySelector("#upcomingBadgeCount"), "临期角标随按钮进菜单");
  assert.equal(
    topActions.querySelector("#upcomingDrawerBtn"),
    null,
    "顶栏不应再有临期提醒"
  );
  assert.equal(topActions.querySelector("#themeBtn"), null, "顶栏不应再有主题按钮");
  assert.ok(topActions.querySelector("#addProjectBtn"), "顶栏保留新增项目");
  assert.ok(topActions.querySelector("#menuToggle"), "顶栏保留汉堡菜单");
});

test("v0.53.0：顶栏字体统一 —— 标语 20px/400，同步状态桌面 20px/400", () => {
  const sub = rulesFor(".brand-text-inline .brand-sub");
  assert.ok(sub.length > 0);
  assert.equal(declOf(sub[sub.length - 1], "font-size"), "20px");
  assert.equal(declOf(sub[sub.length - 1], "font-weight"), "400");
  const sync = rulesFor(".user-menu-inline", "min-width: 1024px");
  assert.ok(sync.length > 0, "1024px 断点里应有同步状态字号");
  assert.equal(declOf(sync[sync.length - 1], "font-size"), "20px");
  const syncStatus = rulesFor(".user-menu-inline .sync-status", "min-width: 1024px");
  assert.ok(syncStatus.length > 0);
  assert.equal(declOf(syncStatus[0], "font-size"), "20px");
  assert.equal(declOf(syncStatus[0], "font-weight"), "400");
});

test("v0.53.0：页眉版本号隐藏，版本改在设置页底部显示", () => {
  // 生效的无条件规则应为 display: none（v0.51.0 的 inline-flex 已改掉；
  // 注意 layout.css 有一条多选择器分组规则只写了 tabular-nums，没有 display，
  // 取最后一条带 display 声明的规则才作数）。
  const base = rulesFor(".app-version-badge");
  const withDisplay = base.filter((r) => declOf(r, "display") !== undefined);
  assert.ok(withDisplay.length > 0);
  assert.equal(declOf(withDisplay[withDisplay.length - 1], "display"), "none");
  // 元素与文字保留在 HTML 里（check:version 的 index.html 载体之一）。
  assert.ok(document.querySelector(".app-version-badge"));
  assert.match(
    document.querySelector(".app-version-badge").textContent,
    /v0\.53\.0/
  );
  assert.match(
    document.querySelector(".settings-version").textContent,
    /投标工作台 · BidDesk v0\.53\.0/
  );
});

test("v0.53.0：临期事项卡片直开临期提醒抽屉", () => {
  assert.match(
    appJs,
    /upcomingStatCard\?\.\s*addEventListener\("click", \(\) => \{\s*setUpcomingExpanded\(true\);\s*elements\.upcomingSheet\?\.\s*classList\.remove\("hidden"\);/
  );
  assert.doesNotMatch(
    appJs,
    /upcomingStatCard\?\.\s*addEventListener\("click", \(\) => \{\s*const panel = document\.querySelector\("\.upcoming-panel"\)/
  );
});

test("v0.53.0：汉堡菜单不透明 —— 94% 毛玻璃在深蓝英雄区上会透出白字重影", () => {
  // 菜单的 background 以最后一条声明为准（layout.css 里 94% 那条在后，曾盖掉前面的实底）。
  const menuRules = rulesFor(".header-actions");
  const withBg = menuRules.filter((r) => declOf(r, "background"));
  assert.ok(withBg.length > 0, "须有一条 .header-actions 设 background");
  const lastBg = declOf(withBg[withBg.length - 1], "background");
  assert.equal(lastBg, "var(--surface-raised)");
  // 实底下 backdrop-filter 无效果，不应再留。
  assert.equal(declOf(withBg[withBg.length - 1], "backdrop-filter"), undefined);
  assert.equal(declOf(withBg[withBg.length - 1], "-webkit-backdrop-filter"), undefined);
});

test("v0.53.0：窄屏页头标题不被压扁 —— 同步状态一长，标题曾被压到 21px 溢出", () => {
  const title680 = rulesFor(".header-title", "max-width: 680px");
  assert.ok(title680.length > 0, "须在 680px 断点里钉住 .header-title");
  assert.equal(declOf(title680[title680.length - 1], "flex"), "none");
  const actions680 = rulesFor(".header-top-actions", "max-width: 680px");
  assert.ok(actions680.length > 0, "须在 680px 断点里钉住 .header-top-actions");
  assert.equal(declOf(actions680[actions680.length - 1], "margin-left"), "auto");
});

test("v0.53.0：版本号 0.53.0（与 check:version 同一事实来源）", () => {
  assert.equal(pkg.version, "0.53.0");
  const utils = readFileSync(new URL("../js/utils.js", import.meta.url), "utf8");
  assert.match(utils, /APP_VERSION = "0\.53\.0"/);
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  assert.match(sw, /bid-assistant-v0\.53\.0/);
  const changelog = readFileSync(
    new URL("../docs/changelog.md", import.meta.url),
    "utf8"
  );
  assert.match(changelog, /## \[0\.53\.0\]/);
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.match(readme, /v0\.53\.0/);
  const notes = readFileSync(
    new URL("../docs/notes.md", import.meta.url),
    "utf8"
  );
  assert.match(notes, /v0\.53\.0/);
  assert.match(html, /v0\.53\.0/);
});
