/**
 * v0.35.6：app.js 的作用域回归检查。
 *
 * 起因（真 bug，v0.35.0 起一直在线上）：`clearStaleAiResult` 在 v0.35.0 重构时被挪进了
 * `bindEvents()`，而模块级的 `resetParserState()` / `setParseTarget()` 仍在调它 ——
 * 每次打开「解析招标文件」抽屉都会抛 `ReferenceError: clearStaleAiResult is not defined`，
 * 复位流程后半段（清文本、清 AI 面板、按钮态）被整段跳过。手机与桌面都中招，只是不报错、只静默少做几步。
 *
 * 这类「函数被挪进内层作用域、外层调用点没跟着动」的问题，单测与 CSS 检查都覆盖不到，
 * 用一条静态断言钉住：这个名字必须声明在模块作用域（两格缩进），且在第一次使用之前。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const lines = src.split("\n");

const indentOf = (line) => line.length - line.trimStart().length;

test("app.js：clearStaleAiResult 声明在模块作用域（不是 bindEvents 里）", () => {
  const decl = lines.findIndex((l) =>
    /^\s*const clearStaleAiResult = /.test(l)
  );
  assert.ok(decl >= 0, "app.js 里应有 const clearStaleAiResult = …");
  assert.equal(
    indentOf(lines[decl]),
    2,
    "clearStaleAiResult 必须是模块级声明（两格缩进）；放进 bindEvents() 会让模块级的 resetParserState 抛 ReferenceError"
  );
});

test("app.js：clearStaleAiResult 的声明早于它的第一处调用", () => {
  const decl = lines.findIndex((l) =>
    /^\s*const clearStaleAiResult = /.test(l)
  );
  const firstUse = lines.findIndex((l) => /\bclearStaleAiResult\(\)/.test(l));
  assert.ok(firstUse >= 0, "至少应有一处调用");
  assert.ok(
    decl < firstUse,
    `声明在第 ${decl + 1} 行，首次调用在第 ${firstUse + 1} 行 —— 声明要写在前面`
  );
});
