/**
 * v0.55.1：临期角标已读清除 + 顶栏去芯片 + README 简洁版。
 * - 角标改通知语义：只亮未看事项数；点开抽屉记已看；新增/改期才重新出现；
 *   已看签名存 localStorage，刷新不重亮。
 * - 顶栏倒计时芯片删除、标语以 12px 小字回手机顶栏（CSS 断言见
 *   tests/mobile-polish-v0550.test.js 末尾那一节）。
 * - README 简洁版：普通用户向，无技术细节。
 * DOM 脚手架沿用 tests/mobile-polish-v0550.test.js 的模式（linkedom 骨架 +
 * 假定时器 + 假时钟）。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { parseHTML } from "linkedom";
import { installHeroTimerFake } from "./hero-timer-fake.mjs";
import {
  UPCOMING_SEEN_KEY,
  upcomingItemSignature,
  readSeenUpcomingSignatures,
  markUpcomingItemsSeen,
  countUnseenUpcoming,
} from "../js/utils.js";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../app.js", import.meta.url), "utf8");

const { window, document } = parseHTML(html);
globalThis.window = window;
globalThis.document = document;
globalThis.CSS = { escape: (s) => String(s).replace(/["\\]/g, "\\$&") };
window.matchMedia = () => ({ matches: true });
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

/** Map 替身（只有 get/set，没有 getItem/setItem，包一层再传进工具函数）。 */
const mapStorage = (map = new Map()) => ({
  getItem: (k) => (map.has(k) ? map.get(k) : null),
  setItem: (k, v) => map.set(k, String(v)),
  removeItem: (k) => map.delete(k),
});

/* ================= 已读签名纯函数 ================= */

test("v0.55.1 已读签名：项目 id + 截止类型 + 日期；改期即新事项，改名不算", () => {
  const item = { project: { id: "p1" }, key: "date", date: "2026-11-27" };
  assert.equal(upcomingItemSignature(item), "p1|date|2026-11-27");
  assert.equal(
    upcomingItemSignature({ ...item, date: "2026-11-28" }),
    "p1|date|2026-11-28"
  );
  // 项目改名不改变签名（事项本身没变）
  assert.equal(
    upcomingItemSignature({
      ...item,
      project: { id: "p1", name: "新名字" },
    }),
    "p1|date|2026-11-27"
  );
  // 不同截止类型是不同事项
  assert.notEqual(
    upcomingItemSignature({ ...item, key: "registrationDeadline" }),
    upcomingItemSignature(item)
  );
});

test("v0.55.1 已读存储：坏数据当空，只存字符串数组", () => {
  const store = mapStorage();
  assert.deepEqual([...readSeenUpcomingSignatures(store)], []);
  store.setItem(UPCOMING_SEEN_KEY, "not json{");
  assert.deepEqual([...readSeenUpcomingSignatures(store)], []);
  store.setItem(UPCOMING_SEEN_KEY, JSON.stringify(["a", 1, null, "b"]));
  assert.deepEqual([...readSeenUpcomingSignatures(store)].sort(), ["a", "b"]);
  assert.deepEqual([...readSeenUpcomingSignatures(null)], []);
  assert.deepEqual([...readSeenUpcomingSignatures(undefined)], []);
});

test("v0.55.1 已读存储：记已看是替换式（只留当前这批，不攒旧签名）", () => {
  const store = mapStorage();
  const a = { project: { id: "p1" }, key: "date", date: "2026-11-27" };
  const b = { project: { id: "p2" }, key: "date", date: "2026-11-28" };
  markUpcomingItemsSeen(store, [a, b]);
  assert.deepEqual(
    [...readSeenUpcomingSignatures(store)].sort(),
    ["p1|date|2026-11-27", "p2|date|2026-11-28"]
  );
  markUpcomingItemsSeen(store, [b]); // 列表变了，只剩 b
  assert.deepEqual([...readSeenUpcomingSignatures(store)], [
    "p2|date|2026-11-28",
  ]);
  markUpcomingItemsSeen(store, []);
  assert.deepEqual([...readSeenUpcomingSignatures(store)], []);
});

