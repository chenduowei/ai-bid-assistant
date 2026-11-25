/** 项目字段注册表：projects 表字段的唯一事实来源（第 2 批字段一化）。
 *
 * 来源：supabase.sql CREATE TABLE public.projects，共 30 列（第 4 批第 1 步
 * 已下线 5 个 AI 遗留列的 UI 映射，库列待第 2 步删除；见下）。注册表顺序
 * 与旧 BASE_LIST_COLUMNS 一致（bid_time / result 例外，见 extra），
 * 因此按注册表派生的 toUiProject 键序与旧手写版完全相同。
 *
 * 每字段约定：
 * - key：前端 UI 形态的键名；null 表示只随列表查询带回、不进 UI 对象
 *  （user_id / created_at / updated_at）。
 * - db：Supabase 列名；type：列类型（uuid/text/date/time/numeric/jsonb/timestamptz）。
 * - required：表单必填（与旧 REQUIRED_FIELDS / REQUIRED_FORM_FIELDS 一致）。
 * - listVisible：是否进列表查询；pdf_text 不进（全文按需拉，见 loadProjectPdfText）。
 * - extra：v0.35.0 新增列，旧库未迁移时由 ensureExtraColumns 探测，
 *   探测失败则退回旧列清单（见 stripUnavailableColumns）。
 * - 第 4 批第 1 步：AI 遗留列 risk_summary / risk_points / qualification /
 *   invalid_bid_clauses / extracted_meta 已从注册表移除 —— 不再进列表查询、
 *   不再映射进 UI 对象、不再经 updateProjectFields 回写、不再进 CSV 导出；
 *   库里的列待第 4 批第 2 步（先全量备份再删列）删除。checklist 与
 *   pdf_text / pdf_filename / pdf_parsed_at 是活数据，不受影响。
 * - enumValues：合法枚举；toUi 用它做回退，toDb 用它做守卫。
 * - toUi：DB 行 → UI 值的逐字段回退（枚举、金额、文件名清洗都在这里，
 *   不得被循环简化掉——循环只负责按注册表逐字段调用）。
 * - toDb：UI/表单值 → DB 值的逐字段规整（clone 载荷与 saveProject 共用）。
 * - localPatch：可进 updateProjectFields 本地乐观写入的字段（LOCAL_PATCH_FIELDS）。
 * - patchable：可经 updateProjectFields 回写 DB 的字段（fieldMap）。
 *   两者不重合：pdfText 可回写但不进列表 state；name / type / date 等
 *   只能本地乐观、不能经此通道回写（走 saveProject）。
 * - csv / csvOrder：导出 CSV 的列定义 [{ label, get? }] 与列序；
 *   无 get 时默认取 p[key] ?? ""。checklist 一字段出两列。
 */

import { normalizeChecklist, stripPdfFilenameSuffix } from "./utils.js";

const toNumberOrNull = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const enumOr = (values, fallback) => (v) =>
  values.includes(v) ? v : fallback;
const orEmpty = (v) => v || "";
const orNull = (v) => v || null;
const nonEmptyArrayOrNull = (v) =>
  Array.isArray(v) && v.length ? v : null;

const MONEY_UNITS = ["元", "万元"];
const GUARANTEE_STATUSES = ["未缴纳", "已缴纳", "已退回", "已没收"];
const PROJECT_STATUSES = ["报名中", "制作中", "已开标"];
const RESULTS = ["已中标", "未中标"];

