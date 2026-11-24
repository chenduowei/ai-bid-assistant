import test from "node:test";
import assert from "node:assert/strict";
import { readCssBundle } from "./css-bundle.mjs";

const css = readCssBundle();

test("v0.36.3+：尊重减弱动画设置", () => {
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});
