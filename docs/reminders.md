# 开标提醒说明

两种提醒并存：页面内的浏览器通知（默认，无需配置），和 v0.33.0 起的 .ics 日历订阅（关页也能提醒，靠手机系统日历）。邮件提醒的 Edge Function 代码仍在仓库里，但没有部署。

## 一、浏览器通知：只在页面打开时有效

靠 `app.js` 的 `setInterval` + `new Notification`：

- 页面打开时，每分钟检查一次，今日 / 明日开标的项目弹浏览器通知。
- **关闭页面后不会提醒。** 没有 Service Worker 推送，也没有后端定时任务。

为避免用户误以为“关了页面也能提醒”，前端已做两点诚实化处理：

1. 设置面板与“即将开标”列表文案明确写了“仅页面打开时触发”，并指向「📅 日历订阅」。
2. 下次打开时补提示：已过开标时间但状态仍不是“已开标”的项目（最近 7 天内），会弹一次 Toast 提醒核对（每个会话只提示一次，见 `js/utils.js` 的 `getMissedBidProjects`）。

## 二、.ics 日历订阅：关页也提醒（v0.33.0）

开标日同步到手机系统日历，由系统日历自己响铃，不依赖页面开着。

**怎么用**：登录后在菜单「数据」→「📅 日历订阅」生成订阅链接（形如 `https://<站点域名>/api/calendar?token=xxx`），复制到日历 App 里添加订阅日历。抽屉里可重新生成（旧链接立即失效）或停用订阅。

**前提**：先在 Supabase SQL Editor 执行 `supabase.sql` 第 10 节（`calendar_tokens` 令牌表 + `get_calendar_projects` 只读函数）。表没建时抽屉里会提示执行第 10 节。Vercel 上不需要额外配置：`api/calendar.js` 复用已有的 `SUPABASE_URL` / `SUPABASE_ANON_KEY`。

**实现**：

- `js/ics.js` 生成 iCalendar 文本（纯函数，单测 `tests/ics.test.js`）；`api/calendar.js` 是 Vercel 订阅函数，凭 URL 里的 token 调 `get_calendar_projects`，只返回未删除、开标日不早于今天的项目（按开标日升序）。
- 鉴权不走用户 JWT（会过期）：token 是随机串，存在 `calendar_tokens` 表，RLS 限定本人可见；函数把令牌当唯一凭证，令牌无效时返回空日历、不报错，避免暴露令牌是否存在。
- 事件为**全天事件**（只知道开标日期，不知道具体时刻），描述只写非空的项目类型、投标公司、招标单位、联系人、备注。
- 每个项目两个提醒，按北京时间固定换算成 UTC，中国无夏令时不会漂：开标前一天 09:00（前一天 01:00 UTC）与开标当天 08:00（当天 00:00 UTC）。
- 行超 75 字节按 RFC 5545 折行，不切开多字节字符。

**要知道的边界**：

- 同步频率由日历 App 决定，苹果日历默认每周拉一次（可手动刷新）；改完项目立刻刷新日历可能还看不到。
- 已同步到日历里的日程，停用订阅后不会自动消失。
- 订阅链接带令牌，拿到链接的人就能只读你的待开标项目摘要，别外传；泄露了就重新生成。

## 三、可选：邮件提醒（Edge Function，未部署）

代码在 `supabase/functions/send-bid-reminders/index.ts`，不部署就不生效。关页提醒已由上面的日历订阅覆盖，这一条只在想要邮件形式时才需要。

步骤：

1. 在 Supabase SQL Editor 执行 `supabase.sql`（含 `notification_log` 表，用于同一项目同一阶段只发一次）。
2. 配置 Secrets（不要提交到仓库）：
   - `RESEND_API_KEY`：在 https://resend.com 申请
   - `FROM_EMAIL`：发件人，如 `AI Bid Assistant <noreply@example.com>`
3. 部署函数：`supabase functions deploy send-bid-reminders`
4. 用 pg_cron 每小时调用一次该函数（调用时需带 service_role key 的 Authorization，见函数文件头注释）。

不想用 Resend 时，把函数里的 `sendEmail` 换成自己的邮件服务即可，`notification_log` 去重逻辑不用改。
