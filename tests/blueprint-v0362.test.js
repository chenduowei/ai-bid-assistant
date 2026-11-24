import test from "node:test";
import assert from "node:assert/strict";
import { getNextHeroBid, formatHeroCountdown } from "../js/utils.js";

test("v0.36.2+：getNextHeroBid 与 formatHeroCountdown 工具函数可用", () => {
  const now = new Date("2026-11-24T10:00:00");
  const projects = [
    { id: "4", name: "最近项目", date: "2026-11-25", bidTime: "09:30", status: "制作中" },
  ];
  assert.equal(getNextHeroBid(projects, now)?.project?.id, "4");
  assert.equal(formatHeroCountdown(((7 * 3600) + (12 * 60) + 5) * 1000), "07:12:05");
});
