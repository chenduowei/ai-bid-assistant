import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseHTML } from "linkedom";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");
const { document } = parseHTML(html);

test("v0.39.0：顶部蓝色开标模块替换为临期提醒，且临期面板位于主画布上方", () => {
  assert.equal(document.getElementById("bpHero"), null);
  const dash = document.getElementById("dashboardView");
  assert.ok(dash.querySelector(":scope > .upcoming-panel"));
});

test("v0.39.0：状态/开标时间/项目类型三项桌面同占一行，废标清单去掉前图标", () => {
  assert.match(ui, /kv\("开标时间",[\s\S]*?"kv-row-time"\)/);
  assert.match(css, /\.kv-row-status,[\s\S]*?\.kv-row-time,[\s\S]*?\.kv-row-type\s*\{\s*grid-column:\s*span\s*2;/);
  assert.doesNotMatch(ui, /<span class="checklist-title">\$\{svgIcon/);
});
