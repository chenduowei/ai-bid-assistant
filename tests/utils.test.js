import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getMissedBidProjects,
  getTrashExpiryCutoff,
  TRASH_RETENTION_DAYS,
  normalizeChecklist,
  buildChecklistFromAi,
  getChecklistProgress,
  formatMoney,
  getGuaranteeTotals,
  getDeadlineItems,
  getNextDeadline,
  getUpcomingDeadlines,
  DEADLINE_TYPES,
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

/* ============ v0.3.0：废标检查清单 ============ */

test("normalizeChecklist：清洗非法项、截断 500 字、最多 100 项", () => {
  assert.deepEqual(normalizeChecklist(null), []);
  assert.deepEqual(normalizeChecklist("不是数组"), []);
  const cleaned = normalizeChecklist([
    { id: "a", text: "  带空格  ", done: 1, source: "ai-invalid" },
    { id: "", text: "无 id", done: false, source: "manual" },
    { id: "b", text: "   ", done: false, source: "manual" },
    { id: "c", text: "x".repeat(600), done: false, source: "非法来源" },
    null,
    "字符串项",
  ]);
  assert.equal(cleaned.length, 2);
  assert.deepEqual(cleaned[0], {
    id: "a",
    text: "带空格",
    done: true,
    source: "ai-invalid",
  });
  assert.equal(cleaned[1].text.length, 500);
  assert.equal(cleaned[1].source, "manual");
  const many = Array.from({ length: 150 }, (_, i) => ({
    id: `id-${i}`,
    text: `项 ${i}`,
    done: false,
    source: "manual",
  }));
  assert.equal(normalizeChecklist(many).length, 100);
});

test("buildChecklistFromAi：废标全转、高/中风险转、低风险不转、去重、最多 50", () => {
  const list = buildChecklistFromAi(
    ["废标 A", "废标 B", "废标 A", "  "],
    [
      { text: "高风险", level: "high" },
      { text: "中风险", level: "medium" },
      { text: "低风险", level: "low" },
      { text: "无等级" },
      "字符串风险点",
    ]
  );
  assert.deepEqual(
    list.map((i) => [i.text, i.source]),
    [
      ["废标 A", "ai-invalid"],
      ["废标 B", "ai-invalid"],
      ["高风险", "ai-risk"],
      ["中风险", "ai-risk"],
    ]
  );
  assert.ok(list.every((i) => i.done === false));
  assert.deepEqual(buildChecklistFromAi(null, null), []);
  const big = buildChecklistFromAi(
    Array.from({ length: 60 }, (_, i) => `条款 ${i}`),
    []
  );
  assert.equal(big.length, 50);
});

test("getChecklistProgress：返回 done/total", () => {
  assert.deepEqual(
    getChecklistProgress([
      { done: true },
      { done: false },
      { done: true },
    ]),
    { done: 2, total: 3 }
  );
  assert.deepEqual(getChecklistProgress(null), { done: 0, total: 0 });
});

/* ============ v0.3.0：结构化金额 / 保证金 ============ */

test("formatMoney：空值返回空，数值千分位、最多 2 位小数", () => {
  assert.equal(formatMoney(null, "万元"), "");
  assert.equal(formatMoney("", "万元"), "");
  assert.equal(formatMoney(undefined, "元"), "");
  assert.equal(formatMoney("abc", "元"), "");
  assert.equal(formatMoney(10000, "万元"), "10,000万元");
  assert.equal(formatMoney(1234.567, "元"), "1,234.57元");
  assert.equal(formatMoney(500, ""), "500");
  assert.equal(formatMoney("2500.5", "万元"), "2,500.5万元");
});

