import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("v0.36.3+：尊重减弱动画设置", () => {
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});
