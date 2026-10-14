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
