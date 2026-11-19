// v0.10.1：CSS 回归校验 —— 防止间距/字号声明丢分号导致后面一条声明被吞掉
// （v0.10.0 教训：迁移脚本漏了分号，139 处中大量声明被吞，全站布局连锁错乱）。
// 原理：去掉注释与 url(...) 内容后，扫描 padding/margin/gap 声明，
// 若其值后面直接跟了下一条属性而没有分号，即判定损坏。
// 用法：npm run check:css（发版前必跑）；也可对单个文件跑：node scripts/check-css.mjs <path>。
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = process.argv[2] || join(root, "styles.css");
const raw = readFileSync(target, "utf8");
const stripped = raw
  .replace(/\/\*.*?\*\//gs, "")
  .replace(/url\([^)]*\)/g, "url()");
const bad = stripped.match(
  /(?:padding|margin|gap)(?:-(?:top|right|bottom|left))?\s*:[^;}{]*?(?=\s*[a-z-]+\s*:)/g
);
// v0.35.0：同一断点的媒体查询不超过 2 处 —— 之前 680px 散在 7 个块里，
// 改窄屏样式时容易只改到一处（v0.35.0 已把它们合并成一块，这条防再次分散）。
const mediaCounts = new Map();
for (const m of stripped.matchAll(/@media\s*\(([^()]*)\)/g)) {
  const cond = m[1].trim();
  mediaCounts.set(cond, (mediaCounts.get(cond) || 0) + 1);
}
const spread = [...mediaCounts.entries()].filter(([, n]) => n > 2);
const bracesOk = (stripped.match(/{/g) || []).length === (stripped.match(/}/g) || []).length;
if (!bracesOk) {
  console.error(`CSS 大括号不平衡：${target}`);
  process.exit(1);
}
if (spread.length) {
  console.error(`同一断点的媒体查询超过 2 处（请合并到已有块里）：`);
  for (const [cond, n] of spread) console.error(`  @media (${cond}) × ${n}`);
  process.exit(1);
}
if (bad && bad.length) {
  console.error(`CSS 声明丢分号 ${bad.length} 处（示例）：`);
  for (const b of bad.slice(0, 5)) console.error(`  ${b.trim().slice(0, 90)}`);
  process.exit(1);
}
console.log(`CSS 校验通过：${target}`);
