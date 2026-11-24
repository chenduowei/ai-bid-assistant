import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseHTML } from "linkedom";
import { readCssBundle } from "./css-bundle.mjs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readCssBundle();
const { document } = parseHTML(html);

test("v0.41.0：顶栏仅保留一个临期提醒按钮，设置中无空的外观组，user-menu 并入顶栏一行", () => {
  assert.equal(document.querySelectorAll("#upcomingDrawerBtn").length, 1);
  assert.ok(document.querySelector(".header-top .user-menu-inline"));
  assert.doesNotMatch(html, /<div class="settings-group-title">外观<\/div>/);
});

test("v0.41.0：桌面端 .kv-row-full 位于 .kv-row span 2 之后保证项目名称独占第二行", () => {
  const idxSpan2 = css.indexOf("grid-column: span 2;");
  const idxFull = css.lastIndexOf(".kv-row-full {");
  assert.ok(idxSpan2 !== -1 && idxFull > idxSpan2);
});
