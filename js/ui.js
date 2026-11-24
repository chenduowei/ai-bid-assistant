/** UI 渲染与交互辅助 */

import {
  escapeHtml,
  qualMatchBadge,
  qualMatchSummary,
  formatDateDisplay,
  formatBidMoment,
  getCountdownInfo,
  getNextHeroBid,
  formatHeroCountdown,
  getReminderDays,
  formatMoney,
  getGuaranteeTotals,
  getNextDeadline,
  getUpcomingDeadlines,
  getChecklistProgress,
  isSectionOpen,
  getGuaranteeRefundReminders,
  getTrashRemainingDays,
  getWinRate,
  matchResult,
  emptyStateKind,
  paginateItems,
  expandLimitForIndex,
  getEvidenceState,
} from "./utils.js";

// v0.35.8：内联 SVG 图标（与 index.html 里菜单/设置同一套 1.7 线宽、24 栅格）
const ICON = {
  clock:
    '<circle cx="12" cy="12" r="8.2"/><path d="M12 7.6v4.8l3.1 1.9"/>',
  warning:
    '<path d="M12 4.6 3.4 19.2h17.2L12 4.6Z"/><path d="M12 9.9v4.2"/><path d="M12 17h.01"/>',
  clipboard:
    '<rect x="5.3" y="4.5" width="13.4" height="16.1" rx="2.4"/><path d="M9.1 4.5a1.6 1.6 0 0 1 1.6-1.6h2.6a1.6 1.6 0 0 1 1.6 1.6"/><path d="m8.7 11.3 1.3 1.3 2.3-2.4M8.7 16.3l1.3 1.3 2.3-2.4"/>',
  search:
    '<circle cx="10.8" cy="10.8" r="6.1"/><path d="m15.5 15.5 3.9 3.9"/>',
};
const svgIcon = (path, cls = "ico") =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

