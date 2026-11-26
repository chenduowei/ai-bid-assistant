# 安全政策

## 支持的版本

仅支持最新版（当前 `v1.0.2`）。旧版本不再修安全问题，请升级到最新版再报告。

## 报告漏洞

通过 GitHub Security Advisories 报告（仓库页面 → Security → Report a vulnerability），请勿直接开公开 Issue 披露漏洞细节。

报告时请写清：

- 受影响的版本（仅最新版会被修，见上文）
- 复现步骤（越具体越好，最好能给最小复现）
- 影响范围（能看到谁的数据、能做什么操作）
- 该问题是否已公开（如果已公开，请给链接）

收到报告后会先确认复现，再排期修复；修复完成前请勿公开细节。

## 已知边界

以下是在当前版本已知、尚未修复或有意保留的风险点，报告前请先看：

- **CSP 已切强制**：`vercel.json` 里的 CSP 自 batch3 起是 `Content-Security-Policy`（强制拦截，不再是 Report-Only）；收窄口径与 HSTS 实测见 `docs/notes.md`「安全头与 CSP」一节。HSTS 由 Vercel 平台默认下发，本仓未重复加。
- **日历订阅令牌长期有效且在 URL 里**：`.ics` 订阅链接形如 `/api/calendar?token=xxx`，令牌等同只读凭证，知道链接就能拉取该用户的待开标项目。不要把链接发到公开地方；不用时在应用内重新生成（旧链接失效）或停用订阅。令牌本身不设过期时间。
- **邮件提醒未部署**：`supabase/functions/send-bid-reminders/` 与 `docs/reminders.md` 仅作参考，未部署 Edge Function；关页提醒走 `.ics` 日历订阅，不要误以为邮件会提醒。
- **离线缓存**：Service Worker 只缓存同源应用壳；跨域请求（Supabase / CDN）一律走网络，不进缓存。

## 密钥处理

- 浏览器端只用 Supabase anon key；`service_role` key 永不进浏览器、永不进仓库。
- `supabase-config.js` 只放本地（已在 `.gitignore` 中）；Vercel 部署用环境变量 `SUPABASE_URL` / `SUPABASE_ANON_KEY`。
- 怀疑 anon key 泄露：在 Supabase 控制台轮换 key，并检查 `calendar_tokens` 是否需要重新生成。

## 不用报告的内容

- 下文「已知边界」里已列出的点（CSP 已切强制、日历令牌长期有效、邮件未部署），除非你发现了超出描述的新利用方式。
- 旧版本的问题：请先升级到最新版确认是否仍存在。
- 第三方服务本身的问题（如 Supabase、Vercel 的平台漏洞），请直接报告给对应厂商。

## 数据与隐私

- 数据存在用户自己的 Supabase 项目，行级安全策略（RLS）按 `user_id` 隔离；不要把别人的数据导进自己的库里测试。
- 备份（JSON 导出）默认不含企业资质库；恢复与重置账户也不碰资质库。
- 日历订阅的只读函数 `get_calendar_projects` 为 `SECURITY DEFINER`，凭令牌只返回未删除且开标日不早于今天的项目；令牌无效时返回空集，不报错。
