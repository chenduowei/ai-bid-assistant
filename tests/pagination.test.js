import { test } from "node:test";
import assert from "node:assert/strict";
import {
  paginateItems,
  expandLimitForIndex,
  PAGE_SIZE,
} from "../js/utils.js";

const makeItems = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

test("paginateItems：首屏只取前 limit 条，remaining 为剩余数", () => {
  const { visible, remaining } = paginateItems(makeItems(120), 50);
  assert.equal(visible.length, 50);
  assert.equal(visible[0].id, 1);
  assert.equal(visible[49].id, 50);
  assert.equal(remaining, 70);
});

test("paginateItems：不足一页时 remaining 为 0，结尾文案可显示", () => {
  const { visible, remaining } = paginateItems(makeItems(30), 50);
  assert.equal(visible.length, 30);
  assert.equal(remaining, 0);
});

test("paginateItems：limit 非法时回落默认页大小", () => {
  assert.equal(paginateItems(makeItems(120), 0).visible.length, PAGE_SIZE);
  assert.equal(paginateItems(makeItems(120), -5).visible.length, PAGE_SIZE);
  assert.equal(paginateItems(makeItems(120), undefined).visible.length, PAGE_SIZE);
});

test("expandLimitForIndex：目标在页内时 limit 不变", () => {
  assert.equal(expandLimitForIndex(50, 49), 50);
  assert.equal(expandLimitForIndex(50, 0), 50);
});

test("expandLimitForIndex：目标在页外时扩到含目标的那一页", () => {
  assert.equal(expandLimitForIndex(50, 50), 100);
  assert.equal(expandLimitForIndex(50, 120), 150);
  assert.equal(expandLimitForIndex(100, 120), 150);
});

test("expandLimitForIndex：目标不存在（-1）时 limit 不变", () => {
  assert.equal(expandLimitForIndex(50, -1), 50);
});
