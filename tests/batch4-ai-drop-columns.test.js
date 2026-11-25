import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

/* 第 4 批第 2 步：AI 五列库侧清理（只改仓库文件，SQL 未执行）。
 * 5 列：risk_summary / risk_points / qualification /
 * invalid_bid_clauses / extracted_meta。
 * checklist 与 pdf_text / pdf_filename / pdf_parsed_at 是活数据，必须保留。
 * 删列 SQL 在 supabase.sql 第 14 节（幂等），执行前须先全量导出备份。 */

const AI_DB_COLUMNS = [
  "risk_summary",
  "risk_points",
  "qualification",
  "invalid_bid_clauses",
  "extracted_meta",
];

const read = (path) =>
  fs.readFileSync(new URL(path, import.meta.url), "utf8");

const sql = read("../supabase.sql");

// 建表段：从 CREATE TABLE public.projects ( 到第一个 ); 为止
const createStart = sql.indexOf("create table if not exists public.projects (");
assert.notEqual(createStart, -1, "应找到 projects 建表段");
const createEnd = sql.indexOf(");", createStart);
const createTable = sql.slice(createStart, createEnd);

function section(sqlText, num, nextNum) {
  const start = sqlText.indexOf(`-- ${num})`);
  assert.notEqual(start, -1, `应找到第 ${num} 节`);
  const end = sqlText.indexOf(`-- ${nextNum})`, start);
  assert.notEqual(end, -1, `应找到第 ${nextNum} 节（第 ${num} 节的边界）`);
  return sqlText.slice(start, end);
}

test("第 4 批第 2 步：建表段不再含 5 个 AI 列，活数据列保留", () => {
  for (const col of AI_DB_COLUMNS) {
    assert.equal(
      new RegExp(`\\b${col}\\b`).test(createTable),
      false,
      `建表段不应再有 ${col}`
    );
  }
  for (const col of ["checklist", "pdf_text", "pdf_filename", "pdf_parsed_at"]) {
    assert.ok(
      new RegExp(`\\b${col}\\b`).test(createTable),
      `建表段应保留活数据列 ${col}`
    );
  }
});

test("第 4 批第 2 步：第 3、4 节不再有 5 列的 ADD COLUMN", () => {
  for (const [num, next] of [
    [3, 4],
    [4, 5],
  ]) {
    const seg = section(sql, num, next);
    for (const col of AI_DB_COLUMNS) {
      assert.equal(
        new RegExp(`add column if not exists ${col}\\b`, "i").test(seg),
        false,
        `第 ${num} 节不应再有 add column ${col}`
      );
    }
  }
  // 第 4 节保留的列仍在
  const sec4 = section(sql, 4, 5);
  assert.ok(/add column if not exists tenderer\b/i.test(sec4), "第 4 节应保留 tenderer");
  assert.ok(/add column if not exists amount\b/i.test(sec4), "第 4 节应保留 amount");
});

test("第 4 批第 2 步：第 14 节删列在位且幂等（DROP COLUMN IF EXISTS）", () => {
  const idx = sql.indexOf("-- 14)");
  assert.notEqual(idx, -1, "应找到第 14 节");
  const sec14 = sql.slice(idx);
  // 第 14 节须在文件末尾区域（其后无其他节）
  assert.equal(/-- 1[5-9]\)|-- 2\d\)/.test(sec14), false, "第 14 节之后不应再有新节");
  for (const col of AI_DB_COLUMNS) {
    assert.ok(
      new RegExp(`alter table public\\.projects drop column if exists ${col};`, "i").test(sec14),
      `第 14 节应有 drop column if exists ${col}`
    );
  }
  // 删列语句不多不少：只删这 5 列
  const drops = sec14.match(/drop column if exists \w+;/gi) || [];
  assert.equal(drops.length, 5, "第 14 节应恰好 5 条删列语句");
  // 执行前先备份的提示在位
  assert.ok(/执行前必须先.*全量导出备份/.test(sec14), "第 14 节应注明执行前先全量导出备份");
});