test("getGuaranteeTotals：按单位折算万元、按状态合计、保留 2 位小数", () => {
  const totals = getGuaranteeTotals([
    { guaranteeAmount: 10, guaranteeUnit: "万元", guaranteeStatus: "已缴纳" },
    { guaranteeAmount: 20000, guaranteeUnit: "元", guaranteeStatus: "已缴纳" },
    { guaranteeAmount: 5, guaranteeUnit: "万元", guaranteeStatus: "已退回" },
    { guaranteeAmount: 10000, guaranteeUnit: "元", guaranteeStatus: "已没收" },
    { guaranteeAmount: 99, guaranteeUnit: "万元", guaranteeStatus: "未缴纳" },
    { guaranteeAmount: null, guaranteeUnit: "万元", guaranteeStatus: "已缴纳" },
    { guaranteeAmount: "abc", guaranteeUnit: "万元", guaranteeStatus: "已缴纳" },
  ]);
  assert.deepEqual(totals, {
    inTransit: 12,
    paid: 12,
    refunded: 5,
    forfeited: 1,
  });
  assert.deepEqual(getGuaranteeTotals([]), {
    inTransit: 0,
    paid: 0,
    refunded: 0,
    forfeited: 0,
  });
  // 0.1 万元 + 100 元 = 0.11 万元（浮点不漂移）
  assert.equal(
    getGuaranteeTotals([
      { guaranteeAmount: 0.1, guaranteeUnit: "万元", guaranteeStatus: "已缴纳" },
      { guaranteeAmount: 100, guaranteeUnit: "元", guaranteeStatus: "已缴纳" },
    ]).inTransit,
    0.11
  );
});

/* ============ v0.3.0：多截止时间 ============ */

const isoDate = (offsetDays) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

test("DEADLINE_TYPES：包含 4 个截止 + 开标时间", () => {
  assert.deepEqual(
    DEADLINE_TYPES.map((t) => t.key),
    [
      "registration_deadline",
      "inquiry_deadline",
      "clarification_deadline",
      "guarantee_deadline",
      "date",
    ]
  );
});

test("getDeadlineItems：跳过空日期与已开标，days 可为负", () => {
  const items = getDeadlineItems({
    status: "制作中",
    date: isoDate(10),
    registration_deadline: isoDate(-1),
    inquiry_deadline: "",
    clarification_deadline: null,
    guarantee_deadline: isoDate(0),
  });
  assert.deepEqual(
    items.map((i) => [i.key, i.days]),
    [
      ["registration_deadline", -1],
      ["guarantee_deadline", 0],
      ["date", 10],
    ]
  );
  assert.deepEqual(
    getDeadlineItems({ status: "已开标", date: isoDate(1) }),
    []
  );
  assert.deepEqual(getDeadlineItems(null), []);
});

test("getNextDeadline：未来最近一个（含今天），无则 null", () => {
  const p = {
    status: "报名中",
    date: isoDate(10),
    registration_deadline: isoDate(-2),
    guarantee_deadline: isoDate(3),
    inquiry_deadline: isoDate(0),
  };
  assert.equal(getNextDeadline(p).key, "inquiry_deadline");
  assert.equal(getNextDeadline(p).days, 0);
  assert.equal(
    getNextDeadline({ status: "报名中", date: isoDate(-1) }),
    null
  );
});

test("getUpcomingDeadlines：窗口过滤、按 days 再按 date 排序、带项目", () => {
  const a = { id: "a", name: "A", status: "报名中", date: isoDate(5), registration_deadline: isoDate(2) };
  const b = { id: "b", name: "B", status: "制作中", date: isoDate(1), guarantee_deadline: isoDate(30) };
  const c = { id: "c", name: "C", status: "已开标", date: isoDate(0) };
  const out = getUpcomingDeadlines([a, b, c], 7);
  assert.deepEqual(
    out.map((i) => [i.project.id, i.key, i.days]),
    [
      ["b", "date", 1],
      ["a", "registration_deadline", 2],
      ["a", "date", 5],
    ]
  );
  assert.deepEqual(getUpcomingDeadlines([a], 0), []);
});
