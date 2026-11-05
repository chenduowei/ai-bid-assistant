import { test } from "node:test";
import assert from "node:assert/strict";
import { createAiExtract } from "../js/ai-extract.js";

const { _test } = createAiExtract({ ui: {} });
const { normalizeBidDate, parseJsonLoose, validateExtracted, normalizeResult, splitIntoChunks } = _test;

test("normalizeBidDate：只接受真实存在的 YYYY-MM-DD", () => {
  assert.equal(normalizeBidDate("2026-08-10"), "2026-08-10");
  assert.equal(normalizeBidDate("2026/8/10"), "2026-08-10");
  assert.equal(normalizeBidDate("2026年8月10日"), "2026-08-10");
  assert.equal(normalizeBidDate("2026-02-30"), "");
  assert.equal(normalizeBidDate("待定"), "");
  assert.equal(normalizeBidDate("详见文件"), "");
  assert.equal(normalizeBidDate(""), "");
  assert.equal(normalizeBidDate("2026-13-01"), "");
});

test("normalizeResult：非法日期不进表单字段", () => {
  const r = normalizeResult({ project_name: "某项目", bid_date: "2026年13月40日" });
  assert.equal(r.date, "");
  assert.equal(r.name, "某项目");
});

test("normalizeResult：风险等级白名单", () => {
  const r = normalizeResult({
    project_name: "某项目",
    risk_points: [{ level: 'high"><img src=x onerror=alert(1)>', text: "保证金过高" }],
  });
  assert.equal(r.riskPoints[0].level, "medium");
});

test("parseJsonLoose：能从 Markdown 代码块中取出 JSON", () => {
  const parsed = parseJsonLoose('```json\n{"project_name":"A","bid_date":"2026-08-10"}\n```');
  assert.equal(parsed.project_name, "A");
});

test("validateExtracted：空结果不通过", () => {
  assert.notEqual(validateExtracted({}), "");
  assert.equal(validateExtracted({ project_name: "A" }), "");
});

test("splitIntoChunks：短文本不切分，长文本切多块", () => {
  assert.equal(splitIntoChunks("abc").length, 1);
  assert.ok(splitIntoChunks("x".repeat(50000), 24000).length >= 3);
});

test("normalizeResult：结论带页码原文对象，字符串旧形态兼容", () => {
  const r = normalizeResult({
    project_name: "某项目",
    qualification: [
      { text: "须有施工资质", page: 18, quote: "投标人须具备…" },
      "旧字符串要点",
    ],
    invalid_bid_clauses: [{ text: "逾期无效", page: "第36页", quote: "原文" }],
    risk_points: [
      { level: "high", text: "保证金过高", page: 12, quote: "保证金 80 万" },
      { level: "critical", text: "等级非法" },
      "字符串风险点",
    ],
  });
  assert.deepEqual(r.qualification[0], {
    text: "须有施工资质",
    page: 18,
    quote: "投标人须具备…",
    verified: false,
  });
  assert.deepEqual(r.qualification[1], {
    text: "旧字符串要点",
    page: null,
    quote: "",
    verified: false,
  });
  assert.equal(r.invalidBidClauses[0].page, 36);
  assert.equal(r.riskPoints[0].level, "high");
  assert.equal(r.riskPoints[0].page, 12);
  assert.equal(r.riskPoints[1].level, "medium");
  assert.equal(r.riskPoints[2].level, "medium");
  assert.equal(r.riskPoints[2].text, "字符串风险点");
});

test("normalizeResult：给不出页码留 null，不编造", () => {
  const r = normalizeResult({
    project_name: "某项目",
    qualification: [{ text: "要点", page: null, quote: "" }],
  });
  assert.equal(r.qualification[0].page, null);
  assert.equal(r.qualification[0].quote, "");
});

test("splitIntoChunks：按页码标记分块并带页码区间", () => {
  const text =
    "【第 1 页】aaaa\n【第 2 页】bbbb\n【第 3 页】cccc";
  const chunks = splitIntoChunks(text, 100);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].startPage, 1);
  assert.equal(chunks[0].endPage, 3);
  const small = splitIntoChunks(text, 12);
  assert.ok(small.length >= 2);
  assert.equal(small[0].startPage, 1);
  assert.ok(small[small.length - 1].endPage === 3);
});

test("splitIntoChunks：无页码时按字符切，短文本单块", () => {
  const chunks = splitIntoChunks("x".repeat(50000), 24000);
  assert.ok(chunks.length >= 3);
  assert.equal(chunks[0].startPage, null);
  assert.equal(splitIntoChunks("abc").length, 1);
});
