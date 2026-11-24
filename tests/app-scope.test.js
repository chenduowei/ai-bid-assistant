/**
 * v0.51.4 batch2a：app.js 的解析抽屉已整块删除 —— 此前钉住
 * `clearStaleAiResult` 作用域的回归检查（v0.35.6）随之失效：
 * 解析抽屉的全部入口（openParserSheet / closeParserSheet /
 * setParseTarget / resetParserState / clearStaleAiResult / showParser）
 * 都不应再出现在 app.js 里，否则就是 A 档清理漏删。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../app.js", import.meta.url), "utf8");

test("app.js：解析抽屉的全部函数均已删除", () => {
  for (const name of [
    "clearStaleAiResult",
    "resetParserState",
    "setParseTarget",
    "openParserSheet",
    "closeParserSheet",
    "showParser",
    "ensureParserModules",
    "getCurrentPdfFilename",
  ]) {
    assert.ok(!src.includes(name), `app.js 里不应再有 ${name}`);
  }
});
