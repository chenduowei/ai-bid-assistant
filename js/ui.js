/** UI 渲染与交互辅助 */

import {
  escapeHtml,
  formatDateDisplay,
  getDaysUntilBid,
  getStatusClass,
  getReminderDays,
  formatMoney,
  getGuaranteeTotals,
  getNextDeadline,
  getUpcomingDeadlines,
  getChecklistProgress,
  getGuaranteeRefundReminders,
  paginateItems,
  expandLimitForIndex,
  getEvidenceState,
} from "./utils.js";

export function createUi(elements, getState) {
  // v0.7.0：统计 count-up 上次值（及进行中的 rAF id）
  const prevStats = {};
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
    // v0.7.0：统计值变化时 0.4s ease-out count-up（减动效时直接赋值）
    const formatStat = (val, decimals) =>
      decimals
        ? val.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : String(Math.round(val));
    const tweenStat = (el, key, target, decimals) => {
      if (!el) return;
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      const from = prevStats[key] ?? 0;
      if (reduce || from === target) {
        el.textContent = formatStat(target, decimals);
        prevStats[key] = target;
        return;
      }
      cancelAnimationFrame(prevStats[key + "_raf"]);
      const start = performance.now();
      const dur = 400;
      const step = (now) => {
        const t = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = formatStat(from + (target - from) * eased, decimals);
        if (t < 1) {
          prevStats[key + "_raf"] = requestAnimationFrame(step);
        } else {
          prevStats[key] = target;
        }
      };
      prevStats[key + "_raf"] = requestAnimationFrame(step);
    };
    tweenStat(elements.totalCount, "total", projects.length, 0);
    tweenStat(
      elements.registeringCount,
      "registering",
      projects.filter((p) => p.status === "报名中").length,
      0
    );
    tweenStat(
      elements.makingCount,
      "making",
      projects.filter((p) => p.status === "制作中").length,
      0
    );
    tweenStat(
      elements.openedCount,
      "opened",
      projects.filter((p) => p.status === "已开标").length,
      0
    );
    if (elements.inTransitGuarantee) {
      const { inTransit } = getGuaranteeTotals(projects);
      tweenStat(elements.inTransitGuarantee, "guarantee", inTransit, 2);
    }
    // v0.13.1：页头副标题固定为口号，不再被统计句覆盖。
    // 此前 renderStats 每次渲染都把副标题重写成"X 个进行中 · Y 个临近"，
    // 导致 HTML 里写的口号从未真正显示过；统计数本来就在统计卡片里。
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

  /** v0.4.0：保证金退还提醒横幅（deadlineTip 下方），最多列 3 个项目 + 标记已退回 */
  const renderRefundReminder = (projects) => {
    const el = elements.refundTip;
    if (!el) return;
    const items = getGuaranteeRefundReminders(projects);
    if (!items.length) {
      el.hidden = true;
      el.innerHTML = "";
      return;
    }
    el.hidden = false;
    const shown = items.slice(0, 3);
    const more = items.length > 3 ? `等共 ${items.length} 个` : "";
    const rows = shown
      .map(
        (p) =>
          `<span class="refund-item">「${escapeHtml(p.name)}」（${escapeHtml(formatDateDisplay(p.date))}开标）<button class="btn secondary refund-btn" type="button" data-action="mark-refunded" data-id="${escapeHtml(p.id)}">标记已退回</button></span>`
      )
      .join("");
    el.innerHTML = `<span class="refund-text">💰 以下项目已开标且保证金已缴纳，跟进退还：</span>${rows}${more ? `<span class="refund-more">${escapeHtml(more)}</span>` : ""}`;
  };

  const upcomingLevel = (days) =>
    days === 0 ? "urgent" : days === 1 ? "red" : days <= 3 ? "orange" : "yellow";

  const renderUpcomingList = (projects) => {
    const reminderDays = getReminderDays();
    const upcoming = getUpcomingDeadlines(projects, reminderDays);
    const desc = document.getElementById("upcomingDesc");
    if (desc) {
      desc.textContent = `未来 ${reminderDays} 天内的截止事项，按时间排序；浏览器通知仅在页面打开时触发。`;
    }
    if (!upcoming.length) {
      elements.upcomingList.innerHTML = `<div class="upcoming-empty"><div class="up-empty-icon">✓</div><div class="up-empty-title">未来 ${reminderDays} 天暂无截止事项</div><div class="up-empty-sub">新的截止时间会在这里提醒你</div></div>`;
      return;
    }
    elements.upcomingList.innerHTML = upcoming
      .map(({ project, label, date, days }) => {
        const level = upcomingLevel(days);
        const [y, m, d] = String(date).split("-");
        const labelText =
          days === 0 ? "今日截止" : days === 1 ? "明日截止" : `${days} 天后`;
        return `<div class="upcoming-item ${level}" data-id="${escapeHtml(project.id)}" role="button" tabindex="0" title="点击定位到项目列表"><div class="up-date"><span class="up-day">${escapeHtml(String(Number(d) || ""))}</span><span class="up-month">${escapeHtml(String(Number(m) || ""))}月</span></div><div class="up-main"><div class="up-name">${escapeHtml(project.name)}</div><div class="up-label">${escapeHtml(label)} · ${escapeHtml(formatDateDisplay(date))}</div></div><span class="up-pill">${escapeHtml(labelText)}</span></div>`;
      })
      .join("");
  };

  // v0.15.0：证据行（页码 + 原文 + 核对状态）与核对开关；旧字符串数据兼容显示。
  const evidenceMeta = (raw, project, kind, index) => {
    const item =
      raw && typeof raw === "object"
        ? raw
        : { text: raw, page: null, quote: "", verified: false };
    const state = getEvidenceState(item);
    const page = item.page
      ? `<span class="evidence-page">第 ${escapeHtml(item.page)} 页</span>`
      : "";
    const quote = item.quote
      ? `<span class="evidence-quote" title="${escapeHtml(item.quote)}">“${escapeHtml(item.quote)}”</span>`
      : "";
    const toggle = project
      ? `<button class="btn verify-btn ${item.verified ? "verified" : ""}" type="button" data-action="verify-evidence" data-id="${escapeHtml(project.id)}" data-kind="${kind}" data-index="${index}" aria-pressed="${item.verified ? "true" : "false"}" title="${item.verified ? "取消核对" : "标记为已核对"}">${item.verified ? "✓ 已核对" : "核对"}</button>`
      : "";
    // v0.16.0：结论单条删除（卡片上才有；AI 面板是只读预览，不放删除）。
    const del = project
      ? `<button class="btn secondary evidence-del" type="button" data-action="delete-evidence" data-id="${escapeHtml(project.id)}" data-kind="${kind}" data-index="${index}" title="删除这条结论">×</button>`
      : "";
    return `<div class="evidence-meta">${page}${quote}<span class="evidence-state ${state.cls}">${state.label}</span>${toggle}${del}</div>`;
  };

  const renderStructList = (title, items, project, kind) => {
    if (!Array.isArray(items) || !items.length) return "";
    const lis = items
      .map(
        (item, i) =>
          `<li><div>${escapeHtml(typeof item === "string" ? item : item.text || "")}</div>${evidenceMeta(item, project, kind, i)}</li>`
      )
      .join("");
    return `<div class="struct-block"><div class="struct-title">${escapeHtml(title)}</div><ul class="struct-list">${lis}</ul></div>`;
  };

  const sanitizeLevel = (level) =>
    ["high", "medium", "low"].includes(level) ? level : "medium";

  const renderRiskCard = (p) => {
    const hasRisk =
      p.riskSummary || (p.riskPoints && p.riskPoints.length);
    const hasStruct =
      (p.qualification && p.qualification.length) ||
      (p.invalidBidClauses && p.invalidBidClauses.length);
    if (!hasRisk && !hasStruct) return "";
    const collapsed = getState().collapsedSections?.has(`${p.id}:risk`);
    const points = Array.isArray(p.riskPoints) ? p.riskPoints : [];
    const pointsHtml = points.length
      ? `<ul class="risk-points">${points
          .map(
            (pt, i) =>
              `<li><span class="risk-level ${sanitizeLevel(pt.level)}">${escapeHtml(pt.level || "注意")}</span><div class="risk-point-body"><div>${escapeHtml(pt.text || pt)}</div>${evidenceMeta(pt, p, "risk", i)}</div></li>`
          )
          .join("")}</ul>`
      : "";
    return `<div class="risk-report${collapsed ? " collapsed" : ""}"><div class="risk-head"><div class="risk-title">⚠️ 风险与条款</div><span class="head-actions"><button class="btn secondary section-collapse-btn" type="button" data-action="clear-risk" data-id="${escapeHtml(p.id)}">清空</button><button class="btn secondary section-collapse-btn" type="button" data-action="toggle-section" data-id="${escapeHtml(p.id)}" data-section="risk" aria-expanded="${collapsed ? "false" : "true"}">${collapsed ? "展开" : "收起"}</button></span></div><div class="risk-body">${
      p.riskSummary
        ? `<p class="risk-summary">${escapeHtml(p.riskSummary)}</p>`
        : ""
    }${renderStructList("资格要求", p.qualification, p, "qualification")}${renderStructList("废标条款", p.invalidBidClauses, p, "invalid")}${pointsHtml}</div></div>`;
  };

  const matchesKeyword = (p, keyword) => {
    if (!keyword) return true;
    const qualText = Array.isArray(p.qualification)
      ? p.qualification
          .map((item) => (typeof item === "string" ? item : item.text || ""))
          .join(" ")
      : "";
    const invalidText = Array.isArray(p.invalidBidClauses)
      ? p.invalidBidClauses
          .map((item) => (typeof item === "string" ? item : item.text || ""))
          .join(" ")
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
    const sort = filters.sort || "date-desc";
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
    const collapsed = getState().collapsedSections?.has(`${p.id}:checklist`);
    const itemsHtml = list.length
      ? list
          .map(
            (item) =>
              `<div class="checklist-item"><input type="checkbox" data-action="checklist-toggle" data-id="${escapeHtml(p.id)}" data-item-id="${escapeHtml(item.id)}" ${item.done ? "checked" : ""} /><span class="checklist-text ${item.done ? "done" : ""}">${escapeHtml(item.text)}</span><span class="checklist-source">${escapeHtml(checklistSourceLabel(item.source))}</span><button class="btn secondary checklist-del" type="button" data-action="checklist-delete" data-id="${escapeHtml(p.id)}" data-item-id="${escapeHtml(item.id)}" title="删除该项">×</button></div>`
          )
          .join("")
      : `<div class="checklist-empty">暂无检查项，可从 AI 结果生成或手动添加。</div>`;
    return `<div class="checklist${collapsed ? " collapsed" : ""}"><div class="checklist-head"><div class="checklist-progress">📋 废标检查清单：已完成 ${done}/${total}</div><span class="head-actions"><button class="btn secondary section-collapse-btn" type="button" data-action="clear-checklist" data-id="${escapeHtml(p.id)}">清空</button><button class="btn secondary section-collapse-btn" type="button" data-action="toggle-section" data-id="${escapeHtml(p.id)}" data-section="checklist" aria-expanded="${collapsed ? "false" : "true"}">${collapsed ? "展开" : "收起"}</button></span></div><div class="checklist-body"><div class="checklist-items">${itemsHtml}</div><div class="checklist-add"><input class="checklist-new-input" type="text" maxlength="500" placeholder="手动添加检查项" /><button class="btn secondary" type="button" data-action="checklist-add" data-id="${escapeHtml(p.id)}">添加</button><button class="btn secondary" type="button" data-action="checklist-generate" data-id="${escapeHtml(p.id)}">从 AI 结果生成清单</button></div></div></div>`;
  };

  /** v0.4.5：列表 cell 右侧倒计时 pill —— 短文案 + 紧急度 class（60s 刷新只更新文字） */
  const countdownCell = (proj) => {
    if (proj.status === "已开标") return { text: "已开标", cls: "cd-done" };
    const days = getDaysUntilBid(proj.date);
    if (days === null) return { text: "已开标", cls: "cd-done" };
    if (days < 0) return { text: `已过期${-days}天`, cls: "cd-overdue" };
    if (days === 0) return { text: "今天开标", cls: "cd-urgent" };
    if (days <= 3) return { text: `还有${days}天`, cls: "cd-warn" };
    return { text: `还有${days}天`, cls: "cd-normal" };
  };

  /** v0.4.5：状态圆点 class（徽章已移到详情区） */
  const statusDotClass = (status) =>
    status === "已开标" ? "sd-done" : status === "制作中" ? "sd-warn" : "sd-info";

  /** v0.4.5：M月d日（去掉年份，给 cell 第二行用） */
  const shortDateDisplay = (value) =>
    value ? formatDateDisplay(value).replace(/^\d+年/, "") : "";

  /** v0.4.1：两段式项目卡片 —— 头部（始终显示）+ 详情区（默认折叠）。展开态由 state.expandedIds 维护，render 后恢复。 */
  const renderProjectItem = (p, i) => {
    const expandedIds = getState().expandedIds;
    const expanded = expandedIds && expandedIds.has(p.id);
    const next = getNextDeadline(p);
    const deadlineHtml = next
      ? `<div class="deadline-line">最近截止：${escapeHtml(next.label)} · ${escapeHtml(formatDateDisplay(next.date))}${next.days === 0 ? "（今天）" : `（还有 ${next.days} 天）`}</div>`
      : "";
    // 4 个截止时间（选填，有则显示）
    // v0.4.0：列表不再拉 pdf_text 全文，只显示文件名 + 保存日期（全文按需拉）
    const pdfHtml =
      p.pdfFilename || p.pdfParsedAt
        ? `<div class="pdf-saved">已保存招标文件：${escapeHtml(p.pdfFilename || "未命名")}${p.pdfParsedAt ? ` · ${escapeHtml(formatDateDisplay(String(p.pdfParsedAt).slice(0, 10)))}` : ""} <button class="btn secondary pdf-view-btn" type="button" data-action="view-pdf" data-id="${escapeHtml(p.id)}">查看已保存文本</button></div>`
        : "";
    // v0.5.0：iOS 定义列表 —— label 左、value 右、hairline 分隔
    const kv = (label, valueHtml) =>
      `<div class="kv-row"><span class="kv-label">${label}</span><span class="kv-value">${valueHtml}</span></div>`;
    const deadlineRows = [
      ["报名截止", p.registrationDeadline],
      ["质疑截止", p.inquiryDeadline],
      ["澄清截止", p.clarificationDeadline],
      ["保证金缴纳截止", p.guaranteeDeadline],
    ]
      .filter(([, d]) => d)
      .map(
        ([label, d]) => kv(label, escapeHtml(formatDateDisplay(d)))
      )
      .join("");
    // v0.13.1：展开详情恢复旧版内容，前 7 项按指定顺序排列；
    // 后面只留截止时间、最近截止、风险卡、清单、已保存文件
    // （招标单位 / 金额 / 保证金已删，截止全空时不渲染空列表）。
    const detailsHtml =
      `<div class="kv-list">` +
      kv("项目状态", `<span class="badge ${getStatusClass(p.status)}">${escapeHtml(p.status)}</span>`) +
      kv("开标时间", p.date ? escapeHtml(formatDateDisplay(p.date)) : "未设置开标时间") +
      kv("项目类型", escapeHtml(p.type)) +
      kv("项目名称", escapeHtml(p.name)) +
      kv("投标公司", escapeHtml(p.biddingCompany || "-")) +
      kv("联系人", escapeHtml(p.contact || "-")) +
      // v0.23.0：备注改回定义列表行，与项目名称 / 联系人同一格式（之前是小灰字 kv-note）。
      kv("备注", escapeHtml(p.notes || "—")) +
      `</div>` +
      (deadlineRows ? `<div class="kv-list">${deadlineRows}</div>` : "") +
      deadlineHtml +
      renderRiskCard(p) +
      renderChecklist(p) +
      pdfHtml;
    const cd = countdownCell(p);
    const dateShort = shortDateDisplay(p.date);
    const subLine = `${dateShort ? `${dateShort}开标` : "未设置开标时间"} · ${p.type} · ${p.biddingCompany || "-"}`;
    // v0.6.0：选择模式下行首显示 iOS 圆形复选框
    const st = getState();
    const selectMode = !!(st && st.selectMode);
    const checked = !!(st && st.selectedIds && st.selectedIds.has(p.id));
    const checkHtml = selectMode
      ? `<button class="select-check" type="button" role="checkbox" aria-checked="${checked ? "true" : "false"}" aria-label="选择项目" data-action="toggle-select" data-id="${escapeHtml(p.id)}"><svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M2.5 6.8 5.3 9.5 10.5 3.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`
      : "";
    return `<div class="project-item${expanded ? " expanded" : ""}" data-id="${escapeHtml(p.id)}" style="animation-delay:${Math.min(i * 12, 96)}ms"><div class="project-head" data-action="toggle-details" data-id="${escapeHtml(p.id)}" role="button" tabindex="0" aria-expanded="${expanded ? "true" : "false"}" title="点击展开 / 收起详情">${checkHtml}<span class="status-dot ${statusDotClass(p.status)}" title="${escapeHtml(p.status)}"></span><div class="project-head-main"><div class="project-name">${escapeHtml(p.name)}</div><div class="project-sub">${escapeHtml(subLine)}</div></div><div class="project-head-right"><div class="project-head-top"><span class="countdown cd-pill ${cd.cls}" data-date="${escapeHtml(p.date)}" data-status="${escapeHtml(p.status)}">${escapeHtml(cd.text)}</span><span class="project-chevron" aria-hidden="true">›</span></div><div class="project-head-actions"><button class="row-btn act-parse" type="button" data-action="parse" data-id="${escapeHtml(p.id)}">📄 解析</button><button class="row-btn act-edit" type="button" data-action="edit" data-id="${escapeHtml(p.id)}">编辑</button><button class="row-btn act-clone" type="button" data-action="clone" data-id="${escapeHtml(p.id)}">复制</button><button class="row-btn act-del" type="button" data-action="delete" data-id="${escapeHtml(p.id)}">删除</button></div></div></div><div class="project-details collapse${expanded ? " expanded" : ""}"><div class="collapse-inner">${detailsHtml}</div></div></div>`;
  };

  /** v0.6.0：列表到底趣味文案（按数量轮换） */
  const END_QUOTES = [
    "到底啦，共 {n} 个项目，去喝杯茶吧 🍵",
    "已经到底了，剩下的时间都是你的 ☕",
    "没有更多项目了，项目都在这儿啦 📋",
  ];

  const renderList = (projects, filters) => {
    const keyword = (filters.keyword || "").trim();
    const status = filters.status || "all";
    const hasActiveFilter = Boolean(keyword) || status !== "all";
    const filtered = getFilteredProjects(projects, filters);
    updateFilterCount(filtered.length, projects.length, hasActiveFilter);
    // v0.6.0：选择模式下给容器加 selecting（隐藏行内操作按钮）
    if (elements.list)
      elements.list.classList.toggle(
        "selecting",
        !!(getState() && getState().selectMode)
      );

    if (!filtered.length) {
      elements.list.innerHTML =
        '<div class="empty-state"><div class="empty-icon">＋</div><div class="empty-title">还没有项目</div><div class="empty-sub">新增第一个项目，开始管理投标进度</div><button class="btn primary" type="button" data-action="empty-add">新增第一个项目</button></div>';
      return;
    }
    // v0.11.0：列表分页——只渲染前 listLimit 条，剩余的用"加载更多"续取；
    // 全部加载完才显示结尾文案，避免长列表一次生成几百个卡片节点。
    // v0.12.0：切片逻辑收进 utils.paginateItems（可单测），此处只负责拼 HTML。
    const { visible, remaining } = paginateItems(
      filtered,
      (getState() && getState().listLimit) || 50
    );
    elements.list.innerHTML =
      visible.map((p, i) => renderProjectItem(p, i)).join("") +
      (remaining > 0
        ? `<button class="btn secondary load-more-btn" type="button" data-action="load-more">加载更多（剩余 ${remaining} 条，已显示 ${visible.length} / 共 ${filtered.length} 条）</button>`
        : `<div class="list-end">—— ${escapeHtml(
            END_QUOTES[filtered.length % END_QUOTES.length].replace(
              "{n}",
              String(filtered.length)
            )
          )} ——</div>`);
  };

  /** 定位到项目列表中的某一项并高亮（v0.4.1：自动展开该项目） */
  const focusProjectInList = (projectId) => {
    if (!projectId) return;
    // 清空搜索与状态筛选，确保目标项目可见
    if (elements.search) elements.search.value = "";
    if (elements.statusFilter) elements.statusFilter.value = "all";
    // v0.5.0：seg 同步（app.js 在 state 上挂了 syncSegControl）
    const s0 = getState();
    if (typeof s0.syncSegControl === "function") s0.syncSegControl();
    // v0.4.1：自动展开目标项目的详情区，再 render
    const s = getState();
    if (s.expandedIds && !s.expandedIds.has(projectId)) {
      s.expandedIds.add(projectId);
    }
    // v0.11.0：分页下目标可能在"加载更多"后面——先把页数扩到含目标的那一页再 render
    // v0.12.0：扩页算术收进 utils.expandLimitForIndex（可单测）
    const filtered = getFilteredProjects(s.projects, getCurrentFilters());
    const targetIndex = filtered.findIndex((p) => p.id === projectId);
    if (targetIndex >= 0) {
      s.listLimit = expandLimitForIndex(s.listLimit, targetIndex);
    }
    render();
    const item = elements.list?.querySelector(
      `.project-item[data-id="${CSS.escape(String(projectId))}"]`
    );
    if (!item) {
      showToast("列表中没有该项目。");
      return;
    }
    item.scrollIntoView({ behavior: "smooth", block: "center" });
    item.classList.add("project-highlight");
    // v0.25.0：与 1.6s 淡出动画对齐；动画终态就是透明，移除类名时不再闪一下。
    setTimeout(() => item.classList.remove("project-highlight"), 1600);
  };

  /** 仅更新倒计时文字，避免每分钟全量 render */
  const updateCountdowns = () => {
    elements.list
      ?.querySelectorAll(".countdown[data-date]")
      .forEach((el) => {
        el.textContent = countdownCell({
          date: el.dataset.date,
          status: el.dataset.status,
        }).text;
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
          return `<div class="project-item"><div class="trash-head"><div class="project-head-main"><div class="project-name">${escapeHtml(p.name)}</div><div class="project-sub">开标：${escapeHtml(formatDateDisplay(p.date))} · ${escapeHtml(p.biddingCompany || "-")} · 删除于${escapeHtml(deletedDate)}</div></div><div class="trash-actions"><button class="btn tint-blue" type="button" data-action="restore" data-id="${escapeHtml(p.id)}">恢复</button><button class="btn tint-red" type="button" data-action="permanent-delete" data-id="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name)}">彻底删除</button></div></div></div>`;
        }
      )
      .join("");
  };

  const getCurrentFilters = () => ({
    keyword: elements.search?.value || "",
    status: elements.statusFilter?.value || "all",
    sort: elements.sortBy?.value || "date-desc",
  });

  // 导出用：返回当前搜索/筛选/排序后的项目，而非全量。
  const getCurrentFilteredProjects = () =>
    getFilteredProjects(getState().projects, getCurrentFilters());

  /** v0.8.0：开标日历 —— 月历网格（周一起始）+ 当天项目。只响应状态筛选，忽略搜索关键词。 */
  const CAL_WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
  const toDateStr = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const renderCalendar = (projects, filters) => {
    const grid = elements.calendarGrid;
    const dayList = elements.calendarDayList;
    const title = elements.calendarTitle;
    if (!grid || !dayList) return;
    const st = getState();
    const now = new Date();
    const year = Number.isInteger(st.calYear) ? st.calYear : now.getFullYear();
    const month = Number.isInteger(st.calMonth) ? st.calMonth : now.getMonth();
    const selected = st.calSelected || toDateStr(now);
    const todayStr = toDateStr(now);
    const status = filters?.status || "all";
    // 状态筛选后的未删除项目（state.projects 本身已排除回收站）
    const visible = (Array.isArray(projects) ? projects : []).filter(
      (p) => status === "all" || p.status === status
    );
    const byDate = new Map();
    visible.forEach((p) => {
      const d = String(p.date || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d).push(p);
    });
    if (title) title.textContent = `${year}年${month + 1}月`;
    // 圆点颜色：取当天最紧急的项目（红 > 橙 > 蓝）
    const dotClassFor = (list) => {
      let rank = 0;
      list.forEach((p) => {
        const cls = countdownCell(p).cls;
        const r = cls === "cd-urgent" || cls === "cd-overdue" ? 3 : cls === "cd-warn" ? 2 : 1;
        if (r > rank) rank = r;
      });
      return rank === 3 ? "dot-red" : rank === 2 ? "dot-orange" : "dot-blue";
    };
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadBlanks = (first.getDay() + 6) % 7; // 周一起始
    let cells = CAL_WEEKDAYS.map(
      (w) => `<div class="cal-weekday">${w}</div>`
    ).join("");
    for (let i = 0; i < leadBlanks; i++) cells += `<span class="cal-blank"></span>`;
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const list = byDate.get(ds) || [];
      const classes = ["cal-day"];
      if (ds === todayStr) classes.push("is-today");
      if (ds === selected) classes.push("is-selected");
      if (!list.length) classes.push("is-empty");
      const dot = list.length
        ? `<span class="cal-dot ${dotClassFor(list)}" aria-hidden="true"></span>`
        : "";
      cells += `<button type="button" class="${classes.join(" ")}" data-cal-date="${ds}" aria-label="${ds}${list.length ? `，${list.length} 个项目` : ""}"><span class="cal-num">${d}</span>${dot}</button>`;
    }
    grid.innerHTML = cells;
    // 当天项目：紧凑行，点击回到列表定位（复用 focusProjectInList）
    const dayProjects = (byDate.get(selected) || []).slice().sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "zh-CN")
    );
    const dayTitle = elements.calendarDayTitle;
    if (dayTitle)
      dayTitle.textContent = `${formatDateDisplay(selected)} · ${dayProjects.length} 个项目`;
    if (!dayProjects.length) {
      dayList.innerHTML = `<div class="cal-day-empty">当天没有开标项目，点击其他日期查看。</div>`;
      return;
    }
    dayList.innerHTML =
      `<div class="cal-day-hint">点击项目回到列表查看详情</div>` +
      dayProjects
        .map((p) => {
          const cd = countdownCell(p);
          return `<button type="button" class="cal-day-row" data-cal-project-id="${escapeHtml(p.id)}"><span class="status-dot ${statusDotClass(p.status)}" title="${escapeHtml(p.status)}"></span><span class="cal-day-main"><span class="cal-day-name">${escapeHtml(p.name)}</span><span class="cal-day-sub">${escapeHtml(p.type)} · ${escapeHtml(p.biddingCompany || "-")}</span></span><span class="countdown cd-pill ${cd.cls}">${escapeHtml(cd.text)}</span><span class="project-chevron" aria-hidden="true">›</span></button>`;
        })
        .join("");
  };

  /** v0.8.0：保证金待退还清单 —— 已开标 + 已缴纳（未标记退还），按开标日升序 */
  const renderGuaranteeList = (projects) => {
    const el = elements.guaranteeList;
    if (!el) return;
    const list = (Array.isArray(projects) ? projects : [])
      .filter((p) => p.status === "已开标" && p.guaranteeStatus === "已缴纳")
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
    const countEl = elements.guaranteeCount;
    if (countEl) countEl.textContent = list.length ? `（${list.length} 项待退还）` : "";
    if (!list.length) {
      el.innerHTML = `<div class="guarantee-empty">暂无待退还保证金 🎉</div>`;
      return;
    }
    el.innerHTML = list
      .map((p) => {
        const amount =
          p.guaranteeAmount !== null && p.guaranteeAmount !== undefined
            ? formatMoney(p.guaranteeAmount, p.guaranteeUnit)
            : "未填";
        return `<div class="guarantee-row"><div class="guarantee-main"><div class="guarantee-name">${escapeHtml(p.name)}</div><div class="guarantee-sub">${escapeHtml(formatDateDisplay(p.date))}开标 · 保证金 ${escapeHtml(amount)}</div></div><button class="btn secondary" type="button" data-action="mark-refunded" data-id="${escapeHtml(p.id)}">标记已退还</button></div>`;
      })
      .join("");
  };

  const render = () => {
    const state = getState();
    const filters = getCurrentFilters();
    renderOfflineBanner(state);
    renderStats(state.projects);
    renderUpcomingList(state.projects);
    renderDeadlineTip(state.projects);
    renderRefundReminder(state.projects);
    renderList(state.projects, filters);
    renderGuaranteeList(state.projects);
    renderCalendar(state.projects, filters);
  };

  // v0.12.0：离线快照横幅——快照模式下常驻提示（含快照保存时间），联网恢复后消失
  const renderOfflineBanner = (state) => {
    const el = elements.offlineBanner;
    if (!el) return;
    if (state.offlineSnapshot) {
      const when = state.snapshotSavedAt
        ? new Date(state.snapshotSavedAt).toLocaleString()
        : "";
      el.textContent = `当前为离线快照${when ? `（${when} 保存）` : ""}，仅可查看，联网后自动恢复。`;
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
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
    // v0.24.0：浮动按钮显隐 —— 下滑 200px 后现回顶部；离底部还剩 200px 以上时现回到底部。
    elements.backToTopBtn?.classList.toggle("visible", scrollY > 200);
    elements.goToBottomBtn?.classList.toggle("visible", max - scrollY > 200);
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

  // v0.10.0：自定义确认框 —— 替代原生 confirm()；返回 Promise<boolean>。
  // 默认焦点在取消按钮上，避免回车误触；新调用到来时旧调用按取消处理。
  // 监听全部用属性赋值（每次覆盖），不叠加、不误关新框。
  let pendingConfirmCancel = null;
  const confirmDialog = ({
    title = "请确认",
    message = "",
    confirmText = "确定",
    cancelText = "取消",
    danger = false,
  } = {}) => {
    const dialog = elements.confirmDialog;
    if (!dialog) return Promise.resolve(window.confirm(message));
    if (pendingConfirmCancel) {
      const cancelPrevious = pendingConfirmCancel;
      pendingConfirmCancel = null;
      cancelPrevious();
    }
    return new Promise((resolve) => {
      if (elements.confirmDialogTitle) elements.confirmDialogTitle.textContent = title;
      if (elements.confirmDialogMessage) elements.confirmDialogMessage.textContent = message;
      if (elements.confirmDialogCancel) elements.confirmDialogCancel.textContent = cancelText;
      const okBtn = elements.confirmDialogOk;
      if (okBtn) {
        okBtn.textContent = confirmText;
        okBtn.className = danger ? "btn danger-solid" : "btn primary";
      }
      const cleanup = () => {
        pendingConfirmCancel = null;
        dialog.classList.add("hidden");
        document.body.classList.remove("sheet-open");
        dialog.onclick = null;
        if (okBtn) okBtn.onclick = null;
        if (elements.confirmDialogCancel) elements.confirmDialogCancel.onclick = null;
        document.removeEventListener("keydown", onKeyDown);
      };
      const finish = (value) => {
        cleanup();
        resolve(value);
      };
      const onKeyDown = (event) => {
        if (event.key === "Escape") finish(false);
      };
      pendingConfirmCancel = () => finish(false);
      dialog.classList.remove("hidden");
      document.body.classList.add("sheet-open");
      dialog.onclick = (event) => {
        if (event.target.closest("[data-action='cancel-confirm']")) finish(false);
      };
      if (okBtn) okBtn.onclick = () => finish(true);
      if (elements.confirmDialogCancel) {
        elements.confirmDialogCancel.onclick = () => finish(false);
        elements.confirmDialogCancel.focus();
      }
      document.addEventListener("keydown", onKeyDown);
    });
  };

  // v0.10.0：骨架屏 —— 列表首屏与回收站抽屉加载时先占位，数据到了再替换
  const skeletonRows = (count) =>
    `<div class="skeleton-list" aria-hidden="true">${Array.from(
      { length: count },
      () =>
        `<div class="skeleton-row"><div class="skeleton-line skeleton-title"></div><div class="skeleton-line skeleton-sub"></div></div>`
    ).join("")}</div>`;
  const showListSkeleton = () => {
    if (elements.list) elements.list.innerHTML = skeletonRows(4);
  };
  const showTrashSkeleton = () => {
    if (elements.trashList) elements.trashList.innerHTML = skeletonRows(3);
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
    confirmDialog,
    showListSkeleton,
    showTrashSkeleton,
  };
}
