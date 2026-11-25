# 维护说明

当前以 **v0.51.4 稳定使用** 为主。本文仅保留运行与改代码时需要的要点。

---

## 模块职责

| 文件 | 职责 |
|------|------|
| `app.js` | 状态、事件绑定、模块组装 |
| `js/utils.js` | 日期/倒计时、提醒天数、主题与本地存储 key |
| `js/auth.js` | 登录注册与会话 |
| `js/projects.js` | CRUD、本地迁移、CSV 导出、Realtime |
| `js/data-io.js` | 导出 / 备份 / 恢复 / 导入 / 模板 |
| `js/drawers.js` | v0.35.0：保证金 / 资质 / 日历订阅 / 回收站四个抽屉的事件与开关（从 app.js 抽出） |
| `js/ui.js` | 列表/统计/搜索/高亮等渲染 |
| `js/ics.js` | v0.33.0：.ics 日历文本生成（纯函数，单测覆盖） |
| `api/calendar.js` | v0.33.0：Vercel 订阅函数，凭令牌输出 .ics |
| `supabase/functions/` | 邮件提醒 Edge Function（未部署，见 `docs/reminders.md`） |

## 版本维护记录

- v0.51.4：Apple HIG 审美精修（不新增功能、不改交互）。① 色板：画布 `#F5F5F7`、白卡、`1px rgba(0,0,0,0.06)` hairline（深色 `rgba(255,255,255,0.08)`）、阴影 `0 1px 2px 0.03`；深色按 `#000/#1C1C1E/#2C2C2E` 分层。② 全站一支系统蓝：删掉品牌角标与表单角标的 `#5856D6` 蓝紫渐变；统计卡选中去顶部 2px 色条与手机端亮蓝描边，只留柔色底 + 蓝数值；截止/备份/保证金三条提示、风险报告、废标清单、临期卡片全部回中性底（彩色只留给胶囊、倒计时与等级标签）。③ 页头改吸顶毛玻璃应用栏（`position:sticky` + `saturate(180%) blur(20px)` + hairline 底边 + `color-mix(bg 94%)`），因此 `<header>` 移出 `#dashboardView`（网格项里的 sticky 没有滚动余地）、桌面网格模板去掉 header 行；页头高 71/79 → **80px**，`--appbar-h: 80px`（根/桌面/手机/平板四处同值），`.list-tools { top: var(--appbar-h) }`、定位 `scroll-margin-top` 加 80；页面上内边距 22/16 → 14/10，首卡 600 → 602（1440）/ 605 → 601（390）。④ 分段控件统一 iOS 写法（轨道 `rgba(118,118,128,0.12)`、白滑块 `#636366`（深色）、`0 1px 3px 0.12`、圆角 9/7）；搜索框填充灰 `rgba(118,118,128,0.10)` + 10px 圆角、聚焦才转白 + 3px 柔蓝光环；输入框白底 hairline 10px；按钮去 hover 上浮、按压 0.98。⑤ 排版：字族 `-apple-system / SF Pro Text / SF Pro Display / PingFang SC`，标题 800 → 600/700、字距 -0.018em，统计值/倒计时/日历号/临期日期/中标率/版本徽标 `tabular-nums`。⑥ 设置分组去掉内层描边（不再卡中卡）；日历今天只蓝数字、选中只柔蓝底。⑦ 平板 681–1023：品牌 64 → 46、标题 32 → 23、标题与副标题同基线，页头 108 → 80；320：标题 18px、版本徽标收窄，页头 81.8 → 80。⑧ 无头实测 6 尺寸 × 深浅色 × 7 视图 = 84 张，console error 0、pageerror 0、横向溢出 0；测试 182 → 190（`tests/apple-hig-v0359.test.js`）。
> 勘误（2026-11-24）：上条提到的「风险报告」「废标清单」是 v0.50.0 之前的功能，v0.50.0 已随 AI 解析一并移除（`renderRiskCard` 在 v0.51.0 彻底清除）；该条记录的是 v0.51.4 的配色收敛，不代表这些功能仍存在。
- v0.35.8：电脑端（Desktop）深度打磨 + 手机端两处微瑕。**桌面端此前一直是「放大的手机」**：1440×900 首张项目卡 top 1082px、一屏看不到一张卡；临期面板沿用手机横向滑动（卡片 557px 宽、scrollWidth 1710，1024/1440 下第二张被右缘切断且无提示）；表单 19 个字段全宽单列、每行 67px；详情 10 行单列右对齐；日历格 129×56 的空格子；菜单/设置/解析里 emoji 与线性图标混用。本轮：① 版式改「左列表 + 右信息栏」两栏（`@media (min-width:1024px)`，`#dashboardView` 用 `grid-template-areas: header/stats/list rail`，右栏 `.side-rail` 默认 `display:contents`、桌面成 flex 列），首卡 top 1082 → **592**（1440×900，一屏 5 张卡）、1280×800 592（4 张）、1024×768 655（2 张）；文档高 1925 → 1411。② 页头一行式应用栏：品牌 64 → 46、标题与副标题同一基线、同步状态/邮箱/版本收成 12px 一行，107 → 71px。③ 表单展开时用 `#dashboardView:has(.form-panel.expanded)` 把表单提到整行、`form-group` 改三列网格（项目名称 / 保证金原文占两列、备注整行）、字段 38px 高、输入框描边化，必填 9 项从 ~600px 收到 300px；收起时仍是一行卡待在右栏。④ 详情 `.kv-list` 两列（10 行 → 5 行）；临期事项竖排（卡片 310×59、无横向滚动）；工具栏 61 → 49px 单行（状态筛选不再拉满、视图切换靠右、`btn-text` 加 `min-height:32px` 拉齐文字基线）；搜索框与结果数同一行；三条提示条各一行。⑤ 抽屉：桌面统一 720 / 600（设置）/ 920（解析），标题栏 `position:sticky` 吸顶、关闭按钮改 30px 幽灵方块，解析拖拽区 240 → 150px。⑥ 日历格 56 → 72px、号码左上角、导航标题居中。⑦ 图标统一：菜单/设置/解析/提示条/清单标题/浮动按钮的 emoji 全换 1.7 线宽内联 SVG（`.ico`，主题按钮月亮/太阳由 `body.dark` 切换、`applyTheme` 只改 `.btn-label` 文字）。⑧ 风险等级不再印英文枚举（high/medium/low → 高/中/低，`js/ui.js` 与 `js/ai-extract.js` 两处同口径）。⑨ 手机端两处：长名称第三行露头（`line-height:1.32` 的 21.12px 行盒 < PingFang 字面高 1.4em，第三行字头从 42.2px 裁切边漏出 1.5px）→ 改 `line-height:1.4` + `max-height:2.8em`，卡片 126 → 127px、首卡 top 不变；风险条目「核对 + ×」包进 `.evidence-actions`（`margin-left:auto`，窄屏整组折行），× 从 36px 灰底胶囊改成 28px 无底色图标按钮（不再像第二个勾选框）。⑩ 320 上搜索框占位文案被结果数挤断 → 该断点隐藏 `.filter-result-count`。测试 175 → 182（`tests/desktop-v0358.test.js`）。
- v0.35.7：他 v0.35.6 真机实测后的四条。① 保证金「查看」文字偏上 4.5px 的根因是 `display:inline-flex` 让 `<button>` 变成真 flex 容器，Chrome UA 的 `button { align-items: flex-start }` 把文字顶到上边（行高 1.5 的余量全落到下方）——补 `align-items/justify-content: center` + `line-height: 1`，四档窄屏文字盒上下 10/10（差值 0）。② 手机端再紧凑：统计卡 133 → 125、两条提示条 48 → 46（间距 12 → 8）、临期面板 52 → 50、列表上内边距 14 → 12、详情行 10 → 9；首卡 top 624 → 598（390/375/360）、614 → 594（320），触控区与字号未动。③ 完整项目名称回到手机端详情区（`.kv-row-name` 从 `display:none` 改为块状行：小字标签 + 14px/600 全名，`white-space: normal; word-break: break-word`），26 字名称 390 折两行 43px、`scrollWidth == clientWidth`；桌面本来就完整，未动。④ 废标检查清单手机与桌面都默认收起：默认态集中在 `utils.SECTION_OPEN_BY_DEFAULT`（`risk: true, checklist: false`）+ 纯函数 `isSectionOpen` / `toggleSectionOpen`（清单点开记 `expandedSections`，风险仍记 `collapsedSections`）；标题栏整条是可点的 `<button>`（清单名 + `已完成 X/Y` + 箭头，`aria-expanded` / `aria-controls`），「清空」只在展开时出现；展开动画从 `display:none` 改成 `grid-template-rows: 1fr ↔ 0fr`（内层 `min-height: 0; overflow: hidden`，240ms，减动效自动关）。收起 48px（手机 52px）、清单体 0；点开 183（桌面）/ 323（390）/ 345（360）/ 412（320）。测试 165 → 175。
- v0.35.6：手机端第二轮打磨（真机反馈「手机端总感觉差点意思」）+ 版本号回到可见处，全部收在 `@media (max-width:680px)`，桌面逐像素不变。① 标题右侧一枚 `v0.35.6` 徽标（`.app-version-badge`，桌面 `display:none`）。② 卡片 152 → 126px：卡头三段（名称两行 / 副标题 + 倒计时同一行 / 操作条），靠 `.project-head-main`、`.project-head-top`、`.project-head-right` 三层 `display:contents` 把名称、副标题、胶囊变成同一网格的子项（`10px minmax(0,1fr) auto 44px`）；副标题手机端隐去投标公司（`.project-sub-company`）。③ 工具栏 140 → 82px：第一行「列表|日历 + 排序 + 结果」三枚胶囊，第二行「中标率 · 选择 · 全部折叠」（HTML 里加了 `.list-tools-actions` 包裹层，桌面 `display:contents` 保持原样），日历视图整行收掉。④ 临期面板 75 → 52px：标题与摘要一行（摘要文案改为「近 7 天 · 标签 今天」，事项数交给「临近」统计卡）。⑤ 页头 94 → 79px、统计卡 140 → 133px（选中态改整圈描边）、搜索框 38px。⑥ 详情区隐去与卡头重复的「项目名称 / 项目类型」（`.kv-row-name` / `.kv-row-type`），备注改块状（`.kv-row-note`）。⑦ 底部导航 emoji → 24px 单色 SVG，毛玻璃 `blur(20px) saturate(180%)`。⑧ 有卡片展开时 `body.detail-open` 收起浮动「＋」（`ui.syncDetailOpenState`，`toggleProjectDetails` 与 `updateCollapseAllBtn` 两处调）。⑨ 页头菜单改 iOS 菜单（透明行 + hairline）、选择模式操作条两行。⑩ 真 bug：`clearStaleAiResult` 在 v0.35.0 重构时被挪进 `bindEvents()`，模块级 `resetParserState()` 调它会抛 ReferenceError（解析抽屉每次打开都少做一半复位）——移回模块作用域，新增 `tests/app-scope.test.js` 两条静态断言。首卡 top 390×844 685 → 564；测试 155 → 165。
- v0.35.5：手机竖屏全面打磨（审查报告 21 条落点，全部收在 `@media (max-width:680px)` 内，桌面实测零变化）。① 临期卡 `min-width: 0` + `flex: 0 0 calc(100% - 6px)`，名称两行：647 → 318px。② 卡头改三行网格（名称 / 胶囊 / 操作），名称 104 → 216px（360 下 74 → 186），卡片 122 → 152px。③ 「即将到期事项」手机端收成一行摘要（`#upcomingSummary` + `#upcomingSummaryBtn`，点开才出横条，面板 243 → 67px）；内联表单收起态整块 `display: none`（`body.form-open` 由 `setFormExpanded` 维护），首张卡 top 1295 → 745（390×844）。④ toast 左右 16px、圆角 14px：195×152 → 358×80。⑤ 所有输入控件手机端 16px（含 select，防 iOS 聚焦放大）。⑥ 表单 / 菜单 / 提示条出现时收起浮钮（`form-open` / `menu-open` / `toast-open` 三个 body 类），「↓」移到左下。⑦ 抽屉 `padding-bottom: calc(var(--sp-5) + env(safe-area-inset-bottom))`。⑧ 底部菜单 `max-height: calc(100dvh - 168px - env(...))` + 可滚（375×667 不再裁「退出」）。⑨ 工具栏改两列网格 + 排序文案收短；日历导航一行 + 「回到本月」小字；⑩ 清单勾选框与文字包进 `<label class="checklist-main">`（整行可点，文字 103–125 → 183px），来源徽标下移一行；⑪ 截止提示手机端隐去（与临期面板同口径）、保证金提示收一行 +「查看」（`data-action="open-guarantee"` → `drawers.openGuaranteeSheet`）、备份提示单行；⑫ 保证金卡补「万元」、底部 Tab 94%（深色 96%）。测试 150 → 155（3 条 CSS 落点 + 2 条渲染断言）。
- v0.35.4：手机竖屏两处。① 项目卡片高度 145 → 121.5px（390×844 / 375×667 / 360 实测同值）：`@media (max-width:680px)` 里换行后的 `row-gap`（12px）与操作行 `margin-top`（6px）叠了 18px，加上下内边距各 10px；现改为内边距 `8px 16px 6px`、`row-gap: 2px`、`margin-top: 0`、按钮间距 6→4，行内按钮仍 44px、两行结构不变。② 详情区状态三选一不再被挤成 2+1：`.kv-row` 是「标签 56px + 间距 16px + 值」，值只剩 194px 而三枚胶囊要 201px；手机端给这一行挂 `kv-row-status`（`js/ui.js` 的 `kv()` 支持第三个 class 参数），标签与控件各占一整行，控件改 `display: grid; grid-template-columns: repeat(3, minmax(0, 1fr))`，360/375/390 实测三枚同 top、无截断、无横向溢出。桌面布局未变（1440 卡片 70.3 → 69.5px，只因名称行高 1.3→1.25）。

