// CSS 回归校验
// v0.10.1：间距/字号声明丢分号 —— 防止后面一条声明被吞掉
//   （v0.10.0 教训：迁移脚本漏了分号，139 处中大量声明被吞，全站布局连锁错乱）。
// v0.35.0：同一断点的媒体查询不超过 2 处 —— 680px 曾散在 7 个块里，改窄屏样式容易只改到一处。
// v0.35.3：跨断点顺序覆盖 —— 同一选择器在某个 max-width 块里写过的属性，若在文件更靠后的位置
//   又以无条件（或更宽的 max-width）规则写了一遍，后出现者胜，那块断点样式永远不生效。
//   v0.35.2 手机端「底部导航 / 浮动新增 / 统计卡标签 / 3 列网格」四条优化失效，全是这一类。
// 用法：npm run check:css（发版前必跑）；也可对单个文件跑：node scripts/check-css.mjs <path>。
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** 去掉注释（保留换行，行号不变）与 url(...) 内容。 */
function stripForScan(raw) {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/url\([^)]*\)/g, "url()");
}

/** 把声明块拆成 [属性, 值] 列表（尊重括号与引号，不误切 data: / 渐变里的分号）。 */
function parseDecls(text) {
  const out = [];
  let buf = "";
  let depth = 0;
  let quote = "";
  for (const ch of text) {
    if (quote) {
      buf += ch;
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === ";" && depth === 0) {
      out.push(buf);
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push(buf);
  return out
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx < 0) return null;
      const prop = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (!prop) return null;
      return {
        prop,
        value,
        important: /!important\s*$/i.test(value),
        normValue: value.replace(/\s+/g, " ").replace(/!important\s*$/i, "").trim(),
      };
    })
    .filter(Boolean);
}

const normalizeSelector = (sel) => sel.replace(/\s+/g, " ").trim();

/**
 * 极简 CSS 解析：只关心「选择器 + 声明 + 所在的媒体条件」，够本文件的两项检查用。
 * 返回按文件顺序排列的规则数组：{ selector, media: [条件…], line, decls: [...] }
 */
export function parseCssRules(raw) {
  const src = stripForScan(raw);
  const rules = [];
  const stack = [];
  let i = 0;
  let line = 1;
  let prelude = "";
  let preludeLine = 1;
  const bumpLine = (chunk) => (chunk.match(/\n/g) || []).length;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\n") {
      line++;
      i++;
      continue;
    }
    if (ch === "{") {
      const head = prelude.trim();
      const media = stack.filter((s) => s.kind === "media").map((s) => s.cond);
      const inKeyframes = stack.some((s) => s.kind === "keyframes");
      if (head.startsWith("@")) {
        const kind = /^@(?:-\w+-)?keyframes/i.test(head)
          ? "keyframes"
          : /^@media/i.test(head)
            ? "media"
            : "at";
        stack.push({
          kind,
          cond: kind === "media" ? head.replace(/^@media/i, "").trim() : head,
        });
        prelude = "";
        i++;
        continue;
      }
      // 声明块：本项目的样式表没有嵌套声明块，扫到配对的 '}' 即可
      let j = i + 1;
      let depth = 1;
      while (j < src.length && depth > 0) {
        if (src[j] === "{") depth++;
        else if (src[j] === "}") depth--;
        j++;
      }
      const chunk = src.slice(i, j);
      if (!inKeyframes) {
        rules.push({
          selector: normalizeSelector(head),
          media,
          line: preludeLine,
          decls: parseDecls(chunk.slice(1, chunk.length - 1)),
        });
      }
      line += bumpLine(chunk);
      i = j;
      prelude = "";
      preludeLine = line;
      continue;
    }
    if (ch === "}") {
      stack.pop();
      prelude = "";
      i++;
      preludeLine = line;
      continue;
    }
    if (ch === ";") {
      prelude = "";
      i++;
      preludeLine = line;
      continue;
    }
    if (!prelude.trim()) preludeLine = line;
    prelude += ch;
    i++;
  }
  return rules;
}

/** `(max-width: 680px)` → 680；不是单一 max-width 条件（含 min-width / and）则返回 null。 */
function maxWidthOf(media) {
  if (media.length !== 1) return null;
  const m = /^\(\s*max-width\s*:\s*([\d.]+)px\s*\)$/i.exec(media[0].trim());
  return m ? Number(m[1]) : null;
}

