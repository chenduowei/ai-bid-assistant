(() => {
  const LEGACY_STORAGE_KEY = "bid-assistant-projects";
  const THEME_KEY = "bid-assistant-theme";
  const config = window.SUPABASE_CONFIG || {};
  const configured = config.url && config.anonKey && !config.url.includes("YOUR_") && !config.anonKey.includes("YOUR_");
  const elements = {
    authView: document.getElementById("authView"), appView: document.getElementById("appView"),
    authForm: document.getElementById("authForm"), authEmail: document.getElementById("authEmail"), authPassword: document.getElementById("authPassword"), authSubmit: document.getElementById("authSubmit"), authMessage: document.getElementById("authMessage"), authTabs: document.querySelectorAll(".auth-tab"),
    themeBtn: document.getElementById("themeBtn"), exportBtn: document.getElementById("exportBtn"), signOutBtn: document.getElementById("signOutBtn"), userEmail: document.getElementById("userEmail"), syncStatus: document.getElementById("syncStatus"),
    dashboardView: document.getElementById("dashboardView"), parserView: document.getElementById("parserView"), openParserBtn: document.getElementById("openParserBtn"), closeParserBtn: document.getElementById("closeParserBtn"), pdfInput: document.getElementById("pdfInput"), dropZone: document.getElementById("dropZone"), parserStatus: document.getElementById("parserStatus"), parseProgress: document.getElementById("parseProgress"), parseProgressText: document.getElementById("parseProgressText"), pdfFileName: document.getElementById("pdfFileName"), pdfPageCount: document.getElementById("pdfPageCount"), parsedText: document.getElementById("parsedText"), toggleTextBtn: document.getElementById("toggleTextBtn"), copyTextBtn: document.getElementById("copyTextBtn"),
    submitBtn: document.getElementById("submitBtn"), cancelBtn: document.getElementById("cancelBtn"), search: document.getElementById("search"), statusFilter: document.getElementById("statusFilter"), sortBy: document.getElementById("sortBy"), list: document.getElementById("list"), upcomingList: document.getElementById("upcomingList"), deadlineTip: document.getElementById("deadlineTip"), backToTop: document.getElementById("backToTop"), scrollProgress: document.getElementById("scrollProgress"), toastWrap: document.getElementById("toastWrap"),
    totalCount: document.getElementById("totalCount"), registeringCount: document.getElementById("registeringCount"), makingCount: document.getElementById("makingCount"), openedCount: document.getElementById("openedCount"),
    form: { date: document.getElementById("date"), type: document.getElementById("projectType"), name: document.getElementById("name"), guarantee: document.getElementById("guarantee"), contact: document.getElementById("contact"), status: document.getElementById("status"), notes: document.getElementById("notes") }
  };

  let client;
  let channel;
  let pdfjsLib;
  const state = { projects: [], editingId: null, darkMode: localStorage.getItem(THEME_KEY) === "dark", user: null, authMode: "login", realtimeReady: false };
  const escapeHtml = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const formatDateDisplay = value => { if (!value) return "未设置开标时间"; const [year, month, day] = String(value).split("-"); return year ? `${year}年${Number(month)}月${Number(day)}日` : value; };
  const formatCountdown = value => { const target = new Date(`${value}T00:00:00`); const diff = target - Date.now(); if (!value || Number.isNaN(target.getTime()) || diff <= 0) return "已开标"; const days = Math.floor(diff / 86400000), hours = Math.floor(diff % 86400000 / 3600000), mins = Math.floor(diff % 3600000 / 60000); return `${days}天${hours}小时${mins}分钟`; };
  const getStatusClass = status => status === "已开标" ? "success" : status === "制作中" ? "warning" : "";
  const getDaysUntilBid = value => { const today = new Date(); today.setHours(0, 0, 0, 0); const target = new Date(`${value}T00:00:00`); return Number.isNaN(target.getTime()) ? null : Math.round((target - today) / 86400000); };
  const getReminder = project => {
    if (project.status === "已开标") return null;
    const days = getDaysUntilBid(project.date);
    if (days === null || days < 0 || days > 7) return null;
    if (days === 0) return { days, level: "urgent", label: "紧急：今日开标（剩余 0 天）" };
    if (days === 1) return { days, level: "red", label: "重要：明日开标（剩余 1 天）" };
    if (days <= 3) return { days, level: "orange", label: `提醒：${days} 天后开标` };
    return { days, level: "yellow", label: `提醒：${days} 天后开标` };
  };
  const setSyncStatus = (message, isError = false) => { elements.syncStatus.textContent = `${isError ? "●" : "●"} ${message}`; elements.syncStatus.style.color = isError ? "var(--danger)" : "var(--success)"; };
  const showToast = message => { const toast = document.createElement("div"); toast.className = "toast"; toast.textContent = message; elements.toastWrap.appendChild(toast); setTimeout(() => { toast.classList.add("out"); setTimeout(() => toast.remove(), 250); }, 2600); };
  const saveTheme = () => localStorage.setItem(THEME_KEY, state.darkMode ? "dark" : "light");
  const applyTheme = () => { document.body.classList.toggle("dark", state.darkMode); elements.themeBtn.textContent = state.darkMode ? "☀️ 浅色模式" : "🌙 深色模式"; };
  const resetForm = () => { Object.values(elements.form).forEach(input => input.value = ""); elements.form.status.value = "报名中"; state.editingId = null; elements.submitBtn.textContent = "新增项目"; elements.cancelBtn.classList.add("hidden"); };
  const formData = () => ({ bid_date: elements.form.date.value, project_type: elements.form.type.value.trim(), name: elements.form.name.value.trim(), guarantee: elements.form.guarantee.value.trim(), contact: elements.form.contact.value.trim(), status: elements.form.status.value, notes: elements.form.notes.value.trim() || null });
  const validate = project => !project.bid_date || !project.project_type || !project.name || !project.guarantee || !project.contact ? "请完整填写：开标时间、项目类型、项目名称、保证金/保函、联系人。" : "";
  const toUiProject = row => ({ id: row.id, date: row.bid_date, type: row.project_type, name: row.name, guarantee: row.guarantee, contact: row.contact, status: row.status, notes: row.notes || "" });

  const renderStats = () => {
    elements.totalCount.textContent = state.projects.length;
    elements.registeringCount.textContent = state.projects.filter(p => p.status === "报名中").length;
    elements.makingCount.textContent = state.projects.filter(p => p.status === "制作中").length;
    elements.openedCount.textContent = state.projects.filter(p => p.status === "已开标").length;
  };
  const renderDeadlineTip = () => {
    const today = new Date(); today.setHours(0, 0, 0, 0); const limit = new Date(today); limit.setDate(limit.getDate() + 7);
    const upcoming = state.projects.filter(p => p.status !== "已开标" && p.date).filter(p => { const date = new Date(`${p.date}T00:00:00`); return date >= today && date <= limit; }).sort((a, b) => a.date.localeCompare(b.date));
    elements.deadlineTip.hidden = !upcoming.length;
    if (upcoming.length) elements.deadlineTip.textContent = `⏰ 未来 7 天有 ${upcoming.length} 个项目待开标，最近的是「${upcoming[0].name}」（${formatDateDisplay(upcoming[0].date)}）。`;
  };
  const renderUpcomingList = () => {
    const upcoming = state.projects.map(project => ({ project, reminder: getReminder(project) })).filter(item => item.reminder).sort((a, b) => a.reminder.days - b.reminder.days || a.project.date.localeCompare(b.project.date));
    if (!upcoming.length) { elements.upcomingList.innerHTML = '<div class="upcoming-empty">未来 7 天暂无待开标项目。</div>'; return; }
    elements.upcomingList.innerHTML = upcoming.map(({ project, reminder }) => `<div class="upcoming-item ${reminder.level}"><div class="upcoming-name">${escapeHtml(project.name)}</div><div class="upcoming-date">开标日期：${escapeHtml(formatDateDisplay(project.date))}</div><div class="reminder-label">${escapeHtml(reminder.label)}</div></div>`).join("");
  };
  const renderList = () => {
    const keyword = elements.search.value.trim().toLowerCase(), status = elements.statusFilter.value, sort = elements.sortBy.value;
    const projects = state.projects.filter(p => [p.type, p.name, p.contact, p.status, p.notes].filter(Boolean).join(" ").toLowerCase().includes(keyword) && (status === "all" || p.status === status));
    projects.sort((a, b) => sort === "name-asc" ? a.name.localeCompare(b.name, "zh-CN") : (sort === "date-desc" ? -1 : 1) * a.date.localeCompare(b.date));
    if (!projects.length) { elements.list.innerHTML = '<div class="empty">暂无符合条件的项目。</div>'; return; }
    elements.list.innerHTML = projects.map((p, i) => `<div class="project-item" style="animation-delay:${Math.min(i * 45, 250)}ms"><div class="project-row"><div><h3 class="project-name">${escapeHtml(p.name)}</h3><div class="project-meta"><span>项目类型：${escapeHtml(p.type)}</span><span>联系人：${escapeHtml(p.contact)}</span></div><div class="project-meta"><span>开标时间：${escapeHtml(formatDateDisplay(p.date))}</span><span>保证金/保函：${escapeHtml(p.guarantee || "-")}</span></div><div class="project-meta"><span class="badge ${getStatusClass(p.status)}">${escapeHtml(p.status)}</span><span>倒计时：${escapeHtml(p.status === "已开标" ? "已开标" : formatCountdown(p.date))}</span></div>${p.notes ? `<div class="project-meta"><span>备注：${escapeHtml(p.notes)}</span></div>` : ""}</div><div class="project-actions"><button class="btn secondary" data-action="edit" data-id="${p.id}">编辑</button><button class="btn danger" data-action="delete" data-id="${p.id}">删除</button></div></div></div>`).join("");
  };
  const render = () => { renderStats(); renderUpcomingList(); renderDeadlineTip(); renderList(); };

  async function requestNotificationPermission() {
    if (!("Notification" in window) || Notification.permission !== "default") return;
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") showToast("已开启开标提醒通知。");
    } catch { showToast("浏览器不支持通知权限申请。"); }
  }
  function sendBidNotifications() {
    if (!("Notification" in window) || Notification.permission !== "granted" || !state.user) return;
    state.projects.forEach(project => {
      const reminder = getReminder(project);
      if (!reminder || ![0, 1].includes(reminder.days)) return;
      const stage = reminder.days === 0 ? "today" : "tomorrow";
      const notificationKey = `bid-reminder-notified:${btoa(config.url)}:${state.user.id}:${project.id}:${project.date}:${stage}`;
      if (localStorage.getItem(notificationKey)) return;
      new Notification(`开标提醒：${project.name}`, { body: `开标时间：${formatDateDisplay(project.date)}${reminder.days === 0 ? "（今日）" : "（明日）"}`, tag: `bid-${project.id}-${stage}` });
      localStorage.setItem(notificationKey, "true");
    });
  }

  async function loadProjects() {
    setSyncStatus("正在同步…");
    const { data, error } = await client.from("projects").select("*").order("bid_date", { ascending: true });
    if (error) { setSyncStatus("同步失败", true); showToast(`同步失败：${error.message}`); return false; }
    state.projects = data.map(toUiProject); render(); sendBidNotifications(); setSyncStatus(state.realtimeReady ? "实时同步已连接" : "云端已同步"); return true;
  }
  async function migrateLocalProjects() {
    const migrationKey = `${LEGACY_STORAGE_KEY}:migrated:${btoa(config.url)}:${state.user.id}`;
    if (localStorage.getItem(migrationKey)) return;
    let legacy = []; try { legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "[]"); } catch { return; }
    if (!Array.isArray(legacy) || !legacy.length) { localStorage.setItem(migrationKey, "true"); return; }
    const validStatuses = new Set(["报名中", "制作中", "已开标"]);
    const invalid = [];
    const payload = legacy.flatMap((p, index) => {
      const project = { user_id: state.user.id, bid_date: String(p.date || ""), project_type: String(p.type || "").trim(), name: String(p.name || "").trim(), guarantee: String(p.guarantee ?? "").trim(), contact: String(p.contact || "").trim(), status: validStatuses.has(p.status) ? p.status : "报名中", notes: String(p.notes || "").trim() || null };
      if (!project.bid_date || !project.project_type || !project.name || !project.guarantee || !project.contact) { invalid.push(index + 1); return []; }
      return [project];
    });
    if (!payload.length) { showToast("未迁移：本地项目缺少必填字段。"); return; }
    const { error } = await client.from("projects").insert(payload);
    if (error) { showToast(`本地数据迁移失败：${error.message}`); return; }
    localStorage.setItem(migrationKey, "true"); showToast(`已迁移 ${payload.length} 条本地项目到云端。${invalid.length ? `另有 ${invalid.length} 条数据缺少必填字段，未迁移。` : ""}`); await loadProjects();
  }
  function subscribeToProjects() {
    if (channel) client.removeChannel(channel);
    state.realtimeReady = false;
    channel = client.channel(`projects-${state.user.id}`).on("postgres_changes", { event: "*", schema: "public", table: "projects", filter: `user_id=eq.${state.user.id}` }, () => loadProjects()).subscribe((status, error) => {
      if (status === "SUBSCRIBED") { state.realtimeReady = true; setSyncStatus("实时同步已连接"); return; }
      if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) { state.realtimeReady = false; setSyncStatus(`实时同步不可用${error?.message ? `：${error.message}` : ""}`, true); }
    });
  }
  async function saveProject() {
    const project = formData(), errorText = validate(project); if (errorText) { showToast(errorText); return; }
    setSyncStatus("正在保存…");
    const wasEditing = Boolean(state.editingId);
    const query = wasEditing ? client.from("projects").update(project).eq("id", state.editingId) : client.from("projects").insert({ ...project, user_id: state.user.id });
    const { error } = await query;
    if (error) { setSyncStatus("保存失败", true); showToast(`保存失败：${error.message}`); return; }
    resetForm(); await loadProjects(); showToast(wasEditing ? "项目已更新。" : "项目已添加到云端。");
  }
  async function deleteProject(id) {
    const project = state.projects.find(p => p.id === id); if (!project || !confirm(`确认删除「${project.name}」吗？`)) return;
    const { error } = await client.from("projects").delete().eq("id", id);
    if (error) { showToast(`删除失败：${error.message}`); return; }
    if (state.editingId === id) resetForm(); await loadProjects(); showToast("项目已删除。");
  }
  const exportCsv = () => { const headers = ["项目名称", "项目类型", "联系人", "开标时间", "保证金/保函", "项目状态", "备注"]; const rows = state.projects.map(p => [p.name, p.type, p.contact, p.date, p.guarantee, p.status, p.notes || ""]); const csv = "\ufeff" + [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = "项目列表.csv"; a.style.display = "none"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); showToast("项目列表已导出为 CSV 文件。"); };
  const showParser = () => { elements.dashboardView.classList.add("hidden"); elements.parserView.classList.remove("hidden"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const showDashboard = () => { elements.parserView.classList.add("hidden"); elements.dashboardView.classList.remove("hidden"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const setParseProgress = (percent, text) => { elements.parserStatus.classList.remove("hidden"); elements.parseProgress.style.width = `${Math.max(0, Math.min(100, percent))}%`; elements.parseProgressText.textContent = text; };
  async function getPdfJs() {
    if (pdfjsLib) return pdfjsLib;
    pdfjsLib = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
    return pdfjsLib;
  }
  async function parsePdf(file) {
    const maxSize = 50 * 1024 * 1024;
    if (!file) return;
    if (file.size > maxSize) { showToast("PDF 文件不能超过 50 MB。"); return; }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) { showToast("请选择 PDF 文件。"); return; }
    elements.pdfFileName.textContent = `文件：${file.name}`;
    elements.pdfPageCount.textContent = "总页数：读取中";
    elements.parsedText.value = "";
    elements.parsedText.classList.add("hidden");
    elements.toggleTextBtn.disabled = true;
    elements.copyTextBtn.disabled = true;
    setParseProgress(0, "正在加载 PDF…");
    try {
      const pdfjs = await getPdfJs();
      const data = new Uint8Array(await file.arrayBuffer());
      const loadingTask = pdfjs.getDocument({ data });
      loadingTask.onProgress = progress => { if (progress.total) setParseProgress(progress.loaded / progress.total * 15, "正在读取 PDF 文件…"); };
      const pdf = await loadingTask.promise;
      elements.pdfPageCount.textContent = `总页数：${pdf.numPages}`;
      const pages = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(" ").replace(/\s+/g, " ").trim();
        pages.push(`【第 ${pageNumber} 页】\n${pageText}`);
        page.cleanup();
        setParseProgress(15 + pageNumber / pdf.numPages * 85, `正在解析第 ${pageNumber} / ${pdf.numPages} 页…`);
      }
      elements.parsedText.value = pages.join("\n\n");
      elements.toggleTextBtn.disabled = false;
      elements.copyTextBtn.disabled = !elements.parsedText.value;
      setParseProgress(100, `解析完成，共 ${pdf.numPages} 页。`);
      showToast("PDF 文本解析完成。");
      pdf.destroy();
    } catch (error) {
      setParseProgress(0, "解析失败");
      showToast(`PDF 解析失败：${error?.message || "请确认文件未损坏或受密码保护。"}`);
    }
  }
  async function copyParsedText() {
    const text = elements.parsedText.value;
    if (!text) return;
    try { await navigator.clipboard.writeText(text); }
    catch { elements.parsedText.classList.remove("hidden"); elements.parsedText.select(); document.execCommand("copy"); }
    showToast("全文已复制到剪贴板。");
  }
  const updateScrollUi = () => { const max = document.documentElement.scrollHeight - innerHeight, percent = max > 0 ? scrollY / max * 100 : 0; elements.scrollProgress.style.width = `${percent}%`; elements.backToTop.classList.toggle("visible", scrollY > 360); };
  const addRipple = event => { const button = event.target.closest(".btn"); if (!button) return; const ripple = document.createElement("span"), size = Math.max(button.clientWidth, button.clientHeight), rect = button.getBoundingClientRect(); ripple.className = "ripple"; ripple.style.cssText = `width:${size}px;height:${size}px;left:${event.clientX - rect.left - size / 2}px;top:${event.clientY - rect.top - size / 2}px`; button.appendChild(ripple); ripple.addEventListener("animationend", () => ripple.remove()); };
  function showApp(user) { if (state.user?.id === user.id && !elements.appView.classList.contains("hidden")) return; state.user = user; elements.userEmail.textContent = user.email || ""; elements.authView.classList.add("hidden"); elements.appView.classList.remove("hidden"); requestNotificationPermission(); loadProjects().then(loaded => { if (loaded) return migrateLocalProjects(); }); subscribeToProjects(); }
  function showAuth() { state.user = null; state.realtimeReady = false; elements.appView.classList.add("hidden"); elements.authView.classList.remove("hidden"); if (channel) client.removeChannel(channel); channel = null; }
  async function handleAuth(event) { event.preventDefault(); const email = elements.authEmail.value.trim(), password = elements.authPassword.value; elements.authMessage.textContent = ""; elements.authMessage.style.color = "var(--danger)"; elements.authSubmit.disabled = true; const { data, error } = state.authMode === "signup" ? await client.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } }) : await client.auth.signInWithPassword({ email, password }); elements.authSubmit.disabled = false; if (error) { elements.authMessage.textContent = error.message; return; } if (state.authMode === "signup" && !data.session) { elements.authMessage.style.color = "var(--success)"; elements.authMessage.textContent = "注册成功，请前往邮箱确认后再登录。"; return; } }
  function bindEvents() {
    elements.authTabs.forEach(tab => tab.addEventListener("click", () => { state.authMode = tab.dataset.mode; elements.authTabs.forEach(item => item.classList.toggle("active", item === tab)); elements.authSubmit.textContent = state.authMode === "signup" ? "注册账号" : "登录"; elements.authPassword.autocomplete = state.authMode === "signup" ? "new-password" : "current-password"; elements.authMessage.textContent = ""; elements.authMessage.style.color = "var(--danger)"; }));
    elements.authForm.addEventListener("submit", handleAuth); elements.signOutBtn.addEventListener("click", () => client.auth.signOut());
    elements.themeBtn.addEventListener("click", () => { state.darkMode = !state.darkMode; saveTheme(); applyTheme(); }); elements.exportBtn.addEventListener("click", exportCsv); elements.submitBtn.addEventListener("click", saveProject); elements.cancelBtn.addEventListener("click", resetForm); [elements.search, elements.statusFilter, elements.sortBy].forEach(el => el.addEventListener(el === elements.search ? "input" : "change", render));
    elements.openParserBtn.addEventListener("click", showParser); elements.closeParserBtn.addEventListener("click", showDashboard);
    elements.dropZone.addEventListener("click", () => elements.pdfInput.click()); elements.dropZone.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); elements.pdfInput.click(); } });
    elements.pdfInput.addEventListener("change", event => parsePdf(event.target.files?.[0]));
    ["dragenter", "dragover"].forEach(eventName => elements.dropZone.addEventListener(eventName, event => { event.preventDefault(); elements.dropZone.classList.add("dragover"); }));
    ["dragleave", "drop"].forEach(eventName => elements.dropZone.addEventListener(eventName, event => { event.preventDefault(); elements.dropZone.classList.remove("dragover"); }));
    elements.dropZone.addEventListener("drop", event => parsePdf(event.dataTransfer.files?.[0]));
    elements.toggleTextBtn.addEventListener("click", () => { const hidden = elements.parsedText.classList.toggle("hidden"); elements.toggleTextBtn.textContent = hidden ? "查看原始文本" : "隐藏原始文本"; });
    elements.copyTextBtn.addEventListener("click", copyParsedText);
    elements.list.addEventListener("click", event => { const button = event.target.closest("button"); if (!button) return; const id = button.dataset.id; if (button.dataset.action === "delete") deleteProject(id); if (button.dataset.action === "edit") { const p = state.projects.find(project => project.id === id); if (!p) return; state.editingId = id; elements.form.date.value = p.date; elements.form.type.value = p.type; elements.form.name.value = p.name; elements.form.guarantee.value = p.guarantee; elements.form.contact.value = p.contact; elements.form.status.value = p.status; elements.form.notes.value = p.notes; elements.submitBtn.textContent = "保存修改"; elements.cancelBtn.classList.remove("hidden"); document.querySelector(".panel").scrollIntoView({ behavior: "smooth", block: "start" }); } });
    document.addEventListener("click", addRipple); elements.backToTop.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" })); addEventListener("scroll", updateScrollUi, { passive: true });
  }
  async function init() {
    applyTheme(); bindEvents(); updateScrollUi();
    if (!configured || !window.supabase) { elements.authMessage.textContent = "请先在 supabase-config.js 填入 Supabase URL 和 anon/publishable key。"; return; }
    client = window.supabase.createClient(config.url, config.anonKey);
    client.auth.onAuthStateChange((_event, session) => session?.user ? showApp(session.user) : showAuth());
    const { data: { session } } = await client.auth.getSession(); if (session?.user) showApp(session.user); else showAuth();
    setInterval(() => { if (state.user) { render(); sendBidNotifications(); } }, 60000);
  }
  init();
})();
