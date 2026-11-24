/**
 * v0.35.9：Apple HIG 审美精修的行为测试。
 * 守的是「这一轮定下来的视觉语言」——色板 token、材质（hairline / 毛玻璃）、
 * 原生控件（分段控件 / 搜索框）、排版字族，以及页头吸顶后各断点的让位关系。
 * 纯静态断言：读 index.html / styles.css，不跑浏览器。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { readCssBundle } from "./css-bundle.mjs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readCssBundle();
const { document } = parseHTML(html);

/** 取某个选择器的全部规则声明体（同一选择器在本文件里可能出现多次，后出现的才生效）。 */
const blocksOf = (selector) => {
  const out = [];
  let from = 0;
  for (;;) {
    const idx = css.indexOf(`${selector} {`, from);
    if (idx < 0) break;
    const end = css.indexOf("}", idx);
    out.push(css.slice(idx + selector.length + 2, end));
    from = end + 1;
  }
  return out;
};
/** 同一选择器的多条规则里，有一条同时满足这些条件即算通过。 */
const hasBlock = (selector, re) => blocksOf(selector).some((b) => re.test(b));

test("index.html：页头移出 #dashboardView，成为 .page 的吸顶应用栏", () => {
  const app = document.getElementById("appView");
  const dashboard = document.getElementById("dashboardView");
  const header = document.querySelector(".header");
  assert.ok(app && dashboard && header);
  // 页头是 .page 的直接子元素，且排在 #dashboardView 之前
  assert.equal(header.parentElement.id, "appView");
  const kids = [...app.children];
  assert.ok(kids.indexOf(header) < kids.indexOf(dashboard), "页头应在 #dashboardView 之前");
  // 不再留在网格里（网格项里的 sticky 没有滚动余地）
  assert.equal(dashboard.contains(header), false);
  // 右栏与列表仍在 dashboardView 内，顺序不变
  assert.ok(dashboard.querySelector(".list-panel"), "主列表在 #dashboardView 中");
});

test("色板：单一系统蓝 + 分组底色 + hairline 细描边", () => {
  assert.match(css, /--bg: #F5F5F7;/);
  assert.match(css, /--hairline: rgba\(0, 0, 0, 0\.06\);/);
  assert.match(css, /--accent: #007AFF;/);
  assert.match(css, /body\.dark \{[\s\S]*?--accent: #0A84FF;/);
  // 深色原生层次：#000000 画布 / #1C1C1E 卡面 / #2C2C2E 抬升面
  const dark = css.slice(css.indexOf("body.dark {"), css.indexOf("body.dark {") + 1400);
  assert.match(dark, /--bg: #000000;/);
  assert.match(dark, /--surface: #1C1C1E;/);
  assert.match(dark, /--surface-raised: #2C2C2E;/);
  // 旧品牌渐变里的第二支紫色（#5856D6）已清掉
  assert.equal(css.includes("#5856D6"), false, "不应再出现第二支强调色 #5856D6");
  // 卡片 / 列表 / 统计用 hairline，而不是更重的 --border
  const cardBlock = css.slice(css.indexOf(".card,\n.project-list,\n.stats {"));
  assert.match(cardBlock.slice(0, 200), /border: 1px solid var\(--hairline\);/);
});

test("材质：页头 / 底栏 / 抽屉标题栏 / 提示胶囊都是提饱和毛玻璃", () => {
  assert.ok(hasBlock(".header", /position: sticky;[\s\S]*?top: 0;[\s\S]*?backdrop-filter: saturate\(180%\) blur\(20px\);/), "页头应是毛玻璃吸顶栏");
  assert.ok(hasBlock(".header", /border-bottom: 1px solid var\(--hairline\);/), "页头应有 hairline 底边");
  // 手机底栏
  const mobile = css.slice(css.indexOf("@media (max-width: 680px)"));
  assert.match(mobile, /\.bottom-tabs \{[\s\S]*?backdrop-filter: blur\(20px\) saturate\(180%\);/);
  // 桌面抽屉标题栏
  const desktop = css.slice(css.indexOf("@media (min-width: 1024px)"));
  assert.match(desktop, /\.sheet-head \{[\s\S]*?backdrop-filter: saturate\(180%\) blur\(20px\);/);
  // 提示胶囊 / 浮钮
  assert.ok(hasBlock(".toast", /backdrop-filter: saturate\(180%\) blur\(20px\);/), "提示胶囊应是毛玻璃");
  assert.ok(hasBlock(".float-btn", /backdrop-filter: saturate\(180%\) blur\(20px\);/), "浮钮应是毛玻璃");
});

test("分段控件：浅灰轨道 + 白滑块 + 微阴影（视图切换 / 状态三选一 / 登录注册同一套）", () => {
  assert.match(css, /\.seg-control,\n\.status-quick,\n\.auth-tabs \{[\s\S]*?background: var\(--seg-track\);/);
  assert.match(css, /\.seg-btn\.active,\n\.status-chip\.active \{\n  background: var\(--seg-knob\);/);
  assert.match(css, /box-shadow: var\(--seg-shadow\);/);
  assert.match(css, /--seg-track: rgba\(118, 118, 128, 0\.12\);/);
  assert.match(css, /body\.dark \{[\s\S]*?--seg-knob: #636366;/);
});

test("控件：搜索框是 iOS 填充灰，输入框 10px 圆角 + 聚焦柔光环", () => {
  assert.ok(hasBlock(".search-box input", /background: var\(--field-fill\);[\s\S]*?border-radius: 10px;/), "搜索框应是 iOS 填充灰");
  assert.match(css, /\.search-box input:focus \{[\s\S]*?box-shadow: 0 0 0 3px var\(--accent-soft\);/);
  assert.match(css, /\.field input,\n\.field select,\n\.field textarea \{[\s\S]*?border-radius: 10px;/);
});

test("排版：SF Pro → 苹方字族、标题字重降一档、数字等宽", () => {
  assert.match(css, /font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "PingFang SC"/);
  assert.match(css, /\.panel-title h2,\n\.sheet-head h2,\n\.confirm-panel h2,\n\.auth-title,\n\.parser-header h1 \{ font-weight: 600;/);
  assert.match(css, /\.stat-card \.value,[\s\S]*?font-variant-numeric: tabular-nums;/);
});

test("页头吸顶后的让位：工具栏 / 定位滚动都让开 --appbar-h，三个断点同值", () => {
  assert.ok(hasBlock(".list-tools", /top: var\(--appbar-h\);/), "吸顶工具栏应让开应用栏");
  assert.match(css, /--appbar-h: 80px;/);
  // 根、桌面、手机、平板四处都按 80px（实测页头 80.19px）
  assert.ok((css.match(/--appbar-h: 80px/g) || []).length >= 3, "--appbar-h 应在各断点都是 80px");
  assert.match(css, /scroll-margin-top: calc\(var\(--appbar-h\) \+ 52px\);/);
  assert.match(css, /scroll-margin-top: calc\(var\(--appbar-h\) \+ 12px\);/);
});

test("不再有硬色条与整块高饱和：统计卡选中只留柔色底，风险 / 清单 / 临期卡回到中性底", () => {
  assert.equal(css.includes("inset 0 2px 0 var(--accent)"), false, "统计卡不应再用顶部色条");
  assert.match(css, /\.risk-report \{[^}]*background: var\(--surface-soft\);/);
  assert.match(css, /\.checklist \{[^}]*background: var\(--surface-soft\);/);
  assert.match(css, /\.upcoming-item\.urgent,\n\.upcoming-item\.red,\n\.upcoming-item\.orange \{ border-color: transparent; background: var\(--surface-soft\); \}/);
});
