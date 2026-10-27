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
  // v0.4.0：列表查询显式列清单，排除 pdf_text（全文按需拉，见 loadProjectPdfText）。
  // 列表仍保留 pdf_filename + pdf_parsed_at，用于显示“已保存招标文件”。
  const LIST_COLUMNS = [
    "id",
    "user_id",
    "bid_date",
    "project_type",
    "name",
    "bidding_company",
    "tenderer",
    "amount",
    "guarantee",
    "contact",
    "status",
    "notes",
    "risk_summary",
    "risk_points",
    "qualification",
    "invalid_bid_clauses",
    "extracted_meta",
    "deleted_at",
    "checklist",
    "amount_value",
    "amount_unit",
    "guarantee_amount",
    "guarantee_unit",
    "guarantee_status",
    "registration_deadline",
    "inquiry_deadline",
    "clarification_deadline",
    "guarantee_deadline",
    "pdf_filename",
    "pdf_parsed_at",
    "created_at",
    "updated_at",
  ].join(",");

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
      .select(LIST_COLUMNS)
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
          ui.showToast("回收站不可用：先在 Supabase SQL Editor 执行 supabase.sql 的 v0.2.7 增量迁移（deleted_at）。");
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

  /**
   * v0.4.0：按需拉单个项目的 PDF 全文（列表查询已排除 pdf_text）。
   * 成功后把结果合并进 state.projects 对应项，不全量重拉（重拉会把刚合并的全文清掉）。
   * 返回 pdf_text 字符串，失败返回 null。
   */
  async function loadProjectPdfText(id) {
    const client = getClient();
    const state = getState();
    const { data, error } = await client
      .from("projects")
      .select("id, pdf_text, pdf_filename, pdf_parsed_at")
      .eq("id", id)
      .eq("user_id", state.user.id)
      .maybeSingle();
    if (error) {
      ui.showToast(`加载已保存文本失败：${error.message}`);
      return null;
    }
    if (!data) {
      ui.showToast("该项目没有已保存的招标文件文本。");
      return null;
    }
    const item = state.projects.find((p) => p.id === id);
    if (item) {
      item.pdfText = data.pdf_text || "";
      item.pdfFilename = data.pdf_filename || "";
      item.pdfParsedAt = data.pdf_parsed_at || null;
    }
    return data.pdf_text || "";
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
        guarantee: String(p.guarantee ?? "").trim() || null,
        contact: String(p.contact || "").trim(),
        status: validStatuses.has(p.status) ? p.status : "报名中",
        notes: String(p.notes || "").trim() || null,
      };
      if (
        !project.bid_date ||
        !project.project_type ||
        !project.name ||
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

  // v0.4.0：保证金 / 金额均选填。必填：开标时间、项目类型、项目名称、投标公司、联系人。
  function validate(project) {
    return !project.bid_date ||
      !project.project_type ||
      !project.name ||
      !project.bidding_company ||
      !project.contact
      ? "必填项没填完：开标时间、项目类型、项目名称、投标公司、联系人。"
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
    // 保证金原文为空时存 null（v0.4.0 起 guarantee 列可为空，见 supabase.sql 第 8 节）
    const payload = {
      ...project,
      guarantee:
        typeof project.guarantee === "string" && project.guarantee.trim()
          ? project.guarantee
          : null,
    };
    ui.setSyncStatus("正在保存…");
    const wasEditing = Boolean(editingId);
    const query = wasEditing
      ? client
          .from("projects")
          .update(payload)
          .eq("id", editingId)
          .eq("user_id", state.user.id)
      : client.from("projects").insert({ ...payload, user_id: state.user.id });
    const { error } = await query;
    if (error) {
      ui.setSyncStatus("保存失败", true);
      if (MISSING_COLUMN_PATTERN.test(error.message || "")) {
        ui.showToast("保存失败：先在 Supabase SQL Editor 执行 supabase.sql 的 v0.3.0 增量迁移。");
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
        ui.showToast("保存失败：先在 Supabase SQL Editor 执行 supabase.sql 的 v0.3.0 增量迁移。");
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
    // v0.7.0：删除退出动画——confirm 通过后先淡出收拢（约 0.3s），再执行删除刷新；
    // 若中途触发了 render（筛选切换等），该行已被替换，动画静默跳过，以最终 render 为准
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const row = document.querySelector(
      `.project-item[data-id="${CSS.escape(String(id))}"]`
    );
    if (row && !reduceMotion) {
      row.style.height = `${row.offsetHeight}px`;
      row.style.overflow = "hidden";
      row.classList.add("leaving");
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r))
      );
      row.style.height = "0px";
      await new Promise((r) => setTimeout(r, 300));
    }
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

  /**
   * v0.6.0：批量删除 = 批量移入回收站。一次 confirm、一次 update、一个 toast。
   */
  async function deleteProjects(ids) {
    const client = getClient();
    const state = getState();
    const list = [...new Set(ids || [])];
    if (!list.length) return false;
    if (
      !confirm(
        `将 ${list.length} 个项目移入回收站吗？${TRASH_RETENTION_DAYS} 天内可在回收站恢复。`
      )
    )
      return false;
    const { error } = await client
      .from("projects")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", list)
      .eq("user_id", state.user.id);
    if (error) {
      ui.showToast(`批量删除失败：${error.message}`);
      return false;
    }
    await loadProjects();
    ui.showToast(`已将 ${list.length} 个项目移到回收站。`);
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

  /**
   * v0.4.0：批量导入（CSV 解析后的 DB 形态行）。每批 100 条 insert。
   * 返回 { imported, failed }；失败 toast 报错。
   */
  async function importProjects(rows) {
    const client = getClient();
    const state = getState();
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return { imported: 0, failed: 0 };
    let imported = 0;
    let failed = 0;
    for (let i = 0; i < list.length; i += 100) {
      const batch = list.slice(i, i + 100).map((r) => ({ ...r, user_id: state.user.id }));
      const { error } = await client.from("projects").insert(batch);
      if (error) {
        failed += batch.length;
        ui.showToast(`导入失败（第 ${i + 1}–${i + batch.length} 条）：${error.message}`);
      } else {
        imported += batch.length;
      }
    }
    await loadProjects();
    return { imported, failed };
  }

  /**
   * v0.4.0：复制项目。副本：名称 +“（副本）”、状态回到“报名中”、
   * 保证金状态回到“未缴纳”、清单全部未完成、PDF 持久化字段清空；
   * 其余字段原样复制（含 4 个截止时间、金额/保证金数值），不复制 id / 时间戳 / deleted_at。
   */
  async function cloneProject(id) {
    const client = getClient();
    const state = getState();
    const project = state.projects.find((p) => p.id === id);
    if (!project) return false;
    if (!confirm(`复制「${project.name}」为新项目吗？`)) return false;
    const payload = {
      user_id: state.user.id,
      bid_date: project.date,
      project_type: project.type,
      name: `${project.name}（副本）`,
      bidding_company: project.biddingCompany,
      tenderer: project.tenderer || null,
      amount: project.amount || null,
      guarantee: project.guarantee || null,
      contact: project.contact,
      status: "报名中",
      notes: project.notes || null,
      risk_summary: project.riskSummary || null,
      risk_points: project.riskPoints?.length ? project.riskPoints : null,
      qualification: project.qualification?.length ? project.qualification : null,
      invalid_bid_clauses: project.invalidBidClauses?.length
        ? project.invalidBidClauses
        : null,
      extracted_meta: project.extractedMeta || null,
      checklist: (project.checklist || []).map((item) => ({ ...item, done: false })),
      amount_value: project.amountValue ?? null,
      amount_unit: project.amountUnit || "万元",
      guarantee_amount: project.guaranteeAmount ?? null,
      guarantee_unit: project.guaranteeUnit || "万元",
      guarantee_status: "未缴纳",
      registration_deadline: project.registrationDeadline || null,
      inquiry_deadline: project.inquiryDeadline || null,
      clarification_deadline: project.clarificationDeadline || null,
      guarantee_deadline: project.guaranteeDeadline || null,
      pdf_text: null,
      pdf_filename: null,
      pdf_parsed_at: null,
    };
    const { error } = await client.from("projects").insert(payload);
    if (error) {
      ui.showToast(`复制失败：${error.message}`);
      return false;
    }
    await loadProjects();
    ui.showToast(`已复制为「${payload.name}」。`);
    return true;
  }

  const exportCsv = (projects) => {
    // v0.6.0：开标时间移到第一列，其余顺序不变
    const headers = [
      "开标时间",
      "项目名称",
      "项目类型",
      "投标公司",
      "招标单位",
      "联系人",
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
      // v0.4.0：导出补齐清单 + PDF 文件名（新增列放末尾，原有列顺序不变）
      "检查清单（已完成/总数）",
      "检查清单详情",
      "PDF 文件名",
    ];
    const rows = projects.map((p) => [
      p.date,
      p.name,
      p.type,
      p.biddingCompany || "",
      p.tenderer || "",
      p.contact,
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
      // v0.4.0：清单详情格式 [x] 文本1; [ ] 文本2，无清单则空
      `${(p.checklist || []).filter((i) => i?.done).length}/${(p.checklist || []).length}`,
      (p.checklist || [])
        .map((i) => `[${i?.done ? "x" : " "}] ${i?.text || ""}`)
        .join("; "),
      p.pdfFilename || "",
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

  /**
   * v0.8.0：一键备份 —— 直接从 Supabase 拉当前用户全部 projects（含回收站的已删除数据，
   * 不只内存里的 state：PDF 文本是按需加载的，内存可能不全），下载 JSON 文件。
   * 只带 user_id 条件，绝不无条件拉取。
   */
  const exportBackup = async () => {
    const client = getClient();
    const state = getState();
    const uid = state.user?.id;
    if (!uid) {
      ui.showToast("未登录，无法备份。");
      return false;
    }
    try {
      const PAGE_SIZE = 500;
      const MAX_ROWS = 10000;
      const allRows = [];
      let from = 0;
      while (from < MAX_ROWS) {
        const { data, error } = await client
          .from("projects")
          .select("*")
          .eq("user_id", uid)
          .order("created_at", { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || !data.length) break;
        allRows.push(...data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      const now = new Date();
      const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const payload = {
        app: "ai-bid-assistant",
        version: "0.8.0",
        exportedAt: now.toISOString(),
        count: allRows.length,
        projects: allRows,
      };
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json;charset=utf-8",
        })
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-bid-backup-${stamp}.json`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      try {
        localStorage.setItem("lastBackupAt", now.toISOString());
      } catch {
        // 隐私模式等写失败不影响备份本身
      }
      ui.showToast(`备份已下载，共 ${allRows.length} 条（含回收站）。`);
      return true;
    } catch (err) {
      ui.showToast(`备份失败：${err?.message || err}`);
      return false;
    }
  };

  return {
    loadProjects,
    loadDeletedProjects,
    loadProjectPdfText,
    purgeExpiredTrash,
    migrateLocalProjects,
    subscribeToProjects,
    saveProject,
    updateProjectFields,
    importProjects,
    cloneProject,
    deleteProject,
    deleteProjects,
    restoreProject,
    permanentlyDeleteProject,
    exportCsv,
    exportBackup,
    toUiProject,
    validate,
  };
}