- v0.35.3：复审报告逐条修复。手机端四条优化真正生效（`.bottom-tabs` / `.fab-add` / `.label-short` 的桌面隐藏改成 `@media (min-width:681px)`，980 断点挪到 680 之前，`.toast-wrap` 的 28px 只留给桌面，删掉互盖的 `.page` padding），并且把**所有 max-width 断点块移到 styles.css 文件末尾**——部分组件基础样式（`.status-chip`、`.project-chevron-btn`、`.cal-day`、`.cal-nav`）历史上写在断点块之后，留在中部就永远被盖掉；`check:css` 新增跨断点顺序覆盖检查（`tests/css-cascade.test.js`）。页头窄屏收窄（隐藏副标题、标题 20px、主按钮只留＋）、点击区补到 44pt、矮屏登录页压缩海报与内边距、折叠区收起时挂 `inert`、通知权限改为设置内主动申请、登录表单 `novalidate` + 中文提示、眼睛图标改内联 SVG；CSP `connect-src` 放行 `https:`、`sw.js` 离线兜底返回 504、manifest 补 `lang` / `start_url` / `shortcuts`；清理 `addRipple` 死代码、`.single().single()`、双 `<main>`、隐藏时重建日历、六处 Esc 监听合并、`pruneNotificationKeys` 改登录时一次。README 重写。测试 136→147。

