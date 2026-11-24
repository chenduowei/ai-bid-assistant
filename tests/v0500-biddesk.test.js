import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseHTML } from "linkedom";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");
const { document } = parseHTML(html);

test("v0.50.0+：已移除 AI 解析与废标清单冗余模块", () => {
  assert.equal(fs.existsSync(new URL("../js/ai-extract.js", import.meta.url)), false);
  assert.equal(fs.existsSync(new URL("../js/pdf-parser.js", import.meta.url)), false);
  assert.equal(document.getElementById("parserSheet"), null);
  assert.equal(document.getElementById("aiApiKey"), null);
  assert.doesNotMatch(ui, /renderChecklist\(p\)/);
});

test("v0.51.4 P0：sw.js 离线壳清单里的每个文件都真实存在，且安装不再原子失败", () => {
  const sw = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  assert.doesNotMatch(sw, /pdf-parser\.js/);
  assert.doesNotMatch(sw, /ai-extract\.js/);
  assert.doesNotMatch(sw, /cache\.addAll\(/);
  const shell = [...sw.matchAll(/"(\.\/[^\"]+)"/g)].map((m) => m[1]);
  assert.ok(shell.length > 0);
  for (const entry of shell) {
    assert.equal(
      fs.existsSync(new URL(`../${entry.slice(2)}`, import.meta.url)),
      true,
      `APP_SHELL 缺失文件：${entry}`
    );
  }
});

test("v0.50.0+：搜索框禁用自动填充、顶栏解除宽度限制", () => {
  const search = document.getElementById("search");
  assert.equal(search.getAttribute("type"), "search");
  assert.equal(search.getAttribute("autocomplete"), "off");
  assert.match(css, /\.header\s*\{[^}]*max-width:\s*none\s*!important;/);
});
