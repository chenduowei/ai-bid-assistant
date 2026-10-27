# Changelog

> 版本历史记录。当前稳定版为 **v0.8.2**，以长期使用为主。

## [0.8.2] — 2026-10-27
- **修复 PWA 缓存钉住旧版**：v0.8.1 只改了页面、没改 sw.js，缓存名不变，浏览器一直用 v0.8.0 的缓存壳，刷新也看不到\"从备份恢复\"按钮；本次把缓存名升到 v0.8.2 并立下铁律——以后每次发版必须同步改 CACHE_NAME。
- 无需 Supabase 迁移。

## [0.8.1] — 2026-10-27
- **从备份恢复**：header 菜单\"从备份恢复\"，选 `ai-bid-backup-*.json` 文件恢复；校验三道关（JSON 有效、本应用备份、全部行属于当前账号），备份内重复 id 只留一条；无重叠直接补齐，有重叠时一次确认（确定 = 覆盖已有，取消 = 只补新增）；库里有、备份里没有的项目一律不动；恢复后自动刷新列表并提示新增 / 覆盖 / 跳过条数。
- 无需 Supabase 迁移。

## [0.8.0] — 2026-10-27
- **一键备份**：header 菜单"导出备份"，直接从 Supabase 拉当前用户全部 projects（含回收站，PDF 全文也在内），下载 `ai-bid-backup-YYYY-MM-DD.json`；30 天未备份时列表顶部出现可关闭提示条。
- **开标日历视图**：列表 / 日历 segmented 切换；周一起始月历，紧急度圆点（今天/过期红、3 天内橙、其他蓝），点日期看当天项目，点项目回到列表定位展开；响应状态筛选、忽略搜索关键词。
- **保证金待退还清单**：项目列表前新增折叠面板，列出已开标 + 已缴纳未退还项目，标记已退还复用原有更新路径；在途保证金统计卡片点击展开清单并滚动定位。
- **PWA**：manifest.json（投标工作台、standalone）+ 192/512 图标 + sw.js 应用壳缓存，手机可装到桌面；注册失败静默。
- **Excel 导入**：导入支持 .xlsx（SheetJS 0.18.5 + SRI 固定），第一张表按模板列名映射，转 CSV 复用现有校验；解析库加载失败时提示改用 CSV。
- 无需 Supabase 迁移。

## [0.7.0] — 2026-10-27
- **动效连贯化**：dashboard ↔ 解析视图切换加淡入上滑过渡；删除先淡出收拢（约 0.3s）再刷新；列表每次 render 均跑入场动画。
- **顶部收纳**：header 只留"新增项目"主按钮 + 菜单按钮 + 用户信息，深色/解析/设置/导出/导入/模板/退出收进下拉菜单（点击外部/Esc/点菜单按钮后关闭）。
- **统计卡片可点击**：前 4 张（总数/报名中/制作中/已开标）点击筛选对应状态并滚动到列表；数值变化 0.4s count-up；保证金卡片保持静态。
- **深色模式层级**：新增 --surface-raised（深色 #2C2C2E），toast/下拉菜单/parser header 用浮层表面 + 微阴影。
- **工具栏 sticky**：搜索 + 筛选 + 排序毛玻璃吸顶。
- 无需 Supabase 迁移。

## [0.6.0] — 2026-10-18
- **批量删除**：工具栏"选择"进入选择模式，iOS 圆形复选框；全选针对当前筛选结果；一次 confirm 移入回收站。
- **重置账户**：设置 → 危险区，双重确认（10 秒内有效），删除当前用户全部项目（含回收站）与通知记录。
- **选填信息默认折叠**：表单选填区独立折叠（显示字段数），编辑/AI 回填有值时自动展开。
- **列表到底趣味文案**：末尾轮换显示 3 条轻松文案。
- **导出 CSV**：开标时间移到第一列。
- 无需 Supabase 迁移（只用已有表的 update/delete）。

