# 贡献指南

欢迎提 Issue 和 PR。本项目是个人维护的单人投标工作台，改动以「简单实用、不加多余功能」为准；动手前先看 `docs/notes.md`（维护说明）、`docs/changelog.md`（版本历史）、`docs/todo.md`（待办与明确不做的事）。

## 发版前必跑的两项校验

### 1. 版本号同步（`npm run check:version`）

`package.json` 的 `version` 是唯一事实来源。改版本号时，以下 6 处必须同步改，否则 `check:version` 失败：

1. `sw.js` 的 `CACHE_NAME`（如 `bid-assistant-v0.51.4`）
2. `docs/changelog.md` 的版本标题（如 `## [0.51.4]`）
3. `index.html` 里的版本号（如 `v0.53.0`）：两处都要改 —— 页眉徽标里的文字（v0.53.0 起徽标已隐藏，但文字仍随版 bump）与设置页底部的版本号行（`settings-version`，用户在设置页查看版本）；`check:version` 只认「index.html 里出现当前版本号」，不钉死位置。
4. `README.md` 里的当前版本（如 `v0.51.4`）
5. `docs/notes.md` 里的当前版本（如 `v0.51.4`）
6. `js/utils.js` 的 `APP_VERSION`（如 `APP_VERSION = "0.51.4"`）

只改版本号不改功能时也要跑一遍；缓存名不同步，旧缓存会钉住新版，用户刷新也看不到新功能。

### 2. CSS 校验（`npm run check:css`）

`scripts/check-css.mjs` 检查 `css/` 下的样式 bundle（按 `index.html` 的 `<link>` 顺序拼接，见 `tests/css-bundle.mjs`）：

- 声明不能丢分号（`padding` / `margin` / `gap` 类声明漏分号会吞掉后面一条声明）。
- 同一断点的媒体查询不超过 2 处（按完整条件计），新样式并进已有块里，不要另起一块。
- 跨断点顺序覆盖：`max-width` 块里写过的属性，不能在文件更靠后的位置被无条件规则或更宽的断点重写，否则那条断点样式永远不生效。
- 所有 `max-width` 断点块一律放 `css/breakpoints.css`（它是 5 个样式文件里最后加载的）。

## 测试

- `npm test`：Node.js 原生 `node:test`，共 33 个测试文件（以 `package.json` 的 `test` 脚本为准）：
  - 基础：`tests/utils.test.js`、`tests/pagination.test.js`、`tests/snapshot.test.js`、`tests/lazy-loading.test.js`、`tests/list-sync.test.js`、`tests/ics.test.js`、`tests/ui-state.test.js`、`tests/bid-time.test.js`
  - 渲染与定位：`tests/render.test.js`、`tests/form-locate.test.js`、`tests/css-cascade.test.js`、`tests/app-scope.test.js`
  - 历次视觉 / 架构打磨：`tests/desktop-v0358.test.js`、`tests/apple-hig-v0359.test.js`、`tests/apple-arch-v0360.test.js`、`tests/blueprint-v0362.test.js`、`tests/refined-command-v0363.test.js`、`tests/aurora-v0370.test.js`、`tests/command-workspace-v0380.test.js`、`tests/polish-v0390.test.js`、`tests/v0400-polish.test.js`、`tests/v0410-polish.test.js`、`tests/ui-polish-v0520.test.js`、`tests/ui-phase2-v0530.test.js`
  - 减法重构后：`tests/v0500-biddesk.test.js`、`tests/v0510-biddesk.test.js`、`tests/batch4-ai-ui-removal.test.js`、`tests/batch4-ai-drop-columns.test.js`
  - 契约与配置：`tests/contracts.test.js`、`tests/csp.test.js`、`tests/generate-config.test.js`、`tests/calendar-token.test.js`、`tests/settings.test.js`
- 新增测试文件放进 `tests/` 即可（`test` 脚本用 `tests/*.test.js` 通配，不用逐个登记）。
- 改 UI / 渲染逻辑必须补或更新对应测试；只改文案、版本号、文档不用补测试。
- 测试里不要写真实密钥、真实项目数据。

## 提交风格

- 格式：`类型(范围): 一句话`，例如 `fix(sw): ...`、`feat(v0.51.4): ...`、`docs(batch1): ...`。
- 常用类型：`feat`（新功能）、`fix`（修 bug）、`style`（纯样式）、`test`（测试）、`docs`（文档）、`chore`（构建 / 杂项）。
- 范围写模块或版本，如 `sw`、`v0500`、`batch1`；版本号写在范围后，如 `fix(v0.51.2): ...`。
- 一个 PR 只做一件事；改动与验证写进 PR 描述。

## 密钥红线

- `supabase-config.js` 只放本地，绝不提交（已在 `.gitignore` 中）；公开仓库里只留 `supabase-config.example.js` 占位。
- `service_role` key 永不进浏览器、永不进仓库、永不进 PR 描述与截图；浏览器端只用 anon key。
- 不慎把真实 key 推上公开仓库：立即在 Supabase 控制台轮换 anon key（见 `docs/notes.md` 运维检查清单）。
- 截图、录屏、日志里不要出现真实项目数据、真实邮箱与令牌链接。

## 分支与发布

- 日常改动从 `main` 切分支做，分支名如 `fix/xxx`、`feat/xxx`、`docs/xxx`；不要直接在 `main` 上提交。
- 版本号只在发版时统一改（见上文 6 处同步），日常 PR 不要顺手 bump 版本。
- 发版流程：改版本号 → 跑 `npm run check:version`、`npm run check:css`、`npm test` → 更新 `docs/changelog.md`（新版本条目写在文件顶部）→ 合并后打 tag（格式 `v0.51.4`）。
- 文档口径以 `docs/notes.md`、`docs/changelog.md`、`docs/todo.md` 三份为准，改功能时同步改相关文档，不要留「代码已改、文档还写旧功能」的口子。

## 提 PR

1. 从 `main` 切分支，分支名如 `fix/xxx`、`feat/xxx`、`docs/xxx`。
2. 改完跑 `npm run check:version`、`npm run check:css`、`npm test`。
3. PR 描述写清：改了什么、为什么、怎么验证的。
4. 不要直接推 `main`；不要在 PR 里改 `.github/workflows/`（需网页端另行处理）。
