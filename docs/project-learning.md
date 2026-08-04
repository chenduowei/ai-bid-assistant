# AI Bid Assistant 学习笔记

## 项目目标

帮助标书员管理投标项目，并利用 AI 分析招标文件、提示废标风险。

---

## 当前技术栈

| 层级 | 技术 |
|------|------|
| 前端 | HTML + CSS + JavaScript（ES modules） |
| 后端即服务 | Supabase（Auth / Postgres / Realtime / RLS） |
| AI | 用户自备 OpenAI 兼容 API（Key 存 localStorage） |
| PDF | pdf.js（浏览器端提取文本，不上传） |

---

## 目录与模块职责

```
index.html          页面结构
app.js              入口：状态、事件绑定、模块组装
styles.css          样式
supabase.sql        表结构与 RLS、增量迁移
supabase-config.js  本地密钥（gitignore）

js/utils.js         日期/倒计时/状态样式等工具
js/auth.js          登录注册与会话
js/projects.js      CRUD、迁移、导出、Realtime
js/pdf-parser.js    PDF 文本提取
js/ai-extract.js    LLM 抽取与风险结构化
js/ui.js            列表/统计/搜索/高亮等渲染
```

---

## 核心业务流程

### 项目管理

1. 表单收集：开标时间、投标公司、类型、联系人、保证金、状态、名称、备注  
2. `app.js` → `projects.js` 写入 Supabase `projects` 表  
3. Realtime 或重新 `loadProjects` 刷新列表  

### 即将开标定位

1. `getReminder` 筛出 7 天内待开标项目  
2. 用户点击 upcoming 条目（`data-id`）  
3. `focusProjectInList`：清空筛选 → `render` → `scrollIntoView` + 高亮  

### 搜索与筛选

- 关键词匹配：开标时间（原始与中文显示）、投标公司、类型、联系人、保证金、名称、备注、状态  
- 状态下拉独立筛选  
- 展示「共 N 个」或「筛选结果：M 个（共 N 个）」  

### AI 分析

1. PDF → 纯文本（pdf.js）  
2. 调用兼容接口 `/chat/completions`，要求输出固定 JSON  
3. 回填表单；保存时写入 `risk_summary` / `risk_points` / `extracted_meta`  

---

## 数据库要点

- `projects`：按 `user_id` RLS 隔离  
- `status`：仅 `报名中 | 制作中 | 已开标`  
- `bidding_company`：投标公司  
- AI 可选字段：`risk_summary`、`risk_points`（jsonb）、`extracted_meta`（jsonb）  

旧库需执行 `supabase.sql` 文末增量迁移。

---

## 安全注意

- 只把 **anon key** 放在前端；**绝不**提交 `service_role`  
- `supabase-config.js` 必须在 `.gitignore` 中  
- AI API Key 只存本机，不经过本项目服务器  

---

## 迭代备忘（2026-08）

- v0.2：模块化、密钥隔离、AI 首版、投标公司、三态状态  
- v0.2.2：表单顺序、即将开标点击定位、多字段搜索与结果计数  

下一步可优先：招标单位/金额字段、大文件分块摘要、资料库雏形。
