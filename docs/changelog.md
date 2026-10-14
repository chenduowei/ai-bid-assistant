# Changelog

> 版本历史记录。当前稳定版为 **v0.3.0**，以长期使用为主。

## [0.3.0] - 2026-10-14

### Added
- **可执行废标检查清单**：项目卡片新增清单区（进度 `已完成 x/y` + 勾选 + 手动新增 + 删除 + “从 AI 结果生成清单”）。废标条款全转清单，high/medium 风险点转清单，低风险不转；生成时按文本去重，不覆盖已手动勾选的 done 状态。清单写入 `projects.checklist`（jsonb，每项 `{id, text, done, source}`）。
- **保证金台账（结构化）**：项目金额 / 保证金拆为数值 + 单位（元 / 万元）+ 保证金状态（未缴纳 / 已缴纳 / 已退回 / 已没收）。旧 `amount` / `guarantee` 文本列保留不删，新字段为空时显示旧文本。统计区新增第 5 张卡“在途保证金（万元）”（已缴纳合计，元按 ÷10000 折算）。CSV 导出新增 5 列：项目金额（数值）、项目金额单位、保证金金额、保证金单位、保证金状态。
- **多截止时间**：新增报名 / 质疑 / 澄清 / 保证金缴纳截止（均选填）。项目卡片显示“最近截止”；即将开标列表改为按全部截止项（报名 / 质疑 / 澄清 / 保证金 / 开标）排序展示；顶部提示与浏览器通知改为按全部截止项计算，通知文案带截止类型。错过提醒仍只看开标时间，不变。
- **PDF 文本持久化**：解析页新增项目下拉 + “保存文本到该项目”按钮，写入 `pdf_text` / `pdf_filename` / `pdf_parsed_at`（超长截断到 200000 字符并标注）。项目卡片显示已保存文件（文件名、字数、保存日期）+ “查看已保存文本”按钮，点击载入解析页，无需重新传 PDF。

### Database
- 增量迁移：`supabase.sql` 第 7 节（v0.3.0），全部 `add column if not exists`，`guarantee_status` / `amount_unit` / `guarantee_unit` 的 check 约束用 `DO ... EXCEPTION WHEN duplicate_object` 包裹，可重复执行。**升级前请先在 Supabase SQL Editor 执行该段迁移**，否则清单 / 金额 / 截止时间 / PDF 保存会提示迁移错误；旧库未迁移时列表仍可正常显示（新字段取默认值）。
- 清单 / 金额 / 截止 / PDF 的局部更新走 `updateProjectFields`（白名单字段 + `.eq("user_id", ...)`），报错含新列名时提示执行 v0.3.0 迁移。

### Tests
- `tests/utils.test.js` 新增 v0.3.0 用例：`normalizeChecklist`、`buildChecklistFromAi`、`getChecklistProgress`、`formatMoney`、`getGuaranteeTotals`、`getDeadlineItems` / `getNextDeadline` / `getUpcomingDeadlines`（正常 + 边界）。`npm test` 17/17 通过。

## [0.2.7] - 2026-10-14

### Fixed
- **提醒不再误导**：文案明确“浏览器通知仅在页面打开时触发”；下次打开时补提示最近 7 天内已过开标时间但状态仍不是“已开标”的项目（每个会话一次）。关页提醒的 Edge Function 代码已准备（`supabase/functions/send-bid-reminders/` + `docs/reminders.md`），未部署时不生效。
- **删除改软删除 + 回收站**：删除 = 移入回收站（`deleted_at`），保留 30 天，过期自动彻底删除；回收站支持恢复 / 彻底删除。数据库需执行 `supabase.sql` 的 v0.2.7 增量迁移（`deleted_at` + `notification_log`）。旧库未迁移时列表自动降级不过滤，回收站提示迁移。
- **PDF 解析竞态**：新增解析令牌，旧任务在每个 `await` 后检查令牌，作废后静默放弃、不写 UI、不弹失败提示；新文件会 `destroy` 旧加载任务；同一文件可重复选择（清空 `input`）。
- **纵深防御**：项目更新 / 删除 / 恢复 / 彻底删除均加上 `.eq("user_id", ...)`，不再只靠 RLS。

### Docs
- 新增 `docs/reminders.md`（提醒机制 + Edge Function 部署步骤）。
- `docs/notes.md` 版本号由 v0.2.5 同步到 v0.2.7。

## [0.2.6] - 2026-10-14

### Security
- **Supabase CDN 锁版本 + SRI**：`@supabase/supabase-js@2.117.3` + `integrity`，不再浮动大版本。
- **XSS 收口**：`ai-extract.js` 的 `escape()` 补单引号转义，风险等级改为白名单（high/medium/low）；`ui.js` 的 `data-id` 全部走 `escapeHtml`。
- **Vercel 安全头**：`X-Content-Type-Options` / `X-Frame-Options` / `Referrer-Policy` / `Permissions-Policy`。

### Fixed
- **分页加载**：`loadProjects()` 改为每页 500 条循环拉取，绕过 Supabase 单次 1000 条上限，项目多时不再静默丢数据。
- **AI 超时**：`callChat` 增加 120 秒 `AbortController` 超时 + `max_tokens: 4000`，网络卡死不再一直转圈。
- **AI 日期校验**：新增 `normalizeBidDate`，只接受真实存在的日期，支持 `YYYY-MM-DD / YYYY/MM/DD / YYYY年M月D日`，非法值不再塞进日期输入框。
- **扫描版 PDF 提示**：平均每页少于 20 字时判定为扫描版 / 图片 PDF，禁用 AI 按钮并提示先 OCR，避免模型对着空文本瞎编。
- **导出与筛选一致**：导出按钮改为导出当前筛选结果，不再总是全量。

### Added
- **测试**：新增 `tests/ai-extract.test.js`（Node 原生 test），`npm test` 可跑日期校验、JSON 解析、风险等级白名单等用例。
- **待办清单**：补 `docs/todo.md`（此前 changelog 引用但文件缺失）。

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
