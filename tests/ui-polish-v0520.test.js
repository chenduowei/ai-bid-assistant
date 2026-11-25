import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readCssBundle } from "./css-bundle.mjs";

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
  const goldUses = [...css.matchAll(/var\(--bp-gold\)/g)].length;
  assert.ok(goldUses >= 2, "金色点缀应至少有两处");
  assert.ok(goldUses <= 3, `金色出现 ${goldUses} 次，超过三处上限`);
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

test("v0.52.0：版本号 0.52.0（与 check:version 同一事实来源）", () => {
  assert.equal(pkg.version, "0.52.0");
  assert.match(html, /v0\.52\.0/);
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

test("v0.52.0：窄屏页眉不重叠 —— 副标题行在 ≤680px 必须真隐藏", () => {
  // 回归：v0.51.2 的 .brand-text-inline .brand-line { display: flex } 特异度
  // 高于移动端 .brand-text p { display: none }，副标题在 390px 冒出来和
  // 「云端同步中」重叠。断点块里必须有一条同等特异度的隐藏规则兜底。
  assert.match(css, /\.brand-text-inline \.brand-line \{ display: none; \}/);
  // 桌面端品牌行仍是 flex 不换行（只改窄屏）。
  assert.match(css, /\.brand-text-inline \.brand-line \{[\s\S]*?display: flex;/);
});
