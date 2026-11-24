import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseHTML } from "linkedom";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");
const { document } = parseHTML(html);

test("v0.40.0：临期提醒收进顶栏右侧抽屉，外观按钮移出设置到顶栏", () => {
  assert.ok(document.getElementById("upcomingSheet"));
  const topActions = document.querySelector(".header-top-actions");
  assert.ok(topActions.querySelector("#upcomingDrawerBtn"));
  assert.ok(topActions.querySelector("#themeBtn"));
});

test("v0.40.0：syncDetailOpenState 同步更新 collapseAllBtn 可用状态", () => {
  assert.match(ui, /elements\.collapseAllBtn\.disabled\s*=\s*!hasOpen/);
});