## [0.5.1] — 2026-10-18
- **修复折叠空白带**：`.collapse-inner` 的 padding/margin/border-top 改为只在展开时应用，收起后行与行之间只剩 hairline，零空白残留；展开/收起动画保留。
- **搜索图标**：`::before` 的 data-URI 放大镜改 index.html 内联 SVG，渲染更清晰。
- **行内操作按钮**：编辑/复制/删除从详情区底部移到行头部右侧（倒计时 pill + chevron 下方），文字按钮 iOS 风；点击/键盘防误触（按钮优先于折叠切换）。
- **布局收紧**：详情 kv 行 padding 7px 12px；表单面板内边距 16px、字段行 8px、分组标题间距收紧；行高由内容决定。
- 无功能变更，无需 Supabase 迁移。

## [0.5.0] — 2026-10-18
- **全站 UI 推倒重做（iOS 精美风）**：配色换 systemGroupedBackground 体系（浅色 #F2F2F7 / 深色 #000000，iOS 蓝 #007AFF / #0A84FF）；字阶 32/20/15/13；卡片 16px 圆角、hairline 分隔、无投影。
- 页头改 iOS 大标题（32px/800）+ 数据副标题（X 个进行中 · Y 个截止事项临近）。
- 统计改为单分组卡片 + hairline 分隔。
- 即将开标改横向 urgency 卡片（日期大数字 + 项目名 + pill），空状态给引导文案。
- 表单改 iOS 分组（必填/选填 section + hairline 行 + 无边框输入），提交按钮全宽 iOS 蓝。
- 工具栏：iOS 搜索框 + segmented 筛选 + 蓝色排序 select。
- 列表行回舒适高度（约 60px，状态圆点加微光圈）；详情区改 iOS 定义列表（label 左 / value 右）；操作按钮改 tint 行（编辑蓝 / 复制灰 / 删除红）。
- 回收站同风格（恢复蓝 / 彻底删除红）；列表空状态给大图标 + 引导按钮。
- 登录页卡片 iOS 化（登录/注册改 segmented）；Toast 微调；iOS 动效体系保留。
- 功能零回归，无需 Supabase 迁移。

## [0.4.6] — 2026-10-18
- **列表行高压缩**：折叠行从约 62px 压到约 50px（padding 11px→7px、字号/行高收紧、pill 缩小），一屏多看约 20% 项目；`contain-intrinsic-size` 同步更新。
- 无功能变更，无需 Supabase 迁移。

## [0.4.5] - 2026-10-18

主题：紧凑、高级、iOS 式（无数据库迁移，无新列，无后端变更）。

### Changed
- **项目列表行重做成 iOS 式 cell**：折叠行从"大标题 + 5 项 meta 换行"压缩为两行封顶（约 64px）——左侧 8px 状态圆点（报名中=蓝、制作中=橙、已开标=灰，深色模式适配），中间第一行项目名称（15px/600，单行截断）、第二行一句话（`M月d日开标 · 项目类型 · 投标公司`，12.5px muted，单行截断），右侧倒计时 pill（今天/过期=红系、≤3天=橙系、其他/已开标=灰系）+ chevron。原头部 5 项信息无一丢失：状态→圆点（徽章移到详情区保留）、开标/类型/公司→第二行、倒计时→ pill（文案精简为"今天开标/明天开标/还有X天/已过期X天/已开标"，去掉"倒计时："前缀）。
- **分组列表**：列表改为 iOS 设置式——单个大圆角容器 + hairline 分隔行（不再是独立卡片）；展开的详情区仍在行内展开；定位高亮改为内圈样式（容器 overflow 裁剪下外发光会丢失）。
- **全站密度收紧**：panel 内边距 24px→18px、标题 20px→18px、页头标题 30px→26px、upcoming 条目/列表工具栏/spacing 同步收紧；详情区内容不动。
- 折叠/展开、筛选/排序/分页、expandedIds、60s 倒计时刷新（只更新 pill 文字）行为不变。

### Database
- **无迁移。** v0.4.5 不新增字段、不改约束，旧库无需执行任何 SQL。

