/**
* v0.51.4 batch2b：契约测试 —— 集中放「改了就会直接翻车」的硬性约定。
* 与普通静态文本断言的区别：这里钉的是部署 / 发版契约（离线壳、版本号），
* 不是某一轮视觉语言；改实现必须同步改契约，改契约必须同步改实现与文档。
* 来源：
* - sw 壳存在性：自 tests/v0500-biddesk.test.js 移入（P0 回归，PR #30）；
* 移入时修了一个误报：原断言对 sw.js 全文做 doesNotMatch(/pdf-parser\.js/)，
* 但 sw.js 注释里会提到已删文件名作历史说明（基线 2 个失败之一）；
* 现改为只查 APP_SHELL 数组本身——进缓存清单的才是契约。
* - 版本一致性：与 scripts/check-version.mjs 同口径（package.json 为唯一事实来源），
* 让 `npm test` 也能抓住发版漏同步，`npm run check:version` 不再是唯一防线。
* - 反向断言：index.html 引用的本地 CSS/JS 必须在 APP_SHELL 内（除 sw.js 注释
* 明文排除的 supabase-config.js——它只存在于用户本地部署，进壳会让全新部署安装失败）。
* 注意：app-scope.test.js 里「解析抽屉函数已删除」的断言是另一条作用域契约，
* 留在原文件，不在这里重复。
*/
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const sw = fs.readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

/** 只取 APP_SHELL 数组字面量里的条目（不碰注释与 install / fetch 里的其他引用）。 */
function readAppShell(src) {
const m = src.match(/const APP_SHELL = \[([\s\S]*?)\];/);
assert.ok(m, "sw.js 里应有 const APP_SHELL = [...]");
return [...m[1].matchAll(/"(\.\/[^"]+)"/g)].map((x) => x[1]);
}
const shell = readAppShell(sw);

/** index.html 引用的本地 CSS/JS（<link rel="stylesheet"> 与 <script src>，按出现顺序去重）。 */
function readLocalCssJsRefs(markup) {
const refs = [];
for (const m of markup.matchAll(/<link\b[^>]*>/gi)) {
if (!/rel=["']stylesheet["']/i.test(m[0])) continue;
const href = m[0].match(/href=["']([^"']+)["']/i)?.[1];
if (href?.startsWith("./") &&!refs.includes(href)) refs.push(href);
}
for (const m of markup.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
if (m[1].startsWith("./") &&!refs.includes(m[1])) refs.push(m[1]);
}
return refs;
}

test("【契约】v0.51.4 P0：sw.js 离线壳清单里的每个文件都真实存在，且安装不再原子失败", () => {
assert.ok(shell.length > 0, "APP_SHELL 不应为空");
// 已删文件只查清单本身：sw.js 注释里提已删文件名作历史说明是允许的
assert.ok(!shell.some((e) => e.includes("pdf-parser.js")), "APP_SHELL 不应再含已删的 pdf-parser.js");
assert.ok(!shell.some((e) => e.includes("ai-extract.js")), "APP_SHELL 不应再含已删的 ai-extract.js");
  // 安装方式本身才是契约：逐个缓存，单个失败只记日志。原文 doesNotMatch(/addAll/)
  // 对全文误报——注释里提 addAll 作历史说明是允许的，故不查全文，只认 install 的写法。
  assert.ok(
    sw.includes("Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))"),
    "安装应逐个缓存（Promise.allSettled + cache.add），不用原子失败的 cache.addAll()"
  );
for (const entry of shell) {
assert.equal(
fs.existsSync(new URL(`../${entry.slice(2)}`, import.meta.url)),
true,
`APP_SHELL 缺失文件：${entry}`
);
}
});

test("【契约】sw.js 离线壳（反向）：index.html 引用的本地 CSS/JS 都在 APP_SHELL 内", () => {
const refs = readLocalCssJsRefs(html);
assert.ok(refs.length > 0, "index.html 里应有本地 CSS/JS 引用");
// sw.js 头注释明文排除：supabase-config.js 只存在于用户本地部署，进壳会让全新部署安装失败。
// 排除本身也是契约：注释丢了、文件却仍在壳外，测试要报出来。
const excluded = ["./supabase-config.js"];
assert.ok(
sw.includes("supabase-config.js"),
"sw.js 应注明排除 supabase-config.js 的原因"
);
for (const ref of refs) {
if (excluded.includes(ref)) {
assert.ok(!shell.includes(ref), `${ref} 应按注释排除在 APP_SHELL 外`);
continue;
}
assert.ok(shell.includes(ref), `index.html 引用的 ${ref} 不在 APP_SHELL 内，离线会断`);
}
});

test("【契约】版本号唯一事实来源：package.json 与 sw.js 缓存名 / 页眉 / utils.js APP_VERSION 一致", () => {
const { version} = pkg;
assert.match(version, /^\d+\.\d+\.\d+$/, "package.json version 应为 x.y.z");
assert.ok(sw.includes(`bid-assistant-v${version}`), `sw.js CACHE_NAME 应为 bid-assistant-v${version}`);
assert.ok(html.includes(`v${version}`), `index.html 页眉应含 v${version}`);
const utils = fs.readFileSync(new URL("../js/utils.js", import.meta.url), "utf8");
assert.ok(utils.includes(`APP_VERSION = "${version}"`), `js/utils.js APP_VERSION 应为 "${version}"`);
});

test("【契约】版本号一致：README / docs/notes.md / docs/changelog.md 与 package.json 同步", () => {
const { version} = pkg;
for (const file of ["README.md", "docs/notes.md"]) {
const text = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
assert.ok(text.includes(`v${version}`), `${file} 应含 v${version}`);
}
const changelog = fs.readFileSync(new URL("../docs/changelog.md", import.meta.url), "utf8");
assert.ok(changelog.includes(`## [${version}]`), `docs/changelog.md 应有 ## [${version}] 标题`);
});
