/** UI 渲染与交互辅助 */

import {
  escapeHtml,
  formatDateDisplay,
  formatCountdown,
  getStatusClass,
  getReminder,
  getReminderDays,
} from "./utils.js";

export function createUi(elements, getState) {
  const showToast = (message) => {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    elements.toastWrap.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("out");
      setTimeout(() => toast.remove(), 250);
    }, 2600);
  };

  const setSyncStatus = (message, isError = false) => {
    if (!elements.syncStatus) return;
    elements.syncStatus.textContent = `● ${message}`;
    elements.syncStatus.style.color = isError
      ? "var(--danger)"
      : "var(--success)";
  };

  const applyTheme = (darkMode) => {
    document.body.classList.toggle("dark", darkMode);
    if (elements.themeBtn) {
      elements.themeBtn.textContent = darkMode ? "☀️ 浅色" : "🌙 深色";
    }
  };

  const renderStats = (projects) => {
    elements.totalCount.textContent = projects.length;
    elements.registeringCount.textContent = projects.filter(
      (p) => p.status === "报名中"
    ).length;
    elements.makingCount.textContent = projects.filter(
      (p) => p.status === "制作中"
    ).length;
    elements.openedCount.textContent = projects.filter(
      (p) => p.status === "已开标"
    ).length;
  };

  const renderDeadlineTip = (projects) => {
    const reminderDays = getReminderDays();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limit = new Date(today);
    limit.setDate(limit.getDate() + reminderDays);
    const upcoming = projects
      .filter((p) => p.status !== "已开标" && p.date)
      .filter((p) => {
        const date = new Date(`${p.date}T00:00:00`);
        return date >= today && date <= limit;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    elements.deadlineTip.hidden = !upcoming.length;
    if (upcoming.length) {
      elements.deadlineTip.textContent = `⏰ 未来 ${reminderDays} 天有 ${upcoming.length} 个项目待开标，最近的是「${upcoming[0].name}」（${formatDateDisplay(upcoming[0].date)}）。`;
    }
  };

  const renderUpcomingList = (projects) => {
    const reminderDays = getReminderDays();
    const upcoming = projects
      .map((project) => ({
        project,
        reminder: getReminder(project, reminderDays),
      }))
      .filter((item) => item.reminder)
      .sort(
        (a, b) =>
          a.reminder.days - b.reminder.days ||
          a.project.date.localeCompare(b.project.date)
      );
    const desc = document.getElementById("upcomingDesc");
    if (desc) {
      desc.textContent = `按开标时间升序显示未来 ${reminderDays} 天内的项目。`;
    }
    if (!upcoming.length) {
      elements.upcomingList.innerHTML = `<div class="upcoming-empty">未来 ${reminderDays} 天暂无待开标项目。</div>`;
      return;
    }
    elements.upcomingList.innerHTML = upcoming
      .map(
        ({ project, reminder }) =>
          `<div class="upcoming-item ${reminder.level}" data-id="${escapeHtml(project.id)}" role="button" tabindex="0" title="点击定位到项目列表"><div class="upcoming-name">${escapeHtml(project.name)}</div><div class="upcoming-date">开标日期：${escapeHtml(formatDateDisplay(project.date))}</div><div class="reminder-label">${escapeHtml(reminder.label)}</div></div>`
      )
      .join("");
  };

  const renderStructList = (title, items) => {
    if (!Array.isArray(items) || !items.length) return "";
    const lis = items
      .map((item) => `<li>${escapeHtml(typeof item === "string" ? item : item.text || "")}</li>`)
      .join("");
    return `<div class="struct-block"><div class="struct-title">${escapeHtml(title)}</div><ul class="struct-list">${lis}</ul></div>`;
  };

  // 风险等级只允许白名单值，防模型/脏数据注入 class / HTML。
  const sanitizeLevel = (level) =>
    ["high", "medium", "low"].includes(level) ? level : "medium";

  const renderRiskCard = (p) => {
    const hasRisk =
      p.riskSummary || (p.riskPoints && p.riskPoints.length);
    const hasStruct =
      (p.qualification && p.qualification.length) ||
      (p.invalidBidClauses && p.invalidBidClauses.length);
    if (!hasRisk && !hasStruct) return "";
    const points = Array.isArray(p.riskPoints) ? p.riskPoints : [];
    const pointsHtml = points.length
      ? `<ul class="risk-points">${points
          .map(
            (pt) =>
              `<li><span class="risk-level ${sanitizeLevel(pt.level)}">${escapeHtml(pt.level || "注意")}</span>${escapeHtml(pt.text || pt)}</li>`
          )
          .join("")}</ul>`
      : "";
    return `<div class="risk-report"><div class="risk-title">⚠️ 风险与条款</div>${
      p.riskSummary
        ? `<p class="risk-summary">${escapeHtml(p.riskSummary)}</p>`
        : ""
    }${renderStructList("资格要求", p.qualification)}${renderStructList("废标条款", p.invalidBidClauses)}${pointsHtml}</div>`;
  };

  const matchesKeyword = (p, keyword) => {
    if (!keyword) return true;
    const qualText = Array.isArray(p.qualification)
      ? p.qualification.join(" ")
      : "";
    const invalidText = Array.isArray(p.invalidBidClauses)
      ? p.invalidBidClauses.join(" ")
      : "";
    const haystack = [
      p.date,
      formatDateDisplay(p.date),
      p.biddingCompany,
      p.tenderer,
      p.type,
      p.contact,
      p.guarantee,
      p.amount,
      p.name,
      p.notes,
      p.status,
      qualText,
      invalidText,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(keyword);
  };

  const getFilteredProjects = (projects, filters) => {
    const keyword = (filters.keyword || "").trim().toLowerCase();
    const status = filters.status || "all";
    const sort = filters.sort || "date-asc";
    const filtered = projects.filter(
      (p) => matchesKeyword(p, keyword) && (status === "all" || p.status === status)
    );
    filtered.sort((a, b) =>
      sort === "name-asc"
        ? a.name.localeCompare(b.name, "zh-CN")
        : (sort === "date-desc" ? -1 : 1) * a.date.localeCompare(b.date)
    );
    return filtered;
  };

  const updateFilterCount = (filteredCount, totalCount, hasActiveFilter) => {
    const el = elements.filterResultCount;
    if (!el) return;
    if (!hasActiveFilter) {
      el.textContent = `共 ${totalCount} 个项目`;
      return;
    }
    el.textContent = `筛选结果：${filteredCount} 个（共 ${totalCount} 个）`;
  };

  const renderList = (projects, filters) => {
    const keyword = (filters.keyword || "").trim();
    const status = filters.status || "all";
    const hasActiveFilter = Boolean(keyword) || status !== "all";
    const filtered = getFilteredProjects(projects, filters);
    updateFilterCount(filtered.length, projects.length, hasActiveFilter);

    if (!filtered.length) {
      elements.list.innerHTML =
        '<div class="empty">暂无符合条件的项目。</div>';
      return;
    }
    elements.list.innerHTML = filtered
      .map(
        (p, i) =>
          `<div class="project-item" data-id="${escapeHtml(p.id)}" style="animation-delay:${Math.min(i * 45, 250)}ms"><div class="project-row"><div><h3 class="project-name">${escapeHtml(p.name)}</h3><div class="project-meta"><span>项目类型：${escapeHtml(p.type)}</span><span>投标公司：${escapeHtml(p.biddingCompany || "-")}</span><span>招标单位：${escapeHtml(p.tenderer || "-")}</span><span>联系人：${escapeHtml(p.contact)}</span></div><div class="project-meta"><span>开标时间：${escapeHtml(formatDateDisplay(p.date))}</span><span>保证金/保函：${escapeHtml(p.guarantee || "-")}</span><span>项目金额：${escapeHtml(p.amount || "-")}</span></div><div class="project-meta"><span class="badge ${getStatusClass(p.status)}">${escapeHtml(p.status)}</span><span class="countdown" data-date="${escapeHtml(p.date)}" data-status="${escapeHtml(p.status)}">倒计时：${escapeHtml(p.status === "已开标" ? "已开标" : formatCountdown(p.date))}</span></div>${p.notes ? `<div class="project-meta"><span>备注：${escapeHtml(p.notes)}</span></div>` : ""}${renderRiskCard(p)}</div><div class="project-actions"><button class="btn secondary" data-action="edit" data-id="${escapeHtml(p.id)}">编辑</button><button class="btn danger" data-action="delete" data-id="${escapeHtml(p.id)}">删除</button></div></div></div>`
      )
      .join("");
  };

  /** 定位到项目列表中的某一项并高亮 */
  const focusProjectInList = (projectId) => {
    if (!projectId) return;
    // 清空搜索与状态筛选，确保目标项目可见
    if (elements.search) elements.search.value = "";
    if (elements.statusFilter) elements.statusFilter.value = "all";
    render();
    const item = elements.list?.querySelector(
      `.project-item[data-id="${CSS.escape(String(projectId))}"]`
    );
    if (!item) {
      showToast("未在列表中找到该项目。");
      return;
    }
    item.scrollIntoView({ behavior: "smooth", block: "center" });
    item.classList.add("project-highlight");
    setTimeout(() => item.classList.remove("project-highlight"), 2200);
  };

  /** 仅更新倒计时文字，避免每分钟全量 render */
  const updateCountdowns = () => {
    elements.list
      ?.querySelectorAll(".countdown[data-date]")
      .forEach((el) => {
        const status = el.dataset.status;
        const date = el.dataset.date;
        el.textContent = `倒计时：${
          status === "已开标" ? "已开标" : formatCountdown(date)
        }`;
      });
  };

  const getCurrentFilters = () => ({
    keyword: elements.search?.value || "",
    status: elements.statusFilter?.value || "all",
    sort: elements.sortBy?.value || "date-asc",
  });

  // 导出用：返回当前搜索/筛选/排序后的项目，而非全量。
  const getCurrentFilteredProjects = () =>
    getFilteredProjects(getState().projects, getCurrentFilters());

  const render = () => {
    const state = getState();
    const filters = getCurrentFilters();
    renderStats(state.projects);
    renderUpcomingList(state.projects);
    renderDeadlineTip(state.projects);
    renderList(state.projects, filters);
  };

  const highlightFormPanel = () => {
    const panel = document.querySelector(".panel.form-panel");
    if (!panel) return;
    panel.classList.add("form-highlight");
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => panel.classList.remove("form-highlight"), 1600);
  };

  const updateScrollUi = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const percent = max > 0 ? (scrollY / max) * 100 : 0;
    if (elements.scrollProgress) {
      elements.scrollProgress.style.width = `${percent}%`;
    }
    elements.backToTop?.classList.toggle("visible", scrollY > 360);
  };

  const addRipple = (event) => {
    const button = event.target.closest(".btn");
    if (!button) return;
    const ripple = document.createElement("span");
    const size = Math.max(button.clientWidth, button.clientHeight);
    const rect = button.getBoundingClientRect();
    ripple.className = "ripple";
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${event.clientX - rect.left - size / 2}px;top:${event.clientY - rect.top - size / 2}px`;
    button.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  };

  const toggleMobileMenu = (force) => {
    const menu = document.getElementById("headerMenu");
    const btn = document.getElementById("menuToggle");
    if (!menu) return;
    const open = force ?? !menu.classList.contains("open");
    menu.classList.toggle("open", open);
    btn?.setAttribute("aria-expanded", open ? "true" : "false");
  };

  return {
    showToast,
    setSyncStatus,
    applyTheme,
    render,
    getCurrentFilteredProjects,
    updateCountdowns,
    highlightFormPanel,
    focusProjectInList,
    updateScrollUi,
    addRipple,
    toggleMobileMenu,
  };
}
