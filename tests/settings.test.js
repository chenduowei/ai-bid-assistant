/**
 * v0.51.5：设置弹窗模块（js/settings.js）从 app.js 抽出后的行为测试。
 * 只加载 index.html 骨架 + settings.js，不跑 app.js、不碰网络。
 * 守的是：开/关弹窗、通知状态行、保存提醒天数、重置账户双重确认，
 * 以及 app.js 里不再残留被抽走的定义、sw.js 离线壳已补上新模块。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const swJs = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const { window, document } = parseHTML(html);

globalThis.window = window;
globalThis.document = document;
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { createSettings } = await import("../js/settings.js");
const { getReminderDays } = await import("../js/utils.js");

const IDS = [
  "settingsSheet",
  "settingsSheetClose",
  "reminderDays",
  "notifStatus",
  "notifBtn",
  "aiSettingsBtn",
  "aiSaveSettings",
  "resetAccountBtn",
  "confirmDialog",
];
const elements = {};
for (const id of IDS) elements[id] = document.getElementById(id);

const state = {
  user: { id: "u1", email: "a@example.com" },
  selectedIds: new Set(["p1"]),
  expandedIds: new Set(["p1"]),
};
const toasts = [];
const ui = {
  showToast: (msg) => toasts.push(msg),
  trapFocusIn: () => {},
  releaseFocusTrap: () => {},
  restoreFocusTo: () => {},
  render: () => {},
  confirmDialog: async () => true,
};
const dbCalls = [];
const client = {
  from: (table) => ({
    delete: () => ({
      eq: async (col, val) => {
        dbCalls.push([table, col, val]);
        return { error: null };
      },
    }),
  }),
};
const projectsApi = {
  exportBackup: async () => true,
  loadProjects: async () => [],
};

const settings = createSettings({
  elements,
  getState: () => state,
  setState: (patch) => Object.assign(state, patch),
  ui,
  projectsApi,
  getClient: () => client,
});

const click = (el) => el.dispatchEvent(new window.Event("click", { bubbles: true }));

test("createSettings 返回 open/close/isOpen/updateNotificationRow/bindSettings", () => {
  for (const key of ["bindSettings", "open", "close", "isOpen", "updateNotificationRow"]) {
    assert.equal(typeof settings[key], "function", `应导出 ${key}`);
  }
  assert.equal(settings.isOpen(), false);
});

test("通知状态行：不支持 / 已开启 / 未开启三态", () => {
  delete window.Notification;
  delete globalThis.Notification;
  settings.updateNotificationRow();
  assert.equal(elements.notifStatus.textContent, "当前浏览器不支持");
  assert.equal(elements.notifBtn.disabled, true);

  const notif = { permission: "granted", requestPermission: async () => "granted" };
  window.Notification = notif;
  globalThis.Notification = notif;
  settings.updateNotificationRow();
  assert.equal(elements.notifStatus.textContent, "已开启");
  assert.equal(elements.notifBtn.textContent, "已开启");
  assert.equal(elements.notifBtn.disabled, true);

  notif.permission = "default";
  settings.updateNotificationRow();
  assert.equal(elements.notifStatus.textContent, "未开启");
  assert.equal(elements.notifBtn.textContent, "开启通知");
  assert.equal(elements.notifBtn.disabled, false);
});

test("开/关设置弹窗：菜单按钮开、关闭按钮关、保存后关", () => {
  settings.bindSettings();
  assert.equal(settings.isOpen(), false);
  click(elements.aiSettingsBtn);
  assert.equal(settings.isOpen(), true);
  assert.equal(elements.settingsSheet.classList.contains("hidden"), false);
  // 打开时提醒天数回填当前值（默认 7）
  assert.equal(elements.reminderDays.value, String(getReminderDays()));
  click(elements.settingsSheetClose);
  assert.equal(settings.isOpen(), false);
  assert.equal(elements.settingsSheet.classList.contains("hidden"), true);
});

test("保存提醒天数：写 localStorage、提示、关弹窗", async () => {
  click(elements.aiSettingsBtn);
  elements.reminderDays.value = "14";
  click(elements.aiSaveSettings);
  assert.equal(store.get("bid-assistant-reminder-days"), "14");
  assert.ok(toasts.some((t) => t.includes("提醒窗口为未来 14 天")));
  assert.equal(settings.isOpen(), false);
  // 越界值被规范化回默认值 7
  click(elements.aiSettingsBtn);
  elements.reminderDays.value = "99";
  click(elements.aiSaveSettings);
  assert.equal(store.get("bid-assistant-reminder-days"), "7");
});

test("通知按钮：已拒绝时给站点设置说明，不申请权限", async () => {
  const notif = {
    permission: "denied",
    requestPermission: async () => {
      throw new Error("不应被调用");
    },
  };
  window.Notification = notif;
  globalThis.Notification = notif;
  const before = toasts.length;
  click(elements.notifBtn);
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(toasts.slice(before).some((t) => t.includes("站点设置")));
});

test("重置账户：第一次点击武装、第二次确认后删数据并关弹窗", async () => {
  click(elements.aiSettingsBtn);
  assert.equal(settings.isOpen(), true);
  click(elements.resetAccountBtn);
  assert.equal(elements.resetAccountBtn.textContent, "再次点击确认重置");
  assert.ok(toasts.some((t) => t.includes("再次点击确认重置")));
  // 10 秒武装期内第二次点击：确认框通过、备份成功、删两表
  click(elements.resetAccountBtn);
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(dbCalls, [
    ["projects", "user_id", "u1"],
    ["notification_log", "user_id", "u1"],
  ]);
  assert.equal(state.selectedIds.size, 0);
  assert.equal(state.expandedIds.size, 0);
  assert.ok(toasts.some((t) => t.includes("账户已重置")));
  assert.equal(settings.isOpen(), false);
  assert.equal(elements.resetAccountBtn.textContent, "重置账户");
});

test("静态契约：app.js 不再含被抽走的定义，sw.js 离线壳已补 settings.js", () => {
  assert.equal(appJs.includes("function requestNotificationPermission"), false);
  assert.equal(appJs.includes("function updateNotificationRow"), false);
  assert.equal(appJs.includes("const openSettingsSheet"), false);
  assert.equal(appJs.includes("const closeSettingsSheet"), false);
  assert.equal(appJs.includes("let resetArmed"), false);
  assert.ok(appJs.includes('import { createSettings } from "./js/settings.js"'));
  assert.ok(appJs.includes("settings.bindSettings()"));
  assert.ok(appJs.includes("settings.updateNotificationRow()"));
  assert.ok(appJs.includes("settings.isOpen()"));
  const shell = swJs.match(/const APP_SHELL = \[([\s\S]*?)\];/)[1];
  assert.ok(shell.includes('"./js/settings.js"'), "APP_SHELL 应含 ./js/settings.js");
});
