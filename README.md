# 🤖 AI Bid Assistant

> 面向工程建设行业标书人员的智能投标工作台

AI Bid Assistant 是一个结合 **项目管理 + 招标文件解析 + AI 风险分析** 的投标辅助工具。

它来自真实工程投标场景：

- 招标文件复杂，关键信息分散
- 开标节点容易遗漏
- 资格要求、废标条款需要反复检查
- 大量重复整理工作消耗时间

本项目希望帮助标书人员：

> 把机械重复的整理工作交给工具，把时间留给更重要的判断与决策。

当前版本：**v0.2.5**

当前阶段以 **稳定使用、真实反馈、持续优化体验** 为主，暂不盲目扩展功能。

---

# ✨ 功能概览

## 📋 项目管理工作台

集中管理日常投标项目：

- 开标时间
- 招标单位
- 投标公司
- 项目类型
- 联系人
- 保证金 / 保函
- 项目金额
- 项目状态（报名中 / 制作中 / 已开标）
- 项目备注

支持：

- 🔍 多字段搜索
- 🏷️ 状态筛选
- ↕️ 排序管理
- 📊 结果数量统计
- ⏰ 开标提醒（支持自定义提前天数，默认 7 天）
- 📌 自动定位即将开标项目并高亮
- 🔔 浏览器通知提醒
- 📤 CSV 数据导出
- 🌙 深色模式

---

## 🔐 账号与云端数据

基于 Supabase 构建：

- 用户注册 / 登录
- 云端数据同步
- Realtime 实时更新
- Row Level Security（RLS）用户数据隔离

每个用户只能访问自己的项目数据。

---

## 📄 招标文件解析 + AI 分析

帮助快速理解招标文件重点内容。

功能包括：

- 浏览器端 PDF 文本提取
  - 文件不会上传到本项目服务器
- 支持 OpenAI 兼容 API
- 自动提取：

  - 开标时间
  - 招标单位
  - 项目金额
  - 保证金要求
  - 资格条件
  - 废标条款

AI 辅助能力：

- 资格要求结构化展示
- 废标风险条款整理
- 长文档分块摘要
- AI 分析失败自动重试
- 风险摘要生成
- 风险点回填项目表单
- 项目卡片展示风险提示

> AI 负责整理信息，最终判断仍由专业人员完成。

---

# 🏗️ 技术架构

```
浏览器

HTML / CSS / JavaScript
ES Modules

│
├── utils
├── auth
├── projects
├── pdf-parser
├── ai-extract
└── ui

        │

        ▼

Supabase

├── Authentication
├── PostgreSQL Database
├── Realtime
└── Row Level Security

        │

        ▼

用户自备 OpenAI 兼容 API

(API Key 仅保存在本机)
```

---

# 📂 项目结构

```
ai-bid-assistant

├── index.html
├── app.js
├── styles.css

├── js/
│   ├── utils.js
│   ├── auth.js
│   ├── projects.js
│   ├── pdf-parser.js
│   ├── ai-extract.js
│   └── ui.js

├── supabase.sql

├── supabase-config.example.js
├── supabase-config.js

├── scripts/
│   └── generate-config.mjs

└── docs/
    ├── changelog.md
    └── notes.md
```

| 文件 | 说明 |
|---|---|
| `index.html` / `app.js` / `styles.css` | 页面入口与基础样式 |
| `js/*.js` | 核心业务模块 |
| `supabase.sql` | 数据库结构、RLS、安全策略 |
| `supabase-config.example.js` | 配置模板 |
| `supabase-config.js` | 本地配置文件（勿提交） |
| `scripts/generate-config.mjs` | Vercel 部署配置生成 |
| `docs/` | 项目维护文档 |

---

# 🚀 本地运行

## 1. 克隆项目

```bash
git clone https://github.com/chenduowei/ai-bid-assistant.git

cd ai-bid-assistant
```

## 2. 配置 Supabase

复制配置模板：

```bash
cp supabase-config.example.js supabase-config.js
```

编辑：

```
supabase-config.js
```

填入：

- Supabase Project URL
- anon key

---

## 3. 初始化数据库

进入 Supabase：

```
SQL Editor
```

执行：

```
supabase.sql
```

其中包含：

- 数据表结构
- 用户隔离策略
- 增量迁移

---

## 4. 启动项目

使用：

- VS Code Live Server
- 或任意静态 HTTP 服务器

注意：

不要直接使用：

```
file://
```

打开页面。

ES Modules 需要通过 HTTP 环境运行。

---

## AI 功能（可选）

登录后：

进入「设置」

填写：

- API Key
- Base URL
- 模型名称

AI Key：

- 仅保存于浏览器 localStorage
- 不经过本项目服务器

---

# ☁️ 部署到 Vercel

## 安全原则

不要将任何真实密钥提交到 Git。

部署时通过环境变量生成配置。

---

## 部署步骤

### 1. 推送代码

确保仓库包含：

```
package.json
scripts/generate-config.mjs
vercel.json
```

并确认：

```
supabase-config.js
```

没有提交。

---

### 2. Vercel 配置

导入 GitHub 仓库：

Framework：

```
Other
```

Build Command：

```
npm run build
```

---

### 3. 添加环境变量

| 名称 | 说明 |
|-|-|
| `SUPABASE_URL` | Supabase 项目地址 |
| `SUPABASE_ANON_KEY` | anon / publishable key |

---

### 4. 配置 Supabase 登录回调

进入：

```
Authentication → URL Configuration
```

配置：

- Site URL
- Redirect URLs

填写：

- Vercel 部署地址
- 本地开发地址

---

# 🔒 安全说明

- 浏览器端仅使用 Supabase **anon key**
- 禁止暴露 `service_role key`
- `supabase-config.js` 已加入 `.gitignore`
- AI Key 仅存储于用户本机
- 项目没有后端服务器，不收集用户 AI 密钥

---

# 📚 文档

- [changelog.md](docs/changelog.md)  
  项目版本变化记录

- [notes.md](docs/notes.md)  
  模块说明与维护记录

---

# 💡 项目理念

AI 不应该只是聊天工具。

真正有价值的方向，是让 AI 融入具体行业流程：

> 用 AI 改造真实工作，而不是为了 AI 而做 AI。

AI Bid Assistant 希望成为工程建设行业人员自己的智能工作助手。

---

# 📄 License

MIT License