### Tests
- `npm test` 22/22 通过；全部 JS 文件 `node --check` 通过；新增 DOM 烟雾测试（/tmp/v045_smoke.mjs，4/4：cell 结构、pill 文案与 class、详情徽章与展开态、updateCountdowns）。

## [0.4.4] - 2026-10-18

主题：iOS / 苹果官网式丝滑 UI（无数据库迁移，无新列，无后端变更）。

### Changed
- **新增 / 编辑表单折叠重设计**：标题栏重做成 CTA 头——左侧图标徽章（accent 渐变圆角正方形，新增模式显示＋、编辑模式显示✎），中间标题 + 副标题（编辑模式副标题显示正在编辑的项目名前 12 字），右侧"展开 / 收起"胶囊按钮（chevron 旋转）。展开/收起改用 `grid-template-rows: 0fr → 1fr` 真实高度动画，替代 hidden 瞬时切换；aria-expanded、键盘操作、编辑/AI 回填自动展开、保存后自动收起等行为不变。
- **项目卡片折叠同样丝滑化**：详情区改用同一套 `.collapse` 高度动画；卡片 hover 上浮（-1px + 阴影加深），入场 stagger 保留收敛值、缓动换 spring。
- **全站动效语言统一**：新增 `--ease-spring: cubic-bezier(0.32, 0.72, 0, 1)` / `--ease-out` / `--dur-fast: 0.18s` / `--dur-med: 0.35s`；字体栈加入 SF Pro / PingFang SC；所有动效只用 transform / opacity；`prefers-reduced-motion` 时全局禁用动画。
- **微交互**：按钮按压缩放（scale 0.96）、主按钮微渐变、输入框 focus 光环（accent 边框 + 4px accent-soft）、toast 移到底部中央（深色胶囊，slide-up + spring）、倒计时数字等宽（tabular-nums）防跳动。
- 登录页海报底图仍以 data URI 内联于 styles.css（推送通道不支持二进制）。

### Database
- **无迁移。** v0.4.4 不新增字段、不改约束，旧库无需执行任何 SQL。

### Tests
- `npm test` 22/22 通过；全部 JS 文件 `node --check` 通过。

## [0.4.3] - 2026-10-17

三项改进（无数据库迁移，无新列，无后端变更）。

### Changed
- **新增 / 编辑表单默认折叠**：表单 section 标题栏可点击展开 / 收起（chevron + aria-expanded，样式与项目卡片折叠一致），默认收起。点击项目卡片"编辑"、AI 解析回填时自动展开并滚动定位、高亮、聚焦第一个输入框；保存成功或点"取消"后自动收起（校验失败保持展开）。
- **全站文案精修**：准确、简洁、术语统一。去掉"请"式客套（如"请先选择"→"先选择"）；修正不准确表述（如 header 的"保证金/保函"→"保证金"，表单说明明确列出 5 个必填项）；统一术语（项目列表/回收站/废标检查清单/保证金台账）；保留已有约束说明（浏览器通知仅页面打开时有效、删除进回收站保留 30 天、API Key 仅存本机）。
- **性能优化（低风险）**：卡片入场动画 stagger 从 `min(i*45,250)ms` 收敛到 `min(i*12,96)ms`；scroll 监听用 rAF 节流（已是 passive）；倒计时仍只更新文本节点；`content-visibility` 保留；登录页 data URI 海报仅 `.auth-poster` 使用，不污染其他页面。

### Database
- **无迁移。** v0.4.3 不新增字段、不改约束，旧库无需执行任何 SQL。

### Tests
- `npm test` 通过（测试内容未变：本次改动不涉及 utils 纯函数）。

## [0.4.2] - 2026-10-17

两处产品改动（无数据库迁移，无新列，无后端变更）。

