import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseHTML } from "linkedom";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");
const { document } = parseHTML(html);

test("v0.51.1：定名为 投标工作台 · BidDesk，版本号紧跟 BidDesk 后方", () => {
  assert.match(document.title, /投标工作台 · BidDesk/);
  const h1Text = document.querySelector(".header-title h1").textContent;
  assert.match(h1Text, /投标工作台\s*BidDesk\s*v0\.51\.1/);
});

test("v0.51.1：彻底清除页面底部 AI 残留与列表右侧倒计时胶囊", () => {
  assert.equal(document.getElementById("dropZone"), null);
  assert.equal(document.getElementById("aiAnalyzeBtn"), null);
  assert.equal(document.getElementById("aiResultPanel"), null);
  assert.equal(document.querySelector('[data-tab="parser"]'), null);
  assert.doesNotMatch(ui, /renderRiskCard\(p\)/);
  assert.doesNotMatch(ui, /<div class="project-head-top"><span class="countdown cd-pill/);
});

test("v0.51.1：登录海报、菜单与设置页已全面清除 AI / 废标清单 / API Key 残留", () => {
  assert.doesNotMatch(html, /API Key/);
  assert.doesNotMatch(html, /废标检查清单/);
  assert.equal(document.getElementById("qualMenuBtn"), null);
  assert.equal(document.getElementById("backupIncludePdfText"), null);
});
