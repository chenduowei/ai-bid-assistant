/**
 * v0.51.4 batch2b：CSS 锚点辅助 —— 测试读 CSS 不再直读单文件 styles.css，
 * 而是读「按 index.html <link> 加载顺序拼接的 bundle」。
 * 本批只换锚点逻辑，不拆 CSS：当前 index.html 只引一个 styles.css，
 * 拼接结果与原来逐字节一致（单文件时 join 不加分隔符）。
 * 第 3 批拆 CSS 时：往 index.html 里按顺序加 <link> 即可，调用方一行不用改；
 * 若某天需要脱离 index.html 指定顺序，可直接传文件列表给 readCssBundle()。
 * 注意：本文件不是测试（不以 .test.js 结尾），`node --test tests/` 不会把它当测试跑。
 */
import { readFileSync } from "node:fs";

const rootUrl = (rel) => new URL(`../${rel}`, import.meta.url);

/** index.html 里 <link rel="stylesheet"> 的本地 href（按出现顺序，即浏览器加载顺序）。 */
export function listCssBundleFiles() {
  const html = readFileSync(rootUrl("index.html"), "utf8");
  const files = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/rel=["']stylesheet["']/i.test(tag)) continue;
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href || /^(https?:)?\/\//i.test(href) || href.startsWith("data:")) continue;
    files.push(href.replace(/^\.\//, ""));
  }
  if (!files.length)
    throw new Error("index.html 里找不到本地 stylesheet <link>，CSS bundle 为空");
  return files;
}

/** 按加载顺序拼接的 CSS 全文；不传 files 时从 index.html 推导（默认行为）。 */
export function readCssBundle(files = listCssBundleFiles()) {
  return files.map((f) => readFileSync(rootUrl(f), "utf8")).join("\n");
}
