/**
 * v0.54.0：UI 打磨第三期 —— 倒计时英雄区秒级定时器（设计稿 v0.39）。
 * 只加载 index.html 骨架 + js/ui.js（linkedom），不跑 app.js、不碰网络。
 * 守的是：秒级定时器的完整生命周期（创建一次、重复进入不叠加、切后台即停、
 * 回来先重算再恢复、无项目即清、过期切换到下一个项目），以及 v0.39 收尾
 *（390px 英雄区收版、两行截断、倒计时 36px）与版本号 0.54.0 全仓一致。
 *
 * 两个桩缺一不可：
 * 1. tests/hero-timer-fake.mjs —— 真 setInterval 会把 node --test 进程钉住；
 * 2. 下面的 FakeDate —— renderHero 用 new Date() 取“现在”，假时钟才能把
 *    过期、重算 deterministic 地测出来（开标时刻本身只有分钟精度）。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { readCssBundle } from "./css-bundle.mjs";
import { parseCssRules } from "../scripts/check-css.mjs";
import { installHeroTimerFake } from "./hero-timer-fake.mjs";
import { formatHeroCountdown } from "../js/utils.js";

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

/** 1 号桩：假定时器（只记不跑）。 */
const timers = installHeroTimerFake();
const resetTimers = () => {
  timers.created.length = 0;
  timers.cleared.length = 0;
  timers.active.clear();
};

/** 2 号桩：假时钟。new Date() 无参取 fakeNow；带参照常解析。 */
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

const LONG_NAME =
  "某某市政道路改造及配套管网建设工程监理服务采购项目（第二标段）超长名称测试"; // 40 字
const PROJECT_A = {
  id: "hero-a",
  name: LONG_NAME,
  date: "2030-11-28",
  bidTime: "09:30",
  status: "制作中",
};
const PROJECT_B = {
  id: "hero-b",
  name: "某区老旧小区改造工程设计服务",
  date: "2030-12-02",
  bidTime: "14:00",
  status: "报名中",
};
const targetA = RealDate.parse("2030-11-28T09:30:00");
const targetB = RealDate.parse("2030-12-02T14:00:00");

const setHidden = (value) => {
  Object.defineProperty(document, "hidden", {
    value,
    configurable: true,
  });
};

const makeUi = (projects, viewMode = "list") => {
  const elements = buildElements(document);
  const state = { projects, viewMode };
  const ui = createUi(elements, () => state);
  return { ui, elements, state };
};
const heroEls = (elements) => ({
  hero: elements.bpHero,
  name: elements.bpHeroName,
  time: elements.bpHeroTime,
  count: elements.bpHeroCount,
  badge: elements.bpHeroBadge,
});

test("v0.54.0：核实结论 —— 秒级函数确在 main 里休眠过，本期只接线不新写", () => {
  // 四个函数 v0.36.2 已备好（ui.js 里定义齐全），上一期回报“休眠”属实。
  for (const name of [
    "stopHeroTimer",
    "isHeroVisibleContext",
    "tickHero",
    "startHeroTimer",
  ]) {
    assert.match(uiJs, new RegExp(`const ${name} = `), `${name} 应已定义`);
  }
  // 休眠的证据：renderHero 末尾曾写明“这里不启动”，本期改成接线。
  assert.doesNotMatch(uiJs, /这里不启动/);
  const renderHeroSrc = uiJs.slice(
    uiJs.indexOf("const renderHero"),
    uiJs.indexOf("const renderAfterWrite")
  );
  assert.match(renderHeroSrc, /startHeroTimer\(\);/, "renderHero 末尾接线启动");
  // tick 只写倒计时节点一个地方（1 秒间隔不碰列表与临期栏），过期切下一个项目。
  const tickSrc = uiJs.slice(
    uiJs.indexOf("const tickHero"),
    uiJs.indexOf("const startHeroTimer")
  );
  assert.match(tickSrc, /countEl\.textContent = formatHeroCountdown\(diff\)/);
  assert.match(tickSrc, /countEl\.textContent = "已开标"/);
  assert.match(tickSrc, /stopHeroTimer\(\);\s*renderHero\(\);/);
  // startHeroTimer：先清旧的再建 1 秒间隔，不可见上下文不启动。
  const startSrc = uiJs.slice(
    uiJs.indexOf("const startHeroTimer"),
    uiJs.indexOf("const renderHero")
  );
  assert.match(startSrc, /stopHeroTimer\(\);\s*if \(!heroTargetMs \|\| !isHeroVisibleContext\(\)\) return;/);
  assert.match(startSrc, /heroTimerId = setInterval\(tickHero, 1000\)/);
});

