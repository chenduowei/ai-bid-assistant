/**
 * v0.35.3：styles.css 的跨断点顺序覆盖检查（scripts/check-css.mjs）的行为测试。
 * 起因：v0.35.2 手机端「底部导航 / 浮动新增 / 统计卡标签 / 3 列网格」四条优化全部失效，
 * 根因都是同一选择器在 max-width 块里写过、又被文件更后面的同优先级规则盖掉。
 * 这些用例把「该抓到 / 不该误报」两边都钉住，避免以后有人把断点块又挪回文件中部。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeCss, findCascadeOverrides, parseCssRules } from "../scripts/check-css.mjs";

const realCss = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("styles.css 本身通过全部 CSS 校验（含跨断点顺序覆盖为 0）", () => {
  const { bracesOk, spread, bad, overrides } = analyzeCss(realCss);
  assert.equal(bracesOk, true);
  assert.deepEqual(spread, []);
  assert.deepEqual(bad, []);
  assert.deepEqual(overrides, []);
});

test("抓到：max-width 块里的属性被文件末尾的无条件规则覆盖", () => {
  const css = `
@media (max-width: 680px) {
  .bottom-tabs { display: flex; }
}
.bottom-tabs { display: none; }
`;
  const problems = findCascadeOverrides(css);
  assert.equal(problems.length, 1);
  assert.equal(problems[0].selector, ".bottom-tabs");
  assert.equal(problems[0].prop, "display");
  assert.match(problems[0].mediaCond, /max-width: 680px/);
  assert.match(problems[0].laterCond, /无条件/);
});

test("抓到：窄断点（680）写在宽断点（980）之前", () => {
  const css = `
@media (max-width: 680px) {
  .stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 980px) {
  .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;
  const problems = findCascadeOverrides(css);
  assert.equal(problems.length, 1);
  assert.match(problems[0].laterCond, /max-width: 980px/);
});

test("不误报：宽断点在前、窄断点在后（正常的逐级收窄）", () => {
  const css = `
@media (max-width: 980px) {
  .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 680px) {
  .stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
`;
  assert.deepEqual(findCascadeOverrides(css), []);
});

test("不误报：桌面专属规则写在 min-width 块里", () => {
  const css = `
@media (max-width: 680px) {
  .bottom-tabs { display: flex; }
}
@media (min-width: 681px) {
  .bottom-tabs { display: none; }
}
`;
  assert.deepEqual(findCascadeOverrides(css), []);
});

test("不误报：同值、!important、别的属性、别的条件、更窄断点在后面", () => {
  const css = `
@media (max-width: 680px) {
  .chip { min-height: 44px; padding: 8px 12px; color: red; }
  .important { display: flex !important; }
}
.chip { min-height: 44px; }            /* 同值，无害 */
.important { display: none; }          /* 断点里是 !important，仍然生效 */
.chip { background: none; }            /* 只有别的属性，无害 */
@media (max-height: 720px) { .chip { color: blue; } }  /* 另一种条件，不比较 */
@media (max-width: 480px) { .chip { color: green; } }  /* 更窄、写在后面，正常覆盖 */
`;
  assert.deepEqual(findCascadeOverrides(css), []);
});

test("仍能抓到丢分号与同一断点超过 2 处", () => {
  const missingSemicolon = analyzeCss(`.a { padding: 4px  color: red; }`);
  assert.ok(missingSemicolon.bad.length >= 1);

  const spread = analyzeCss(`
@media (max-width: 680px) { .a { color: red; } }
@media (max-width: 680px) { .b { color: red; } }
@media (max-width: 680px) { .c { color: red; } }
`);
  assert.equal(spread.spread.length, 1);
  assert.equal(spread.spread[0][0], "(max-width: 680px)");
});

test("同一断点按完整条件计数：max-width:900px 与带 max-height 的组合算两个断点", () => {
  const css = `
