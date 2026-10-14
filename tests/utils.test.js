import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getMissedBidProjects,
  getTrashExpiryCutoff,
  TRASH_RETENTION_DAYS,
} from "../js/utils.js";

test("getMissedBidProjects：只返回最近 7 天内过期且未开标的项目", () => {
  const now = new Date("2026-10-14T12:00:00");
  const projects = [
    { name: "昨天过期", date: "2026-10-13", status: "制作中" },
    { name: "今天", date: "2026-10-14", status: "制作中" },
    { name: "明天", date: "2026-10-15", status: "制作中" },
    { name: "8天前过期", date: "2026-10-06", status: "制作中" },
    { name: "已开标的过期", date: "2026-10-13", status: "已开标" },
    { name: "无日期", date: "", status: "制作中" },
  ];
  const missed = getMissedBidProjects(projects, now);
  assert.deepEqual(
    missed.map((p) => p.name),
    ["昨天过期"]
  );
});

test("getTrashExpiryCutoff：保留期为 30 天", () => {
  assert.equal(TRASH_RETENTION_DAYS, 30);
  const cutoff = getTrashExpiryCutoff(new Date("2026-10-14T12:00:00"));
  assert.equal(cutoff.toISOString().slice(0, 10), "2026-09-14");
});