- v0.35.2：三处细节。备注从「选填信息」挪到必填区最后一行（仍选填，选填区 12→11 项）；定位不再挂 2 秒背景闪烁（`project-highlight` / `highlight-fade` 删除，定位只靠平滑滚动 + 展开）；编辑保存后等表单收起（~380ms，减动效时 40ms）落定再回到该卡片，并用一次性柔光 `.save-glow` 提示（Realtime 回声重建卡片时用负 `animation-delay` 接着放，不重头闪一下），`prefers-reduced-motion` 下不播；toast 带项目名。
- v0.35.1：补丁版，只修注册提交。`app.js` 的 `authForm` submit 处理器在「两次输入的密码不一致」分支提前 `return` 时漏掉了 `event.preventDefault()`（它原本在 `js/auth.js` 的 `handleAuth()` 里才调用），表单于是按浏览器默认行为 GET 提交到 `./?` —— 页面刷回登录态、输入清空、错误提示一闪即失。现在 submit 开头统一 `preventDefault()`。改动为 `app.js` 3 行 + 版本号同步（package.json / sw.js `CACHE_NAME` / index.html 页眉 / js/utils.js `APP_VERSION` / README / changelog / 本文件）。
- v0.35.0：审查报告 26 项全修。高危三件（恢复备份的“取消”真的是取消：`confirmDialog` 三出口 + `resolveRestoreDecision`；整列回写改按项目串行队列 `createKeyedQueue` + 函数式补丁 + 乐观写入；切换编辑对象加脏检查、草稿改成按编辑对象存的 Map）；手机端（统计卡 3 列 + 短标签、隐藏重复状态筛选、新增「＋」浮动按钮、详情区状态一键改）；空状态分叉、统计卡不再清搜索、日历搜索生效、即将到期统一“事项”口径（并修掉驼峰截止字段读不到的真 bug）；表单改真 `<form>` + 结构化校验与字段级报错；通知权限行、深色 `color-scheme`、同步状态对比度、解析可中止、回收站剩余天数、保证金合计、备份默认不含全文、注册确认密码；新增 `bid_time` / `result`（需执行 `docs/migrations/v0.35.0-bid-time-result.sql`，旧库自动降级）与中标率；海报外置（styles.css 131KB→71KB）、aria-pressed 与行容器语义修正、PWA 细节、CSP Report-Only、app.js 抽 `js/drawers.js`、680px 媒体查询合并 + `check:css` 新增同断点数量校验。测试 94→117。
- v0.34.0：顶部菜单瘦身（导出备份 / 从备份恢复 / 主题切换搬进「⚙️ 设置」，12 项→ 9 项）；设置改浮层（桌面居中弹窗 / 移动底部抽屉，遮罩·Esc·✕ 关闭 + 焦点陷阱）；统计卡片改原生 `<button>`（回车/空格原生行为、`.active` + `aria-pressed`），新增第 6 张「即将开标」跳转卡；`sw.js` 壳补 `js/ics.js`；`api/calendar.js` 令牌格式先验（400，不打 Supabase）+ `private, max-age=300`；`js/ai-extract.js` 分块摘要 `sessionStorage` 缓存（原文哈希 + 模型 + 提示词版本 + 块号，40 条上限）；确认框关闭不再抢走下层抽屉的滚动锁。测试 86→94 个。
- v0.18.2：分块 48k 字符，分块摘要 2 路并行（429 退避重试 + 串行回退）；模型请求走流式 SSE 边收边推进度，中转不回 SSE 时自动回退非流式。
- v0.19.0：解析抽屉三段式（解析→分析→回填/保存）：顶部「保存到项目」下拉框与「保存文本」按钮删除，AI 分析只展示、面板底部只剩「回填到表单」，保存方式由表单自己的保存按钮定；文本与结论合一存「保存到项目」；未绑定时目标在操作时就地选（回填默认新建项目）。
- v0.20.0：回填按钮移到操作区「AI 分析」后（有结果才可用）；「保存到项目」与目标选择器删除，解析原文只在回填后的那次表单提交里一并存上；回填直达表单（未绑定新建、绑定进该项目编辑态、已在改同一张时不重填）；✕ 直接关抽屉、遮罩点一下也关；解析入口挪进表单顶部可选区。
- v0.21.0：呼吸感（只动间距：行内操作、标题栏、定义列表、分区标题、搜索与工具栏、窄屏页边距各放宽一档）；README 重写为简单直接的说明，去表情符号与口号文案。
- v0.22.0：回收站底部加「清空回收站」（空时禁用，确认框二次确认，一次批量彻底删除）；手机端打磨（窄屏页边距上下对称、卡片行与统计卡片内边距放宽、工具栏贴边对齐、底部 Tab 加高、输入框纵向内边距统一 12px）。
- v0.23.0：八项打磨（备注回定义列表、列表行去空白、清空按钮置顶、窄屏名称两行布局、桌面回顶部、移动端菜单修复 + 回到底部、统计卡片各自成卡、品牌角标自适应）。
- v0.24.0：浮钮根因修复（.page 入场动画 page-in 以 both 填充保留 translateY(0)，使 .page 成了 fixed 定位的包含块，浮钮被钉在页面内容底部——动画收尾改 transform: none；view-in 同改；阈值 400→200px）；品牌角标改正方形（64px/52px）；版本号从页脚移到页眉用户栏；README 加少量表情点缀。
- v0.25.0：定位高亮改单次淡出（1.6s，终态透明，移除类名不再闪）；手机端名称改回两行 + 操作按钮铺满整行。
- v0.26.0：浮钮真根因——删掉 `.page` 的 page-in 入场动画。v0.24.0 的“收尾改 none”实测无效：线上已是 v0.25.0，浮钮仍被钉在页面底部；fill 模式持有的动画值仍让 `.page` 成为 fixed 按钮的包含块。教训：不要给 `.page` 加带 transform 的动画；不要再把浮钮问题归因于 Service Worker 缓存（v0.25.0 已证实页眉版本号对得上仍不行）。另：手机端行内解析去 📄、间距再收紧、倒计时 pill 垂直居中。
- v0.27.0：定位高亮按 iOS 风格重做——先淡入后淡出（2s ease-in-out，首尾透明），延迟 300ms 再挂类，连续点击先清旧定时器。
- v0.28.0：数据安全三件套——重置前先自动下载备份（失败不执行）；恢复失败报进度 + 可撤销（恢复前快照被覆盖行、记本次写入 id）；导入去重（名称 + 开标时间 + 投标公司，中文名内空格视为手误去掉）。测试 63→66 个。
- v0.33.0：.ics 日历订阅 C（免费路线，多伟 2026-11-07 点选“两个都要”：前一天 9 点 + 当天 8 点各提醒一次）——Vercel 加 api/calendar.js 订阅函数（复用 Vercel 上已有的 SUPABASE_URL / ANON_KEY，不新增费用、不用 Edge Function），Supabase 加第 10 节（calendar_tokens 令牌表 + SECURITY DEFINER 只读函数 get_calendar_projects，凭令牌只读该用户待开标项目）；App 菜单“数据”组加“📅 日历订阅”入口：生成 / 复制 / 重新生成（旧链接失效）/ 停用订阅，链接形如 /api/calendar?token=xxx；.ics 为全天事件，描述字段默认项目类型、投标公司、招标单位、联系人、备注（仅非空项），行超 75 字节按 RFC 5545 折行；表未建时抽屉提示执行第 10 节。注意：订阅链接带令牌别外传；同步频率由日历 App 决定（苹果日历默认每周拉一次）；第 10 节 SQL 须在 Supabase SQL Editor 执行后才生效。测试 80→86 个（新增 tests/ics.test.js 6 个）。
- v0.32.0：①重置账户加打字确认——第二次点击后弹出确认框，须输入「确认重置」才启用确认按钮，通过后才自动下载备份并清空，输错 / 取消都不执行（confirmDialog 新增 requireTyping 选项，默认不影响其他确认框）；②项目列表顶部工具栏加「全部折叠」按钮（在“选择”旁边），一键清掉所有展开的卡片，只重建受影响的卡片（走 v0.31.0 的定向渲染），没有展开的卡片时按钮不可点。测试仍 80 个（本次无新增纯函数）。
- v0.31.0：P0 性能重构——写操作不再全量重拉 + 全量重渲染：保存 / 更新字段 / 删除 / 恢复 / 复制 / 导入成功后取回受影响的行（LIST_COLUMNS）本地合进 state.projects、刷新离线快照、定向渲染（只动受影响的卡片与统计，列表增量同步 DOM：缺失插入、移位挪过去、变了重建、多余移除，末尾“加载更多 / 到底啦”与筛选计数一并更新，新建与重建的卡片加 no-enter 不重播入场动画，焦点还给同款按钮）；Realtime 也改走增量应用（按 INSERT/UPDATE/DELETE 只动受影响的行，之前每次变更含自己保存的回声都全量重拉，等于每次保存拉两遍；收不到 payload 或行不完整时回落全量重拉）；资质库读写同样本地提交 + 只重绘资质列表；彻底删除的行本就不在主列表里，不再重拉；loadProjects 只留给首次加载 / 联网恢复 / 重置 / 恢复备份四种整库场景；删除失败时把折叠起来的行恢复原样。测试 77→80 个。
- v0.30.0：P2 打磨批——备份 version 取 APP_VERSION（不再写死 0.8.0）、恢复注释纠错（重复 id 留第一条）、搜索框 aria-label、Toast 上限 3 条、倒计时每分钟刷新连颜色一起改、通知去重键 30 天过期清理、离线快照 7 天有效期 + 保存失败退化到最小快照、四处写入口补离线守卫（更新字段 / 恢复 / 彻底删除 / 复制）、回收站分页（50 条一页）、pdf.js 双源（cdnjs 挂了回退 jsdelivr，报错说人话）、底部“项目”Tab 从日历回来恢复列表滚动位置、定位与统计卡片清搜索时不再静默（目标可见时不清、清了说一声）、折叠详情懒生成（展开时才拼 HTML）、抽屉与确认框焦点陷阱、小按钮提到 36px、删死代码 formatCountdown。测试 75→77 个。
- v0.29.0：P1 四件套——AI 终稿上限 8000（仅终稿）、截断识别与重试收窄（401/404/截断不重试）、表单草稿（localStorage，7 天，空表单/同项目编辑时问一次恢复）、定位卡片跳过入场动画、企业资质库对照（qualifications 表，supabase.sql 第 9 节；AI 终稿提示词里逐条判 matched/missing/unclear + match_note）。测试 66→75 个。

