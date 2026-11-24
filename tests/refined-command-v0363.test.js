import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseHTML } from "linkedom";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const { document } = parseHTML(html);

test("v0.36.3：精工指挥舱英雄区包含状态点、状态徽章与查看详情提示", () => {
  assert.ok(document.querySelector("#bpHero .bp-hero-dot"));
  assert.ok(document.getElementById("bpHeroBadge"));
  assert.ok(document.getElementById("bpHeroAction"));
});

test("v0.36.3：午夜石板渐变与空态轻量降级样式存在且尊重减弱动画", () => {
  assert.match(css, /linear-gradient\(135deg,\s*#132238\s*0%,\s*#1C3554\s*100%\)/);
  assert.match(css, /\.bp-hero\.is-empty\s*\{/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});
