import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseHTML } from "linkedom";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const { document } = parseHTML(html);

test("v0.36.0：统计区收敛为 4 张核心概览卡", () => {
  const cards = document.querySelectorAll(".stats .stat-card");
  assert.equal(cards.length, 4);
  assert.ok(document.getElementById("totalCount"));
  assert.ok(document.getElementById("inProgressCount"));
  assert.ok(document.getElementById("upcomingCount"));
  assert.ok(document.getElementById("inTransitGuarantee"));
  assert.equal(document.getElementById("registeringCount"), null);
  assert.equal(document.getElementById("makingCount"), null);
  assert.equal(document.getElementById("openedCount"), null);
});

test("v0.36.0：一级菜单精简为 4 项高频入口，低频入口收进设置", () => {
  const menuButtons = document.querySelectorAll("#headerMenu > button");
  assert.equal(menuButtons.length, 5);
  assert.equal(document.getElementById("guaranteeMenuBtn"), null);
  const settings = document.getElementById("settingsSheet");
  assert.ok(settings.querySelector("#downloadTemplateBtn"));
  assert.ok(settings.querySelector("#calendarMenuBtn"));
  assert.ok(settings.querySelector("#signOutBtn"));
  assert.ok(settings.querySelector("#backupTip"));
});

test("v0.36.0：主列表保持零横幅纯净态且去掉冗余回到底部浮钮", () => {
  const listPanel = document.querySelector(".list-panel");
  assert.equal(listPanel.querySelector("#deadlineTip"), null);
  assert.equal(listPanel.querySelector("#refundTip"), null);
  assert.equal(listPanel.querySelector("#backupTip"), null);
  assert.equal(document.getElementById("goToBottomBtn"), null);
  assert.ok(document.getElementById("resultFilter").classList.contains("hidden"));
});

test("v0.36.0：4 主档字阶与按钮固定高度垂直居中，列表工具栏无负边距", () => {
  assert.match(css, /--fs-4xl:\s*22px;/);
  assert.match(css, /--fs-2xl:\s*17px;/);
  assert.match(css, /--fs-base:\s*15px;/);
  assert.match(css, /--fs-sm:\s*13px;/);
  assert.match(css, /\.btn\s*\{[^}]*height:\s*38px;[^}]*display:\s*inline-flex;[^}]*align-items:\s*center;[^}]*justify-content:\s*center;/s);
  assert.doesNotMatch(css, /\.list-tools\s*\{[^}]*margin:\s*0\s+-12px/);
  assert.doesNotMatch(css, /\.list-tools\s*\{[^}]*margin:\s*0\s+-9px/);
});
