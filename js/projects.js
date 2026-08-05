/** 项目数据层（Supabase CRUD / 迁移 / 导出） */

import { LEGACY_STORAGE_KEY } from "./utils.js";

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
  });

  async function loadProjects() {
    const client = getClient();
    const state = getState();
    ui.setSyncStatus("正在同步…");
    const { data, error } = await client
      .from("projects")
      .select("*")
      .order("bid_date", { ascending: true });
    if (error) {
      ui.setSyncStatus("同步失败", true);
      ui.showToast(`同步失败：${error.message}`);
      return false;
    }
    setState({ projects: data.map(toUiProject) });
    ui.render();
    return true;
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
      ? client.from("projects").update(project).eq("id", editingId)
      : client.from("projects").insert({ ...project, user_id: state.user.id });
    const { error } = await query;
    if (error) {
      ui.setSyncStatus("保存失败", true);
      ui.showToast(`保存失败：${error.message}`);
      return false;
    }
    await loadProjects();
    ui.setSyncStatus(
      getState().realtimeReady ? "实时同步已连接" : "云端已同步"
    );
    ui.showToast(wasEditing ? "项目已更新。" : "项目已添加到云端。");
    return true;
  }

  async function deleteProject(id) {
    const client = getClient();
    const state = getState();
    const project = state.projects.find((p) => p.id === id);
    if (!project || !confirm(`确认删除「${project.name}」吗？`)) return false;
    const { error } = await client.from("projects").delete().eq("id", id);
    if (error) {
      ui.showToast(`删除失败：${error.message}`);
      return false;
    }
    await loadProjects();
    ui.showToast("项目已删除。");
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
    ui.showToast("项目列表已导出为 CSV 文件。");
  };

  return {
    loadProjects,
    migrateLocalProjects,
    subscribeToProjects,
    saveProject,
    deleteProject,
    exportCsv,
    toUiProject,
    validate,
  };
}
