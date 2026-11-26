import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readCssBundle } from "./css-bundle.mjs";
import { parseCssRules } from "../scripts/check-css.mjs";

const css = readCssBundle();
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("v0.52.0：蓝图变量完整（深蓝 / 再深 / 网格线 / 金色 / 暖纸）+ 动效变量档", () => {
  for (const v of [
    "--bp-ink: #0A2540",
    "--bp-ink-deep: #071A30",
    "--bp-grid: rgba(255, 255, 255, 0.08)",
    "--bp-gold: #E8B84B",
    "--bp-paper: #F7F3EA",
    "--dur-xfast: 120ms",
    "--dur-quick: 200ms",
    "--dur-slow: 320ms",
  ]) {
    assert.ok(css.includes(v), `缺少变量 ${v}`);
  }
});

test("v0.52.0：登录页是蓝图指挥舱入口 —— 深蓝画布 + 网格 + 毛玻璃卡片", () => {
  assert.match(css, /\.auth-shell \{[\s\S]*?background-color: var\(--bp-ink-deep\)/);
  assert.match(css, /\.auth-shell \{[\s\S]*?background-size: auto, 28px 28px, 28px 28px/);
  assert.match(css, /\.auth-poster \{[\s\S]*?background-color: var\(--bp-ink\)/);
  assert.match(css, /\.auth-split \.auth-card \{[\s\S]*?backdrop-filter: saturate\(180%\) blur\(20px\)/);
  // 海报不再请求照片（v0.35.0 的 webp 已退役，纯 CSS 蓝图）
  assert.doesNotMatch(css, /login-poster\.webp/);
});

test("v0.52.0：金色同屏不超过两处 —— 海报眉标短横与卖点对勾圈", () => {
  // v0.53.0：金色预算按屏计 —— 登录页两处（海报眉标短横、卖点对勾圈）+
  // 英雄区两处（小标题、倒计时）；徽标、查看按钮与焦点环用白幽灵，不占名额。
  const goldIn = (match) =>
    parseCssRules(css)
      .filter((r) => match(r.selector))
      .flatMap((r) => r.decls)
      .filter((d) => d.normValue.includes("var(--bp-gold)")).length;
  assert.equal(goldIn((s) => s.includes(".auth-")), 2, "登录页金色应为两处");
  assert.equal(goldIn((s) => s.startsWith(".bp-hero")), 2, "英雄区金色应为两处");
});

test("v0.52.0：登录入场错峰 —— 海报 0ms、卡片 90ms、标签组 140ms、表单 180ms", () => {
  assert.match(css, /\.auth-split \{[\s\S]*?animation: auth-in var\(--dur-slow\) var\(--ease-standard\) both/);
  assert.match(css, /\.auth-split \.auth-card \{[\s\S]*?animation: auth-in var\(--dur-slow\) var\(--ease-standard\) 90ms both/);
  assert.match(css, /\.auth-tabs \{[\s\S]*?animation: auth-in var\(--dur-slow\) var\(--ease-standard\) 140ms both/);
  assert.match(css, /\.auth-form \{[\s\S]*?animation: auth-in var\(--dur-slow\) var\(--ease-standard\) 180ms both/);
});

test("v0.52.0：错误提示有内容时才现形为柔底小条，空态只占位", () => {
  assert.match(css, /\.auth-message:not\(:empty\) \{[\s\S]*?background: var\(--tint-red-bg\)/);
  assert.match(css, /\.auth-message\.is-success:not\(:empty\) \{[\s\S]*?background: var\(--tint-green-bg\)/);
});

test("v0.52.0：主按钮深蓝底（深色模式提亮一档保对比度），登录按钮带投影", () => {
  assert.match(css, /\.btn\.primary \{ background: var\(--bp-ink\);/);
  assert.match(css, /body\.dark \.btn\.primary \{ background: #1B4A7A; \}/);
  assert.match(css, /\.auth-form \.btn\.primary \{[\s\S]*?box-shadow: 0 8px 20px rgba\(10, 37, 64, 0\.28\)/);
  // 回归：components.css 末尾「按钮抛光」段曾另有一条 .btn.primary 写死 #2563EB，
  // 后层胜出导致登录按钮实际是亮蓝。所有 .btn.primary 背景必须同口径为深蓝。
  const primaryBlocks = [...css.matchAll(/\.btn\.primary \{[^}]*\}/g)]
    .map((m) => m[0])
    .filter((b) => /background:/.test(b)); // 只查定背景的规则（.auth-form 那条只定尺寸与阴影）
  assert.ok(primaryBlocks.length >= 2, "应有多处定背景的 .btn.primary 规则");
  for (const block of primaryBlocks) {
    assert.doesNotMatch(block, /#2563EB|#1D4ED8/);
    // 浅色用深蓝变量，深色 override 用提亮一档的 #1B4A7A，二者之一。
    assert.match(block, /var\(--bp-ink\)|#1B4A7A/);
  }
  // 按钮 hover 不上浮（v0.51.4 已定），只保留按压回馈。
  assert.doesNotMatch(css, /\.btn\.primary:hover \{[^}]*transform: translateY\(-1px\)/);
});

test("v0.52.0：抽屉标题用深蓝（仅浅色），列表项悬停微升只在 hover 设备上", () => {
  assert.match(css, /body:not\(\.dark\) \.sheet-head h2,\s*body:not\(\.dark\) \.drawer-bar-title \{ color: var\(--bp-ink\); \}/);
  assert.match(css, /@media \(hover: hover\) \{[\s\S]*?\.project-item:hover \{[\s\S]*?transform: translateY\(-1px\)/);
});

test("v0.52.0：浅色工作区底是暖纸，统计行收紧，减动效时全关", () => {
  assert.match(css, /body:not\(\.dark\) \{\s*background-color: var\(--bp-paper\);/);
  assert.match(css, /\.stat-card \{ padding: 12px 16px 13px; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?animation-duration: 0\.01ms !important/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?transition-duration: 0\.01ms !important/);
});

test("v1.0.3：版本号 1.0.0（与 check:version 同一事实来源；本断言永远跟当前版）", () => {
  assert.equal(pkg.version, "1.0.3");
  // v1.0.3：版本号随发版 bump，断言同步到 v1.0.3。
  assert.match(html, /v1\.0\.3/);
});

test("v0.52.0：登录页结构未动 —— 元素 id 与表单行为一律不动", () => {
  for (const id of [
    "authView", "authTitle", "authIntro", "authTabs", "authForm",
    "authEmail", "authPassword", "togglePasswordBtn", "authConfirmField",
    "authConfirmPassword", "authSubmit", "authMessage", "authRetryBtn",
    "authLinks", "forgotPasswordBtn", "resendVerificationBtn",
    "resetPasswordPanel", "newPassword", "confirmPassword",
    "updatePasswordBtn", "backToLoginBtn", "resetPasswordMessage",
  ]) {
    assert.ok(html.includes(`id="${id}"`), `缺少元素 #${id}`);
  }
});

test("v0.55.1：窄屏页眉标语回来 —— 副标题行在 ≤680px 以 12px 小字显示，不再隐藏", () => {
  // v0.55.1 改动：v0.52.0 的「副标题行在 ≤680px 必须真隐藏」已废止，标语以小字
  // 形式回手机顶栏（标题下方、单行省略）。680 块里不再有 display: none 的兜底；
  // 平板 681–1023 那条 display: none 不在 680 块里，不算数。
  const declOf = (rule, prop) =>
    rule.decls.find((d) => d.prop === prop)?.normValue;
  const line680 = parseCssRules(css)
    .filter((r) => r.media.some((m) => m.includes("max-width: 680px")))
    .filter((r) => r.selector === ".brand-text-inline .brand-line");
  assert.ok(line680.length > 0, "680 块里应有 .brand-text-inline .brand-line");
  assert.equal(declOf(line680[line680.length - 1], "display"), "flex");
  assert.equal(declOf(line680[line680.length - 1], "font-size"), "12px");
  assert.ok(
    !line680.some((r) => declOf(r, "display") === "none"),
    "680 块里不应再有隐藏副标题行的规则"
  );
  // 桌面端品牌行仍是 flex 不换行（只改窄屏）。
  assert.match(css, /\.brand-text-inline \.brand-line \{[\s\S]*?display: flex;/);
});

test("v0.52.0：顶栏对齐 —— 桌面按钮统一 40px，窄屏四个按钮统一 44px，顶栏不贴左缘", () => {
  // 桌面：胶囊与汉堡同高 40px（此前胶囊 36px、汉堡 40/44px，同一行高低不齐）。
  assert.match(css, /\.header-top-actions \.btn \{[\s\S]*?height: 40px;/);
  assert.match(css, /\.header-top-actions \.menu-toggle \{[\s\S]*?height: 40px;/);
  // ≤680px：四个按钮一律 44px 触控高度；胶囊内边距收窄，四按钮加间距 ≤ 358px 内容盒。
  assert.match(css, /\.header-top-actions \.btn \{ height: 44px; min-height: 44px; padding: 0 12px; \}/);
  assert.match(css, /\.header-top-actions \.menu-toggle \{ width: 44px; height: 44px; min-width: 44px; min-height: 44px; \}/);
  // 回归：负外边距 + width: 100% !important 曾把窄屏顶栏推到 [0,358]、
  // 比下方内容左移 16px。窄屏顶栏去掉负边距，回到内容盒 [16,374]。
  // v0.55.0 mobile-polish B1/C4：顶垫改成 max(6px, env(safe-area-inset-top))（刘海安全区，
  // 浏览器里 env 为 0 回落到 6px）、底色改实色防透字；margin 仍无负值，顶栏还在内容盒 [16,374]。
  // padding-top 必须带 !important：layout.css 里 v0.40.0/v0.41.0/v0.50.0 三层顶栏规则钉了
  // padding: 12px 0 !important，普通声明会被它盖掉（实测算得 padding-top 仍是 12px）。
  // v0.55.1 修空白带：底垫 12px → 8px（同样 !important，否则被 layout 层盖回 12px），
  // 与收紧的行间距一起把顶栏由 144px 收到约 84px。
  assert.match(css, /\.header \{ padding: 6px var\(--page-x\) 7px; margin: 0 0 10px; padding-top: max\(6px, env\(safe-area-inset-top\)\) !important; padding-bottom: 8px !important; background: var\(--bg\); \}/);
  // 同步状态去顶 padding，纵向居中（原 5px/2px 把文字顶低约 2.5px/1px）。
  assert.doesNotMatch(css, /\.user-menu \{ padding-top: [1-9]/);
  assert.doesNotMatch(css, /\.user-menu \{ padding: [1-9]/);
  // 回归：681–1023px 副标题行曾溢出标题列、被「新增项目」按钮盖住（768px 实测），
  // 平板与手机一样去掉副标题行，只在桌面端出现。
  assert.match(css, /@media \(min-width: 681px\) and \(max-width: 1023px\) \{[\s\S]*?\.brand-text-inline \.brand-line \{ display: none; \}/);
});

test("v0.52.0：BidDesk 放小一档、去粗体（20px/400），与中文标题搭配", () => {
  // 用 [^}]* 把匹配钉在同一条规则块内，[\s\S]*? 会跨规则误命中后面的 700。
  assert.match(css, /\.brand-text-inline \.brand-en \{[^}]*font-size: 20px !important;/);
  assert.match(css, /\.brand-text-inline \.brand-en \{[^}]*font-weight: 400 !important;/);
  assert.doesNotMatch(css, /\.brand-text-inline \.brand-en \{[^}]*font-weight: 700/);
});