### Changed
- **列表头部默认显示项目类型**：折叠列表头部的信息由"状态徽章、开标+倒计时、投标公司、保证金状态"改为"状态徽章、开标+倒计时、投标公司、项目类型"。保证金信息移到展开后的详情区（与项目金额同行显示），详情区原有的"保证金要求原文"显示保持不变。
- **登录界面加专业海报**：登录页改为左右分栏 — 左侧海报区（AI 生成的工程蓝图风底图 海报底图（内联于 styles.css 的 WebP data URI，因推送通道不支持二进制），深蓝主调、无文字，HTML 叠加文案：主标题"项目管理工作台"、英文小字"AI Bid Assistant · 工程建设投标工作台"、3 条卖点、底部小字"数据云端同步 · API Key 仅存本机"），右侧为登录卡片（登录/注册表单、忘记密码、重发验证、重置密码面板的 id 与 JS 逻辑全部不变）。移动端（<900px）海报变为顶部 220px 横幅，卖点与底部小字隐藏。深色模式兼容。

### Database
- **无迁移。** v0.4.2 不新增字段、不改约束，旧库无需执行任何 SQL。

### Tests
- `npm test` 通过（测试内容未变：本次改动不涉及 utils 纯函数）。

## [0.4.1] - 2026-10-16

用户真实使用反馈的 5 项改进（无数据库迁移，无新列，无后端变更）。

### Fixed
- **删除列表下方空白橙色方框**：根因是 `.deadline-tip` / `.refund-tip` 的 CSS 写了 `display: flex`，覆盖了 HTML `hidden` 属性的 UA 样式，无内容时仍显示空橙框占位。修复：在 styles.css 顶部基础样式区加全局规则 `[hidden] { display: none !important; }`，现有 display:flex 规则保留（有内容时仍 flex 布局）。`renderDeadlineTip` / `renderRefundReminder` 无内容时设 hidden=true，现在完全不占位。

### Changed
- **回收站移到最上面**：回收站 `<section>`（含 #toggleTrashBtn / #trashList）从项目列表之后移到“即将开标项目”之后、项目列表之前。id、按钮行为、文案不变。
- **开标日期默认最晚优先排序**：`#sortBy` 的 `date-desc` 设为默认选中；`js/ui.js` 两处默认值（`getFilteredProjects` 的 `filters.sort ||` 与 `getCurrentFilters` 的 `elements.sortBy?.value ||`）由 `"date-asc"` 改为 `"date-desc"`。数据流确认：`getCurrentFilters` 始终从 select 读值，fallback 只在 filters 缺 sort 时兜底，不会覆盖用户手动选择的排序。
- **项目列表折叠**：卡片改为两段式。头部（始终显示）：展开/收起 chevron、项目名称、状态徽章、开标日期 + 倒计时、投标公司、保证金状态小字；头部可点击（role=button，Enter/Space 也可切换），hover 高亮，chevron 平滑旋转 90°。详情区（默认折叠）：项目类型、招标单位、联系人、项目金额、保证金要求原文、4 个截止时间（选填有则显示）+ 最近截止、备注、风险卡片、检查清单、PDF 区、编辑/复制/删除按钮。展开态存在内存 `state.expandedIds`（Set）里，render / 筛选 / 排序 / 分页 / 保存后恢复不丢失；切换只更新对应卡片 DOM（toggle hidden + aria-expanded + .expanded 类），不全量 render，避免焦点丢失。点击委托排除详情区内的按钮/输入/勾选（详情区元素不含 `data-action="toggle-details"`，误触不可能）。`focusProjectInList` 定位时自动展开该项目。回收站列表（renderTrashItem）保持原样不折叠。
- **整体 UI 优化（专业简洁）**：收紧卡片内边距（18px→14px/16px）、圆角统一 16px、`.project-actions` / `.project-meta` 间距收紧、标题 18px→17px、提示横幅与空状态更克制（deadline-tip 加边框、字号 13px、圆角 12px；empty 内边距 24px）。保持现有 CSS 变量主题体系，不引入新配色，不改暗色模式逻辑。

### Performance
- **长列表渲染优化**：`.project-item` 加 `content-visibility: auto; contain-intrinsic-size: auto 140px;`，减少屏幕外卡片的布局/绘制开销。不改分页/查询逻辑，不改 `fetchProjectsPage`。

