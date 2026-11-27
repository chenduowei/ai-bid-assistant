/** v0.55.0 JS 批 B6：轻震 —— navigator.vibrate 包一层。
 * iOS Safari 不支持 vibrate API（typeof 不是 function），静默返回 false，
 * 不报错、不影响操作；调用方只在关键操作处调（切 Tab / 提交成功 / 删除成功），
 * 不要每个按钮都震。pattern 默认 10ms 一记轻震。 */
export function vibrate(pattern = 10) {
  try {
    if (
      typeof navigator === "undefined" ||
      typeof navigator.vibrate !== "function"
    )
      return false;
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

/** v0.55.0 JS 批 A-C：顶栏日期 —— "11月25日 周二"（星期中文）。 */
export function formatHeaderDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const week = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日 ${week}`;
}

/** v0.55.0 JS 批 B12：键盘是否弹出 —— visualViewport 高度比窗口明显收缩
 * （默认阈值 150px，盖住顶栏折叠等小幅变化不误判）。纯函数，可单测。 */
export function isKeyboardOpen(innerHeight, viewportHeight, threshold = 150) {
  if (!Number.isFinite(innerHeight) || !Number.isFinite(viewportHeight))
    return false;
  return innerHeight - viewportHeight > threshold;
}

/** 通用工具函数 */

export const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const formatDateDisplay = (value) => {
  if (!value) return "未设置开标时间";
  const [year, month, day] = String(value).split("-");
  return year ? `${year}年${Number(month)}月${Number(day)}日` : value;
};

/* ================= 第 3 批：日历订阅令牌 ================= */

/** 日历订阅令牌有效期（天），与 supabase.sql 第 13 节的 180 天一致。 */
export const CALENDAR_TOKEN_TTL_DAYS = 180;

/** 令牌是否已过期。expiresAt 为空（第 13 节还没执行）时按未过期处理，不提前断掉旧订阅。 */
export function isCalendarTokenExpired(expiresAt, now = new Date()) {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return false;
  return expiry <= now;
}

/** timestamptz → “2027年5月6日 09:13”；非法或空返回 ""。 */
export function formatDateTimeDisplay(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export const getDaysUntilBid = (value) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${value}T00:00:00`);
  return Number.isNaN(target.getTime())
    ? null
    : Math.round((target - today) / 86400000);
};

/* ================= v0.35.0：精确开标时刻 / 中标结果 ================= */

