import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  CALENDAR_TOKEN_TTL_DAYS,
  isCalendarTokenExpired,
  formatDateTimeDisplay,
} from "../js/utils.js";

const read = (path) =>
  fs.readFileSync(new URL(path, import.meta.url), "utf8");

test("batch3 日历令牌：有效期为 180 天", () => {
  assert.equal(CALENDAR_TOKEN_TTL_DAYS, 180);
});

test("batch3 isCalendarTokenExpired：过期 / 未过期 / 边界 / 空值", () => {
  const now = new Date("2026-11-25T00:00:00Z");
  assert.equal(
    isCalendarTokenExpired("2026-11-24T23:59:59Z", now),
    true,
    "已过有效期应判过期"
  );
  assert.equal(
    isCalendarTokenExpired("2026-11-25T00:00:01Z", now),
    false,
    "未到有效期不应判过期"
  );
  assert.equal(
    isCalendarTokenExpired("2026-11-25T00:00:00Z", now),
    true,
    "恰好到期的边界应判过期（<= now）"
  );
  assert.equal(isCalendarTokenExpired(null, now), false, "空值按未过期处理");
  assert.equal(
    isCalendarTokenExpired(undefined, now),
    false,
    "空值按未过期处理"
  );
  assert.equal(isCalendarTokenExpired("", now), false, "空值按未过期处理");
  assert.equal(
    isCalendarTokenExpired("not-a-date", now),
    false,
    "非法日期按未过期处理，不提前断掉旧订阅"
  );
});

test("batch3 formatDateTimeDisplay：有效时间格式化，非法/空返回空串", () => {
  assert.match(
    formatDateTimeDisplay("2027-05-06T09:13:00+00:00"),
    /^\d{4}年\d{1,2}月\d{1,2}日 \d{2}:\d{2}$/
  );
  assert.equal(formatDateTimeDisplay(null), "");
  assert.equal(formatDateTimeDisplay(""), "");
  assert.equal(formatDateTimeDisplay("not-a-date"), "");
});

test("batch3 supabase.sql：第 13 节在位，过期 180 天 + 限流 60 次/小时 + 最近读取", () => {
  const sql = read("../supabase.sql");
  assert.match(sql, /-- 13\) 第 3 批日历令牌/);
  assert.match(sql, /interval '180 days'/);
  assert.match(sql, /calendar_token_reads/);
  assert.match(sql, /record_calendar_token_read/);
  assert.match(sql, /v_count >= 60/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /token_hash/);
  assert.match(sql, /last_read_at/);
  // 第 13 节重建 get_calendar_projects 时不能丢了第 11 节的 bid_time 返回列。
  const section13 = sql.slice(sql.indexOf("-- 13) 第 3 批日历令牌"));
  assert.match(section13, /bid_time time,/);
  assert.match(section13, /expires_at is null or t\.expires_at > now\(\)/);
});

test("batch3 api/calendar.js：超限返回 429，函数不存在时降级放行", () => {
  const api = read("../api/calendar.js");
  assert.match(api, /record_calendar_token_read/);
  assert.match(api, /rate_limited/);
  assert.match(api, /status\(429\)/);
  assert.match(api, /Retry-After/);
  assert.match(api, /降级放行/);
});

test("batch3 前端：getCalendarToken 返回对象并读新列，create 写 expires_at", () => {
  const projects = read("../js/projects.js");
  assert.match(projects, /query\("token, token_hash, created_at, expires_at, last_read_at"\)/);
  assert.match(projects, /token: expired \? null : row\.token \|\| \(localTokenMatches \? localToken : null\)/);
  assert.match(projects, /expired: false, expiresAt: null, lastReadAt: null/);
  assert.match(projects, /token: null, token_hash: tokenHash/);
  assert.match(projects, /sha256Hex/);
  assert.match(projects, /CALENDAR_TOKEN_TTL_DAYS/);
});

test("batch3 抽屉：有效期/最近读取信息位与过期提示在位", () => {
  const drawers = read("../js/drawers.js");
  assert.match(drawers, /calendarMeta/);
  assert.match(drawers, /calendarExpiredHint/);
  assert.match(drawers, /有效期至/);
  assert.match(drawers, /从未读取/);
  assert.match(drawers, /最近读取/);
  const html = read("../index.html");
  assert.match(html, /id="calendarMeta"/);
  assert.match(html, /id="calendarExpiredHint"/);
  assert.match(html, /订阅链接已过期/);
  const app = read("../app.js");
  assert.match(app, /calendarMeta: document\.getElementById\("calendarMeta"\)/);
  assert.match(
    app,
    /calendarExpiredHint: document\.getElementById\("calendarExpiredHint"\)/
  );
});
