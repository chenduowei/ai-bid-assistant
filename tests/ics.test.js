import test from "node:test";
import assert from "node:assert/strict";
import {
  escapeIcsText,
  parseIcsDate,
  addDaysIcs,
  icsDateValue,
  icsDateTimeUtc,
  foldIcsLine,
  buildCalendarIcs,
  isValidCalendarToken,
  icsLocalDateTime,
  icsBidTime,
} from "../js/ics.js";
import handler from "../api/calendar.js";

test("escapeIcsText：转义 \\ ; , 与换行", () => {
  assert.equal(escapeIcsText("a,b;c\\d\ne"), "a\\,b\\;c\\\\d\\ne");
  assert.equal(escapeIcsText(""), "");
  assert.equal(escapeIcsText(null), "");
});

test("日期换算：跨月、跨年、闰月边界", () => {
  assert.equal(addDaysIcs("2026-11-01", -1), "2026-10-31");
  assert.equal(addDaysIcs("2026-02-28", 1), "2026-03-01");
  assert.equal(addDaysIcs("2026-12-31", 1), "2027-01-01");
  assert.equal(icsDateValue("2026-11-08"), "20261108");
  assert.equal(parseIcsDate("not-a-date"), null);
  assert.equal(addDaysIcs("not-a-date", 1), "");
});

test("icsDateTimeUtc：北京时间 9 点 = UTC 1 点，8 点 = UTC 0 点", () => {
  assert.equal(icsDateTimeUtc("2026-11-08", 1), "20261108T010000Z");
  assert.equal(icsDateTimeUtc("2026-11-08", 0), "20261108T000000Z");
});

test("foldIcsLine：短行不动；长中文行按 75 字节折行且不切开字符", () => {
  assert.equal(foldIcsLine("SUMMARY:abc"), "SUMMARY:abc");
  const long = "DESCRIPTION:" + "项目备注内容".repeat(12); // 72 个汉字 = 216 字节
  const folded = foldIcsLine(long);
  assert.ok(folded.includes("\r\n "));
  const unfolded = folded.replace(/\r\n /g, "");
  assert.equal(unfolded, long);
  for (const physical of folded.split("\r\n")) {
    assert.ok(
      new TextEncoder().encode(physical).length <= 75,
      `行超长：${physical.length} 字符`
    );
  }
});

test("buildCalendarIcs：单项目全天事件 + 两次提醒", () => {
  const ics = buildCalendarIcs(
    [
      {
        id: "11111111-1111-1111-1111-111111111111",
        name: "测试大桥",
        bid_date: "2026-11-08",
        project_type: "施工",
        bidding_company: "甲公司",
        tenderer: "",
        contact: "张三 13800000000",
        notes: "带齐原件",
      },
    ],
    new Date("2026-11-06T10:00:00Z")
  );
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.ok(ics.includes("DTSTART;VALUE=DATE:20261108"));
  assert.ok(ics.includes("DTEND;VALUE=DATE:20261109"));
  assert.ok(ics.includes("SUMMARY:开标：测试大桥"));
  assert.ok(ics.includes("UID:11111111-1111-1111-1111-111111111111@bid-assistant"));
  assert.ok(ics.includes("DTSTAMP:20261106T100000Z"));
  // 描述行超 75 字节会被折行：先展开（去掉 "\r\n "）再断言内容
  const unfolded = ics.replace(/\r\n /g, "");
  assert.ok(ics.includes("\r\n "), "长描述行应已折行");
  // 描述只写非空字段：招标单位为空，不应出现
  assert.ok(unfolded.includes("项目类型：施工"));
  assert.ok(unfolded.includes("投标公司：甲公司"));
  assert.ok(unfolded.includes("联系人：张三 13800000000"));
  assert.ok(unfolded.includes("备注：带齐原件"));
  assert.ok(!unfolded.includes("招标单位："));
  // 两次提醒：前一天 9 点（UTC 01:00）与当天 8 点（UTC 00:00）
  assert.ok(ics.includes("TRIGGER;VALUE=DATE-TIME:20261107T010000Z"));
  assert.ok(ics.includes("TRIGGER;VALUE=DATE-TIME:20261108T000000Z"));
  assert.ok(ics.includes("明天开标：测试大桥"));
  assert.ok(ics.includes("今天开标：测试大桥"));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.equal((ics.match(/BEGIN:VALARM/g) || []).length, 2);
});

