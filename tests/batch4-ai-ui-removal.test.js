import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PROJECT_FIELDS,
  patchFieldMap,
  exportCsvColumns,
  toUiProject,
  uiToDbInsert,
  localPatchKeys,
  baseListDbColumns,
} from "../js/fields.js";
import { stripAiColumns, AI_LEGACY_DB_COLUMNS } from "../js/utils.js";

/* 第 4 批第 1 步：AI 展示下线（只拆 UI，不删库列）。
 * 5 个 AI 遗留列：risk_summary / risk_points / qualification /
 * invalid_bid_clauses / extracted_meta。checklist 与 pdf_text /
 * pdf_filename / pdf_parsed_at 是活数据，必须保留。 */

const AI_UI_KEYS = [
  "riskSummary",
  "riskPoints",
  "qualification",
  "invalidBidClauses",
  "extractedMeta",
];
const AI_DB_COLUMNS = [
  "risk_summary",
  "risk_points",
  "qualification",
  "invalid_bid_clauses",
  "extracted_meta",
];

const uiJs = fs.readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");
const appJs = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const utilsJs = fs.readFileSync(
  new URL("../js/utils.js", import.meta.url),
  "utf8"
);
const projectsJs = fs.readFileSync(
  new URL("../js/projects.js", import.meta.url),
  "utf8"
);

test("第 4 批：注册表 30 列，不再含 5 个 AI 列", () => {
  assert.equal(PROJECT_FIELDS.length, 30);
  for (const db of AI_DB_COLUMNS) {
    assert.equal(
      PROJECT_FIELDS.some((f) => f.db === db),
      false,
      `注册表不应再有 ${db}`
    );
  }
  // 活数据保留
  for (const key of ["checklist", "pdfText", "pdfFilename", "pdfParsedAt"]) {
    assert.ok(
      PROJECT_FIELDS.some((f) => f.key === key),
      `注册表应保留 ${key}`
    );
  }
});

test("第 4 批：回写白名单与本地乐观写入不再含 AI 键", () => {
  const fieldMap = patchFieldMap();
  const localKeys = localPatchKeys();
  for (const key of AI_UI_KEYS) {
    assert.equal(key in fieldMap, false, `patchFieldMap 不应有 ${key}`);
    assert.equal(localKeys.includes(key), false, `localPatch 不应有 ${key}`);
  }
  assert.ok("checklist" in fieldMap, "checklist 仍可回写");
  assert.ok("pdfText" in fieldMap, "pdfText 仍可回写");
});

test("第 4 批：列表查询列与 CSV 导出不再含 AI 列", () => {
  for (const db of AI_DB_COLUMNS) {
    assert.equal(baseListDbColumns().includes(db), false);
  }
  const labels = exportCsvColumns().map((c) => c.label);
  assert.equal(labels.includes("风险摘要"), false);
});

test("第 4 批：toUiProject / uiToDbInsert 丢弃 AI 列", () => {
  const row = {
    id: "1",
    name: "项目 A",
    risk_summary: "高风险",
    risk_points: [{ text: "x" }],
    qualification: [{ text: "y" }],
    invalid_bid_clauses: [{ text: "z" }],
    extracted_meta: { pages: 3 },
    checklist: [],
    pdf_filename: "标书.pdf",
  };
  const ui = toUiProject(row);
  for (const key of AI_UI_KEYS) assert.equal(key in ui, false, key);
  assert.equal(ui.pdfFilename, "标书.pdf");
  assert.deepEqual(ui.checklist, []);
  const insert = uiToDbInsert({
    ...ui,
    riskSummary: "高风险",
    extractedMeta: { pages: 3 },
  });
  for (const db of AI_DB_COLUMNS) assert.equal(db in insert, false, db);
  assert.equal(insert.pdf_filename, "标书.pdf");
});

test("第 4 批：stripAiColumns 只剥 AI 列，活数据原样保留", () => {
  assert.deepEqual(AI_LEGACY_DB_COLUMNS, AI_DB_COLUMNS);
  const row = {
    id: "1",
    name: "项目 A",
    risk_summary: "x",
    risk_points: [],
    qualification: [],
    invalid_bid_clauses: [],
    extracted_meta: {},
    checklist: [{ id: "c1", text: "核对保证金", done: false }],
    pdf_text: "全文",
    pdf_filename: "标书.pdf",
    pdf_parsed_at: "2026-01-01T00:00:00Z",
  };
  const out = stripAiColumns(row);
  for (const db of AI_DB_COLUMNS) assert.equal(db in out, false, db);
  assert.equal(out.checklist.length, 1);
  assert.equal(out.pdf_text, "全文");
  assert.equal(out.pdf_filename, "标书.pdf");
  assert.equal(out.pdf_parsed_at, "2026-01-01T00:00:00Z");
  assert.equal(row.risk_summary, "x", "不改原对象");
});

test("第 4 批：ui.js 不再渲染 AI 面板", () => {
  for (const frag of [
    "const renderRiskCard",
    "const renderStructList",
    "const evidenceMeta",
    "riskSummary",
    "riskPoints",
    "invalidBidClauses",
    "p.qualification",
    "clear-risk",
    "verify-evidence",
    "delete-evidence",
    "checklist-generate",
    "从 AI 结果生成清单",
  ]) {
    assert.equal(uiJs.includes(frag), false, `ui.js 不应再有 ${frag}`);
  }
  // 检查清单（活数据）仍在
  assert.ok(uiJs.includes("renderChecklist"));
  assert.ok(uiJs.includes("checklist-add"));
  assert.ok(uiJs.includes("clear-checklist"));
});

test("第 4 批：app.js 不再有 AI 回写链", () => {
  for (const frag of [
    "buildChecklistFromAi",
    "normalizeEvidenceItems",
    "riskSummary",
    "riskPoints",
    "invalidBidClauses",
    "delete-evidence",
    "clear-risk",
    "verify-evidence",
    "checklist-generate",
  ]) {
    assert.equal(appJs.includes(frag), false, `app.js 不应再有 ${frag}`);
  }
  // 清单的正常写入口仍在
  assert.ok(appJs.includes("checklist-add"));
  assert.ok(appJs.includes("clear-checklist"));
  assert.ok(appJs.includes("checklist-delete"));
});

test("第 4 批：utils.js 不再有 AI 结论工具函数", () => {
  for (const frag of [
    "buildChecklistFromAi",
    "normalizeEvidenceItems",
    "normalizeEvidenceItem",
    "normalizeEvidencePage",
    "getEvidenceState",
    "qualMatchBadge",
    "qualMatchSummary",
  ]) {
    assert.equal(utilsJs.includes(frag), false, `utils.js 不应再有 ${frag}`);
  }
  assert.ok(utilsJs.includes("stripAiColumns"));
});

test("第 4 批：备份导出与恢复都剥离 AI 列", () => {
  assert.ok(projectsJs.includes("stripAiColumns"));
  assert.ok(projectsJs.includes("allRows.map(stripAiColumns)"));
  assert.ok(projectsJs.includes(".map(stripAiColumns)"));
});