---

## 数据与提醒

- 表 `projects`：`user_id` + RLS；状态仅 `报名中 | 制作中 | 已开标`；`deleted_at` 为空表示正常，非空表示在回收站（保留 30 天，过期自动彻底删除）。
- AI 相关列已删除（第 4 批）：`risk_summary`、`risk_points`、`qualification`、`invalid_bid_clauses`、`extracted_meta` 不进列表查询、UI 展示、回写、CSV 导出与备份；`supabase.sql` 建表段与第 3、4 节已不再含这 5 列，旧库删列走第 14 节（执行前先全量导出备份）。检查清单与 PDF 全文是活数据，不受影响。
- v0.3.0 新增列：`checklist`（jsonb，每项 `{id, text, done, source}`，source ∈ ai-invalid / ai-risk / manual）；`amount_value`（numeric）+ `amount_unit`（元/万元，默认万元）；`guarantee_amount`（numeric）+ `guarantee_unit`（元/万元，默认万元）+ `guarantee_status`（未缴纳/已缴纳/已退回/已没收，默认未缴纳）；`registration_deadline` / `inquiry_deadline` / `clarification_deadline` / `guarantee_deadline`（date，均可为空）；`pdf_text`（text，保存时截断到 200000 字符）+ `pdf_filename` + `pdf_parsed_at`。v0.18.1：`pdf_filename` 入库与读出时去掉末尾连拼的"（N 字）"后缀（半角括号也认），已污染的文件名下次保存即洗回；查看已保存文本的总页数从文本的"【第 N 页】"标记取最大值，无标记显示"未知"。旧 `amount` / `guarantee` 文本列保留，新字段为空时列表显示旧文本。
- v0.4.0 无新列，但保证金改为选填：`guarantee` 列已改为可为空并去掉长度校验（`supabase.sql` 第 8 节，旧库需执行一次，幂等）。列表查询为显式列清单（排除 `pdf_text`，全文按需拉）；搜索框 input 防抖 200ms；必填为开标时间、项目类型、项目名称、投标公司、联系人（保证金/金额均选填）。
- v0.4.2 无新列、无约束变更，旧库无需执行任何 SQL。登录页为左右分栏（海报底图（内联于 styles.css 的 WebP data URI，因推送通道不支持二进制） 海报 + `.auth-split` 布局），移动端 <900px 海报变顶部横幅；列表头部默认显示项目类型，保证金（金额+状态）在详情区与项目金额同行。
- v0.4.1 无新列、无约束变更，旧库无需执行任何 SQL。列表卡片改为两段式折叠（头部 + 详情），展开态在 `app.js` 的 `state.expandedIds`（Set）内存维护；排序默认 `date-desc`（`#sortBy` 默认选中 + ui.js 两处 fallback）；styles.css 顶部有 `[hidden] { display: none !important; }` 全局规则（修复 display:flex 覆盖 hidden 的占位问题）；`.project-item` 用 `content-visibility: auto` 优化长列表。
- 旧库升级：在 Supabase SQL Editor 执行 `supabase.sql` 中的增量迁移段。v0.2.7 必须执行 `deleted_at` + `notification_log` 迁移，否则回收站不可用（列表会自动降级）。v0.3.0 必须执行第 7 节迁移，否则清单 / 金额 / 截止时间 / PDF 保存会提示迁移错误（列表仍可正常显示，新字段取默认值）。v0.4.0 旧库需执行第 8 节放宽 `guarantee` 约束，否则空保证金保存会被数据库拒绝。
- 清单 / 金额 / 截止 / PDF 的局部更新走 `projects.js` 的 `updateProjectFields`（白名单字段 + `.eq("user_id", ...)`）。
- 开标提醒天数：本机 `localStorage` 键 `bid-assistant-reminder-days`（1–30，默认 7）。
- 提醒机制：浏览器通知仅在页面打开时触发，多截止项（报名 / 质疑 / 澄清 / 保证金 / 开标）days=0/1 时通知，文案带截止类型；错过提醒只看开标时间。关页提醒走 v0.33.0 的 `.ics` 日历订阅（`api/calendar.js` + `js/ics.js` + 系统日历），邮件提醒的 `supabase/functions/send-bid-reminders/` 仍未部署，详见 `docs/reminders.md`。
- 日历订阅（v0.33.0；第 3 批加有效期/限流/最近读取）：表 `calendar_tokens`（`user_id` + `token`，RLS 本人可见），只读函数 `get_calendar_projects(p_token)` 为 SECURITY DEFINER，只返回未删除且开标日不早于今天的行；第 10 节 SQL 须执行一次，否则抽屉只提示、生成不出链接。订阅链接带令牌，等同只读凭证，别外传到公开地方。令牌有效期 **180 天**（`expires_at`，第 13 节：先加可空列按 `created_at` 回填再收 NOT NULL + 默认值，存量老令牌不续期；`get_calendar_projects` 加过期过滤，过期令牌只返回空 ICS；抽屉显示“有效期至 X · 最近读取 Y”，过期显示“订阅链接已过期，请重新生成”）。`/api/calendar` 限流 **60 次/小时**（第 13 节 `calendar_token_reads` + `record_calendar_token_read`，超限返回 429 + `Retry-After: 3600`，无效令牌仍走空 ICS 不暴露存在性；record 函数不存在或调用失败时降级放行）。最近读取时间 `last_read_at` 由 record 函数顺手更新，旧令牌初始为 NULL 时前端显示“从未读取”。第 13 节 SQL 须在 Supabase SQL Editor 手动执行（幂等，执行两次应零报错零变化），执行前先备份；前置年龄查询（2026-11-25）：`calendar_tokens` 共 1 条、已过期 0 条、创建于 2026-11-07，迁移时无令牌会立即失效。

