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
  debounce,
  parseCsvProjects,
  buildImportCsvTemplate,
  getGuaranteeRefundReminders,
  sheetRowsToCsv,
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

/* ============ v0.4.0：防抖 / CSV 导入 / 保证金退还提醒 ============ */

test("debounce：连续调用只执行最后一次，cancel 可取消", async () => {
  let calls = [];
  const fn = debounce((v) => calls.push(v), 30);
  fn(1);
  fn(2);
  fn(3);
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(calls, [3]);
  assert.equal(typeof fn.cancel, "function");
  fn(4);
  fn.cancel();
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(calls, [3]);
});

test("parseCsvProjects：BOM、引号逗号/换行、非法行、数值/日期清洗", () => {
  const header =
    "项目名称,项目类型,投标公司,招标单位,联系人,开标时间,保证金要求原文,项目金额原文,项目金额（数值）,项目金额单位,保证金金额,保证金单位,保证金状态,项目状态,备注,报名截止,质疑截止,澄清截止,保证金缴纳截止";
  const csv =
    "\uFEFF" +
    header +
    "\n" +
    '正常项目,房建工程,甲公司,招标局,张三,2026-12-01,"保证金 10 万元，开标后退还",,500,万元,10,万元,未缴纳,报名中,备注,2026-11-01,,,2026-11-20\n' +
    '"带,逗号项目",市政,乙公司,,李四,2026/12/02,,,"1,200",元,abc,非法单位,非法状态,非法状态,"多行\n备注",2026-02-30,,,,\n' +
    "缺必填,房建工程,,招标局,王五,2026-12-03,,,,,,,,,,,,,\n" +
    "缺日期,房建工程,丙公司,招标局,赵六,待定,,,,,,,,,,,,,\n" +
    ",,,,,,,,,,,,,,,,,,\n";
  const { rows, errors } = parseCsvProjects(csv);
  assert.equal(rows.length, 2);
  assert.equal(errors.length, 2);
  assert.deepEqual(rows[0], {
    bid_date: "2026-12-01",
    project_type: "房建工程",
    name: "正常项目",
    bidding_company: "甲公司",
    tenderer: "招标局",
    contact: "张三",
    guarantee: "保证金 10 万元，开标后退还",
    amount: null,
    amount_value: 500,
    amount_unit: "万元",
    guarantee_amount: 10,
    guarantee_unit: "万元",
    guarantee_status: "未缴纳",
    status: "报名中",
    notes: "备注",
    registration_deadline: "2026-11-01",
    inquiry_deadline: null,
    clarification_deadline: null,
    guarantee_deadline: "2026-11-20",
  });
  // 第二行：引号逗号、数值千分位、非法单位/状态回退、非法报名截止 → null、多行备注保留换行
  assert.equal(rows[1].name, "带,逗号项目");
  assert.equal(rows[1].bid_date, "2026-12-02");
  assert.equal(rows[1].amount_value, 1200);
  assert.equal(rows[1].amount_unit, "元");
  assert.equal(rows[1].guarantee_amount, null);
  assert.equal(rows[1].guarantee_unit, "万元");
  assert.equal(rows[1].guarantee_status, "未缴纳");
  assert.equal(rows[1].status, "报名中");
  assert.equal(rows[1].notes, "多行\n备注");
  assert.equal(rows[1].registration_deadline, null);
  // 错误行：缺必填、缺日期（行号按物理行算：第二行含多行备注，占两行）
  assert.deepEqual(
    errors.map((e) => e.line),
    [5, 6]
  );
  assert.match(errors[0].reason, /投标公司/);
  assert.match(errors[1].reason, /开标时间/);
});

test("parseCsvProjects：空文件与无表头", () => {
  assert.equal(parseCsvProjects("").rows.length, 0);
  assert.equal(parseCsvProjects("   ").errors.length, 1);
  const noHeader = parseCsvProjects("a,b,c\n1,2,3\n");
  assert.equal(noHeader.rows.length, 0);
  assert.match(noHeader.errors[0].reason, /表头/);
});

test("buildImportCsvTemplate：含 BOM、表头与示例行", () => {
  const tpl = buildImportCsvTemplate();
  assert.ok(tpl.startsWith("\uFEFF项目名称,项目类型,投标公司"));
  assert.ok(tpl.includes("示例项目"));
  // 模板能被 parseCsvProjects 解析出 1 行
  const { rows, errors } = parseCsvProjects(tpl);
  assert.equal(errors.length, 0);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "示例项目");
  assert.equal(rows[0].amount_value, 500);
});

test("getGuaranteeRefundReminders：只返回已缴纳+已开标+已过开标日+金额>0，按开标日升序", () => {
  const now = new Date("2026-10-14T12:00:00");
  const projects = [
    { name: "应提醒-早", date: "2026-10-10", status: "已开标", guaranteeStatus: "已缴纳", guaranteeAmount: 10 },
    { name: "应提醒-今天", date: "2026-10-14", status: "已开标", guaranteeStatus: "已缴纳", guaranteeAmount: "5" },
    { name: "未开标", date: "2026-10-10", status: "制作中", guaranteeStatus: "已缴纳", guaranteeAmount: 10 },
    { name: "已退回", date: "2026-10-10", status: "已开标", guaranteeStatus: "已退回", guaranteeAmount: 10 },
    { name: "未缴纳", date: "2026-10-10", status: "已开标", guaranteeStatus: "未缴纳", guaranteeAmount: 10 },
    { name: "开标在未来", date: "2026-10-15", status: "已开标", guaranteeStatus: "已缴纳", guaranteeAmount: 10 },
    { name: "金额为0", date: "2026-10-10", status: "已开标", guaranteeStatus: "已缴纳", guaranteeAmount: 0 },
    { name: "金额非法", date: "2026-10-10", status: "已开标", guaranteeStatus: "已缴纳", guaranteeAmount: "abc" },
  ];
  assert.deepEqual(
    getGuaranteeRefundReminders(projects, now).map((p) => p.name),
    ["应提醒-早", "应提醒-今天"]
  );
  assert.deepEqual(getGuaranteeRefundReminders([], now), []);
});

test("sheetRowsToCsv：二维数组转 CSV，含逗号/引号/换行时正确转义", () => {
  assert.equal(
    sheetRowsToCsv([
      ["项目名称", "备注"],
      ["A 项目", "含,逗号"],
      ["B 项目", '含"引号"'],
      ["C 项目", "含\n换行"],
      ["D 项目", null],
    ]),
    '项目名称,备注\nA 项目,"含,逗号"\nB 项目,"含""引号"""\nC 项目,"含\n换行"\nD 项目,'
  );
  assert.equal(sheetRowsToCsv([]), "");
  assert.equal(sheetRowsToCsv(null), "");
});

test("sheetRowsToCsv + parseCsvProjects：Excel 表格行可直接走 CSV 导入校验", () => {
  const csv = sheetRowsToCsv([
    ["开标时间", "项目名称", "项目类型", "投标公司", "联系人"],
    ["2026-12-01", "X 项目", "房建工程", "X 公司", "张三"],
    ["", "", "", "", ""],
  ]);
  const { rows, errors } = parseCsvProjects(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "X 项目");
  assert.equal(rows[0].bid_date, "2026-12-01");
  assert.equal(errors.length, 0);
});
