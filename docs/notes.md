# 维护说明

当前以 **v0.32.0 稳定使用** 为主。本文仅保留运行与改代码时需要的要点。

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
- v0.18.2：分块 48k 字符，分块摘要 2 路并行（429 退避重试 + 串行回退）；模型请求走流式 SSE 边收边推进度，中转不回 SSE 时自动回退非流式。
v0.19.0：解析抽屉三段式（解析→分析→回填/保存）：顶部「保存到项目」下拉框与「保存文本」按钮删除，AI 分析只展示、面板底部只剩「回填到表单」，保存方式由表单自己的保存按钮定；文本与结论合一存「保存到项目」；未绑定时目标在操作时就地选（回填默认新建项目）。
v0.20.0：回填按钮移到操作区「AI 分析」后（有结果才可用）；「保存到项目」与目标选择器删除，解析原文只在回填后的那次表单提交里一并存上；回填直达表单（未绑定新建、绑定进该项目编辑态、已在改同一张时不重填）；✕ 直接关抽屉、遮罩点一下也关；解析入口挪进表单顶部可选区。
v0.21.0：呼吸感（只动间距：行内操作、标题栏、定义列表、分区标题、搜索与工具栏、窄屏页边距各放宽一档）；README 重写为简单直接的说明，去表情符号与口号文案。
v0.22.0：回收站底部加「清空回收站」（空时禁用，确认框二次确认，一次批量彻底删除）；手机端打磨（窄屏页边距上下对称、卡片行与统计卡片内边距放宽、工具栏贴边对齐、底部 Tab 加高、输入框纵向内边距统一 12px）。
v0.23.0：八项打磨（备注回定义列表、列表行去空白、清空按钮置顶、窄屏名称两行布局、桌面回顶部、移动端菜单修复 + 回到底部、统计卡片各自成卡、品牌角标自适应）。
v0.24.0：浮钮根因修复（.page 入场动画 page-in 以 both 填充保留 translateY(0)，使 .page 成了 fixed 定位的包含块，浮钮被钉在页面内容底部——动画收尾改 transform: none；view-in 同改；阈值 400→200px）；品牌角标改正方形（64px/52px）；版本号从页脚移到页眉用户栏；README 加少量表情点缀。
v0.25.0：定位高亮改单次淡出（1.6s，终态透明，移除类名不再闪）；手机端名称改回两行 + 操作按钮铺满整行。
v0.26.0：浮钮真根因——删掉 `.page` 的 page-in 入场动画。v0.24.0 的“收尾改 none”实测无效：线上已是 v0.25.0，浮钮仍被钉在页面底部；fill 模式持有的动画值仍让 `.page` 成为 fixed 按钮的包含块。教训：不要给 `.page` 加带 transform 的动画；不要再把浮钮问题归因于 Service Worker 缓存（v0.25.0 已证实页眉版本号对得上仍不行）。另：手机端行内解析去 📄、间距再收紧、倒计时 pill 垂直居中。
v0.27.0：定位高亮按 iOS 风格重做——先淡入后淡出（2s ease-in-out，首尾透明），延迟 300ms 再挂类，连续点击先清旧定时器。
v0.28.0：数据安全三件套——重置前先自动下载备份（失败不执行）；恢复失败报进度 + 可撤销（恢复前快照被覆盖行、记本次写入 id）；导入去重（名称 + 开标时间 + 投标公司，中文名内空格视为手误去掉）。测试 63→66 个。
v0.32.0：①重置账户加打字确认——第二次点击后弹出确认框，须输入「确认重置」才启用确认按钮，通过后才自动下载备份并清空，输错 / 取消都不执行（confirmDialog 新增 requireTyping 选项，默认不影响其他确认框）；②项目列表顶部工具栏加「全部折叠」按钮（在“选择”旁边），一键清掉所有展开的卡片，只重建受影响的卡片（走 v0.31.0 的定向渲染），没有展开的卡片时按钮不可点。测试仍 80 个（本次无新增纯函数）。
v0.31.0：P0 性能重构——写操作不再全量重拉 + 全量重渲染：保存 / 更新字段 / 删除 / 恢复 / 复制 / 导入成功后取回受影响的行（LIST_COLUMNS）本地合进 state.projects、刷新离线快照、定向渲染（只动受影响的卡片与统计，列表增量同步 DOM：缺失插入、移位挪过去、变了重建、多余移除，末尾“加载更多 / 到底啦”与筛选计数一并更新，新建与重建的卡片加 no-enter 不重播入场动画，焦点还给同款按钮）；Realtime 也改走增量应用（按 INSERT/UPDATE/DELETE 只动受影响的行，之前每次变更含自己保存的回声都全量重拉，等于每次保存拉两遍；收不到 payload 或行不完整时回落全量重拉）；资质库读写同样本地提交 + 只重绘资质列表；彻底删除的行本就不在主列表里，不再重拉；loadProjects 只留给首次加载 / 联网恢复 / 重置 / 恢复备份四种整库场景；删除失败时把折叠起来的行恢复原样。测试 77→80 个。
v0.30.0：P2 打磨批——备份 version 取 APP_VERSION（不再写死 0.8.0）、恢复注释纠错（重复 id 留第一条）、搜索框 aria-label、Toast 上限 3 条、倒计时每分钟刷新连颜色一起改、通知去重键 30 天过期清理、离线快照 7 天有效期 + 保存失败退化到最小快照、四处写入口补离线守卫（更新字段 / 恢复 / 彻底删除 / 复制）、回收站分页（50 条一页）、pdf.js 双源（cdnjs 挂了回退 jsdelivr，报错说人话）、底部“项目”Tab 从日历回来恢复列表滚动位置、定位与统计卡片清搜索时不再静默（目标可见时不清、清了说一声）、折叠详情懒生成（展开时才拼 HTML）、抽屉与确认框焦点陷阱、小按钮提到 36px、删死代码 formatCountdown。测试 75→77 个。
v0.29.0：P1 四件套——AI 终稿上限 8000（仅终稿）、截断识别与重试收窄（401/404/截断不重试）、表单草稿（localStorage，7 天，空表单/同项目编辑时问一次恢复）、定位卡片跳过入场动画、企业资质库对照（qualifications 表，supabase.sql 第 9 节；AI 终稿提示词里逐条判 matched/missing/unclear + match_note）。测试 66→75 个。
| `js/data-io.js` | 导出 / 备份 / 恢复 / 导入 / 模板 |
| `js/ui.js` | 列表/统计/搜索/高亮等渲染 |

