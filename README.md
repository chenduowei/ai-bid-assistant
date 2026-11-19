# 📋 投标工作台

面向工程建设标书人员的项目管理与招标文件分析工具。管理项目、解析招标文件、让 AI 整理风险与资格要求。

当前版本：v0.35.0

## ✨ 能做什么

- **🗂️ 项目管理**：开标日期与时刻（选填，倒计时可精确到小时）、项目类型、投标公司、联系人、保证金、项目金额、状态与备注；详情区点一下即改状态。多截止时间（报名、质疑、澄清、保证金缴纳）与即将到期提醒。
- **🏁 中标结果与中标率**：开标后记「已中标 / 未中标」，列表可按结果筛选，工具栏直接算中标率。
- **📄 招标文件解析**：PDF 在浏览器本地解析，文件本身不上传。AI 抽取开标时间、资格要求、废标条款与风险点，每条带页码原文，逐条可核对。
- **↩️ 回填表单**：分析结果核对后回填到项目表单，确认后保存。解析原文随表单保存一并存入，之后可直接查看，不用重新传文件。
- **💰 保证金台账与废标检查清单**：保证金按金额、单位与缴纳状态记账，在途金额单独统计；AI 抽出的废标条款可转成逐项勾选的清单。
- **🔄 数据进出**：CSV 导出、一键备份与恢复（默认不含招标全文，可勾选包含）、导入模板；开标日历视图与日历搜索；深色模式；可装到手机桌面（PWA）。

## 🔒 数据去向

- PDF 文件本身在浏览器内解析，不上传。解析文字随表单保存后存入 Supabase（`pdf_text` 字段，截断到 20 万字符），列表平时不拉取全文。
- AI 分析时，解析文字会发给用户自己配置的模型服务商（OpenAI 兼容接口）。
- API Key 只存在本机浏览器 localStorage，不经过本项目后端。项目数据存 Supabase，以 Row Level Security 按用户隔离。
- 需自备 Supabase、API Key、API Base URL 与模型名，不提供统一模型服务。
- 扫描版 / 图片 PDF 没有文本层，工具会提示先用 OCR 转文字，暂不内置 OCR。
- 浏览器通知只在页面打开时生效。需要关页也提醒，用菜单「视图」→「📅 日历订阅」：把待开标项目同步到手机系统日历，开标前一天 9 点与当天 8 点各提醒一次。订阅为全天事件（只知道开标日期），同步频率由日历 App 决定；订阅链接带令牌，拿到链接就能只读该账户的待开标项目（名称、开标日、类型、公司、联系人、备注），别外传。

## 🚀 本地运行

```bash
git clone https://github.com/chenduowei/ai-bid-assistant.git
cd ai-bid-assistant
cp supabase-config.example.js supabase-config.js
```

填入 Supabase Project URL 与 anon key，然后在 Supabase SQL Editor 执行 `supabase.sql`（建表与用户隔离策略）。

用任意静态 HTTP 服务器启动，例如 VS Code Live Server。不要用 `file://` 直接打开，ES Modules 需要 HTTP 环境。

登录后在设置（☰ 菜单 →「⚙️ 设置」）里填写 API Key、Base URL 与模型名，即可用 AI 分析。

## ☁️ 部署到 Vercel

导入 GitHub 仓库，Framework 选 Other，Build Command 用 `npm run build`。添加环境变量 `SUPABASE_URL` 与 `SUPABASE_ANON_KEY`。不要把真实密钥提交到 Git，`supabase-config.js` 已在 `.gitignore` 中。

在 Supabase Authentication → URL Configuration 里配置 Site URL 与 Redirect URLs（Vercel 地址与本地开发地址）。

**升级到 v0.35.0 需执行一次** `docs/migrations/v0.35.0-bid-time-result.sql`（新增 `bid_time` / `result` 两列并更新订阅函数，幂等）。不执行也能打开，前端会先探测这两列、自动退回旧字段，只是「开标时刻 / 中标结果」存不进去（会有提示）。

日历订阅复用上面两个环境变量，不用额外配置；在 Supabase SQL Editor 执行 `supabase.sql` 第 10 节（`calendar_tokens` 令牌表 + 只读函数）后，登录 App 打开「📅 日历订阅」生成链接即可。表没建时抽屉里会提示先执行第 10 节。

## 🗂️ 项目结构

```
index.html / app.js / styles.css   页面入口、状态与事件、样式
js/                                业务模块（auth、projects、pdf-parser、ai-extract、data-io、drawers、ui、utils、ics）
vendor/                            随仓库分发的第三方库（supabase-js；CDN 只作兜底）
assets/                            登录页海报等静态图
api/                               服务端函数（calendar.js：.ics 日历订阅端点）
tests/                             测试（AI 抽取、流式、分块、分页、快照、懒加载、日历订阅、工具函数）
.github/workflows/ci.yml           每次推送自动跑测试与版本、样式校验
supabase.sql                       数据库结构、RLS、安全策略
scripts/                           部署配置生成、版本与样式校验
docs/                              changelog 与维护说明
```

## 📚 文档

- [changelog](docs/changelog.md)：版本变化记录
- [notes](docs/notes.md)：模块说明与维护记录
- [reminders](docs/reminders.md)：开标提醒的现状与可选做法
- [todo](docs/todo.md)：待办与暂不做

## License

MIT