test("buildCalendarIcs：空列表与无效行", () => {
  const empty = buildCalendarIcs([], new Date("2026-11-06T10:00:00Z"));
  assert.ok(empty.includes("BEGIN:VCALENDAR"));
  assert.ok(empty.includes("END:VCALENDAR"));
  assert.ok(!empty.includes("BEGIN:VEVENT"));
  const mixed = buildCalendarIcs([
    { id: "x", name: "", bid_date: "2026-11-08" },
    { id: "y", name: "无日期", bid_date: "" },
    { id: "z", name: "正常", bid_date: "2026-11-09" },
  ]);
  assert.equal((mixed.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.ok(mixed.includes("SUMMARY:开标：正常"));
});

test("isValidCalendarToken：合法 UUID / 兑底形态通过，空与怪串拒绝", () => {
  assert.equal(isValidCalendarToken("1f0f9a52-8f3c-4a1c-9a8e-2a6c0b7d5e11"), true);
  assert.equal(isValidCalendarToken("cal-1763200000000-ab12cd34"), true);
  assert.equal(isValidCalendarToken("  cal-1763200000000-ab12cd34  "), true);
  assert.equal(isValidCalendarToken(""), false);
  assert.equal(isValidCalendarToken("short"), false);
  assert.equal(isValidCalendarToken("tok en-in-here"), false);
  assert.equal(isValidCalendarToken("x".repeat(129)), false);
  assert.equal(isValidCalendarToken(null), false);
  assert.equal(isValidCalendarToken(["a"]), false);
});

// v0.34.0：api/calendar.js 先验令牌格式，明显不合法的不打 Supabase。
function fakeRes() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
}

test("api/calendar：缺令牌 400，格式不对 400", async () => {
  const missing = fakeRes();
  await handler({ query: {} }, missing);
  assert.equal(missing.statusCode, 400);
  assert.equal(missing.body, "missing token");

  const bad = fakeRes();
  await handler({ query: { token: "not a token!!" } }, bad);
  assert.equal(bad.statusCode, 400);
  assert.equal(bad.body, "invalid token");

  // 数组型 query（?token=a&token=b）也当不合法，不能拼进 RPC
  const arr = fakeRes();
  await handler({ query: { token: ["abc", "def"] } }, arr);
  assert.equal(arr.statusCode, 400);
});

test("v0.35.0：填了开标时刻就用带时间的 DTSTART/DTEND，摘要里也带时刻", () => {
  const ics = buildCalendarIcs([
    {
      id: "p1",
      name: "有时刻的标",
      bid_date: "2026-11-20",
      bid_time: "09:30:00",
      project_type: "房建",
    },
    { id: "p2", name: "没时刻的标", bid_date: "2026-11-21" },
  ]);
  assert.match(ics, /DTSTART:20261120T093000/);
  assert.match(ics, /DTEND:20261120T103000/);
  assert.match(ics, /SUMMARY:开标 09:30：有时刻的标/);
  // 没时刻的仍是全天事件
  assert.match(ics, /DTSTART;VALUE=DATE:20261121/);
});

test("icsLocalDateTime：跨天加时与非法输入", () => {
  assert.equal(icsLocalDateTime("2026-11-20", "23:30", 60), "20261121T003000");
  assert.equal(icsLocalDateTime("2026-11-20", "9:05"), "20261120T090500");
  assert.equal(icsLocalDateTime("2026-11-20", "25:00"), "");
  assert.equal(icsLocalDateTime("bad", "09:00"), "");
  assert.equal(icsBidTime({ bid_time: "09:30:00" }), "09:30");
  assert.equal(icsBidTime({}), "");
});
