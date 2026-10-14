// 关页开标提醒 Edge Function（v0.2.7 准备，未部署时不生效）。
//
// 背景：浏览器 Notification + setInterval 只在页面打开时触发，关页后不会提醒。
// 本函数由 pg_cron / Supabase Scheduled Functions 每小时调用一次，
// 找出今日 / 明日开标且未删除的项目，去重后发邮件。
//
// 部署前需要：
//   1. 在 Supabase SQL Editor 执行 supabase.sql（含 notification_log 表）。
//   2. supabase secrets set RESEND_API_KEY=... FROM_EMAIL=...
//      （RESEND_API_KEY 需在 https://resend.com 申请；不用 Resend 可把 sendEmail 换成自己的邮件服务）
//   3. supabase functions deploy send-bid-reminders
//   4. 用 pg_cron 每小时调一次：
//        select cron.schedule('send-bid-reminders-hourly', '0 * * * *',
//          $$ select net.http_post('https://<PROJECT>.supabase.co/functions/v1/send-bid-reminders',
//            '{}'::jsonb, '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb) $$);
//      注意：不要把 service_role key 提交到仓库。
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "AI Bid Assistant <noreply@example.com>";

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

serve(async () => {
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(url, serviceKey);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const toISODate = (d: Date) => d.toISOString().slice(0, 10);

    const { data: projects, error } = await supabase
      .from("projects")
      .select("id, user_id, name, bid_date, status")
      .is("deleted_at", null)
      .neq("status", "已开标")
      .in("bid_date", [toISODate(today), toISODate(tomorrow)]);
    if (error) throw error;

    let sent = 0;
    for (const p of projects ?? []) {
      const stage = p.bid_date === toISODate(today) ? "today" : "tomorrow";
      // 去重：同一项目同一阶段只发一次（notification_log 唯一约束兜底）
      const { data: logged } = await supabase
        .from("notification_log")
        .select("id")
        .eq("user_id", p.user_id)
        .eq("project_id", p.id)
        .eq("stage", stage)
        .maybeSingle();
      if (logged) continue;
      // 取收件邮箱（Auth Admin）
      const { data: userData } = await supabase.auth.admin.getUserById(p.user_id);
      const email = userData?.user?.email;
      if (!email) continue;
      const label = stage === "today" ? "今日开标" : "明日开标";
      await sendEmail(
        email,
        `开标提醒：${p.name}（${label}）`,
        `<p>项目「${p.name}」${label}，开标时间：${p.bid_date}，请及时核对。</p>`,
      );
      await supabase.from("notification_log").insert({
        user_id: p.user_id,
        project_id: p.id,
        stage,
      });
      sent++;
    }
    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
