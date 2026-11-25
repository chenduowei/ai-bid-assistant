/**
 * AI Bid Assistant — 入口
 * 模块：js/utils.js · auth.js · projects.js · ui.js
 * v0.50.0 起已移除招标文件解析与 AI 分析（js/pdf-parser.js ·
 * js/ai-extract.js 均已删除）；已入库的旧风险结论与检查清单
 * 仍在卡片里展示与管理，见 js/utils.js。
 */
import { THEME_KEY, formatBidMoment, getMissedBidProjects, getDeadlineItems, escapeHtml, debounce, parseCsvProjects, buildImportCsvTemplate, sheetRowsToCsv, isFormDataEmpty, isFormDraftUsable, isFormDraftStale, pruneNotificationKeys, formDraftKey, readFormDrafts, writeFormDrafts, pickFormDraft, pruneFormDrafts, toggleSectionOpen, vibrate, isKeyboardOpen } from "./js/utils.js";
import { bindSheetSwipeGesture, bindPullToRefresh } from "./js/sheet-gestures.js";
import { createUi } from "./js/ui.js";
import { createProjectsApi } from "./js/projects.js";
import { requiredFormFields } from "./js/fields.js";
import { createAuth } from "./js/auth.js";
import { createDataIo } from "./js/data-io.js";
import { createDrawers } from "./js/drawers.js";
import { createSettings } from "./js/settings.js";

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
    authTabsWrap: document.getElementById("authTabs"),
    authTitle: document.getElementById("authTitle"),
    authIntro: document.getElementById("authIntro"),
    authLinksWrap: document.getElementById("authLinks"),
    authConfirmField: document.getElementById("authConfirmField"),
    authConfirmPassword: document.getElementById("authConfirmPassword"),
    authRetryBtn: document.getElementById("authRetryBtn"),
    togglePasswordBtn: document.getElementById("togglePasswordBtn"),
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
    settingsAccountEmail: document.getElementById("settingsAccountEmail"),
    syncStatus: document.getElementById("syncStatus"),
    headerDate: document.getElementById("headerDate"),
    heroChip: document.getElementById("heroChip"),
    heroChipCount: document.getElementById("heroChipCount"),
    heroChipName: document.getElementById("heroChipName"),
    menuToggleBadge: document.getElementById("menuToggleBadge"),
    menuActionSheet: document.getElementById("menuActionSheet"),
    ptrIndicator: document.getElementById("ptrIndicator"),
    offlineBanner: document.getElementById("offlineBanner"),
    bpHero: document.getElementById("bpHero"),
    bpHeroLabel: document.getElementById("bpHeroLabel"),
    bpHeroName: document.getElementById("bpHeroName"),
    bpHeroBadge: document.getElementById("bpHeroBadge"),
    bpHeroAction: document.getElementById("bpHeroAction"),
    bpHeroTime: document.getElementById("bpHeroTime"),
    bpHeroCount: document.getElementById("bpHeroCount"),
    dashboardView: document.getElementById("dashboardView"),
    aiSettingsBtn: document.getElementById("aiSettingsBtn"),
    settingsSheet: document.getElementById("settingsSheet"),
    settingsSheetClose: document.getElementById("settingsSheetClose"),
    reminderDays: document.getElementById("reminderDays"),
    notifStatus: document.getElementById("notifStatus"),
    notifBtn: document.getElementById("notifBtn"),
    fabAdd: document.getElementById("fabAdd"),
    projectForm: document.getElementById("projectForm"),
    aiSaveSettings: document.getElementById("aiSaveSettings"),
    submitBtn: document.getElementById("submitBtn"),
    cancelBtn: document.getElementById("cancelBtn"),
    search: document.getElementById("search"),
    filterResultCount: document.getElementById("filterResultCount"),
    statusFilter: document.getElementById("statusFilter"),
    sortBy: document.getElementById("sortBy"),
    resultFilter: document.getElementById("resultFilter"),
    winRate: document.getElementById("winRate"),
    guaranteeTotals: document.getElementById("guaranteeTotals"),
    headerSubtitle: document.getElementById("headerSubtitle"),
    selectModeBtn: document.getElementById("selectModeBtn"),
    collapseAllBtn: document.getElementById("collapseAllBtn"),
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
    guaranteeList: document.getElementById("guaranteeList"),
    guaranteeCount: document.getElementById("guaranteeCount"),
    guaranteeStatCard: document.getElementById("guaranteeStatCard"),
    upcomingStatCard: document.getElementById("upcomingStatCard"),
    upcomingCount: document.getElementById("upcomingCount"),
    inProgressCount: document.getElementById("inProgressCount"),
    guaranteeMenuBtn: document.getElementById("guaranteeMenuBtn"),
    qualMenuBtn: document.getElementById("qualMenuBtn"),
    calendarMenuBtn: document.getElementById("calendarMenuBtn"),
    calendarSheet: document.getElementById("calendarSheet"),
    calendarSheetClose: document.getElementById("calendarSheetClose"),
    calendarEmpty: document.getElementById("calendarEmpty"),
    calendarActive: document.getElementById("calendarActive"),
    calendarUrlInput: document.getElementById("calendarUrlInput"),
    calendarCopyBtn: document.getElementById("calendarCopyBtn"),
    calendarRegenBtn: document.getElementById("calendarRegenBtn"),
    calendarRevokeBtn: document.getElementById("calendarRevokeBtn"),
    calendarGenerateBtn: document.getElementById("calendarGenerateBtn"),
    calendarSetupHint: document.getElementById("calendarSetupHint"),
    calendarExpiredHint: document.getElementById("calendarExpiredHint"),
    calendarMeta: document.getElementById("calendarMeta"),
    qualSheet: document.getElementById("qualSheet"),
    qualSheetClose: document.getElementById("qualSheetClose"),
    qualCategory: document.getElementById("qualCategory"),
    qualName: document.getElementById("qualName"),
    qualDetails: document.getElementById("qualDetails"),
    qualExpires: document.getElementById("qualExpires"),
    qualSaveBtn: document.getElementById("qualSaveBtn"),
    qualCancelEditBtn: document.getElementById("qualCancelEditBtn"),
    qualList: document.getElementById("qualList"),
    qualCount: document.getElementById("qualCount"),
    guaranteeSheet: document.getElementById("guaranteeSheet"),
    guaranteeSheetClose: document.getElementById("guaranteeSheetClose"),
    trashList: document.getElementById("trashList"),
    emptyTrashBtn: document.getElementById("emptyTrashBtn"),
    trashMenuBtn: document.getElementById("trashMenuBtn"),
    trashSheet: document.getElementById("trashSheet"),
    trashSheetClose: document.getElementById("trashSheetClose"),
    confirmDialog: document.getElementById("confirmDialog"),
    confirmDialogTitle: document.getElementById("confirmDialogTitle"),
    confirmDialogMessage: document.getElementById("confirmDialogMessage"),
    confirmDialogCancel: document.getElementById("confirmDialogCancel"),
    confirmDialogOk: document.getElementById("confirmDialogOk"),
    confirmDialogTyping: document.getElementById("confirmDialogTyping"),
    confirmDialogPhrase: document.getElementById("confirmDialogPhrase"),
    confirmDialogInput: document.getElementById("confirmDialogInput"),
    confirmDialogAlt: document.getElementById("confirmDialogAlt"),
    confirmDialogActions: document.getElementById("confirmDialogActions"),
    formBody: document.getElementById("formBody"),
    formSubtitle: document.getElementById("formSubtitle"),
    upcomingList: document.getElementById("upcomingList"),
    deadlineTip: document.getElementById("deadlineTip"),
    refundTip: document.getElementById("refundTip"),
    brandHomeBtn: document.getElementById("brandHomeBtn"),
    backToTopBtn: document.getElementById("backToTopBtn"),
    goToBottomBtn: document.getElementById("goToBottomBtn"),
    scrollProgress: document.getElementById("scrollProgress"),
    toastWrap: document.getElementById("toastWrap"),
    totalCount: document.getElementById("totalCount"),
    registeringCount: document.getElementById("registeringCount"),
    makingCount: document.getElementById("makingCount"),
    openedCount: document.getElementById("openedCount"),
    inTransitGuarantee: document.getElementById("inTransitGuarantee"),
    menuToggle: document.getElementById("menuToggle"),
    headerMenu: document.getElementById("headerMenu"),
    addProjectBtn: document.getElementById("addProjectBtn"),
    upcomingDrawerBtn: document.getElementById("upcomingDrawerBtn"),
    upcomingSheet: document.getElementById("upcomingSheet"),
    upcomingCloseBtn: document.getElementById("upcomingCloseBtn"),
    formSheet: document.getElementById("formSheet"),
    formCloseBtn: document.getElementById("formCloseBtn"),
    form: {
      date: document.getElementById("date"),
      bidTime: document.getElementById("bidTime"),
      result: document.getElementById("result"),
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
  /** 错过提醒每个会话只提示一次，避免 Realtime 刷新时反复刷屏 */
  let missedReminderShown = false;
  /** 密码重置流程中：为 true 时 showApp 不切回工作台，停留在重置面板 */
  let passwordRecoveryActive = false;
  /** v0.4.0：搜索防抖 200ms（筛选/排序仍立即渲染） */
  const debouncedRender = debounce(() => ui.render(), 200);

  const state = {
    projects: [],
    trashLimit: 50, // v0.30.0：回收站分页，每页 50 条
    qualifications: [], // v0.29.0：企业自有资质（AI 对照用）
    editingId: null,
    darkMode: localStorage.getItem(THEME_KEY) === "dark",
    user: null,
    authMode: "login",
    realtimeReady: false,
    channel: null,
    /** v0.4.1：项目卡片详情展开态（内存 Set，render/筛选/排序/分页/保存后恢复） */
    expandedIds: new Set(),
    /** v0.16.0：卡片内分区折叠态（key 为 `${projectId}:risk`；默认展开的记这里） */
    collapsedSections: new Set(),
    /** v0.35.7：默认收起的分区（key 为 `${projectId}:checklist`）——点开过才记这里 */
    expandedSections: new Set(),
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
    /** v0.11.0：列表分页——首屏只渲染 50 条，点"加载更多"再续 50 条 */
    listLimit: 50,
    /** v0.12.0：离线快照状态（liveLoadedOnce：本会话是否成功同步过一次） */
    offlineSnapshot: false,
    snapshotSavedAt: null,
    liveLoadedOnce: false,
  };

  const getState = () => state;
  const setState = (patch) => Object.assign(state, patch);
  const getClient = () => client;

  /** v0.35.3：折叠区收起时给内层挂 inert。
   *  `.collapse` 用的是 grid-template-rows:0fr + opacity:0，只藏了视觉：实测折叠表单里的
   *  input 仍能 focus()、读屏也会把 11 个选填字段全念一遍。inert 把整棵子树移出焦点序与无障碍树。
   */
  const syncCollapseInert = (collapseEl) => {
    if (!collapseEl) return;
    const inner =
      collapseEl.querySelector(".collapse-inner") ||
      (collapseEl.firstElementChild?.classList?.contains("collapse-inner")
        ? collapseEl.firstElementChild
        : null);
    if (!inner) return;
    if (collapseEl.classList.contains("expanded")) inner.removeAttribute("inert");
    else inner.setAttribute("inert", "");
  };

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
    // v0.35.6：有展开的卡片时收起右下角浮动的「＋」（它会压住详情里的日期）
    ui.syncDetailOpenState();
    // v0.30.0：详情懒生成 —— 展开时才补填详情 HTML（折叠卡片渲染时是空的）。
    if (expanded) {
      const project = state.projects.find((p) => p.id === id);
      ui.fillProjectDetails(item, project);
    }
    // v0.35.3：收起后详情区不可聚焦、不被读屏读出
    syncCollapseInert(details);
  };

  /**
   * v0.35.2：保存后“定身”定位。
   * 表单收起是 0.35s 的 grid 高度动画，收起时下面的列表会整体上抬近千像素；若同一帧就
   * scrollIntoView，算的是旧布局，算完又会被动画抽走，而且滚动位置可能被夹到新页高上限——
   * 这就是“保存后跳到别的地方”。所以等收起动画落定（约 380ms，减动效时几乎瞬间）再定位。
   * 这期间用户又打开表单（revealForm）就直接作废，不去抢页面。
   */
  const FORM_COLLAPSE_SETTLE_MS = 380;
  let pendingLocateTimer = 0;
  const cancelPendingLocate = () => {
    if (pendingLocateTimer) {
      clearTimeout(pendingLocateTimer);
      pendingLocateTimer = 0;
    }
  };
  const locateProjectAfterSave = (projectId) => {
    cancelPendingLocate();
    if (!projectId) return;
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wait = reduceMotion ? 40 : FORM_COLLAPSE_SETTLE_MS;
    pendingLocateTimer = setTimeout(() => {
      pendingLocateTimer = 0;
      // 定位 + 一次柔光提示（v0.35.2：不再有 2 秒背景闪烁）
      ui.focusProjectInList(projectId);
    }, wait);
  };

  /** v0.4.4：新增 / 编辑表单折叠。class 切换（grid 高度动画），只改 DOM + state，不触发 ui.render()。 */
  const setFormExpanded = (expanded) => {
    if (elements.formSheet) {
      elements.formSheet.classList.toggle("hidden", !expanded);
    }
    state.formExpanded = expanded;
    const body = elements.formBody;
    const panel = body?.closest(".form-panel");
    const title = panel?.querySelector('[data-action="toggle-form"]');
    if (body) body.classList.toggle("expanded", expanded);
    // v0.35.5：手机上表单打开时收起右下浮钮——「＋」此刻无用，且压在表单标题的「收起」胶囊上
    document.body.classList.toggle("form-open", expanded);
    if (title) {
      title.setAttribute("aria-expanded", String(expanded));
      const pillLabel = title.querySelector(".form-pill-label");
      if (pillLabel) pillLabel.textContent = expanded ? "收起" : "展开";
    }
    if (panel) panel.classList.toggle("expanded", expanded);
    syncCollapseInert(body);
  };

  /** v0.4.3：展开表单 → 滚动定位 → 高亮 → 聚焦第一个可见输入框 */
  const revealForm = () => {
    // v0.35.2：用户又自己把表单打开了 —— 作废还没执行的“保存后回列表”定位，
    // 否则它会在收起动画后把页面从表单拽回列表（“保存后再切换编辑对象”就走这条路）。
    cancelPendingLocate();
    setFormExpanded(true);
    ui.highlightFormPanel();
    const first = elements.formBody?.querySelector(
      "input:not([type=hidden]), textarea, select"
    );
    if (first) setTimeout(() => first.focus({ preventScroll: true }), 60);
  };

  /** v0.6.0：选填信息折叠（只做 UI 切换，不清空已填值；与 formExpanded 独立）
   *  v0.35.2：备注已挪进必填区最下面（常改的一句话不该躲在折叠里）、但仍算选填，
   *  所以不计入这里的项数。 */
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
  ];
  const setOptionalExpanded = (expanded) => {
    state.optionalExpanded = expanded;
    elements.optionalBody?.classList.toggle("expanded", expanded);
    elements.optionalToggle?.setAttribute("aria-expanded", String(expanded));
    syncCollapseInert(elements.optionalBody);
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
  const drawers = createDrawers({ elements, getState, setState, ui, projectsApi });
  const settings = createSettings({
    elements,
    getState,
    setState,
    ui,
    projectsApi,
    getClient,
  });

  // v0.11.0：SheetJS 懒加载——只在用户第一次导入 .xlsx 时才拉 CDN 库（带 SRI），
  // 首屏不再背这个解析库；失败则回落提示改用 CSV。
  let sheetJsLoading = null;
  const loadSheetJS = () => {
    if (window.XLSX) return Promise.resolve(true);
    if (!sheetJsLoading) {
      sheetJsLoading = new Promise((resolve) => {
        const script = document.createElement("script");
        script.src =
          "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
        script.integrity =
          "sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw";
        script.crossOrigin = "anonymous";
        script.onload = () => resolve(true);
        script.onerror = () => {
          sheetJsLoading = null;
          resolve(false);
        };
        document.head.appendChild(script);
      });
    }
    return sheetJsLoading;
  };

  // v0.35.0：Supabase SDK 改为仓库内 vendor 文件（首屏不再挂境外 CDN，国内网络也不至于白屏）；
  // vendor 文件没加载成功时才回退 jsdelivr 一次，两个都失败才是“依赖加载失败”。
  const SUPABASE_CDN =
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.min.js";
  const SUPABASE_SRI =
    "sha384-dl/4LkSyQ4uEucc48NM6VDZLAjLLq9yMzZ5JLXumBq7Ld33XBof73hseOqPhO89+";
  let supabaseCdnLoading = null;
  const ensureSupabase = async () => {
    if (window.supabase) return true;
    if (!supabaseCdnLoading) {
      supabaseCdnLoading = new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = SUPABASE_CDN;
        script.integrity = SUPABASE_SRI;
        script.crossOrigin = "anonymous";
        script.onload = () => resolve(Boolean(window.supabase));
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
      });
    }
    return supabaseCdnLoading;
  };

  // v0.12.0：数据进出模块实例（绑定在 bindEvents 内调用 dataIo.bindDataIo()）
  const dataIo = createDataIo({
    elements,
    getState,
    ui,
    projectsApi,
    loadSheetJS,
  });

  const resetForm = () => {
    // v0.35.0：草稿按编辑对象存 —— 先记下当前编辑对象，清的是它那一份，
    // 而不是把 editingId 置空后误清“新建”草稿。
    const draftId = state.editingId;
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
    if (elements.form.result) elements.form.result.value = "";
    if (elements.form.bidTime) elements.form.bidTime.value = "";
    clearFieldErrors();
    state.editingId = null;
    elements.submitBtn.textContent = "新增项目";
    elements.cancelBtn.classList.add("hidden");
    elements.formBody?.closest(".form-panel")?.classList.remove("editing");
    if (elements.formSubtitle)
      elements.formSubtitle.textContent =
        "必填：开标时间、项目类型、项目名称、投标公司、联系人；其余选填。";
    setFormExpanded(false); // v0.4.3：保存成功 / 取消后自动收起表单
    clearFormDraft(draftId); // v0.29.0：保存成功 / 取消后草稿作废
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
      // v0.35.0：精确开标时刻（选填，time 输入给 HH:MM）
      bid_time: elements.form.bidTime?.value || null,
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
      // v0.35.0：中标结果（选填，独立于状态，避免把状态机改复杂）
      result: elements.form.result?.value || null,
      notes: elements.form.notes.value.trim() || null,
    };
    return base;
  };

  // v0.29.0：表单草稿保护 —— 输入防抖存草稿（localStorage），页面刷新 /
  // 会话过期后打开表单可恢复；保存成功 / 取消后清除。草稿只留一份、7 天有效。
  // v0.35.0：改成按编辑对象存一份（Map）—— 新建是 "new"，编辑某项目是 id:xxx；
  // 跨项目切换时各自的输入不再互相覆盖，回到原项目还能恢复。
  const loadDrafts = () => pruneFormDrafts(readFormDrafts(localStorage));
  const saveFormDraft = () => {
    const drafts = loadDrafts();
    const key = formDraftKey(state.editingId);
    const fields = formData();
    if (isFormDataEmpty(fields)) {
      delete drafts[key];
      writeFormDrafts(localStorage, drafts);
      return;
    }
    drafts[key] = {
      v: 1,
      editingId: state.editingId ?? null,
      savedAt: Date.now(),
      fields,
    };
    writeFormDrafts(localStorage, drafts);
  };
  const clearFormDraft = (editingId = state.editingId) => {
    const drafts = loadDrafts();
    delete drafts[formDraftKey(editingId)];
    writeFormDrafts(localStorage, drafts);
  };
  const loadFormDraft = (editingId = state.editingId) =>
    pickFormDraft(loadDrafts(), editingId);
  const debouncedSaveFormDraft = debounce(saveFormDraft, 500);
  const applyFormDraft = (draft) => {
    const f = draft.fields || {};
    const set = (key, value) => {
      if (elements.form[key]) elements.form[key].value = value ?? "";
    };
    set("date", f.bid_date);
    set("bidTime", f.bid_time || "");
    set("type", f.project_type);
    set("name", f.name);
    set("biddingCompany", f.bidding_company);
    set("tenderer", f.tenderer);
    set("guarantee", f.guarantee);
    set("amountValue", f.amount_value);
    set("amountUnit", f.amount_unit || "万元");
    set("guaranteeAmount", f.guarantee_amount);
    set("guaranteeUnit", f.guarantee_unit || "万元");
    set("guaranteeStatus", f.guarantee_status || "未缴纳");
    set("registrationDeadline", f.registration_deadline);
    set("inquiryDeadline", f.inquiry_deadline);
    set("clarificationDeadline", f.clarification_deadline);
    set("guaranteeDeadline", f.guarantee_deadline);
    set("contact", f.contact);
    set("status", f.status || "报名中");
    set("result", f.result || "");
    set("notes", f.notes);
    state.editingId = draft.editingId ?? null;
    if (state.editingId) {
      const p = state.projects.find(
        (project) => project.id === state.editingId
      );
      elements.submitBtn.textContent = "保存修改";
      elements.cancelBtn.classList.remove("hidden");
      elements.formBody?.closest(".form-panel")?.classList.add("editing");
      if (elements.formSubtitle)
        elements.formSubtitle.textContent = `正在编辑：${String(
          p?.name || ""
        ).slice(0, 12)}…`;
    } else {
      elements.submitBtn.textContent = "新增项目";
      elements.cancelBtn.classList.add("hidden");
      elements.formBody?.closest(".form-panel")?.classList.remove("editing");
      if (elements.formSubtitle)
        elements.formSubtitle.textContent =
          "必填：开标时间、项目类型、项目名称、投标公司、联系人；其余选填。";
    }
    setOptionalExpanded(hasOptionalValues());
    revealForm();
  };
  const maybeOfferFormDraft = async () => {
    const draft = loadFormDraft(state.editingId);
    if (!draft) return;
    if (!isFormDraftUsable(draft, state.editingId)) {
      // 结构完整但 editingId 对不上（旧版单份草稿拖过来的）时留着；坏了 / 过期了才清。
      if (isFormDraftStale(draft)) clearFormDraft(draft.editingId ?? null);
      return;
    }
    const when = new Date(draft.savedAt).toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const restore = await ui.confirmDialog({
      title: "恢复草稿",
      message: `发现上次未保存的表单内容（保存于 ${when}），是否恢复？`,
      confirmText: "恢复草稿",
      cancelText: "放弃草稿",
    });
    if (restore) {
      applyFormDraft(draft);
      ui.showToast("草稿已恢复。");
    } else {
      clearFormDraft(state.editingId);
    }
  };

  // v0.35.0：必填校验从“一句总话”改成“指出是哪几项”——给第一个缺失字段加红边 + 下方一行小字，
  // 并把焦点 / 滚动送过去；toast 只说还差几项。与 projectsApi.validate 共用同一张字段表。
  // 必填字段派生自字段注册表（required 字段；与 projectsApi.validate 共用同一张字段表）。
  const REQUIRED_FORM_FIELDS = requiredFormFields();
  const clearFieldErrors = () => {
    REQUIRED_FORM_FIELDS.forEach(({ key }) => {
      const input = elements.form[key];
      input?.closest(".field")?.classList.remove("invalid");
      input?.removeAttribute("aria-invalid");
      const err = document.getElementById(`err-${key}`);
      if (err) err.classList.add("hidden");
    });
  };
  const showFieldErrors = (missingDbFields = []) => {
    clearFieldErrors();
    let firstInput = null;
    for (const { db, key } of REQUIRED_FORM_FIELDS) {
      if (!missingDbFields.includes(db)) continue;
      const input = elements.form[key];
      if (!input) continue;
      input.closest(".field")?.classList.add("invalid");
      input.setAttribute("aria-invalid", "true");
      const err = document.getElementById(`err-${key}`);
      if (err) err.classList.remove("hidden");
      if (!firstInput) firstInput = input;
    }
    if (firstInput) {
      setFormExpanded(true);
      firstInput.focus({ preventScroll: true });
      firstInput.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  /** v0.35.0：表单提交抽成函数 —— 按钮、回车（form submit）与“切换编辑对象前先保存”共用一条路径。 */
  const submitForm = async () => {
    const data = formData();
    const check = projectsApi.validate(data);
    if (!check.ok) {
      showFieldErrors(check.missingFields);
      ui.showToast(`还有 ${check.missing.length} 项必填：${check.missing.join("、")}`);
      return false;
    }
    clearFieldErrors();
    const btn = elements.submitBtn;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "保存中…";
    const savedId = await projectsApi.saveProject(data, state.editingId);
    btn.disabled = false;
    if (!savedId) {
      btn.textContent = originalText;
      return false;
    }
    resetForm();
    vibrate(10); // v0.55.0 JS 批 B6：表单提交成功轻震
    // v0.35.2：等表单收起动画落定再回到这张卡片（以前同一帧定位，结果页面被抽到列表底部）。
    locateProjectAfterSave(savedId);
    return true;
  };

  // 注意：浏览器通知仅在页面打开时触发（setInterval），关页后不会提醒。
  // v0.33.0 起关页提醒由 .ics 日历订阅承担（api/calendar.js + 系统日历通知），
  // 邮件提醒的 Edge Function 仍未部署，见 docs/reminders.md。
  // 多截止时间通知：遍历每个项目的全部截止项，days=0/1 时通知，文案带截止类型。
  function sendBidNotifications() {
    if (
      !("Notification" in window) ||
      Notification.permission !== "granted" ||
      !state.user
    )
      return;
    // v0.30.0：通知去重键过期清理（30 天以上的直接清掉，防 localStorage 越攒越多）。
    // v0.35.3：从每次（60 秒一轮）全量遍历挪到登录时跑一次 —— 去重键的生命周期以“天”计，
    // 每分钟扫一遍整个 localStorage 没有意义。
    const urlHint = String(config.url || "").slice(-12);
    state.projects.forEach((project) => {
      for (const item of getDeadlineItems(project)) {
        if (item.days !== 0 && item.days !== 1) continue;
        const stage = item.days === 0 ? "today" : "tomorrow";
        const notificationKey = `bid-reminder:${urlHint}:${state.user.id}:${project.id}:${item.key}:${item.date}:${stage}`;
        if (localStorage.getItem(notificationKey)) continue;
        new Notification(`截止提醒：${project.name}`, {
          body: `${item.label}：${item.date}${item.time ? ` ${item.time}` : ""}${item.days === 0 ? "（今日）" : "（明日）"}`,
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
    ui.showToast(`${names}${more}已过开标时间，状态仍不是“已开标”，请核对（仅页面打开时提醒）。`);
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
    elements.aiSettingsBtn?.classList.add("has-badge");
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
    // v0.55.0 JS 批 A-E：窄屏顶栏邮箱收起后，当前登录邮箱在设置“账户”区展示；
    // 设置打开时 settings.js 也会按 state.user 重填一次。
    if (elements.settingsAccountEmail)
      elements.settingsAccountEmail.textContent = user.email || "未登录";
    elements.authView.classList.add("hidden");
    elements.appView.classList.remove("hidden");
    // v0.35.3：登录时只刷新通知状态行，不再自动申请权限（见 requestNotificationPermission 注释）；
    // 去重键清理也从每分钟一轮挪到这里跑一次。
    settings.updateNotificationRow();
    pruneNotificationKeys(localStorage);
    ui.showListSkeleton();
    // v0.29.0：登录后拉一次资质库（表未建时 projectsApi 只提示一次，不阻塞项目加载）
    projectsApi.loadQualifications().then((list) => {
      state.qualifications = list || [];
    });
    projectsApi.loadProjects().then((loaded) => {
      if (!loaded) return;
      // v0.12.0：离线快照下不做任何写操作
      // （过期回收站清理、本地迁移都会写库；提醒也以 live 数据为准）
      if (state.offlineSnapshot) return;
      showMissedReminders();
      sendBidNotifications();
      maybeShowBackupTip(); // v0.8.0：登录后检查 30 天备份提醒
      projectsApi.purgeExpiredTrash();
      return projectsApi.migrateLocalProjects();
    });
    // v0.31.0：Realtime 改走增量应用（只动受影响的行）——之前每次变更（含自己刚保存
    // 的回声）都全量重拉，等于每次保存拉两遍；解析失败才回落全量重拉。
    projectsApi.subscribeToProjects((payload) => {
      const applied = projectsApi.applyRealtimeChange(payload);
      if (!applied) {
        projectsApi.loadProjects().then(() => {
          sendBidNotifications();
        });
      } else {
        sendBidNotifications();
      }
    });
    runStartupAction();
  }

  /** v0.35.3：PWA 快捷方式入口（manifest.shortcuts 的 ?action=add / ?action=calendar）。
   *  登录后执行一次，然后把参数从地址栏抹掉（刷新不会再触发）。直接复用按钮点击，
   *  选中态 / Tab 高亮 / 滚动都跟着既有逻辑走，不另外复制一份。 */
  function runStartupAction() {
    let action = "";
    try {
      action = new URLSearchParams(location.search).get("action") || "";
    } catch {
      return;
    }
    if (!action) return;
    try {
      history.replaceState(null, "", location.pathname + location.hash);
    } catch {
      // 不支持就算了，不影响下面的动作
    }
    if (action === "add") elements.addProjectBtn?.click();
    else if (action === "calendar")
      document.querySelector('.view-btn[data-view="calendar"]')?.click();
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

  // v0.11.0：底部 Tab 高亮（模块级，供 showDashboard/setViewMode 共用）
  function setActiveTab(name) {
    document.querySelectorAll(".bottom-tab").forEach((b) => {
      const on = b.dataset.tab === name;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  // v0.30.0：列表滚动位置 —— 滚动时顺手记下（列表视图下才记），点底部“项目”
  // 从日历回来时恢复，别每次都回顶丢位置。
  let savedListScrollY = null;
  const showDashboard = ({ restoreScroll = false } = {}) => {
    elements.dashboardView.classList.remove("hidden");
    playViewEnter(elements.dashboardView);
    setActiveTab("projects");
    if (restoreScroll && savedListScrollY !== null) {
      window.scrollTo({ top: savedListScrollY, behavior: "auto" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
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

  /** v0.35.3：登录卡提示统一走一个口 —— 文本 + 成功/失败类（原本四处零散写 textContent、
   *  两处还内联 style.color 切色）。 */
  const setAuthMessage = (text, kind = "error") => {
    if (!elements.authMessage) return;
    elements.authMessage.textContent = text || "";
    elements.authMessage.classList.toggle("is-success", kind === "success" && Boolean(text));
  };

  function bindEvents() {
    // v0.35.0：四个抽屉（保证金 / 资质 / 日历订阅 / 回收站）的事件与开关在 js/drawers.js
    drawers.bindDrawers();
    // v0.51.5：设置弹窗的事件与开关在 js/settings.js
    settings.bindSettings();
    // v0.35.0：登录 / 注册两种模式的 UI 差异收到一处 —— 注册时隐藏与注册无关的
    // “忘记密码 / 重发验证邮件”，首段换成注册文案，并显示“确认密码”；
    // 同时给 tab 补 aria-pressed（之前选中态只写在 class 里，读屏读不出来）。
    const applyAuthMode = (mode) => {
      state.authMode = mode;
      const signup = mode === "signup";
      elements.authTabs.forEach((item) => {
        const on = item.dataset.mode === mode;
        item.classList.toggle("active", on);
        item.setAttribute("aria-pressed", on ? "true" : "false");
      });
      elements.authTabsWrap?.classList.toggle("mode-signup", signup);
      elements.authSubmit.textContent = signup ? "注册账号" : "登录";
      elements.authPassword.autocomplete = signup ? "new-password" : "current-password";
      if (elements.authIntro)
        elements.authIntro.textContent = signup
          ? "注册后项目存到云端，手机和电脑自动同步。"
          : "登录后项目保存到云端，多设备自动同步。";
      if (elements.authTitle) elements.authTitle.textContent = signup ? "注册新账号" : "登录";
      elements.authLinksWrap?.classList.toggle("hidden", signup);
      elements.authConfirmField?.classList.toggle("hidden", !signup);
      if (elements.authConfirmPassword) {
        elements.authConfirmPassword.required = signup;
        if (!signup) elements.authConfirmPassword.value = "";
      }
      elements.authMessage.textContent = "";
      elements.authMessage.classList.remove("is-success");
    };
    elements.authTabs.forEach((tab) =>
      tab.addEventListener("click", () => applyAuthMode(tab.dataset.mode))
    );
    applyAuthMode(state.authMode);

    // v0.35.0：依赖加载失败时显示的重试按钮
    elements.authRetryBtn?.addEventListener("click", () => location.reload());

    // v0.9.0：密码可见性切换（不改密码值，只改输入框类型）
    elements.togglePasswordBtn?.addEventListener("click", () => {
      const input = elements.authPassword;
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      // v0.35.3：两个内联 SVG 眼睛图标靠类切换，不再换 emoji 文字
      elements.togglePasswordBtn.classList.toggle("is-visible", show);
      elements.togglePasswordBtn.setAttribute(
        "aria-label",
        show ? "隐藏密码" : "显示密码"
      );
      elements.togglePasswordBtn.title = show ? "隐藏密码" : "显示密码";
      input.focus();
    });

    elements.authForm.addEventListener("submit", async (event) => {
      // v0.35.1：确认密码不一致时提前 return，原来会漏掉 preventDefault，
      // 表单照旧原生提交（页面刷成 ./?），提示一闪即失、注册模式也被重置。
      event.preventDefault();
      setAuthMessage("");
      // v0.35.3：登录表单改 novalidate + 自定义中文提示（与项目表单一致）——
      // 原先交给浏览器原生气泡，文案随系统语言、样式也不统一。
      const email = elements.authEmail.value.trim();
      const password = elements.authPassword.value;
      if (!email) {
        setAuthMessage("请填写邮箱。");
        elements.authEmail.focus();
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setAuthMessage("邮箱格式不对，例如 name@example.com。");
        elements.authEmail.focus();
        return;
      }
      if (!password) {
        setAuthMessage("请填写密码。");
        elements.authPassword.focus();
        return;
      }
      if (state.authMode === "signup" && password.length < 8) {
        setAuthMessage("密码至少 8 位。");
        elements.authPassword.focus();
        return;
      }
      // v0.35.0：注册要输两遍密码 —— 打错一个字就要走一整轮找回流程。
      if (state.authMode === "signup" && !elements.authConfirmPassword?.value) {
        setAuthMessage("请再输入一次密码。");
        elements.authConfirmPassword?.focus();
        return;
      }
      if (
        state.authMode === "signup" &&
        elements.authConfirmPassword &&
        elements.authConfirmPassword.value !== elements.authPassword.value
      ) {
        setAuthMessage("两次输入的密码不一致。");
        elements.authConfirmPassword.focus();
        return;
      }
      elements.authSubmit.disabled = true;
      const result = await auth.handleAuth(
        event,
        state.authMode,
        email,
        password
      );
      elements.authSubmit.disabled = false;
      if (result.error) {
        setAuthMessage(result.error);
        return;
      }
      if (result.successMessage) {
        setAuthMessage(result.successMessage, "success");
      }
    });

    elements.signOutBtn?.addEventListener("click", () => {
      // 设置弹窗里没有退出按钮，但层若还开着（如从菜单进来又点了退出），先收干净
      settings.close();
      auth.signOut();
    });
    elements.themeBtn?.addEventListener("click", () => {
      state.darkMode = !state.darkMode;
      localStorage.setItem(THEME_KEY, state.darkMode ? "dark" : "light");
      ui.applyTheme(state.darkMode);
    });
    // v0.12.0：联网后自动从快照恢复为 live 数据（loadProjects 成功即清横幅）
    window.addEventListener("online", () => {
      if (state.offlineSnapshot) {
        projectsApi.loadProjects();
      }
    });
    // v0.12.0：数据进出绑定（导出 / 备份 / 恢复 / 导入 / 模板，见 js/data-io.js）
    dataIo.bindDataIo();

    // v0.8.0：列表 / 日历视图切换（日历模式下退出选择模式，避免两者叠加）
    const setViewMode = (mode) => {
      if (mode !== "list" && mode !== "calendar") return;
      state.viewMode = mode;
      document.querySelectorAll(".view-btn").forEach((b) => {
        const on = b.dataset.view === mode;
        b.classList.toggle("active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      // v0.35.0：“选择 / 全部折叠”在日历视图里没有可作用的对象，收起这两个入口，
      // 不让它们看起来能点却什么都不变（搜索已改成日历也生效）。
      document
        .querySelector(".list-tools")
        ?.classList.toggle("calendar-mode", mode === "calendar");
      // v0.11.0：视图切换同步底部 Tab 高亮（桌面端无此元素，调用无害）
      setActiveTab(mode === "calendar" ? "calendar" : "projects");
      elements.calendarView?.classList.toggle("hidden", mode !== "calendar");
      elements.list?.classList.toggle("hidden", mode !== "list");
      const activeView = mode === "calendar" ? elements.calendarView : elements.list;
      if (activeView && typeof requestAnimationFrame === "function") {
        activeView.classList.remove("view-switch-enter");
        requestAnimationFrame(() => activeView.classList.add("view-switch-enter"));
      }
      ui.syncSegThumbs?.();
      if (mode === "calendar") ui.stopHeroTimer?.();
      else ui.renderHero?.();
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

    // v0.34.0：统计卡片已是原生 <button>，Enter / 空格由浏览器直接派发 click，
    // 原先给 div[role=button] 手写的 keydown 已删（留着会重复开一层）。

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
      if (next.length < 8) {
        ui.showToast("新密码至少 8 位。");
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
    // v0.35.0：表单改成真 <form>，提交统一走 submit 事件（按钮与桌面回车同一路径）。
    elements.projectForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      submitForm();
    });
    elements.cancelBtn?.addEventListener("click", resetForm);
    // v0.29.0：表单草稿 —— 输入防抖保存；切页 / 关页前再存一次，500ms 窗口也不丢。
    elements.formBody?.addEventListener("input", debouncedSaveFormDraft);
    elements.formBody?.addEventListener("change", debouncedSaveFormDraft);
    window.addEventListener("beforeunload", saveFormDraft);
    // v0.4.0：搜索框 input 防抖 200ms；筛选 / 排序 change 立即渲染。
    // v0.11.0：换筛选条件即回到第一页（listLimit 复位），避免"加载更多"后的旧页数残留
    elements.search?.addEventListener("input", () => {
      state.listLimit = 50;
      debouncedRender();
    });
    [elements.statusFilter, elements.sortBy, elements.resultFilter].forEach((el) =>
      el?.addEventListener("change", () => {
        state.listLimit = 50;
        ui.render();
      })
    );
    // v0.5.0：iOS segmented control 与隐藏的 statusFilter 同步
    // v0.8.0：只绑状态筛选组，视图切换组（.view-seg）另有处理
    const syncSegControl = () => {
      const value = elements.statusFilter?.value || "all";
      document
        .querySelectorAll('.seg-control[aria-label="按状态筛选"] .seg-btn')
        .forEach((b) => {
          const on = b.dataset.value === value;
          b.classList.toggle("active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
      // v0.34.0：统计卡片与当前筛选同步 —— 选中态靠 aria-pressed（读屏可读）+ .active（看得见）
      document.querySelectorAll(".stat-card[data-stat-filter]").forEach((card) => {
        const on = card.dataset.statFilter === value;
        card.classList.toggle("active", on);
        card.setAttribute("aria-pressed", on ? "true" : "false");
      });
      // v0.36.0：中标结果筛选仅在查看「已开标」或已有结果筛选时显示
      if (elements.resultFilter) {
        const showResult =
          value === "已开标" || elements.resultFilter.value !== "all";
        elements.resultFilter.classList.toggle("hidden", !showResult);
      }
      ui.syncSegThumbs?.();
    };
    document
      .querySelectorAll('.seg-control[aria-label="按状态筛选"] .seg-btn')
      .forEach((btn) =>
        btn.addEventListener("click", () => {
          if (elements.statusFilter) elements.statusFilter.value = btn.dataset.value;
          syncSegControl();
          state.listLimit = 50;
          ui.render();
        })
      );
    state.syncSegControl = syncSegControl;
  state.setViewMode = setViewMode;
    ui.syncSegThumbs?.();
    window.addEventListener("resize", () => ui.syncSegThumbs?.());

    const openHeroProject = () => {
      const id = elements.bpHeroName?.dataset?.projectId;
      if (id) ui.focusProjectInList?.(id);
    };
    elements.bpHero?.addEventListener("click", openHeroProject);
    elements.bpHeroName?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openHeroProject();
      }
    });
    // v0.55.0 JS 批 A：点顶栏倒计时芯片跳到对应项目详情，与点英雄区项目名同一行为。
    elements.heroChip?.addEventListener("click", openHeroProject);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) ui.stopHeroTimer?.();
      else ui.renderHero?.();
    });

    const closeUpcomingSheet = () => elements.upcomingSheet?.classList.add("hidden");
    elements.upcomingDrawerBtn?.addEventListener("click", () => {
      elements.upcomingSheet?.classList.remove("hidden");
    });
    elements.upcomingCloseBtn?.addEventListener("click", closeUpcomingSheet);
    elements.upcomingSheet?.addEventListener("click", (e) => {
      if (e.target === elements.upcomingSheet) closeUpcomingSheet();
    });
    elements.formCloseBtn?.addEventListener("click", () => setFormExpanded(false));
    elements.formSheet?.addEventListener("click", (e) => {
      if (e.target === elements.formSheet) setFormExpanded(false);
    });

    // v0.55.0 JS 批 B5：底部 Tab「菜单」的操作表 —— 就地从底部弹出（复用 .sheet-panel
    // 底部 sheet 形态），不再先 window.scrollTo 回顶（v0.23.0 的绕法已删，见下方
    // 底部 Tab 分支；菜单锚在页顶，下滑后点它会把页面拽回顶部，原生做法是操作表
    // 不动滚动位置）。内容为现有 6 个菜单项：点某项先收起本表，再点一次对应的
    // 原菜单按钮（data-menu-target），行为与点汉堡菜单完全一致（事件与角标逻辑
    // 全部走原路，不复制一份）；「切换为深色/浅色」文案打开时从原按钮同步。
    const openMenuActionSheet = () => {
      const themeItem = elements.menuActionSheet?.querySelector(
        '[data-menu-target="themeBtn"]'
      );
      const themeLabel = elements.themeBtn?.querySelector(".btn-label")?.textContent;
      if (themeItem && themeLabel) themeItem.textContent = themeLabel;
      elements.menuActionSheet?.classList.remove("hidden");
      document.body.classList.add("sheet-open");
    };
    const closeMenuActionSheet = () => {
      if (!elements.menuActionSheet || elements.menuActionSheet.classList.contains("hidden")) return false;
      elements.menuActionSheet.classList.add("hidden");
      // 下面没有别的浮层时才解滚动锁（抽屉/设置可能还盖着）。
      const layerBelow =
        [...document.querySelectorAll(".sheet")].some(
          (el) => el !== elements.menuActionSheet && !el.classList.contains("hidden")
        ) ||
        [...document.querySelectorAll(".drawer-overlay")].some(
          (el) => !el.classList.contains("hidden")
        );
      if (!layerBelow) document.body.classList.remove("sheet-open");
      return true;
    };
    elements.menuActionSheet?.addEventListener("click", (event) => {
      if (event.target.closest("[data-action='close-menu-sheet']")) {
        closeMenuActionSheet();
        return;
      }
      const item = event.target.closest("[data-menu-target]");
      if (!item) return;
      const target = document.getElementById(item.dataset.menuTarget);
      closeMenuActionSheet();
      target?.click();
    });
    // v0.55.0 JS 批 B2：操作表也是底部 sheet，下滑关闭走同一手势模块。
    bindSheetSwipeGesture(elements.menuActionSheet?.querySelector(".sheet-panel"), {
      onClose: closeMenuActionSheet,
    });
    // v0.55.0 JS 批 B2：临期抽屉与项目表单抽屉下滑关闭（只在窄屏 + 触摸设备
    // 上绑定），关闭走现有的 closeUpcomingSheet / setFormExpanded(false)。
    bindSheetSwipeGesture(elements.upcomingSheet?.querySelector(".drawer-panel"), {
      onClose: closeUpcomingSheet,
    });
    bindSheetSwipeGesture(elements.formSheet?.querySelector(".drawer-panel"), {
      onClose: () => setFormExpanded(false),
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeMenuActionSheet();
        closeUpcomingSheet();
        if (state.formExpanded) setFormExpanded(false);
      }
    });
    elements.upcomingList?.addEventListener("click", (event) => {
      if (event.target.closest(".upcoming-item")) closeUpcomingSheet();
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

    // v0.11.0：移动端底部 Tab —— 复用现有视图切换，不新增视图状态；
    // 项目/日历走 setViewMode，菜单走底部操作表。
    document.querySelectorAll(".bottom-tab").forEach((btn) =>
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        vibrate(10); // v0.55.0 JS 批 B6：切换底部 Tab 轻震
        if (tab === "projects") {
          // v0.30.0：从日历回来时恢复列表滚动位置；已经在列表时点“项目”仍是回顶。
          const returning = state.viewMode !== "list";
          showDashboard({ restoreScroll: returning });
          setViewMode("list");
          if (!returning) {
            elements.list
              ?.closest("section")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        } else if (tab === "calendar") {
          showDashboard();
          setViewMode("calendar");
        } else if (tab === "menu") {
          // v0.55.0 JS 批 B5：v0.23.0 的绕法已删 —— 菜单锚在页顶（header 内的
          // 绝对定位下拉框），下滑后从底部点它会先 window.scrollTo 回顶再打开，
          // 页面被拽回顶部；改成就地打开底部操作表（openMenuActionSheet），
          // 不改变页面滚动位置。点底部「项目」Tab 回顶的行为不动。
          openMenuActionSheet();
        }
      })
    );
    // v0.6.0：选填信息折叠开关 + 字段数
    elements.optionalToggle?.addEventListener("click", () => {
      setOptionalExpanded(!state.optionalExpanded);
    });
    if (elements.optionalCount)
      elements.optionalCount.textContent = String(OPTIONAL_FIELDS.length);

    // v0.32.0：全部折叠 —— 清掉所有展开的卡片，只重建受影响的卡片（走定向渲染）。
    elements.collapseAllBtn?.addEventListener("click", () => {
      if (!state.expandedIds.size) return;
      const changed = [...state.expandedIds];
      state.expandedIds.clear();
      ui.renderAfterWrite({ changedIds: changed });
    });

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
      if (ok) {
        vibrate(10); // v0.55.0 JS 批 B6：删除成功轻震
        exitSelectMode();
      }
    });

    // v0.16.0：编辑回填抽出共用 —— 卡片"编辑"走这里。
    // v0.35.0：入口加脏检查 —— 正在填 A（或新建）且切到 B 时先问一句，
    // 不再静默用 B 的数据整张覆盖表单（草稿按 editingId 各存一份，A 的内容也不会被 B 盖掉）。
    const fillFormFromProject = (p) => {
      elements.form.date.value = p.date || "";
      if (elements.form.bidTime) elements.form.bidTime.value = p.bidTime || "";
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
      if (elements.form.result) elements.form.result.value = p.result || "";
      elements.form.notes.value = p.notes || "";
    };

    const enterEditMode = async (p) => {
      if (state.editingId !== p.id && !isFormDataEmpty(formData())) {
        const prevId = state.editingId;
        const prevName =
          state.projects.find((x) => x.id === prevId)?.name || "新建项目";
        const choice = await ui.confirmDialog({
          title: "切换编辑项目",
          message: `当前表单还有「${prevName}」的未保存内容，切到「${p.name}」会覆盖它。`,
          confirmText: "丢弃并切换",
          altText: "保存后再切换",
          cancelText: "继续编辑",
          danger: true,
        });
        if (choice !== "confirm" && choice !== "alt") {
          revealForm();
          return false;
        }
        if (choice === "alt") {
          const saved = await submitForm();
          if (!saved) return false;
        } else {
          clearFormDraft(prevId);
        }
      }
      state.editingId = p.id;
      fillFormFromProject(p);
      setOptionalExpanded(hasOptionalValues()); // v0.6.0：编辑时有选填值则展开
      elements.submitBtn.textContent = "保存修改";
      elements.cancelBtn.classList.remove("hidden");
      elements.formBody?.closest(".form-panel")?.classList.add("editing");
      if (elements.formSubtitle)
        elements.formSubtitle.textContent = `正在编辑：${String(p.name || "").slice(0, 12)}…`;
      revealForm();
      return true;
    };

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
      // v0.35.0：箭头是真正的按钮（行容器不再冒充按钮，读屏不会把里面的按钮念成容器内容）
      if (button.dataset.action === "toggle-details") {
        if (state.selectMode) toggleSelectOne(id);
        else toggleProjectDetails(button);
        return;
      }
      // v0.35.0：详情区的状态一键切换
      if (button.dataset.action === "set-status") {
        const nextStatus = button.dataset.status;
        if (!nextStatus) return;
        const ok = await projectsApi.updateProjectFields(id, { status: nextStatus });
        if (ok) ui.showToast(`状态已改为「${nextStatus}」。`);
        return;
      }
      // v0.35.0：空状态里的“清除搜索与筛选”
      if (button.dataset.action === "clear-filters") {
        if (elements.search) elements.search.value = "";
        if (elements.statusFilter) elements.statusFilter.value = "all";
        if (elements.resultFilter) elements.resultFilter.value = "all";
        state.listLimit = 50;
        if (typeof state.syncSegControl === "function") state.syncSegControl();
        ui.render();
        return;
      }
      // v0.11.0：列表分页——续 50 条后重渲染（筛选变化时 listLimit 已复位）
      if (button.dataset.action === "load-more") {
        state.listLimit = (state.listLimit || 50) + 50;
        ui.render();
        return;
      }
      // v0.6.0：选择模式复选框
      if (button.dataset.action === "toggle-select") {
        toggleSelectOne(id);
        return;
      }
      // v0.5.0：空状态引导按钮 → 展开新增表单
      if (button.dataset.action === "empty-add") {
        revealForm();
        maybeOfferFormDraft(); // v0.29.0：展开空表单时问一次草稿
        return;
      }
      if (button.dataset.action === "delete") {
        const ok = await projectsApi.deleteProject(id);
        if (ok) {
          vibrate(10); // v0.55.0 JS 批 B6：删除成功轻震
          if (state.editingId === id) resetForm();
        }
      }
      if (button.dataset.action === "clone") {
        await projectsApi.cloneProject(id);
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
      // v0.16.0：卡片内分区折叠（废标检查清单）——只动 DOM 与内存态，不重渲染。
      // v0.35.7：默认态交给 utils.isSectionOpen / toggleSectionOpen（清单默认收起），
      // 这里只负责把结果落到 DOM——清单的展开动画由 CSS 的 grid-template-rows 完成。
      // 第 4 批第 1 步：风险与条款分区已随 AI 展示下线，这里只剩清单。
      if (button.dataset.action === "toggle-section") {
        const section = button.dataset.section;
        if (section !== "checklist") return;
        const open = toggleSectionOpen(state, id, section);
        const container = button.closest(".checklist");
        container?.classList.toggle("collapsed", !open);
        container?.classList.toggle("expanded", open);
        button.setAttribute("aria-expanded", String(open));
        button.title = open ? "收起清单" : "展开清单";
      }
      // v0.17.0：废标检查清单一键清空 —— 整列回写为空数组。
      if (button.dataset.action === "clear-checklist") {
        const p = state.projects.find((project) => project.id === id);
        if (!p) return;
        if (!(p.checklist || []).length) {
          ui.showToast("检查清单已经是空的。");
          return;
        }
        const okConfirm = await ui.confirmDialog({
          title: "清空检查清单",
          message: "确定清空该项目的全部检查项吗？清空后无法直接恢复。",
          confirmText: "清空",
          danger: true,
        });
        if (!okConfirm) return;
        const ok = await projectsApi.updateProjectFields(id, {
          checklist: [],
        });
        if (ok) ui.showToast("已清空检查清单。");
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
            if (button.dataset.action === "copy-summary") {
        const p = state.projects.find((item) => item.id === button.dataset.id);
        if (!p) return;
        const summary = [
          `开标时间：${p.date ? formatBidMoment(p) : "未设置"}`,
          `项目类型：${p.type || "-"}`,
          `投标公司：${p.biddingCompany || "-"}`,
          `联系人：${p.contact || "-"}`,
          `项目名称：${p.name || "未命名项目"}`,
          `备注：${p.notes || "—"}`,
        ].join("\n");
        const fallbackCopy = (text) => {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.setAttribute("readonly", "");
          ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
          document.body.appendChild(ta);
          ta.select();
          ta.setSelectionRange(0, text.length);
          let ok = false;
          try { ok = document.execCommand("copy"); } catch {}
          document.body.removeChild(ta);
          return ok;
        };
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(summary).then(
            () => ui.showToast?.("已复制项目摘要"),
            () => ui.showToast?.(fallbackCopy(summary) ? "已复制项目摘要" : "复制失败，请手动复制")
          );
        } else {
          ui.showToast?.(fallbackCopy(summary) ? "已复制项目摘要" : "复制失败，请手动复制");
        }
        return;
      }
      if (button.dataset.action === "edit") {
        const p = state.projects.find((project) => project.id === id);
        if (!p) return;
        const entered = await enterEditMode(p);
        // v0.29.0：同一项目有未保存的草稿时问一次（切换被取消了就不再问）
        if (entered) await maybeOfferFormDraft();
      }
    });

    // 清单勾选：用 change 事件取勾选态；失败时重渲染还原。
    // v0.35.0：函数式 + 串行 —— 手快连勾 5 项不再只成功 3 项。
    elements.list?.addEventListener("change", async (event) => {
      const checkbox = event.target.closest(
        'input[type="checkbox"][data-action="checklist-toggle"]'
      );
      if (!checkbox) return;
      const id = checkbox.dataset.id;
      const itemId = checkbox.dataset.itemId;
      const done = checkbox.checked;
      const ok = await projectsApi.updateProjectFields(id, (p) => ({
        checklist: (p.checklist || []).map((item) =>
          item.id === itemId ? { ...item, done } : item
        ),
      }));
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

    // v0.4.3：新增 / 编辑表单标题点击展开 / 收起（键盘 Enter / Space 同理）
    const formTitle = document.querySelector('.form-panel [data-action="toggle-form"]');
    formTitle?.addEventListener("click", (event) => {
      if (event.target.closest("button, a, input, select, textarea")) return;
      setFormExpanded(!state.formExpanded);
      // v0.29.0：展开空的新表单时，若有未保存的草稿，问一次要不要恢复。
      if (state.formExpanded && !state.editingId && isFormDataEmpty(formData()))
        maybeOfferFormDraft();
    });
    formTitle?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      setFormExpanded(!state.formExpanded);
      if (state.formExpanded && !state.editingId && isFormDataEmpty(formData()))
        maybeOfferFormDraft();
    });

    elements.menuToggle?.addEventListener("click", () =>
      ui.toggleMobileMenu()
    );
    document.addEventListener("click", (e) => {
      const menu = document.getElementById("headerMenu");
      if (
        menu?.classList.contains("open") &&
        !e.target.closest("#headerMenu") &&
        !e.target.closest("#menuToggle") &&
        !e.target.closest('[data-tab="menu"]')
      ) {
        ui.toggleMobileMenu(false);
      }
    });
    // v0.7.0：在菜单内点任何按钮后收起菜单
    document.getElementById("headerMenu")?.addEventListener("click", (e) => {
      if (e.target.closest("button")) ui.toggleMobileMenu(false);
    });
    // v0.35.3：Esc 收口到一处 —— 之前设置 / 菜单 / 四个抽屉各注册一份 keydown，
    // 互不干扰全靠各自的 xOpen 布尔量。现在按「最上层先关」一条链处理：
    // 确认框（js/ui.js 自己处理）> 设置 > 四个抽屉 > 手机端菜单。
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (
        elements.confirmDialog &&
        !elements.confirmDialog.classList.contains("hidden")
      )
        return; // 确认框在最上层，它自己收
      if (closeMenuActionSheet()) return; // v0.55.0 JS 批 B5：底部菜单操作表
      if (settings.isOpen()) {
        settings.close();
        return;
      }
      if (drawers.closeTop()) return;
      ui.toggleMobileMenu(false);
    });
    // v0.7.0：header 新增项目主按钮
    elements.addProjectBtn?.addEventListener("click", () => revealForm());
    // v0.35.0：手机端浮动新增按钮 —— 列表滑到第 20 项也不用滑回页顶才能新增。
    elements.fabAdd?.addEventListener("click", () => {
      revealForm();
      maybeOfferFormDraft();
    });
    // v0.7.0：统计卡片可点击筛选（前 4 张；保证金卡片保持静态）
    // v0.35.0：不再清搜索词 —— 搜了“桥梁”再点“制作中”，期望是“桥梁里制作中的”，
    // 与工具栏那组 seg 筛选行为一致（之前两套“筛选”各干各的）。
    const applyStatFilter = (value) => {
      if (elements.statusFilter) elements.statusFilter.value = value;
      if (typeof state.syncSegControl === "function") state.syncSegControl();
      state.listLimit = 50;
      ui.render();
      elements.list
        ?.closest("section")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    document.querySelectorAll(".stat-card[data-stat-filter]").forEach((card) => {
      card.addEventListener("click", () =>
        applyStatFilter(card.dataset.statFilter)
      );
    });
    // v0.34.0：手机端面板默认收起成一行摘要，点摘要展开 / 收起。
    const setUpcomingExpanded = (expanded) => {
      const panel = document.querySelector(".upcoming-panel");
      const btn = document.getElementById("upcomingSummaryBtn");
      if (!panel) return;
      panel.classList.toggle("expanded", expanded);
      btn?.setAttribute("aria-expanded", expanded ? "true" : "false");
    };
    document.getElementById("upcomingSummaryBtn")?.addEventListener("click", () => {
      const panel = document.querySelector(".upcoming-panel");
      setUpcomingExpanded(!panel?.classList.contains("expanded"));
    });
    // v0.53.0：「临期事项」卡片 —— 直接打开「临期提醒」抽屉（与菜单里的
    // 「临期提醒」同一动作），面板顺手展开、列表当场可见；不再滚动到页面下面板。
    elements.upcomingStatCard?.addEventListener("click", () => {
      setUpcomingExpanded(true);
      elements.upcomingSheet?.classList.remove("hidden");
    });
    // v0.14.0：品牌图标即首页——关浮层 + 回主界面列表 + 回顶；
    // 悬浮组已拿掉，返回靠各层自带关闭（菜单 / 抽屉 / 设置 / 底部 Tab），
    // 回顶部靠底部“项目”Tab（showDashboard 自带回顶）。
    const closeTopLayer = () => {
      if (closeMenuActionSheet()) return true; // v0.55.0 JS 批 B5
      if (elements.headerMenu?.classList.contains("open")) {
        ui.toggleMobileMenu(false);
        return true;
      }
      if (drawers.closeTop()) return true;
      if (settings.isOpen()) {
        settings.close();
        return true;
      }
      return false;
    };
    elements.brandHomeBtn?.addEventListener("click", () => {
      closeTopLayer();
      showDashboard();
      setViewMode("list");
      scrollTo({ top: 0, behavior: "smooth" });
    });
    // v0.23.0：浮动按钮 —— 桌面端回顶部 / 移动端回到底部（显隐由 updateScrollUi 统一管）。
    elements.backToTopBtn?.addEventListener("click", () =>
      scrollTo({ top: 0, behavior: "smooth" })
    );
    elements.goToBottomBtn?.addEventListener("click", () =>
      scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" })
    );
    // v0.4.3：scroll 高频触发，rAF 节流后再更新进度条
    let scrollRaf = 0;
    addEventListener(
      "scroll",
      () => {
        if (scrollRaf) return;
        scrollRaf = requestAnimationFrame(() => {
          scrollRaf = 0;
          ui.updateScrollUi();
          // v0.30.0：列表视图下记下滚动位置，供底部“项目”Tab 回来时恢复。
          if (
            state.viewMode === "list" &&
            !elements.dashboardView.classList.contains("hidden")
          ) {
            savedListScrollY = window.scrollY;
          }
        });
      },
      { passive: true }
    );
  }

  // v0.55.0 JS 批 B4：60 秒定时器与下拉刷新共用的刷新入口。
  // 注意：60 秒定时器原来只做倒计时/英雄区/通知三件，从不拉数据 ——
  // loadProjects 只留给首次加载 / 联网恢复 / 重置 / 恢复备份（见 js/projects.js，
  // 它会全量 ui.render()）。所以 refreshNow 默认只包定时器原有的三件，
  // 定时器行为一字不改；下拉刷新传 { reloadData: true } 才多拉一次数据。
  const refreshNow = async ({ reloadData = false } = {}) => {
    if (reloadData) await projectsApi.loadProjects();
    ui.updateCountdowns();
    ui.renderHero?.();
    sendBidNotifications();
  };

  async function init() {
    ui.applyTheme(state.darkMode);
    bindEvents();
    // v0.55.0 JS 批 B4：顶部下拉刷新 —— 只在窄屏触摸设备启用（手势模块内判断），
    // 松手触发一次数据刷新；刷新态先画骨架屏（复用登录后的 showListSkeleton），
    // 数据回来后 loadProjects 的 ui.render() 把骨架换成列表。
    bindPullToRefresh({
      indicatorEl: elements.ptrIndicator,
      onRefresh: async () => {
        ui.showListSkeleton();
        await refreshNow({ reloadData: true });
      },
    });
    // v0.55.0 JS 批 B12：键盘弹出时收缩表单抽屉、提交按钮吸底（CSS 侧
    // body.keyboard-open）。只看 visualViewport 相对窗口的收缩量，
    // 顶栏折叠等小幅变化（<=150px）不误判；键盘收起时恢复。
    const visualViewport = window.visualViewport;
    if (visualViewport) {
      visualViewport.addEventListener("resize", () => {
        const open = isKeyboardOpen(window.innerHeight, visualViewport.height);
        document.body.classList.toggle("keyboard-open", open);
        if (open) {
          document.documentElement.style.setProperty(
            "--keyboard-vv-height",
            `${visualViewport.height}px`
          );
        } else {
          document.documentElement.style.removeProperty("--keyboard-vv-height");
        }
      });
    }
    // v0.34.0：初始渲染前把统计卡片的 aria-pressed 与默认筛选（全部）对齐
    if (typeof state.syncSegControl === "function") state.syncSegControl();
    ui.updateScrollUi();

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

    if (!configured) {
      setAuthMessage(
        "请先复制 supabase-config.example.js 为 supabase-config.js，并填入 Supabase URL 与 anon key。"
      );
      return;
    }
    if (!(await ensureSupabase())) {
      // v0.35.0：配置是好的、只是依赖没加载 —— 不再误报“你没配置 Supabase”，并给一个重试入口。
      setAuthMessage("依赖加载失败（Supabase SDK 没下载成功），请检查网络后重试。");
      elements.authRetryBtn?.classList.remove("hidden");
      return;
    }
    client = window.supabase.createClient(config.url, config.anonKey);
    auth.bindAuthState();
    await auth.restoreSession();

    setInterval(() => {
      if (!state.user) return;
      refreshNow();
    }, 60000);
  }

  init();
})();