---

## 数据与提醒

- 表 `projects`：`user_id` + RLS；状态仅 `报名中 | 制作中 | 已开标`；`deleted_at` 为空表示正常，非空表示在回收站（保留 30 天，过期自动彻底删除）。
- AI 相关列：`risk_summary`、`risk_points`、`qualification`、`invalid_bid_clauses`、`extracted_meta`（均为可选）。
- v0.3.0 新增列：`checklist`（jsonb，每项 `{id, text, done, source}`，source ∈ ai-invalid / ai-risk / manual）；`amount_value`（numeric）+ `amount_unit`（元/万元，默认万元）；`guarantee_amount`（numeric）+ `guarantee_unit`（元/万元，默认万元）+ `guarantee_status`（未缴纳/已缴纳/已退回/已没收，默认未缴纳）；`registration_deadline` / `inquiry_deadline` / `clarification_deadline` / `guarantee_deadline`（date，均可为空）；`pdf_text`（text，保存时截断到 200000 字符）+ `pdf_filename` + `pdf_parsed_at`。v0.18.1：`pdf_filename` 入库与读出时去掉末尾连拼的"（N 字）"后缀（半角括号也认），已污染的文件名下次保存即洗回；查看已保存文本的总页数从文本的"【第 N 页】"标记取最大值，无标记显示"未知"。旧 `amount` / `guarantee` 文本列保留，新字段为空时列表显示旧文本。
- v0.4.0 无新列，但保证金改为选填：`guarantee` 列已改为可为空并去掉长度校验（`supabase.sql` 第 8 节，旧库需执行一次，幂等）。列表查询为显式列清单（排除 `pdf_text`，全文按需拉）；搜索框 input 防抖 200ms；必填为开标时间、项目类型、项目名称、投标公司、联系人（保证金/金额均选填）。
- v0.4.2 无新列、无约束变更，旧库无需执行任何 SQL。登录页为左右分栏（海报底图（内联于 styles.css 的 WebP data URI，因推送通道不支持二进制） 海报 + `.auth-split` 布局），移动端 <900px 海报变顶部横幅；列表头部默认显示项目类型，保证金（金额+状态）在详情区与项目金额同行。
- v0.4.1 无新列、无约束变更，旧库无需执行任何 SQL。列表卡片改为两段式折叠（头部 + 详情），展开态在 `app.js` 的 `state.expandedIds`（Set）内存维护；排序默认 `date-desc`（`#sortBy` 默认选中 + ui.js 两处 fallback）；styles.css 顶部有 `[hidden] { display: none !important; }` 全局规则（修复 display:flex 覆盖 hidden 的占位问题）；`.project-item` 用 `content-visibility: auto` 优化长列表。
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

