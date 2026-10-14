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

export const formatCountdown = (value) => {
  const target = new Date(`${value}T00:00:00`);
  const diff = target - Date.now();
  if (!value || Number.isNaN(target.getTime()) || diff <= 0) return "已开标";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${days}天${hours}小时${mins}分钟`;
};

export const getDaysUntilBid = (value) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${value}T00:00:00`);
  return Number.isNaN(target.getTime())
    ? null
    : Math.round((target - today) / 86400000);
};

export const getStatusClass = (status) =>
  status === "已开标" ? "success" : status === "制作中" ? "warning" : "";

export const TRASH_RETENTION_DAYS = 30;

export const THEME_KEY = "bid-assistant-theme";
export const LEGACY_STORAGE_KEY = "bid-assistant-projects";
export const AI_KEY_STORAGE = "bid-assistant-ai-key";
export const AI_BASE_STORAGE = "bid-assistant-ai-base";
export const AI_MODEL_STORAGE = "bid-assistant-ai-model";
export const REMINDER_DAYS_KEY = "bid-assistant-reminder-days";
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
    return days < 0 && days >= -windowDays;
  });
}

/** 回收站过期清理的截止时间：早于该时间的 deleted_at 应彻底删除 */
export function getTrashExpiryCutoff(now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() - TRASH_RETENTION_DAYS);
  return d;
}

/**
 * 即将开标提醒
 * @param {object} project
 * @param {number} [maxDays] 提醒窗口天数，默认读 localStorage
 */
export const getReminder = (project, maxDays = getReminderDays()) => {
  if (project.status === "已开标") return null;
  const days = getDaysUntilBid(project.date);
  const windowDays = Number.isFinite(maxDays) ? maxDays : DEFAULT_REMINDER_DAYS;
  if (days === null || days < 0 || days > windowDays) return null;
  if (days === 0)
    return { days, level: "urgent", label: "紧急：今日开标（剩余 0 天）" };
  if (days === 1)
    return { days, level: "red", label: "重要：明日开标（剩余 1 天）" };
  if (days <= 3)
    return { days, level: "orange", label: `提醒：${days} 天后开标` };
  return { days, level: "yellow", label: `提醒：${days} 天后开标` };
};
