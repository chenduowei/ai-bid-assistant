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
} from "../js/ics.js";

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
