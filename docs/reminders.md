# 开标提醒说明

## 现状：浏览器通知只在页面打开时有效

当前提醒靠 `app.js` 的 `setInterval` + `new Notification`：

- 页面打开时，每分钟检查一次，今日 / 明日开标的项目弹浏览器通知。
- **关闭页面后不会提醒。** 没有 Service Worker 推送，也没有后端定时任务。

为避免用户误以为“关了页面也能提醒”，前端已做两点诚实化处理：

1. 设置面板与“即将开标”列表文案明确写了“仅页面打开时触发”。
2. 下次打开时补提示：已过开标时间但状态仍不是“已开标”的项目（最近 7 天内），会弹一次 Toast 提醒核对（每个会话只提示一次，见 `js/utils.js` 的 `getMissedBidProjects`）。

## 如需关页也提醒：部署 Edge Function

代码已准备好，位置：`supabase/functions/send-bid-reminders/index.ts`，未部署时不生效。

步骤：

1. 在 Supabase SQL Editor 执行 `supabase.sql`（含 `notification_log` 表，用于同一项目同一阶段只发一次）。
2. 配置 Secrets（不要提交到仓库）：
   - `RESEND_API_KEY`：在 https://resend.com 申请
   - `FROM_EMAIL`：发件人，如 `AI Bid Assistant <noreply@example.com>`
3. 部署函数：`supabase functions deploy send-bid-reminders`
4. 用 pg_cron 每小时调用一次该函数（调用时需带 service_role key 的 Authorization，见函数文件头注释）。

不想用 Resend 时，把函数里的 `sendEmail` 换成自己的邮件服务即可，`notification_log` 去重逻辑不用改。
