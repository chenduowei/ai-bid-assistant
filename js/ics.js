// v0.33.0：.ics 日历订阅 —— 纯函数生成 iCalendar 文本。
// Vercel 订阅函数（api/calendar.js）与单测共用；不依赖 DOM。
// 事件为全天事件（只知道开标日期，不知道具体时刻）；提醒用绝对时间触发：
//   - 开标前一天早上 9 点（北京时间 = UTC 01:00）
//   - 开标当天早上 8 点（北京时间 = UTC 00:00）
// 中国无夏令时，UTC+8 全年固定，换算不会漂。

export const ICS_PRODID = "-//投标工作台//开标日历//CN";
export const ICS_CALNAME = "投标工作台·开标日历";

// RFC 5545 文本转义：\ ; , 与换行。
export function escapeIcsText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

// "YYYY-MM-DD" → UTC 午夜的 Date（只比日期字符串，不碰本地时区）。
export function parseIcsDate(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || ""));
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function addDaysIcs(dateStr, days) {
  const d = parseIcsDate(dateStr);
  if (!d) return "";
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function icsDateValue(dateStr) {
  const d = parseIcsDate(dateStr);
  if (!d) return "";
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

// 某日 UTC 某时 → "YYYYMMDDTHHMMSSZ"。
export function icsDateTimeUtc(dateStr, utcHour) {
  const d = parseIcsDate(dateStr);
  if (!d) return "";
  d.setUTCHours(utcHour, 0, 0, 0);
  return formatUtcDateTime(d);
}

export function formatUtcDateTime(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

// RFC 5545：每行不超过 75 个八位字节（不含 CRLF），超长折行，续行以空格开头。
// 按 UTF-8 字节切，绝不把多字节字符切开；续行本身占 1 个字节，只放 74 字节内容。
export function foldIcsLine(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const decoder = new TextDecoder();
  const parts = [];
  let start = 0;
  while (start < bytes.length) {
    const limit = start === 0 ? 75 : 74;
    let end = Math.min(start + limit, bytes.length);
    // 回退到非续行字节（0x80–0xBF 为 UTF-8 续行字节），不切开多字节字符。
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80)
      end--;
    parts.push(decoder.decode(bytes.subarray(start, end)));
    start = end;
  }
  return parts.join("\r\n ");
}

// projects 行形状：{ id, name, bid_date, project_type, bidding_company,
// tenderer, contact, notes }。缺 bid_date 或 name 的行跳过。
export function buildCalendarIcs(projects, now = new Date()) {
  const dtstamp = formatUtcDateTime(now) || "20260101T000000Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${ICS_PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${ICS_CALNAME}`,
  ];
  for (const p of projects || []) {
    if (!p?.bid_date || !p?.name) continue;
    const start = icsDateValue(p.bid_date);
    const end = icsDateValue(addDaysIcs(p.bid_date, 1));
    // 前一天 9:00（北京时间）= 前一天 01:00 UTC；当天 8:00 = 当天 00:00 UTC。
    const alarmBefore = icsDateTimeUtc(addDaysIcs(p.bid_date, -1), 1);
    const alarmDay = icsDateTimeUtc(p.bid_date, 0);
    if (!start || !end || !alarmBefore || !alarmDay) continue;
    const descLines = [];
    if (p.project_type) descLines.push(`项目类型：${p.project_type}`);
    if (p.bidding_company) descLines.push(`投标公司：${p.bidding_company}`);
    if (p.tenderer) descLines.push(`招标单位：${p.tenderer}`);
    if (p.contact) descLines.push(`联系人：${p.contact}`);
    if (p.notes) descLines.push(`备注：${p.notes}`);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${p.id}@bid-assistant`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${escapeIcsText(`开标：${p.name}`)}`
    );
    if (descLines.length)
      lines.push(`DESCRIPTION:${escapeIcsText(descLines.join("\n"))}`);
    lines.push(
      "BEGIN:VALARM",
      `TRIGGER;VALUE=DATE-TIME:${alarmBefore}`,
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcsText(`明天开标：${p.name}`)}`,
      "END:VALARM",
      "BEGIN:VALARM",
      `TRIGGER;VALUE=DATE-TIME:${alarmDay}`,
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcsText(`今天开标：${p.name}`)}`,
      "END:VALARM",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
