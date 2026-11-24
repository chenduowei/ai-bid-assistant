import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");

test("v0.37.0：展开详情采用等高整齐网格与统一左对齐排版", () => {
  assert.match(css, /grid-auto-rows:\s*minmax\(64px,\s*auto\)/);
  assert.match(css, /\.kv-row-status,[\s\S]*\.kv-row-note\s*\{\s*grid-column:\s*1\s*\/\s*-1;/);
});

test("v0.37.0：极光指令台语义色条、自适应字阶与跨视图直达跳转存在", () => {
  assert.match(css, /\.project-item\[data-status="报名中"\]/);
  assert.match(css, /clamp\(16px,\s*1\.8vw,\s*19\.5px\)/);
  assert.match(ui, /sView\.viewMode\s*===\s*"calendar"/);
});