---

## 安全头与 CSP（改之前先读）

`vercel.json` 里的 CSP 已是强制生效的 **`Content-Security-Policy`**（batch3 自 Report-Only 切过来），只报告不拦的时代结束了。改动口径（逐项按仓库实际引用核对过）：

- `script-src` 只留 `'self'` + jsDelivr：SheetJS（`app.js` 的 `loadSheetJS`，xlsx 懒加载）与 Supabase SDK 回退（`ensureSupabase`）都走 jsDelivr；cdnjs 全仓无任何代码引用（v0.50 删 pdf.js 后已无人用），已删。
- `connect-src` 收窄到 `'self' https://*.supabase.co wss://*.supabase.co`：v0.50.0 已移除招标文件 AI 解析，用户自备 OpenAI 兼容 API 的调用已不存在，当初反对收窄的理由已消失；浏览器端除 Supabase 外无其他跨域调用（`api/calendar.js` 是服务端函数，不受浏览器 CSP 约束）。
- `worker-src` 为 `'self' blob:`：两个 CDN 源都删了，但 `blob:` 必须留——Supabase 实时同步（`js/projects.js` 的 `.channel().subscribe()`）的心跳 Worker 是 supabase-js 用 Blob URL 建的，删掉 `blob:` 会断实时同步。
- 其余指令未动：`style-src 'self' 'unsafe-inline'`（内联样式仍在用）、`img-src 'self' data: blob:`、`font-src 'self' data:`、`default-src 'self'`、`frame-ancestors 'none'`、`base-uri 'self'`、`form-action 'self'`、`object-src 'none'`。
- HSTS 没有在 `vercel.json` 里加：2026-11-24 实测 Vercel 平台默认已下发 `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`，自加会重复下发。注意平台默认值自带 `includeSubDomains` 与 `preload`，与本仓“只加 max-age”的决定不同，这是平台行为不是本仓配置。

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

