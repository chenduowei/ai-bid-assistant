/**
 * 构建时根据环境变量生成 supabase-config.js
 * 供 Vercel / 本地 npm run build 使用。
 *
 * 环境变量（任选一组命名）：
 *   SUPABASE_URL  或  VITE_SUPABASE_URL  或  NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_ANON_KEY  或  VITE_SUPABASE_ANON_KEY  或  NEXT_PUBLIC_SUPABASE_ANON_KEY
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

if (!url || !anonKey) {
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