export function createUi(elements, getState) {
  // v0.7.0：统计 count-up 上次值（及进行中的 rAF id）
  const prevStats = {};
  const showToast = (message) => {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    // v0.30.0：Toast 上限 3 条 —— 之前无上限，连续操作会叠满屏。
    while (elements.toastWrap.children.length >= 3) {
      elements.toastWrap.firstChild.remove();
    }
    elements.toastWrap.appendChild(toast);
    // v0.35.5：提示条显示期间收起手机端浮钮 —— 它们压在提示条右下角（z-index 更高，遮字）
    document.body.classList.add("toast-open");
    setTimeout(() => {
      toast.classList.add("out");
      setTimeout(() => {
        toast.remove();
        if (!elements.toastWrap.children.length)
          document.body.classList.remove("toast-open");
      }, 250);
    }, 2600);
  };

  const setSyncStatus = (message, isError = false) => {
    if (!elements.syncStatus) return;
    elements.syncStatus.textContent = `● ${message}`;
    // v0.35.0：不再用内联颜色（--success #34C759 在白底上只有 2.2:1，12px 字看不清）；
    // 文字走 --tint-green-text（约 5.9:1），错误态走 --danger，颜色统一交给 CSS。
    elements.syncStatus.classList.toggle("is-error", Boolean(isError));
  };

  const applyTheme = (darkMode) => {
    document.body.classList.toggle("dark", darkMode);
    // v0.35.0：跟随应用内开关改主题色（安卓地址栏 / iOS PWA 状态栏），深色不再留一条浅灰。
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", darkMode ? "#000000" : "#F2F2F7");
    if (elements.themeBtn) {
      // v0.34.0：主题按钮搬进了设置页的「外观」行 —— 文案改成动作（切换为深色 / 浅色），
      // 不会再把「⏿ 深色」误读成当前就是深色。
      // v0.35.8：图标改成内联 SVG（月亮 / 太阳由 CSS 按 body.dark 切换），这里只改文字
      const label = elements.themeBtn.querySelector(".btn-label");
      if (label) label.textContent = darkMode ? "切换为浅色" : "切换为深色";
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
    if (elements.inProgressCount) {
      tweenStat(
        elements.inProgressCount,
        "inProgress",
        projects.filter((p) => p.status === "报名中" || p.status === "制作中")
          .length,
        0
      );
    }
    if (elements.registeringCount) {
      tweenStat(
        elements.registeringCount,
        "registering",
        projects.filter((p) => p.status === "报名中").length,
        0
      );
    }
    if (elements.makingCount) {
      tweenStat(
        elements.makingCount,
        "making",
        projects.filter((p) => p.status === "制作中").length,
        0
      );
    }
    if (elements.openedCount) {
      tweenStat(
        elements.openedCount,
        "opened",
        projects.filter((p) => p.status === "已开标").length,
        0
      );
    }
    if (elements.inTransitGuarantee) {
      const { inTransit } = getGuaranteeTotals(projects);
      tweenStat(elements.inTransitGuarantee, "guarantee", inTransit, 2);
    }
    // v0.34.0：即将开标 —— 开标日落在未来 N 天（提醒窗口）内的未开标项目数；
    // v0.35.0：改成与面板同一口径（按“事项”数）：一个项目的报名截止与开标日
    // 都在窗口内时会算两条，卡片数字与面板条数不再对不上。
    if (elements.upcomingCount) {
      const items = getUpcomingDeadlines(projects, getReminderDays());
      tweenStat(elements.upcomingCount, "upcoming", items.length, 0);
    }
    // v0.36.0：中标率仅在查看「已开标」或已有结果筛选时在工具栏显示，日常保持纯净
    if (elements.winRate) {
      const { won, decided, rate } = getWinRate(projects);
      const showWin =
        decided > 0 &&
        (elements.statusFilter?.value === "已开标" ||
          (elements.resultFilter && elements.resultFilter.value !== "all"));
      if (showWin) {
        elements.winRate.textContent = `中标率 ${rate}%（${won}/${decided}）`;
        elements.winRate.classList.remove("hidden");
      } else {
        elements.winRate.textContent = "";
        elements.winRate.classList.add("hidden");
      }
    }
    // v0.13.1：页头副标题固定为口号，不再被统计句覆盖。
    // 此前 renderStats 每次渲染都把副标题重写成"X 个进行中 · Y 个临近"，
    // 导致 HTML 里写的口号从未真正显示过；统计数本来就在统计卡片里。
  };

  const renderDeadlineTip = (projects) => {
    if (!elements.deadlineTip) return;
    const reminderDays = getReminderDays();
    const upcoming = getUpcomingDeadlines(projects, reminderDays);
    const badgeEl = document.getElementById("upcomingBadgeCount");
    if (badgeEl) {
      badgeEl.textContent = String(upcoming.length);
      badgeEl.classList.toggle("hidden", upcoming.length === 0);
    }
    elements.deadlineTip.hidden = !upcoming.length;
    if (upcoming.length) {
      const first = upcoming[0];
      const left =
        first.days === 0 ? "今天" : `还有 ${first.days} 天`;
      // v0.35.8：⏰ → 线性时钟图标（emoji 各平台渲染不一）
      // v0.35.8：临近的用「今天 / 明天」，隔得远的才报日期 —— 桌面端这一条原来在 1440 上正好多出
      // 半个字折到第二行（「天）。」孤零零一行），压掉重复的日期后一行放得下。
      const when =
        first.days === 0 ? "今天" : first.days === 1 ? "明天" : `${formatDateDisplay(first.date)}，${left}`;
      elements.deadlineTip.innerHTML = `${svgIcon(ICON.clock, "ico tip-ico")}未来 ${reminderDays} 天有 ${upcoming.length} 个截止事项，最近的是「${escapeHtml(first.project.name)}」· ${escapeHtml(first.label)}（${when}）。`;
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
    el.innerHTML = `<span class="refund-text">${svgIcon(ICON.refund, "ico tip-ico")}以下项目已开标且保证金已缴纳，跟进退还：</span><span class="refund-compact">${svgIcon(ICON.refund, "ico tip-ico")}${items.length} 笔保证金待退还</span><button class="btn secondary refund-open-btn" type="button" data-action="open-guarantee">查看</button>${rows}${more ? `<span class="refund-more">${escapeHtml(more)}</span>` : ""}`;
  };

  const upcomingLevel = (days) =>
    days === 0 ? "urgent" : days === 1 ? "red" : days <= 3 ? "orange" : "yellow";

  const renderUpcomingList = (projects) => {
    const reminderDays = getReminderDays();
    const upcoming = getUpcomingDeadlines(projects, reminderDays);
    const desc = document.getElementById("upcomingDesc");
    if (desc) {
      desc.textContent = `未来 ${reminderDays} 天内的截止事项（含报名 / 质疑 / 澄清 / 保证金 / 开标），按时间排序；浏览器通知仅在页面打开时触发。`;
    }
    // v0.35.5：手机端收起态的一行摘要（同一口径：事项数 + 最近一条）
    const summary = document.getElementById("upcomingSummary");
    if (summary) {
      if (!upcoming.length) {
        summary.textContent = `未来 ${reminderDays} 天内暂无截止事项`;
      } else {
        const first = upcoming[0];
        const left = first.days === 0 ? "今天" : first.days === 1 ? "明天" : `还有 ${first.days} 天`;
        // v0.35.6：摘要与标题排成一行，文案压到 12 字上下（原「未来 7 天 5 个截止 · 最近：…」
        // 连标题 90px 一起放不进 360 的屏）。事项数不在这里重复 —— 上面统计卡的「临近」就是它，
        // 这里只留「窗口 + 最近一条」，360/320 都不会把「今天」截掉。
        summary.textContent = `近 ${reminderDays} 天 · ${first.label} ${left}`;
      }
    }
    if (!upcoming.length) {
      elements.upcomingList.innerHTML = `<div class="upcoming-empty"><div class="up-empty-icon">✓</div><div class="up-empty-title">未来 ${reminderDays} 天暂无截止事项</div><div class="up-empty-sub">新的截止时间会在这里提醒你</div></div>`;
      return;
    }
    elements.upcomingList.innerHTML = upcoming
      .map(({ project, label, date, days, time }) => {
        const level = upcomingLevel(days);
        const [y, m, d] = String(date).split("-");
        const labelText =
          days === 0 ? "今日截止" : days === 1 ? "明日截止" : `${days} 天后`;
        return `<div class="upcoming-item ${level}" data-id="${escapeHtml(project.id)}" data-project-id="${escapeHtml(project.id)}" role="button" tabindex="0" title="点击定位到项目列表"><div class="up-date"><span class="up-day">${escapeHtml(String(Number(d) || ""))}</span><span class="up-month">${escapeHtml(String(Number(m) || ""))}月</span></div><div class="up-main"><div class="up-name">${escapeHtml(project.name)}</div><div class="up-label">${escapeHtml(label)}${time ? ` · ${escapeHtml(time)}` : ""} · ${escapeHtml(formatDateDisplay(date))}</div></div><span class="up-pill">${escapeHtml(labelText)}</span></div>`;
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
      ? `<button class="evidence-del" type="button" data-action="delete-evidence" data-id="${escapeHtml(project.id)}" data-kind="${kind}" data-index="${index}" title="删除这条结论" aria-label="删除这条结论">×</button>`
      : "";
    // v0.29.0：资质对照徽标（只在资格要求条目上）。
    const matchBadge = kind === "qualification" ? qualMatchBadge(item) : "";
    // v0.35.8：两个操作包成一组 —— 窄屏折行时整组一起走，不再让「×」自己掉到下一行当第二个勾选框
    const actions = toggle || del ? `<span class="evidence-actions">${toggle}${del}</span>` : "";
    return `<div class="evidence-meta">${page}${quote}<span class="evidence-state ${state.cls}">${state.label}</span>${matchBadge}${actions}</div>`;
  };

  const renderStructList = (title, items, project, kind) => {
    if (!Array.isArray(items) || !items.length) return "";
    const lis = items
      .map(
        (item, i) =>
          `<li><div>${escapeHtml(typeof item === "string" ? item : item.text || "")}</div>${evidenceMeta(item, project, kind, i)}</li>`
      )
      .join("");
    // v0.29.0：资格要求标题后附对照汇总（满足 / 缺失 / 待确认）。
    const summary = kind === "qualification" ? qualMatchSummary(items) : "";
    return `<div class="struct-block"><div class="struct-title">${escapeHtml(title)}${summary ? `<span class="struct-summary">${escapeHtml(summary)}</span>` : ""}</div><ul class="struct-list">${lis}</ul></div>`;
  };

  const sanitizeLevel = (level) =>
    ["high", "medium", "low"].includes(level) ? level : "medium";
  // v0.35.8：界面上不出现 high / medium / low（模型返回的枚举），换成中文等级
  const LEVEL_LABEL = { high: "高", medium: "中", low: "低" };

  const renderRiskCard = (p) => {
    const hasRisk =
      p.riskSummary || (p.riskPoints && p.riskPoints.length);
    const hasStruct =
      (p.qualification && p.qualification.length) ||
      (p.invalidBidClauses && p.invalidBidClauses.length);
    if (!hasRisk && !hasStruct) return "";
    const riskOpen = isSectionOpen(getState(), p.id, "risk");
    const points = Array.isArray(p.riskPoints) ? p.riskPoints : [];
    const pointsHtml = points.length
      ? `<ul class="risk-points">${points
          .map(
            (pt, i) =>
              `<li><span class="risk-level ${sanitizeLevel(pt.level)}" title="风险等级">${LEVEL_LABEL[sanitizeLevel(pt.level)] || "注意"}</span><div class="risk-point-body"><div>${escapeHtml(pt.text || pt)}</div>${evidenceMeta(pt, p, "risk", i)}</div></li>`
          )
          .join("")}</ul>`
      : "";
    return `<div class="risk-report${riskOpen ? " expanded" : " collapsed"}"><div class="risk-head"><div class="risk-title">${svgIcon(ICON.warning)}风险与条款</div><span class="head-actions"><button class="btn secondary section-collapse-btn" type="button" data-action="clear-risk" data-id="${escapeHtml(p.id)}">清空</button><button class="btn secondary section-collapse-btn" type="button" data-action="toggle-section" data-id="${escapeHtml(p.id)}" data-section="risk" aria-expanded="${riskOpen ? "true" : "false"}">${riskOpen ? "收起" : "展开"}</button></span></div><div class="risk-body">${
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
      p.result,
      p.bidTime,
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
    const result = filters.result || "all";
    const sort = filters.sort || "date-desc";
    const filtered = projects.filter(
      (p) =>
        matchesKeyword(p, keyword) &&
        (status === "all" || p.status === status) &&
        matchResult(p, result)
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

  /** 废标检查清单：进度 + 勾选 + 生成 + 手动新增 + 删除，文本全部 escapeHtml
   *  v0.35.5：勾选框与文字包进 <label class="checklist-main"> —— 手机上整行可点勾选（原来只有 18px 方框能勾），
   *  来源徽标与 × 也不再和文字抢同一行宽度。
   *  v0.35.7：手机端与电脑端都默认收起 —— 只剩一条紧凑标题栏（清单名 + 已完成 X/Y + 箭头），
   *  点整条标题栏展开（动画在 CSS 的 grid-template-rows）。标题栏是一个按钮，
   *  「清空」只在展开时出现，避免收着的时候误触清空。 */
  const renderChecklist = (p) => {
    const list = Array.isArray(p.checklist) ? p.checklist : [];
    const { done, total } = getChecklistProgress(list);
    const open = isSectionOpen(getState(), p.id, "checklist");
    const bodyId = `checklist-body-${p.id}`;
    const itemsHtml = list.length
      ? list
          .map(
            (item) =>
              `<div class="checklist-item"><label class="checklist-main"><input type="checkbox" data-action="checklist-toggle" data-id="${escapeHtml(p.id)}" data-item-id="${escapeHtml(item.id)}" ${item.done ? "checked" : ""} /><span class="checklist-text ${item.done ? "done" : ""}">${escapeHtml(item.text)}</span></label><span class="checklist-source">${escapeHtml(checklistSourceLabel(item.source))}</span><button class="btn secondary checklist-del" type="button" data-action="checklist-delete" data-id="${escapeHtml(p.id)}" data-item-id="${escapeHtml(item.id)}" title="删除该项">×</button></div>`
          )
          .join("")
      : `<div class="checklist-empty">暂无检查项，可从 AI 结果生成或手动添加。</div>`;
    const toggleBtn =
      `<button class="checklist-toggle" type="button" data-action="toggle-section" data-id="${escapeHtml(p.id)}" data-section="checklist" aria-expanded="${open ? "true" : "false"}" aria-controls="${escapeHtml(bodyId)}" title="${open ? "收起清单" : "展开清单"}">` +
      `<span class="checklist-title">废标检查清单</span>` +
      `<span class="checklist-count">已完成 ${done}/${total}</span>` +
      `<span class="checklist-chevron" aria-hidden="true">⌄</span>` +
      `</button>`;
    const headActions =
      `<span class="head-actions"><button class="btn secondary section-collapse-btn" type="button" data-action="clear-checklist" data-id="${escapeHtml(p.id)}">清空</button></span>`;
    return (
      `<div class="checklist ${open ? "expanded" : "collapsed"}">` +
      `<div class="checklist-head">${toggleBtn}${headActions}</div>` +
      `<div class="checklist-body" id="${escapeHtml(bodyId)}"><div class="checklist-body-inner">` +
      `<div class="checklist-items">${itemsHtml}</div>` +
      `<div class="checklist-add"><input class="checklist-new-input" type="text" maxlength="500" placeholder="手动添加检查项" /><button class="btn secondary" type="button" data-action="checklist-add" data-id="${escapeHtml(p.id)}">添加</button><button class="btn secondary" type="button" data-action="checklist-generate" data-id="${escapeHtml(p.id)}">从 AI 结果生成清单</button></div>` +
      `</div></div></div>`
    );
  };

  /** v0.4.5：列表 cell 右侧倒计时 pill —— 短文案 + 紧急度 class（60s 刷新只更新文字）
   *  v0.35.0：有时刻的开标精确到小时（“3小时后”“今天 09:30”），逻辑收进 utils.getCountdownInfo（可单测）。 */
  const countdownCell = (proj) => {
    const info = getCountdownInfo(proj);
    return { text: info.text, cls: info.cls, title: info.title };
  };

  /** v0.4.5：状态圆点 class（徽章已移到详情区） */
  const statusDotClass = (status) =>
    status === "已开标" ? "sd-done" : status === "制作中" ? "sd-warn" : "sd-info";

  /** v0.4.5：M月d日（去掉年份，给 cell 第二行用） */
  const shortDateDisplay = (value) =>
    value ? formatDateDisplay(value).replace(/^\d+年/, "") : "";

  /** v0.4.1：两段式项目卡片 —— 头部（始终显示）+ 详情区（默认折叠）。展开态由 state.expandedIds 维护，render 后恢复。 */
  // v0.30.0：详情懒生成 —— 之前每次渲染都给每张卡片全量拼详情 HTML（含风险卡与清单），
  // 折叠着的卡片根本看不见，白白花钱。只给已展开的卡片生成；折叠卡片展开时由
  // fillProjectDetails 补填一次。
  const buildDetailsHtml = (p) => {
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
      const kv = (label, valueHtml, cls = "") =>
        `<div class="kv-row${cls ? ` ${cls}` : ""}"><span class="kv-label">${label}</span><span class="kv-value">${valueHtml}</span></div>`;
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
      // v0.35.0：项目状态改成可点即改的三选一（不用再展开表单、滚到状态下拉、再保存）；
      // 开标时间带出时刻；中标结果有值时才占一行。
      const STATUS_OPTIONS = ["报名中", "制作中", "已开标"];
      const statusQuick =
        `<span class="status-quick" role="group" aria-label="修改项目状态">` +
        STATUS_OPTIONS.map(
          (s) =>
            `<button type="button" class="status-chip${s === p.status ? " active" : ""}" data-action="set-status" data-id="${escapeHtml(p.id)}" data-status="${s}" aria-pressed="${s === p.status ? "true" : "false"}" title="改为${s}">${s}</button>`
        ).join("") +
        `</span>`;
      const resultVal = p.result
        ? `<span class="badge ${p.result === "已中标" ? "success" : "danger"}">${escapeHtml(p.result)}</span>`
        : "待定";
      return (
        `<div class="kv-list">` +
        kv("开标时间", p.date ? escapeHtml(formatBidMoment(p)) : "未设置", "kv-row-time") +
        kv("项目类型", escapeHtml(p.type || "-"), "kv-row-type") +
        kv("投标公司", escapeHtml(p.biddingCompany || "-"), "kv-row-company") +
        kv("项目名称", escapeHtml(p.name), "kv-row-name") +
        kv("联系人", escapeHtml(p.contact || "-"), "kv-row-contact") +
        kv("中标结果", resultVal, "kv-row-result") +
        kv("备注", escapeHtml(p.notes || "—"), "kv-row-note") +
        `</div>` +
        (deadlineRows ? `<div class="kv-list">${deadlineRows}</div>` : "") +
        deadlineHtml +
        renderRiskCard(p) +
        renderChecklist(p) +
        pdfHtml);
  };

  // v0.30.0：展开时补填详情（折叠卡片渲染时详情区是空的）。
  const fillProjectDetails = (itemEl, project) => {
    const inner = itemEl?.querySelector(".project-details .collapse-inner");
    if (!inner || !project) return;
    if (inner.innerHTML.trim()) return; // 已填过
    inner.innerHTML = buildDetailsHtml(project);
  };

  const renderProjectItem = (p, i) => {
    const expandedIds = getState().expandedIds;
    const expanded = expandedIds && expandedIds.has(p.id);
    // v0.30.0：折叠卡片不生成详情 HTML，展开时再由 fillProjectDetails 补填。
    const detailsHtml = expanded ? buildDetailsHtml(p) : "";
    const cd = countdownCell(p);
    const dateShort = shortDateDisplay(p.date);
    // v0.35.6：手机端元信息行只剩「日期开标 · 类型」，投标公司包在 .project-sub-company 里
    // 由手机端隐去——它原来总被截成「青海一建…」，省略号比不显示更难看；公司仍能在详情里看。
    const subLine = `${dateShort ? `${escapeHtml(dateShort)}开标` : "未设置开标时间"} · ${escapeHtml(
      p.type
    )}<span class="project-sub-company"> · ${escapeHtml(p.biddingCompany || "-")}</span>`;
    // v0.6.0：选择模式下行首显示 iOS 圆形复选框
    const st = getState();
    const selectMode = !!(st && st.selectMode);
    const checked = !!(st && st.selectedIds && st.selectedIds.has(p.id));
    const checkHtml = selectMode
      ? `<button class="select-check" type="button" role="checkbox" aria-checked="${checked ? "true" : "false"}" aria-label="选择项目" data-action="toggle-select" data-id="${escapeHtml(p.id)}"><svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true"><path d="M2.5 6.8 5.3 9.5 10.5 3.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`
      : "";
    return `<div class="project-item${expanded ? " expanded" : ""}" data-id="${escapeHtml(p.id)}" data-status="${escapeHtml(p.status || "")}" style="animation-delay:${Math.min(i * 12, 96)}ms"><div class="project-head" data-action="toggle-details" data-id="${escapeHtml(p.id)}" title="点击展开 / 收起详情">${checkHtml}<span class="status-dot ${statusDotClass(p.status)}" title="${escapeHtml(p.status)}"></span><div class="project-head-main"><div class="project-name">${escapeHtml(p.name)}</div><div class="project-sub">${subLine}</div></div><div class="project-head-right"><div class="project-head-top"><span class="countdown cd-pill ${cd.cls}" data-date="${escapeHtml(p.date)}" data-status="${escapeHtml(p.status)}" data-bid-time="${escapeHtml(p.bidTime || "")}" title="${escapeHtml(cd.title || "")}">${escapeHtml(cd.text)}</span><button class="project-chevron-btn" type="button" data-action="toggle-details" data-id="${escapeHtml(p.id)}" aria-expanded="${expanded ? "true" : "false"}" aria-label="${expanded ? "收起详情" : "展开详情"}"><span class="project-chevron" aria-hidden="true">›</span></button></div><div class="project-head-actions"><span class="status-quick status-quick-inline" role="group" aria-label="修改项目状态">${["报名中", "制作中", "已开标"].map((s) => `<button type="button" class="status-chip${s === p.status ? " active" : ""}" data-action="set-status" data-id="${escapeHtml(p.id)}" data-status="${s}" aria-pressed="${s === p.status ? "true" : "false"}">${s}</button>`).join("")}</span><button class="row-btn act-parse" type="button" data-action="parse" data-id="${escapeHtml(p.id)}">解析</button><button class="row-btn act-edit" type="button" data-action="edit" data-id="${escapeHtml(p.id)}">编辑</button><button class="row-btn act-clone" type="button" data-action="clone" data-id="${escapeHtml(p.id)}">复制</button><button class="row-btn act-del" type="button" data-action="delete" data-id="${escapeHtml(p.id)}">删除</button></div></div></div><div class="project-details collapse${expanded ? " expanded" : ""}"><div class="collapse-inner"${expanded ? "" : " inert"}>${detailsHtml}</div></div></div>`;
  };

  /** v0.6.0：列表到底趣味文案（按数量轮换） */
  const END_QUOTES = [
    "到底啦，共 {n} 个项目，去喝杯茶吧 🍵",
    "已经到底了，剩下的时间都是你的 ☕",
    "没有更多项目了，项目都在这儿啦 📋",
  ];

  // v0.31.0：空状态与末尾元素（加载更多 / 到底啦）的 HTML 抽出来，renderList 与
  // syncListDom 共用一份，免得两处文案各写各的、改了一处漏一处。
  const EMPTY_STATE_HTML =
    '<div class="empty-state"><div class="empty-icon">＋</div><div class="empty-title">还没有项目</div><div class="empty-sub">新增第一个项目，开始管理投标进度</div><button class="btn primary" type="button" data-action="empty-add">新增第一个项目</button></div>';
  // v0.35.0：搜/筛无结果时不再说“还没有项目”（上方计数还写着“筛选结果 0 个”，两句对不上）；
  // 有关键词或筛选时给一句“没有匹配的项目”与一键清除。
  const NO_MATCH_HTML =
    `<div class="empty-state"><div class="empty-icon">${svgIcon(ICON.search, "empty-ico")}</div><div class="empty-title">没有匹配的项目</div><div class="empty-sub">换个关键词，或清除搜索与筛选条件</div><button class="btn secondary" type="button" data-action="clear-filters">清除搜索与筛选</button></div>`;
  const emptyStateHtml = (hasActiveFilter) =>
    emptyStateKind(hasActiveFilter) === "no-match" ? NO_MATCH_HTML : EMPTY_STATE_HTML;
  const listTailHtml = (filtered, visible, remaining) =>
    remaining > 0
      ? `<button class="btn secondary load-more-btn" type="button" data-action="load-more">加载更多（剩余 ${remaining} 条，已显示 ${visible.length} / 共 ${filtered.length} 条）</button>`
      : `<div class="list-end">—— ${escapeHtml(
          END_QUOTES[filtered.length % END_QUOTES.length].replace(
            "{n}",
            String(filtered.length)
          )
        )} ——</div>`;
  const htmlToElement = (html) => {
    const template = document.createElement("template");
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
  };

  const renderList = (projects, filters) => {
    const keyword = (filters.keyword || "").trim();
    const status = filters.status || "all";
    const hasActiveFilter =
      Boolean(keyword) || status !== "all" || (filters.result || "all") !== "all";
    const filtered = getFilteredProjects(projects, filters);
    updateFilterCount(filtered.length, projects.length, hasActiveFilter);
    // v0.6.0：选择模式下给容器加 selecting（隐藏行内操作按钮）
    if (elements.list)
      elements.list.classList.toggle(
        "selecting",
        !!(getState() && getState().selectMode)
      );

    if (!filtered.length) {
      elements.list.innerHTML = emptyStateHtml(hasActiveFilter);
      updateCollapseAllBtn();
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
      listTailHtml(filtered, visible, remaining);
    updateCollapseAllBtn();
  };

  // v0.35.6：有卡片展开时把浮动新增按钮收起来——它固定在右下角，展开的详情里
  // 「报名截止」那几行的日期正好被它压住（实测 390×844 盖住 44×44）。
  // 展开 / 收起走的是 toggleProjectDetails（只改 DOM，不全量重渲染），所以两边都要调它。
  const syncDetailOpenState = () => {
    if (!document.body) return;
    document.body.classList.toggle(
      "detail-open",
      Boolean(getState().expandedIds?.size)
    );
  };

  // v0.32.0：没有展开的卡片时“全部折叠”不可点。
  const updateCollapseAllBtn = () => {
    if (elements.collapseAllBtn) {
      elements.collapseAllBtn.disabled = !(getState().expandedIds?.size);
    }
    syncDetailOpenState();
  };

  // v0.31.0：列表增量同步 —— 按当前筛选 / 排序算出应显示的卡片，与 DOM 现有卡片逐个对账：
  // 缺失的插入、移位的挪过去、内容变了的重建（changedIds 内）、多余的移除；末尾的
  // “加载更多 / 到底啦”与筛选计数一并更新。新建与重建的卡片加 no-enter，不重播入场动画。
  const syncListDom = (changedIds = new Set()) => {
    const listEl = elements.list;
    if (!listEl) return;
    const state = getState();
    const filters = getCurrentFilters();
    const keyword = (filters.keyword || "").trim();
    const status = filters.status || "all";
    const hasActiveFilter =
      Boolean(keyword) || status !== "all" || (filters.result || "all") !== "all";
    const filtered = getFilteredProjects(state.projects, filters);
    updateFilterCount(filtered.length, state.projects.length, hasActiveFilter);
    listEl.classList.toggle("selecting", !!(state.selectMode));
    if (!filtered.length) {
      listEl.innerHTML = emptyStateHtml(hasActiveFilter);
      updateCollapseAllBtn();
      return;
    }
    const { visible, remaining } = paginateItems(
      filtered,
      state.listLimit || 50
    );
    const byId = new Map(visible.map((p) => [p.id, p]));
    // 1. 移除不在应显示范围内的卡片与旧的末尾元素（加载更多 / 到底啦 / 空状态）。
    listEl.querySelectorAll(".project-item").forEach((el) => {
      if (!byId.has(el.dataset.id)) el.remove();
    });
    listEl.querySelector(".load-more-btn, .list-end, .empty-state")?.remove();
    // 2. 记录焦点：若当前聚焦在待重建的卡片里，重建后把焦点还给同款按钮。
    const activeEl = document.activeElement;
    const activeCard = activeEl?.closest?.(".project-item");
    const activeCardId = activeCard?.dataset?.id;
    let focusAction = null;
    let focusIndex = null;
    if (activeCardId && changedIds.has(activeCardId)) {
      focusAction = activeEl.dataset?.action || null;
      focusIndex =
        activeEl.dataset?.index ?? activeEl.dataset?.itemId ?? null;
    }
    // 3. 倒序走一遍：存在则（变了就重建、位置不对就挪），缺失则新建插入。
    //    倒序 + insertBefore(anchor) 保证最终顺序与 desired 一致。
    let anchor = null;
    for (let i = visible.length - 1; i >= 0; i--) {
      const p = visible[i];
      let el = listEl.querySelector(
        `.project-item[data-id="${CSS.escape(p.id)}"]`
      );
      if (el) {
        if (changedIds.has(p.id)) {
          const replacement = htmlToElement(renderProjectItem(p, i));
          replacement.classList.add("no-enter");
          el.replaceWith(replacement);
          el = replacement;
          // v0.35.2：保存后的柔光放到一半时正好碰上 Realtime 回声重建 —— 接着放完，
          // 否则背景从柔光一下子回到透明，看着又是一下闪。
          resumeLocateGlow(el, p.id);
        }
        if (anchor) listEl.insertBefore(el, anchor);
        else listEl.appendChild(el);
      } else {
        el = htmlToElement(renderProjectItem(p, i));
        el.classList.add("no-enter");
        if (anchor) listEl.insertBefore(el, anchor);
        else listEl.appendChild(el);
      }
      anchor = el;
    }
    // 4. 末尾元素（加载更多 / 到底啦）。
    listEl.appendChild(
      htmlToElement(listTailHtml(filtered, visible, remaining))
    );
    updateCollapseAllBtn();
    // 5. 焦点恢复。
    if (focusAction && activeCardId) {
      const newCard = listEl.querySelector(
        `.project-item[data-id="${CSS.escape(activeCardId)}"]`
      );
      const sel =
        focusIndex !== null && focusIndex !== undefined
          ? `[data-action="${focusAction}"][data-index="${focusIndex}"], [data-action="${focusAction}"][data-item-id="${focusIndex}"]`
          : `[data-action="${focusAction}"]`;
      newCard?.querySelector(sel)?.focus();
    }
  };

  // v0.31.0：写后定向渲染 —— 只刷新统计、即将开标、截止提醒、保证金清单、日历（可见时）
  // 与列表（增量同步 DOM），不再全量重建整个页面。
  // v0.36.2：蓝图指挥舱英雄区（最近一场开标 + 秒级定时器生命周期）
  let heroTimerId = null;
  let heroTargetMs = 0;
  let heroProjectId = null;

  const stopHeroTimer = () => {
    if (heroTimerId) {
      clearInterval(heroTimerId);
      heroTimerId = null;
    }
  };

  const isHeroVisibleContext = () => {
    if (typeof document === "undefined") return false;
    if (document.hidden) return false;
    const s = getState();
    if (s.viewMode === "calendar") return false;
    if (elements.dashboardView?.classList.contains("hidden")) return false;
    return true;
  };

  const tickHero = () => {
    const countEl = elements.bpHeroCount;
    if (!countEl || !heroTargetMs) return;
    const diff = heroTargetMs - Date.now();
    if (diff <= 0) {
      countEl.textContent = "已开标";
      stopHeroTimer();
      renderHero();
      return;
    }
    countEl.textContent = formatHeroCountdown(diff);
  };

  const startHeroTimer = () => {
    stopHeroTimer();
    if (!heroTargetMs || !isHeroVisibleContext()) return;
    heroTimerId = setInterval(tickHero, 1000);
  };

  const renderHero = () => {
    const hero = elements.bpHero;
    if (!hero) return;
    const s = getState();
    const next = getNextHeroBid(s.projects, new Date());
    hero.hidden = false;
    if (!next) {
      stopHeroTimer();
      heroTargetMs = 0;
      heroProjectId = null;
      hero.classList.add("is-empty");
      hero.classList.remove("is-urgent");
      if (elements.bpHeroLabel) elements.bpHeroLabel.textContent = "最近一场开标";
      if (elements.bpHeroBadge) {
        elements.bpHeroBadge.hidden = true;
        elements.bpHeroBadge.textContent = "";
      }
      if (elements.bpHeroName) {
        elements.bpHeroName.textContent = "暂无待开标项目";
        elements.bpHeroName.removeAttribute("data-project-id");
      }
      if (elements.bpHeroTime) {
        elements.bpHeroTime.textContent = "新增未开标项目即开启实时倒计时";
      }
      if (elements.bpHeroAction) elements.bpHeroAction.hidden = true;
      if (elements.bpHeroCount) elements.bpHeroCount.textContent = "";
      return;
    }
    hero.classList.remove("is-empty");
    heroTargetMs = next.target.getTime();
    heroProjectId = next.project.id;
    const isUrgent = next.diffMs < 86400000;
    hero.classList.toggle("is-urgent", isUrgent);
    if (elements.bpHeroLabel) elements.bpHeroLabel.textContent = "最近一场开标";
    if (elements.bpHeroBadge) {
      const badgeText = isUrgent ? "24小时内" : (next.project.status || "");
      elements.bpHeroBadge.hidden = !badgeText;
      elements.bpHeroBadge.textContent = badgeText;
    }
    if (elements.bpHeroName) {
      elements.bpHeroName.textContent = next.project.name || "未命名项目";
      elements.bpHeroName.dataset.projectId = String(next.project.id);
    }
    if (elements.bpHeroTime) {
      elements.bpHeroTime.textContent = `${formatBidMoment(next.project)} 开标`;
    }
    if (elements.bpHeroAction) elements.bpHeroAction.hidden = false;
    if (elements.bpHeroCount) {
      elements.bpHeroCount.textContent = formatHeroCountdown(heroTargetMs - Date.now());
    }
    startHeroTimer();
  };

    const renderAfterWrite = ({ changedIds = [] } = {}) => {
    const state = getState();
    renderStats(state.projects);
    renderUpcomingList(state.projects);
    renderDeadlineTip(state.projects);
    renderRefundReminder(state.projects);
    renderHero();
    renderGuaranteeList(state.projects);
    syncListDom(new Set(changedIds));
    if (!elements.calendarView?.classList.contains("hidden")) {
      renderCalendar(state.projects, getCurrentFilters());
    }
  };


  /**
   * 定位到项目列表中的某一项并展开（v0.4.1）。
   * v0.35.2：去掉定位后那 2 秒背景闪烁（用户反馈像闪屏）。位置改由“平滑滚动 + 展开详情”
   * 说明，不再往卡片上挂会亮的类；只有保存完成那一次传 `glow: true`，放一层一次性的柔光
   * （见 styles.css 的 .project-item.save-glow，prefers-reduced-motion 下不播）。
   * v0.27.0：连续点两个项目时，旧的定时器会把新的提示提前摘掉——先清掉再排新的。
   */
  let locateTimers = [];
  // 柔光时间线与 styles.css 的 .save-glow 动画时长保持同步。
  const LOCATE_GLOW_DELAY_MS = 260;
  const LOCATE_GLOW_DURATION_MS = 1400;
  // 柔光正在放的那张卡片（Realtime 回声重建节点时靠它把动画接着放完，见 resumeLocateGlow）。
  let glowTarget = null;

  const locateNode = (projectId) =>
    elements.list?.querySelector(
      `.project-item[data-id="${CSS.escape(String(projectId))}"]`
    );

  /** v0.35.2：卡片被重建时把还没放完的柔光接上（负延迟 = 从当前进度继续）。 */
  const resumeLocateGlow = (node, projectId) => {
    if (!glowTarget || glowTarget.id !== String(projectId)) return;
    const elapsed = Date.now() - glowTarget.startedAt;
    if (elapsed >= LOCATE_GLOW_DURATION_MS) {
      glowTarget = null;
      return;
    }
    node.style.animationDelay = `-${elapsed}ms`;
    node.classList.add("save-glow");
  };

  const focusProjectInList = (projectId, { glow = false } = {}) => {
    if (!projectId) return;
    // v0.37.0：若当前停在日历视图，先自动切回列表视图再定位展开，避免“点了没反应”
    const sView = getState();
    if (sView.viewMode === "calendar" && typeof sView.setViewMode === "function") {
      sView.setViewMode("list");
    }
    locateTimers.forEach(clearTimeout);
    locateTimers = [];
    glowTarget = null; // 新的定位作废上一张卡片的柔光（旧节点上的类下轮渲染自然消失）
    // v0.30.0：只有目标项目在当前搜索 / 筛选中不可见时才清搜索与筛选（之前不管
    // 可见与否都清空，搜了一半的字就这么没了）；清的时候说一声，不再静默。
    const visible = getCurrentFilteredProjects();
    if (!visible.some((p) => p.id === projectId)) {
      const hadSearch = (elements.search?.value || "").trim() !== "";
      if (elements.search) elements.search.value = "";
      if (elements.statusFilter) elements.statusFilter.value = "all";
      if (elements.resultFilter) elements.resultFilter.value = "all";
      // v0.5.0：seg 同步（app.js 在 state 上挂了 syncSegControl）
      const s0 = getState();
      if (typeof s0.syncSegControl === "function") s0.syncSegControl();
      if (hadSearch) showToast("已清除搜索与筛选以定位该项目。");
    }
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
    // v0.31.0：定位也走定向渲染（只动目标卡片），不再全量重建整个列表。
    renderAfterWrite({ changedIds: [projectId] });
    const item = elements.list?.querySelector(
      `.project-item[data-id="${CSS.escape(String(projectId))}"]`
    );
    if (!item) {
      showToast("列表中没有该项目。");
      return;
    }
    item.scrollIntoView({ behavior: "smooth", block: "center" });
    // v0.29.0：定位残留闪的根因——render() 后目标卡片会重播入场动画（淡入 + 上移），
    // 与滚动三重叠加看着像闪。定位时跳过这次入场动画。
    item.classList.add("no-enter");
    if (glow) {
      // 等滚动起步（260ms）再挂柔光，免得和滚动的第一帧抢眼睛。
      locateTimers = [
        setTimeout(() => {
          const node = locateNode(projectId);
          if (!node) return;
          glowTarget = { id: String(projectId), startedAt: Date.now() };
          node.classList.add("save-glow");
        }, LOCATE_GLOW_DELAY_MS),
        setTimeout(() => {
          if (glowTarget && glowTarget.id === String(projectId)) glowTarget = null;
          const node = locateNode(projectId);
          node?.classList.remove("save-glow");
          node?.classList.remove("no-enter");
          if (node) node.style.animationDelay = "";
        }, LOCATE_GLOW_DELAY_MS + LOCATE_GLOW_DURATION_MS),
      ];
    } else {
      locateTimers = [
        setTimeout(() => locateNode(projectId)?.classList.remove("no-enter"), 600),
      ];
    }
  };

  /** 仅更新倒计时文字，避免每分钟全量 render */
  const updateCountdowns = () => {
    elements.list
      ?.querySelectorAll(".countdown[data-date]")
      .forEach((el) => {
        // v0.30.0：每分钟刷新时只改了文字、没改颜色 class —— 跨过“今天开标”
        // 的临界点后文字对了、颜色还停在昨天。一起更新。
        const cd = countdownCell({
          date: el.dataset.date,
          status: el.dataset.status,
          bidTime: el.dataset.bidTime || "",
        });
        el.textContent = cd.text;
        el.classList.remove(
          "cd-done",
          "cd-overdue",
          "cd-urgent",
          "cd-warn",
          "cd-normal"
        );
        el.classList.add(cd.cls);
      });
  };

  const renderTrashList = (deletedProjects) => {
    if (!elements.trashList) return;
    if (!deletedProjects?.length) {
      elements.trashList.innerHTML = '<div class="empty">回收站为空。</div>';
      return;
    }
    // v0.30.0：回收站分页 —— 之前全量渲染，删多了抽屉一次吐几百行；
    // 与主列表同款 50 条一页，点“加载更多”再续。
    const limit = getState().trashLimit ?? 50;
    const shown = deletedProjects.slice(0, limit);
    const rest = deletedProjects.length - shown.length;
    elements.trashList.innerHTML =
      shown
        .map(
          (p) => {
            const deletedDate = p.deletedAt
              ? formatDateDisplay(String(p.deletedAt).slice(0, 10))
              : "未知";
            // v0.35.0：30 天保留期是回收站唯一的卖点，给每行一个倒计时；剩 3 天内标红。
            const left = getTrashRemainingDays(p.deletedAt);
            const leftText =
              left === null
                ? ""
                : left <= 0
                  ? `<span class="trash-expire urgent">今天将彻底删除</span>`
                  : `<span class="trash-expire${left <= 3 ? " urgent" : ""}">还剩 ${left} 天自动删除</span>`;
            return `<div class="project-item"><div class="trash-head"><div class="project-head-main"><div class="project-name">${escapeHtml(p.name)}</div><div class="project-sub">开标：${escapeHtml(formatDateDisplay(p.date))} · ${escapeHtml(p.biddingCompany || "-")} · 删除于${escapeHtml(deletedDate)}${leftText}</div></div><div class="trash-actions"><button class="btn tint-blue" type="button" data-action="restore" data-id="${escapeHtml(p.id)}">恢复</button><button class="btn tint-red" type="button" data-action="permanent-delete" data-id="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name)}">彻底删除</button></div></div></div>`;
          }
        )
        .join("") +
      (rest > 0
        ? `<button class="btn secondary btn-block" type="button" data-action="trash-load-more">加载更多（还剩 ${rest} 条）</button>`
        : "");
  };

  const getCurrentFilters = () => ({
    keyword: elements.search?.value || "",
    status: elements.statusFilter?.value || "all",
    result: elements.resultFilter?.value || "all",
    sort: elements.sortBy?.value || "date-desc",
  });

  // 导出用：返回当前搜索/筛选/排序后的项目，而非全量。
  // v0.30.0：焦点陷阱 —— 抽屉 / 确认框打开时 Tab 只在层内循环，不跑到背后页面去。
  // 栈式：确认框可能盖在抽屉上，关掉确认框后陷阱回到下面的抽屉。
  const focusTrapStack = [];
  const FOCUSABLE_SELECTOR =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const onTrapTab = (event) => {
    if (event.key !== "Tab") return;
    const top = focusTrapStack[focusTrapStack.length - 1];
    if (!top) return;
    const els = [...top.querySelectorAll(FOCUSABLE_SELECTOR)].filter(
      (el) => el.getClientRects().length > 0
    );
    if (!els.length) return;
    const first = els[0];
    const last = els[els.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  const trapFocusIn = (el) => {
    if (!el) return;
    focusTrapStack.push(el);
    document.addEventListener("keydown", onTrapTab);
  };
  const releaseFocusTrap = (el) => {
    const i = el
      ? focusTrapStack.lastIndexOf(el)
      : focusTrapStack.length - 1;
    if (i >= 0) focusTrapStack.splice(i, 1);
    if (!focusTrapStack.length)
      document.removeEventListener("keydown", onTrapTab);
  };

  const getCurrentFilteredProjects = () =>
    getFilteredProjects(getState().projects, getCurrentFilters());

  /** v0.8.0：开标日历 —— 月历网格（周一起始）+ 当天项目。v0.35.0：搜索关键词也生效（之前能输入却不理）。 */
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
    const keyword = (filters?.keyword || "").trim().toLowerCase();
    const result = filters?.result || "all";
    // 状态 / 结果筛选 + 关键词过滤后的未删除项目（state.projects 本身已排除回收站）
    const visible = (Array.isArray(projects) ? projects : []).filter(
      (p) =>
        (status === "all" || p.status === status) &&
        matchResult(p, result) &&
        matchesKeyword(p, keyword)
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
    // v0.35.0：抽屉头部给一行合计（统计卡只有全站在途总额，对账时要看这份清单的合计）。
    if (elements.guaranteeTotals) {
      if (!list.length) {
        elements.guaranteeTotals.textContent = "";
        elements.guaranteeTotals.classList.add("hidden");
      } else {
        const total = list.reduce((sum, p) => {
          const n = Number(p.guaranteeAmount);
          if (!Number.isFinite(n)) return sum;
          return sum + (p.guaranteeUnit === "元" ? n / 10000 : n);
        }, 0);
        elements.guaranteeTotals.textContent = `待退还合计 ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 万元（${list.length} 项）`;
        elements.guaranteeTotals.classList.remove("hidden");
      }
    }
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
    renderHero();
    renderGuaranteeList(state.projects);
    // v0.35.3：日历视图隐藏时不重建网格 —— 项目一多，每次 render 都白算一遍 DOM 字符串
    // （切到日历视图时 setViewMode 先摘 hidden 再 render，不影响正常显示）。
    if (!elements.calendarView?.classList.contains("hidden")) {
      renderCalendar(state.projects, filters);
    }
  };

  // v0.29.0：我的资质列表 —— 按类别分组；过期 / 90 天内到期标出来（日期只比 YYYY-MM-DD 字符串，不碰时区）。
  const QUAL_CATEGORY_ORDER = ["施工资质", "安全生产", "注册人员", "业绩", "其他"];
  const renderQualList = (qualifications) => {
    const el = elements.qualList;
    if (!el) return;
    const list = Array.isArray(qualifications) ? qualifications : [];
    const countEl = elements.qualCount;
    if (countEl) countEl.textContent = list.length ? `（共 ${list.length} 条）` : "";
    if (!list.length) {
      el.innerHTML = `<div class="qual-empty">还没有录入资质。在上方添加一条，AI 分析招标文件时会自动对照。</div>`;
      return;
    }
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const daysUntil = (d) => {
      if (!d) return null;
      const t = new Date(`${d}T00:00:00`).getTime();
      const base = new Date(`${today}T00:00:00`).getTime();
      if (!Number.isFinite(t)) return null;
      return Math.ceil((t - base) / 86400000);
    };
    el.innerHTML = QUAL_CATEGORY_ORDER.map((cat) => {
      const rows = list.filter((q) => q.category === cat);
      if (!rows.length) return "";
      return `<div class="qual-group"><div class="qual-group-title">${escapeHtml(cat)}（${rows.length}）</div>${rows
        .map((q) => {
          const days = daysUntil(q.expires_at);
          const expiryTag =
            days !== null && days < 0
              ? `<span class="qual-expired">已过期</span>`
              : days !== null && days <= 90
                ? `<span class="qual-expiring">${days === 0 ? "今日到期" : `${days} 天后到期`}</span>`
                : "";
          const sub = [q.details, q.expires_at ? `有效期至 ${formatDateDisplay(q.expires_at)}` : ""]
            .filter(Boolean)
            .join(" · ");
          return `<div class="qual-row"><div class="qual-main"><div class="qual-name">${escapeHtml(q.name)}${expiryTag}</div>${sub ? `<div class="qual-sub">${escapeHtml(sub)}</div>` : ""}</div><span class="qual-actions"><button class="btn secondary" type="button" data-action="qual-edit" data-id="${escapeHtml(q.id)}">编辑</button><button class="btn secondary" type="button" data-action="qual-delete" data-id="${escapeHtml(q.id)}">删除</button></span></div>`;
        })
        .join("")}</div>`;
    }).join("");
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
    // v0.35.5：手机端「＋」同上——页顶用页头的「＋」，滚下去才现浮动新增
    elements.backToTopBtn?.classList.toggle("visible", scrollY > 200);
    elements.goToBottomBtn?.classList.toggle("visible", max - scrollY > 200 && scrollY > 200);
    elements.fabAdd?.classList.toggle("visible", scrollY > 200);
  };

  // v0.35.3：addRipple 已删 —— 它从导出后一直没人调用，配套的 .ripple / @keyframes ripple
  // 也是死代码（按钮的触感由已有的 :active 缩放给）。


  // v0.35.0：关浮层后的焦点归还 —— 入口按钮在菜单里、菜单已收起（display:none）时
  // focus() 会落到 body；能看见就回原按钮，否则回 ☰。与 closeSettingsSheet 同一套逻辑，抽出来一处维护。
  const restoreFocusTo = (opener) => {
    if (opener && document.contains(opener) && opener.getClientRects().length) {
      opener.focus?.();
      return;
    }
    elements.menuToggle?.focus();
  };

  const toggleMobileMenu = (force) => {
    const menu = document.getElementById("headerMenu");
    const btn = document.getElementById("menuToggle");
    if (!menu) return;
    const open = force ?? !menu.classList.contains("open");
    menu.classList.toggle("open", open);
    // v0.35.5：菜单展开时收起浮动按钮 —— 它们原本压在菜单底部条目上（「日历订阅」「设置」「退出」）
    document.body.classList.toggle("menu-open", open);
    btn?.setAttribute("aria-expanded", open ? "true" : "false");
  };

  // v0.10.0：自定义确认框 —— 替代原生 confirm()；返回 Promise<boolean>。
  // 默认焦点在取消按钮上，避免回车误触；新调用到来时旧调用按取消处理。
  // 监听全部用属性赋值（每次覆盖），不叠加、不误关新框。
  // v0.35.0：传入 altText 时变成三出口，返回 " confirm" | "alt" | "cancel"（字符串）。
  // 适合“覆盖 / 只补新增 / 取消”这类必须能说“不”的场景：以前取消按钮写着
  // “只补新增”，Esc 与点遮罩也回 false，而 false 又被当成“只补新增”照旧写库。
  let pendingConfirmCancel = null;
  // v0.32.0：requireTyping —— 危险操作的打字确认：输入框须与指定短语一致
  // （前后空格忽略）才启用确认按钮；不传则保持原样。
  const confirmDialog = ({
    title = "请确认",
    message = "",
    confirmText = "确定",
    cancelText = "取消",
    altText = "",
    danger = false,
    requireTyping = "",
  } = {}) => {
    const dialog = elements.confirmDialog;
    if (!dialog) return Promise.resolve(window.confirm(message));
    if (pendingConfirmCancel) {
      const cancelPrevious = pendingConfirmCancel;
      pendingConfirmCancel = null;
      cancelPrevious();
    }
    const threeWay = Boolean(altText);
    return new Promise((resolve) => {
      if (elements.confirmDialogTitle) elements.confirmDialogTitle.textContent = title;
      if (elements.confirmDialogMessage) elements.confirmDialogMessage.textContent = message;
      if (elements.confirmDialogCancel) elements.confirmDialogCancel.textContent = cancelText;
      const okBtn = elements.confirmDialogOk;
      const altBtn = elements.confirmDialogAlt;
      const typingInput = elements.confirmDialogInput;
      if (okBtn) {
        okBtn.textContent = confirmText;
        okBtn.className = danger ? "btn danger-solid" : "btn primary";
      }
      if (altBtn) {
        altBtn.textContent = altText;
        altBtn.classList.toggle("hidden", !threeWay);
      }
      elements.confirmDialogActions?.classList.toggle("three", threeWay);
      // 打字确认：显示输入区、确认按钮先禁用，输对短语才放行。
      if (requireTyping && elements.confirmDialogTyping) {
        if (elements.confirmDialogPhrase)
          elements.confirmDialogPhrase.textContent = requireTyping;
        elements.confirmDialogTyping.classList.remove("hidden");
        if (typingInput) {
          typingInput.value = "";
          typingInput.oninput = () => {
            if (okBtn) okBtn.disabled = typingInput.value.trim() !== requireTyping;
          };
        }
        if (okBtn) okBtn.disabled = true;
      }
      const cleanup = () => {
        pendingConfirmCancel = null;
        releaseFocusTrap(dialog);
        dialog.classList.add("hidden");
        // v0.34.0：确认框可能盖在抽屉 / 设置弹窗上 —— 下面还有打开的浮层时
        // 不能把滚动锁拿掉，否则背景页面会在遮罩下跟着滚。
        const layerBelow = [...document.querySelectorAll(".sheet")].some(
          (el) => el !== dialog && !el.classList.contains("hidden")
        );
        if (!layerBelow) document.body.classList.remove("sheet-open");
        dialog.onclick = null;
        if (okBtn) {
          okBtn.onclick = null;
          okBtn.disabled = false;
        }
        if (altBtn) {
          altBtn.onclick = null;
          altBtn.classList.add("hidden");
        }
        elements.confirmDialogActions?.classList.remove("three");
        if (typingInput) {
          typingInput.value = "";
          typingInput.oninput = null;
        }
        if (elements.confirmDialogTyping)
          elements.confirmDialogTyping.classList.add("hidden");
        if (elements.confirmDialogCancel) elements.confirmDialogCancel.onclick = null;
        document.removeEventListener("keydown", onKeyDown);
      };
      const finish = (value) => {
        cleanup();
        resolve(value);
      };
      const onKeyDown = (event) => {
        if (event.key === "Escape") finish(threeWay ? "cancel" : false);
      };
      pendingConfirmCancel = () => finish(threeWay ? "cancel" : false);
      dialog.classList.remove("hidden");
      document.body.classList.add("sheet-open");
      trapFocusIn(dialog);
      dialog.onclick = (event) => {
        if (event.target.closest("[data-action='cancel-confirm']"))
          finish(threeWay ? "cancel" : false);
      };
      if (okBtn) okBtn.onclick = () => finish(threeWay ? "confirm" : true);
      if (altBtn) altBtn.onclick = () => finish("alt");
      if (elements.confirmDialogCancel) {
        elements.confirmDialogCancel.onclick = () =>
          finish(threeWay ? "cancel" : false);
        // 打字确认时焦点给输入框（方便直接打字），否则默认给取消按钮防误触。
        if (requireTyping && typingInput) typingInput.focus();
        else elements.confirmDialogCancel.focus();
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
  /** v0.36.1：同步分段控件的滑动白底滑块（seg-thumb）；无布局环境（如单测）安全跳过。 */
  const syncSegThumbs = () => {
    if (typeof document === "undefined") return;
    document.querySelectorAll(".seg-control").forEach((ctrl) => {
      const active = ctrl.querySelector(".seg-btn.active");
      if (!active || !active.offsetWidth) {
        ctrl.classList.remove("has-thumb");
        return;
      }
      let thumb = ctrl.querySelector(":scope > .seg-thumb");
      if (!thumb) {
        thumb = document.createElement("span");
        thumb.className = "seg-thumb";
        thumb.setAttribute("aria-hidden", "true");
        ctrl.insertBefore(thumb, ctrl.firstChild);
      }
      thumb.style.width = `${active.offsetWidth}px`;
      thumb.style.transform = `translateX(${active.offsetLeft}px)`;
      ctrl.classList.add("has-thumb");
    });
  };

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
    renderAfterWrite,
    renderTrashList,
    renderQualList,
    getCurrentFilteredProjects,
    fillProjectDetails,
    syncDetailOpenState,
    trapFocusIn,
    releaseFocusTrap,
    updateCountdowns,
    highlightFormPanel,
    focusProjectInList,
    updateScrollUi,
    toggleMobileMenu,
    restoreFocusTo,
    confirmDialog,
    renderHero,
    stopHeroTimer,
    syncSegThumbs,
    showListSkeleton,
    showTrashSkeleton,
  };
}
