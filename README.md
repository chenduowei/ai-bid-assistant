# 🤖 AI Bid Assistant

> 一个面向工程建设行业标书人员的智能投标工作助手。

AI Bid Assistant 致力于帮助投标人员管理项目流程、整理投标信息，并逐步引入 AI 能力，实现招标文件分析、风险检查、资料管理和标书辅助生成。

这个项目来源于真实工作场景：

每天面对大量招标文件、项目节点、资格要求和重复性工作，很多信息需要人工整理，容易遗漏关键内容。

因此，我尝试利用 AI 和软件技术，打造一个属于标书人员自己的智能工作台。

---

## 📌 项目愿景

未来希望 AI Bid Assistant 可以帮助标书人员：

* 📄 自动解析招标文件
* 🔍 提取关键投标信息
* ⚠️ 检查废标风险
* 📋 管理投标项目流程
* 📚 建立企业投标知识库
* ✍️ 辅助生成技术方案和商务文件

目标不是替代标书人员，而是让专业人员把更多精力放在真正需要判断和决策的工作上。

---

# ✨ 当前功能

## ✅ 项目管理

* 字段：开标时间、投标公司、项目类型、联系人、保证金/保函、项目状态（报名中 / 制作中 / 已开标）、项目名称、备注
* 多字段搜索（开标时间、投标公司、类型、联系人、保证金、名称、备注）+ 状态筛选 + 排序
* 搜索/筛选结果数量显示
* 即将开标提醒：点击条目可定位到项目列表并高亮
* 浏览器开标通知、CSV 导出

## ✅ 用户系统

基于 Supabase Auth：注册、登录、用户数据隔离（RLS）

## ✅ 云端数据存储

Supabase：项目数据保存、Realtime 同步

## ✅ 招标文件解析 + AI 分析

* 浏览器端 PDF 文本提取（不上传）
* 调用 OpenAI 兼容接口：抽取开标时间、保证金、资格要求、废标条款
* 生成风险摘要与风险点，回填表单并在项目卡片展示风险报告

## 🚧 规划中

* 招标文件云端归档
* 企业资料库
* AI 标书章节辅助生成

---

# 🏗️ 技术架构

```
Frontend (ES modules)
│
├── HTML / CSS / JavaScript
│   └── js/utils · auth · projects · pdf-parser · ai-extract · ui
│
▼
Supabase
├── Authentication
├── Database (+ RLS)
└── Storage（规划中）

▼
AI Service（用户自备 OpenAI 兼容 API）
├── 招标文件解析
├── 风险分析
└── 内容生成（规划中）
```

---

# 📂 项目结构

```
ai-bid-assistant
├── index.html
├── app.js                 # 入口（type=module）
├── styles.css
├── supabase-config.example.js   # 配置模板（可提交）
├── supabase-config.js           # 本地真实配置（gitignore，勿提交）
├── supabase.sql
├── js/
│   ├── utils.js
│   ├── auth.js
│   ├── projects.js
│   ├── pdf-parser.js
│   ├── ai-extract.js
│   └── ui.js
├── docs/
│   ├── project-learning.md
│   ├── changelog.md
│   └── todo.md
├── .gitignore
└── README.md
```

---

# 🚀 本地运行

## 1. 克隆项目

```bash
git clone https://github.com/chenduowei/ai-bid-assistant.git
cd ai-bid-assistant
```

## 2. 配置 Supabase

1. 创建 Supabase 项目，配置 Database 与 Authentication。
2. 在 SQL Editor 中执行 `supabase.sql`（含增量迁移）。
3. 复制配置模板并填入真实值：

```bash
cp supabase-config.example.js supabase-config.js
```

编辑 `supabase-config.js`，填入 Project URL 与 anon/publishable key。  
**不要把填好真实 key 的文件提交到公开仓库。**

## 3. 启动

纯前端项目，使用 VS Code Live Server 或任意静态服务器即可。  
注意：ES modules 需要通过 HTTP 访问（不能直接 `file://` 打开）。

## 4. AI 功能（可选）

登录后点击「AI 设置」，填写兼容 OpenAI 的 API Key、Base URL、模型名。  
Key 仅存在本机 localStorage。

---

# 📖 文档

* [changelog.md](docs/changelog.md) — 版本记录
* [todo.md](docs/todo.md) — 可执行任务列表
* [project-learning.md](docs/project-learning.md) — 学习笔记

---

# 🗺️ Roadmap

## v0.1 - 项目管理基础 ✅

## v0.2 - 体验优化 + AI 分析首版 ✅（主体完成）

* 模块化、密钥隔离、移动端菜单
* 投标公司、三态状态、表单顺序与列表交互
* PDF + LLM 抽取与风险报告
* 即将开标定位、多字段搜索与结果计数

## v0.3 - 资料库与云端文件

## v1.0 - 智能投标工作平台

详见 [docs/todo.md](docs/todo.md)。

---

# 💡 为什么做这个项目？

我是一个工程建设行业的投标工作人员，同时也是计算机专业毕业生。

行业人员懂业务，但缺少技术能力；程序员懂技术，但不了解投标流程。  
AI 时代提供了一个机会：让行业经验与软件技术结合。

> 用 AI 改造真实工作，而不是为了 AI 而做 AI。

---

# 📄 License

MIT License
