import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseHTML } from "linkedom";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");
const { document } = parseHTML(html);

test("v0.51.1：定名为 投标工作台 · BidDesk，版本号紧跟 BidDesk 后方", () => {
  assert.match(document.title, /投标工作台 · BidDesk/);
  assert.equal(document.querySelector(".brand-main-title").textContent.trim(), "投标工作台");
  const lineText = document.querySelector(".brand-line").textContent;
  // v0.55.1：版本号随发版 bump（check:version 的同一事实来源），断言同步到 v0.55.1（页眉徽标已隐藏，徽标文字仍随版 bump）。
  assert.match(lineText, /BidDesk\s*让每一次投标，都心里有数。\s*v0.55.1/);
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

test("v0.51.1：摘要复制具备 execCommand 兜底且必定弹出提示", () => {
  const appCode = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(appCode, /button\.dataset\.action === "copy-summary"/);
  assert.match(appCode, /execCommand\("copy"\)/);
});

test("v0.51.2：app.js 已导入 formatBidMoment 保证摘要复制不报错", () => {
  const appCode = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(appCode, /import\s*\{[^}]*formatBidMoment[^}]*\}\s*from\s*"\.\/js\/utils\.js"/);
});
