/**
 * AI Bid Assistant — 入口
 * 模块：js/utils.js · auth.js · projects.js · ui.js
 * 解析模块（js/pdf-parser.js · js/ai-extract.js）v0.11.0 起懒加载：
 * 首次进解析页或打开 AI 设置时才 import，首屏不再付账；
 * pdf.js 本身早已在解析时才动态 import，此处只懒加载本地薄壳。
 */
import { THEME_KEY, formatBidMoment, getReminderDays, setReminderDays, getMissedBidProjects, getDeadlineItems, buildChecklistFromAi, normalizeEvidenceItems, escapeHtml, debounce, parseCsvProjects, buildImportCsvTemplate, sheetRowsToCsv, stripPdfFilenameSuffix, countPdfPagesFromText, isFormDataEmpty, isFormDraftUsable, isFormDraftStale, pruneNotificationKeys, formDraftKey, readFormDrafts, writeFormDrafts, pickFormDraft, pruneFormDrafts, toggleSectionOpen } from "./js/utils.js";
import { createUi } from "./js/ui.js";
import { createProjectsApi } from "./js/projects.js";
import { createAuth } from "./js/auth.js";
import { createDataIo } from "./js/data-io.js";
import { createDrawers } from "./js/drawers.js";

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
    syncStatus: document.getElementById("syncStatus"),
    offlineBanner: document.getElementById("offlineBanner"),
    bpHero: document.getElementById("bpHero"),
    bpHeroLabel: document.getElementById("bpHeroLabel"),
    bpHeroName: document.getElementById("bpHeroName"),
    bpHeroBadge: document.getElementById("bpHeroBadge"),
    bpHeroAction: document.getElementById("bpHeroAction"),
    bpHeroTime: document.getElementById("bpHeroTime"),
    bpHeroCount: document.getElementById("bpHeroCount"),
    dashboardView: document.getElementById("dashboardView"),
    parserView: document.getElementById("parserView"),
    parserSheet: document.getElementById("parserSheet"),
    parserSheetSubtitle: document.getElementById("parserSheetSubtitle"),
    closeParserBtn: document.getElementById("closeParserBtn"),
    pdfInput: document.getElementById("pdfInput"),
    formOpenParserBtn: document.getElementById("formOpenParserBtn"),
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
    applyAiToFormBtn: document.getElementById("applyAiToFormBtn"),
    aiCancelBtn: document.getElementById("aiCancelBtn"),
    clearParserBtn: document.getElementById("clearParserBtn"),
    aiResultPanel: document.getElementById("aiResultPanel"),
    aiSettingsBtn: document.getElementById("aiSettingsBtn"),
    aiSettingsPanel: document.getElementById("aiSettingsPanel"),
    settingsSheet: document.getElementById("settingsSheet"),
    settingsSheetClose: document.getElementById("settingsSheetClose"),
    aiApiKey: document.getElementById("aiApiKey"),
    aiBaseUrl: document.getElementById("aiBaseUrl"),
    aiModel: document.getElementById("aiModel"),
    reminderDays: document.getElementById("reminderDays"),
    notifStatus: document.getElementById("notifStatus"),
    notifBtn: document.getElementById("notifBtn"),
    backupIncludePdfText: document.getElementById("backupIncludePdfText"),
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
  /** 最近一次 AI 分析结果，保存项目时一并写入 */
  let lastAiResult = null;
  // v0.20.0：回填后才把解析原文随表单保存 —— 回填时置 true，提交时用掉一次；
  // 取消表单、清空解析、换目标时都清掉，不回填就不带原文。
  let parserAttachOnSave = false;
  /** v0.18.0：解析抽屉绑定的项目（null = 全局新建模式）；换目标时清旧解析态 */
  let parseTargetId = null;
  let parserSheetOpen = false;
  let parserOpener = null;
  // v0.35.0：区分“AI 分析中”与“PDF 解析中”，共用一个取消按钮。
  let analysisRunning = false;
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

  // v0.11.0：解析模块懒加载——首次需要时才 import，之后复用同一实例。
  // AI 配置本身存在 localStorage，分析时直接读存储；表单回填只在打开设置时做，
  // 因此 init 不再预加载（旧行为：启动即调 loadAiConfigToForm）。
  let pdfParser = null;
  let aiExtract = null;
  let saveAiConfig = null;
  let loadAiConfigToForm = null;
  let parserModulesLoading = null;
  const ensureParserModules = async () => {
    if (pdfParser && aiExtract) return;
    if (!parserModulesLoading) {
      parserModulesLoading = (async () => {
        const [pdfModule, aiModule] = await Promise.all([
          import("./js/pdf-parser.js"),
          import("./js/ai-extract.js"),
        ]);
        pdfParser = pdfModule.createPdfParser({ elements, ui });
        aiExtract = aiModule.createAiExtract({ ui });
        saveAiConfig = aiModule.saveAiConfig;
        loadAiConfigToForm = aiModule.loadAiConfigToForm;
      })();
    }
    return parserModulesLoading;
  };

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
    lastAiResult = null;
    parserAttachOnSave = false;
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

  // v0.29.0：表单草稿保护 —— 输入防抖存草稿（localStorage），页面刷新 /
  // 会话过期后打开表单可恢复；保存成功 / 取消后清除。草稿只留一份、7 天有效。
  // v0.35.0：改成按编辑对象存一份（Map）—— 新建是 "new"，编辑某项目是 id:xxx；
  // 跨项目切换时各自的输入不再互相覆盖，回到原项目还能恢复。
  const loadDrafts = () => pruneFormDrafts(readFormDrafts(localStorage));
  const saveFormDraft = () => {
    const drafts = loadDrafts();
    const key = formDraftKey(state.editingId);
    const fields = formData();
    if (isFormDataEmpty(fields) && !lastAiResult) {
      delete drafts[key];
      writeFormDrafts(localStorage, drafts);
      return;
    }
    drafts[key] = {
      v: 1,
      editingId: state.editingId ?? null,
      savedAt: Date.now(),
      fields,
      aiResult: lastAiResult ?? null,
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
    lastAiResult = draft.aiResult ?? null;
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
  const REQUIRED_FORM_FIELDS = [
    { db: "bid_date", key: "date", label: "开标日期" },
    { db: "project_type", key: "type", label: "项目类型" },
    { db: "name", key: "name", label: "项目名称" },
    { db: "bidding_company", key: "biddingCompany", label: "投标公司" },
    { db: "contact", key: "contact", label: "联系人" },
  ];
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
    // v0.20.0：回填过的解析原文随这次保存一并存上 —— 表单是唯一的保存口，
    if (parserAttachOnSave) {
      const text = elements.parsedText?.value || "";
      parserAttachOnSave = false;
      if (text.trim()) {
        const saved = state.projects.find((p) => p.id === savedId);
        const ok = await projectsApi.updateProjectFields(savedId, {
          pdfText: text,
          pdfFilename: getCurrentPdfFilename(saved?.pdfFilename),
          pdfParsedAt: new Date().toISOString(),
        });
        if (!ok) ui.showToast("项目已保存，但解析原文没存上，请稍后再试。");
      }
    }
    resetForm();
    // v0.35.2：等表单收起动画落定再回到这张卡片（以前同一帧定位，结果页面被抽到列表底部）。
    locateProjectAfterSave(savedId);
    return true;
  };

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

  /** 当前解析区对应的 PDF 文件名（从文件名栏解析，取不到则用默认名）
   * v0.18.1：文件名栏在查看已保存文本时会带"（N 字）"后缀，从这里反取
   * 会把后缀存回库里、越存越长 —— 取名时先去掉末尾的"（N 字）"（可重复去）。 */
  function getCurrentPdfFilename(fallback) {
    const label = elements.pdfFileName?.textContent || "";
    const match = label.match(/^(?:文件|已保存文件)：\s*(.+)$/);
    const name = stripPdfFilenameSuffix(match?.[1] || "");
    return name || stripPdfFilenameSuffix(fallback) || "招标文件.pdf";
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
    elements.authView.classList.add("hidden");
    elements.appView.classList.remove("hidden");
    // v0.35.3：登录时只刷新通知状态行，不再自动申请权限（见 requestNotificationPermission 注释）；
    // 去重键清理也从每分钟一轮挪到这里跑一次。
    updateNotificationRow();
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

  // v0.11.0：底部 Tab 高亮（模块级，供 showParser/showDashboard/setViewMode 共用）
  function setActiveTab(name) {
    document.querySelectorAll(".bottom-tab").forEach((b) => {
      const on = b.dataset.tab === name;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  // v0.18.0：解析改抽屉 —— showParser 打开抽屉（可绑定项目），showDashboard
  // 关闭抽屉；工作台视图不再被解析页藏起，抽屉盖在列表上方，上下文可见。
  const openParserSheet = (targetId = null, opener = null) => {
    // v0.11.0：进解析时顺手预加载解析模块（不阻塞开抽屉），首次解析无需再等
    ensureParserModules().catch(() => {});
    setParseTarget(targetId);
    parserSheetOpen = true;
    parserOpener = opener || null;
    elements.parserSheet?.classList.remove("hidden");
    document.body.classList.add("sheet-open");
    ui.trapFocusIn(elements.parserSheet);
    setActiveTab("parser");
    elements.closeParserBtn?.focus();
  };

  const closeParserSheet = () => {
    if (!parserSheetOpen) return;
    parserSheetOpen = false;
    ui.releaseFocusTrap(elements.parserSheet);
    elements.parserSheet?.classList.add("hidden");
    document.body.classList.remove("sheet-open");
    setActiveTab(state.viewMode === "calendar" ? "calendar" : "projects");
    if (parserOpener && document.contains(parserOpener)) parserOpener.focus();
    parserOpener = null;
  };

  // v0.18.0：解析目标 —— 抽屉绑定到某个项目时，解析文本/AI 结果都归属它；
  // 换目标时清掉上一份解析态，避免旧文本配新项目；同目标重开则保留。
  // v0.19.0：绑定目标不再用下拉框/固定标签表示 —— 保存与回填的目标在
  // 做决定那一步就地选（见 openParserTargetPicker），绑定时根本不出现。
  const setParseTarget = (targetId) => {
    const nextId = targetId || null;
    if (nextId === parseTargetId) return;
    parseTargetId = nextId;
    resetParserState();
    const p = nextId
      ? state.projects.find((project) => project.id === nextId)
      : null;
    if (elements.parserSheetSubtitle) {
      elements.parserSheetSubtitle.textContent = p
        ? `正在为「${p.name}」解析招标文件，分析结果可回填到该项目的表单。`
        : "PDF 在浏览器本地解析，文件本身不上传；解析文字随表单保存后存到云端，AI 分析时会发给您配置的模型服务商。";
    }
  };

  // v0.16.0：清掉上一份解析的 AI 结果 —— 新文件解析前、查看已保存文本时、
  // 点"清空"时都调，避免旧面板配新文本、旧结果带进下次保存。
  // v0.35.6：它原来定义在 bindEvents() 里，而 resetParserState / setParseTarget（模块级）
  // 也在调它 —— 每次打开解析抽屉都会抛 ReferenceError，抽屉打不开（v0.35.0 重构时挪漏了）。
  const clearStaleAiResult = () => {
    lastAiResult = null;
    if (elements.aiResultPanel) elements.aiResultPanel.innerHTML = "";
    if (elements.applyAiToFormBtn) elements.applyAiToFormBtn.disabled = true;
  };

  // v0.18.0：解析区复位 —— 清文本、AI 面板、进度与按钮态，不动表单；
  // 绑定目标本身不在这里动（换目标由 setParseTarget 管，清空按钮只清内容）。
  const resetParserState = () => {
    clearStaleAiResult();
    if (elements.parsedText) {
      elements.parsedText.value = "";
      elements.parsedText.classList.add("hidden");
    }
    if (elements.pdfFileName) elements.pdfFileName.textContent = "";
    if (elements.pdfPageCount) elements.pdfPageCount.textContent = "总页数：0";
    pdfParser?.setParseProgress?.(0, "等待解析");
    // setParseProgress 会取消隐藏，复位完再藏起，下次解析开始时它自己再显示。
    elements.parserStatus?.classList.add("hidden");
    if (elements.pdfInput) elements.pdfInput.value = "";
    elements.toggleTextBtn.disabled = true;
    elements.toggleTextBtn.textContent = "查看原始文本";
    elements.copyTextBtn.disabled = true;
    elements.aiAnalyzeBtn.disabled = true;
    elements.applyAiToFormBtn.disabled = true;
    elements.clearParserBtn.disabled = true;
    parserAttachOnSave = false;
  };

  const showParser = (targetId = null, opener = null) =>
    openParserSheet(targetId, opener);

  // v0.30.0：列表滚动位置 —— 滚动时顺手记下（列表视图下才记），点底部“项目”
  // 从日历回来时恢复，别每次都回顶丢位置。
  let savedListScrollY = null;
  const showDashboard = ({ restoreScroll = false } = {}) => {
    closeParserSheet();
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
      if (password.length < 6) {
        setAuthMessage("密码至少 6 位。");
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
      closeSettingsSheet();
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
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
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
    // 项目/日历走 setViewMode，解析走 showParser，菜单走现有菜单开关。
    document.querySelectorAll(".bottom-tab").forEach((btn) =>
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
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
        } else if (tab === "parser") {
          showParser(null, btn);
        } else if (tab === "menu") {
          // v0.23.0：菜单锚在页顶（header 内的绝对定位下拉框），下滑后从底部点它
          // 会开在看不见的页顶——打开时先回顶；关闭时不动（本来就在顶上）。
          const menu = document.getElementById("headerMenu");
          const wasOpen = menu?.classList.contains("open");
          ui.toggleMobileMenu();
          if (!wasOpen) window.scrollTo({ top: 0, behavior: "smooth" });
        }
      })
    );
    // v0.20.0：解析入口挪进新增/编辑表单（可选区）—— 从表单进抽屉时，
    // 目标就是这张表单的项目（编辑态）或新建（新增态），回填后回到同一张表单。
    elements.formOpenParserBtn?.addEventListener("click", (event) =>
      showParser(state.editingId || null, event.currentTarget)
    );
    // v0.20.0：✕ 只做关抽屉，不再绕回工作台（少走 showDashboard 的滚动与
    // 视图切换）；按钮本身也带 data-action="close-parser"，抽屉的委托监听
    // 同样能接住，双保险。遮罩（抽屉外暗色空白）点一下也是关抽屉。
    elements.closeParserBtn?.addEventListener("click", closeParserSheet);
    // v0.18.0：解析抽屉 —— 点遮罩或按 Esc 关闭；确认框盖在抽屉上时先让
    // 确认框处理 Esc，别把抽屉一起关了。
    elements.parserSheet?.addEventListener("click", (event) => {
      if (event.target.closest("[data-action='close-parser']"))
        closeParserSheet();
    });
    // v0.35.3：Esc 统一由 bindEvents 末尾那一个监听处理（按“最上层先关”链，见后）。
    elements.dropZone?.addEventListener("click", () =>
      elements.pdfInput.click()
    );
    elements.dropZone?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        elements.pdfInput.click();
      }
    });
    // v0.35.0：解析也能中止 —— 解析期间把“终止分析”按钮借来当“停止解析”（同一个取消按钮，两种阶段）。
    const startParse = async (file) => {
      await ensureParserModules();
      clearStaleAiResult();
      if (!file) return;
      if (elements.aiCancelBtn) {
        elements.aiCancelBtn.textContent = "⏹ 停止解析";
        elements.aiCancelBtn.classList.remove("hidden");
      }
      try {
        await pdfParser.parsePdf(file);
      } finally {
        if (elements.aiCancelBtn) {
          elements.aiCancelBtn.textContent = "⏹ 终止分析";
          elements.aiCancelBtn.classList.add("hidden");
        }
      }
    };
    elements.pdfInput?.addEventListener("change", (event) => {
      startParse(event.target.files?.[0]);
    });
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
    elements.dropZone?.addEventListener("drop", (event) => {
      startParse(event.dataTransfer.files?.[0]);
    });
    elements.toggleTextBtn?.addEventListener("click", () => {
      const hidden = elements.parsedText.classList.toggle("hidden");
      elements.toggleTextBtn.textContent = hidden
        ? "查看原始文本"
        : "隐藏原始文本";
    });
    elements.copyTextBtn?.addEventListener("click", async () => {
      await ensureParserModules();
      pdfParser.copyParsedText();
    });

    // v0.16.0：清空解析结果 —— 只清解析区（文本 + AI 面板 + 内存旧结果），不动表单。
    // v0.19.0：绑定目标本身不在这里动（换目标由 setParseTarget 管）；选择器
    // 由 resetParserState 一并收起。
    elements.clearParserBtn?.addEventListener("click", () => {
      resetParserState();
      ui.showToast("已清空解析结果。");
    });

    // v0.19.0：把分析结果回填到表单 —— 面板底部只剩这一个动作。保存方式
    // 不在这里选：回填后表单自己的保存按钮即定新建/更新（editingId 决定）。
    // 绑定时直接进该项目的表单；未绑定时就地选一次（默认新建项目）。
    const applyAiResultToForm = async (targetId) => {
      const freshAi = lastAiResult;
      if (!freshAi) {
        ui.showToast("没有可回填的分析结果，先做 AI 分析。");
        return;
      }
      // v0.20.0：回填过，提交表单时把解析原文一并存上（只此一次）。
      parserAttachOnSave = true;
      // v0.6.0：回填到选填字段时自动展开选填区 —— 先记下回填前的值再填。
      const beforeOptional = OPTIONAL_FIELDS.map(
        (k) => elements.form[k]?.value ?? ""
      );
      if (!targetId) {
        // v0.35.0：同样先做脏检查 —— 从底部 Tab 打开解析、回填到“新建”时，
        // 不能把正在填的那张表单一键抹掉。
        if (!isFormDataEmpty(formData())) {
          const choice = await ui.confirmDialog({
            title: "切换到新建项目",
            message: "当前表单还有未保存内容，回填到新建项目会覆盖它。",
            confirmText: "丢弃并新建",
            altText: "保存后再新建",
            cancelText: "继续编辑",
            danger: true,
          });
          if (choice === "alt") {
            if (!(await submitForm())) return;
          } else if (choice !== "confirm") {
            return;
          } else {
            clearFormDraft(state.editingId);
          }
        }
        state.editingId = null;
        elements.submitBtn.textContent = "新增项目";
        elements.cancelBtn.classList.add("hidden");
        elements.formBody?.closest(".form-panel")?.classList.remove("editing");
        if (elements.formSubtitle)
          elements.formSubtitle.textContent =
            "必填：开标时间、项目类型、项目名称、投标公司、联系人；其余选填。";
        showDashboard();
        revealForm();
      } else {
        const p = state.projects.find((project) => project.id === targetId);
        if (!p) {
          ui.showToast("所选项目不存在。");
          return;
        }
        // v0.17.0：先回工作台再展开表单 —— 表单在藏着的视图里展开，
        // 点了跟没点一样（v0.16.0 的教训）。
        // v0.20.0：已经在改这张卡片时不再重进编辑态 —— enterEditMode 会从
        // 库里重填整张表单，抹掉表单里还没保存的手填内容。
        showDashboard();
        if (state.editingId === targetId) {
          revealForm();
        } else {
          const entered = await enterEditMode(p);
          if (!entered) {
            parserAttachOnSave = false;
            return;
          }
        }
      }
      lastAiResult = freshAi;
      aiExtract.applyToForm(elements, freshAi);
      const optionalFilled = OPTIONAL_FIELDS.some((k, i) => {
        const v = elements.form[k]?.value ?? "";
        return v !== beforeOptional[i] && String(v).trim() !== "";
      });
      if (optionalFilled) setOptionalExpanded(true);
      saveFormDraft(); // v0.29.0：回填完即存草稿，丢了页面也能恢复
    };

    // v0.20.0：回填按钮挪到操作区「AI 分析」后面 —— 面板只展示结果，不再
    // 在里面放按钮。没绑定时默认新建，绑定（卡片/表单入口）时回填到该项目。
    // 按钮平时禁用，只有刚分析出结果时才可用。
    elements.applyAiToFormBtn?.addEventListener("click", () => {
      applyAiResultToForm(parseTargetId);
    });

    elements.aiAnalyzeBtn?.addEventListener("click", async () => {
      const text = elements.parsedText?.value;
      if (!text) {
        ui.showToast("先完成 PDF 解析。");
        return;
      }
      await ensureParserModules();
      elements.aiAnalyzeBtn.disabled = true;
      // v0.20.0：分析进行中先禁掉回填 —— 免得点下去回填的是上一份旧结果。
      if (elements.applyAiToFormBtn)
        elements.applyAiToFormBtn.disabled = true;
      // v0.35.0：分析跑着的时候也禁掉“清空解析结果”——否则文本被抹掉、请求还在跑，
      // 跑完又把结果画回面板，界面进入说不清的状态。
      if (elements.clearParserBtn) elements.clearParserBtn.disabled = true;
      analysisRunning = true;
      // v0.17.0：分析中显示“终止分析”，点按后 ai-extract 取消当前请求与后续分块。
      elements.aiCancelBtn?.classList.remove("hidden");
      try {
        // v0.17.0：进度回调带真实百分比（摘要 10→80、最终调用 85、解析结果 95），
        // 不再全程钉死 90%。
        const result = await aiExtract.analyzeTenderText(
          text,
          (msg, pct) => pdfParser.setParseProgress(pct ?? 90, msg),
          state.qualifications
        );
        lastAiResult = result;
        // v0.19.0：分析只展示、不回填表单 —— 回填是用户在面板上点的明确动作。
        aiExtract.renderAiResultPanel(elements.aiResultPanel, result);
        if (elements.applyAiToFormBtn)
          elements.applyAiToFormBtn.disabled = false;
        pdfParser.setParseProgress(100, "AI 分析完成。");
        ui.showToast("AI 分析完成，请核对结果。");
        // v0.16.0：分析完不再自动跳表单 —— 留在解析页核对结果，点「回填到表单」才去表单。
      } catch (err) {
        const msg = err?.message || "AI 分析失败";
        ui.showToast(msg);
        pdfParser.setParseProgress(
          0,
          msg === "已终止分析。" ? "已终止分析。" : "AI 分析失败"
        );
      } finally {
        analysisRunning = false;
        elements.aiAnalyzeBtn.disabled = false;
        elements.aiCancelBtn?.classList.add("hidden");
        // 分析结束（无论成败）把清空按钮按当前文本是否存在重新启用。
        if (elements.clearParserBtn)
          elements.clearParserBtn.disabled = !(elements.parsedText?.value || "").trim();
      }
    });

    // v0.17.0：终止分析 / v0.35.0：停止解析 —— 同一个按钮，按当前阶段决定取消哪个。
    elements.aiCancelBtn?.addEventListener("click", () => {
      if (analysisRunning) aiExtract?.cancelAnalysis?.();
      else pdfParser?.cancelParse?.();
    });

    // v0.34.0：设置改为居中弹窗（桌面）/ 底部抽屉（移动）—— 之前是页面内面板，一点就把
    // 项目列表整块推下去；现在盖在页面上，遮罩点击 / Esc / ✕ 关闭，焦点锁在层内，关后回到菜单按钮。
    // 表单回填仍在打开时做（与旧行为一致，避免把 API Key 常驻在 DOM 里）。
    let settingsSheetOpen = false;
    let settingsOpener = null;
    const openSettingsSheet = async () => {
      if (settingsSheetOpen) return;
      settingsSheetOpen = true;
      settingsOpener = document.activeElement;
      // 先把面板摆出来，再回填字段（模块懒加载慢也不会感觉点了没反应）
      elements.settingsSheet?.classList.remove("hidden");
      document.body.classList.add("sheet-open");
      ui.trapFocusIn(elements.settingsSheet);
      elements.settingsSheetClose?.focus();
      try {
        await ensureParserModules();
        loadAiConfigToForm?.(elements);
      } catch {
        // 模块没加载成功就留空；保存时还会再试一次
      }
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
      await ensureParserModules();
      saveAiConfig({
        apiKey: elements.aiApiKey?.value,
        baseUrl: elements.aiBaseUrl?.value,
        model: elements.aiModel?.value,
      });
      const days = setReminderDays(elements.reminderDays?.value);
      if (elements.reminderDays) elements.reminderDays.value = String(days);
      ui.render();
      ui.showToast(`设置已保存，提醒窗口为未来 ${days} 天。`);
      closeSettingsSheet();
    });

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
        const uid = state.user?.id;
        if (!uid) throw new Error("未登录");
        // v0.32.0：打字确认 —— 必须输入「确认重置」才能继续，输错 / 取消都不执行。
        const typed = await ui.confirmDialog({
          title: "确认重置账户",
          message: "重置将先自动下载一份完整备份，再删除全部项目与通知记录，且无法撤销。",
          confirmText: "确认重置并清空",
          cancelText: "取消",
          danger: true,
          requireTyping: "确认重置",
        });
        if (!typed) return;
        // v0.28.0：重置前先自动下载一份完整备份；备份失败则不执行重置。
        const backedUp = await projectsApi.exportBackup();
        if (!backedUp) {
          ui.showToast("备份失败，未执行重置，请检查网络后重试。");
          return;
        }
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

    // v0.16.0：编辑回填抽出共用 —— 卡片"编辑"与 AI"更新到已有项目"都走这里。
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
        if (ok && state.editingId === id) resetForm();
      }
      // v0.18.0：卡片上直接解析 —— 打开绑定该项目的解析抽屉，上下文不用再选。
      if (button.dataset.action === "parse") {
        const p = state.projects.find((project) => project.id === id);
        if (!p) return;
        showParser(id, button);
        return;
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
        // v0.18.0：查看已保存文本 = 打开绑定该项目的解析抽屉（先清旧态，再载入这份文本）。
        showParser(id, button);
        elements.parsedText.value = text;
        elements.parsedText.classList.remove("hidden");
        // v0.18.1：文件名先洗掉已污染的"（N 字）"后缀再显示，字数只作显示、
        // 不再进文件名；总页数从文本里的"【第 N 页】"标记推算（这条路以前
        // 从不写页数，一直留着初始的 0），没标记则显示"未知"，不编造。
        const cleanFilename = stripPdfFilenameSuffix(p.pdfFilename || "未命名");
        elements.pdfFileName.textContent = `已保存文件：${cleanFilename}（${text.length} 字）`;
        const savedPages = countPdfPagesFromText(text);
        if (elements.pdfPageCount)
          elements.pdfPageCount.textContent =
            savedPages > 0 ? `总页数：${savedPages}` : "总页数：未知";
        // v0.16.0：同时清掉上一份的 AI 面板，避免旧结果配这份文本。
        clearStaleAiResult();
        elements.toggleTextBtn.disabled = false;
        elements.toggleTextBtn.textContent = "隐藏原始文本";
        elements.copyTextBtn.disabled = false;
        elements.aiAnalyzeBtn.disabled = false;
        elements.clearParserBtn.disabled = false;
        // 这份文本本就是从该项目存里取出来的，无需再标保存态。
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
      // v0.16.0：卡片内分区折叠（风险与条款 / 废标检查清单）——只动 DOM 与内存态，不重渲染。
      // v0.35.7：默认态交给 utils.isSectionOpen / toggleSectionOpen（风险默认展开、清单默认收起），
      // 这里只负责把结果落到 DOM——清单的展开动画由 CSS 的 grid-template-rows 完成。
      if (button.dataset.action === "toggle-section") {
        const section = button.dataset.section;
        if (section !== "risk" && section !== "checklist") return;
        const open = toggleSectionOpen(state, id, section);
        const container = button.closest(".risk-report, .checklist");
        container?.classList.toggle("collapsed", !open);
        container?.classList.toggle("expanded", open);
        button.setAttribute("aria-expanded", String(open));
        if (section === "checklist") {
          button.title = open ? "收起清单" : "展开清单";
        } else {
          button.textContent = open ? "收起" : "展开";
        }
      }
      // v0.16.0：AI 结论单条删除 —— 先确认，再整列回写；原始 JSON 仍在 extractedMeta 里。
      if (button.dataset.action === "delete-evidence") {
        const p = state.projects.find((project) => project.id === id);
        if (!p) return;
        const fieldMap = {
          qualification: "qualification",
          invalid: "invalidBidClauses",
          risk: "riskPoints",
        };
        const field = fieldMap[button.dataset.kind];
        const index = Number(button.dataset.index);
        if (!field || !Number.isInteger(index)) return;
        const items = normalizeEvidenceItems(p[field]);
        const item = items[index];
        if (!item) return;
        const okConfirm = await ui.confirmDialog({
          title: "删除这条结论",
          message: "确定删除这条结论吗？删除后不再显示，也无法直接恢复。",
          confirmText: "删除",
          danger: true,
        });
        if (!okConfirm) return;
        // v0.35.0：函数式更新 —— 排队到本次写入时才读最新清单，不会拿旧数组覆盖刚勾的项。
        const ok = await projectsApi.updateProjectFields(id, (fresh) => {
          const latest = normalizeEvidenceItems(fresh[field]);
          latest.splice(Number(button.dataset.index), 1);
          return { [field]: latest };
        });
        if (ok) ui.showToast("已删除该条结论。");
      }
      // v0.17.0：风险与条款一键清空 —— 摘要 + 三列结论一起清（risk_summary
      // 需进 updateProjectFields 白名单）；空内容时不弹确认，直接提示。
      if (button.dataset.action === "clear-risk") {
        const p = state.projects.find((project) => project.id === id);
        if (!p) return;
        const hasAny =
          p.riskSummary ||
          (p.riskPoints && p.riskPoints.length) ||
          (p.qualification && p.qualification.length) ||
          (p.invalidBidClauses && p.invalidBidClauses.length);
        if (!hasAny) {
          ui.showToast("风险与条款已经是空的。");
          return;
        }
        const okConfirm = await ui.confirmDialog({
          title: "清空风险与条款",
          message:
            "确定清空该项目的全部风险与条款吗？包括风险摘要、资格要求、废标条款与风险点，清空后无法直接恢复。",
          confirmText: "清空",
          danger: true,
        });
        if (!okConfirm) return;
        const ok = await projectsApi.updateProjectFields(id, {
          riskSummary: null,
          riskPoints: [],
          qualification: [],
          invalidBidClauses: [],
        });
        if (ok) ui.showToast("已清空风险与条款。");
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
      // v0.15.0：AI 结论逐条核对 —— 点按切换 verified，整列回写；旧字符串先归一化。
      if (button.dataset.action === "verify-evidence") {
        const p = state.projects.find((project) => project.id === id);
        if (!p) return;
        const fieldMap = {
          qualification: "qualification",
          invalid: "invalidBidClauses",
          risk: "riskPoints",
        };
        const field = fieldMap[button.dataset.kind];
        const index = Number(button.dataset.index);
        if (!field || !Number.isInteger(index)) return;
        const items = normalizeEvidenceItems(p[field]);
        const item = items[index];
        if (!item) return;
        // v0.35.0：函数式更新 + 串行队列（连续核对多条时不再互相覆盖）
        const ok = await projectsApi.updateProjectFields(id, (fresh) => {
          const latest = normalizeEvidenceItems(fresh[field]);
          const target = latest[index];
          if (!target) return {};
          latest[index] = { ...target, verified: !target.verified };
          return { [field]: latest };
        });
        if (ok) {
          const now = state.projects.find((project) => project.id === id)?.[field]?.[index];
          ui.showToast(now?.verified ? "已标记为人工已核对。" : "已取消核对。");
        }
      }
            if (button.dataset.action === "copy-summary") {
        const p = state.projects.find((item) => item.id === button.dataset.id);
        if (!p) return;
        const summary = [
          `【${p.name || "未命名项目"}】`,
          `开标时间：${p.date ? formatBidMoment(p) : "未设置"}`,
          `项目类型：${p.type || "-"}`,
          `投标公司：${p.biddingCompany || "-"}`,
          `联系人：${p.contact || "-"}`,
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
    // v0.35.3：Esc 收口到一处 —— 之前解析抽屉 / 设置 / 菜单 / 四个抽屉各注册一份 keydown，
    // 互不干扰全靠各自的 xOpen 布尔量。现在按「最上层先关」一条链处理：
    // 确认框（js/ui.js 自己处理）> 解析抽屉 > 设置 > 四个抽屉 > 手机端菜单。
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (
        elements.confirmDialog &&
        !elements.confirmDialog.classList.contains("hidden")
      )
        return; // 确认框在最上层，它自己收
      if (parserSheetOpen) {
        closeParserSheet();
        return;
      }
      if (settingsSheetOpen) {
        closeSettingsSheet();
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
    // v0.34.0：「即将开标」卡片——不是筛选，而是跳到下面的即将开标面板（闪一下指位置）。
    // v0.35.5：手机端面板默认收起成一行摘要，跳过去时顺手展开。
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
    elements.upcomingStatCard?.addEventListener("click", () => {
      const panel = document.querySelector(".upcoming-panel");
      if (!panel) return;
      setUpcomingExpanded(true);
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
      panel.classList.add("panel-flash");
      setTimeout(() => panel.classList.remove("panel-flash"), 1600);
    });
    // v0.14.0：品牌图标即首页——关浮层 + 回主界面列表 + 回顶；
    // 悬浮组已拿掉，返回靠各层自带关闭（菜单 / 抽屉 / 设置 / 底部 Tab），
    // 回顶部靠底部“项目”Tab（showDashboard 自带回顶）。
    const closeTopLayer = () => {
      if (elements.headerMenu?.classList.contains("open")) {
        ui.toggleMobileMenu(false);
        return true;
      }
      if (drawers.closeTop()) return true;
      if (settingsSheetOpen) {
        closeSettingsSheet();
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

  async function init() {
    ui.applyTheme(state.darkMode);
    bindEvents();
    // v0.34.0：初始渲染前把统计卡片的 aria-pressed 与默认筛选（全部）对齐
    if (typeof state.syncSegControl === "function") state.syncSegControl();
    ui.updateScrollUi();
    // v0.11.0：AI 配置表单不再启动时回填，打开设置面板时才回填（见 aiSettingsBtn）

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
      ui.updateCountdowns();
      ui.renderHero?.();
      sendBidNotifications();
    }, 60000);
  }

  init();
})();
