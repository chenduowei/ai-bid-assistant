/**
 * AI Bid Assistant — 入口
 * 模块：js/utils.js · auth.js · projects.js · pdf-parser.js · ai-extract.js · ui.js
 */
import { THEME_KEY, getReminderDays, setReminderDays, getMissedBidProjects, getDeadlineItems, buildChecklistFromAi, escapeHtml, debounce, parseCsvProjects, buildImportCsvTemplate, sheetRowsToCsv } from "./js/utils.js";
import { createUi } from "./js/ui.js";
import { createProjectsApi } from "./js/projects.js";
import { createAuth } from "./js/auth.js";
import { createPdfParser } from "./js/pdf-parser.js";
import {
  createAiExtract,
  saveAiConfig,
  loadAiConfigToForm,
} from "./js/ai-extract.js";

(() => {
  const config = window.SUPABASE_CONFIG || {};
  const configured =
    config.url &&
    config.anonKey &&
    !config.url.includes("YOUR_") &&
    !config.anonKey.includes("YOUR_");

  const elements = {
    authView: document.getElementById("authView"),
    appView: document.getElementById("appView"),
    authForm: document.getElementById("authForm"),
    authEmail: document.getElementById("authEmail"),
    authPassword: document.getElementById("authPassword"),
    authSubmit: document.getElementById("authSubmit"),
    authMessage: document.getElementById("authMessage"),
    authTabs: document.querySelectorAll(".auth-tab"),
    forgotPasswordBtn: document.getElementById("forgotPasswordBtn"),
    resendVerificationBtn: document.getElementById("resendVerificationBtn"),
    resetPasswordPanel: document.getElementById("resetPasswordPanel"),
    newPassword: document.getElementById("newPassword"),
    confirmPassword: document.getElementById("confirmPassword"),
    updatePasswordBtn: document.getElementById("updatePasswordBtn"),
    backToLoginBtn: document.getElementById("backToLoginBtn"),
    resetPasswordMessage: document.getElementById("resetPasswordMessage"),
    themeBtn: document.getElementById("themeBtn"),
    exportBtn: document.getElementById("exportBtn"),
    backupBtn: document.getElementById("backupBtn"),
    restoreBtn: document.getElementById("restoreBtn"),
    restoreFileInput: document.getElementById("restoreFileInput"),
    backupTip: document.getElementById("backupTip"),
    backupNowBtn: document.getElementById("backupNowBtn"),
    backupTipClose: document.getElementById("backupTipClose"),
    importBtn: document.getElementById("importBtn"),
    downloadTemplateBtn: document.getElementById("downloadTemplateBtn"),
    importFileInput: document.getElementById("importFileInput"),
    signOutBtn: document.getElementById("signOutBtn"),
    userEmail: document.getElementById("userEmail"),
    syncStatus: document.getElementById("syncStatus"),
    dashboardView: document.getElementById("dashboardView"),
    parserView: document.getElementById("parserView"),
    openParserBtn: document.getElementById("openParserBtn"),
    closeParserBtn: document.getElementById("closeParserBtn"),
    pdfInput: document.getElementById("pdfInput"),
    pdfProjectSelect: document.getElementById("pdfProjectSelect"),
    savePdfTextBtn: document.getElementById("savePdfTextBtn"),
    dropZone: document.getElementById("dropZone"),
    parserStatus: document.getElementById("parserStatus"),
    parseProgress: document.getElementById("parseProgress"),
    parseProgressText: document.getElementById("parseProgressText"),
    pdfFileName: document.getElementById("pdfFileName"),
    pdfPageCount: document.getElementById("pdfPageCount"),
    parsedText: document.getElementById("parsedText"),
    toggleTextBtn: document.getElementById("toggleTextBtn"),
    copyTextBtn: document.getElementById("copyTextBtn"),
    aiAnalyzeBtn: document.getElementById("aiAnalyzeBtn"),
    aiResultPanel: document.getElementById("aiResultPanel"),
    aiSettingsBtn: document.getElementById("aiSettingsBtn"),
    aiSettingsPanel: document.getElementById("aiSettingsPanel"),
    aiApiKey: document.getElementById("aiApiKey"),
    aiBaseUrl: document.getElementById("aiBaseUrl"),
    aiModel: document.getElementById("aiModel"),
    reminderDays: document.getElementById("reminderDays"),
    aiSaveSettings: document.getElementById("aiSaveSettings"),
    submitBtn: document.getElementById("submitBtn"),
    cancelBtn: document.getElementById("cancelBtn"),
    search: document.getElementById("search"),
    filterResultCount: document.getElementById("filterResultCount"),
    statusFilter: document.getElementById("statusFilter"),
    sortBy: document.getElementById("sortBy"),
    headerSubtitle: document.getElementById("headerSubtitle"),
    selectModeBtn: document.getElementById("selectModeBtn"),
    selectBar: document.getElementById("selectBar"),
    selectAllBtn: document.getElementById("selectAllBtn"),
    selectedCount: document.getElementById("selectedCount"),
    cancelSelectBtn: document.getElementById("cancelSelectBtn"),
    deleteSelectedBtn: document.getElementById("deleteSelectedBtn"),
    resetAccountBtn: document.getElementById("resetAccountBtn"),
    optionalToggle: document.getElementById("optionalToggle"),
    optionalBody: document.getElementById("optionalBody"),
    optionalCount: document.getElementById("optionalCount"),
    list: document.getElementById("list"),
    calendarView: document.getElementById("calendarView"),
    calendarGrid: document.getElementById("calendarGrid"),
    calendarTitle: document.getElementById("calendarTitle"),
    calendarDayTitle: document.getElementById("calendarDayTitle"),
    calendarDayList: document.getElementById("calendarDayList"),
    guaranteePanel: document.getElementById("guaranteePanel"),
    guaranteeList: document.getElementById("guaranteeList"),
    guaranteeCount: document.getElementById("guaranteeCount"),
    toggleGuaranteeBtn: document.getElementById("toggleGuaranteeBtn"),
    guaranteeStatCard: document.getElementById("guaranteeStatCard"),
    trashList: document.getElementById("trashList"),
    toggleTrashBtn: document.getElementById("toggleTrashBtn"),
    formBody: document.getElementById("formBody"),
    formSubtitle: document.getElementById("formSubtitle"),
    upcomingList: document.getElementById("upcomingList"),
    deadlineTip: document.getElementById("deadlineTip"),
    refundTip: document.getElementById("refundTip"),
    backToTop: document.getElementById("backToTop"),
    scrollProgress: document.getElementById("scrollProgress"),
    toastWrap: document.getElementById("toastWrap"),
    totalCount: document.getElementById("totalCount"),
    registeringCount: document.getElementById("registeringCount"),
    makingCount: document.getElementById("makingCount"),
    openedCount: document.getElementById("openedCount"),
    inTransitGuarantee: document.getElementById("inTransitGuarantee"),
    menuToggle: document.getElementById("menuToggle"),
    addProjectBtn: document.getElementById("addProjectBtn"),
    form: {
      date: document.getElementById("date"),
      type: document.getElementById("projectType"),
      name: document.getElementById("name"),
      biddingCompany: document.getElementById("biddingCompany"),
      tenderer: document.getElementById("tenderer"),
      amountValue: document.getElementById("amountValue"),
      amountUnit: document.getElementById("amountUnit"),
      guarantee: document.getElementById("guarantee"),
      guaranteeAmount: document.getElementById("guaranteeAmount"),
      guaranteeUnit: document.getElementById("guaranteeUnit"),
      guaranteeStatus: document.getElementById("guaranteeStatus"),
      registrationDeadline: document.getElementById("registrationDeadline"),
      inquiryDeadline: document.getElementById("inquiryDeadline"),
      clarificationDeadline: document.getElementById("clarificationDeadline"),
      guaranteeDeadline: document.getElementById("guaranteeDeadline"),
      contact: document.getElementById("contact"),
      status: document.getElementById("status"),
      notes: document.getElementById("notes"),
    },
  };

  let client = null;
  /** 最近一次 AI 分析结果，保存项目时一并写入 */
  let lastAiResult = null;
  /** 错过提醒每个会话只提示一次，避免 Realtime 刷新时反复刷屏 */
  let missedReminderShown = false;
  let trashVisible = false;
  /** 密码重置流程中：为 true 时 showApp 不切回工作台，停留在重置面板 */
  let passwordRecoveryActive = false;
  /** v0.4.0：搜索防抖 200ms（筛选/排序仍立即渲染） */
  const debouncedRender = debounce(() => ui.render(), 200);

  const state = {
    projects: [],
    editingId: null,
    darkMode: localStorage.getItem(THEME_KEY) === "dark",
    user: null,
    authMode: "login",
    realtimeReady: false,
    channel: null,
    /** v0.4.1：项目卡片详情展开态（内存 Set，render/筛选/排序/分页/保存后恢复） */
    expandedIds: new Set(),
    /** v0.4.3：新增 / 编辑表单默认折叠 */
    formExpanded: false,
    /** v0.6.0：选填信息默认折叠（与 formExpanded 独立） */
    optionalExpanded: false,
    /** v0.6.0：批量选择模式 */
    selectMode: false,
    selectedIds: new Set(),
    /** v0.8.0：列表 / 日历视图 + 日历年月/选中日（默认本月今天） */
    viewMode: "list",
    calYear: new Date().getFullYear(),
    calMonth: new Date().getMonth(),
    calSelected: null,
  };

  const getState = () => state;
  const setState = (patch) => Object.assign(state, patch);
  const getClient = () => client;

  /** v0.4.1：切换项目卡片展开 / 折叠。只更新对应卡片 DOM，不全量 ui.render()（避免焦点丢失）。 */
  const toggleProjectDetails = (toggleEl) => {
    const item = toggleEl.closest(".project-item");
    const details = item?.querySelector(".project-details");
    const id = toggleEl.dataset.id || item?.dataset.id;
    if (!item || !details || !id) return;
    const wasExpanded = state.expandedIds.has(id);
    if (wasExpanded) {
      state.expandedIds.delete(id);
    } else {
      state.expandedIds.add(id);
    }
    const expanded = !wasExpanded;
    details.classList.toggle("expanded", expanded);
    toggleEl.setAttribute("aria-expanded", String(expanded));
    item.classList.toggle("expanded", expanded);
  };

  /** v0.4.4：新增 / 编辑表单折叠。class 切换（grid 高度动画），只改 DOM + state，不触发 ui.render()。 */
  const setFormExpanded = (expanded) => {
    state.formExpanded = expanded;
    const body = elements.formBody;
    const panel = body?.closest(".form-panel");
    const title = panel?.querySelector('[data-action="toggle-form"]');
    if (body) body.classList.toggle("expanded", expanded);
    if (title) {
      title.setAttribute("aria-expanded", String(expanded));
      const pillLabel = title.querySelector(".form-pill-label");
      if (pillLabel) pillLabel.textContent = expanded ? "收起" : "展开";
    }
    if (panel) panel.classList.toggle("expanded", expanded);
  };

  /** v0.4.3：展开表单 → 滚动定位 → 高亮 → 聚焦第一个可见输入框 */
  const revealForm = () => {
    setFormExpanded(true);
    ui.highlightFormPanel();
    const first = elements.formBody?.querySelector(
      "input:not([type=hidden]), textarea, select"
    );
    if (first) setTimeout(() => first.focus({ preventScroll: true }), 60);
  };

  /** v0.6.0：选填信息折叠（只做 UI 切换，不清空已填值；与 formExpanded 独立） */
  const OPTIONAL_FIELDS = [
    "tenderer",
    "guarantee",
    "amountValue",
    "amountUnit",
    "guaranteeAmount",
    "guaranteeUnit",
    "guaranteeStatus",
    "registrationDeadline",
    "inquiryDeadline",
    "clarificationDeadline",
    "guaranteeDeadline",
    "notes",
  ];
  const setOptionalExpanded = (expanded) => {
    state.optionalExpanded = expanded;
    elements.optionalBody?.classList.toggle("expanded", expanded);
    elements.optionalToggle?.setAttribute("aria-expanded", String(expanded));
  };
  /** 选填区是否有"有效"值（单位/状态的默认值不算） */
  const hasOptionalValues = () =>
    OPTIONAL_FIELDS.some((k) => {
      const el = elements.form[k];
      if (!el || typeof el.value !== "string") return false;
      const v = el.value.trim();
      if (!v) return false;
      if (k === "amountUnit" && v === "万元") return false;
      if (k === "guaranteeUnit" && v === "万元") return false;
      if (k === "guaranteeStatus" && v === "未缴纳") return false;
      return true;
    });

  /** v0.6.0：批量选择模式 */
  const updateSelectBar = () => {
    const n = state.selectedIds.size;
    if (elements.selectedCount)
      elements.selectedCount.textContent = `已选 ${n} 项`;
    if (elements.deleteSelectedBtn)
      elements.deleteSelectedBtn.textContent = `删除所选（${n}）`;
    const filtered =
      typeof ui.getCurrentFilteredProjects === "function"
        ? ui.getCurrentFilteredProjects()
        : [];
    const allSelected =
      filtered.length > 0 &&
      filtered.every((p) => state.selectedIds.has(p.id));
    if (elements.selectAllBtn)
      elements.selectAllBtn.textContent = allSelected ? "取消全选" : "全选";
  };
  const enterSelectMode = () => {
    state.selectMode = true;
    state.selectedIds.clear();
    elements.selectBar?.classList.remove("hidden");
    ui.render();
    updateSelectBar();
  };
  const exitSelectMode = () => {
    state.selectMode = false;
    state.selectedIds.clear();
    elements.selectBar?.classList.add("hidden");
    ui.render();
  };
  const toggleSelectOne = (id) => {
    if (!id) return;
    if (state.selectedIds.has(id)) state.selectedIds.delete(id);
    else state.selectedIds.add(id);
    // 只更新该行复选框，不全量 render（保持滚动位置）
    const box = elements.list?.querySelector(
      `.project-item[data-id="${CSS.escape(String(id))}"] .select-check`
    );
    if (box)
      box.setAttribute(
        "aria-checked",
        state.selectedIds.has(id) ? "true" : "false"
      );
    updateSelectBar();
  };

  const ui = createUi(elements, getState);
  const projectsApi = createProjectsApi({ getClient, getState, setState, ui });
  const pdfParser = createPdfParser({ elements, ui });
  const aiExtract = createAiExtract({ ui });

  const resetForm = () => {
    Object.values(elements.form).forEach((input) => {
      if (input) input.value = "";
    });
    setOptionalExpanded(false); // v0.6.0：新建时选填区收起
    if (elements.form.status) elements.form.status.value = "报名中";
    if (elements.form.amountUnit) elements.form.amountUnit.value = "万元";
    if (elements.form.guaranteeUnit)
      elements.form.guaranteeUnit.value = "万元";
    if (elements.form.guaranteeStatus)
      elements.form.guaranteeStatus.value = "未缴纳";
    state.editingId = null;
    lastAiResult = null;
    elements.submitBtn.textContent = "新增项目";
    elements.cancelBtn.classList.add("hidden");
    elements.formBody?.closest(".form-panel")?.classList.remove("editing");
    if (elements.formSubtitle)
      elements.formSubtitle.textContent =
        "必填：开标时间、项目类型、项目名称、投标公司、联系人；其余选填。";
    setFormExpanded(false); // v0.4.3：保存成功 / 取消后自动收起表单
  };

  /** 表单数值解析：空字符串 / 非数字 / 负数 → null */
  const parseMoneyInput = (value) => {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const formData = () => {
    const base = {
      bid_date: elements.form.date.value,
      project_type: elements.form.type.value.trim(),
      name: elements.form.name.value.trim(),
      bidding_company: elements.form.biddingCompany.value.trim(),
      tenderer: elements.form.tenderer?.value.trim() || null,
      guarantee: elements.form.guarantee.value.trim() || null,
      amount_value: parseMoneyInput(elements.form.amountValue?.value),
      amount_unit: elements.form.amountUnit?.value || "万元",
      guarantee_amount: parseMoneyInput(elements.form.guaranteeAmount?.value),
      guarantee_unit: elements.form.guaranteeUnit?.value || "万元",
      guarantee_status: elements.form.guaranteeStatus?.value || "未缴纳",
      registration_deadline:
        elements.form.registrationDeadline?.value || null,
      inquiry_deadline: elements.form.inquiryDeadline?.value || null,
      clarification_deadline:
        elements.form.clarificationDeadline?.value || null,
      guarantee_deadline: elements.form.guaranteeDeadline?.value || null,
      contact: elements.form.contact.value.trim(),
      status: elements.form.status.value || "报名中",
      notes: elements.form.notes.value.trim() || null,
    };
    if (lastAiResult) {
      base.risk_summary = lastAiResult.riskSummary || null;
      base.risk_points = lastAiResult.riskPoints?.length
        ? lastAiResult.riskPoints
        : null;
      base.qualification = lastAiResult.qualification?.length
        ? lastAiResult.qualification
        : null;
      base.invalid_bid_clauses = lastAiResult.invalidBidClauses?.length
        ? lastAiResult.invalidBidClauses
        : null;
      base.extracted_meta = lastAiResult.extractedMeta || null;
    }
    return base;
  };

  async function requestNotificationPermission() {
    if (!("Notification" in window) || Notification.permission !== "default")
      return;
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") ui.showToast("已开启开标提醒通知。");
    } catch {
      ui.showToast("当前浏览器不支持通知。");
    }
  }

  // 注意：浏览器通知仅在页面打开时触发（setInterval），关页后不会提醒。
  // 关页提醒需部署 Edge Function，见 docs/reminders.md（用户已明确暂不需要）。
  // 多截止时间通知：遍历每个项目的全部截止项，days=0/1 时通知，文案带截止类型。
  function sendBidNotifications() {
    if (
      !("Notification" in window) ||
      Notification.permission !== "granted" ||
      !state.user
    )
      return;
    const urlHint = String(config.url || "").slice(-12);
    state.projects.forEach((project) => {
      for (const item of getDeadlineItems(project)) {
        if (item.days !== 0 && item.days !== 1) continue;
        const stage = item.days === 0 ? "today" : "tomorrow";
        const notificationKey = `bid-reminder:${urlHint}:${state.user.id}:${project.id}:${item.key}:${item.date}:${stage}`;
        if (localStorage.getItem(notificationKey)) continue;
        new Notification(`截止提醒：${project.name}`, {
          body: `${item.label}：${item.date}${item.days === 0 ? "（今日）" : "（明日）"}`,
          tag: `bid-${project.id}-${item.key}-${stage}`,
        });
        localStorage.setItem(notificationKey, "true");
      }
    });
  }

  function showMissedReminders() {
    if (missedReminderShown) return;
    missedReminderShown = true;
    const missed = getMissedBidProjects(state.projects);
    if (!missed.length) return;
    const names = missed.slice(0, 3).map((p) => `「${p.name}」`).join("、");
    const more = missed.length > 3 ? `等共 ${missed.length} 个` : "";
    ui.showToast(`${names}${more}已过开标时间，状态不是“已开标”，请核对（页面关闭时不提醒）。`);
  }

  async function refreshTrashList() {
    if (!trashVisible) return;
    const deleted = await projectsApi.loadDeletedProjects();
    ui.renderTrashList(deleted);
  }

  /** 解析页“保存到项目”下拉：列当前所有项目（名称 + 开标日期） */
  function refreshPdfProjectOptions() {
    const select = elements.pdfProjectSelect;
    if (!select) return;
    const current = select.value;
    select.innerHTML =
      '<option value="">请选择项目</option>' +
      state.projects
        .map(
          (p) =>
            `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}（${escapeHtml(p.date || "未设置开标时间")}）</option>`
        )
        .join("");
    if (current && state.projects.some((p) => p.id === current)) {
      select.value = current;
    }
  }

  /** 当前解析区对应的 PDF 文件名（从文件名栏解析，取不到则用默认名） */
  function getCurrentPdfFilename(fallback) {
    const label = elements.pdfFileName?.textContent || "";
    const match = label.match(/^(?:文件|已保存文件)：\s*(.+)$/);
    const name = (match?.[1] || "").trim();
    return name || fallback || "招标文件.pdf";
  }

  /** v0.4.0：显示密码重置面板（PASSWORD_RECOVERY 事件触发时调用） */
  function showResetPasswordPanel() {
    passwordRecoveryActive = true;
    elements.authView.classList.remove("hidden");
    elements.appView.classList.add("hidden");
    elements.authForm?.classList.add("hidden");
    elements.resetPasswordPanel?.classList.remove("hidden");
    if (elements.newPassword) elements.newPassword.value = "";
    if (elements.confirmPassword) elements.confirmPassword.value = "";
    if (elements.resetPasswordMessage) elements.resetPasswordMessage.textContent = "";
  }

  function hideResetPasswordPanel() {
    passwordRecoveryActive = false;
    elements.resetPasswordPanel?.classList.add("hidden");
    elements.authForm?.classList.remove("hidden");
  }

  // v0.8.0：30 天备份提醒（每次打开应用登录后检查一次，关闭后本次不再出现）
  let backupTipShown = false;
  const maybeShowBackupTip = () => {
    if (backupTipShown || !elements.backupTip) return;
    let last = null;
    try {
      last = localStorage.getItem("lastBackupAt");
    } catch {
      // 读失败视为未备份过
    }
    const t = last ? new Date(last).getTime() : NaN;
    const overdue =
      !Number.isFinite(t) || Date.now() - t > 30 * 24 * 3600 * 1000;
    if (!overdue) return;
    backupTipShown = true;
    elements.backupTip.classList.remove("hidden");
  };

  function showApp(user) {
    // 密码重置流程中：停留在重置面板，不切回工作台
    if (passwordRecoveryActive) return;
    if (
      state.user?.id === user.id &&
      !elements.appView.classList.contains("hidden")
    )
      return;
    state.user = user;
    elements.userEmail.textContent = user.email || "";
    elements.authView.classList.add("hidden");
    elements.appView.classList.remove("hidden");
    requestNotificationPermission();
    projectsApi.loadProjects().then((loaded) => {
      if (loaded) {
        refreshPdfProjectOptions();
        showMissedReminders();
        sendBidNotifications();
        maybeShowBackupTip(); // v0.8.0：登录后检查 30 天备份提醒
        projectsApi.purgeExpiredTrash();
        return projectsApi.migrateLocalProjects();
      }
    });
    projectsApi.subscribeToProjects(() => {
      projectsApi.loadProjects().then(() => {
        refreshPdfProjectOptions();
        sendBidNotifications();
      });
    });
  }

  function showAuth() {
    state.user = null;
    state.realtimeReady = false;
    passwordRecoveryActive = false;
    elements.resetPasswordPanel?.classList.add("hidden");
    elements.authForm?.classList.remove("hidden");
    elements.appView.classList.add("hidden");
    elements.authView.classList.remove("hidden");
    if (state.channel && client) {
      client.removeChannel(state.channel);
      state.channel = null;
    }
  }

  const auth = createAuth({
    getClient,
    setState,
    ui,
    onSignedIn: showApp,
    onSignedOut: showAuth,
    onPasswordRecovery: showResetPasswordPanel,
  });

  const showParser = () => {
    refreshPdfProjectOptions();
    elements.dashboardView.classList.add("hidden");
    elements.parserView.classList.remove("hidden");
    playViewEnter(elements.parserView);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const showDashboard = () => {
    elements.parserView.classList.add("hidden");
    elements.dashboardView.classList.remove("hidden");
    playViewEnter(elements.dashboardView);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** v0.7.0：视图切换过渡——淡入 + 轻微上滑（动画结束自动清理 class，保证下次可重触发） */
  const playViewEnter = (el) => {
    if (!el) return;
    el.classList.remove("view-enter");
    void el.offsetWidth;
    el.classList.add("view-enter");
    el.addEventListener(
      "animationend",
      () => el.classList.remove("view-enter"),
      { once: true }
    );
  };

  function bindEvents() {
    elements.authTabs.forEach((tab) =>
      tab.addEventListener("click", () => {
        state.authMode = tab.dataset.mode;
        elements.authTabs.forEach((item) =>
          item.classList.toggle("active", item === tab)
        );
        elements.authSubmit.textContent =
          state.authMode === "signup" ? "注册账号" : "登录";
        elements.authPassword.autocomplete =
          state.authMode === "signup" ? "new-password" : "current-password";
        elements.authMessage.textContent = "";
        elements.authMessage.style.color = "var(--danger)";
      })
    );

    elements.authForm.addEventListener("submit", async (event) => {
      elements.authMessage.textContent = "";
      elements.authMessage.style.color = "var(--danger)";
      elements.authSubmit.disabled = true;
      const result = await auth.handleAuth(
        event,
        state.authMode,
        elements.authEmail.value.trim(),
        elements.authPassword.value
      );
      elements.authSubmit.disabled = false;
      if (result.error) {
        elements.authMessage.textContent = result.error;
        return;
      }
      if (result.successMessage) {
        elements.authMessage.style.color = "var(--success)";
        elements.authMessage.textContent = result.successMessage;
      }
    });

    elements.signOutBtn?.addEventListener("click", () => auth.signOut());
    elements.themeBtn?.addEventListener("click", () => {
      state.darkMode = !state.darkMode;
      localStorage.setItem(THEME_KEY, state.darkMode ? "dark" : "light");
      ui.applyTheme(state.darkMode);
    });
    elements.exportBtn?.addEventListener("click", () =>
      // 导出当前筛选结果，与列表看到的一致，而非全量。
      projectsApi.exportCsv(ui.getCurrentFilteredProjects?.() ?? state.projects)
    );

    // v0.8.0：一键备份（直接拉 Supabase 全量，含回收站）+ 30 天备份提醒
    const runBackup = async () => {
      const ok = await projectsApi.exportBackup();
      if (ok) elements.backupTip?.classList.add("hidden");
    };
    elements.backupBtn?.addEventListener("click", runBackup);
    elements.backupNowBtn?.addEventListener("click", runBackup);
    elements.backupTipClose?.addEventListener("click", () =>
      elements.backupTip?.classList.add("hidden")
    );

    // v0.8.1：从备份恢复 —— 无重叠直接补齐；有重叠时一次确认：
    // 确定 = 用备份覆盖已有，取消 = 只补新增；库里有、备份里没有的一律不动
    elements.restoreBtn?.addEventListener("click", () =>
      elements.restoreFileInput?.click()
    );
    elements.restoreFileInput?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      let text = "";
      try {
        text = await file.text();
      } catch {
        ui.showToast("读取文件失败，重试。");
        return;
      }
      await projectsApi.restoreBackup(text, ({ overlap, fresh }) =>
        confirm(
          `备份中有 ${overlap} 条已存在于当前数据库，点「确定」用备份覆盖它们，点「取消」只补新增的 ${fresh} 条。\n（数据库里有、备份里没有的项目不会被删除。）`
        )
      );
    });

    // v0.8.0：列表 / 日历视图切换（日历模式下退出选择模式，避免两者叠加）
    const setViewMode = (mode) => {
      if (mode !== "list" && mode !== "calendar") return;
      state.viewMode = mode;
      document.querySelectorAll(".view-btn").forEach((b) =>
        b.classList.toggle("active", b.dataset.view === mode)
      );
      elements.calendarView?.classList.toggle("hidden", mode !== "calendar");
      elements.list?.classList.toggle("hidden", mode !== "list");
      if (mode === "calendar" && state.selectMode) {
        state.selectMode = false;
        state.selectedIds.clear();
        elements.selectBar?.classList.add("hidden");
      }
      ui.render();
    };
    document.querySelectorAll(".view-btn").forEach((btn) =>
      btn.addEventListener("click", () => setViewMode(btn.dataset.view))
    );

    // v0.8.0：日历交互（导航 / 选日 / 点项目回到列表定位）
    const calToDateStr = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    elements.calendarView?.addEventListener("click", (event) => {
      const nav = event.target.closest("[data-cal-nav]");
      if (nav) {
        const type = nav.dataset.calNav;
        if (type === "today") {
          const t = new Date();
          state.calYear = t.getFullYear();
          state.calMonth = t.getMonth();
          state.calSelected = calToDateStr(t);
        } else {
          let y = state.calYear;
          let m = state.calMonth + (type === "next" ? 1 : -1);
          if (m < 0) {
            m = 11;
            y -= 1;
          }
          if (m > 11) {
            m = 0;
            y += 1;
          }
          state.calYear = y;
          state.calMonth = m;
        }
        ui.render();
        return;
      }
      const day = event.target.closest("[data-cal-date]");
      if (day) {
        state.calSelected = day.dataset.calDate;
        ui.render();
        return;
      }
      const proj = event.target.closest("[data-cal-project-id]");
      if (proj) {
        setViewMode("list");
        ui.focusProjectInList(proj.dataset.calProjectId);
      }
    });

    // v0.8.0：保证金清单折叠 + 在途保证金统计卡片联动（点卡片展开清单并滚动定位）
    let guaranteeVisible = false;
    const setGuaranteeVisible = (visible) => {
      guaranteeVisible = visible;
      elements.guaranteeList?.classList.toggle("hidden", !visible);
      if (elements.toggleGuaranteeBtn) {
        elements.toggleGuaranteeBtn.textContent = visible
          ? "收起清单"
          : "查看清单";
        elements.toggleGuaranteeBtn.setAttribute(
          "aria-expanded",
          String(visible)
        );
      }
    };
    elements.toggleGuaranteeBtn?.addEventListener("click", () =>
      setGuaranteeVisible(!guaranteeVisible)
    );
    const scrollToGuarantee = () => {
      if (!guaranteeVisible) setGuaranteeVisible(true);
      elements.guaranteePanel?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    };
    elements.guaranteeStatCard?.addEventListener("click", scrollToGuarantee);
    elements.guaranteeStatCard?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      scrollToGuarantee();
    });

    // v0.4.0：忘记密码 / 重发验证邮件
    elements.forgotPasswordBtn?.addEventListener("click", async () => {
      const email = elements.authEmail.value.trim();
      if (!email) {
        ui.showToast("先填写邮箱。");
        return;
      }
      const result = await auth.sendPasswordReset(email);
      if (result.ok) ui.showToast("重置链接已发送，注意查收（含垃圾箱）。");
      else ui.showToast(`发送失败：${result.error || "请稍后重试"}`);
    });
    elements.resendVerificationBtn?.addEventListener("click", async () => {
      const email = elements.authEmail.value.trim();
      if (!email) {
        ui.showToast("先填写邮箱。");
        return;
      }
      const result = await auth.resendVerification(email);
      if (result.ok) ui.showToast("验证邮件已重发，注意查收（含垃圾箱）。");
      else ui.showToast(`发送失败：${result.error || "请稍后重试"}`);
    });
    elements.updatePasswordBtn?.addEventListener("click", async () => {
      const next = elements.newPassword?.value || "";
      const again = elements.confirmPassword?.value || "";
      if (next.length < 6) {
        ui.showToast("新密码至少 6 位。");
        return;
      }
      if (next !== again) {
        ui.showToast("两次输入的新密码不一致。");
        return;
      }
      const result = await auth.updatePassword(next);
      if (!result.ok) {
        ui.showToast(`设置失败：${result.error || "请稍后重试"}`);
        return;
      }
      hideResetPasswordPanel();
      ui.showToast("密码已更新，重新登录。");
      await auth.signOut();
    });
    elements.backToLoginBtn?.addEventListener("click", () => {
      hideResetPasswordPanel();
    });

    // v0.4.0：CSV 导入（只做 CSV）+ 下载导入模板
    elements.importBtn?.addEventListener("click", () =>
      elements.importFileInput?.click()
    );
    elements.downloadTemplateBtn?.addEventListener("click", () => {
      const csv = buildImportCsvTemplate();
      const url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" })
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "项目导入模板.csv";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      ui.showToast("导入模板已下载。");
    });
    elements.importFileInput?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      let rows = [];
      let errors = [];
      if (/\.xlsx$/i.test(file.name)) {
        // v0.8.0：Excel 导入 —— 第一张表转 CSV 文本，复用 parseCsvProjects 的表头映射与校验
        if (!window.XLSX) {
          ui.showToast("Excel 解析库加载失败，请改用 CSV 导入。");
          return;
        }
        try {
          const wb = window.XLSX.read(await file.arrayBuffer(), {
            type: "array",
          });
          const ws = wb.Sheets[wb.SheetNames[0]];
          if (!ws) throw new Error("空工作簿");
          const data = window.XLSX.utils.sheet_to_json(ws, {
            header: 1,
            defval: "",
            raw: false,
          });
          const parsed = parseCsvProjects(sheetRowsToCsv(data));
          rows = parsed.rows;
          errors = parsed.errors;
        } catch (err) {
          ui.showToast(`Excel 解析失败：${err?.message || err}`);
          return;
        }
      } else {
        let text = "";
        try {
          text = await file.text();
        } catch {
          ui.showToast("读取文件失败，重试。");
          return;
        }
        const parsed = parseCsvProjects(text);
        rows = parsed.rows;
        errors = parsed.errors;
      }
      if (!rows.length) {
        const detail = errors
          .slice(0, 3)
          .map((e) => `第${e.line}行：${e.reason}`)
          .join("；");
        ui.showToast(`没有可导入的行。${detail || ""}`);
        return;
      }
      const { imported, failed } = await projectsApi.importProjects(rows);
      const skipped = errors.length + failed;
      const detail = errors
        .slice(0, 2)
        .map((e) => `第${e.line}行：${e.reason}`)
        .join("；");
      ui.showToast(
        `成功导入 ${imported} 条${skipped ? `，跳过 ${skipped} 条${detail ? `：${detail}` : ""}` : "。"}` +
          (errors.length > 2 ? "（更多错误见控制台）" : "")
      );
      if (errors.length > 2) console.warn("CSV 导入跳过的行：", errors);
    });
    elements.submitBtn?.addEventListener("click", async () => {
      const ok = await projectsApi.saveProject(formData(), state.editingId);
      if (ok) resetForm();
    });
    elements.cancelBtn?.addEventListener("click", resetForm);
    // v0.4.0：搜索框 input 防抖 200ms；筛选 / 排序 change 立即渲染。
    elements.search?.addEventListener("input", () => debouncedRender());
    [elements.statusFilter, elements.sortBy].forEach((el) =>
      el?.addEventListener("change", () => ui.render())
    );
    // v0.5.0：iOS segmented control 与隐藏的 statusFilter 同步
    // v0.8.0：只绑状态筛选组，视图切换组（.view-seg）另有处理
    const syncSegControl = () => {
      const value = elements.statusFilter?.value || "all";
      document
        .querySelectorAll('.seg-control[aria-label="按状态筛选"] .seg-btn')
        .forEach((b) =>
          b.classList.toggle("active", b.dataset.value === value)
        );
    };
    document
      .querySelectorAll('.seg-control[aria-label="按状态筛选"] .seg-btn')
      .forEach((btn) =>
        btn.addEventListener("click", () => {
          if (elements.statusFilter) elements.statusFilter.value = btn.dataset.value;
          syncSegControl();
          ui.render();
        })
      );
    state.syncSegControl = syncSegControl;

    elements.upcomingList?.addEventListener("click", (event) => {
      const item = event.target.closest(".upcoming-item[data-id]");
      if (!item) return;
      ui.focusProjectInList(item.dataset.id);
    });
    elements.upcomingList?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const item = event.target.closest(".upcoming-item[data-id]");
      if (!item) return;
      event.preventDefault();
      ui.focusProjectInList(item.dataset.id);
    });

    elements.openParserBtn?.addEventListener("click", showParser);
    elements.closeParserBtn?.addEventListener("click", showDashboard);
    elements.dropZone?.addEventListener("click", () =>
      elements.pdfInput.click()
    );
    elements.dropZone?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        elements.pdfInput.click();
      }
    });
    elements.pdfInput?.addEventListener("change", (event) =>
      pdfParser.parsePdf(event.target.files?.[0])
    );
    ["dragenter", "dragover"].forEach((eventName) =>
      elements.dropZone?.addEventListener(eventName, (event) => {
        event.preventDefault();
        elements.dropZone.classList.add("dragover");
      })
    );
    ["dragleave", "drop"].forEach((eventName) =>
      elements.dropZone?.addEventListener(eventName, (event) => {
        event.preventDefault();
        elements.dropZone.classList.remove("dragover");
      })
    );
    elements.dropZone?.addEventListener("drop", (event) =>
      pdfParser.parsePdf(event.dataTransfer.files?.[0])
    );
    elements.toggleTextBtn?.addEventListener("click", () => {
      const hidden = elements.parsedText.classList.toggle("hidden");
      elements.toggleTextBtn.textContent = hidden
        ? "查看原始文本"
        : "隐藏原始文本";
    });
    elements.copyTextBtn?.addEventListener("click", () =>
      pdfParser.copyParsedText()
    );

    // 解析页：把当前解析文本保存到所选项目（pdf_text / pdf_filename / pdf_parsed_at）
    elements.savePdfTextBtn?.addEventListener("click", async () => {
      const projectId = elements.pdfProjectSelect?.value || "";
      if (!projectId) {
        ui.showToast("先选择要保存到的项目。");
        return;
      }
      const text = elements.parsedText?.value || "";
      if (!text.trim()) {
        ui.showToast("没有可保存的解析文本，先解析 PDF。");
        return;
      }
      const project = state.projects.find((p) => p.id === projectId);
      const filename = getCurrentPdfFilename(project?.pdfFilename);
      const ok = await projectsApi.updateProjectFields(projectId, {
        pdfText: text,
        pdfFilename: filename,
        pdfParsedAt: new Date().toISOString(),
      });
      if (ok) ui.showToast(`已保存到项目「${project?.name || ""}」。`);
    });

    elements.aiAnalyzeBtn?.addEventListener("click", async () => {
      const text = elements.parsedText?.value;
      if (!text) {
        ui.showToast("先完成 PDF 解析。");
        return;
      }
      elements.aiAnalyzeBtn.disabled = true;
      try {
        const result = await aiExtract.analyzeTenderText(text, (msg) =>
          pdfParser.setParseProgress(90, msg)
        );
        lastAiResult = result;
        // v0.6.0：AI 回填到选填字段时自动展开选填区
        const beforeOptional = OPTIONAL_FIELDS.map(
          (k) => elements.form[k]?.value ?? ""
        );
        aiExtract.applyToForm(elements, result);
        const optionalFilled = OPTIONAL_FIELDS.some((k, i) => {
          const v = elements.form[k]?.value ?? "";
          return v !== beforeOptional[i] && String(v).trim() !== "";
        });
        if (optionalFilled) setOptionalExpanded(true);
        aiExtract.renderAiResultPanel(elements.aiResultPanel, result);
        pdfParser.setParseProgress(100, "AI 分析完成。");
        ui.showToast(
          optionalFilled
            ? "AI 分析完成，结果已回填表单（含选填信息），核对后保存。"
            : "AI 分析完成，结果已回填表单，核对后保存。"
        );
        showDashboard();
        revealForm();
      } catch (err) {
        ui.showToast(err?.message || "AI 分析失败");
        pdfParser.setParseProgress(0, "AI 分析失败");
      } finally {
        elements.aiAnalyzeBtn.disabled = false;
      }
    });

    elements.aiSettingsBtn?.addEventListener("click", () => {
      elements.aiSettingsPanel?.classList.toggle("hidden");
      loadAiConfigToForm(elements);
      if (elements.reminderDays) {
        elements.reminderDays.value = String(getReminderDays());
      }
    });
    elements.aiSaveSettings?.addEventListener("click", () => {
      saveAiConfig({
        apiKey: elements.aiApiKey?.value,
        baseUrl: elements.aiBaseUrl?.value,
        model: elements.aiModel?.value,
      });
      const days = setReminderDays(elements.reminderDays?.value);
      if (elements.reminderDays) elements.reminderDays.value = String(days);
      ui.render();
      ui.showToast(`设置已保存，提醒窗口为未来 ${days} 天。`);
      elements.aiSettingsPanel?.classList.add("hidden");
    });

    // v0.6.0：选填信息折叠开关 + 字段数
    elements.optionalToggle?.addEventListener("click", () => {
      setOptionalExpanded(!state.optionalExpanded);
    });
    if (elements.optionalCount)
      elements.optionalCount.textContent = String(OPTIONAL_FIELDS.length);

    // v0.6.0：批量选择模式
    elements.selectModeBtn?.addEventListener("click", () => {
      // v0.8.0：日历视图下先切回列表，避免选择模式与日历叠加
      if (state.viewMode === "calendar") setViewMode("list");
      if (state.selectMode) exitSelectMode();
      else enterSelectMode();
    });
    elements.cancelSelectBtn?.addEventListener("click", exitSelectMode);
    elements.selectAllBtn?.addEventListener("click", () => {
      const filtered =
        typeof ui.getCurrentFilteredProjects === "function"
          ? ui.getCurrentFilteredProjects()
          : [];
      const allSelected =
        filtered.length > 0 &&
        filtered.every((p) => state.selectedIds.has(p.id));
      if (allSelected) filtered.forEach((p) => state.selectedIds.delete(p.id));
      else filtered.forEach((p) => state.selectedIds.add(p.id));
      ui.render();
      updateSelectBar();
    });
    elements.deleteSelectedBtn?.addEventListener("click", async () => {
      const ok = await projectsApi.deleteProjects([...state.selectedIds]);
      if (ok) exitSelectMode();
    });

    // v0.6.0：重置账户（双重确认，只删当前用户数据）
    let resetArmed = false;
    let resetTimer = null;
    elements.resetAccountBtn?.addEventListener("click", async () => {
      const btn = elements.resetAccountBtn;
      if (!resetArmed) {
        resetArmed = true;
        btn.textContent = "再次点击确认重置";
        btn.classList.add("armed");
        ui.showToast("再次点击确认重置，10 秒内有效。");
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
        const uid = state.user?.id;
        if (!uid) throw new Error("未登录");
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
      } catch (err) {
        ui.showToast(`重置失败：${err?.message || err}`);
      } finally {
        btn.disabled = false;
      }
    });

    elements.list?.addEventListener("click", async (event) => {
      // v0.5.1：操作按钮已搬到行头部——点按钮只走按钮分支，不触发折叠切换
      const button = event.target.closest("button");
      if (!button) {
        // v0.4.1：卡片头部点击切换展开 / 折叠
        // v0.6.0：选择模式下点行切换选中，不展开详情
        const toggleEl = event.target.closest(
          '.project-item [data-action="toggle-details"]'
        );
        if (toggleEl) {
          const tid =
            toggleEl.dataset.id ||
            toggleEl.closest(".project-item")?.dataset.id;
          if (state.selectMode) toggleSelectOne(tid);
          else toggleProjectDetails(toggleEl);
        }
        return;
      }
      const id = button.dataset.id;
      // v0.6.0：选择模式复选框
      if (button.dataset.action === "toggle-select") {
        toggleSelectOne(id);
        return;
      }
      // v0.5.0：空状态引导按钮 → 展开新增表单
      if (button.dataset.action === "empty-add") {
        revealForm();
        return;
      }
      if (button.dataset.action === "delete") {
        const ok = await projectsApi.deleteProject(id);
        if (ok && state.editingId === id) resetForm();
      }
      if (button.dataset.action === "view-pdf") {
        const p = state.projects.find((project) => project.id === id);
        if (!p) return;
        // v0.4.0：列表不再带全文，先看内存，没有则按需拉
        let text = p.pdfText || "";
        if (!text) {
          text = (await projectsApi.loadProjectPdfText(id)) || "";
        }
        if (!text) {
          ui.showToast("该项目没有已保存的招标文件文本。");
          return;
        }
        elements.parsedText.value = text;
        elements.parsedText.classList.remove("hidden");
        elements.pdfFileName.textContent = `已保存文件：${p.pdfFilename || "未命名"}（${text.length} 字）`;
        elements.toggleTextBtn.disabled = false;
        elements.toggleTextBtn.textContent = "隐藏原始文本";
        elements.copyTextBtn.disabled = false;
        elements.aiAnalyzeBtn.disabled = false;
        showParser();
      }
      if (button.dataset.action === "clone") {
        await projectsApi.cloneProject(id);
      }
      if (button.dataset.action === "checklist-generate") {
        const p = state.projects.find((project) => project.id === id);
        if (!p) return;
        const generated = buildChecklistFromAi(
          p.invalidBidClauses,
          p.riskPoints
        );
        const existingTexts = new Set(
          (p.checklist || []).map((item) => item.text)
        );
        const fresh = generated.filter((item) => !existingTexts.has(item.text));
        if (!fresh.length) {
          ui.showToast("清单已是最新。");
          return;
        }
        const ok = await projectsApi.updateProjectFields(id, {
          checklist: [...(p.checklist || []), ...fresh],
        });
        if (ok) ui.showToast(`已生成 ${fresh.length} 条检查项。`);
      }
      if (button.dataset.action === "checklist-add") {
        const p = state.projects.find((project) => project.id === id);
        if (!p) return;
        const itemEl = event.target.closest(".project-item");
        const input = itemEl?.querySelector(".checklist-new-input");
        const text = (input?.value || "").trim();
        if (!text) {
          ui.showToast("输入清单内容。");
          return;
        }
        const newItem = {
          id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text: text.slice(0, 500),
          done: false,
          source: "manual",
        };
        const ok = await projectsApi.updateProjectFields(id, {
          checklist: [...(p.checklist || []), newItem],
        });
        if (ok) ui.showToast("已添加检查项。");
      }
      if (button.dataset.action === "checklist-delete") {
        const p = state.projects.find((project) => project.id === id);
        if (!p) return;
        const ok = await projectsApi.updateProjectFields(id, {
          checklist: (p.checklist || []).filter(
            (item) => item.id !== button.dataset.itemId
          ),
        });
        if (ok) ui.showToast("已删除检查项。");
      }
      if (button.dataset.action === "edit") {
        const p = state.projects.find((project) => project.id === id);
        if (!p) return;
        state.editingId = id;
        lastAiResult =
          p.riskSummary || p.qualification || p.invalidBidClauses
            ? {
                riskSummary: p.riskSummary,
                riskPoints: p.riskPoints,
                qualification: p.qualification,
                invalidBidClauses: p.invalidBidClauses,
                extractedMeta: p.extractedMeta,
              }
            : null;
        elements.form.date.value = p.date || "";
        elements.form.type.value = p.type || "";
        elements.form.name.value = p.name || "";
        elements.form.biddingCompany.value = p.biddingCompany || "";
        if (elements.form.tenderer) elements.form.tenderer.value = p.tenderer || "";
        if (elements.form.amountValue)
          elements.form.amountValue.value = p.amountValue ?? "";
        if (elements.form.amountUnit)
          elements.form.amountUnit.value = p.amountUnit || "万元";
        elements.form.guarantee.value = p.guarantee || "";
        if (elements.form.guaranteeAmount)
          elements.form.guaranteeAmount.value = p.guaranteeAmount ?? "";
        if (elements.form.guaranteeUnit)
          elements.form.guaranteeUnit.value = p.guaranteeUnit || "万元";
        if (elements.form.guaranteeStatus)
          elements.form.guaranteeStatus.value = p.guaranteeStatus || "未缴纳";
        if (elements.form.registrationDeadline)
          elements.form.registrationDeadline.value = p.registrationDeadline || "";
        if (elements.form.inquiryDeadline)
          elements.form.inquiryDeadline.value = p.inquiryDeadline || "";
        if (elements.form.clarificationDeadline)
          elements.form.clarificationDeadline.value =
            p.clarificationDeadline || "";
        if (elements.form.guaranteeDeadline)
          elements.form.guaranteeDeadline.value = p.guaranteeDeadline || "";
        elements.form.contact.value = p.contact || "";
        elements.form.status.value = p.status || "报名中";
        elements.form.notes.value = p.notes || "";
        setOptionalExpanded(hasOptionalValues()); // v0.6.0：编辑时有选填值则展开
        elements.submitBtn.textContent = "保存修改";
        elements.cancelBtn.classList.remove("hidden");
        elements.formBody?.closest(".form-panel")?.classList.add("editing");
        if (elements.formSubtitle)
          elements.formSubtitle.textContent = `正在编辑：${String(p.name || "").slice(0, 12)}…`;
        revealForm();
      }
    });

    // 清单勾选：用 change 事件取勾选态；失败时重渲染还原。
    elements.list?.addEventListener("change", async (event) => {
      const checkbox = event.target.closest(
        'input[type="checkbox"][data-action="checklist-toggle"]'
      );
      if (!checkbox) return;
      const id = checkbox.dataset.id;
      const p = state.projects.find((project) => project.id === id);
      if (!p) return;
      const ok = await projectsApi.updateProjectFields(id, {
        checklist: (p.checklist || []).map((item) =>
          item.id === checkbox.dataset.itemId
            ? { ...item, done: checkbox.checked }
            : item
        ),
      });
      if (!ok) ui.render();
    });

    // v0.4.1：卡片头部键盘可操作（Enter / Space 切换展开）
    elements.list?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      // v0.5.1：焦点在行内按钮上时按回车/空格不触发折叠（防误触）
      if (event.target.closest("button")) return;
      const toggleEl = event.target.closest(
        '.project-item [data-action="toggle-details"]'
      );
      if (!toggleEl) return;
      event.preventDefault();
      // v0.6.0：选择模式下键盘切换选中
      const tid =
        toggleEl.dataset.id || toggleEl.closest(".project-item")?.dataset.id;
      if (state.selectMode) toggleSelectOne(tid);
      else toggleProjectDetails(toggleEl);
    });

    // v0.4.0：保证金退还提醒横幅 — 标记已退回
    // v0.8.0：同一处理复用到保证金待退还清单（不要另写一套更新路径）
    const handleMarkRefunded = async (event) => {
      const button = event.target.closest(
        'button[data-action="mark-refunded"]'
      );
      if (!button) return;
      const ok = await projectsApi.updateProjectFields(button.dataset.id, {
        guaranteeStatus: "已退回",
      });
      if (ok) ui.showToast("已标记为已退回。");
    };
    elements.refundTip?.addEventListener("click", handleMarkRefunded);
    elements.guaranteeList?.addEventListener("click", handleMarkRefunded);

    elements.toggleTrashBtn?.addEventListener("click", async () => {
      trashVisible = !trashVisible;
      elements.trashList?.classList.toggle("hidden", !trashVisible);
      elements.toggleTrashBtn.textContent = trashVisible ? "收起回收站" : "查看回收站";
      elements.toggleTrashBtn.setAttribute("aria-expanded", trashVisible ? "true" : "false");
      if (trashVisible) await refreshTrashList();
    });

    // v0.4.3：新增 / 编辑表单标题点击展开 / 收起（键盘 Enter / Space 同理）
    const formTitle = document.querySelector('.form-panel [data-action="toggle-form"]');
    formTitle?.addEventListener("click", (event) => {
      if (event.target.closest("button, a, input, select, textarea")) return;
      setFormExpanded(!state.formExpanded);
    });
    formTitle?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      setFormExpanded(!state.formExpanded);
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
    });

    elements.menuToggle?.addEventListener("click", () =>
      ui.toggleMobileMenu()
    );
    document.addEventListener("click", (e) => {
      const menu = document.getElementById("headerMenu");
      if (
        menu?.classList.contains("open") &&
        !e.target.closest("#headerMenu") &&
        !e.target.closest("#menuToggle")
      ) {
        ui.toggleMobileMenu(false);
      }
    });
    // v0.7.0：Esc 关闭菜单；在菜单内点任何按钮后收起菜单
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") ui.toggleMobileMenu(false);
    });
    document.getElementById("headerMenu")?.addEventListener("click", (e) => {
      if (e.target.closest("button")) ui.toggleMobileMenu(false);
    });
    // v0.7.0：header 新增项目主按钮
    elements.addProjectBtn?.addEventListener("click", () => revealForm());
    // v0.7.0：统计卡片可点击筛选（前 4 张；保证金卡片保持静态）
    const applyStatFilter = (value) => {
      if (elements.search) elements.search.value = "";
      if (elements.statusFilter) elements.statusFilter.value = value;
      if (typeof state.syncSegControl === "function") state.syncSegControl();
      ui.render();
      elements.list
        ?.closest("section")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    document.querySelectorAll(".stat-card[data-stat-filter]").forEach((card) => {
      card.addEventListener("click", () =>
        applyStatFilter(card.dataset.statFilter)
      );
      card.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        applyStatFilter(card.dataset.statFilter);
      });
    });
    elements.backToTop?.addEventListener("click", () =>
      scrollTo({ top: 0, behavior: "smooth" })
    );
    // v0.4.3：scroll 高频触发，rAF 节流后再更新进度条 / 回顶按钮
    let scrollRaf = 0;
    addEventListener(
      "scroll",
      () => {
        if (scrollRaf) return;
        scrollRaf = requestAnimationFrame(() => {
          scrollRaf = 0;
          ui.updateScrollUi();
        });
      },
      { passive: true }
    );
  }

  async function init() {
    ui.applyTheme(state.darkMode);
    bindEvents();
    ui.updateScrollUi();
    loadAiConfigToForm(elements);

    // v0.8.0：PWA Service Worker（仅 https/localhost，注册失败静默，不影响正常使用）
    try {
      if (
        "serviceWorker" in navigator &&
        (location.protocol === "https:" || location.hostname === "localhost")
      ) {
        navigator.serviceWorker.register("./sw.js").catch(() => {});
      }
    } catch {
      // 忽略
    }

    if (!configured || !window.supabase) {
      elements.authMessage.textContent =
        "请先复制 supabase-config.example.js 为 supabase-config.js，并填入 Supabase URL 与 anon key。";
      return;
    }
    client = window.supabase.createClient(config.url, config.anonKey);
    auth.bindAuthState();
    await auth.restoreSession();

    setInterval(() => {
      if (!state.user) return;
      ui.updateCountdowns();
      sendBidNotifications();
    }, 60000);
  }

  init();
})();