test("v0.54.0：renderHero 启动且仅启动一个 1 秒间隔", () => {
  resetTimers();
  setFakeNow(targetA - 3 * 86400000 - 7 * 3600000);
  setHidden(false);
  const { ui, elements } = makeUi([PROJECT_A]);
  ui.renderHero();
  const { hero, count } = heroEls(elements);
  assert.equal(hero.hidden, false);
  assert.equal(timers.created.length, 1, "只建一个 interval");
  assert.equal(timers.created[0].ms, 1000, "间隔是 1 秒");
  assert.equal(timers.activeCount(), 1);
  assert.match(count.textContent, /^\d+天 \d{2}:\d{2}:\d{2}$/);
  assert.equal(
    count.textContent,
    formatHeroCountdown(targetA - fakeNow),
    "首帧即按假时钟填数"
  );
  ui.stopHeroTimer();
  assert.equal(timers.activeCount(), 0, "收尾清掉，避免影响其他文件");
});

test("v0.54.0：重复进入不叠加 —— renderHero 调三次仍只有一个间隔在跑", () => {
  resetTimers();
  setFakeNow(targetA - 86400000);
  setHidden(false);
  const { ui } = makeUi([PROJECT_A]);
  ui.renderHero();
  const firstId = timers.created[0].id;
  ui.renderHero();
  ui.renderHero();
  assert.equal(timers.created.length, 3, "每次先清后建，共建三次");
  assert.equal(timers.activeCount(), 1, "同一时刻只有一个间隔在跑");
  assert.ok(timers.cleared.includes(firstId), "旧 id 被 clearInterval 清掉");
  assert.notEqual(
    [...timers.active.keys()][0],
    firstId,
    "活着的是最新一个"
  );
  ui.stopHeroTimer();
});

test("v0.54.0：tick 只写倒计时节点、每秒减 1，其他节点不动", () => {
  resetTimers();
  setFakeNow(targetA - 2 * 86400000 - 3600000);
  setHidden(false);
  const { ui, elements } = makeUi([PROJECT_A]);
  ui.renderHero();
  const { name, time, count, badge } = heroEls(elements);
  const before = {
    name: name.textContent,
    time: time.textContent,
    badge: badge.textContent,
    count: count.textContent,
  };
  const tick = timers.created[0].fn;
  setFakeNow(fakeNow + 1000);
  tick();
  assert.equal(
    count.textContent,
    formatHeroCountdown(targetA - fakeNow),
    "推进 1 秒，倒计时减 1 秒"
  );
  assert.notEqual(count.textContent, before.count);
  assert.equal(name.textContent, before.name, "项目名不动");
  assert.equal(time.textContent, before.time, "开标时间行不动");
  assert.equal(badge.textContent, before.badge, "徽标不动");
  setFakeNow(fakeNow + 1000);
  tick();
  assert.equal(
    count.textContent,
    formatHeroCountdown(targetA - fakeNow),
    "再推进 1 秒，再减 1 秒"
  );
  ui.stopHeroTimer();
});

test("v0.54.0：切后台即停、回来先重算再恢复，不闪旧数字", () => {
  resetTimers();
  setFakeNow(targetA - 86400000);
  setHidden(false);
  const { ui, elements } = makeUi([PROJECT_A]);
  ui.renderHero();
  assert.equal(timers.activeCount(), 1);
  const staleText = elements.bpHeroCount.textContent;

  // 切后台：renderHero 在隐藏上下文里不建新间隔（startHeroTimer 先清旧的）。
  setHidden(true);
  ui.renderHero();
  assert.equal(timers.activeCount(), 0, "隐藏时没有间隔在跑");
  assert.equal(
    elements.bpHeroCount.textContent,
    staleText,
    "隐藏时不重算也不跳字"
  );

  // 回来：先立即重算（假时钟已走 65 秒），再恢复间隔。
  setFakeNow(fakeNow + 65000);
  setHidden(false);
  ui.renderHero();
  assert.equal(
    elements.bpHeroCount.textContent,
    formatHeroCountdown(targetA - fakeNow),
    "回来第一时间就是重算后的正确值，不是旧数字"
  );
  assert.notEqual(elements.bpHeroCount.textContent, staleText);
  assert.equal(timers.activeCount(), 1, "间隔已恢复");
  ui.stopHeroTimer();
});

test("v0.54.0：切后台走 ui.stopHeroTimer 直接清；日历视图不启动", () => {
  resetTimers();
  setFakeNow(targetA - 86400000);
  setHidden(false);
  const { ui } = makeUi([PROJECT_A]);
  ui.renderHero();
  assert.equal(timers.activeCount(), 1);
  ui.stopHeroTimer();
  assert.equal(timers.activeCount(), 0, "stopHeroTimer 直接清掉");

  // 日历视图：renderHero 仍填数，但不启动（isHeroVisibleContext 拦住）。
  const cal = makeUi([PROJECT_A], "calendar");
  cal.ui.renderHero();
  assert.equal(timers.activeCount(), 0, "日历视图不建间隔");
  assert.equal(cal.elements.bpHero.hidden, false, "填数本身不受影响");

  // app.js 接线（静态断言，行为见上）：切日历停、切回列表重算。
  assert.match(
    appJs,
    /if \(mode === "calendar"\) ui\.stopHeroTimer\?\.\(\);/,
    "切日历视图停定时器"
  );
  // visibilitychange：隐藏停、可见重算（renderHero 内含重算 + 重启）。
  assert.match(
    appJs,
    /visibilitychange[\s\S]*?if \(document\.hidden\) ui\.stopHeroTimer\?\.\(\);[\s\S]*?else ui\.renderHero\?\.\(\);/,
    "visibilitychange 隐藏停、可见重算"
  );
  // 60 秒定时器仍在：重算 + 先清后建，不叠加。
  assert.match(
    appJs,
    /setInterval\(\(\) => \{[^}]*ui\.renderHero\?\.\(\)[^}]*\}, 60000\)/s,
    "60 秒定时器仍调 renderHero"
  );
});

