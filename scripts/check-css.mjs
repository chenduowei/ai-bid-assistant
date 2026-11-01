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
const bracesOk = (stripped.match(/{/g) || []).length === (stripped.match(/}/g) || []).length;
if (!bracesOk) {
  console.error(`CSS 大括号不平衡：${target}`);
  process.exit(1);
}
if (bad && bad.length) {
  console.error(`CSS 声明丢分号 ${bad.length} 处（示例）：`);
  for (const b of bad.slice(0, 5)) console.error(`  ${b.trim().slice(0, 90)}`);
  process.exit(1);
}
console.log(`CSS 校验通过：${target}`);
