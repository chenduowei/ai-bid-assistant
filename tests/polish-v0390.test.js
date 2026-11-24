import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const ui = fs.readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");

test("v0.39.0+：废标清单去掉前图标且开标时间带 kv-row-time 类", () => {
  assert.match(ui, /kv\("开标时间",[\s\S]*?"kv-row-time"\)/);
  assert.doesNotMatch(ui, /<span class="checklist-title">\$\{svgIcon/);
});
