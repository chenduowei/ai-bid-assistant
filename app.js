/**
 * AI Bid Assistant — 入口
 * 模块：js/utils.js · auth.js · projects.js · pdf-parser.js · ai-extract.js · ui.js
 */
import { THEME_KEY, getReminderDays, setReminderDays, getMissedBidProjects, getDeadlineItems, buildChecklistFromAi, escapeHtml } from "./js/utils.js";
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
    list: document.getElementById("list"),
    trashList: document.getElementById("trashList"),
    toggleTrashBtn: document.getElementById("toggleTrashBtn"),
    upcomingList: document.getElementById("upcomingList"),
    deadlineTip: document.getElementById("deadlineTip"),
    backToTop: document.getElementById("backToTop"),
    scrollProgress: document.getElementById("scrollProgress"),
    toastWrap: document.getElementById("toastWrap"),
    totalCount: document.getElementById("totalCount"),
    registeringCount: document.getElementById("registeringCount"),
    makingCount: document.getElementById("makingCount"),
    openedCount: document.getElementById("openedCount"),
    inTransitGuarantee: document.getElementById("inTransitGuarantee"),
    menuToggle: document.getElementById("menuToggle"),
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
    if (elements.form.amountUnit) elements.form.amountUnit.value = "万元";
    if (elements.form.guaranteeUnit)
      elements.form.guaranteeUnit.value = "万元";
    if (elements.form.guaranteeStatus)
      elements.form.guaranteeStatus.value = "未缴纳";
    state.editingId = null;
    lastAiResult = null;
    elements.submitBtn.textContent = "新增项目";
    elements.cancelBtn.classList.add("hidden");
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
      guarantee: elements.form.guarantee.value.trim(),
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
      ui.showToast("浏览器不支持通知权限申请。");
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
    ui.showToast(`提醒：${names}${more}已过开标时间但状态仍不是“已开标”，请核对（关闭页面时浏览器不会提醒）。`);
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
        refreshPdfProjectOptions();
        showMissedReminders();
        sendBidNotifications();
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
    refreshPdfProjectOptions();
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
      // 导出当前筛选结果，与列表看到的一致，而非全量。
      projectsApi.exportCsv(ui.getCurrentFilteredProjects?.() ?? state.projects)
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

    // 解析页：把当前解析文本保存到所选项目（pdf_text / pdf_filename / pdf_parsed_at）
    elements.savePdfTextBtn?.addEventListener("click", async () => {
      const projectId = elements.pdfProjectSelect?.value || "";
      if (!projectId) {
        ui.showToast("请先选择要保存到的项目。");
        return;
      }
      const text = elements.parsedText?.value || "";
      if (!text.trim()) {
        ui.showToast("没有可保存的解析文本，请先解析 PDF。");
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
      if (button.dataset.action === "view-pdf") {
        const p = state.projects.find((project) => project.id === id);
        if (!p?.pdfText) {
          ui.showToast("该项目暂无已保存的招标文件文本。");
          return;
        }
        elements.parsedText.value = p.pdfText;
        elements.parsedText.classList.remove("hidden");
        elements.pdfFileName.textContent = `已保存文件：${p.pdfFilename || "未命名"}`;
        elements.toggleTextBtn.disabled = false;
        elements.toggleTextBtn.textContent = "隐藏原始文本";
        elements.copyTextBtn.disabled = false;
        elements.aiAnalyzeBtn.disabled = false;
        showParser();
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
          ui.showToast("清单已是最新，无新增项。");
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
          ui.showToast("请输入清单内容。");
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
        elements.submitBtn.textContent = "保存修改";
        elements.cancelBtn.classList.remove("hidden");
        ui.highlightFormPanel();
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

    elements.toggleTrashBtn?.addEventListener("click", async () => {
      trashVisible = !trashVisible;
      elements.trashList?.classList.toggle("hidden", !trashVisible);
      elements.toggleTrashBtn.textContent = trashVisible ? "收起回收站" : "查看回收站";
      elements.toggleTrashBtn.setAttribute("aria-expanded", trashVisible ? "true" : "false");
      if (trashVisible) await refreshTrashList();
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
