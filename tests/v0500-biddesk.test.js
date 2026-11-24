import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseHTML } from "linkedom";
import { readCssBundle } from "./css-bundle.mjs";

// v0.51.4 batch2b：sw 壳契约已移入 tests/contracts.test.js（含反向断言），此处不再重复。
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readCssBundle();
const ui = fs.readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");
const { document } = parseHTML(html);

test("v0.50.0+：已移除 AI 解析与废标清单冗余模块", () => {
  assert.equal(fs.existsSync(new URL("../js/ai-extract.js", import.meta.url)), false);
  assert.equal(fs.existsSync(new URL("../js/pdf-parser.js", import.meta.url)), false);
  assert.equal(document.getElementById("parserSheet"), null);
  assert.equal(document.getElementById("aiApiKey"), null);
  assert.doesNotMatch(ui, /renderChecklist\(p\)/);
});

test("v0.51.4 batch2a：app.js 已无 A 档 AI 残留", () => {
  const app = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
  // 头注释里“已删除”的历史说明除外，只拦代码形态的残留
  for (const needle of [
    'import("./js/pdf-parser.js")',
    'import("./js/ai-extract.js")',
    "lastAiResult",
    "parserSheet",
    "aiAnalyzeBtn",
    "ensureParserModules",
    "parseTargetId",
    "resetParserState",
    "getCurrentPdfFilename",
  ]) {
    assert.ok(!app.includes(needle), `app.js 里不应再有 ${needle}`);
  }
});

test("v0.50.0+：搜索框禁用自动填充、顶栏解除宽度限制", () => {
  const search = document.getElementById("search");
  assert.equal(search.getAttribute("type"), "search");
  assert.equal(search.getAttribute("autocomplete"), "off");
  assert.match(css, /\.header\s*\{[^}]*max-width:\s*none\s*!important;/);
});
