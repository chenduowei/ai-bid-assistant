# 维护说明

当前以 **v0.4.0 稳定使用** 为主，新功能开发暂停。本文仅保留运行与改代码时需要的要点。

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

- 表 `projects`：`user_id` + RLS；状态仅 `报名中 | 制作中 | 已开标`；`deleted_at` 为空表示正常，非空表示在回收站（保留 30 天，过期自动彻底删除）。
- AI 相关列：`risk_summary`、`risk_points`、`qualification`、`invalid_bid_clauses`、`extracted_meta`（均为可选）。
- v0.3.0 新增列：`checklist`（jsonb，每项 `{id, text, done, source}`，source ∈ ai-invalid / ai-risk / manual）；`amount_value`（numeric）+ `amount_unit`（元/万元，默认万元）；`guarantee_amount`（numeric）+ `guarantee_unit`（元/万元，默认万元）+ `guarantee_status`（未缴纳/已缴纳/已退回/已没收，默认未缴纳）；`registration_deadline` / `inquiry_deadline` / `clarification_deadline` / `guarantee_deadline`（date，均可为空）；`pdf_text`（text，保存时截断到 200000 字符）+ `pdf_filename` + `pdf_parsed_at`。旧 `amount` / `guarantee` 文本列保留，新字段为空时列表显示旧文本。
- v0.4.0 无新列，但保证金改为选填：`guarantee` 列已改为可为空并去掉长度校验（`supabase.sql` 第 8 节，旧库需执行一次，幂等）。列表查询为显式列清单（排除 `pdf_text`，全文按需拉）；搜索框 input 防抖 200ms；必填为开标时间、项目类型、项目名称、投标公司、联系人（保证金/金额均选填）。
- 旧库升级：在 Supabase SQL Editor 执行 `supabase.sql` 中的增量迁移段。v0.2.7 必须执行 `deleted_at` + `notification_log` 迁移，否则回收站不可用（列表会自动降级）。v0.3.0 必须执行第 7 节迁移，否则清单 / 金额 / 截止时间 / PDF 保存会提示迁移错误（列表仍可正常显示，新字段取默认值）。v0.4.0 旧库需执行第 8 节放宽 `guarantee` 约束，否则空保证金保存会被数据库拒绝。
- 清单 / 金额 / 截止 / PDF 的局部更新走 `projects.js` 的 `updateProjectFields`（白名单字段 + `.eq("user_id", ...)`）。
- 开标提醒天数：本机 `localStorage` 键 `bid-assistant-reminder-days`（1–30，默认 7）。
- 提醒机制：浏览器通知仅在页面打开时触发，多截止项（报名 / 质疑 / 澄清 / 保证金 / 开标）days=0/1 时通知，文案带截止类型；错过提醒只看开标时间。关页提醒需部署 `supabase/functions/send-bid-reminders/`，见 `docs/reminders.md`（用户已明确暂不需要，暂不部署）。

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
- 分析历史对比
- 团队协作与权限
- 标书章节 AI 辅助生成

有明确需求时再拆任务，避免为扩功能而扩功能。
