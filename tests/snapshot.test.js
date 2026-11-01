import { test } from "node:test";
import assert from "node:assert/strict";
import {
  saveProjectsSnapshot,
  loadProjectsSnapshot,
  SNAPSHOT_KEY,
} from "../js/utils.js";

// localStorage 替身（Map 语义与 localStorage 的 getItem/setItem 一致）
const memoryStorage = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k),
  };
};

test("快照：保存后可读回，且 pdfText 已剥离（全文不上 localStorage）", () => {
  const storage = memoryStorage();
  const projects = [
    { id: "1", name: "A 项目", pdfText: "很长很长的招标全文……", pdfFilename: "标书.pdf" },
    { id: "2", name: "B 项目" },
  ];
  assert.equal(saveProjectsSnapshot(storage, projects), true);
  const snap = loadProjectsSnapshot(storage);
  assert.equal(snap.projects.length, 2);
  assert.equal(snap.projects[0].name, "A 项目");
  assert.equal(snap.projects[0].pdfFilename, "标书.pdf");
  assert.equal("pdfText" in snap.projects[0], false);
  assert.ok(snap.savedAt > 0);
});

test("快照：无快照时读回 null", () => {
  assert.equal(loadProjectsSnapshot(memoryStorage()), null);
});

test("快照：脏数据读回 null，不抛错", () => {
  const storage = memoryStorage();
  storage.setItem(SNAPSHOT_KEY, "{不是 json");
  assert.equal(loadProjectsSnapshot(storage), null);
  storage.setItem(SNAPSHOT_KEY, JSON.stringify({ projects: "不是数组" }));
  assert.equal(loadProjectsSnapshot(storage), null);
});

test("快照：存储配额满时保存返回 false，不抛错", () => {
  const storage = memoryStorage();
  storage.setItem = () => {
    throw new Error("QuotaExceededError");
  };
  assert.equal(saveProjectsSnapshot(storage, [{ id: "1" }]), false);
});
