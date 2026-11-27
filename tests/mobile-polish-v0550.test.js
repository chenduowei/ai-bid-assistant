/**
 * v0.55.0 mobile-polish：手机端 CSS 打磨批（审计报告 C 节 + B 节小修）。
 * 只改 CSS（C5 是 JS 模板里改日期文案的最小例外）+ 测试断言；不改 JS 逻辑、
 * 不改 HTML 结构、不改版本号、不动桌面端 1280px 布局。
 * 断言写法沿用 tests/ui-polish-v0520.test.js 的 CSS bundle 模式。
 * v0.55.1：顶栏倒计时芯片删除、临期角标改已读语义、标语回顶栏 ——
 * 本文件里断言芯片的用例随功能删除同步改写（见“JS 批 A”三处与末尾 CSS 测试），
 * 角标新语义的用例见 tests/header-read-v0551.test.js。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { readCssBundle } from "./css-bundle.mjs";
import { parseCssRules } from "../scripts/check-css.mjs";

const css = readCssBundle();
const allRules = parseCssRules(css);
const uiJs = readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const layoutCss = readFileSync(
  new URL("../css/layout.css", import.meta.url),
  "utf8"
);
const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
);

const MOBILE = "max-width: 680px";

/** 某断点下某选择器的全部声明（含同一选择器在该断点内的多条规则）。 */
const declsIn = (mediaSubstr, selector) =>
  allRules
    .filter(
      (r) => r.selector === selector && r.media.some((m) => m.includes(mediaSubstr))
    )
    .flatMap((r) => r.decls);

/** 某断点下某选择器某属性的值（无此声明时为 undefined）。 */
const valueOf = (mediaSubstr, selector, prop) =>
  declsIn(mediaSubstr, selector).find((d) => d.prop === prop)?.normValue;

/* ================= v0.55.0 JS 批：DOM 脚手架 =================
   沿用 tests/ui-phase3-v0540.test.js 的模式：linkedom 骨架 + 假定时器
   （renderHero 会起真 1 秒 interval，不桩会钉住 node --test 进程）
   + 假时钟（renderHero / 日期用 new Date() 取“现在”）。
   下面所有 DOM 测试共用同一份 document（index.html 只解析一次），
   每个测试开头先清假定时器登记，避免上一个 ui 的回调串台。 */
import { parseHTML } from "linkedom";
import { installHeroTimerFake } from "./hero-timer-fake.mjs";
import {
  formatHeaderDate,
  vibrate,
  isKeyboardOpen,
} from "../js/utils.js";
import {
  shouldCloseSheetOnSwipe,
  shouldTriggerPullRefresh,
  SHEET_SWIPE_CLOSE_THRESHOLD_PX,
  PULL_REFRESH_THRESHOLD_PX,
} from "../js/sheet-gestures.js";

const appJs = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const drawersJs = readFileSync(
  new URL("../js/drawers.js", import.meta.url),
  "utf8"
);
const settingsJs = readFileSync(
  new URL("../js/settings.js", import.meta.url),
  "utf8"
);
const gesturesJs = readFileSync(
  new URL("../js/sheet-gestures.js", import.meta.url),
  "utf8"
);