有明确需求时再拆任务，避免为扩功能而扩功能。

- v0.4.4：iOS 式丝滑 UI（--ease-spring/--ease-out 动效语言、SF 字体栈、transform/opacity 动效、prefers-reduced-motion）。新增/编辑表单折叠重做成 CTA 头（图标徽章＋/✎、编辑副标题显示项目名、展开/收起胶囊按钮，grid 高度动画）；项目卡片详情同样改 grid 高度动画；按钮按压缩放、卡片 hover 上浮、输入框 focus 光环、toast 移到底部中央、倒计时等宽数字。海报图仍内联于 styles.css。无迁移。
- v0.4.3：新增/编辑表单默认折叠（标题点击展开/收起；编辑、AI 回填时自动展开并聚焦；保存/取消后自动收起）。全站文案精修（准确、简洁、术语统一）。性能：卡片入场 stagger 收敛到 96ms 内、scroll 监听 rAF 节流。无迁移。
- v0.5.0：全站 iOS 重做（systemGroupedBackground 配色、32/20/15/13 字阶、16px 圆角 hairline 无投影）。页头改大标题 + 数据副标题；统计改单分组卡片；即将开标改横向 urgency 卡片；表单改 iOS 分组（必填/选填）；工具栏改 iOS 搜索框 + segmented 筛选；列表行回舒适高度（约 60px）；详情区改定义列表；iOS tint 按钮行。无迁移。
- v0.5.1：修复折叠空白带（collapse-inner 边距只在展开时应用，收起零残留）；搜索图标改内联 SVG；编辑/复制/删除移到行头部右侧两行（按钮优先于折叠切换，防误触）；kv 行 7px 12px、表单面板 16px 收紧。无迁移。
- v0.6.0：批量删除（选择模式 + 全选当前筛选 + deleteProjects 一次 update）；设置危险区重置账户（双重确认，只删当前用户 projects + notification_log）；选填信息独立折叠（AI/编辑有值自动展开）；列表到底趣味文案；导出 CSV 开标时间第一列。无迁移。
- v0.4.6：紧凑 iOS 式列表（分组大圆角 + hairline 行，cell 两行封顶约 50px：状态圆点 + 名称/一句话 + 倒计时 pill + chevron；徽章移到详情区；pill 文案精简）。全站密度收紧（panel/header/upcoming）。无迁移。
- v0.8.0：功能五件套——一键备份（直连 Supabase 全量含回收站 + 30 天备份提醒条）/ 开标日历视图（周一起始、紧急度圆点、点日看当天项目、点项目回列表定位）/ 保证金待退还清单（折叠面板 + 在途保证金卡片联动、复用 mark-refunded）/ PWA（manifest + sw.js 应用壳缓存 + 图标）/ Excel 导入（SheetJS 0.18.5 + SRI、第一张表转 CSV 复用校验）。无迁移。
- v0.7.0：UI 五件套——视图切换过渡（view-enter）、删除退出动画（.leaving + 高度收拢）、header 收纳（下拉菜单）、统计卡片可点击筛选 + count-up、深色浮层 --surface-raised、工具栏 sticky 毛玻璃。无迁移。