test("v0.55.1 未看计数：只数签名不在已看集合中的条数", () => {
  const a = { project: { id: "p1" }, key: "date", date: "2026-11-27" };
  const b = { project: { id: "p2" }, key: "date", date: "2026-11-28" };
  assert.equal(countUnseenUpcoming([a, b], new Set()), 2);
  assert.equal(
    countUnseenUpcoming([a, b], new Set(["p1|date|2026-11-27"])),
    1
  );
  assert.equal(
    countUnseenUpcoming(
      [a, b],
      new Set(["p1|date|2026-11-27", "p2|date|2026-11-28"])
    ),
    0
  );
  assert.equal(countUnseenUpcoming([], new Set(["p1|date|2026-11-27"])), 0);
  assert.equal(countUnseenUpcoming([a], null), 1);
});

/* ================= 角标 DOM 行为 ================= */

test("v0.55.1 改期也算新事项：同项目改期后角标重新出现", () => {
  domStore.delete(UPCOMING_SEEN_KEY);
  setFakeNow(FAKE_T0);
  const first = makeUi([{ ...NEXT_BID }]);
  first.ui.render();
  assert.equal(first.elements.menuToggleBadge.textContent, "1");
  first.ui.markUpcomingSeen();
  assert.equal(
    first.elements.menuToggleBadge.classList.contains("hidden"),
    true
  );
  first.ui.stopHeroTimer();
  // 同项目、开标日 11-27 改到 11-28：签名变了，角标重新出现
  const second = makeUi([{ ...NEXT_BID, date: "2026-11-28" }]);
  second.ui.render();
  assert.equal(second.elements.menuToggleBadge.textContent, "1");
  assert.equal(
    second.elements.menuToggleBadge.classList.contains("hidden"),
    false
  );
  second.ui.stopHeroTimer();
  domStore.delete(UPCOMING_SEEN_KEY);
});

test("v0.55.1 接线：点开临期抽屉的两个入口都调 markUpcomingSeen", () => {
  // 菜单里的「临期提醒」按钮
  const drawerBtnAt = appJs.indexOf(
    'elements.upcomingDrawerBtn?.addEventListener("click"'
  );
  assert.ok(drawerBtnAt >= 0, "应有临期抽屉按钮的点击绑定");
  const drawerBody = appJs.slice(drawerBtnAt, drawerBtnAt + 400);
  assert.match(drawerBody, /ui\.markUpcomingSeen\?\.\(\)/);
  // 统计卡「临期事项」
  const statAt = appJs.indexOf(
    'elements.upcomingStatCard?.addEventListener("click"'
  );
  assert.ok(statAt >= 0, "应有临期统计卡的点击绑定");
  const statBody = appJs.slice(statAt, statAt + 400);
  assert.match(statBody, /ui\.markUpcomingSeen\?\.\(\)/);
  // 底部操作表点“临期提醒”会点一次原菜单按钮，走同一入口，不另复制一份
  assert.match(appJs, /target\?\.click\(\)/);
  // markUpcomingSeen 是 ui 对外暴露的方法
  setFakeNow(FAKE_T0);
  const { ui } = makeUi([{ ...NEXT_BID }]);
  assert.equal(typeof ui.markUpcomingSeen, "function");
  ui.stopHeroTimer();
});

/* ================= README 简洁版 ================= */

test("v0.55.1 README 简洁版：普通用户向，无技术细节，关键信息齐全", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.ok(readme.includes("v1.0.3"), "README 应含当前版本号（check-version 要求）");
  assert.ok(readme.includes("https://chenduowei.vercel.app/"), "在线地址");
  assert.ok(readme.includes("docs/screenshots/auth-desktop.png"), "登录页截图引用");
  assert.ok(readme.includes("docs/screenshots/mobile-list.png"), "主界面手机截图引用");
  assert.ok(readme.includes("docs/screenshots/desktop.png"), "主界面桌面截图引用");
  assert.ok(readme.includes("Supabase"), "数据存在自己的 Supabase");
  for (const banned of [
    "CSP",
    "Content-Security-Policy",
    "check-version",
    "测试矩阵",
    "架构",
    "HSTS",
    "Service Worker",
    "check:version",
  ]) {
    assert.ok(!readme.includes(banned), `简洁版 README 不应出现技术细节：${banned}`);
  }
  assert.ok(
    readme.length < 3000,
    `简洁版篇幅应大幅缩短，实测 ${readme.length} 字符`
  );
  // 引用的截图文件都在位
  for (const f of ["auth-desktop.png", "mobile-list.png", "desktop.png"]) {
    assert.ok(
      existsSync(new URL(`../docs/screenshots/${f}`, import.meta.url)),
      `${f} 应存在`
    );
  }
});