export const PROJECT_FIELDS = [
  { key: "id", db: "id", type: "uuid", required: false, listVisible: true, label: "ID" },
  { key: null, db: "user_id", type: "uuid", required: false, listVisible: true, label: "用户" },
  { key: "date", db: "bid_date", type: "date", required: true, listVisible: true, label: "开标日期", localPatch: true, csvOrder: 1, csv: [{ label: "开标时间" }] },
  { key: "type", db: "project_type", type: "text", required: true, listVisible: true, label: "项目类型", localPatch: true, csvOrder: 4, csv: [{ label: "项目类型" }] },
  { key: "name", db: "name", type: "text", required: true, listVisible: true, label: "项目名称", localPatch: true, csvOrder: 3, csv: [{ label: "项目名称" }] },
  { key: "biddingCompany", db: "bidding_company", type: "text", required: true, listVisible: true, label: "投标公司", localPatch: true, csvOrder: 5, csv: [{ label: "投标公司" }] },
  { key: "tenderer", db: "tenderer", type: "text", required: false, listVisible: true, label: "招标单位", toUi: orEmpty, toDb: orNull, localPatch: true, csvOrder: 6, csv: [{ label: "招标单位" }] },
  { key: "amount", db: "amount", type: "text", required: false, listVisible: true, label: "项目金额", toUi: orEmpty, toDb: orNull, localPatch: true, csvOrder: 9, csv: [{ label: "项目金额" }] },
  {
    key: "guarantee", db: "guarantee", type: "text", required: false, listVisible: true, label: "保证金/保函",
    // 保证金原文为空时存 null（v0.4.0 起 guarantee 列可为空，见 supabase.sql 第 8 节）
    toDb: (v) => (typeof v === "string" && v.trim() ? v : null),
    localPatch: true, csvOrder: 8, csv: [{ label: "保证金/保函" }],
  },
  { key: "contact", db: "contact", type: "text", required: true, listVisible: true, label: "联系人", localPatch: true, csvOrder: 7, csv: [{ label: "联系人" }] },
  { key: "status", db: "status", type: "text", required: false, listVisible: true, label: "项目状态", enumValues: PROJECT_STATUSES, localPatch: true, patchable: true, csvOrder: 10, csv: [{ label: "项目状态" }] },
  { key: "notes", db: "notes", type: "text", required: false, listVisible: true, label: "备注", toUi: orEmpty, toDb: orNull, localPatch: true, csvOrder: 12, csv: [{ label: "备注" }] },
  { key: "deletedAt", db: "deleted_at", type: "timestamptz", required: false, listVisible: true, label: "删除时间", toUi: orNull },
  {
    key: "checklist", db: "checklist", type: "jsonb", required: false, listVisible: true, label: "检查清单",
    toUi: (v) => normalizeChecklist(v),
    localPatch: true, patchable: true, csvOrder: 19,
    csv: [
      // v0.4.0：清单详情格式 [x] 文本1; [ ] 文本2，无清单则空
      { label: "检查清单（已完成/总数）", get: (p) => `${(p.checklist || []).filter((i) => i?.done).length}/${(p.checklist || []).length}` },
      { label: "检查清单详情", get: (p) => (p.checklist || []).map((i) => `[${i?.done ? "x" : " "}] ${i?.text || ""}`).join("; ") },
    ],
  },
  { key: "amountValue", db: "amount_value", type: "numeric", required: false, listVisible: true, label: "项目金额（数值）", toUi: (v) => toNumberOrNull(v), localPatch: true, patchable: true, csvOrder: 14, csv: [{ label: "项目金额（数值）" }] },
  { key: "amountUnit", db: "amount_unit", type: "text", required: false, listVisible: true, label: "项目金额单位", enumValues: MONEY_UNITS, toUi: enumOr(MONEY_UNITS, "万元"), toDb: (v) => v || "万元", localPatch: true, patchable: true, csvOrder: 15, csv: [{ label: "项目金额单位" }] },
  { key: "guaranteeAmount", db: "guarantee_amount", type: "numeric", required: false, listVisible: true, label: "保证金金额", toUi: (v) => toNumberOrNull(v), localPatch: true, patchable: true, csvOrder: 16, csv: [{ label: "保证金金额" }] },
  { key: "guaranteeUnit", db: "guarantee_unit", type: "text", required: false, listVisible: true, label: "保证金单位", enumValues: MONEY_UNITS, toUi: enumOr(MONEY_UNITS, "万元"), toDb: (v) => v || "万元", localPatch: true, patchable: true, csvOrder: 17, csv: [{ label: "保证金单位" }] },
  { key: "guaranteeStatus", db: "guarantee_status", type: "text", required: false, listVisible: true, label: "保证金状态", enumValues: GUARANTEE_STATUSES, toUi: enumOr(GUARANTEE_STATUSES, "未缴纳"), localPatch: true, patchable: true, csvOrder: 18, csv: [{ label: "保证金状态" }] },
  { key: "registrationDeadline", db: "registration_deadline", type: "date", required: false, listVisible: true, label: "报名截止", toUi: orNull, toDb: orNull, localPatch: true, patchable: true },
  { key: "inquiryDeadline", db: "inquiry_deadline", type: "date", required: false, listVisible: true, label: "质疑截止", toUi: orNull, toDb: orNull, localPatch: true, patchable: true },
  { key: "clarificationDeadline", db: "clarification_deadline", type: "date", required: false, listVisible: true, label: "澄清截止", toUi: orNull, toDb: orNull, localPatch: true, patchable: true },
  { key: "guaranteeDeadline", db: "guarantee_deadline", type: "date", required: false, listVisible: true, label: "保证金截止", toUi: orNull, toDb: orNull, localPatch: true, patchable: true },
  { key: "bidTime", db: "bid_time", type: "time", required: false, listVisible: true, extra: true, label: "开标时刻", toUi: (v) => String(v || "").slice(0, 5), toDb: orNull, localPatch: true, patchable: true, csvOrder: 2, csv: [{ label: "开标时刻" }] },
  { key: "result", db: "result", type: "text", required: false, listVisible: true, extra: true, label: "中标结果", enumValues: RESULTS, toUi: enumOr(RESULTS, ""), toDb: (v) => (RESULTS.includes(v) ? v : null), localPatch: true, patchable: true, csvOrder: 11, csv: [{ label: "中标结果" }] },
  {
    key: "pdfText", db: "pdf_text", type: "text", required: false, listVisible: false, label: "招标文件文本",
    toUi: orEmpty, patchable: true,
  },
  {
    key: "pdfFilename", db: "pdf_filename", type: "text", required: false, listVisible: true, label: "PDF 文件名",
    // v0.18.1：入库前已污染的文件名（末尾连拼"（N 字）"）在这里洗掉，
    // 列表、查看、导出、保存回退拿到的都是干净名；下次保存即写回干净值。
    toUi: (v) => stripPdfFilenameSuffix(v || ""),
    localPatch: true, patchable: true, csvOrder: 20, csv: [{ label: "PDF 文件名" }],
  },
  { key: "pdfParsedAt", db: "pdf_parsed_at", type: "timestamptz", required: false, listVisible: true, label: "PDF 解析时间", toUi: orNull, localPatch: true, patchable: true },
  { key: null, db: "created_at", type: "timestamptz", required: false, listVisible: true, label: "创建时间" },
  { key: null, db: "updated_at", type: "timestamptz", required: false, listVisible: true, label: "更新时间" },
];

