import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseHTML } from "linkedom";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");
const { document } = parseHTML(html);

test("v0.40.0：临期提醒收进顶栏右侧抽屉，外观按钮移出设置到顶栏", () => {
  // v0.53.0：用户要求两按钮从顶栏移入汉堡菜单（行为不变）—— 顶栏只留新增与汉堡，
  // 临期提醒与切换为深色改在菜单里；抽屉本身不动。
  assert.ok(document.getElementById("upcomingSheet"));
  const menu = document.getElementById("headerMenu");
  assert.ok(menu.querySelector("#upcomingDrawerBtn"));
  assert.ok(menu.querySelector("#themeBtn"));
  const topActions = document.querySelector(".header-top-actions");
  assert.equal(topActions.querySelector("#upcomingDrawerBtn"), null);
  assert.equal(topActions.querySelector("#themeBtn"), null);
});

test("v0.40.0：syncDetailOpenState 同步更新 collapseAllBtn 可用状态", () => {
  assert.match(ui, /elements\.collapseAllBtn\.disabled\s*=\s*!hasOpen/);
});
