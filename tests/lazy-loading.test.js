import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// v0.12.0：懒加载守卫——首屏减负是 v0.11.0 的核心收益，静态断言防止改动时悄悄加回常驻引用。
// 注意：动态 import() 文本不受本测试限制（那正是懒加载的合法形式）。
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const appJs = readFileSync(join(root, "app.js"), "utf8");
const indexHtml = readFileSync(join(root, "index.html"), "utf8");

test("懒加载守卫：app.js 没有解析模块的静态 import（任何写法都不行）", () => {
  // 静态 import 无论单行多行都含 `from "./js/..."`；动态 import() 不含 from，
  // 所以这条断言能拦住所有静态形式，又不误伤动态加载。
  assert.ok(!appJs.includes('from "./js/pdf-parser.js"'));
  assert.ok(!appJs.includes('from "./js/ai-extract.js"'));
});

test("懒加载守卫：解析模块仍通过动态 import() 按需加载", () => {
  assert.ok(appJs.includes('import("./js/pdf-parser.js")'));
  assert.ok(appJs.includes('import("./js/ai-extract.js")'));
  assert.ok(appJs.includes("ensureParserModules"));
});

test("懒加载守卫：首页没有 SheetJS 常驻脚本标签", () => {
  assert.ok(!indexHtml.includes("xlsx.full.min.js"));
});

test("懒加载守卫：SheetJS 按需加载仍带 SRI（loadSheetJS）", () => {
  assert.ok(appJs.includes("cdn.jsdelivr.net/npm/xlsx@0.18.5"));
  assert.ok(appJs.includes("sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw"));
});
