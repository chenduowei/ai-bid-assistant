# Changelog

> 版本历史记录。当前稳定版为 **v0.2.5**，以长期使用为主。

## [0.2.5] - 2026-08-06

### Added
- **可配置开标提醒天数**：设置面板可调整 1–30 天（默认 7），写入 localStorage；即将开标列表、顶部提示与浏览器通知窗口同步。

### Changed
- 设置入口文案改为「设置」，面板标题为「偏好与 AI 设置」。
- **移动端密度优化**（≤680px）：缩小页面/卡片内边距，表单与列表更紧凑，统计改为 2 列，操作按钮自适应铺满，减弱 hover 位移。

## [0.2.4] - 2026-08-06

### Added
- **招标单位（tenderer）**、**项目金额（amount）** 字段：表单、列表、搜索、CSV 导出、数据库列。
- **结构化资格要求 / 废标条款**：独立 `qualification`、`invalid_bid_clauses`（jsonb），不再默认拼进备注。
- **AI 长文档分块摘要**：超长招标文件先分块摘要再汇总抽取。
- **AI 结果校验 + 失败重试一次**：关键字段为空时自动重试。
- **`.gitignore`**：排除 `supabase-config.js`、环境变量与编辑器文件。

### Changed
- AI System Prompt 增加 tenderer / amount；分析结果面板展示资格与废标列表。
- 项目卡片「风险报告」扩展为「风险与条款」，展示结构化列表。

### Database
- 增量迁移：`tenderer`、`amount`、`qualification`、`invalid_bid_clauses`（见 `supabase.sql`）。

## [0.2.3] - 2026-08-04

### Added
- **Vercel 部署支持**：`scripts/generate-config.mjs` 在构建时从环境变量写入 `supabase-config.js`；新增 `package.json`、`vercel.json`。
- 环境变量：`SUPABASE_URL`、`SUPABASE_ANON_KEY`（无需把真实 key 提交到 Git）。

## [0.2.2] - 2026-08-04

### Added
- **即将开标 → 列表定位**：点击「即将开标项目」中的条目，自动滚动到项目列表对应卡片并高亮约 2 秒；若当前搜索/状态筛选会隐藏该项目，会先清空筛选以保证可见。
- **搜索范围扩展**：支持按开标时间、投标公司、项目类型、联系人、保证金/保函、项目名称、备注检索（亦保留状态匹配）。
- **筛选结果计数**：搜索框下方显示「共 N 个项目」或「筛选结果：M 个（共 N 个）」。

### Changed
- 新增/编辑表单字段顺序：开标时间 → 投标公司 → 项目类型 → 联系人 → 保证金/保函 → 项目状态 → 项目名称 → 备注。

## [0.2.1] - 2026-08-04

### Changed
- **项目状态恢复为三态下拉**：报名中 / 制作中 / 已开标（与初版一致）。

### Added
- **投标公司**字段：表单必填、列表展示、搜索与 CSV 导出；数据库列 `bidding_company`。

## [0.2.0] - 2026-08-04

### Security
- 真实 Supabase Key 移出仓库：新增 `supabase-config.example.js`，本地使用 `supabase-config.js`（已加入 `.gitignore`）。
- 新增根目录 `.gitignore`，排除配置、环境变量与编辑器文件。

### Added
- **AI 招标文件分析**：解析 PDF 后可调用 OpenAI 兼容接口，抽取开标时间、保证金、资格要求、废标条款，生成风险摘要与风险点列表，回填表单并写入项目。
- **风险报告卡片**：项目列表中展示 `risk_summary` 与 `risk_points`。
- **AI 设置面板**：本机保存 API Key / Base URL / Model（localStorage）。
- **代码模块化**：拆分为 `js/utils.js`、`auth.js`、`projects.js`、`pdf-parser.js`、`ai-extract.js`、`ui.js`，入口 `app.js` 使用 ES modules。
- 数据库字段：`risk_summary`、`risk_points`、`extracted_meta`（见 `supabase.sql` 增量迁移）。

### Changed
- 编辑项目时表单面板高亮 + 平滑滚动，便于长列表中定位。
- 每分钟仅更新倒计时 DOM，不再全量 `render()`，降低项目较多时的开销。
- 移动端 Header 改为折叠菜单（☰），减少按钮拥挤。

### Docs
- 新增 `docs/changelog.md`、`docs/todo.md`。

## [0.1.0] - 初始版本

- 用户注册 / 登录（Supabase Auth）
- 项目 CRUD、Realtime 同步、本地数据迁移
- 统计、即将开标提醒、浏览器通知
- 搜索 / 筛选 / 排序、CSV 导出
- 深色模式、PDF 客户端文本提取
