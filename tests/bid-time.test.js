import test from "node:test";
import assert from "node:assert/strict";
import {
  formatBidTime,
  getBidDateTime,
  formatBidMoment,
  getCountdownInfo,
  getTrashRemainingDays,
  getWinRate,
  matchResult,
  getMissedBidProjects,
  getDeadlineItems,
  TRASH_RETENTION_DAYS,
} from "../js/utils.js";

/* ============ v0.35.0：精确开标时刻 ============ */

test("formatBidTime：归一成 HH:MM，非法 / 空返回空串", () => {
  assert.equal(formatBidTime("9:30"), "09:30");
  assert.equal(formatBidTime("09:30:00"), "09:30");
  assert.equal(formatBidTime("23:59"), "23:59");
  assert.equal(formatBidTime("24:00"), "");
  assert.equal(formatBidTime("9:61"), "");
  assert.equal(formatBidTime(""), "");
  assert.equal(formatBidTime(null), "");
});

test("getBidDateTime / formatBidMoment：有日期没时刻按当天零点，有时刻用时刻", () => {
  const a = getBidDateTime({ date: "2026-11-20", bidTime: "09:30" });
  assert.equal(a.getFullYear(), 2026);
  assert.equal(a.getMonth(), 10);
  assert.equal(a.getDate(), 20);
  assert.equal(a.getHours(), 9);
  assert.equal(a.getMinutes(), 30);
  assert.equal(getBidDateTime({ date: "", bidTime: "09:30" }), null);
  assert.equal(
    formatBidMoment({ date: "2026-11-20", bidTime: "09:30" }),
    "2026年11月20日 09:30"
  );
  assert.equal(formatBidMoment({ date: "2026-11-20" }), "2026年11月20日");
});

test("getCountdownInfo：有时刻时精确到小时 / 分钟，跨过开标时刻改成“已到开标时刻”", () => {
  const now = new Date("2026-11-19T07:00:00");
  assert.equal(
    getCountdownInfo({ date: "2026-11-19", bidTime: "09:30", status: "制作中" }, now).text,
    "3小时后"
  );
  assert.equal(
    getCountdownInfo({ date: "2026-11-20", bidTime: "09:30", status: "制作中" }, now).text,
    "还有1天"
  );
  const past = getCountdownInfo(
    { date: "2026-11-19", bidTime: "06:00", status: "制作中" },
    now
  );
  assert.equal(past.text, "已到开标时刻");
  assert.equal(past.cls, "cd-overdue");
  assert.equal(
    getCountdownInfo({ date: "2026-11-19", bidTime: "07:30", status: "制作中" }, now).text,
    "30分钟后"
  );
});

test("getCountdownInfo：没填时刻保持原来按天的口径", () => {
  const now = new Date("2026-11-19T07:00:00");
  assert.equal(getCountdownInfo({ date: "2026-11-19", status: "制作中" }, now).text, "今天开标");
  assert.equal(getCountdownInfo({ date: "2026-11-21", status: "制作中" }, now).text, "还有2天");
  assert.equal(getCountdownInfo({ date: "2026-11-10", status: "制作中" }, now).text, "已过期9天");
  assert.equal(getCountdownInfo({ date: "2026-11-19", status: "已开标" }, now).text, "已开标");
});

test("getMissedBidProjects：当天有时刻，只有过了那个时刻才算错过", () => {
  const projects = [
    { name: "今天 9:30", date: "2026-11-19", bidTime: "09:30", status: "制作中" },
    { name: "今天 6:00", date: "2026-11-19", bidTime: "06:00", status: "制作中" },
    { name: "今天没时刻", date: "2026-11-19", status: "制作中" },
  ];
  const at8 = getMissedBidProjects(projects, new Date("2026-11-19T08:00:00"));
  assert.deepEqual(at8.map((p) => p.name), ["今天 6:00"]);
  const at10 = getMissedBidProjects(projects, new Date("2026-11-19T10:00:00"));
  assert.deepEqual(at10.map((p) => p.name).sort(), ["今天 6:00", "今天 9:30"]);
});

test("getDeadlineItems：界面项目的驼峰截止字段也认（之前只读下划线字段，面板里永远只有开标日一条）", () => {
  const items = getDeadlineItems({
    date: "2099-01-01",
    registrationDeadline: "2098-12-01",
    status: "报名中",
  });
  assert.ok(items.some((i) => i.key === "registration_deadline"));
});

test("getDeadlineItems：开标项带出时刻，其它截止项不带", () => {
  const items = getDeadlineItems({
    date: "2099-01-01",
    bidTime: "09:30",
    registrationDeadline: "2098-12-01",
    status: "报名中",
  });
  assert.equal(items.find((i) => i.key === "date").time, "09:30");
  assert.equal(items.find((i) => i.key === "registration_deadline").time, "");
});

/* ============ v0.35.0：回收站倒计时 ============ */

test("getTrashRemainingDays：30 天保留，向下取整，过期不出现负数", () => {
  const now = new Date("2026-11-19T12:00:00");
  assert.equal(getTrashRemainingDays("2026-11-19T08:00:00", now), TRASH_RETENTION_DAYS);
  assert.equal(getTrashRemainingDays("2026-11-16T12:00:00", now), 27);
  assert.equal(getTrashRemainingDays("2026-10-01T12:00:00", now), 0);
  assert.equal(getTrashRemainingDays("", now), null);
});

/* ============ v0.35.0：中标结果与中标率 ============ */

test("getWinRate：只算已出结果的；没有结果时 rate 为 null（不显示 0%）", () => {
  assert.deepEqual(getWinRate([]), { won: 0, lost: 0, decided: 0, rate: null });
  assert.deepEqual(getWinRate([{ result: "" }, { result: null }]), {
    won: 0,
    lost: 0,
    decided: 0,
    rate: null,
  });
  const r = getWinRate([
    { result: "已中标" },
    { result: "已中标" },
    { result: "未中标" },
    { result: "" },
  ]);
  assert.equal(r.won, 2);
  assert.equal(r.lost, 1);
  assert.equal(r.decided, 3);
  assert.equal(r.rate, 66.7);
});

test("matchResult：all / 空不过滤，其余按结果精确匹配", () => {
  assert.equal(matchResult({ result: "已中标" }, "all"), true);
  assert.equal(matchResult({ result: "已中标" }, ""), true);
  assert.equal(matchResult({ result: "已中标" }, "已中标"), true);
  assert.equal(matchResult({ result: "未中标" }, "已中标"), false);
  assert.equal(matchResult({}, "未中标"), false);
});