@media (max-width: 900px) { .a { color: red; } }
@media (max-width: 900px) and (max-height: 720px) { .a { color: blue; } }
@media (max-width: 900px) and (max-height: 620px) { .a { color: green; } }
`;
  assert.deepEqual(analyzeCss(css).spread, []);
});

test("大括号不平衡能被发现", () => {
  assert.equal(analyzeCss(`.a { color: red; }`).bracesOk, true);
  assert.equal(analyzeCss(`.a { color: red; `).bracesOk, false);
});

// v0.35.4：手机竖屏的两条排版修复必须有样式落点——
// 卡片内边距/行距收紧（卡片高度），以及详情区状态三选一的「标签一行 + 三等分网格一行」。
// 之前这两处没任何测试，改断点块时容易被连坐。
const ruleIn680 = (selector) =>
  parseCssRules(realCss).find(
    (r) => r.selector === selector && r.media.some((m) => /max-width:\s*680px/.test(m))
  );

/** 同 ruleIn680，但认逗号分组里的单个选择器（.a, .b { … } 里的 .b） */
const ruleIn680For = (selector) =>
  parseCssRules(realCss).find(
    (r) =>
      r.media.some((m) => /max-width:\s*680px/.test(m)) &&
      r.selector.split(",").map((x) => x.trim()).includes(selector)
  );

const declOf = (rule, prop) => rule?.decls.find((d) => d.prop === prop)?.value;

test("手机端卡片：.project-head 的内边距与行距是收紧后的一档", () => {
  const rule = ruleIn680(".project-head");
  assert.ok(rule, "@media (max-width: 680px) 里必须有 .project-head");
  // v0.35.6：上 10px、左右 16px、下 0（底部留白交给操作条自己）
  assert.equal(declOf(rule, "padding"), "10px var(--sp-4) 0");
  assert.equal(declOf(rule, "row-gap"), "2px");
  const actions = ruleIn680(".project-head-actions");
  assert.equal(declOf(actions, "margin"), "2px 0 0");
});

test("手机端状态三选一：三等分网格铺满一行，不靠 flex-wrap", () => {
  const quick = ruleIn680(".kv-row-status .status-quick");
  assert.ok(quick, "@media (max-width: 680px) 里必须有 .kv-row-status .status-quick");
  assert.equal(declOf(quick, "display"), "grid");
  assert.equal(declOf(quick, "grid-template-columns"), "repeat(3, minmax(0, 1fr))");
  assert.equal(declOf(quick, "width"), "100%");
  const chip = ruleIn680(".kv-row-status .status-chip");
  assert.equal(declOf(chip, "min-width"), "0");
  // 桌面端仍是一行「标签 + 值」，不能被手机端的上下两段带跑
  const deskQuick = parseCssRules(realCss).find(
    (r) => r.selector === ".status-quick" && r.media.length === 0
  );
  assert.equal(declOf(deskQuick, "display"), "inline-flex");
});

// v0.35.6：手机端项目卡改「名称两行 / 元信息 + 倒计时同一行 / 操作条」三段网格。
// 名称与副标题、胶囊要能各自成为网格项，靠的是三层 display:contents；
// 桌面端卡头仍是 flex、胶囊仍跟着 project-head-top 排在一行。
test("v0.35.6 手机端：项目卡四列网格，倒计时与元信息同一行", () => {
  const head = ruleIn680(".project-head");
  assert.ok(head, "@media (max-width: 680px) 里必须有 .project-head");
  assert.equal(declOf(head, "display"), "grid");
  assert.equal(
    declOf(head, "grid-template-columns"),
    "10px minmax(0, 1fr) auto 44px"
  );
  for (const sel of [".project-head-right", ".project-head-main", ".project-head-top"]) {
    const r = ruleIn680For(sel);
    assert.ok(r, `@media (max-width: 680px) 里必须有 ${sel}`);
    assert.equal(declOf(r, "display"), "contents");
  }
  const pill = ruleIn680(".project-head-top .cd-pill");
  assert.equal(declOf(pill, "grid-column"), "3");
  assert.equal(declOf(pill, "grid-row"), "2");
  const sub = ruleIn680(".project-head .project-sub");
  assert.equal(declOf(sub, "grid-column"), "2");
  assert.equal(declOf(sub, "grid-row"), "2");
  const name = ruleIn680(".project-head .project-name");
  assert.equal(declOf(name, "grid-column"), "2 / span 2");
  assert.equal(declOf(name, "-webkit-line-clamp"), "2");
  const actions = ruleIn680(".project-head-actions");
  assert.equal(declOf(actions, "grid-row"), "3");
  // 桌面端卡头仍是 flex（不被网格带去）
  const deskHead = parseCssRules(realCss).find(
    (r) => r.selector === ".project-head" && r.media.length === 0
  );
  assert.equal(declOf(deskHead, "display"), "flex");
});

test("v0.35.6 手机端：工具栏第二行（选择 / 全部折叠 / 中标率）独占一行", () => {
  // 桌面端包裹层必须仍是 display:contents，否则那三项会从工具栏那一行里掉出去
  const deskActions = parseCssRules(realCss).find(
    (r) => r.selector === ".list-tools-actions" && r.media.length === 0
  );
  assert.ok(deskActions, "基础样式里应有 .list-tools-actions");
  assert.equal(declOf(deskActions, "display"), "contents");
  const actions = ruleIn680(".list-tools-actions");
  assert.ok(actions, "@media (max-width: 680px) 里必须有 .list-tools-actions");
  assert.equal(declOf(actions, "display"), "flex");
  assert.equal(declOf(actions, "flex"), "1 0 100%");
  // 排序 / 结果筛选变成胶囊
  const sort = ruleIn680(".list-tools .sort-select");
  assert.equal(declOf(sort, "height"), "40px");
  assert.equal(declOf(sort, "border-radius"), "10px");
});

test("v0.35.6 手机端：版本徽标回到标题旁，桌面隐藏", () => {
  const desk = parseCssRules(realCss).find(
    (r) => r.selector === ".app-version-badge" && r.media.length === 0
  );
  assert.ok(desk, "基础样式里应有 .app-version-badge");
  assert.equal(declOf(desk, "display"), "none");
  const badge = ruleIn680(".app-version-badge");
  assert.ok(badge, "@media (max-width: 680px) 里必须有 .app-version-badge");
  assert.equal(declOf(badge, "display"), "inline-block");
});

test("v0.35.7 手机端：项目名称完整回到详情区（折行不截），项目类型仍隐去，备注块状", () => {
  // 名称不再被隐去——卡头名称最多两行，长名字会被截，展开后要能看全
  const nameRule = ruleIn680For(".kv-row-name");
  assert.ok(nameRule, "@media (max-width: 680px) 里必须有 .kv-row-name");
  assert.notEqual(declOf(nameRule, "display"), "none", "项目名称不能再被隐去");
  // 名称与备注都是「标签一行、正文一行」的块状行
  assert.equal(declOf(nameRule, "flex-direction"), "column");
  const nameValue = ruleIn680(".kv-row-name .kv-value");
  assert.ok(nameValue, "@media (max-width: 680px) 里必须有 .kv-row-name .kv-value");
  assert.equal(declOf(nameValue, "text-align"), "left");
  assert.equal(declOf(nameValue, "white-space"), "normal");
  assert.equal(declOf(nameValue, "word-break"), "break-word");
  // 项目类型卡头元信息行已有，手机上仍隐去
  const hideType = ruleIn680For(".kv-row-type");
  assert.ok(hideType, "@media (max-width: 680px) 里必须有 .kv-row-type");
  assert.equal(declOf(hideType, "display"), "none");
  const note = ruleIn680For(".kv-row-note");
  assert.equal(declOf(note, "flex-direction"), "column");
  // 桌面端三项都不动（仍是原有 kv 行，名称本来就完整显示）
  for (const sel of [".kv-row-name", ".kv-row-type", ".kv-row-note"]) {
    const desk = parseCssRules(realCss).find(
      (r) => r.selector === sel && r.media.length === 0
    );
    assert.equal(desk, undefined, `${sel} 不应有桌面规则`);
  }
});

test("v0.35.7 手机端：保证金「查看」按钮文字上下居中（不再被 UA 的 flex-start 顶到上边）", () => {
  const btn = ruleIn680(".refund-tip .refund-open-btn");
  assert.ok(btn, "@media (max-width: 680px) 里必须有 .refund-tip .refund-open-btn");
  assert.equal(declOf(btn, "display"), "inline-flex");
  assert.equal(declOf(btn, "align-items"), "center");
  assert.equal(declOf(btn, "justify-content"), "center");
  // 行高不随父级 1.5 行高拉出半个行盒的上下留白
  assert.equal(declOf(btn, "line-height"), "1");
});

test("v0.35.7：废标检查清单默认收起、展开有过渡（手机与桌面同一套）", () => {
  // 收起/展开态由 JS 落到 .collapsed / .expanded，CSS 不再用 display:none
  const deskBody = parseCssRules(realCss).find(
    (r) => r.selector === ".checklist-body" && r.media.length === 0
  );
  assert.ok(deskBody, "基础样式里应有 .checklist-body");
  assert.equal(declOf(deskBody, "display"), "grid");
  assert.match(declOf(deskBody, "transition"), /grid-template-rows/);
  const collapsed = parseCssRules(realCss).find(
    (r) => r.selector === ".checklist.collapsed .checklist-body" && r.media.length === 0
  );
  assert.ok(collapsed, "基础样式里应有 .checklist.collapsed .checklist-body");
  assert.equal(declOf(collapsed, "grid-template-rows"), "0fr");
  const expanded = parseCssRules(realCss).find(
    (r) => r.selector === ".checklist-body" && r.media.length === 0
  );
  assert.equal(declOf(expanded, "grid-template-rows"), "1fr");
  // 内层 min-height:0 + overflow:hidden 是把高度收到 0 的必备条件
  const inner = parseCssRules(realCss).find(
    (r) => r.selector === ".checklist-body-inner" && r.media.length === 0
  );
  assert.ok(inner, "基础样式里应有 .checklist-body-inner");
  assert.equal(declOf(inner, "min-height"), "0");
  assert.equal(declOf(inner, "overflow"), "hidden");
  // 整条标题栏都是点击区（按钮），不再只有右边一颗 32px 小按钮
  const toggle = parseCssRules(realCss).find(
    (r) => r.selector === ".checklist-toggle" && r.media.length === 0
  );
  assert.ok(toggle, "基础样式里应有 .checklist-toggle");
  assert.equal(declOf(toggle, "display"), "flex");
  assert.equal(declOf(toggle, "flex"), "1");
  // 收着时不露「清空」（避免误触清掉整份清单）
  const hideClear = parseCssRules(realCss).find(
    (r) =>
      r.selector === ".checklist.collapsed .checklist-head .head-actions" &&
      r.media.length === 0
  );
  assert.ok(hideClear, "收起的清单必须隐藏「清空」");
  assert.equal(declOf(hideClear, "display"), "none");
  // 手机端整条标题栏 40px 高
  const tap = ruleIn680(".checklist-toggle");
  assert.ok(tap, "@media (max-width: 680px) 里必须有 .checklist-toggle");
  assert.equal(declOf(tap, "min-height"), "40px");
});

test("v0.35.6 手机端：卡片展开时收起浮动新增按钮", () => {
  const rule = ruleIn680("body.detail-open .fab-add");
  assert.ok(rule, "@media (max-width: 680px) 里必须有 body.detail-open .fab-add");
  assert.equal(declOf(rule, "display"), "none");
});

test("v0.35.6 手机端：底部导航是 24px 单色 SVG 图标 + 更强毛玻璃", () => {
  const tabs = ruleIn680(".bottom-tabs");
  assert.match(declOf(tabs, "backdrop-filter"), /blur\(20px\) saturate\(180%\)/);
  const icon = ruleIn680(".bottom-tab-icon svg");
  assert.equal(declOf(icon, "width"), "24px");
  assert.equal(declOf(icon, "height"), "24px");
});

test("v0.35.5 手机端：临期卡一屏一张 + 名称两行", () => {
  const item = ruleIn680(".upcoming-item");
  assert.ok(item);
  assert.equal(declOf(item, "min-width"), "0");
  assert.equal(declOf(item, "flex"), "0 0 calc(100% - 6px)");
  const name = ruleIn680(".upcoming-item .up-name");
  assert.equal(declOf(name, "-webkit-line-clamp"), "2");
  // 桌面端仍是 248px
  const deskItem = parseCssRules(realCss).find(
    (r) => r.selector === ".upcoming-item" && r.media.length === 0
  );
  assert.equal(declOf(deskItem, "flex"), "0 0 248px");
});

test("v0.35.5 手机端：长提示左右留白、输入框 16px、抽屉安全区、收起态隐藏表单", () => {
  const toast = ruleIn680(".toast-wrap");
  assert.equal(declOf(toast, "left"), "16px");
  assert.equal(declOf(toast, "right"), "16px");
  assert.equal(declOf(toast, "transform"), "none");
  const input = ruleIn680(
    ".search-box input, .sort-select, .field input, .field select, .field textarea, .checklist-new-input, .settings-group input, input, select, textarea"
  );
  assert.ok(input, "输入控件 16px 那条兜底必须在 680 块里");
  assert.equal(declOf(input, "font-size"), "16px");
  const sheet = ruleIn680(".sheet-panel");
  assert.match(declOf(sheet, "padding-bottom"), /env\(safe-area-inset-bottom\)/);
  const form = ruleIn680(".form-panel:not(.expanded)");
  assert.equal(declOf(form, "display"), "none");
  // 桌面端表单仍在文档流里
  const deskForm = parseCssRules(realCss).find(
    (r) => r.selector === ".form-panel:not(.expanded)" && r.media.length === 0
  );
  assert.equal(deskForm, undefined);
});
