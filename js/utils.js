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

/**
 * 从 AI 结果生成检查清单：废标条款全转（source=ai-invalid）；
 * 风险点仅 level=high/medium 转（source=ai-risk），低风险不转。
 * 按文本去重、去空，最多 50 项。
 */
export function buildChecklistFromAi(invalidBidClauses, riskPoints) {
  const seen = new Set();
  const out = [];
  const push = (text, source, prefix) => {
    const clean = String(text ?? "").trim().slice(0, 500);
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    out.push({
      id: `${prefix}-${out.length + 1}`,
      text: clean,
      done: false,
      source,
    });
  };
  for (const clause of Array.isArray(invalidBidClauses)
    ? invalidBidClauses
    : []) {
    push(checklistItemText(clause), "ai-invalid", "ai-invalid");
    if (out.length >= 50) return out;
  }
  for (const point of Array.isArray(riskPoints) ? riskPoints : []) {
    if (!point || typeof point !== "object") continue;
    if (point.level !== "high" && point.level !== "medium") continue;
    push(checklistItemText(point), "ai-risk", "ai-risk");
    if (out.length >= 50) return out;
  }
  return out;
}

/** 检查清单进度：{done, total} */
export function getChecklistProgress(checklist) {
  const list = Array.isArray(checklist) ? checklist : [];
  return { done: list.filter((i) => i?.done).length, total: list.length };
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

/** 某项目的所有截止项（有日期且状态 != 已开标）：{key, label, date, days} */
export function getDeadlineItems(project) {
  if (!project || project.status === "已开标") return [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const items = [];
  for (const { key, label } of DEADLINE_TYPES) {
    const raw = key === "date" ? project.date : project[key];
    if (!raw) continue;
    const date = String(raw).slice(0, 10);
    const target = new Date(`${date}T00:00:00`);
    if (Number.isNaN(target.getTime())) continue;
    items.push({
      key,
      label,
      date,
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
  "项目名称",
  "项目类型",
  "投标公司",
  "招标单位",
  "联系人",
  "开标时间",
  "保证金要求原文",
  "项目金额原文",
  "项目金额（数值）",
  "项目金额单位",
  "保证金金额",
  "保证金单位",
  "保证金状态",
  "项目状态",
  "备注",
  "报名截止",
  "质疑截止",
  "澄清截止",
  "保证金缴纳截止",
];

const IMPORT_HEADER_MAP = {
  项目名称: "name",
  项目类型: "project_type",
  投标公司: "bidding_company",
  招标单位: "tenderer",
  联系人: "contact",
  开标时间: "bid_date",
  保证金要求原文: "guarantee",
  项目金额原文: "amount",
  "项目金额（数值）": "amount_value",
  项目金额单位: "amount_unit",
  保证金金额: "guarantee_amount",
  保证金单位: "guarantee_unit",
  保证金状态: "guarantee_status",
  项目状态: "status",
  备注: "notes",
  报名截止: "registration_deadline",
  质疑截止: "inquiry_deadline",
  澄清截止: "clarification_deadline",
  保证金缴纳截止: "guarantee_deadline",
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
    "示例项目",
    "房建工程",
    "示例投标公司",
    "示例招标单位",
    "张三",
    "2026-12-01",
    "保证金 10 万元，开标后退还",
    "",
    "500",
    "万元",
    "10",
    "万元",
    "未缴纳",
    "报名中",
    "示例备注",
    "2026-11-01",
    "2026-11-10",
    "2026-11-15",
    "2026-11-20",
  ];
  return (
    "\uFEFF" +
    IMPORT_CSV_HEADERS.map(escapeCsvCell).join(",") +
    "\n" +
    example.map(escapeCsvCell).join(",") +
    "\n"
  );
}
