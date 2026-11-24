import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseHTML } from "linkedom";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");
const { document } = parseHTML(html);

test("v0.50.0：已更名为 标管家 BidDesk，且移除 AI 解析与废标清单冗余模块", () => {
  assert.match(document.title, /标管家/);
  assert.equal(fs.existsSync(new URL("../js/ai-extract.js", import.meta.url)), false);
  assert.equal(fs.existsSync(new URL("../js/pdf-parser.js", import.meta.url)), false);
  assert.equal(document.getElementById("parserSheet"), null);
  assert.equal(document.getElementById("aiApiKey"), null);
  assert.doesNotMatch(ui, /renderChecklist\(p\)/);
});

test("v0.50.0：搜索框禁用自动填充、顶栏解除宽度限制、版本号在实时同步前", () => {
  const search = document.getElementById("search");
  assert.equal(search.getAttribute("type"), "search");
  assert.equal(search.getAttribute("autocomplete"), "off");
  assert.match(css, /\.header\s*\{[^}]*max-width:\s*none\s*!important;/);
  const inlineText = document.querySelector(".user-menu-inline").textContent;
  assert.ok(inlineText.indexOf("v0.50.0") < inlineText.indexOf("云端同步"));
});
