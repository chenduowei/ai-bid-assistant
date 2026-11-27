/**
 * v1.0.7：点开项目卡片时，被点的标题行与整张列表不再往下动一下。
 *
 * v1.0.6 把 `.project-item.expanded` 的 `margin: 6px 0` 放进了过渡，抖动变成了 320ms 的
 * 慢推——用户真机实测仍然是「点开就往下挪一点」。根因是展开态自己带纵向外边距：
 * 收起 0 → 展开 6px，被点的这一行立刻/缓慢下移 6px，下面整段列表一起 +12px。
 *
 * 现在纵向外边距恒为 0，展开态只靠底色、圆角、投影和左侧色条区分，行位置点开前后完全不动。
 * 用最小 CSS 规则集断言（linkedom 没有排版引擎，量不了像素，所以钉住「规则里没有纵向 margin」
 * 这一条唯一前提；实际像素位移另用 Playwright 在 390 / 1280 两档实测为 0）。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readCssBundle } from "./css-bundle.mjs";
import { parseCssRules } from "../scripts/check-css.mjs";

const css = readCssBundle();
const rules = parseCssRules(css);

const decls = (rule) => rule.decls;
const hasMargin = (rule) =>
  decls(rule).some((d) => /^margin(-top|-bottom|-block|-block-start|-block-end)?$/.test(d.prop));

const expandedRules = rules.filter((r) =>
  r.selector.split(",").map((s) => s.trim()).includes(".project-item.expanded")
);

test("v1.0.7：.project-item.expanded 存在，展开态仍靠底色 / 圆角 / 投影区分", () => {
  assert.ok(expandedRules.length >= 1, "必须还有 .project-item.expanded 规则");
  const base = expandedRules.find((r) => r.media.length === 0);
  assert.ok(base, "基础样式里要有 .project-item.expanded");
  const prop = (p) => decls(base).find((d) => d.prop === p)?.value;
  assert.equal(prop("background"), "var(--surface)");
  assert.equal(prop("border-radius"), "14px");
  assert.match(prop("box-shadow") || "", /inset|rgba|var\(|0 0 0 1px/);
});

test("v1.0.7：任何断点下 .project-item.expanded 都不带 margin（点开不位移的唯一前提）", () => {
  assert.ok(expandedRules.length >= 1);
  for (const rule of expandedRules) {
    assert.equal(
      hasMargin(rule),
      false,
      `.project-item.expanded 不能有纵向 margin（${rule.selector} @ ${rule.media.join(" | ") || "base"}）`
    );
  }
  // 整份样式表里也不能再出现「展开态 6px 外边距」这种写法
  assert.equal(/\.project-item\.expanded\s*\{[^}]*margin/.test(css), false, "样式表里不应再有 .project-item.expanded 的 margin");
});

test("v1.0.7：.project-item 的过渡清单里不再有 margin", () => {
  const t = rules
    .filter((r) => r.media.length === 0 && r.selector.split(",").map((s) => s.trim()).includes(".project-item"))
    .map((r) => decls(r).find((d) => d.prop === "transition")?.value)
    .filter(Boolean);
  assert.equal(t.length, 1, ".project-item 的 transition 仍只有一份");
  assert.equal(/\bmargin\b/.test(t[0]), false, "margin 已不是可动属性，不能再挂在过渡清单里");
  for (const prop of ["background-color", "border-color", "border-radius", "box-shadow", "transform"]) {
    assert.match(t[0], new RegExp(prop), `.project-item 的过渡仍要包含 ${prop}`);
  }
});

test("v1.0.7：展开态不再靠负 margin / transform 补偿（不允许换个写法继续推行）", () => {
  const base = expandedRules.find((r) => r.media.length === 0);
  const prop = (p) => decls(base).find((d) => d.prop === p)?.value;
  assert.equal(prop("transform"), undefined, "展开态不要用 transform 位移");
  assert.equal(prop("position"), undefined, "展开态不要脱离文档流（会改变行高计算）");
});