test("v0.54.0：无待开标项目时整区隐藏且定时器清掉", () => {
  resetTimers();
  setFakeNow(targetA - 86400000);
  setHidden(false);
  const { ui, elements, state } = makeUi([PROJECT_A]);
  ui.renderHero();
  assert.equal(timers.activeCount(), 1);
  state.projects = [];
  ui.renderHero();
  assert.equal(elements.bpHero.hidden, true, "无项目整区隐藏");
  assert.equal(timers.activeCount(), 0, "定时器已清，不留隐藏 interval");

  // 只剩已开标项目也一样。
  state.projects = [{ ...PROJECT_A, status: "已开标" }];
  ui.renderHero();
  assert.equal(elements.bpHero.hidden, true);
  assert.equal(timers.activeCount(), 0);
  ui.stopHeroTimer();
});

test("v0.54.0：过期显示「已开标」并切到下一个项目，定时器随新项目重启", () => {
  resetTimers();
  setFakeNow(targetA - 2000); // 离 A 开标 2 秒
  setHidden(false);
  const { ui, elements } = makeUi([PROJECT_A, PROJECT_B]);
  ui.renderHero();
  const { name, count } = heroEls(elements);
  assert.equal(name.textContent, LONG_NAME, "先显示最近的 A");
  assert.equal(count.textContent, "00:00:02");
  const firstId = timers.created[0].id;
  const tick = timers.created[0].fn;

  // 假时钟走到开标时刻之后 1 秒，再 tick：diff <= 0 → 已开标 → 切到 B。
  setFakeNow(targetA + 1000);
  tick();
  assert.equal(name.textContent, PROJECT_B.name, "过期后切到下一个项目 B");
  assert.equal(
    count.textContent,
    formatHeroCountdown(targetB - fakeNow),
    "倒计时随 B 重算"
  );
  assert.ok(timers.cleared.includes(firstId), "A 的旧间隔已清");
  assert.equal(timers.created.length, 2, "为 B 新建一个间隔");
  assert.equal(timers.activeCount(), 1, "同一时刻只有一个间隔在跑");
  ui.stopHeroTimer();
});

test("v0.54.0：v0.39 收尾复查 —— 390px 英雄区收版、两行截断、倒计时 36px 无回退", () => {
  // 倒计时容器仍是 aria-live="off"，秒数变化不播报、不伴随动画。
  assert.equal(
    document.getElementById("bpHeroCount").getAttribute("aria-live"),
    "off"
  );
  const mobile = rulesFor(".bp-hero-count", "max-width: 680px");
  assert.ok(mobile.length > 0, "680px 断点里应有倒计时字号");
  assert.equal(declOf(mobile[0], "font-size"), "36px");
  // 项目名两行截断（40 字长标题复查：DOM 上仍挂 bp-clamp-2）。
  const { ui, elements } = makeUi([PROJECT_A]);
  setFakeNow(targetA - 86400000);
  setHidden(false);
  ui.renderHero();
  assert.equal(elements.bpHeroName.textContent, LONG_NAME, "40 字长标题照常填入");
  assert.ok(
    elements.bpHeroName.classList.contains("bp-clamp-2"),
    "项目名两行截断类仍在"
  );
  const clamp = rules.filter((r) => r.selector === ".bp-clamp-2");
  assert.ok(clamp.length > 0);
  assert.equal(declOf(clamp[0], "-webkit-line-clamp"), "2");
  ui.stopHeroTimer();
});

test("v0.54.0：版本号 0.54.0（与 check:version 同一事实来源）", () => {
  assert.equal(pkg.version, "0.54.0");
  const utils = readFileSync(new URL("../js/utils.js", import.meta.url), "utf8");
  assert.match(utils, /APP_VERSION = "0\.54\.0"/);
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  assert.match(sw, /bid-assistant-v0\.54\.0/);
  const changelog = readFileSync(
    new URL("../docs/changelog.md", import.meta.url),
    "utf8"
  );
  assert.match(changelog, /## \[0\.54\.0\]/);
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.match(readme, /v0\.54\.0/);
  const notes = readFileSync(
    new URL("../docs/notes.md", import.meta.url),
    "utf8"
  );
  assert.match(notes, /v0\.54\.0/);
  assert.match(html, /v0\.54\.0/);
});
