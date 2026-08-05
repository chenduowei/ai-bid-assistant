/**
 * AI Bid Assistant — 入口
 * 模块：js/utils.js · auth.js · projects.js · pdf-parser.js · ai-extract.js · ui.js
 */
import { THEME_KEY, getReminder, getReminderDays, setReminderDays } from "./js/utils.js";
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
    themeBtn: document.getElementById("themeBtn"),
    exportBtn: document.getElementById("exportBtn"),
    signOutBtn: document.getElementById("signOutBtn"),
    userEmail: document.getElementById("userEmail"),
    syncStatus: document.getElementById("syncStatus"),
    dashboardView: document.getElementById("dashboardView"),
    parserView: document.getElementById("parserView"),
    openParserBtn: document.getElementById("openParserBtn"),
    closeParserBtn: document.getElementById("closeParserBtn"),
    pdfInput: document.getElementById("pdfInput"),
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
    list: document.getElementById("list"),
    upcomingList: document.getElementById("upcomingList"),
    deadlineTip: document.getElementById("deadlineTip"),
    backToTop: document.getElementById("backToTop"),
    scrollProgress: document.getElementById("scrollProgress"),
    toastWrap: document.getElementById("toastWrap"),
    totalCount: document.getElementById("totalCount"),
    registeringCount: document.getElementById("registeringCount"),
    makingCount: document.getElementById("makingCount"),
    openedCount: document.getElementById("openedCount"),
    menuToggle: document.getElementById("menuToggle"),
    form: {
      date: document.getElementById("date"),
      type: document.getElementById("projectType"),
      name: document.getElementById("name"),
      biddingCompany: document.getElementById("biddingCompany"),
      tenderer: document.getElementById("tenderer"),
      amount: document.getElementById("amount"),
      guarantee: document.getElementById("guarantee"),
      contact: document.getElementById("contact"),
      status: document.getElementById("status"),
      notes: document.getElementById("notes"),
    },
  };

  let client = null;
  /** 最近一次 AI 分析结果，保存项目时一并写入 */
  let lastAiResult = null;

  const state = {
    projects: [],
    editingId: null,
    darkMode: localStorage.getItem(THEME_KEY) === "dark",
    user: null,
    authMode: "login",
    realtimeReady: false,
    channel: null,
  };

  const getState = () => state;
  const setState = (patch) => Object.assign(state, patch);
  const getClient = () => client;

  const ui = createUi(elements, getState);
  const projectsApi = createProjectsApi({ getClient, getState, setState, ui });
  const pdfParser = createPdfParser({ elements, ui });
  const aiExtract = createAiExtract({ ui });

  const resetForm = () => {
    Object.values(elements.form).forEach((input) => {
      if (input) input.value = "";
    });
    if (elements.form.status) elements.form.status.value = "报名中";
    state.editingId = null;
    lastAiResult = null;
    elements.submitBtn.textContent = "新增项目";
    elements.cancelBtn.classList.add("hidden");
  };

  const formData = () => {
    const base = {
      bid_date: elements.form.date.value,
      project_type: elements.form.type.value.trim(),
      name: elements.form.name.value.trim(),
      bidding_company: elements.form.biddingCompany.value.trim(),
      tenderer: elements.form.tenderer?.value.trim() || null,
      amount: elements.form.amount?.value.trim() || null,
      guarantee: elements.form.guarantee.value.trim(),
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
      ui.showToast("浏览器不支持通知权限申请。");
    }
  }

  function sendBidNotifications() {
    if (
      !("Notification" in window) ||
      Notification.permission !== "granted" ||
      !state.user
    )
      return;
    state.projects.forEach((project) => {
      const reminder = getReminder(project, getReminderDays());
      if (!reminder || ![0, 1].includes(reminder.days)) return;
      const stage = reminder.days === 0 ? "today" : "tomorrow";
      const urlHint = String(config.url || "").slice(-12);
      const notificationKey = `bid-reminder:${urlHint}:${state.user.id}:${project.id}:${project.date}:${stage}`;
      if (localStorage.getItem(notificationKey)) return;
      new Notification(`开标提醒：${project.name}`, {
        body: `开标时间：${project.date}${reminder.days === 0 ? "（今日）" : "（明日）"}`,
        tag: `bid-${project.id}-${stage}`,
      });
      localStorage.setItem(notificationKey, "true");
    });
  }

  function showApp(user) {
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
        sendBidNotifications();
        return projectsApi.migrateLocalProjects();
      }
    });
    projectsApi.subscribeToProjects(() => {
      projectsApi.loadProjects().then(() => sendBidNotifications());
    });
  }

  function showAuth() {
    state.user = null;
    state.realtimeReady = false;
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
  });

  const showParser = () => {
    elements.dashboardView.classList.add("hidden");
    elements.parserView.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const showDashboard = () => {
    elements.parserView.classList.add("hidden");
    elements.dashboardView.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      projectsApi.exportCsv(state.projects)
    );
    elements.submitBtn?.addEventListener("click", async () => {
      const ok = await projectsApi.saveProject(formData(), state.editingId);
      if (ok) resetForm();
    });
    elements.cancelBtn?.addEventListener("click", resetForm);
    [elements.search, elements.statusFilter, elements.sortBy].forEach((el) =>
      el?.addEventListener(el === elements.search ? "input" : "change", () =>
        ui.render()
      )
    );

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

    elements.aiAnalyzeBtn?.addEventListener("click", async () => {
      const text = elements.parsedText?.value;
      if (!text) {
        ui.showToast("请先完成 PDF 解析。");
        return;
      }
      elements.aiAnalyzeBtn.disabled = true;
      try {
        const result = await aiExtract.analyzeTenderText(text, (msg) =>
          pdfParser.setParseProgress(90, msg)
        );
        lastAiResult = result;
        aiExtract.applyToForm(elements, result);
        aiExtract.renderAiResultPanel(elements.aiResultPanel, result);
        pdfParser.setParseProgress(100, "AI 分析完成。");
        ui.showToast("AI 分析完成，结果已回填表单，请核对后保存。");
        showDashboard();
        ui.highlightFormPanel();
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
      ui.showToast(`设置已保存（提醒窗口：未来 ${days} 天）。`);
      elements.aiSettingsPanel?.classList.add("hidden");
    });

    elements.list?.addEventListener("click", async (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      const id = button.dataset.id;
      if (button.dataset.action === "delete") {
        const ok = await projectsApi.deleteProject(id);
        if (ok && state.editingId === id) resetForm();
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
        if (elements.form.amount) elements.form.amount.value = p.amount || "";
        elements.form.guarantee.value = p.guarantee || "";
        elements.form.contact.value = p.contact || "";
        elements.form.status.value = p.status || "报名中";
        elements.form.notes.value = p.notes || "";
        elements.submitBtn.textContent = "保存修改";
        elements.cancelBtn.classList.remove("hidden");
        ui.highlightFormPanel();
      }
    });

    elements.menuToggle?.addEventListener("click", () =>
      ui.toggleMobileMenu()
    );
    document.addEventListener("click", (e) => {
      ui.addRipple(e);
      const menu = document.getElementById("headerMenu");
      if (
        menu?.classList.contains("open") &&
        !e.target.closest("#headerMenu") &&
        !e.target.closest("#menuToggle")
      ) {
        ui.toggleMobileMenu(false);
      }
    });
    elements.backToTop?.addEventListener("click", () =>
      scrollTo({ top: 0, behavior: "smooth" })
    );
    addEventListener("scroll", () => ui.updateScrollUi(), { passive: true });
  }

  async function init() {
    ui.applyTheme(state.darkMode);
    bindEvents();
    ui.updateScrollUi();
    loadAiConfigToForm(elements);

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
