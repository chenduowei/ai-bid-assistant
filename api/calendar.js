// v0.33.0：.ics 日历订阅端点 —— Vercel serverless 函数（免费额度内）。
// 日历 App（苹果日历等）定期拉取此 URL；凭 token 只读该用户的待开标项目。
// 鉴权不走用户 JWT（会过期）：App 生成随机令牌存 calendar_tokens 表，
// 服务端凭令牌调 SECURITY DEFINER 函数 get_calendar_projects（supabase.sql 第 10 节）。
// 路由注意：vercel.json 把 /(.*) 重写到 /index.html，但 Vercel 先匹配文件系统
// （api/ 下的函数优先于重写），/api/calendar 仍会走到本函数；上线后用 curl 验。
import { buildCalendarIcs } from "../js/ics.js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "";
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

export default async function handler(req, res) {
  const token = req.query?.token;
  if (!token || typeof token !== "string") {
    return res.status(400).send("missing token");
  }
  if (!SUPABASE_URL || !ANON_KEY) {
    return res.status(500).send("server not configured");
  }
  let rpc;
  try {
    rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_calendar_projects`, {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_token: token }),
    });
  } catch {
    return res.status(502).send("upstream error");
  }
  if (!rpc.ok) {
    // 常见原因：第 10 节 SQL 还没执行（函数不存在，PostgREST 报 404）。
    return res.status(502).send("upstream error");
  }
  const rows = await rpc.json();
  const ics = buildCalendarIcs(Array.isArray(rows) ? rows : []);
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  return res.status(200).send(ics);
}
