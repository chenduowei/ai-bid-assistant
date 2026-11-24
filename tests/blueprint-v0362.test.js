import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseHTML } from "linkedom";
import { getNextHeroBid, formatHeroCountdown } from "../js/utils.js";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const { document } = parseHTML(html);

test("v0.36.2：蓝图变量与英雄区 DOM 完整存在", () => {
  assert.match(css, /--bp-ink:\s*#0A2540;/);
  assert.match(css, /--bp-gold:\s*#E8B84B;/);
  assert.match(css, /--bp-paper:\s*#F7F3EA;/);
  const hero = document.getElementById("bpHero");
  assert.ok(hero);
  assert.ok(document.getElementById("bpHeroName").classList.contains("bp-clamp-2"));
  assert.equal(document.getElementById("bpHeroCount").getAttribute("aria-live"), "off");
});

test("v0.36.2：getNextHeroBid 选取最近未开标且尚未过期的项目", () => {
  const now = new Date("2026-11-24T10:00:00");
  const projects = [
    { id: "1", name: "已开标项目", date: "2026-11-25", bidTime: "09:00", status: "已开标" },
    { id: "2", name: "已过期项目", date: "2026-11-24", bidTime: "09:00", status: "制作中" },
    { id: "3", name: "较远项目", date: "2026-11-28", bidTime: "09:30", status: "报名中" },
    { id: "4", name: "最近项目", date: "2026-11-25", bidTime: "09:30", status: "制作中" },
  ];
  const next = getNextHeroBid(projects, now);
  assert.equal(next?.project?.id, "4");
  assert.equal(getNextHeroBid([], now), null);
});

test("v0.36.2：formatHeroCountdown 按天与不足一天正确格式化", () => {
  const threeDaysPlus = ((3 * 86400) + (7 * 3600) + (12 * 60) + 45) * 1000;
  assert.equal(formatHeroCountdown(threeDaysPlus), "3天 07:12:45");
  const underOneDay = ((7 * 3600) + (12 * 60) + 5) * 1000;
  assert.equal(formatHeroCountdown(underOneDay), "07:12:05");
  assert.equal(formatHeroCountdown(0), "已开标");
  assert.equal(formatHeroCountdown(-1000), "已开标");
});
