/**
 * 抽屉（sheets）交互：保证金待退还 / 我的资质 / 日历订阅 / 回收站。
 * v0.35.0：从 app.js 的 bindEvents（原约 1430 行）里抽出来 —— 这四块只碰自己的 DOM、
 * state 与 projectsApi，彼此独立，抽出来改抽屉时不用通读整份事件绑定。
 * 确认框本来就在 js/ui.js；设置弹窗仍留在 app.js（与提醒、重置账户耦合）。
 *
 * 注入：elements / getState / setState / ui / projectsApi。
 * 返回：bindDrawers() 绑全部事件；closeTop() 供品牌首页等“关最上层浮层”复用。
 */
export function createDrawers({ elements, getState, setState, ui, projectsApi }) {
  let guaranteeOpen = false;
  let qualOpen = false;
  let calendarOpen = false;
  let trashOpen = false;
  let openerGuarantee = null;
  let openerQual = null;
  let openerCalendar = null;
  let openerTrash = null;
  let editingQualId = null;
  let calendarToken = null;

  /* ---------------- 保证金待退还 ---------------- */
  const openGuaranteeSheet = () => {
    guaranteeOpen = true;
    openerGuarantee = document.activeElement;
    elements.guaranteeSheet?.classList.remove("hidden");
    document.body.classList.add("sheet-open");
    ui.trapFocusIn(elements.guaranteeSheet);
    elements.guaranteeSheetClose?.focus();
  };
  const closeGuaranteeSheet = () => {
    if (!guaranteeOpen) return;
    guaranteeOpen = false;
    ui.releaseFocusTrap(elements.guaranteeSheet);
    elements.guaranteeSheet?.classList.add("hidden");
    document.body.classList.remove("sheet-open");
    // v0.35.0：入口在 ☰ 菜单里、菜单可能已收起 —— 看不见就回 ☰，别让焦点落到 body。
    ui.restoreFocusTo(openerGuarantee);
  };

  /* ---------------- 我的资质 ---------------- */
  const clearQualForm = () => {
    editingQualId = null;
    if (elements.qualCategory) elements.qualCategory.value = "施工资质";
    if (elements.qualName) elements.qualName.value = "";
    if (elements.qualDetails) elements.qualDetails.value = "";
    if (elements.qualExpires) elements.qualExpires.value = "";
    if (elements.qualSaveBtn) elements.qualSaveBtn.textContent = "保存资质";
    elements.qualCancelEditBtn?.classList.add("hidden");
  };
  const openQualSheet = () => {
    qualOpen = true;
    openerQual = document.activeElement;
    ui.renderQualList(getState().qualifications);
    elements.qualSheet?.classList.remove("hidden");
    document.body.classList.add("sheet-open");
    ui.trapFocusIn(elements.qualSheet);
    elements.qualSheetClose?.focus();
  };
  const closeQualSheet = () => {
    if (!qualOpen) return;
    qualOpen = false;
    ui.releaseFocusTrap(elements.qualSheet);
    elements.qualSheet?.classList.add("hidden");
    document.body.classList.remove("sheet-open");
    clearQualForm();
    ui.restoreFocusTo(openerQual);
  };

  /* ---------------- 日历订阅 ---------------- */
  const calendarUrl = (token) => `${window.location.origin}/api/calendar?token=${token}`;
  const renderCalendarSheet = () => {
    const hasToken = Boolean(calendarToken);
    elements.calendarEmpty?.classList.toggle("hidden", hasToken);
    elements.calendarActive?.classList.toggle("hidden", !hasToken);
    // 表未建时提示执行第 10 节（否则点生成没反应，用户不知道为什么）。
    elements.calendarSetupHint?.classList.toggle(
      "hidden",
      hasToken || !projectsApi.isCalendarTableMissing()
    );
    if (hasToken && elements.calendarUrlInput)
      elements.calendarUrlInput.value = calendarUrl(calendarToken);
  };
  const openCalendarSheet = async () => {
    calendarOpen = true;
    openerCalendar = document.activeElement;
    calendarToken = await projectsApi.getCalendarToken();
    renderCalendarSheet();
    elements.calendarSheet?.classList.remove("hidden");
    document.body.classList.add("sheet-open");
    ui.trapFocusIn(elements.calendarSheet);
    elements.calendarSheetClose?.focus();
  };
  const closeCalendarSheet = () => {
    if (!calendarOpen) return;
    calendarOpen = false;
    ui.releaseFocusTrap(elements.calendarSheet);
    elements.calendarSheet?.classList.add("hidden");
    document.body.classList.remove("sheet-open");
    ui.restoreFocusTo(openerCalendar);
  };

  /* ---------------- 回收站 ---------------- */
  const refreshTrashList = async () => {
    if (!trashOpen) return;
    const deleted = await projectsApi.loadDeletedProjects();
    ui.renderTrashList(deleted);
    // v0.22.0：回收站为空时禁用清空按钮，避免对着空抽屉点确认框。
    if (elements.emptyTrashBtn) elements.emptyTrashBtn.disabled = !deleted?.length;
  };
  const openTrashSheet = async () => {
    setState({ trashLimit: 50 }); // v0.30.0：每次打开回收站都从第一页看起
    trashOpen = true;
    openerTrash = document.activeElement;
    elements.trashSheet?.classList.remove("hidden");
    ui.trapFocusIn(elements.trashSheet);
    document.body.classList.add("sheet-open");
    ui.showTrashSkeleton();
    await refreshTrashList();
    elements.trashSheetClose?.focus();
  };
  const closeTrashSheet = () => {
    if (!trashOpen) return;
    trashOpen = false;
    ui.releaseFocusTrap(elements.trashSheet);
    elements.trashSheet?.classList.add("hidden");
    document.body.classList.remove("sheet-open");
    ui.restoreFocusTo(openerTrash);
  };

  /** 关闭最上层抽屉（不含菜单 / 设置）；关掉了一个返回 true。 */
  const closeTop = () => {
    if (trashOpen) {
      closeTrashSheet();
      return true;
    }
    if (guaranteeOpen) {
      closeGuaranteeSheet();
      return true;
    }
    if (qualOpen) {
      closeQualSheet();
      return true;
    }
    if (calendarOpen) {
      closeCalendarSheet();
      return true;
    }
    return false;
  };

  const bindDrawers = () => {
    // 保证金清单：菜单入口 / 统计卡片打开，关闭按钮 / 遮罩 / Esc 关闭
    elements.guaranteeMenuBtn?.addEventListener("click", openGuaranteeSheet);
    elements.guaranteeSheetClose?.addEventListener("click", closeGuaranteeSheet);
    elements.guaranteeSheet?.addEventListener("click", (event) => {
      if (event.target.closest("[data-action='close-guarantee']")) closeGuaranteeSheet();
    });
    elements.guaranteeStatCard?.addEventListener("click", openGuaranteeSheet);

    // 我的资质
    elements.qualMenuBtn?.addEventListener("click", openQualSheet);
    elements.qualSheetClose?.addEventListener("click", closeQualSheet);
    elements.qualSheet?.addEventListener("click", (event) => {
      if (event.target.closest("[data-action='close-qual']")) closeQualSheet();
    });
    elements.qualSaveBtn?.addEventListener("click", async () => {
      const btn = elements.qualSaveBtn;
      btn.disabled = true;
      const ok = await projectsApi.saveQualification(
        {
          category: elements.qualCategory?.value,
          name: elements.qualName?.value,
          details: elements.qualDetails?.value,
          expires_at: elements.qualExpires?.value,
        },
        editingQualId
      );
      btn.disabled = false;
      if (ok) {
        clearQualForm();
        ui.renderQualList(getState().qualifications);
      }
    });
    elements.qualCancelEditBtn?.addEventListener("click", clearQualForm);
    elements.qualList?.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const id = button.dataset.id;
      if (button.dataset.action === "qual-edit") {
        const q = getState().qualifications.find((item) => item.id === id);
        if (!q) return;
        editingQualId = q.id;
        if (elements.qualCategory) elements.qualCategory.value = q.category;
        if (elements.qualName) elements.qualName.value = q.name;
        if (elements.qualDetails) elements.qualDetails.value = q.details || "";
        if (elements.qualExpires) elements.qualExpires.value = q.expires_at || "";
        if (elements.qualSaveBtn) elements.qualSaveBtn.textContent = "保存修改";
        elements.qualCancelEditBtn?.classList.remove("hidden");
        elements.qualName?.focus();
      }
      if (button.dataset.action === "qual-delete") {
        const ok = await projectsApi.deleteQualification(id);
        if (ok) {
          if (editingQualId === id) clearQualForm();
          ui.renderQualList(getState().qualifications);
        }
      }
    });

    // 日历订阅
    elements.calendarMenuBtn?.addEventListener("click", openCalendarSheet);
    elements.calendarSheetClose?.addEventListener("click", closeCalendarSheet);
    elements.calendarSheet?.addEventListener("click", (event) => {
      if (event.target.closest("[data-action='close-calendar']")) closeCalendarSheet();
    });
    elements.calendarGenerateBtn?.addEventListener("click", async () => {
      const btn = elements.calendarGenerateBtn;
      btn.disabled = true;
      const token = await projectsApi.createCalendarToken();
      btn.disabled = false;
      if (!token) return;
      calendarToken = token;
      renderCalendarSheet();
      ui.showToast("订阅链接已生成，复制到日历 App 即可订阅。");
    });
    elements.calendarCopyBtn?.addEventListener("click", async () => {
      const url = elements.calendarUrlInput?.value || "";
      if (!url) return;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        elements.calendarUrlInput?.select();
        document.execCommand("copy");
      }
      ui.showToast("订阅链接已复制。");
    });
    elements.calendarRegenBtn?.addEventListener("click", async () => {
      const ok = await ui.confirmDialog({
        title: "重新生成订阅链接",
        message: "旧链接会立即失效，日历 App 里需要重新粘贴新链接。确定重新生成吗？",
        confirmText: "重新生成",
        cancelText: "取消",
      });
      if (!ok) return;
      const revoked = await projectsApi.revokeCalendarTokens();
      if (!revoked) return;
      const token = await projectsApi.createCalendarToken();
      if (!token) return;
      calendarToken = token;
      renderCalendarSheet();
      ui.showToast("已生成新订阅链接，旧链接已失效。");
    });
    elements.calendarRevokeBtn?.addEventListener("click", async () => {
      const ok = await ui.confirmDialog({
        title: "停用订阅",
        message: "停用后日历 App 将不再同步新的开标日程，已同步的日程不受影响。确定停用吗？",
        confirmText: "停用订阅",
        cancelText: "取消",
        danger: true,
      });
      if (!ok) return;
      const revoked = await projectsApi.revokeCalendarTokens();
      if (!revoked) return;
      calendarToken = null;
      renderCalendarSheet();
      ui.showToast("订阅已停用。");
    });

    // 保证金退还提醒横幅 + 保证金清单：标记已退回（共用一套更新路径）
    const handleMarkRefunded = async (event) => {
      // v0.35.5：手机端横幅收成一行，「查看」打开保证金抽屉（逐条「标记已退还」在那里）
      if (event.target.closest('button[data-action="open-guarantee"]')) {
        openGuaranteeSheet();
        return;
      }
      const button = event.target.closest('button[data-action="mark-refunded"]');
      if (!button) return;
      const ok = await projectsApi.updateProjectFields(button.dataset.id, {
        guaranteeStatus: "已退回",
      });
      if (ok) ui.showToast("已标记为已退回。");
    };
    elements.refundTip?.addEventListener("click", handleMarkRefunded);
    elements.guaranteeList?.addEventListener("click", handleMarkRefunded);

    // 回收站
    elements.trashMenuBtn?.addEventListener("click", openTrashSheet);
    elements.trashSheetClose?.addEventListener("click", closeTrashSheet);
    elements.trashSheet?.addEventListener("click", (event) => {
      if (event.target.closest("[data-action='close-trash']")) closeTrashSheet();
    });
    // v0.35.3：四个抽屉的 Esc 不再各注册一份 —— 统一走 closeTop()，由 app.js 那一个 keydown 调。
    // v0.22.0：清空回收站 —— 先取最新列表（防抽屉开着时数据已变），
    // 空了直接提示；有内容则走批量彻底删除（自带确认框），成功后刷新列表。
    elements.emptyTrashBtn?.addEventListener("click", async () => {
      const btn = elements.emptyTrashBtn;
      btn.disabled = true;
      const deleted = await projectsApi.loadDeletedProjects();
      if (!deleted?.length) {
        ui.showToast("回收站已经是空的。");
        return; // 本来就是空的，保持禁用
      }
      const ok = await projectsApi.permanentlyDeleteProjects(deleted.map((p) => p.id));
      if (ok) {
        await refreshTrashList(); // 列表已空，按钮保持禁用
        return;
      }
      btn.disabled = false; // 用户在确认框点了取消，恢复可点
    });
    elements.trashList?.addEventListener("click", async (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      const id = button.dataset.id;
      if (button.dataset.action === "restore") {
        await projectsApi.restoreProject(id);
        await refreshTrashList();
      }
      if (button.dataset.action === "permanent-delete") {
        const ok = await projectsApi.permanentlyDeleteProject(id, button.dataset.name);
        if (ok) await refreshTrashList();
      }
      // v0.30.0：回收站“加载更多”——每页 50 条，续一页。
      if (button.dataset.action === "trash-load-more") {
        setState({ trashLimit: (getState().trashLimit || 50) + 50 });
        await refreshTrashList();
      }
    });
  };

  return {
    bindDrawers,
    closeTop,
    closeTrashSheet,
    openGuaranteeSheet,
    closeGuaranteeSheet,
    closeQualSheet,
    closeCalendarSheet,
    isTrashOpen: () => trashOpen,
  };
}
