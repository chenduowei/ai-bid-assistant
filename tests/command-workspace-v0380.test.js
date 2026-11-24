import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseHTML } from "linkedom";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const { document } = parseHTML(html);

test("v0.38.0：临期提醒与新增编辑项目收进顶栏抽屉，主画布移除右侧栏", () => {
  assert.ok(document.getElementById("upcomingDrawerBtn"));
  assert.ok(document.getElementById("upcomingSheet"));
  assert.ok(document.getElementById("formSheet"));
  assert.equal(document.querySelector(".side-rail"), null);
});

test("v0.38.0：克制配色（无多色边条）与列表标题单行省略对齐", () => {
  assert.doesNotMatch(css, /\.stat-card::before/);
  assert.doesNotMatch(css, /\.bp-hero:not\(\.is-empty\)::before/);
  assert.match(css, /\.project-head \.project-name\s*\{[^}]*white-space:\s*nowrap;[^}]*text-overflow:\s*ellipsis;/);
});