/**
 * 跨断点顺序覆盖检查。
 * 1) max-width 块里写过的属性，在文件更后面又被无条件规则写过 → 该断点样式永远不生效；
 * 2) 窄断点（680）被后面更宽的断点（980）写过同一个属性 → 窄断点永远不生效。
 */
export function findCascadeOverrides(raw) {
  const rules = parseCssRules(raw);
  const problems = [];
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const width = maxWidthOf(rule.media);
    if (width === null) continue;
    for (const decl of rule.decls) {
      if (decl.important) continue; // 带 !important 的不会被普通规则盖掉
      for (let j = i + 1; j < rules.length; j++) {
        const later = rules[j];
        if (later.selector !== rule.selector) continue;
        const laterDecl = later.decls.find((d) => d.prop === decl.prop);
        if (!laterDecl) continue;
        if (laterDecl.normValue === decl.normValue) continue; // 同值，无害
        const laterWidth = later.media.length === 0 ? Infinity : maxWidthOf(later.media);
        if (laterWidth === null) continue; // 另一种条件（如 max-height / prefers-*），不比较
        if (!(laterWidth >= width)) continue; // 更窄的断点写在后面是正常的覆盖
        problems.push({
          selector: rule.selector,
          prop: decl.prop,
          mediaLine: rule.line,
          mediaCond: rule.media.join(" and "),
          laterLine: later.line,
          laterCond: later.media.length ? later.media.join(" and ") : "（无条件）",
        });
        break; // 同一属性只报第一处
      }
    }
  }
  return problems;
}

/** 供测试与主流程共用的整体分析。 */
export function analyzeCss(raw) {
  const stripped = stripForScan(raw);
  const bad =
    stripped.match(
      /(?:padding|margin|gap)(?:-(?:top|right|bottom|left))?\s*:[^;}{]*?(?=\s*[a-z-]+\s*:)/g
    ) || [];
  const mediaCounts = new Map();
  // v0.35.3：同一断点按「完整条件」算（`(max-width:900px)` 与
  // `(max-width:900px) and (max-height:720px)` 是两个不同断点，不该合并计数）。
  for (const m of stripped.matchAll(/@media([^{]+)\{/g)) {
    const cond = m[1].replace(/\s+/g, " ").trim();
    mediaCounts.set(cond, (mediaCounts.get(cond) || 0) + 1);
  }
  const spread = [...mediaCounts.entries()].filter(([, n]) => n > 2);
  const bracesOk =
    (stripped.match(/{/g) || []).length === (stripped.match(/}/g) || []).length;
  return { bad, spread, bracesOk, overrides: findCascadeOverrides(raw) };
}

function main() {
  const target = process.argv[2] || join(root, "styles.css");
  const raw = readFileSync(target, "utf8");
  const { bad, spread, bracesOk, overrides } = analyzeCss(raw);
  if (!bracesOk) {
    console.error(`CSS 大括号不平衡：${target}`);
    process.exit(1);
  }
  if (spread.length) {
    console.error(`同一断点的媒体查询超过 2 处（请合并到已有块里）：`);
    for (const [cond, n] of spread) console.error(`  @media ${cond} × ${n}`);
    process.exit(1);
  }
  if (bad.length) {
    console.error(`CSS 声明丢分号 ${bad.length} 处（示例）：`);
    for (const b of bad.slice(0, 5)) console.error(`  ${b.trim().slice(0, 90)}`);
    process.exit(1);
  }
  if (overrides.length) {
    console.error(
      `CSS 跨断点顺序覆盖 ${overrides.length} 处（断点里的样式会被后面的规则盖掉）：`
    );
    for (const o of overrides.slice(0, 10)) {
      console.error(
        `  ${o.selector} { ${o.prop} }：@media (${o.mediaCond}) 第 ${o.mediaLine} 行，` +
          `被第 ${o.laterLine} 行的 @media (${o.laterCond}) 覆盖`
      );
    }
    process.exit(1);
  }
  console.log(`CSS 校验通过：${target}`);
}

const invokedPath = process.argv[1] ? fileURLToPath(import.meta.url) === process.argv[1] : false;
if (invokedPath) main();
