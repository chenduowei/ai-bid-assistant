/**
 * 设置弹窗交互：提醒天数 / 浏览器通知 / 重置账户。
 * v0.51.5：从 app.js 抽出来 —— 这三块只碰设置弹窗自己的 DOM、通知权限与
 * 当前用户数据，彼此独立，抽出来改设置时不用通读整份入口。
 * 提醒天数存取在 js/utils.js（getReminderDays / setReminderDays），不重复抽；
 * 开标提醒的实际发送（sendBidNotifications / showMissedReminders）仍留在 app.js。
 *
 * 注入：elements / getState / setState / ui / projectsApi / getClient。
 * 返回：bindSettings() 绑全部事件；open / close / isOpen 供 Esc 链、退出登录与
 * 品牌首页“关最上层浮层”复用；updateNotificationRow() 供登录后刷新通知状态行。
 */
import { getReminderDays, setReminderDays } from "./utils.js";

export function createSettings({
  elements,
  getState,
  setState,
  ui,
  projectsApi,
  getClient,
}) {
  let settingsSheetOpen = false;
  let settingsOpener = null;
  // v0.6.0：重置账户双重确认的武装态（10 秒内有效）
  let resetArmed = false;
  let resetTimer = null;

  async function requestNotificationPermission() {
    // v0.35.3：只在设置里的「开启通知」按钮里调用（有用户手势）。登录时自动申请在 iOS 上
    // 本来就被忽略（Safari 与主屏 PWA 都要求手势触发），第一次点了「不允许」还会永久没机会。
    if (!("Notification" in window) || Notification.permission !== "default")
      return;
    try {
      const permission = await Notification.requestPermission();
      updateNotificationRow();
      if (permission === "granted") ui.showToast("已开启开标提醒通知。");
    } catch {
      ui.showToast("当前浏览器不支持通知。");
    }
  }

  /** v0.35.0：设置里的一行通知状态 —— 第一次登录拒绝后就再没有入口，也看不到当前状态。 */
  function updateNotificationRow() {
    if (!elements.notifStatus) return;
    const supported = "Notification" in window;
    const permission = supported ? Notification.permission : "unsupported";
    const text =
      permission === "granted"
        ? "已开启"
        : permission === "denied"
          ? "已被浏览器阻止"
          : permission === "unsupported"
            ? "当前浏览器不支持"
            : "未开启";
    elements.notifStatus.textContent = text;
    if (elements.notifBtn) {
      elements.notifBtn.textContent =
        permission === "granted" ? "已开启" : permission === "denied" ? "去浏览器设置" : "开启通知";
      elements.notifBtn.disabled = permission === "granted" || permission === "unsupported";
    }
  }

  // v0.34.0：设置改为居中弹窗（桌面）/ 底部抽屉（移动）—— 之前是页面内面板，一点就把
  // 项目列表整块推下去；现在盖在页面上，遮罩点击 / Esc / 关闭按钮关闭，焦点锁在层内，关后回到菜单按钮。
  const openSettingsSheet = async () => {
    if (settingsSheetOpen) return;
    settingsSheetOpen = true;
    settingsOpener = document.activeElement;
    elements.settingsSheet?.classList.remove("hidden");
    document.body.classList.add("sheet-open");
    ui.trapFocusIn(elements.settingsSheet);
    elements.settingsSheetClose?.focus();
    if (elements.reminderDays) {
      elements.reminderDays.value = String(getReminderDays());
    }
    updateNotificationRow();
  };
  const closeSettingsSheet = () => {
    if (!settingsSheetOpen) return;
    settingsSheetOpen = false;
    ui.releaseFocusTrap(elements.settingsSheet);
    elements.settingsSheet?.classList.add("hidden");
    // 确认框可能还盖在上面（如重置账户），滚动锁交给它自己收尾
    if (
      !elements.confirmDialog ||
      elements.confirmDialog.classList.contains("hidden")
    ) {
      document.body.classList.remove("sheet-open");
    }
    const opener = settingsOpener;
    settingsOpener = null;
    // 打开它的菜单项随菜单一起收起了（不可见），就回 ☰；否则回原按钮
    ui.restoreFocusTo(opener);
  };

  const bindSettings = () => {
    elements.aiSettingsBtn?.addEventListener("click", openSettingsSheet);
    // v0.35.0：通知权限在应用里终于可见可开 —— 已拒绝时给去站点设置的说明。
    elements.notifBtn?.addEventListener("click", async () => {
      const perm = "Notification" in window ? Notification.permission : "unsupported";
      if (perm === "unsupported") {
        ui.showToast("当前浏览器不支持通知。");
        return;
      }
      if (perm === "denied") {
        ui.showToast("浏览器已阻止通知：在地址栏的站点设置里把「通知」改为允许，然后刷新页面。");
        return;
      }
      await requestNotificationPermission();
      updateNotificationRow();
    });
    elements.settingsSheetClose?.addEventListener("click", closeSettingsSheet);
    elements.settingsSheet?.addEventListener("click", (event) => {
      if (event.target.closest("[data-action='close-settings']")) closeSettingsSheet();
    });
    elements.aiSaveSettings?.addEventListener("click", async () => {
      const days = setReminderDays(elements.reminderDays?.value);
      if (elements.reminderDays) elements.reminderDays.value = String(days);
      ui.render();
      ui.showToast(`设置已保存，提醒窗口为未来 ${days} 天。`);
      closeSettingsSheet();
    });

    // v0.6.0：重置账户（双重确认，只删当前用户数据）
    elements.resetAccountBtn?.addEventListener("click", async () => {
      const btn = elements.resetAccountBtn;
      if (!resetArmed) {
        resetArmed = true;
        btn.textContent = "再次点击确认重置";
        btn.classList.add("armed");
        ui.showToast("再次点击确认重置，10 秒内有效；确认后需打字输入「确认重置」，再自动下载备份并清空数据。");
        resetTimer = setTimeout(() => {
          resetArmed = false;
          btn.textContent = "重置账户";
          btn.classList.remove("armed");
        }, 10000);
        return;
      }
      clearTimeout(resetTimer);
      resetArmed = false;
      btn.textContent = "重置账户";
      btn.classList.remove("armed");
      btn.disabled = true;
      try {
        const state = getState();
        const uid = state.user?.id;
        if (!uid) throw new Error("未登录");
        // v0.32.0：打字确认 —— 必须输入「确认重置」才能继续，输错 / 取消都不执行。
        const typed = await ui.confirmDialog({
          title: "确认重置账户",
          message: "重置将先自动下载一份项目备份（不含资质库；资质库不受重置影响），再删除全部项目与通知记录，且无法撤销。",
          confirmText: "确认重置并清空",
          cancelText: "取消",
          danger: true,
          requireTyping: "确认重置",
        });
        if (!typed) return;
        // v0.28.0：重置前先自动下载一份项目备份；备份失败则不执行重置。
        const backedUp = await projectsApi.exportBackup();
        if (!backedUp) {
          ui.showToast("备份失败，未执行重置，请检查网络后重试。");
          return;
        }
        const client = getClient();
        if (!client) throw new Error("未登录");
        const { error: e1 } = await client
          .from("projects")
          .delete()
          .eq("user_id", uid);
        if (e1) throw e1;
        // notification_log 可能不存在（旧库），不存在则跳过
        const { error: e2 } = await client
          .from("notification_log")
          .delete()
          .eq("user_id", uid);
        if (e2 && e2.code !== "42P01") throw e2;
        state.selectedIds.clear();
        state.expandedIds.clear();
        await projectsApi.loadProjects();
        ui.render();
        ui.showToast("账户已重置，全部项目与通知记录已删除。");
        // v0.34.0：重置完把设置弹窗也收了，让用户直接看到清空后的主界面
        closeSettingsSheet();
      } catch (err) {
        ui.showToast(`重置失败：${err?.message || err}`);
      } finally {
        btn.disabled = false;
      }
    });
  };

  return {
    bindSettings,
    open: openSettingsSheet,
    close: closeSettingsSheet,
    isOpen: () => settingsSheetOpen,
    updateNotificationRow,
  };
}
