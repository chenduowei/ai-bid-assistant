/** UI 渲染与交互辅助 */

import {
  escapeHtml,
  formatDateDisplay,
  formatCountdown,
  getStatusClass,
  getReminderDays,
  formatMoney,
  getGuaranteeTotals,
  getNextDeadline,
  getUpcomingDeadlines,
  getChecklistProgress,
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
    if (elements.inTransitGuarantee) {
      const { inTransit } = getGuaranteeTotals(projects);
      elements.inTransitGuarantee.textContent = inTransit.toLocaleString(
        "en-US",
        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      );
    }
  };

  const renderDeadlineTip = (projects) => {
    const reminderDays = getReminderDays();
    const upcoming = getUpcomingDeadlines(projects, reminderDays);
    elements.deadlineTip.hidden = !upcoming.length;
    if (upcoming.length) {
      const first = upcoming[0];
      const left =
        first.days === 0 ? "今天" : `还有 ${first.days} 天`;
      elements.deadlineTip.textContent = `⏰ 未来 ${reminderDays} 天有 ${upcoming.length} 个截止事项，最近的是「${first.project.name}」· ${first.label}（${formatDateDisplay(first.date)}，${left}）。`;
    }
  };

  const upcomingLevel = (days) =>
    days === 0 ? "urgent" : days === 1 ? "red" : days <= 3 ? "orange" : "yellow";

  const renderUpcomingList = (projects) => {
    const reminderDays = getReminderDays();
    const upcoming = getUpcomingDeadlines(projects, reminderDays);
    const desc = document.getElementById("upcomingDesc");
    if (desc) {
      desc.textContent = `按截止时间升序显示未来 ${reminderDays} 天内的截止事项（报名 / 质疑 / 澄清 / 保证金 / 开标；浏览器通知仅在页面打开时触发，关页后需下次打开补看）。`;
    }
    if (!upcoming.length) {
      elements.upcomingList.innerHTML = `<div class="upcoming-empty">未来 ${reminderDays} 天暂无截止事项。</div>`;
      return;
    }
    elements.upcomingList.innerHTML = upcoming
      .map(({ project, label, date, days }) => {
        const level = upcomingLevel(days);
        const labelText =
          days === 0
            ? `${label}：今日`
            : days === 1
              ? `${label}：明日`
              : `${label}：${days} 天后`;
        return `<div class="upcoming-item ${level}" data-id="${escapeHtml(project.id)}" role="button" tabindex="0" title="点击定位到项目列表"><div class="upcoming-name">${escapeHtml(project.name)}</div><div class="upcoming-date">${escapeHtml(label)}：${escapeHtml(formatDateDisplay(date))}</div><div class="reminder-label">${escapeHtml(labelText)}</div></div>`;
      })
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
    const checklistText = Array.isArray(p.checklist)
      ? p.checklist.map((item) => item?.text || "").join(" ")
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
      checklistText,
      p.pdfFilename || "",
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

  const checklistSourceLabel = (source) =>
    source === "ai-invalid"
      ? "废标条款"
      : source === "ai-risk"
        ? "AI风险"
        : "手动";

  /** 废标检查清单：进度 + 勾选 + 生成 + 手动新增 + 删除，文本全部 escapeHtml */
  const renderChecklist = (p) => {
    const list = Array.isArray(p.checklist) ? p.checklist : [];
    const { done, total } = getChecklistProgress(list);
    const itemsHtml = list.length
      ? list
          .map(
            (item) =>
              `<div class="checklist-item"><input type="checkbox" data-action="checklist-toggle" data-id="${escapeHtml(p.id)}" data-item-id="${escapeHtml(item.id)}" ${item.done ? "checked" : ""} /><span class="checklist-text ${item.done ? "done" : ""}">${escapeHtml(item.text)}</span><span class="checklist-source">${escapeHtml(checklistSourceLabel(item.source))}</span><button class="btn secondary checklist-del" type="button" data-action="checklist-delete" data-id="${escapeHtml(p.id)}" data-item-id="${escapeHtml(item.id)}" title="删除该项">×</button></div>`
          )
          .join("")
      : `<div class="checklist-empty">暂无检查项，可从 AI 结果生成或手动添加。</div>`;
    return `<div class="checklist"><div class="checklist-progress">📋 废标检查清单：已完成 ${done}/${total}</div><div class="checklist-items">${itemsHtml}</div><div class="checklist-add"><input class="checklist-new-input" type="text" maxlength="500" placeholder="手动添加检查项" /><button class="btn secondary" type="button" data-action="checklist-add" data-id="${escapeHtml(p.id)}">添加</button><button class="btn secondary" type="button" data-action="checklist-generate" data-id="${escapeHtml(p.id)}">从 AI 结果生成清单</button></div></div>`;
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
      .map((p, i) => {
        // 金额：新字段优先，旧文本兜底
        const amountDisplay =
          p.amountValue !== null && p.amountValue !== undefined
            ? formatMoney(p.amountValue, p.amountUnit)
            : p.amount || "-";
        // 保证金：新字段优先（金额 + 状态），旧文本兜底
        const guaranteeDisplay =
          p.guaranteeAmount !== null && p.guaranteeAmount !== undefined
            ? `${formatMoney(p.guaranteeAmount, p.guaranteeUnit)}（${escapeHtml(p.guaranteeStatus || "未缴纳")}）`
            : escapeHtml(p.guarantee || "-");
        const guaranteeExtra =
          p.guaranteeAmount !== null &&
          p.guaranteeAmount !== undefined &&
          p.guarantee
            ? `<span>保证金要求：${escapeHtml(p.guarantee)}</span>`
            : "";
        const next = getNextDeadline(p);
        const deadlineHtml = next
          ? `<div class="deadline-line">最近截止：${escapeHtml(next.label)} · ${escapeHtml(formatDateDisplay(next.date))}${next.days === 0 ? "（今天）" : `（还有 ${next.days} 天）`}</div>`
          : "";
        const pdfHtml = p.pdfText
          ? `<div class="pdf-saved">已保存招标文件：${escapeHtml(p.pdfFilename || "未命名")}（${p.pdfText.length} 字${p.pdfParsedAt ? ` · ${escapeHtml(formatDateDisplay(String(p.pdfParsedAt).slice(0, 10)))}` : ""}） <button class="btn secondary pdf-view-btn" type="button" data-action="view-pdf" data-id="${escapeHtml(p.id)}">查看已保存文本</button></div>`
          : "";
        return `<div class="project-item" data-id="${escapeHtml(p.id)}" style="animation-delay:${Math.min(i * 45, 250)}ms"><div class="project-row"><div><h3 class="project-name">${escapeHtml(p.name)}</h3><div class="project-meta"><span>项目类型：${escapeHtml(p.type)}</span><span>投标公司：${escapeHtml(p.biddingCompany || "-")}</span><span>招标单位：${escapeHtml(p.tenderer || "-")}</span><span>联系人：${escapeHtml(p.contact)}</span></div><div class="project-meta"><span>开标时间：${escapeHtml(formatDateDisplay(p.date))}</span><span>保证金：${guaranteeDisplay}</span><span>项目金额：${escapeHtml(amountDisplay)}</span>${guaranteeExtra}</div><div class="project-meta"><span class="badge ${getStatusClass(p.status)}">${escapeHtml(p.status)}</span><span class="countdown" data-date="${escapeHtml(p.date)}" data-status="${escapeHtml(p.status)}">倒计时：${escapeHtml(p.status === "已开标" ? "已开标" : formatCountdown(p.date))}</span></div>${p.notes ? `<div class="project-meta"><span>备注：${escapeHtml(p.notes)}</span></div>` : ""}${deadlineHtml}${renderRiskCard(p)}${renderChecklist(p)}${pdfHtml}</div><div class="project-actions"><button class="btn secondary" data-action="edit" data-id="${escapeHtml(p.id)}">编辑</button><button class="btn danger" data-action="delete" data-id="${escapeHtml(p.id)}">删除</button></div></div></div>`;
      })
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

  const renderTrashList = (deletedProjects) => {
    if (!elements.trashList) return;
    if (!deletedProjects?.length) {
      elements.trashList.innerHTML = '<div class="empty">回收站为空。</div>';
      return;
    }
    elements.trashList.innerHTML = deletedProjects
      .map(
        (p) => {
          const deletedDate = p.deletedAt
            ? formatDateDisplay(String(p.deletedAt).slice(0, 10))
            : "未知";
          return `<div class="project-item"><div class="project-row"><div><h3 class="project-name">${escapeHtml(p.name)}</h3><div class="project-meta"><span>开标时间：${escapeHtml(formatDateDisplay(p.date))}</span><span>投标公司：${escapeHtml(p.biddingCompany || "-")}</span><span>删除时间：${escapeHtml(deletedDate)}</span></div></div><div class="project-actions"><button class="btn secondary" data-action="restore" data-id="${escapeHtml(p.id)}">恢复</button><button class="btn danger" data-action="permanent-delete" data-id="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name)}">彻底删除</button></div></div></div>`;
        }
      )
      .join("");
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
    renderTrashList,
    getCurrentFilteredProjects,
    updateCountdowns,
    highlightFormPanel,
    focusProjectInList,
    updateScrollUi,
    addRipple,
    toggleMobileMenu,
  };
}
