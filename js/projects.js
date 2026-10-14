/** 项目数据层（Supabase CRUD / 迁移 / 导出） */

import {
  LEGACY_STORAGE_KEY,
  TRASH_RETENTION_DAYS,
  getTrashExpiryCutoff,
  normalizeChecklist,
} from "./utils.js";

/** v0.3.0 新列缺失时的报错特征：提示先执行增量迁移，而非原样报错 */
const MISSING_COLUMN_PATTERN =
  /checklist|amount_value|amount_unit|guarantee_amount|guarantee_unit|guarantee_status|registration_deadline|inquiry_deadline|clarification_deadline|guarantee_deadline|pdf_text|pdf_filename|pdf_parsed_at/;

const toNumberOrNull = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function createProjectsApi({ getClient, getState, setState, ui }) {
  const toUiProject = (row) => ({
    id: row.id,
    date: row.bid_date,
    type: row.project_type,
    name: row.name,
    biddingCompany: row.bidding_company || "",
    tenderer: row.tenderer || "",
    amount: row.amount || "",
    guarantee: row.guarantee,
    contact: row.contact,
    status: row.status,
    notes: row.notes || "",
    riskSummary: row.risk_summary || "",
    riskPoints: row.risk_points || null,
    qualification: row.qualification || null,
    invalidBidClauses: row.invalid_bid_clauses || null,
    extractedMeta: row.extracted_meta || null,
    deletedAt: row.deleted_at || null,
    // v0.3.0：废标检查清单
    checklist: normalizeChecklist(row.checklist),
    // v0.3.0：结构化金额 / 保证金（旧 amount / guarantee 文本列保留作兼容）
    amountValue: toNumberOrNull(row.amount_value),
    amountUnit: ["元", "万元"].includes(row.amount_unit)
      ? row.amount_unit
      : "万元",
    guaranteeAmount: toNumberOrNull(row.guarantee_amount),
    guaranteeUnit: ["元", "万元"].includes(row.guarantee_unit)
      ? row.guarantee_unit
      : "万元",
    guaranteeStatus: ["未缴纳", "已缴纳", "已退回", "已没收"].includes(
      row.guarantee_status
    )
      ? row.guarantee_status
      : "未缴纳",
    // v0.3.0：多截止时间
    registrationDeadline: row.registration_deadline || null,
    inquiryDeadline: row.inquiry_deadline || null,
    clarificationDeadline: row.clarification_deadline || null,
    guaranteeDeadline: row.guarantee_deadline || null,
    // v0.3.0：PDF 文本持久化
    pdfText: row.pdf_text || "",
    pdfFilename: row.pdf_filename || "",
    pdfParsedAt: row.pdf_parsed_at || null,
  });

  // 分页拉取一页。useDeletedFilter=false 时不加 deleted_at 条件，
  // 用于还没执行 v0.2.7 增量迁移（无 deleted_at 列）的旧库兜底。
  async function fetchProjectsPage(from, pageSize, { deletedOnly = false, useDeletedFilter = true } = {}) {
    const client = getClient();
    let query = client
      .from("projects")
      .select("*")
      .order(deletedOnly ? "deleted_at" : "bid_date", { ascending: !deletedOnly });
    if (useDeletedFilter) {
      query = deletedOnly
        ? query.not("deleted_at", "is", null)
        : query.is("deleted_at", null);
    }
    return query.range(from, from + pageSize - 1);
  }

  async function loadProjects() {
    const client = getClient();
    const state = getState();
    ui.setSyncStatus("正在同步…");
    // 分页拉取：Supabase 默认单次上限 1000 条，全量 select 会静默丢数据。
    // 每页 500 条循环拉完，设 10000 条安全上限防死循环。
    const PAGE_SIZE = 500;
    const MAX_ROWS = 10000;
    const allRows = [];
    let from = 0;
    let useDeletedFilter = true;
    while (from < MAX_ROWS) {
      let { data, error } = await fetchProjectsPage(from, PAGE_SIZE, { useDeletedFilter });
      if (error && useDeletedFilter && /deleted_at/.test(error.message || "")) {
        // 旧库还没加 deleted_at 列：降级为不过滤，前端再按 deleted_at 为空过滤。
        useDeletedFilter = false;
        ({ data, error } = await fetchProjectsPage(from, PAGE_SIZE, { useDeletedFilter }));
      }
      if (error) {
        ui.setSyncStatus("同步失败", true);
        ui.showToast(`同步失败：${error.message}`);
        return false;
      }
      allRows.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    const visible = useDeletedFilter
      ? allRows
      : allRows.filter((row) => !row.deleted_at);
    setState({ projects: visible.map(toUiProject) });
    ui.render();
    return true;
  }

  /** 拉取回收站（deleted_at 非空），按删除时间倒序。旧库无列时返回 [] 并提示迁移。 */
  async function loadDeletedProjects() {
    const PAGE_SIZE = 500;
    const allRows = [];
    let from = 0;
    while (from < 10000) {
      const { data, error } = await fetchProjectsPage(from, PAGE_SIZE, {
        deletedOnly: true,
        useDeletedFilter: true,
      });
      if (error) {
        if (/deleted_at/.test(error.message || "")) {
          ui.showToast("回收站不可用：请先在 Supabase SQL Editor 执行 supabase.sql 的 v0.2.7 增量迁移（deleted_at）。");
          return [];
        }
        ui.showToast(`回收站加载失败：${error.message}`);
        return [];
      }
      allRows.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return allRows.map(toUiProject);
  }

  /** 静默清理超过保留期的回收站项目（最佳努力，失败不打扰用户）。 */
  async function purgeExpiredTrash() {
    try {
      const client = getClient();
      const state = getState();
      if (!state.user) return;
      const cutoff = getTrashExpiryCutoff().toISOString();
      await client
        .from("projects")
        .delete()
        .lt("deleted_at", cutoff)
        .eq("user_id", state.user.id);
    } catch {
      // 旧库无 deleted_at 列或网络异常：忽略，下次打开再试。
    }
  }

  async function migrateLocalProjects() {
    const client = getClient();
    const state = getState();
    const config = window.SUPABASE_CONFIG || {};
    const urlHint = String(config.url || "").slice(-12);
    const migrationKey = `${LEGACY_STORAGE_KEY}:migrated:${urlHint}:${state.user.id}`;
    if (localStorage.getItem(migrationKey)) return;
    let legacy = [];
    try {
      legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "[]");
    } catch {
      return;
    }
    if (!Array.isArray(legacy) || !legacy.length) {
      localStorage.setItem(migrationKey, "true");
      return;
    }
    const validStatuses = new Set(["报名中", "制作中", "已开标"]);
    const invalid = [];
    const payload = legacy.flatMap((p, index) => {
      const project = {
        user_id: state.user.id,
        bid_date: String(p.date || ""),
        project_type: String(p.type || "").trim(),
        name: String(p.name || "").trim(),
        bidding_company: String(p.biddingCompany || p.company || "").trim() || null,
        tenderer: String(p.tenderer || "").trim() || null,
        amount: String(p.amount || "").trim() || null,
        guarantee: String(p.guarantee ?? "").trim(),
        contact: String(p.contact || "").trim(),
        status: validStatuses.has(p.status) ? p.status : "报名中",
        notes: String(p.notes || "").trim() || null,
      };
      if (
        !project.bid_date ||
        !project.project_type ||
        !project.name ||
        !project.guarantee ||
        !project.contact
      ) {
        invalid.push(index + 1);
        return [];
      }
      return [project];
    });
    if (!payload.length) {
      ui.showToast("未迁移：本地项目缺少必填字段。");
      return;
    }
    const { error } = await client.from("projects").insert(payload);
    if (error) {
      ui.showToast(`本地数据迁移失败：${error.message}`);
      return;
    }
    localStorage.setItem(migrationKey, "true");
    ui.showToast(
      `已迁移 ${payload.length} 条本地项目到云端。${invalid.length ? `另有 ${invalid.length} 条数据缺少必填字段，未迁移。` : ""}`
    );
    await loadProjects();
  }

  function subscribeToProjects(onChange) {
    const client = getClient();
    const state = getState();
    let channel = state.channel;
    if (channel) client.removeChannel(channel);
    setState({ realtimeReady: false });
    channel = client
      .channel(`projects-${state.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "projects",
          filter: `user_id=eq.${state.user.id}`,
        },
        () => onChange()
      )
      .subscribe((status, error) => {
        if (status === "SUBSCRIBED") {
          setState({ realtimeReady: true });
          ui.setSyncStatus("实时同步已连接");
          return;
        }
        if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          setState({ realtimeReady: false });
          ui.setSyncStatus(
            `实时同步不可用${error?.message ? `：${error.message}` : ""}`,
            true
          );
        }
      });
    setState({ channel });
  }

  function validate(project) {
    return !project.bid_date ||
      !project.project_type ||
      !project.name ||
      !project.bidding_company ||
      !project.guarantee ||
      !project.contact
      ? "请完整填写：开标时间、项目类型、项目名称、投标公司、保证金/保函、联系人。"
      : "";
  }

  async function saveProject(project, editingId) {
    const client = getClient();
    const state = getState();
    const errorText = validate(project);
    if (errorText) {
      ui.showToast(errorText);
      return false;
    }
    ui.setSyncStatus("正在保存…");
    const wasEditing = Boolean(editingId);
    const query = wasEditing
      ? client
          .from("projects")
          .update(project)
          .eq("id", editingId)
          .eq("user_id", state.user.id)
      : client.from("projects").insert({ ...project, user_id: state.user.id });
    const { error } = await query;
    if (error) {
      ui.setSyncStatus("保存失败", true);
      if (MISSING_COLUMN_PATTERN.test(error.message || "")) {
        ui.showToast("保存失败：请先在 Supabase SQL Editor 执行 supabase.sql 的 v0.3.0 增量迁移。");
      } else {
        ui.showToast(`保存失败：${error.message}`);
      }
      return false;
    }
    await loadProjects();
    ui.setSyncStatus(
      getState().realtimeReady ? "实时同步已连接" : "云端已同步"
    );
    ui.showToast(wasEditing ? "项目已更新。" : "项目已添加到云端。");
    return true;
  }

  /**
   * 局部更新项目字段（清单 / 金额 / 截止时间 / PDF 文本等）。
   * 只允许白名单字段映射到 DB 列；pdf_text 保存时截断到 200000 字符。
   * 旧库未执行 v0.3.0 迁移时提示迁移，不静默失败。
   */
  async function updateProjectFields(id, patch) {
    const client = getClient();
    const state = getState();
    const dbPatch = {};
    const fieldMap = {
      checklist: "checklist",
      amountValue: "amount_value",
      amountUnit: "amount_unit",
      guaranteeAmount: "guarantee_amount",
      guaranteeUnit: "guarantee_unit",
      guaranteeStatus: "guarantee_status",
      registrationDeadline: "registration_deadline",
      inquiryDeadline: "inquiry_deadline",
      clarificationDeadline: "clarification_deadline",
      guaranteeDeadline: "guarantee_deadline",
      pdfText: "pdf_text",
      pdfFilename: "pdf_filename",
      pdfParsedAt: "pdf_parsed_at",
    };
    for (const [uiKey, dbKey] of Object.entries(fieldMap)) {
      if (!(uiKey in (patch || {}))) continue;
      let value = patch[uiKey];
      if (uiKey === "checklist") value = normalizeChecklist(value);
      if (uiKey === "pdfText" && typeof value === "string" && value.length > 200000) {
        value = `${value.slice(0, 200000)}\n\n[文本过长，已截断]`;
      }
      dbPatch[dbKey] = value;
    }
    if (!Object.keys(dbPatch).length) return false;
    const { error } = await client
      .from("projects")
      .update(dbPatch)
      .eq("id", id)
      .eq("user_id", state.user.id);
    if (error) {
      if (MISSING_COLUMN_PATTERN.test(error.message || "")) {
        ui.showToast("保存失败：请先在 Supabase SQL Editor 执行 supabase.sql 的 v0.3.0 增量迁移。");
      } else {
        ui.showToast(`保存失败：${error.message}`);
      }
      return false;
    }
    await loadProjects();
    return true;
  }

  /**
   * 删除 = 移入回收站（软删除），不是彻底删除。
   * 保留 deleted_at，30 天内可在回收站恢复，过期自动彻底删除。
   */
  async function deleteProject(id) {
    const client = getClient();
    const state = getState();
    const project = state.projects.find((p) => p.id === id);
    if (!project) return false;
    if (!confirm(`将「${project.name}」移入回收站吗？${TRASH_RETENTION_DAYS} 天内可在回收站恢复。`)) return false;
    const { error } = await client
      .from("projects")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", state.user.id);
    if (error) {
      ui.showToast(`删除失败：${error.message}`);
      return false;
    }
    await loadProjects();
    ui.showToast(`已移到回收站，${TRASH_RETENTION_DAYS} 天内可在回收站恢复。`);
    return true;
  }

  async function restoreProject(id) {
    const client = getClient();
    const state = getState();
    const { error } = await client
      .from("projects")
      .update({ deleted_at: null })
      .eq("id", id)
      .eq("user_id", state.user.id);
    if (error) {
      ui.showToast(`恢复失败：${error.message}`);
      return false;
    }
    await loadProjects();
    ui.showToast("项目已从回收站恢复。");
    return true;
  }

  async function permanentlyDeleteProject(id, name) {
    const client = getClient();
    const state = getState();
    if (!confirm(`彻底删除「${name || "该项目"}」吗？删除后无法恢复。`)) return false;
    const { error } = await client
      .from("projects")
      .delete()
      .eq("id", id)
      .eq("user_id", state.user.id);
    if (error) {
      ui.showToast(`彻底删除失败：${error.message}`);
      return false;
    }
    await loadProjects();
    ui.showToast("项目已彻底删除。");
    return true;
  }

  const exportCsv = (projects) => {
    const headers = [
      "项目名称",
      "项目类型",
      "投标公司",
      "招标单位",
      "联系人",
      "开标时间",
      "保证金/保函",
      "项目金额",
      "项目状态",
      "备注",
      "风险摘要",
      "项目金额（数值）",
      "项目金额单位",
      "保证金金额",
      "保证金单位",
      "保证金状态",
    ];
    const rows = projects.map((p) => [
      p.name,
      p.type,
      p.biddingCompany || "",
      p.tenderer || "",
      p.contact,
      p.date,
      p.guarantee,
      p.amount || "",
      p.status,
      p.notes || "",
      p.riskSummary || "",
      p.amountValue ?? "",
      p.amountUnit || "",
      p.guaranteeAmount ?? "",
      p.guaranteeUnit || "",
      p.guaranteeStatus || "",
    ]);
    const csv =
      "\ufeff" +
      [headers, ...rows]
        .map((row) =>
          row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
        )
        .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "项目列表.csv";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    ui.showToast(`已导出 ${rows.length} 个项目为 CSV 文件。`);
  };

  return {
    loadProjects,
    loadDeletedProjects,
    purgeExpiredTrash,
    migrateLocalProjects,
    subscribeToProjects,
    saveProject,
    updateProjectFields,
    deleteProject,
    restoreProject,
    permanentlyDeleteProject,
    exportCsv,
    toUiProject,
    validate,
  };
}
