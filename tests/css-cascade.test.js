/**
 * v0.35.3：styles.css 的跨断点顺序覆盖检查（scripts/check-css.mjs）的行为测试。
 * 起因：v0.35.2 手机端「底部导航 / 浮动新增 / 统计卡标签 / 3 列网格」四条优化全部失效，
 * 根因都是同一选择器在 max-width 块里写过、又被文件更后面的同优先级规则盖掉。
 * 这些用例把「该抓到 / 不该误报」两边都钉住，避免以后有人把断点块又挪回文件中部。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeCss, findCascadeOverrides } from "../scripts/check-css.mjs";

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
  assert.equal(spread.spread[0][0], "max-width: 680px");
});

test("大括号不平衡能被发现", () => {
  assert.equal(analyzeCss(`.a { color: red; }`).bracesOk, true);
  assert.equal(analyzeCss(`.a { color: red; `).bracesOk, false);
});