- v0.4.4：iOS 式丝滑 UI（--ease-spring/--ease-out 动效语言、SF 字体栈、transform/opacity 动效、prefers-reduced-motion）。新增/编辑表单折叠重做成 CTA 头（图标徽章＋/✎、编辑副标题显示项目名、展开/收起胶囊按钮，grid 高度动画）；项目卡片详情同样改 grid 高度动画；按钮按压缩放、卡片 hover 上浮、输入框 focus 光环、toast 移到底部中央、倒计时等宽数字。海报图仍内联于 styles.css。无迁移。
- v0.4.3：新增/编辑表单默认折叠（标题点击展开/收起；编辑、AI 回填时自动展开并聚焦；保存/取消后自动收起）。全站文案精修（准确、简洁、术语统一）。性能：卡片入场 stagger 收敛到 96ms 内、scroll 监听 rAF 节流。无迁移。
- v0.5.0：全站 iOS 重做（systemGroupedBackground 配色、32/20/15/13 字阶、16px 圆角 hairline 无投影）。页头改大标题 + 数据副标题；统计改单分组卡片；即将开标改横向 urgency 卡片；表单改 iOS 分组（必填/选填）；工具栏改 iOS 搜索框 + segmented 筛选；列表行回舒适高度（约 60px）；详情区改定义列表；iOS tint 按钮行。无迁移。
- v0.5.1：修复折叠空白带（collapse-inner 边距只在展开时应用，收起零残留）；搜索图标改内联 SVG；编辑/复制/删除移到行头部右侧两行（按钮优先于折叠切换，防误触）；kv 行 7px 12px、表单面板 16px 收紧。无迁移。
- v0.6.0：批量删除（选择模式 + 全选当前筛选 + deleteProjects 一次 update）；设置危险区重置账户（双重确认，只删当前用户 projects + notification_log）；选填信息独立折叠（AI/编辑有值自动展开）；列表到底趣味文案；导出 CSV 开标时间第一列。无迁移。
- v0.4.6：紧凑 iOS 式列表（分组大圆角 + hairline 行，cell 两行封顶约 50px：状态圆点 + 名称/一句话 + 倒计时 pill + chevron；徽章移到详情区；pill 文案精简）。全站密度收紧（panel/header/upcoming）。无迁移。
- v0.8.0：功能五件套——一键备份（直连 Supabase 全量含回收站 + 30 天备份提醒条）/ 开标日历视图（周一起始、紧急度圆点、点日看当天项目、点项目回列表定位）/ 保证金待退还清单（折叠面板 + 在途保证金卡片联动、复用 mark-refunded）/ PWA（manifest + sw.js 应用壳缓存 + 图标）/ Excel 导入（SheetJS 0.18.5 + SRI、第一张表转 CSV 复用校验）。无迁移。
- v0.7.0：UI 五件套——视图切换过渡（view-enter）、删除退出动画（.leaving + 高度收拢）、header 收纳（下拉菜单）、统计卡片可点击筛选 + count-up、深色浮层 --surface-raised、工具栏 sticky 毛玻璃。无迁移。
