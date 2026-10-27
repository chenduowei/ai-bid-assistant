# 维护说明

当前以 **v0.8.0 稳定使用** 为主。本文仅保留运行与改代码时需要的要点。

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
