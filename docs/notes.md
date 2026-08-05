# 维护说明

当前以 **v0.2.5 稳定使用** 为主，新功能开发暂停。本文仅保留运行与改代码时需要的要点。

---

## 模块职责

| 文件 | 职责 |
|------|------|
| `app.js` | 状态、事件绑定、模块组装 |
| `js/utils.js` | 日期/倒计时、提醒天数、主题与本地存储 key |
| `js/auth.js` | 登录注册与会话 |
| `js/projects.js` | CRUD、本地迁移、CSV 导出、Realtime |
| `js/pdf-parser.js` | 浏览器端 PDF 文本提取 |
| `js/ai-extract.js` | LLM 抽取、分块摘要、校验重试 |
| `js/ui.js` | 列表/统计/搜索/高亮等渲染 |

---

## 数据与提醒

- 表 `projects`：`user_id` + RLS；状态仅 `报名中 | 制作中 | 已开标`。
- AI 相关列：`risk_summary`、`risk_points`、`qualification`、`invalid_bid_clauses`、`extracted_meta`（均为可选）。
- 旧库升级：在 Supabase SQL Editor 执行 `supabase.sql` 中的增量迁移段。
- 开标提醒天数：本机 `localStorage` 键 `bid-assistant-reminder-days`（1–30，默认 7）。

---

## 运维检查清单

1. 本地：`cp supabase-config.example.js supabase-config.js` 并填入真实 URL / anon key。
2. 执行 `supabase.sql`（新建或增量均可）。
3. 若曾把真实 key 推到公开仓库，在 Supabase 控制台轮换 anon key。
4. 提交前确认 `supabase-config.js` 未被 Git 跟踪。
5. Vercel：配置 `SUPABASE_URL`、`SUPABASE_ANON_KEY` 后 Redeploy。

---

## 后续（暂缓）

使用一段时间、积累真实痛点后再考虑，例如：

- 招标文件云端归档、企业资料库
- 废标检查清单、分析历史对比
- 团队协作与权限
- 标书章节 AI 辅助生成

有明确需求时再拆任务，避免为扩功能而扩功能。
