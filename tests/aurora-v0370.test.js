import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");

test("v0.37.0+：展开详情采用等高整齐网格与跨视图直达跳转", () => {
  assert.match(css, /grid-auto-rows:\s*minmax\((62|64)px,\s*auto\)/);
  assert.match(ui, /sView\.viewMode\s*===\s*"calendar"/);
});