export const projectFieldByDb = (db) =>
  PROJECT_FIELDS.find((f) => f.db === db);
export const projectFieldByKey = (key) =>
  PROJECT_FIELDS.find((f) => f.key === key);

/** 列表查询列清单：BASE = 全部 listVisible 且非 extra 的列（pdf_text 除外）。 */
export const baseListDbColumns = () =>
  PROJECT_FIELDS.filter((f) => f.listVisible && !f.extra).map((f) => f.db);
/** 需探测的新列（旧库未迁移时退回 BASE 清单）。 */
export const extraListDbColumns = () =>
  PROJECT_FIELDS.filter((f) => f.extra).map((f) => f.db);

/** 必填字段（DB 键形态，供 projects.js validate 用）。 */
export const requiredDbFields = () =>
  PROJECT_FIELDS.filter((f) => f.required).map((f) => ({
    field: f.db,
    label: f.label,
  }));
/** 必填字段（表单形态，供 app.js 标红 / 聚焦用；key 是表单元素键）。 */
export const requiredFormFields = () =>
  PROJECT_FIELDS.filter((f) => f.required).map((f) => ({
    db: f.db,
    key: f.key,
    label: f.label,
  }));

/** 本地乐观写入的 UI 键（LOCAL_PATCH_FIELDS）。 */
export const localPatchKeys = () =>
  PROJECT_FIELDS.filter((f) => f.localPatch).map((f) => f.key);
/** UI 键 → DB 列（updateProjectFields 的 fieldMap）。 */
export const patchFieldMap = () =>
  Object.fromEntries(
    PROJECT_FIELDS.filter((f) => f.patchable).map((f) => [f.key, f.db])
  );

/** 导出 CSV 的列（按 csvOrder 排序；一字段可出多列，如 checklist）。 */
export const exportCsvColumns = () =>
  PROJECT_FIELDS.filter((f) => f.csv)
    .sort((a, b) => a.csvOrder - b.csvOrder)
    .flatMap((f) =>
      f.csv.map((c) => ({ key: f.key, label: c.label, get: c.get }))
    );

/** DB 行 → UI 对象：按注册表逐字段调用各字段的 toUi（手写回退保留在字段定义里）。 */
export function toUiProject(row) {
  const ui = {};
  for (const f of PROJECT_FIELDS) {
    if (!f.key) continue;
    ui[f.key] =
      typeof f.toUi === "function" ? f.toUi(row[f.db], row) : row[f.db];
  }
  return ui;
}

/** DB 形态 → DB 形态规整（saveProject 用：输入已是 DB 键，只按注册表
 * 逐字段套 toDb；不在注册表里的键原样保留）。 */
export function toDbProject(dbProject) {
  const out = { ...dbProject };
  for (const f of PROJECT_FIELDS) {
    if (!(f.db in out) || typeof f.toDb !== "function") continue;
    out[f.db] = f.toDb(out[f.db], dbProject);
  }
  return out;
}

/** UI 形态 → DB insert 载荷（cloneProject 用）。不含 id / user_id /
 * created_at / updated_at（前者 DB 生成、后两者 DB 默认值）与 deleted_at
 *（新行未删除）；status / result / 保证金状态 / 清单 / PDF 由调用方覆盖。 */
export function uiToDbInsert(uiProject) {
  const out = {};
  for (const f of PROJECT_FIELDS) {
    if (!f.key || f.db === "id" || f.db === "deleted_at") continue;
    const value = uiProject[f.key];
    out[f.db] =
      typeof f.toDb === "function" ? f.toDb(value, uiProject) : (value ?? null);
  }
  return out;
}
