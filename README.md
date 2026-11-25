# 投标工作台 · BidDesk

轻量、克制、实用的工程投标台账与开标提醒工作台（当前版本：`v0.52.0`）。

## 核心功能

- **项目台账与状态流转**：按「报名中 / 制作中 / 已开标」快速筛选与切换状态，支持多关键字实时搜索（禁用浏览器误填充）。
- **开标倒计时与临期提醒**：自动计算开标倒计时，并在顶栏「临期提醒」抽屉汇总近期即将到期事项。
- **日历视图与 `.ics` 订阅**：月历视图直观查看排期，支持生成 `.ics` 日历订阅链接同步至 Apple / Android 日历。
- **保证金台账**：统计在途保证金与待退还清单，一键查看与核销。
- **实用效率工具**：列表一键复制「项目摘要」（项目名 / 开标时间 / 投标公司 / 联系人），支持 Excel / CSV 导入导出、JSON 备份恢复、我的资质与回收站。
- **云端同步与 PWA**：基于 Supabase 登录同步，支持深浅色外观切换与手机端 PWA 安装。

## 技术栈

- 原生 ES Modules（无构建打包依赖）+ CSS Grid / Flex 响应式布局
- Supabase Auth & Postgres 云端同步 + Service Worker 离线缓存
- Node.js 原生 `node:test` 单元测试（200+ 用例）与 GitHub Actions CI

## 在线体验

作者的部署实例：<https://chenduowei.vercel.app/>（2026-11-24 核实可访问，打开为登录页）。

本项目是个人单用户工作台，没有公开演示账号；想自己用请按下面步骤部署自己的实例。

## 本地运行与部署

1. 复制配置：`cp supabase-config.example.js supabase-config.js`，填入自己 Supabase 项目的 URL 与 anon key（Supabase 控制台 → Project Settings → API）。`supabase-config.js` 已在 `.gitignore` 中，不要提交。
2. 在 Supabase SQL Editor 执行 `supabase.sql`（新建或增量均可；旧库升级见「数据库迁移」）。
3. 本地运行：本项目是原生 ES Modules 静态站，无构建步骤，用任意静态服务器打开即可，例如 `npx serve .` 或 `python3 -m http.server`。
4. Vercel 部署：在 Vercel 项目设置里配置环境变量 `SUPABASE_URL`、`SUPABASE_ANON_KEY` 后 Redeploy；构建命令是 `npm run build`，即 `scripts/generate-config.mjs`，会按环境变量生成 `supabase-config.js`（无环境变量时写占位配置并告警）。

## 数据库迁移

`supabase.sql` 在 Supabase SQL Editor 执行：新建库一次性执行整份脚本；旧库执行文末「增量迁移」段（幂等，`if not exists`）。

增量迁移共 11 节：

1. 增加「投标公司」字段
2. `status` 恢复三态枚举（报名中 / 制作中 / 已开标）
3. AI 分析字段（历史遗留列，v0.50.0 起功能已移除）
4. v0.2.4：招标单位、项目金额、结构化资格 / 废标条款
5. 投标公司非空约束（仅确认无空值后可执行，默认不强制旧数据）
6. v0.2.7：软删除 + 关页提醒日志
7. v0.3.0：检查清单 + 结构化金额 / 保证金 + 多截止时间 + PDF 持久化
8. v0.4.0：保证金改为选填（仅放宽约束，无新列）
9. v0.29.0：企业资质库（`qualifications` 表）
10. v0.33.0：日历订阅令牌（`calendar_tokens` 表 + 只读函数 `get_calendar_projects`）
11. v0.35.0：精确开标时刻 + 中标结果（与 `docs/migrations/v0.35.0-bid-time-result.sql` 相同）

初始建表还包括 `projects`（项目台账）与 `notification_log`（关页提醒去重日志）；`qualifications` 与 `calendar_tokens` 在新建库时随整份脚本建表，旧库走第 9、10 节。

## 截图

> v0.52.0 实拍（2026-11-25，本地静态服务 + 无头 Chromium，390/768/1280 × 浅色/深色验收通过）：登录页桌面端 `auth-desktop.png`、登录页手机端 `mobile.png`、主界面桌面端 `desktop.png`、主界面手机端 `mobile-list.png`。登录页为深蓝蓝图指挥舱入口；主界面为暖纸底 + 深蓝主按钮。

## 数据与隐私

- 数据存在你自己的 Supabase 项目里（Postgres + RLS 按 `user_id` 隔离），不经过本仓库、不经过第三方服务器。
- 日历订阅链接带令牌，等同只读凭证，不要外传到公开地方；不用时在应用内重新生成（旧链接失效）或停用订阅。
- 备份（JSON 导出）默认不含企业资质库；恢复与重置账户也不碰资质库。
- 密钥只放本地 `supabase-config.js`（已忽略提交）或 Vercel 环境变量；`service_role` key 永不进浏览器。