const { window, document } = parseHTML(html);
globalThis.window = window;
globalThis.document = document;
globalThis.CSS = { escape: (s) => String(s).replace(/["\\]/g, "\\$&") };
window.matchMedia = () => ({ matches: true }); // 减少动效 → 统计直接赋值，不跑 rAF
const domStore = new Map();
globalThis.localStorage = {
  getItem: (k) => (domStore.has(k) ? domStore.get(k) : null),
  setItem: (k, v) => domStore.set(k, String(v)),
  removeItem: (k) => domStore.delete(k),
};
Object.defineProperty(document, "hidden", {
  value: false,
  configurable: true,
});
const timers = installHeroTimerFake();
const resetTimers = () => {
  timers.created.length = 0;
  timers.cleared.length = 0;
  timers.active.clear();
};
const RealDate = globalThis.Date;
let fakeNow = RealDate.parse("2026-11-25T11:32:00+08:00");
class FakeDate extends RealDate {
  constructor(...args) {
    super(...(args.length ? args : [fakeNow]));
  }
  static now() {
    return fakeNow;
  }
}
globalThis.Date = FakeDate;
const setFakeNow = (ms) => {
  fakeNow = ms;
};

const { createUi } = await import("../js/ui.js");

const buildElements = (doc) => {
  const elements = {};
  doc.querySelectorAll("[id]").forEach((el) => {
    elements[el.id] = el;
  });
  return elements;
};

const makeUi = (projects, viewMode = "list") => {
  resetTimers();
  const elements = buildElements(document);
  const state = {
    projects,
    viewMode,
    expandedIds: new Set(),
    collapsedSections: new Set(),
    expandedSections: new Set(),
    selectMode: false,
    selectedIds: new Set(),
    listLimit: 50,
    trashLimit: 50,
    calYear: 2026,
    calMonth: 10,
    calSelected: "2026-11-25",
    offlineSnapshot: false,
  };
  const ui = createUi(elements, () => state);
  return { ui, elements, state };
};

const FAKE_T0 = RealDate.parse("2026-11-25T11:32:00+08:00");
const NEXT_BID = {
  id: "hero-a",
  name: "某某市政道路改造及配套管网建设工程监理服务采购项目（第二标段）超长名称测试",
  date: "2026-11-27",
  bidTime: "09:30",
  status: "制作中",
  biddingCompany: "某某市政工程有限公司",
  contact: "张工",
};
/** "2天 05:58:00" 这类倒计时文案 → 总秒数（tick 前后对比用）。 */
const countdownSecs = (text) => {
  const m = /(\d+)天 (\d{2}):(\d{2}):(\d{2})/.exec(text);
  if (m)
    return (
      Number(m[1]) * 86400 +
      Number(m[2]) * 3600 +
      Number(m[3]) * 60 +
      Number(m[4])
    );
  const hms = /(\d{2}):(\d{2}):(\d{2})/.exec(text);
  return hms
    ? Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3])
    : NaN;
};

test("v0.55.0 C1：卡片操作行拆成两行 —— chips 一行、4 个按钮一行四等分", () => {
  // chips 独占一行（flex-basis 100% 把它顶到单独一行）
  assert.equal(
    valueOf(MOBILE, ".project-head-actions .status-quick-inline", "flex"),
    "1 1 100%"
  );
  // chips 行内三枚三等分
  assert.equal(
    valueOf(
      MOBILE,
      ".project-head-actions .status-quick-inline .status-chip",
      "flex"
    ),
    "1 1 0"
  );
  // 按钮行：两字横排（不再折成竖排字）、可缩到等分宽
  assert.equal(
    valueOf(MOBILE, ".project-head-actions .row-btn", "white-space"),
    "nowrap"
  );
  assert.equal(
    valueOf(MOBILE, ".project-head-actions .row-btn", "min-width"),
    "0"
  );
  assert.equal(
    valueOf(MOBILE, ".project-head-actions .row-btn", "min-height"),
    "44px"
  );
  // 两行之间留 6px 行距，按钮之间也是 6px（原来 gap: 0）
  assert.equal(valueOf(MOBILE, ".project-head-actions", "gap"), "6px");
});

test("v0.55.0 C2：列表尾与日历底部留出 FAB 安全垫（52px 浮钮 + 间距）", () => {
  assert.equal(valueOf(MOBILE, ".list-end", "padding-bottom"), "76px");
  assert.equal(valueOf(MOBILE, ".calendar-view", "padding-bottom"), "76px");
});

test("v0.55.0 C3/B8：触控目标提到 44px —— 分段按钮、菜单项、提交/保存按钮", () => {
  // 筛选分段按钮（原来 36px）与列表/日历段控件
  assert.equal(valueOf(MOBILE, ".list-tools .seg-btn", "min-height"), "44px");
  assert.equal(
    valueOf(MOBILE, ".list-tools .view-seg .seg-btn", "min-height"),
    "44px"
  );
  // 汉堡菜单项（原来 38px）
  assert.equal(
    valueOf(MOBILE, ".header-actions .btn.secondary", "min-height"),
    "44px"
  );
  // 表单提交与设置保存按钮（.btn 基底高 38px，见 components.css）
  assert.equal(
    valueOf(
      MOBILE,
      "#formSheet .form-actions .btn-block, .settings-save-row .btn-block",
      "height"
    ),
    "44px"
  );
  assert.equal(
    valueOf(
      MOBILE,
      "#formSheet .form-actions .btn-block, .settings-save-row .btn-block",
      "min-height"
    ),
    "44px"
  );
});

test("v0.55.0 C4：吸顶标题 100% 不透明 —— 抽屉 .sheet-head 与顶栏 .header", () => {
  // 抽屉标题：实色底兜底（原来 96% + 毛玻璃，滚动时正文淡淡透出来）
  assert.equal(valueOf(MOBILE, ".sheet-head", "background"), "var(--surface)");
  // 顶栏同款 96% 问题一并处理 —— 只改窄屏这条，桌面端仍走 layout.css 的毛玻璃
  assert.equal(valueOf(MOBILE, ".header", "background"), "var(--bg)");
});

test("v0.55.0 B1：顶栏留出顶部安全区；status-bar-style 由 JS 按主题动态改", () => {
  // padding-top 单独一条 !important 长属性：layout.css 里 v0.40.0/v0.41.0/v0.50.0
  // 三层顶栏规则钉了 padding: 12px 0 !important，简写会被盖掉（实测算得仍是 12px）。
  assert.match(
    valueOf(MOBILE, ".header", "padding-top"),
    /max\(6px, env\(safe-area-inset-top\)\)/
  );
  // JS 批已落地：HTML 里 meta 初始仍是 default（浅色默认值），applyTheme 在
  // 主题切换时改写 —— 深色 black-translucent（白字），浅色回 default（深字）。
  // 静态改 meta 会让浅色主题下状态栏白字压浅底，所以改动只走 applyTheme 这一处。
  assert.ok(
    html.includes(
      '<meta name="apple-mobile-web-app-status-bar-style" content="default" />'
    ),
    "status-bar-style meta 初始仍为 default"
  );
  const applyThemeSrc = uiJs.slice(
    uiJs.indexOf("const applyTheme"),
    uiJs.indexOf("const renderStats")
  );
  assert.match(
    applyThemeSrc,
    /apple-mobile-web-app-status-bar-style/,
    "applyTheme 应同步改 status-bar-style"
  );
  assert.match(applyThemeSrc, /black-translucent/, "深色时应为 black-translucent");
  assert.match(
    applyThemeSrc,
    /darkMode \? "black-translucent" : "default"/,
    "浅色时应回 default"
  );
});

test("v0.55.0 B3：汉堡菜单入场淡入 + 轻微缩放 0.18s（animation，display 不能过渡）", () => {
  assert.match(css, /@keyframes menu-fade-scale \{ from \{ opacity: 0;/);
  assert.match(
    css,
    /@keyframes menu-fade-scale \{[\s\S]*?scale\(0\.97\)[\s\S]*?scale\(1\)/
  );
  assert.match(
    valueOf(MOBILE, ".header-actions.open", "animation"),
    /menu-fade-scale 0\.18s/
  );
});

test("v0.55.0 B9：触摸细节 —— 全局 manipulation、无 callout、统一去点按高亮", () => {
  const bodyDecls = allRules
    .filter((r) => r.selector === "body" && r.media.length === 0)
    .flatMap((r) => r.decls);
  const bodyValue = (prop) =>
    bodyDecls.find((d) => d.prop === prop)?.normValue;
  assert.equal(bodyValue("touch-action"), "manipulation");
  assert.equal(bodyValue("-webkit-tap-highlight-color"), "transparent");
  assert.equal(
    valueOf(MOBILE, ".project-item, .upcoming-item", "-webkit-touch-callout"),
    "none"
  );
  // 可访问性：:focus-visible 样式不动
  assert.match(css, /:focus-visible/);
});

test("v0.55.0 B11：页面左右加横屏安全边距（竖屏 / 无刘海时回落到原值）", () => {
  assert.equal(
    valueOf(MOBILE, ".page", "padding-left"),
    "max(var(--sp-4), env(safe-area-inset-left))"
  );
  assert.equal(
    valueOf(MOBILE, ".page", "padding-right"),
    "max(var(--sp-4), env(safe-area-inset-right))"
  );
});

test("v0.55.0 C5：临期抽屉元信息行日期去年份（只改这一行，其它日期不动）", () => {
  // 临期模板的元信息行用短日期（"11月27日"，复用卡片副行同款 shortDateDisplay）
  assert.match(uiJs, /class="up-label">[\s\S]*?shortDateDisplay\(date\)/);
  // 临期模板里不再出现带年份的 formatDateDisplay(date)
  assert.doesNotMatch(uiJs, /formatDateDisplay\(date\)/);
  // 其它日期展示不动：搜索 haystack、卡片详情、回收站等仍用带年份的格式
  assert.ok(uiJs.includes("formatDateDisplay(p.date),"));
  assert.ok(uiJs.includes("formatDateDisplay(next.date)"));
});

test("v0.55.0：桌面端回归零变化 —— 顶栏仍走 layout.css 的 96% 毛玻璃，版本号跟当前版", () => {
  const desktopHeader = parseCssRules(layoutCss).find(
    (r) => r.selector === ".header" && r.media.length === 0
  );
  const bg = desktopHeader.decls.find((d) => d.prop === "background");
  assert.match(
    bg.normValue,
    /color-mix\(in srgb, var\(--bg\) 96%, transparent\)/
  );
  assert.equal(pkg.version, "1.0.7");
});

test("v0.55.0 B7：iOS 启动图 —— 8 档竖屏尺寸齐全，link 带 media、文件在位、进 sw 预缓存", () => {
  // 8 档：1290×2796、1179×2556、1284×2778、1170×2532、1125×2436、1242×2688、750×1334、640×1136
  const sizes = [
    "1290x2796",
    "1179x2556",
    "1284x2778",
    "1170x2532",
    "1125x2436",
    "1242x2688",
    "750x1334",
    "640x1136",
  ];
  const links = [
    ...html.matchAll(
      /<link rel="apple-touch-startup-image" media="([^"]+)" href="\.\/icons\/(splash-\d+x\d+\.png)" \/>/g
    ),
  ];
  assert.equal(links.length, 8, "8 档启动图 link 齐全");
  const hrefs = links.map((m) => m[2]);
  assert.deepEqual([...hrefs].sort(), [...sizes.map((s) => `splash-${s}.png`)].sort());
  // 每档 media 都写清设备宽高 + 像素比 + 竖屏，iOS 才能按机型挑图
  for (const m of links) {
    assert.match(m[1], /device-width: \d+px/);
    assert.match(m[1], /device-height: \d+px/);
    assert.match(m[1], /-webkit-device-pixel-ratio: [23]/);
    assert.match(m[1], /orientation: portrait/);
  }
  const swJs = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  for (const size of sizes) {
    assert.ok(
      existsSync(new URL(`../icons/splash-${size}.png`, import.meta.url)),
      `icons/splash-${size}.png 存在`
    );
    assert.ok(swJs.includes(`"./icons/splash-${size}.png"`), `sw 预缓存含 splash-${size}`);
  }
});

/* ================= v0.55.1：芯片已删 ================= */

test("v0.55.1：顶栏倒计时芯片已删 —— HTML 里无元素，JS/CSS 无残留引用", () => {
  assert.equal(document.getElementById("heroChip"), null, "HTML 里不应再有 #heroChip");
  assert.equal(document.getElementById("heroChipCount"), null);
  assert.equal(document.getElementById("heroChipName"), null);
  assert.doesNotMatch(uiJs, /heroChip/, "js/ui.js 不应再引用芯片");
  assert.doesNotMatch(appJs, /heroChip/, "app.js 不应再引用芯片");
  // CSS 断言走解析后的规则（原始 bundle 里注释还会提到 .hero-chip，raw 文本断言会误报）
  assert.ok(
    !allRules.some((r) => r.selector.includes("hero-chip")),
    "CSS bundle 不应再有 .hero-chip 规则"
  );
  assert.doesNotMatch(html, /hero-chip/, "index.html 不应再有 hero-chip");
});

test("v0.55.1：芯片已删，但英雄区倒计时仍走同一秒 tick（只写 #bpHeroCount）", () => {
  setFakeNow(FAKE_T0);
  const { ui, elements } = makeUi([{ ...NEXT_BID }]);
  ui.render();
  const before = countdownSecs(elements.bpHeroCount.textContent);
  setFakeNow(FAKE_T0 + 5000);
  timers.tickAll();
  const after = countdownSecs(elements.bpHeroCount.textContent);
  assert.equal(before - after, 5, "1 秒 tick 后英雄区倒计时减 5 秒");
  assert.equal(timers.activeCount(), 1, "只有一个 1 秒定时器（英雄区那个）");
  assert.deepEqual(timers.activeMs(), [1000]);
  // tick 只写英雄区一个节点（不碰列表与临期栏）
  const tickSrc = uiJs.slice(uiJs.indexOf("const tickHero"), uiJs.indexOf("const startHeroTimer"));
  assert.match(tickSrc, /bpHeroCount/);
  assert.doesNotMatch(tickSrc, /heroChip/);
  ui.stopHeroTimer();
});

test("v0.55.1：无待开标项目时英雄区隐藏（芯片已不存在，无需再断言芯片）", () => {
  setFakeNow(FAKE_T0);
  const { ui, elements } = makeUi([]);
  ui.render();
  assert.equal(elements.bpHero.hidden, true);
  ui.stopHeroTimer();
});

test("v0.55.1：临期角标只亮未看事项数 —— 点开抽屉记已看后消失，列表不变刷新仍不显示", () => {
  // 回归：横幅 #deadlineTip 已在 v0.36.0 移除（本骨架里也没有），角标同步
  // 不能再依赖它存在 —— renderDeadlineTip 的 early return 曾把角标更新一起跳过。
  assert.equal(document.getElementById("deadlineTip"), null);
  domStore.delete("bid-assistant-upcoming-seen");
  setFakeNow(FAKE_T0);
  const { ui, elements } = makeUi([{ ...NEXT_BID }]);
  ui.render();
  // 首次渲染：1 条未看，两个角标同数、显示
  assert.equal(elements.upcomingBadgeCount.textContent, "1");
  assert.equal(elements.menuToggleBadge.textContent, "1");
  assert.equal(elements.menuToggleBadge.classList.contains("hidden"), false);
  assert.equal(elements.upcomingBadgeCount.classList.contains("hidden"), false);
  // 点开抽屉即记为已看（ui.markUpcomingSeen 是 app.js 两个打开入口共用的动作）
  ui.markUpcomingSeen();
  assert.equal(elements.upcomingBadgeCount.textContent, "0");
  assert.equal(elements.menuToggleBadge.textContent, "0");
  assert.equal(elements.menuToggleBadge.classList.contains("hidden"), true);
  assert.equal(elements.upcomingBadgeCount.classList.contains("hidden"), true);
  // 列表不变时重新渲染（= 刷新后重进）：仍不显示
  ui.render();
  assert.equal(elements.menuToggleBadge.classList.contains("hidden"), true);
  ui.stopHeroTimer();

  // 全新 ui 实例 + 同一份 localStorage（模拟刷新页面）：仍不显示
  const second = makeUi([{ ...NEXT_BID }]);
  second.ui.render();
  assert.equal(second.elements.menuToggleBadge.classList.contains("hidden"), true);
  assert.equal(second.elements.menuToggleBadge.textContent, "0");
  second.ui.stopHeroTimer();

  // 新增临期事项后重新出现，只亮新增的 1 条
  const third = makeUi([
    { ...NEXT_BID },
    {
      id: "new-1",
      name: "新增项目",
      date: "2026-11-26",
      status: "报名中",
      biddingCompany: "某公司",
      contact: "李工",
    },
  ]);
  third.ui.render();
  assert.equal(third.elements.menuToggleBadge.textContent, "1");
  assert.equal(third.elements.menuToggleBadge.classList.contains("hidden"), false);
  third.ui.stopHeroTimer();

  // 无临期事项时不显示
  const fourth = makeUi([]);
  fourth.ui.render();
  assert.equal(fourth.elements.menuToggleBadge.classList.contains("hidden"), true);
  fourth.ui.stopHeroTimer();
  domStore.delete("bid-assistant-upcoming-seen");
});

test("v0.55.0 JS 批 A-C：顶栏日期随 render 更新（格式 11月25日 周三）", () => {
  assert.equal(formatHeaderDate(new Date(2026, 10, 25)), "11月25日 周三");
  assert.equal(formatHeaderDate(new Date(2026, 10, 29)), "11月29日 周日");
  assert.equal(formatHeaderDate(new Date("invalid")), "");
  setFakeNow(FAKE_T0);
  const { ui, elements } = makeUi([]);
  ui.render();
  assert.equal(elements.headerDate.textContent, "11月25日 周三");
  ui.stopHeroTimer();
});

test("v0.55.0 JS 批 A-E：窄屏顶栏邮箱收起，邮箱只在设置页“账户”区展示", () => {
  // 顶栏 #userEmail 只在 ≤680px 隐藏（桌面端不动）
  assert.equal(valueOf(MOBILE, "#userEmail", "display"), "none");
  // 设置页“账户”区有一行当前账号（纯展示），登录时与打开设置时都会填
  assert.ok(html.includes('id="settingsAccountEmail"'), "设置页应有当前账号展示位");
  assert.match(appJs, /settingsAccountEmail[\s\S]{0,80}user\.email/);
  assert.match(settingsJs, /settingsAccountEmail[\s\S]{0,120}getState\(\)\.user\?\.email/);
  // 顶栏之外没有别的邮箱展示位（菜单里也没有）
  const emailIds = [...html.matchAll(/id="[^"]*[Ee]mail[^"]*"/g)].map((m) => m[0]);
  assert.deepEqual(
    emailIds.sort(),
    ['id="authEmail"', 'id="settingsAccountEmail"', 'id="userEmail"'].sort(),
    "邮箱展示位只有顶栏（窄屏隐藏）与设置页两处，登录表单的输入框不算"
  );
});

test("v0.55.0 JS 批 B5：底部“菜单”改底部操作表，不再回顶", () => {
  // 操作表结构：6 个菜单项，data-menu-target 指回原菜单按钮（行为走原路）
  assert.ok(html.includes('id="menuActionSheet"'));
  for (const target of [
    "importBtn",
    "exportBtn",
    "trashMenuBtn",
    "upcomingDrawerBtn",
    "themeBtn",
    "aiSettingsBtn",
  ]) {
    assert.ok(
      html.includes(`data-menu-target="${target}"`),
      `操作表应有指向 ${target} 的项`
    );
  }
  // 底部 Tab 的菜单分支：开操作表，且分支内不再有 scrollTo（v0.23.0 绕法已删）
  const menuAt = appJs.indexOf('} else if (tab === "menu")');
  const menuBody = appJs.slice(menuAt, menuAt + 700);
  assert.match(menuBody, /openMenuActionSheet\(\)/);
  // 分支内不再有真正的回顶调用（注释里提一句旧绕法不算调用）
  assert.doesNotMatch(menuBody, /window\.scrollTo\s*\(/, "菜单分支不再回顶");
  assert.match(menuBody, /v0\.23\.0 的绕法已删/);
  // 点项先收表再点原按钮；Esc / 品牌首页也能收表
  assert.match(appJs, /closeMenuActionSheet\(\);\s*\n\s*target\?\.click\(\)/);
  assert.match(appJs, /if \(closeMenuActionSheet\(\)\) return;/);
  // 点底部“项目”Tab 回顶的行为不动
  assert.match(appJs, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
});

test("v0.55.0 JS 批 B6：轻震 —— 包一层工具函数，只在关键操作处调用", () => {
  // iOS 不支持时静默无害：无 vibrate 返回 false，不抛错。
  // Node 的全局 navigator 只有 getter，赋值会抛 TypeError，改用 defineProperty 桩。
  const navDesc = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  try {
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      configurable: true,
    });
    assert.equal(vibrate(10), false);
    Object.defineProperty(globalThis, "navigator", {
      value: { vibrate: () => true },
      configurable: true,
    });
    assert.equal(vibrate(10), true);
    Object.defineProperty(globalThis, "navigator", {
      value: {
        vibrate: () => {
          throw new Error("denied");
        },
      },
      configurable: true,
    });
    assert.equal(vibrate(10), false);
  } finally {
    if (navDesc) Object.defineProperty(globalThis, "navigator", navDesc);
  }
  // 调用点：切底部 Tab、表单提交成功、删除成功（单删/批量/回收站彻底删除）
  assert.match(appJs, /切换底部 Tab 轻震/);
  assert.match(appJs, /表单提交成功轻震/);
  assert.match(appJs, /删除成功轻震/);
  assert.match(drawersJs, /删除成功轻震/);
  // 不是每个按钮都震：vibrate 调用点应只有这几类
  const appVibrateCalls = (appJs.match(/vibrate\(10\)/g) || []).length;
  assert.ok(
    appVibrateCalls >= 4 && appVibrateCalls <= 6,
    `app.js 里 vibrate(10) 应为 Tab/提交/单删/批量删除 4 处上下，实测 ${appVibrateCalls} 处`
  );
});

test("v0.55.0 JS 批 B2：抽屉改 iOS 风格底部 sheet（窄屏全宽贴边 + 手柄 + 下滑关闭）", () => {
  // CSS：遮罩去内边距、面板全宽贴边仅顶部圆角、手柄横条
  assert.equal(valueOf(MOBILE, ".drawer-overlay", "padding"), "0");
  assert.equal(
    valueOf(MOBILE, ".drawer-panel, .drawer-panel-wide", "width"),
    "100%"
  );
  assert.equal(
    valueOf(MOBILE, ".drawer-panel, .drawer-panel-wide", "border-radius"),
    "20px 20px 0 0"
  );
  assert.match(
    valueOf(MOBILE, ".drawer-panel, .drawer-panel-wide", "animation"),
    /sheet-up/
  );
  assert.equal(valueOf(MOBILE, ".sheet-panel", "width"), "100%");
  assert.equal(valueOf(MOBILE, ".sheet-panel", "max-height"), "92dvh");
  // 手柄是吸顶横条（整条 18px 占满宽、底色与面板一致，横条本身 ::after 36×4px 居中），
  // 面板滚到底时手柄仍留在顶部可抓
  assert.equal(valueOf(MOBILE, ".sheet-handle", "display"), "block");
  assert.equal(valueOf(MOBILE, ".sheet-handle", "position"), "sticky");
  assert.equal(valueOf(MOBILE, ".sheet-handle", "top"), "0");
  assert.equal(valueOf(MOBILE, ".sheet-handle", "height"), "18px");
  assert.equal(valueOf(MOBILE, ".sheet-handle::after", "width"), "36px");
  assert.equal(valueOf(MOBILE, ".sheet-handle::after", "height"), "4px");
  // 手柄在位：临期/表单抽屉 + 5 个 sheet 面板（确认框是小对话框，不参与）
  for (const id of [
    "upcomingSheet",
    "formSheet",
    "settingsSheet",
    "trashSheet",
    "guaranteeSheet",
    "qualSheet",
    "calendarSheet",
  ]) {
    const seg = html.slice(html.indexOf(`id="${id}"`));
    assert.match(seg.slice(0, 800), /class="sheet-handle"/, `${id} 应有手柄`);
  }
  assert.doesNotMatch(
    html.slice(html.indexOf('id="confirmDialog"')),
    /class="sheet-handle"/,
    "确认框不加手柄"
  );
  // 手势只绑窄屏 + 触摸设备，关闭走现有 close 函数
  assert.match(gesturesJs, /isNarrowTouchScreen/);
  assert.match(drawersJs, /bindSheetSwipeGesture\(elements\.guaranteeSheet/);
  assert.match(drawersJs, /bindSheetSwipeGesture\(elements\.trashSheet/);
  assert.match(settingsJs, /bindSheetSwipeGesture\(elements\.settingsSheet/);
  assert.match(appJs, /bindSheetSwipeGesture\(elements\.upcomingSheet/);
  assert.match(appJs, /bindSheetSwipeGesture\(elements\.formSheet/);
  // 桌面端默认隐藏手柄（无条件规则在媒体块之前，级联安全）
  // v0.55.1：倒计时芯片已删，该规则不再列 .hero-chip。
  assert.match(
    css,
    /\.header-date, \.menu-toggle-badge, \.sheet-handle \{ display: none; \}/
  );
});

test("v0.55.0 JS 批 B2：下滑关闭阈值判定是纯函数", () => {
  assert.equal(SHEET_SWIPE_CLOSE_THRESHOLD_PX, 80);
  assert.equal(shouldCloseSheetOnSwipe({ dy: 80, durationMs: 300 }), true);
  assert.equal(shouldCloseSheetOnSwipe({ dy: 79, durationMs: 1000 }), false);
  assert.equal(shouldCloseSheetOnSwipe({ dy: 50, durationMs: 60 }), true, "快速甩动也关");
  assert.equal(shouldCloseSheetOnSwipe({ dy: 40, durationMs: 200 }), false, "慢速小位移回弹");
  assert.equal(shouldCloseSheetOnSwipe({ dy: 0, durationMs: 100 }), false);
  assert.equal(shouldCloseSheetOnSwipe({ dy: -10, durationMs: 100 }), false);
});

test("v0.55.0 JS 批 B4：下拉刷新触发条件是纯函数；与 60 秒定时器共用 refreshNow", () => {
  assert.equal(PULL_REFRESH_THRESHOLD_PX, 70);
  assert.equal(
    shouldTriggerPullRefresh({ scrollTop: 0, pullDistance: 70 }),
    true
  );
  assert.equal(
    shouldTriggerPullRefresh({ scrollTop: 0, pullDistance: 69 }),
    false
  );
  assert.equal(
    shouldTriggerPullRefresh({ scrollTop: 10, pullDistance: 100 }),
    false,
    "已滚下去时下拉只是滚动，不刷新"
  );
  assert.equal(
    shouldTriggerPullRefresh({ scrollTop: 0, pullDistance: 0 }),
    false
  );
  // 60 秒定时器与下拉刷新都走 refreshNow；定时器原来不拉数据，默认不动数据
  assert.match(appJs, /const refreshNow = async \(\{\s*reloadData = false\s*\} = \{\}\)/);
  assert.match(appJs, /refreshNow\(\{ reloadData: true \}\)/);
  assert.match(appJs, /setInterval\(\(\) => \{\s*\n\s*if \(!state\.user\) return;\s*\n\s*refreshNow\(\);\s*\n\s*\}, 60000\)/);
  // 刷新态复用骨架屏 + toast 视觉的指示器，不新造一套
  assert.match(appJs, /ui\.showListSkeleton\(\);\s*\n\s*await refreshNow/);
  assert.ok(html.includes('id="ptrIndicator"'));
  assert.ok(html.includes('<div class="toast">↓ 松开刷新</div>'));
  // overscroll：body 不整页回弹，抽屉/面板内部 contain
  assert.equal(valueOf(MOBILE, "body", "overscroll-behavior"), "none");
  assert.equal(
    valueOf(MOBILE, ".drawer-panel, .sheet-panel", "overscroll-behavior"),
    "contain"
  );
});

test("v0.55.0 JS 批 B12：键盘弹出时表单抽屉收缩、提交按钮吸底", () => {
  assert.equal(isKeyboardOpen(844, 500), true, "可视高度明显收缩 = 键盘弹出");
  assert.equal(isKeyboardOpen(844, 844), false);
  assert.equal(isKeyboardOpen(844, 700), false, "144px 收缩不误判（阈值 150）");
  assert.equal(isKeyboardOpen(844, 693), true, "151px 收缩算弹出");
  assert.equal(isKeyboardOpen(844, 694), false, "150px 整不算弹出");
  // 监听 visualViewport.resize，加/摘 body.keyboard-open，写 --keyboard-vv-height
  assert.match(appJs, /visualViewport\.addEventListener\("resize"/);
  assert.match(appJs, /classList\.toggle\("keyboard-open", open\)/);
  assert.match(appJs, /--keyboard-vv-height/);
  // CSS 只影响窄屏表单抽屉
  assert.match(
    valueOf(MOBILE, "body.keyboard-open #formSheet .drawer-panel", "height"),
    /var\(--keyboard-vv-height/
  );
  assert.equal(
    valueOf(MOBILE, "body.keyboard-open #formSheet .form-actions", "position"),
    "sticky"
  );
  assert.equal(
    valueOf(MOBILE, "body.keyboard-open #formSheet .form-actions", "bottom"),
    "0"
  );
});

test("v0.55.1：窄屏顶栏去芯片、标语回位 —— 标语 12px 小字在标题下方单行省略", () => {
  // 芯片已删：窄屏不再有 .hero-chip 规则
  assert.equal(valueOf(MOBILE, ".hero-chip", "display"), undefined);
  // 标语回位：标题与标语纵向排布，标语 12px、单行省略
  assert.equal(valueOf(MOBILE, ".brand-text-inline", "flex-direction"), "column");
  assert.equal(valueOf(MOBILE, ".brand-text-inline .brand-line", "display"), "flex");
  assert.equal(valueOf(MOBILE, ".brand-text-inline .brand-line", "font-size"), "12px");
  assert.equal(valueOf(MOBILE, ".brand-text-inline .brand-line", "white-space"), "nowrap");
  assert.equal(valueOf(MOBILE, ".brand-text-inline .brand-line", "text-overflow"), "ellipsis");
  // 标语里 BidDesk 与中文同字号（组合选择器整串查，parseCssRules 不拆逗号）
  assert.equal(
    valueOf(
      MOBILE,
      ".brand-text-inline .brand-en, .brand-text-inline .brand-sub",
      "font-size"
    ),
    "12px"
  );
  // 版本号徽标不跟回顶栏（版本只在设置页底部）
  assert.equal(valueOf(MOBILE, ".app-version-badge", "display"), "none");
  // 标题列 basis 0 + min-width: 0 —— flex 换行先按 basis 分行、行内再收缩，
  // basis auto 取标语宽时标题 + 动作共 363px 超出 358px 内容盒，动作组会被换到
  // 第二行、顶栏变三行中间空一带；basis 0 让标题先以 0 宽分行再 grow 吃剩余宽，
  // 标语在剩余宽度内省略，动作组留在第一行与标题对齐。行间距收紧：顶栏两行 gap 8px、
  // 标题内 gap 8px、动作组 gap 6px、顶栏底垫 8px，顶栏由 144px 收至约 84px。
  assert.equal(valueOf(MOBILE, ".header-title", "flex"), "1 1 0");
  assert.equal(valueOf(MOBILE, ".header-title", "min-width"), "0");
  assert.equal(valueOf(MOBILE, ".header-top", "gap"), "8px");
  assert.equal(valueOf(MOBILE, ".header-title", "gap"), "8px");
  assert.equal(valueOf(MOBILE, ".header-top-actions", "gap"), "6px");
  assert.equal(valueOf(MOBILE, ".header", "padding-bottom"), "8px");
  // 日期在 680 块里显式 display（无条件规则把它 display:none，漏了这条就一直隐藏）
  assert.equal(valueOf(MOBILE, ".header-date", "display"), "inline");
  // 两行顶栏：第一行品牌 + 动作，第二行同步 + 日期占满宽
  assert.equal(valueOf(MOBILE, ".header-top-actions", "order"), "1");
  assert.match(valueOf(MOBILE, ".user-menu", "flex"), /1 1 100%/);
  // 角标：贴在汉堡右上角
  assert.equal(valueOf(MOBILE, ".menu-toggle-badge", "position"), "absolute");
  assert.equal(valueOf(MOBILE, ".menu-toggle-badge", "top"), "-4px");
  // 操作表项 44px 触控高
  assert.equal(valueOf(MOBILE, ".menu-action-item", "min-height"), "44px");
  assert.equal(valueOf(MOBILE, ".menu-action-cancel", "min-height"), "44px");
  // 下拉指示器顶部居中
  assert.equal(valueOf(MOBILE, ".ptr-indicator", "position"), "fixed");
});

test("v0.55.1：窄屏列表卡片行 1 三项共用中心线 —— 标题/圆点/箭头纵向对齐", () => {
  // 诊断（390px 实测）：行 1 高 44px 由 44px 箭头按钮定死；标题顶对齐时，
  // 一行标题下方留 25px 空洞、两行只剩约 4px，副行看着参差；箭头字形居中在
  // 44px 按钮里，比标题首行中心低 11.5px、看着下沉；圆点 margin-top 8px 又比
  // 箭头高 9px。改：行 1 三项全部 align-self: center，标题块、圆点、箭头字形
  // 共用行中心线（一行标题与副行间距 25 → 13.5px；卡高 173.8px 与 chips/按钮行
  // 不动，它们实测本来就是对齐的；副行相对卡顶 56px 全卡一致，未动）。
  assert.equal(valueOf(MOBILE, ".project-head .project-name", "align-self"), "center");
  assert.equal(valueOf(MOBILE, ".project-head .status-dot", "align-self"), "center");
  assert.equal(valueOf(MOBILE, ".project-head .status-dot", "margin-top"), "0");
  assert.equal(valueOf(MOBILE, ".project-chevron-btn", "align-self"), "center");
  // 选择模式：行首复选框同样居中（圆点此时隐藏，复选框替它占第一列）
  assert.equal(
    valueOf(MOBILE, ".project-list.selecting .project-head .select-check", "align-self"),
    "center"
  );
  // 底线：标题仍两行夹断、副行仍在行 2，不为整齐砍信息
  assert.equal(valueOf(MOBILE, ".project-head .project-name", "line-clamp"), "2");
  assert.equal(valueOf(MOBILE, ".project-head .project-sub", "grid-row"), "2");
});