### Database
- **无迁移。** v0.4.1 不新增字段、不改约束，旧库无需执行任何 SQL。

### Tests
- `npm test` 通过（测试内容未变：utils 纯函数不受本次改动影响）。

## [0.4.0] - 2026-10-14

### Fixed
- **PDF 文本按需加载**：列表查询改为显式列清单，排除 `pdf_text`（v0.3.0 的 `select *` 会把每个项目最多 20 万字全文拉下来，列表越用越慢）。列表仍显示文件名 + 保存日期；点“查看已保存文本”时才按需拉单个项目的全文（`loadProjectPdfText`，合并进内存，不全量重拉）。列表卡片不再显示字数。
- **搜索防抖**：搜索框 `input` 加 200ms 防抖（`utils.js` 的 `debounce`，带 `.cancel()`）；筛选 / 排序 `change` 仍立即渲染；`focusProjectInList` 仍直接渲染，不走防抖。
- **金额 / 保证金统一**：新结构化字段为主，旧文本只做原文。保证金输入框改为“保证金要求原文（选填）”；项目金额表单已只有数值 + 单位（v0.3.0 起），旧 `amount` 文本仅在卡片里作兜底显示。保证金不再必填：必填改为开标时间、项目类型、项目名称、投标公司、联系人；保证金 / 金额均选填，都不填也可保存。AI 回填的保证金原文写入“保证金要求原文”框，金额数字仍进数值字段。

### Added
- **忘记密码 + 重发验证**：登录区新增“忘记密码？”（发重置链接，跳转回当前页）与“重发验证邮件”按钮；新增重置密码面板（新密码 + 确认 + 设置新密码 + 返回登录），`PASSWORD_RECOVERY` 事件触发时显示，设置成功后提示重新登录并退出当前会话。⚠️ 需在 Supabase Authentication → URL Configuration 里把部署地址加入 Redirect URLs，否则重置链接回跳会失败。
- **导入 CSV + 复制项目**：头部新增“📥 导入”（仅 CSV，不引 Excel 库）与“下载导入模板”按钮。`parseCsvProjects` 处理 BOM、引号内逗号/换行、`""` 转义；表头 19 列（见模板）；非法数值/日期清洗、非法状态回退（状态→“报名中”、保证金状态→“未缴纳”、单位→“万元”）；必填缺失行进错误列表不导入。导入分批 100 条 insert，完成后 toast 汇总（成功 N 条、跳过 M 条 + 前两条错误明细）。项目卡片新增“复制”按钮：名称 +“（副本）”、状态回到“报名中”、保证金状态回到“未缴纳”、清单全部未完成、PDF 字段清空，其余原样复制。
- **保证金退还提醒**：已缴纳 + 已开标 + 开标日期 ≤ 今天 + 金额 > 0 的项目，在顶部提示下方出横幅（最多列 3 个 + “标记已退回”按钮），点后 `guarantee_status` 置为“已退回”并重渲染。
- **导出补齐清单**：CSV 末尾新增 3 列：检查清单（已完成/总数）、检查清单详情（`[x] 文本1; [ ] 文本2`）、PDF 文件名；原有列顺序不变，仍导出当前筛选结果。

### Database
- **无新列。** 但保证金改为选填需要放宽旧约束：`supabase.sql` 第 8 节（幂等）把 `guarantee` 列改为可为空并去掉长度校验；新建库的 CREATE TABLE 已同步改为可为空。若旧库不执行第 8 节，空保证金保存会被数据库拒绝。`guarantee` 为空时应用层存 `null`。

### Tests
- `tests/utils.test.js` 新增 v0.4.0 用例：`debounce`（只执行最后一次 + `cancel`）、`parseCsvProjects`（BOM、引号逗号/换行、非法行、数值/日期清洗、空文件/无表头）、`buildImportCsvTemplate`（模板可被解析）、`getGuaranteeRefundReminders`（条件过滤 + 排序）。`npm test` 通过。

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
