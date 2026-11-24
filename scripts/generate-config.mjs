/**
 * 构建时根据环境变量生成 supabase-config.js
 * 供 Vercel / 本地 npm run build 使用。
 *
 * 环境变量（任选一组命名）：
 *   SUPABASE_URL  或  VITE_SUPABASE_URL  或  NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_ANON_KEY  或  VITE_SUPABASE_ANON_KEY  或  NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * 严格模式：`node scripts/generate-config.mjs --strict`（或 NODE_ENV=production / VERCEL_ENV=production）
 * 时缺变量即报错退出，不写占位配置。生产构建必须用严格模式。
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "supabase-config.js");

const url =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "";

const anonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

const strict =
  process.argv.includes("--strict") ||
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL_ENV === "production";

if (!url || !anonKey) {
  const missing = [!url ? "SUPABASE_URL" : null, !anonKey ? "SUPABASE_ANON_KEY" : null]
    .filter(Boolean)
    .join(" / ");
  if (strict) {
    console.error(
      `[generate-config] 缺少 ${missing}，严格模式下拒绝写入占位配置，构建失败。`
    );
    process.exit(1);
  }
  console.warn(
    "[generate-config] 未检测到 SUPABASE_URL / SUPABASE_ANON_KEY，将写入占位配置。线上登录会提示填写配置。"
  );
}

const safeUrl = url || "https://YOUR_PROJECT.supabase.co";
const safeKey = anonKey || "YOUR_ANON_OR_PUBLISHABLE_KEY";

const content = `/*
 * 由 scripts/generate-config.mjs 在构建时自动生成，请勿手改后提交。
 * 本地开发可直接编辑本文件；Vercel 部署请在项目 Settings → Environment Variables 中配置。
 */
window.SUPABASE_CONFIG = {
  url: ${JSON.stringify(safeUrl)},
  anonKey: ${JSON.stringify(safeKey)},
};
`;

writeFileSync(outPath, content, "utf8");
console.log("[generate-config] 已写入", outPath);
if (url && anonKey) {
  console.log("[generate-config] 已注入 Supabase URL 与 anon key。");
}
