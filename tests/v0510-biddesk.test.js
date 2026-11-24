import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseHTML } from "linkedom";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");
const { document } = parseHTML(html);

test("v0.51.0：定名为 投标工作台 · BidDesk，版本号紧跟 BidDesk 后方", () => {
  assert.match(document.title, /投标工作台 · BidDesk/);
  const h1Text = document.querySelector(".header-title h1").textContent;
  assert.match(h1Text, /投标工作台\s*BidDesk\s*v0\.51\.0/);
});

test("v0.51.0：详情区彻底移除 renderRiskCard 与 pdfHtml 残留", () => {
  assert.doesNotMatch(ui, /renderRiskCard\(p\)/);
});