/** "09:30" / "9:30" / "09:30:00" → "09:30"；非法或空返回 ""。 */
export function formatBidTime(value) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value ?? "").trim());
  if (!m) return "";
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return "";
  if (h < 0 || h > 23 || min < 0 || min > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** 项目开标的绝对时刻（日期 + 可选时刻）；日期缺失或非法返回 null。 */
export function getBidDateTime(project) {
  const date = String(project?.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const time = formatBidTime(project?.bidTime);
  const d = new Date(`${date}T${time || "00:00"}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "2026年11月19日 09:30"（无时刻时只显示日期）。 */
export function formatBidMoment(project) {
  const time = formatBidTime(project?.bidTime);
  const base = formatDateDisplay(String(project?.date || "").slice(0, 10));
  return time ? `${base} ${time}` : base;
}

/**
 * 列表倒计时（v0.35.0：有时刻时精确到小时）。
 * 返回 { text, cls, title }；cls 与 .cd-* 一一对应。
 * 只认项目自己的 date / bidTime / status，60s 刷新可只传这三个字段。
 */
export function getCountdownInfo(project, now = new Date()) {
  if (project?.status === "已开标") return { text: "已开标", cls: "cd-done", title: "" };
  const date = String(project?.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return { text: "已开标", cls: "cd-done", title: "" };
  const time = formatBidTime(project?.bidTime);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const dayStart = new Date(`${date}T00:00:00`);
  const days = Math.round((dayStart - today) / 86400000);
  const title = formatBidMoment(project);
  if (!time) {
    if (days < 0) return { text: `已过期${-days}天`, cls: "cd-overdue", title };
    if (days === 0) return { text: "今天开标", cls: "cd-urgent", title };
    if (days <= 3) return { text: `还有${days}天`, cls: "cd-warn", title };
    return { text: `还有${days}天`, cls: "cd-normal", title };
  }
  const target = new Date(`${date}T${time}:00`);
  const diffMs = target - now;
  const cls = days <= 0 ? "cd-urgent" : days <= 3 ? "cd-warn" : "cd-normal";
  if (diffMs < 0) {
    // 当天时刻已过但状态还没改：按“已开标时刻已过”提示，别显示“今天开标”。
    return { text: "已到开标时刻", cls: "cd-overdue", title };
  }
  const hours = Math.ceil(diffMs / 3600000);
  if (diffMs < 3600000) {
    const minutes = Math.max(1, Math.ceil(diffMs / 60000));
    return { text: `${minutes}分钟后`, cls, title };
  }
  if (hours < 24) return { text: `${hours}小时后`, cls, title };
  const wholeDays = Math.floor(diffMs / 86400000);
  return { text: `还有${wholeDays}天`, cls, title };
}

/** v0.36.2：蓝图指挥舱英雄区 —— 取最近一场未开标且尚未到开标时刻的项目。 */
export function getNextHeroBid(projects, now = new Date()) {
  if (!Array.isArray(projects)) return null;
  let best = null;
  for (const p of projects) {
    if (!p || p.deletedAt || p.status === "已开标") continue;
    const target = getBidDateTime(p);
    if (!target) continue;
    const diffMs = target.getTime() - now.getTime();
    if (diffMs <= 0) continue;
    if (!best || diffMs < best.diffMs) {
      best = { project: p, target, diffMs };
    }
  }
  return best;
}

/** v0.36.2：英雄区秒级倒计时格式（>=1天 "3天 07:12:45"，<1天 "07:12:45"）。 */
export function formatHeroCountdown(diffMs) {
  if (!Number.isFinite(diffMs) || diffMs <= 0) return "已开标";
  const totalSec = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const hms = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return days > 0 ? `${days}天 ${hms}` : hms;
}

/** 回收站剩余保留天数（保留 30 天）；deletedAt 非法返回 null。 */
export function getTrashRemainingDays(deletedAt, now = new Date()) {
  const t = new Date(String(deletedAt || "")).getTime();
  if (!Number.isFinite(t)) return null;
  const elapsed = Math.floor((now.getTime() - t) / 86400000);
  return Math.max(0, TRASH_RETENTION_DAYS - Math.max(0, elapsed));
}

/** 中标率：只看已出结果（已中标 / 未中标）的项目；无已出结果时 rate 为 null。 */
export function getWinRate(projects) {
  const list = Array.isArray(projects) ? projects : [];
  const won = list.filter((p) => p?.result === "已中标").length;
  const lost = list.filter((p) => p?.result === "未中标").length;
  const decided = won + lost;
  return {
    won,
    lost,
    decided,
    rate: decided ? Math.round((won / decided) * 1000) / 10 : null,
  };
}

/** 结果筛选：空 / "all" 不过滤，否则按 result 精确匹配（只认两种终态）。 */
export function matchResult(project, result) {
  if (!result || result === "all") return true;
  return (project?.result || "") === result;
}

export const TRASH_RETENTION_DAYS = 30;

export const THEME_KEY = "bid-assistant-theme";
export const LEGACY_STORAGE_KEY = "bid-assistant-projects";
export const REMINDER_DAYS_KEY = "bid-assistant-reminder-days";
export const UPCOMING_SEEN_KEY = "bid-assistant-upcoming-seen";

/**
 * v0.55.1：临期角标改通知语义 —— 只亮未看事项。事项签名 = 项目 id + 截止类型
 * + 截止日期；日期一改（改期）即视为新事项，角标重新出现；项目改名不算事项变化。
 */
export function upcomingItemSignature(item) {
  const pid = item?.project?.id ?? item?.projectId ?? "";
  return `${pid}|${item?.key ?? ""}|${item?.date ?? ""}`;
}

/** 读出已看签名集合（坏数据当空；storage 传 localStorage，测试传 Map 替身）。 */
export function readSeenUpcomingSignatures(storage) {
  try {
    const raw = storage?.getItem?.(UPCOMING_SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(
      Array.isArray(arr) ? arr.filter((s) => typeof s === "string") : []
    );
  } catch {
    return new Set();
  }
}

/**
 * 把当前这批临期事项记为已看。替换式存储（只留当前这批签名），不无限攒旧签名；
 * 存储失败不影响主流程。
 */
export function markUpcomingItemsSeen(storage, items) {
  try {
    const sigs = (Array.isArray(items) ? items : []).map(
      upcomingItemSignature
    );
    storage?.setItem?.(UPCOMING_SEEN_KEY, JSON.stringify(sigs));
  } catch {
    // 忽略
  }
}

/** 未看事项数 = 当前列表里签名不在已看集合中的条数。 */
export function countUnseenUpcoming(items, seen) {
  const set = seen instanceof Set ? seen : new Set();
  return (Array.isArray(items) ? items : []).filter(
    (item) => !set.has(upcomingItemSignature(item))
  ).length;
}
export const DEFAULT_REMINDER_DAYS = 7;
export const MIN_REMINDER_DAYS = 1;
export const MAX_REMINDER_DAYS = 30;

/** 读取可配置提醒窗口（天），非法值回退默认 7 */
export function getReminderDays() {
  const raw = localStorage.getItem(REMINDER_DAYS_KEY);
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < MIN_REMINDER_DAYS || n > MAX_REMINDER_DAYS) {
    return DEFAULT_REMINDER_DAYS;
  }
  return n;
}

/** 保存提醒天数，返回规范化后的值 */
export function setReminderDays(value) {
  const n = Number.parseInt(value, 10);
  const days =
    !Number.isFinite(n) || n < MIN_REMINDER_DAYS || n > MAX_REMINDER_DAYS
      ? DEFAULT_REMINDER_DAYS
      : n;
  localStorage.setItem(REMINDER_DAYS_KEY, String(days));
  return days;
}

/**
 * 错过提醒：已过开标时间但状态仍不是“已开标”的项目。
 * 浏览器通知只在页面打开时触发，关页期间错过的提醒只能在下次打开时补提示。
 * @param {Array} projects
 * @param {Date} [now] 便于测试注入时间
 * @param {number} [windowDays] 只看最近 N 天内过期的，避免旧数据一直刷屏
 */
export function getMissedBidProjects(projects, now = new Date(), windowDays = 7) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return (projects || []).filter((p) => {
    if (!p || p.status === "已开标" || !p.date) return false;
    const target = new Date(`${p.date}T00:00:00`);
    if (Number.isNaN(target.getTime())) return false;
    const days = Math.round((target - today) / 86400000);
    if (days === 0) {
      // v0.35.0：当天有时刻时，过了那个时刻才算错过（早上 8 点不该报 9:30 的标已错过）；
      // 没填时刻就不知道几点开标，按旧行为当天不算错过。
      if (!formatBidTime(p.bidTime)) return false;
      const at = getBidDateTime(p);
      return Boolean(at) && now.getTime() > at.getTime();
    }
    return days < 0 && days >= -windowDays;
  });
}

/** 回收站过期清理的截止时间：早于该时间的 deleted_at 应彻底删除 */
export function getTrashExpiryCutoff(now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() - TRASH_RETENTION_DAYS);
  return d;
}

/* ================= v0.3.0：废标检查清单 ================= */

const CHECKLIST_SOURCES = new Set(["ai-invalid", "ai-risk", "manual"]);

/**
 * 清洗检查清单：非数组返回 []；每项只保留 {id, text, done, source}；
 * id 须为非空字符串，text 去空格后为空则过滤、超过 500 字截断；
 * done 转布尔，source 非法则回退 manual；最多保留 100 项。
 */
export function normalizeChecklist(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const id = typeof raw.id === "string" ? raw.id.trim() : "";
    if (!id) continue;
    const text = String(raw.text ?? "").trim().slice(0, 500);
    if (!text) continue;
    out.push({
      id,
      text,
      done: Boolean(raw.done),
      source: CHECKLIST_SOURCES.has(raw.source) ? raw.source : "manual",
    });
    if (out.length >= 100) break;
  }
  return out;
}

const checklistItemText = (item) => {
  if (typeof item === "string") return item.trim();
  if (item && typeof item === "object")
    return String(item.text ?? "").trim();
  return "";
};

/** 检查清单进度：{done, total} */
export function getChecklistProgress(checklist) {
  const list = Array.isArray(checklist) ? checklist : [];
  return { done: list.filter((i) => i?.done).length, total: list.length };
}

/* ================= v0.35.7：卡片内分区的默认展开态 ================= */

/**
 * 卡片内分区的默认状态。废标检查清单默认收起——
 * 清单是逐项对照用的长列表（一项两三行），展开详情时先给一行进度，想看再点开。
 * 「谁默认收起」集中在这张表里，渲染与点击两处都读它，免得两边各记一套。
 * （第 4 批：风险与条款分区已随 AI 展示下线，risk 键一并移除。）
 */
export const SECTION_OPEN_BY_DEFAULT = { checklist: false };

const sectionKey = (id, section) => `${id}:${section}`;

/** 某个分区此刻是否展开。默认展开的记在 collapsedSections，默认收起的记在 expandedSections。 */
export function isSectionOpen(state, id, section) {
  const openByDefault = SECTION_OPEN_BY_DEFAULT[section] !== false;
  const key = sectionKey(id, section);
  return openByDefault
    ? !state?.collapsedSections?.has(key)
    : Boolean(state?.expandedSections?.has(key));
}

/** 取反并写回内存态，返回切换后的状态（true = 展开）。只有显式点过才记，刷新回到默认。 */
export function toggleSectionOpen(state, id, section) {
  const open = !isSectionOpen(state, id, section);
  const key = sectionKey(id, section);
  const openByDefault = SECTION_OPEN_BY_DEFAULT[section] !== false;
  const set = openByDefault ? state?.collapsedSections : state?.expandedSections;
  if (!set) return open;
  if (open === openByDefault) set.delete(key);
  else set.add(key);
  return open;
}

/* ================= v0.18.1：已保存文本的文件名与页数 ================= */

/**
 * 去掉文件名末尾的"（N 字）"后缀，可重复去（已污染的文件名可能连拼多次）。
 * 全角 / 半角括号都认；只去末尾，不动文件名中间的同类文字。
 * 用途：查看已保存文本时显示行会拼字数后缀，保存时又从该行反取文件名，
 * 每存一次多一个后缀 —— 取名与入库前都先过这一道，循环就断了。
 */
export function stripPdfFilenameSuffix(name) {
  let clean = String(name ?? "").trim();
  let prev = "";
  while (clean !== prev) {
    prev = clean;
    clean = clean.replace(/[（(]\s*\d+\s*字\s*[)）]\s*$/, "").trim();
  }
  return clean;
}

/**
 * 从已保存文本推算总页数：解析时每页以"【第 N 页】"标记开头，取最大页码。
 * 没有标记（旧文本或非解析来源）返回 0，调用方显示"未知"，不编造页数。
 */
export function countPdfPagesFromText(text) {
  if (!text) return 0;
  const re = /【第\s*(\d+)\s*页】/g;
  let max = 0;
  let m;
  while ((m = re.exec(String(text))) !== null) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

/* ================= v0.3.0：结构化金额 / 保证金 ================= */

/**
 * 金额格式化：空值返回 ""，否则数值 + 单位。
 * 数值用千分位、最多 2 位小数（如 10000 + 万元 → "10,000万元"）。
 */
export function formatMoney(value, unit) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  const formatted = n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${formatted}${unit || ""}`;
}

const toWanYuan = (amount, unit) => {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return unit === "元" ? n / 10000 : n;
};

const round2 = (n) => {
  const r = Math.round(n * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
};

/**
 * 保证金台账合计（均以万元为单位，保留 2 位小数）：
 * inTransit = paid = 已缴纳合计；refunded = 已退回合计；forfeited = 已没收合计。
 * 未缴纳不计入。金额按单位折算：元 ÷10000，万元 ×1。
 */
export function getGuaranteeTotals(projects) {
  const totals = { inTransit: 0, paid: 0, refunded: 0, forfeited: 0 };
  for (const p of Array.isArray(projects) ? projects : []) {
    if (p == null) continue;
    const wan = toWanYuan(p.guaranteeAmount, p.guaranteeUnit);
    if (p.guaranteeStatus === "已缴纳") totals.inTransit += wan;
    else if (p.guaranteeStatus === "已退回") totals.refunded += wan;
    else if (p.guaranteeStatus === "已没收") totals.forfeited += wan;
  }
  totals.paid = totals.inTransit;
  return {
    inTransit: round2(totals.inTransit),
    paid: round2(totals.paid),
    refunded: round2(totals.refunded),
    forfeited: round2(totals.forfeited),
  };
}

/* ================= v0.3.0：多截止时间 ================= */

export const DEADLINE_TYPES = [
  { key: "registration_deadline", label: "报名截止" },
  { key: "inquiry_deadline", label: "质疑截止" },
  { key: "clarification_deadline", label: "澄清截止" },
  { key: "guarantee_deadline", label: "保证金缴纳截止" },
  { key: "date", label: "开标时间" },
];

// v0.35.0：顺便修掉一个真 bug —— 界面项目用的是驼峰字段（registrationDeadline），
// 而这里只读了下划线字段，导致“即将到期事项”实际永远只有开标日一条。两种都认。
const DEADLINE_CAMEL = {
  registration_deadline: "registrationDeadline",
  inquiry_deadline: "inquiryDeadline",
  clarification_deadline: "clarificationDeadline",
  guarantee_deadline: "guaranteeDeadline",
};

/** 某项目的所有截止项（有日期且状态 != 已开标）：{key, label, date, days} */
export function getDeadlineItems(project) {
  if (!project || project.status === "已开标") return [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const items = [];
  for (const { key, label } of DEADLINE_TYPES) {
    const raw =
      key === "date"
        ? project.date
        : (project[key] ?? project[DEADLINE_CAMEL[key]]);
    if (!raw) continue;
    const date = String(raw).slice(0, 10);
    const target = new Date(`${date}T00:00:00`);
    if (Number.isNaN(target.getTime())) continue;
    items.push({
      key,
      label,
      date,
      // v0.35.0：开标时刻随开标项一起带出（面板 / 通知 / 日历用）。
      time: key === "date" ? formatBidTime(project.bidTime) : "",
      days: Math.round((target - today) / 86400000),
    });
  }
  return items;
}

/** 某项目未来最近的一个截止项（含今天，days>=0），无则 null */
export function getNextDeadline(project) {
  const upcoming = getDeadlineItems(project).filter((i) => i.days >= 0);
  upcoming.sort((a, b) => a.days - b.days || a.date.localeCompare(b.date));
  return upcoming[0] || null;
}

/**
 * 未来 maxDays 天内（含今天）的所有截止项，按 days 升序、再按 date 升序。
 * 元素：{project, key, label, date, days}
 */
export function getUpcomingDeadlines(projects, maxDays = getReminderDays()) {
  const windowDays = Number.isFinite(maxDays)
    ? maxDays
    : DEFAULT_REMINDER_DAYS;
  const out = [];
  for (const project of Array.isArray(projects) ? projects : []) {
    for (const item of getDeadlineItems(project)) {
      if (item.days < 0 || item.days > windowDays) continue;
      out.push({ project, ...item });
    }
  }
  out.sort((a, b) => a.days - b.days || a.date.localeCompare(b.date));
  return out;
}

/* ================= v0.4.0：防抖 / CSV 导入 / 保证金退还提醒 ================= */

/**
 * 防抖：连续调用只执行最后一次；返回的函数带 .cancel() 可取消待执行调用。
 */
export function debounce(fn, wait = 200) {
  let timer = null;
  const debounced = (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return debounced;
}

/**
 * 保证金退还提醒：已缴纳 + 已开标 + 开标日期 <= 今天 + 保证金金额 > 0 的项目，
 * 按开标日期升序。UI 项目用 p.date，DB 行用 p.bid_date，两者都兼容；
 * guaranteeAmount 可能是字符串，做 Number 转换。
 */
export function getGuaranteeRefundReminders(projects, now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const out = (Array.isArray(projects) ? projects : []).filter((p) => {
    if (!p || p.guaranteeStatus !== "已缴纳" || p.status !== "已开标") return false;
    const date = String(p.date || p.bid_date || "").slice(0, 10);
    if (!date || date > todayStr) return false;
    const amount = Number(p.guaranteeAmount);
    return Number.isFinite(amount) && amount > 0;
  });
  out.sort((a, b) =>
    String(a.date || a.bid_date || "").localeCompare(String(b.date || b.bid_date || ""))
  );
  return out;
}

/* ---------------- CSV 导入 ---------------- */

export const IMPORT_CSV_HEADERS = [
  "开标时间",
  "开标时刻",
  "项目类型",
  "投标公司",
  "联系人",
  "项目名称",
  "项目状态",
  "中标结果",
  "招标单位",
  "项目金额（数值）",
  "项目金额单位",
  "保证金金额",
  "保证金单位",
  "保证金状态",
  "报名截止",
  "质疑截止",
  "澄清截止",
  "保证金截止",
  "备注",
];

const IMPORT_HEADER_MAP = {
  开标时间: "bid_date",
  开标时刻: "bid_time",
  项目类型: "project_type",
  投标公司: "bidding_company",
  联系人: "contact",
  项目名称: "name",
  项目状态: "status",
  中标结果: "result",
  招标单位: "tenderer",
  "项目金额（数值）": "amount_value",
  项目金额单位: "amount_unit",
  保证金金额: "guarantee_amount",
  保证金单位: "guarantee_unit",
  保证金状态: "guarantee_status",
  报名截止: "registration_deadline",
  质疑截止: "inquiry_deadline",
  澄清截止: "clarification_deadline",
  保证金截止: "guarantee_deadline",
  保证金缴纳截止: "guarantee_deadline",
  保证金要求原文: "guarantee",
  项目金额原文: "amount",
  备注: "notes",
};

const IMPORT_STATUSES = new Set(["报名中", "制作中", "已开标"]);
const IMPORT_GUARANTEE_STATUSES = new Set(["未缴纳", "已缴纳", "已退回", "已没收"]);

/** 解析 CSV 文本为行数组（处理 BOM、引号内逗号/换行、"" 转义），每行带起始行号 */
function parseCsvRows(text) {
  const src = String(text ?? "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let rowStartLine = 1;
  let line = 1;
  let fieldStarted = false;
  const endField = () => {
    row.push(field);
    field = "";
    fieldStarted = false;
  };
  const endRow = () => {
    endField();
    rows.push({ cells: row, line: rowStartLine });
    row = [];
    rowStartLine = line + 1;
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === "\n") line++;
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      // 只有字段开头（且为空）的引号才进入引用模式，其余当普通字符
      if (!fieldStarted && field === "") {
        inQuotes = true;
        fieldStarted = true;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === ",") {
      endField();
      continue;
    }
    if (ch === "\r") {
      if (src[i + 1] === "\n") i++;
      endRow();
      line++;
      continue;
    }
    if (ch === "\n") {
      endRow();
      line++;
      continue;
    }
    field += ch;
    fieldStarted = true;
  }
  // 文件尾：有未闭合的字段/行则收尾（末尾换行已在 endRow 处理，不重复）
  if (inQuotes || field !== "" || fieldStarted || row.length > 0) {
    endRow();
  }
  return rows;
}

/** 校验并归一化日期单元格：接受 YYYY-MM-DD / YYYY/MM/DD / YYYY年M月D日，非法返回 "" */
function normalizeCsvDate(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const m = raw.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (!m) return "";
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return "";
  }
  return `${m[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeCsvNumber(value) {
  const raw = String(value ?? "").trim().replace(/,/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function csvCell(row, headerIndex, field) {
  const idx = headerIndex.get(field);
  if (idx === undefined) return "";
  return String(row.cells[idx] ?? "").trim();
}

/**
 * 解析导入 CSV：第一行为表头。
 * 返回 { rows, errors }：rows 为 DB 列形态的项目对象；errors 为 { line, reason }。
 * 必填缺失（项目名称 / 项目类型 / 投标公司 / 联系人 / 开标时间）的行进 errors，不导入。
 */
export function parseCsvProjects(text) {
  if (!text || !String(text).trim()) {
    return { rows: [], errors: [{ line: 1, reason: "文件为空或无有效内容" }] };
  }
  const parsed = parseCsvRows(text);
  if (!parsed.length) {
    return { rows: [], errors: [{ line: 1, reason: "文件为空或无有效内容" }] };
  }
  const headerIndex = new Map();
  parsed[0].cells.forEach((cell, i) => {
    const name = String(cell ?? "").trim();
    const field = IMPORT_HEADER_MAP[name];
    if (field && !headerIndex.has(field)) headerIndex.set(field, i);
  });
  if (!headerIndex.has("name")) {
    return {
      rows: [],
      errors: [{ line: 1, reason: "未识别到表头，请使用“下载导入模板”得到的模板" }],
    };
  }
  const rows = [];
  const errors = [];
  for (let r = 1; r < parsed.length; r++) {
    const { cells, line } = parsed[r];
    if (cells.every((c) => String(c ?? "").trim() === "")) continue;
    const get = (field) => csvCell(parsed[r], headerIndex, field);
    const name = get("name");
    const projectType = get("project_type");
    const biddingCompany = get("bidding_company");
    const contact = get("contact");
    const bidDate = normalizeCsvDate(get("bid_date"));
    const missing = [];
    if (!name) missing.push("项目名称");
    if (!projectType) missing.push("项目类型");
    if (!biddingCompany) missing.push("投标公司");
    if (!contact) missing.push("联系人");
    if (!bidDate) missing.push("开标时间（非法或为空）");
    if (missing.length) {
      errors.push({ line, reason: `缺少必填：${missing.join("、")}` });
      continue;
    }
    const amountUnit = get("amount_unit");
    const guaranteeUnit = get("guarantee_unit");
    const status = get("status");
    const guaranteeStatus = get("guarantee_status");
    rows.push({
      bid_date: bidDate,
      project_type: projectType,
      name,
      bidding_company: biddingCompany,
      tenderer: get("tenderer") || null,
      contact,
      guarantee: get("guarantee") || null,
      amount: get("amount") || null,
      amount_value: normalizeCsvNumber(get("amount_value")),
      amount_unit: amountUnit === "元" || amountUnit === "万元" ? amountUnit : "万元",
      guarantee_amount: normalizeCsvNumber(get("guarantee_amount")),
      guarantee_unit:
        guaranteeUnit === "元" || guaranteeUnit === "万元" ? guaranteeUnit : "万元",
      guarantee_status: IMPORT_GUARANTEE_STATUSES.has(guaranteeStatus)
        ? guaranteeStatus
        : "未缴纳",
      status: IMPORT_STATUSES.has(status) ? status : "报名中",
      notes: get("notes") || null,
      registration_deadline: normalizeCsvDate(get("registration_deadline")) || null,
      inquiry_deadline: normalizeCsvDate(get("inquiry_deadline")) || null,
      clarification_deadline: normalizeCsvDate(get("clarification_deadline")) || null,
      guarantee_deadline: normalizeCsvDate(get("guarantee_deadline")) || null,
    });
  }
  return { rows, errors };
}

const escapeCsvCell = (v) => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * v0.8.0：Excel 导入 —— 把 sheet 二维数组序列化为 CSV 文本，再走 parseCsvProjects。
 * 这样 Excel 与 CSV 共用同一套表头映射与校验逻辑（行号与表格行号 1:1 对应）。
 */
export function sheetRowsToCsv(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .map((row) =>
      (Array.isArray(row) ? row : [])
        .map((cell) => escapeCsvCell(cell ?? ""))
        .join(",")
    )
    .join("\n");
}

/** 导入模板 CSV（含 BOM 表头 + 1 行示例） */
export function buildImportCsvTemplate() {
  const example = [
    "2026-12-01",
    "09:30",
    "房建工程",
    "示例投标公司",
    "张三",
    "示例项目",
    "报名中",
    "",
    "示例招标单位",
    "500",
    "万元",
    "10",
    "万元",
    "未缴纳",
    "2026-11-01",
    "2026-11-10",
    "2026-11-15",
    "2026-11-20",
    "示例备注",
  ];
  return (
    "\uFEFF" +
    IMPORT_CSV_HEADERS.map(escapeCsvCell).join(",") +
    "\n" +
    example.map(escapeCsvCell).join(",") +
    "\n"
  );
}

// v0.29.0：表单草稿 —— 纯函数（可单测）。
export const FORM_DRAFT_KEY = "bid-assistant-form-draft";
export const FORM_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// 表单是否"空"：只看内容字段，状态/单位等默认值不算内容。
const FORM_DRAFT_CONTENT_FIELDS = [
  "bid_date", "project_type", "name", "bidding_company", "tenderer",
  "guarantee", "amount_value", "guarantee_amount",
  "registration_deadline", "inquiry_deadline",
  "clarification_deadline", "guarantee_deadline", "contact", "notes",
];
export function isFormDataEmpty(data) {
  if (!data || typeof data !== "object") return true;
  return FORM_DRAFT_CONTENT_FIELDS.every((k) => {
    const v = data[k];
    return v == null || String(v).trim() === "";
  });
}
// 草稿是否可用：结构完整、7 天内、editingId 与当前表单一致
// （新建对新建、编辑同一项目才算一致）；空草稿不可用。
export function isFormDraftUsable(draft, editingId, now = Date.now()) {
  if (!draft || typeof draft !== "object" || draft.v !== 1) return false;
  if (!draft.fields || typeof draft.fields !== "object") return false;
  if (!Number.isFinite(draft.savedAt)) return false;
  if (now - draft.savedAt > FORM_DRAFT_TTL_MS) return false;
  if (isFormDataEmpty(draft.fields) && !draft.aiResult) return false;
  return (draft.editingId ?? null) === (editingId ?? null);
}
// 草稿是否该丢弃：结构坏了或过期了（不管 editingId 对不对得上）。
export function isFormDraftStale(draft, now = Date.now()) {
  if (!draft || typeof draft !== "object" || draft.v !== 1) return true;
  if (!draft.fields || typeof draft.fields !== "object") return true;
  if (!Number.isFinite(draft.savedAt)) return true;
  return now - draft.savedAt > FORM_DRAFT_TTL_MS;
}

/* v0.35.0：草稿从「单份」改成按编辑对象存的 Map —— 跨项目切换时各自的输入不互相覆盖。 */
export const FORM_DRAFTS_KEY = "bid-assistant-form-drafts";

/** 草稿在 Map 里的键：编辑某项目用 id，新建用 "new"。 */
export function formDraftKey(editingId) {
  return editingId ? `id:${editingId}` : "new";
}

/** 读出草稿 Map（坏数据一律当空；旧版单份草稿自动搬进 Map）。storage 可传 localStorage 或测试替身。 */
export function readFormDrafts(storage) {
  const out = {};
  try {
    const raw = storage.getItem(FORM_DRAFTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        for (const [k, v] of Object.entries(parsed)) {
          if (v && typeof v === "object") out[k] = v;
        }
      }
    }
    // 旧版（v0.29.0–v0.34.0）只有一份草稿，键为 FORM_DRAFT_KEY；搬进来后删掉旧键。
    const legacyRaw = storage.getItem(FORM_DRAFT_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      if (legacy && typeof legacy === "object") {
        const key = formDraftKey(legacy.editingId ?? null);
        if (!out[key]) out[key] = legacy;
      }
      storage.removeItem(FORM_DRAFT_KEY);
    }
  } catch {
    // 隐私模式 / 脏数据：当作没有草稿。
  }
  return out;
}

/** 写入草稿 Map（失败静默，不影响填表）。 */
export function writeFormDrafts(storage, drafts) {
  try {
    const clean = {};
    for (const [k, v] of Object.entries(drafts || {})) {
      if (v && typeof v === "object") clean[k] = v;
    }
    if (!Object.keys(clean).length) {
      storage.removeItem(FORM_DRAFTS_KEY);
      return true;
    }
    storage.setItem(FORM_DRAFTS_KEY, JSON.stringify(clean));
    return true;
  } catch {
    return false;
  }
}

/** 取当前编辑对象可用的草稿：只认这个键、结构完整、7 天内、非空。 */
export function pickFormDraft(drafts, editingId, now = Date.now()) {
  const draft = drafts?.[formDraftKey(editingId)];
  if (!draft) return null;
  // editingId 已由键决定，这里只校验结构 / 有效期 / 非空。
  return isFormDraftUsable(draft, draft.editingId ?? null, now) ? draft : null;
}

/** 清掉过期 / 损坏的草稿，返回新 Map（不改原对象）。 */
export function pruneFormDrafts(drafts, now = Date.now()) {
  const out = {};
  for (const [k, v] of Object.entries(drafts || {})) {
    if (v && typeof v === "object" && !isFormDraftStale(v, now)) out[k] = v;
  }
  return out;
}

/* v0.35.0：按 key 串行的写队列（纯函数，可单测）——
 * 同一项目的两次整列回写不再并发：后一次在前一次返回后才发，且 patch 函数
 * 在前一次落地后的最新 state 上求值，不会用旧数组覆盖掉刚勾上的那一项。
 * 不同 key 互不阻塞；队列空了自动清理（不会无限攒 Promise）。 */
export function createKeyedQueue() {
  const tails = new Map();
  const run = (key, task) => {
    const prev = tails.get(key) || Promise.resolve();
    const next = prev.then(task, task);
    // 队列尾巴只用于排顺，吞掉异常免得一条失败卡死后面的写。
    const tail = next.then(
      () => {},
      () => {}
    );
    tails.set(key, tail);
    tail.then(() => {
      if (tails.get(key) === tail) tails.delete(key);
    });
    return next;
  };
  return { run, size: () => tails.size };
}

/** 列表空状态的种类：有搜索 / 筛选时是 "no-match"（没有匹配的项目），否则 "empty"（还没有项目）。
 * 纯决策函数（可单测）—— 之前两种情况都写“还没有项目”，搜错一个字就以为数据没了。 */
export function emptyStateKind(hasActiveFilter) {
  return hasActiveFilter ? "no-match" : "empty";
}

/** 恢复备份的三态决定："overwrite" | "insert-only" | "abort"（默认）。
 * 确认框返回值（"confirm" / "alt" / "cancel" / true / false / 空）统一翻译；
 * 任何看不懂的返回值都按 abort —— 宁可不写，也不把“点了取消”当成“只补新增”。 */
export function resolveRestoreDecision(choice) {
  if (choice === "overwrite" || choice === "insert-only" || choice === "abort")
    return choice;
  if (choice === "confirm" || choice === true) return "overwrite";
  if (choice === "alt") return "insert-only";
  return "abort";
}

// v0.28.0：导入去重 —— 按（项目名称 + 开标时间 + 投标公司）去重。
// 名称与公司去掉全部空白、转小写；日期取前 10 位（YYYY-MM-DD）。
// 中文名里的空格多半是手误（"甲 公司"即"甲公司"），去掉比保留更贴合去重本意。
// existing 为内存里的 UI 形态项目（name / date / biddingCompany），
// rows 为解析后的 DB 形态行（name / bid_date / bidding_company）。
// 返回 { fresh, duplicates }：fresh 为待导入行，duplicates 为跳过条数
// （库里已有的 + 文件内重复的都算）。
export function dedupeImportRows(rows, existing) {
  const norm = (v) =>
    String(v ?? "").replace(/\s+/g, "").toLowerCase();
  const keyOf = (name, date, company) =>
    `${norm(name)}|${String(date ?? "").slice(0, 10)}|${norm(company)}`;
  const seen = new Set(
    (Array.isArray(existing) ? existing : []).map((p) =>
      keyOf(p.name, p.date, p.biddingCompany)
    )
  );
  const fresh = [];
  let duplicates = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = keyOf(row.name, row.bid_date, row.bidding_company);
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    fresh.push(row);
  }
  return { fresh, duplicates };
}

/** 第 4 批：AI 遗留列（UI 已下线，库列由 supabase.sql 第 14 节删除）。
 * 导出备份与恢复写入时剥离这 5 列：新备份不再带 AI 结论；旧备份恢复时
 * 也不再把 AI 数据写回库（删列后写回会报错，剥离必须保留）。
 * checklist 与 pdf_text / pdf_filename / pdf_parsed_at 是活数据，不在这里。 */
export const AI_LEGACY_DB_COLUMNS = [
  "risk_summary",
  "risk_points",
  "qualification",
  "invalid_bid_clauses",
  "extracted_meta",
];
export function stripAiColumns(row) {
  if (!row || typeof row !== "object") return row;
  const out = { ...row };
  for (const col of AI_LEGACY_DB_COLUMNS) delete out[col];
  return out;
}

// v0.8.1：备份恢复 —— 纯函数（可单测），不碰数据库。
// 校验备份 JSON：必须是本应用的备份、projects 为数组、每行有 id、
// 且全部行属于当前登录账号（user_id 一致）；备份内重复 id 只留第一条。
// 第 3 批备份标识双认：旧标识 ai-bid-assistant（历史备份）与新标识
// bid-desk（包名改名后）均接受；导出仍写旧串（js/projects.js
// exportBackup），历史备份与新备份都能恢复。
const BACKUP_APP_IDS = ["ai-bid-assistant", "bid-desk"];
export function parseBackupPayload(text, uid) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return { ok: false, error: "文件不是有效的 JSON。" };
  }
  if (!payload || typeof payload !== "object" || !BACKUP_APP_IDS.includes(payload.app)) {
    return { ok: false, error: "这不是投标工作台的备份文件。" };
  }
  if (!Array.isArray(payload.projects)) {
    return { ok: false, error: "备份文件缺少项目数据。" };
  }
  const rows = [];
  const seen = new Set();
  let duplicates = 0;
  for (const row of payload.projects) {
    if (!row || typeof row !== "object" || typeof row.id !== "string" || !row.id) {
      return { ok: false, error: "备份中存在缺失编号的项目，无法恢复。" };
    }
    if (row.user_id !== uid) {
      return { ok: false, error: "该备份不属于当前登录账号，无法恢复。" };
    }
    if (seen.has(row.id)) {
      duplicates += 1;
      continue;
    }
    seen.add(row.id);
    rows.push(row);
  }
  return { ok: true, rows, duplicates };
}

// v0.8.1：按现有编号拆分恢复行 —— 已存在的进 update（覆盖用），其余进 insert。
export function splitRestoreRows(rows, existingIds) {
  const insert = [];
  const update = [];
  for (const row of rows) {
    (existingIds.has(row.id) ? update : insert).push(row);
  }
  return { insert, update };
}

// v0.12.0：列表分页纯函数（ui.js 调用，tests/pagination.test.js 覆盖）
// limit 非法时回落 50；visible 恒为前 limit 条，remaining 为剩余条数。
export const PAGE_SIZE = 50;
export function paginateItems(items, limit) {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : PAGE_SIZE;
  const visible = items.slice(0, safeLimit);
  return { visible, remaining: items.length - visible.length };
}

// v0.12.0：定位扩页——目标下标超出当前 limit 时，把 limit 扩到含目标的那一页
export function expandLimitForIndex(limit, index, pageSize = PAGE_SIZE) {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : PAGE_SIZE;
  if (index < 0 || index < safeLimit) return safeLimit;
  return Math.ceil((index + 1) / pageSize) * pageSize;
}

// v0.12.0：离线快照——只读缓存。保存时剥离 pdfText（全文可能很大，localStorage
// 只有约 5MB），其余字段原样；读写全程 try/catch，配额或脏数据静默失败，
// 绝不因为快照问题影响正常同步。storage 传 localStorage，测试传 Map 替身。
export const SNAPSHOT_KEY = "bid-assistant-projects-snapshot";
/** v0.30.0：运行时版本号 —— 备份文件里的 version 就取它；package.json 是事实来源，
 * scripts/check-version.mjs 强制两者同步，别只改一处。 */
export const APP_VERSION = "1.0.5";
// v0.30.0：离线快照有效期 7 天 —— 更旧的快照不再当 live 数据用（会显示过期内容还不自知）。
export const SNAPSHOT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export function saveProjectsSnapshot(storage, projects) {
  try {
    const slim = (projects || []).map(({ pdfText, ...rest }) => rest);
    storage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({ savedAt: Date.now(), projects: slim })
    );
    return true;
  } catch {
    // 额度满了：退而求其次，只留列表渲染必需的字段，离线至少能看清单。
    try {
      const minimal = (projects || []).map((p) => ({
        id: p.id,
        name: p.name,
        date: p.date,
        status: p.status,
        biddingCompany: p.biddingCompany,
        type: p.type,
        contact: p.contact,
      }));
      storage.setItem(
        SNAPSHOT_KEY,
        JSON.stringify({ savedAt: Date.now(), projects: minimal })
      );
      return true;
    } catch {
      return false;
    }
  }
}
export function loadProjectsSnapshot(storage, now = Date.now()) {
  try {
    const raw = storage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.projects)) return null;
    // 过期快照直接丢掉，别拿旧数据冒充现状。
    if (!Number.isFinite(parsed.savedAt) || now - parsed.savedAt > SNAPSHOT_TTL_MS) {
      try {
        storage.removeItem(SNAPSHOT_KEY);
      } catch {
        // ignore
      }
      return null;
    }
    return { projects: parsed.projects, savedAt: parsed.savedAt || 0 };
  } catch {
    return null;
  }
}

// v0.31.0：本地 state 的增量维护 —— 纯函数（可单测）。写操作成功后不再全量重拉，
// 只把受影响的行合进 state.projects；合完按开标时间升序排，与服务端
// loadProjects 的顺序（bid_date ASC）一致。
export function upsertById(list, item) {
  const arr = Array.isArray(list) ? [...list] : [];
  const i = arr.findIndex((p) => p.id === item.id);
  if (i >= 0) arr[i] = item;
  else arr.push(item);
  arr.sort(
    (a, b) =>
      String(a.date || "").localeCompare(String(b.date || "")) ||
      String(a.id).localeCompare(String(b.id))
  );
  return arr;
}

export function removeByIds(list, ids) {
  const set = new Set(ids || []);
  return (Array.isArray(list) ? list : []).filter((p) => !set.has(p.id));
}

// v0.30.0：通知去重键过期清理 —— 键里嵌着截止日期（YYYY-MM-DD），超过 30 天的直接清掉，
// 不然每个项目每个截止项各留一条，localStorage 越攒越多。纯函数（可单测）。
export function pruneNotificationKeys(storage, now = new Date()) {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
  let removed = 0;
  try {
    for (let i = storage.length - 1; i >= 0; i--) {
      const key = storage.key(i);
      if (!key || !key.startsWith("bid-reminder:")) continue;
      // 键形如 bid-reminder:<urlHint>:<uid>:<projectId>:<itemKey>:<YYYY-MM-DD>:<stage>
      const parts = key.split(":");
      const datePart = parts[parts.length - 2];
      if (datePart && datePart < cutoffStr) {
        storage.removeItem(key);
        removed += 1;
      }
    }
  } catch {
    // ignore
  }
  return removed;
}
