/** 项目数据层（Supabase CRUD / 迁移 / 导出） */

import {
  LEGACY_STORAGE_KEY,
  TRASH_RETENTION_DAYS,
  getTrashExpiryCutoff,
  normalizeChecklist,
  stripPdfFilenameSuffix,
  parseBackupPayload,
  splitRestoreRows,
  stripAiColumns,
  dedupeImportRows,
  saveProjectsSnapshot,
  loadProjectsSnapshot,
  createKeyedQueue,
  resolveRestoreDecision,
  APP_VERSION,
  upsertById,
  removeByIds,
  CALENDAR_TOKEN_TTL_DAYS,
  isCalendarTokenExpired,
} from "./utils.js";
import {
  PROJECT_FIELDS,
  baseListDbColumns,
  extraListDbColumns,
  requiredDbFields,
  localPatchKeys,
  patchFieldMap,
  exportCsvColumns,
  toUiProject,
  toDbProject,
  uiToDbInsert,
} from "./fields.js";
import { isValidCalendarToken } from "./ics.js";

/** v0.3.0 新列缺失时的报错特征：提示先执行增量迁移，而非原样报错 */
const MISSING_COLUMN_PATTERN =
  /checklist|amount_value|amount_unit|guarantee_amount|guarantee_unit|guarantee_status|registration_deadline|inquiry_deadline|clarification_deadline|guarantee_deadline|pdf_text|pdf_filename|pdf_parsed_at/;

export function createProjectsApi({ getClient, getState, setState, ui }) {
  // v0.4.0：列表查询显式列清单，排除 pdf_text（全文按需拉，见 loadProjectPdfText）。
  // 列表仍保留 pdf_filename + pdf_parsed_at，用于显示“已保存招标文件”。
  // v0.35.0：bid_time / result 是新增列 —— 先探测一次，旧库没迁移时自动退回旧列清单，
  // 不会因 select 不存在的列让整个列表打不开。
  // 列表查询列清单派生自字段注册表（js/fields.js）：BASE = 全部 listVisible
  // 且非 extra 的列；EXTRA = 需探测的新列。pdf_text 不进列表（全文按需拉）。
  const BASE_LIST_COLUMNS = baseListDbColumns();
  const EXTRA_LIST_COLUMNS = extraListDbColumns();
  let extraColumns = null; // null = 还没探测；true/false = 旧库有没有新列
  const listColumns = () =>
    [...BASE_LIST_COLUMNS, ...(extraColumns ? EXTRA_LIST_COLUMNS : [])].join(",");
  async function ensureExtraColumns() {
    if (extraColumns !== null) return extraColumns;
    try {
      const { error } = await getClient()
        .from("projects")
        .select(EXTRA_LIST_COLUMNS.join(","))
        .limit(1);
      extraColumns = !error;
    } catch {
      extraColumns = false;
    }
    return extraColumns;
  }
  const stripUnavailableColumns = (payload) => {
    if (extraColumns) return payload;
    const out = { ...payload };
    delete out.bid_time;
    delete out.result;
    return out;
  };

  // DB 行 → UI 对象派生自字段注册表（js/fields.js 的 toUiProject，按表逐字段调用）：
  // 枚举回退（金额单位 / 保证金状态 / 中标结果）、金额转数值、清单规整、
  // 开标时刻截断、文件名清洗等手写回退都在注册表各字段的 toUi 里原样保留。
  // （本文件内直接用顶层 import 的 toUiProject；返回对象里也照常导出它。）

  // 分页拉取一页。useDeletedFilter=false 时不加 deleted_at 条件，
  // 用于还没执行 v0.2.7 增量迁移（无 deleted_at 列）的旧库兜底。
  async function fetchProjectsPage(from, pageSize, { deletedOnly = false, useDeletedFilter = true } = {}) {
    const client = getClient();
    let query = client
      .from("projects")
      .select(listColumns())
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
    await ensureExtraColumns();
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
        // v0.12.0：同步失败时回落离线快照——但只在本会话从未成功同步过时回落
        // （登录时离线）；会话内已有 live 数据时保持现状 + 报错，避免一次瞬断
        // 把刚保存的数据刷回旧快照。快照模式下的写操作由各 API 入口守卫拦截。
        const snapshot =
          !getState().liveLoadedOnce && loadProjectsSnapshot(localStorage);
        if (snapshot) {
          setState({
            projects: snapshot.projects,
            offlineSnapshot: true,
            snapshotSavedAt: snapshot.savedAt,
          });
          ui.setSyncStatus("离线快照", true);
          ui.render();
          return true;
        }
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
    const uiProjects = visible.map(toUiProject);
    setState({
      projects: uiProjects,
      offlineSnapshot: false,
      snapshotSavedAt: null,
      liveLoadedOnce: true,
    });
    // v0.12.0：每次同步成功刷新快照（已剥离 pdfText，见 utils.saveProjectsSnapshot）
    saveProjectsSnapshot(localStorage, uiProjects);
    ui.render();
    return true;
  }

  // v0.31.0：写后本地提交 —— 不再全量重拉：把受影响的行合进 state.projects、
  // 刷新离线快照、定向渲染（只动受影响的卡片与统计）。loadProjects 只留给
  // 首次加载 / 联网恢复 / 重置 / 恢复备份这四种整库场景。
  const upsertLocalProject = (row) => {
    if (!row?.id) return;
    const proj = toUiProject(row);
    // 列表 state 从不带 pdf_text（LIST_COLUMNS 不含它），与重拉一致，免得实时
    // 推送把几十万字全文塞进内存。
    proj.pdfText = "";
    setState({ projects: upsertById(getState().projects, proj) });
  };
  const removeLocalProjects = (ids) => {
    const list = [...new Set(ids || [])];
    if (!list.length) return;
    setState({ projects: removeByIds(getState().projects, list) });
    const selectedIds = getState().selectedIds;
    if (selectedIds) list.forEach((id) => selectedIds.delete(id));
  };
  const afterLocalChange = (changedIds = []) => {
    saveProjectsSnapshot(localStorage, getState().projects);
    ui.renderAfterWrite({ changedIds });
  };

  // v1.0.4：Realtime 回声去重 —— 自己刚保存（或刚乐观改字段）的那一行，几毫秒后会被
  // Realtime 原样推回来。本地 state 里已经是同一份数据，这时再 upsert + 定向重绘一次
  // 纯属白闪一下（用户反馈“每次编辑保存后闪”）。逐字段比对 toUiProject 的结果：
  // - pdfText 只在内存里按需拉（列表查询与 DB 回声都不带全文），跳过；
  // - user_id / created_at / updated_at 没有 UI 键，本来就不在比对范围；
  // - checklist 是数组，按序列化比较。
  const REALTIME_COMPARE_KEYS = PROJECT_FIELDS.filter(
    (f) => f.key && f.key !== "pdfText"
  ).map((f) => f.key);
  const sameUiProject = (a, b) => {
    for (const key of REALTIME_COMPARE_KEYS) {
      const av = a?.[key] ?? null;
      const bv = b?.[key] ?? null;
      if (av === bv) continue;
      if (av === null || bv === null) return false;
      if (typeof av === "object" || typeof bv === "object") {
        if (JSON.stringify(av) !== JSON.stringify(bv)) return false;
        continue;
      }
      // 数字列在两条路径上可能一条是 number、一条是数字字符串，按字面比。
      if (String(av) !== String(bv)) return false;
    }
    return true;
  };

  // v0.31.0：Realtime 增量应用 —— 之前每次变更（包括自己刚保存的回声）都全量重拉；
  // 现在按事件类型只动受影响的行。收不到 payload 或解析失败时返回 false，调用方回落全量重拉。
  function applyRealtimeChange(payload) {
    const type = payload?.eventType;
    if (type === "DELETE") {
      const id = payload.old?.id;
      if (!id) return false;
      // v1.0.5：本地已经没有这条（本端刚彻底删除、或本来就不在这张列表里）
      // → 这是自己写操作的回声，别再 removeLocalProjects + afterLocalChange 重绘一次
      // （回收站点一次「彻底删除」，主列表会跟着闪第二下）。
      if (!getState().projects.some((p) => p.id === id)) return true;
      removeLocalProjects([id]);
      afterLocalChange();
      return true;
    }
    if (type === "INSERT" || type === "UPDATE") {
      const row = payload.new;
      // 行不完整（缺必填列，可能是副本标识配置异常）时别硬合，回落全量重拉。
      if (!row?.id || typeof row.name !== "string" || !row.bid_date)
        return false;
      if (row.deleted_at) {
        // 软删除（另一端移入回收站）：从主列表移除。
        // v1.0.5：本地已经没有这条时就是本端 deleteProject 的回声（本地已经移除并渲染过），
        // 直接当作应用成功返回，否则会再定向重绘一次 —— 删除时闪第二下的来源。
        if (!getState().projects.some((p) => p.id === row.id)) return true;
        removeLocalProjects([row.id]);
        afterLocalChange();
        return true;
      }
      // v1.0.4：回声与本地完全一致 → 什么都不做（快照在写成功时已刷新），
      // 直接算应用成功，免得再整卡重绘一次。
      const local = getState().projects.find((p) => p.id === row.id);
      if (local && sameUiProject(local, toUiProject(row))) return true;
      upsertLocalProject(row);
      afterLocalChange([row.id]);
      return true;
    }
    return false;
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
      item.pdfFilename = stripPdfFilenameSuffix(data.pdf_filename || "");
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
    // 旧版本地数据（UI 形态）→ DB 载荷：字段映射派生自注册表；
    // 只保留旧版特有的文本整形：bid_date 不 trim、部分列空文本转 null、
    // biddingCompany 兼容旧 company 键、status 非法值回退“报名中”。
    const LEGACY_MIGRATED_COLUMNS = new Set([
      "bid_date", "project_type", "name", "bidding_company", "tenderer",
      "amount", "guarantee", "contact", "status", "notes",
    ]);
    const LEGACY_TRIM_OR_NULL = new Set([
      "tenderer", "amount", "guarantee", "notes",
    ]);
    const payload = legacy.flatMap((p, index) => {
      const project = { user_id: state.user.id };
      for (const field of PROJECT_FIELDS) {
        if (!LEGACY_MIGRATED_COLUMNS.has(field.db)) continue;
        if (field.db === "status") {
          project.status = validStatuses.has(p.status) ? p.status : "报名中";
          continue;
        }
        const raw =
          field.db === "bidding_company"
            ? p.biddingCompany || p.company
            : p[field.key];
        if (field.db === "bid_date") {
          project[field.db] = String(raw || "");
        } else if (field.db === "bidding_company") {
          // 第 12 节 D：旧版本地数据的投标公司缺失时归一化为 '未填写'（数据库 CHECK 要求 trim() > 0）。
          project[field.db] = String(raw ?? "").trim() || "未填写";
        } else {
          const text = String(raw ?? "").trim();
          project[field.db] = LEGACY_TRIM_OR_NULL.has(field.db)
            ? text || null
            : text;
        }
      }
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
        (payload) => onChange(payload)
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

  // v0.4.0：保证金 / 金额均选填。必填：开标日期、项目类型、项目名称、投标公司、联系人。
  // v0.35.0：从“一句总话”改成结构化结果 —— 调用方能指出是哪几项没填、把光标送过去。
  // 必填字段派生自字段注册表（required 字段，按注册表顺序）。
  const REQUIRED_FIELDS = requiredDbFields();
  function validate(project) {
    const missingRows = REQUIRED_FIELDS.filter(
      ({ field }) => !String(project?.[field] ?? "").trim()
    );
    return {
      ok: missingRows.length === 0,
      missing: missingRows.map((r) => r.label),
      missingFields: missingRows.map((r) => r.field),
      firstField: missingRows[0]?.field || "",
    };
  }

  async function saveProject(project, editingId) {
    const client = getClient();
    const state = getState();
    // v0.12.0：离线快照下拦截一切写操作——快照只是旧数据，写了也同步不上去，
    // 与其静默丢数据，不如明说。调用方按 false 走失败分支（按钮文案恢复、不清空表单）。
    if (state.offlineSnapshot) {
      ui.showToast("当前为离线快照，联网后才能保存。");
      return false;
    }
    const check = validate(project);
    if (!check.ok) {
      ui.showToast(`还有 ${check.missing.length} 项必填：${check.missing.join("、")}`);
      return false;
    }
    // 载荷按注册表逐字段规整（toDbProject）：保证金原文为空时存 null
    //（v0.4.0 起 guarantee 列可为空，见 supabase.sql 第 8 节），其余字段同理。
    await ensureExtraColumns();
    const payload = stripUnavailableColumns(toDbProject(project));
    ui.setSyncStatus("正在保存…");
    const wasEditing = Boolean(editingId);
    // v0.16.0：保存成功返回项目 id（新建时取刚插入行的 id），供调用方定位到该卡片；
    // 失败仍返回 false。调用方只有 app.js 的提交按钮一处。
    // v0.31.0：保存后取回整行（LIST_COLUMNS，与列表查询同款列），本地合进 state，
    // 不再全量重拉。
    const query = wasEditing
      ? client
          .from("projects")
          .update(payload)
          .eq("id", editingId)
          .eq("user_id", state.user.id)
          .select(listColumns())
          .single()
      : client
          .from("projects")
          .insert({ ...payload, user_id: state.user.id })
          .select(listColumns())
          .single();
    const { data, error } = await query;
    if (error) {
      ui.setSyncStatus("保存失败", true);
      if (MISSING_COLUMN_PATTERN.test(error.message || "")) {
        ui.showToast("保存失败：先在 Supabase SQL Editor 执行 supabase.sql 的 v0.3.0 增量迁移。");
      } else {
        ui.showToast(`保存失败：${error.message}`);
      }
      return false;
    }
    upsertLocalProject(data);
    afterLocalChange([data?.id || editingId].filter(Boolean));
    ui.setSyncStatus(
      getState().realtimeReady ? "实时同步已连接" : "云端已同步"
    );
    // v0.35.2：保存成功的提示带上项目名（列表很长时，“项目已更新”看不出存的是哪一条）。
    const shortName = String(project.name || "").trim().slice(0, 12);
    ui.showToast(
      wasEditing
        ? shortName
          ? `已保存「${shortName}」的修改。`
          : "项目已更新。"
        : shortName
          ? `已添加「${shortName}」到云端。`
          : "项目已添加到云端。"
    );
    return wasEditing ? editingId : data?.id || false;
  }

  /**
   * 局部更新项目字段（清单 / 金额 / 截止时间 / PDF 文本等）。
   * 只允许白名单字段映射到 DB 列；pdf_text 保存时截断到 200000 字符。
   * 旧库未执行 v0.3.0 迁移时提示迁移，不静默失败。
   *
   * v0.35.0：同一项目的写入串行（createKeyedQueue），patch 可以是函数
   * `(project) => partial`，在轮到本次写入时用最新 state 求值，并把结果先乐观写进本地 state。
   * 修的是“连续勾选清单互相覆盖”：两次点击间隔小于一次往返时，第二次不再是基于
   * 旧数组的整列回写（旧行为：后到的响应把前一次勾的那项抹掉）。
   */
  const writeQueue = createKeyedQueue();
  const updateProjectFields = (id, patch) =>
    writeQueue.run(id, () => runUpdateProjectFields(id, patch));

  // 补丁字段 → 本地 UI 字段（乐观写入 / 失败回滚用）；pdfText 不进列表 state，故意不列。
  // 本地乐观字段派生自字段注册表（localPatch 标记）。
  const LOCAL_PATCH_FIELDS = localPatchKeys();
  const applyPatchToLocal = (project, patchObj) => {
    const next = { ...project };
    let touched = false;
    for (const key of LOCAL_PATCH_FIELDS) {
      if (!(key in (patchObj || {}))) continue;
      next[key] = key === "checklist" ? normalizeChecklist(patchObj[key]) : patchObj[key];
      touched = true;
    }
    return touched ? next : null;
  };

  async function runUpdateProjectFields(id, patch) {
    const client = getClient();
    const state = getState();
    // v0.30.0：离线快照下拦截写操作（同 saveProject）——此前四处写入口没拦，
    // 快照里点“核对”会静默失败，还以为已保存。
    if (state.offlineSnapshot) {
      ui.showToast("当前为离线快照，联网后才能更新。");
      return false;
    }
    await ensureExtraColumns();
    const current = getState().projects.find((p) => p.id === id);
    if (!current) return false;
    const patchObj = typeof patch === "function" ? patch(current) : patch;
    const dbPatch = {};
    // UI 键 → DB 列派生自注册表（patchable 标记）；
    // 第 4 批第 1 步：5 个 AI 列已从注册表移除，不再经此通道回写。
    // 开标时刻 / 中标结果 / 状态一键切换见 v0.35.0。
    const fieldMap = patchFieldMap();
    let needsMigration = false;
    for (const [uiKey, dbKey] of Object.entries(fieldMap)) {
      if (!(uiKey in (patchObj || {}))) continue;
      if (!extraColumns && EXTRA_LIST_COLUMNS.includes(dbKey)) {
        needsMigration = true;
        continue;
      }
      let value = patchObj[uiKey];
      if (uiKey === "checklist") value = normalizeChecklist(value);
      if (uiKey === "pdfText" && typeof value === "string" && value.length > 200000) {
        value = `${value.slice(0, 200000)}\n\n[文本过长，已截断]`;
      }
      dbPatch[dbKey] = value;
    }
    if (needsMigration) {
      ui.showToast("这个字段需要先迁移：在 Supabase SQL Editor 执行 docs/migrations/v0.35.0-bid-time-result.sql。");
    }
    if (!Object.keys(dbPatch).length) return false;
    // 先乐观写入本地（不渲染）：排队中的下一次 patch 函数看到的是本次改动后的值。
    const optimistic = applyPatchToLocal(current, patchObj);
    if (optimistic) {
      setState({ projects: upsertById(getState().projects, optimistic) });
    }
    // v0.31.0：取回整行本地提交，不再全量重拉（listColumns() 不含 pdf_text，
    // 与列表重拉后的 state 一致）。
    const { data, error } = await client
      .from("projects")
      .update(dbPatch)
      .eq("id", id)
      .eq("user_id", state.user.id)
      .select(listColumns())
      .single();
    if (error) {
      // 回滚本次乐观写入（只改本次涉及的字段，不碰其它刚写完的值）+ 重渲染还原 UI。
      if (optimistic) {
        const revert = { ...current };
        setState({ projects: upsertById(getState().projects, revert) });
        afterLocalChange([id]);
      }
      if (MISSING_COLUMN_PATTERN.test(error.message || "")) {
        ui.showToast("保存失败：先在 Supabase SQL Editor 执行 supabase.sql 的 v0.3.0 增量迁移。");
      } else if (/bid_time|result/.test(error.message || "")) {
        ui.showToast("保存失败：先在 Supabase 执行 v0.35.0 迁移（bid_time / result 列）。");
      } else {
        ui.showToast(`保存失败：${error.message}`);
      }
      return false;
    }
    upsertLocalProject(data);
    afterLocalChange([data?.id || id]);
    return true;
  }

  /**
   * 删除 = 移入回收站（软删除），不是彻底删除。
   * 保留 deleted_at，30 天内可在回收站恢复，过期自动彻底删除。
   */
  async function deleteProject(id) {
    const client = getClient();
    const state = getState();
    // v0.12.0：离线快照下拦截删除（同 saveProject）
    if (state.offlineSnapshot) {
      ui.showToast("当前为离线快照，联网后才能删除。");
      return false;
    }
    const project = state.projects.find((p) => p.id === id);
    if (!project) return false;
    if (
      !(await ui.confirmDialog({
        title: "移入回收站",
        message: `将「${project.name}」移入回收站吗？${TRASH_RETENTION_DAYS} 天内可在回收站恢复。`,
        confirmText: "移入回收站",
      }))
    )
      return false;
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
      // v0.31.0：删除失败时把刚才折叠起来的行恢复原样（之前失败后行一直缩着，直到下次渲染才回来）。
      if (row) {
        row.style.height = "";
        row.style.overflow = "";
        row.classList.remove("leaving");
      }
      ui.showToast(`删除失败：${error.message}`);
      return false;
    }
    // v0.31.0：本地移除 + 定向渲染，不再全量重拉。
    removeLocalProjects([id]);
    afterLocalChange();
    ui.showToast(`已移到回收站，${TRASH_RETENTION_DAYS} 天内可在回收站恢复。`);
    return true;
  }

  /**
   * v0.6.0：批量删除 = 批量移入回收站。一次 confirm、一次 update、一个 toast。
   */
  async function deleteProjects(ids) {
    const client = getClient();
    const state = getState();
    // v0.12.0：离线快照下拦截批量删除（同 saveProject）
    if (state.offlineSnapshot) {
      ui.showToast("当前为离线快照，联网后才能删除。");
      return false;
    }
    const list = [...new Set(ids || [])];
    if (!list.length) return false;
    if (
      !(await ui.confirmDialog({
        title: "移入回收站",
        message: `将 ${list.length} 个项目移入回收站吗？${TRASH_RETENTION_DAYS} 天内可在回收站恢复。`,
        confirmText: "全部移入回收站",
      }))
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
    // v0.31.0：本地移除 + 定向渲染，不再全量重拉。
    removeLocalProjects(list);
    afterLocalChange();
    ui.showToast(`已将 ${list.length} 个项目移到回收站。`);
    return true;
  }

  async function restoreProject(id) {
    const client = getClient();
    const state = getState();
    // v0.30.0：离线快照下拦截写操作（同上）。
    if (state.offlineSnapshot) {
      ui.showToast("当前为离线快照，联网后才能恢复项目。");
      return false;
    }
    // v0.31.0：取回整行本地提交（恢复的行回到主列表），不再全量重拉。
    const { data, error } = await client
      .from("projects")
      .update({ deleted_at: null })
      .eq("id", id)
      .eq("user_id", state.user.id)
      .select(listColumns())
      .single();
    if (error) {
      ui.showToast(`恢复失败：${error.message}`);
      return false;
    }
    upsertLocalProject(data);
    afterLocalChange([data?.id || id]);
    ui.showToast("项目已从回收站恢复。");
    return true;
  }

  async function permanentlyDeleteProject(id, name) {
    const client = getClient();
    const state = getState();
    // v0.30.0：离线快照下拦截写操作（同上）——确认框弹之前就拦，别让用户白确认一次。
    if (state.offlineSnapshot) {
      ui.showToast("当前为离线快照，联网后才能彻底删除。");
      return false;
    }
    if (
      !(await ui.confirmDialog({
        title: "彻底删除",
        message: `彻底删除「${name || "该项目"}」吗？删除后无法恢复。`,
        confirmText: "彻底删除",
        danger: true,
      }))
    )
      return false;
    const { error } = await client
      .from("projects")
      .delete()
      .eq("id", id)
      .eq("user_id", state.user.id);
    if (error) {
      ui.showToast(`彻底删除失败：${error.message}`);
      return false;
    }
    // v0.31.0：彻底删除的行本就不在主列表里，不用重拉；回收站抽屉由调用方刷新。
    ui.showToast("项目已彻底删除。");
    return true;
  }

  /**
   * v0.22.0：清空回收站 = 批量彻底删除。一次 confirm、一次 delete、一个 toast。
   * 与单条彻底删除共用同一张确认框样式，文案按数量走。
   */
  async function permanentlyDeleteProjects(ids) {
    const client = getClient();
    const state = getState();
    // 离线快照下拦截（同 deleteProjects）。
    if (state.offlineSnapshot) {
      ui.showToast("当前为离线快照，联网后才能删除。");
      return false;
    }
    const list = [...new Set(ids || [])];
    if (!list.length) return false;
    if (
      !(await ui.confirmDialog({
        title: "清空回收站",
        message: `将彻底删除回收站里的 ${list.length} 个项目吗？删除后无法恢复。`,
        confirmText: "全部彻底删除",
        danger: true,
      }))
    )
      return false;
    const { error } = await client
      .from("projects")
      .delete()
      .in("id", list)
      .eq("user_id", state.user.id);
    if (error) {
      ui.showToast(`清空回收站失败：${error.message}`);
      return false;
    }
    // v0.31.0：同上，不用重拉。
    ui.showToast(`已清空回收站，共彻底删除 ${list.length} 个项目。`);
    return true;
  }

  /**
   * v0.4.0：批量导入（CSV 解析后的 DB 形态行）。每批 100 条 insert。
   * 返回 { imported, failed }；失败 toast 报错。
   */
  async function importProjects(rows) {
    const client = getClient();
    const state = getState();
    // v0.12.0：离线快照下拦截导入（同 saveProject）
    if (state.offlineSnapshot) {
      ui.showToast("当前为离线快照，联网后才能导入。");
      return { imported: 0, failed: 0 };
    }
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return { imported: 0, failed: 0, skipped: 0 };
    // v0.28.0：导入去重 —— 与当前库比对（名称 + 开标时间 + 投标公司），重复行跳过并报数。
    const { fresh, duplicates } = dedupeImportRows(list, state.projects);
    if (!fresh.length) {
      ui.showToast(`全部 ${list.length} 条均已存在，未导入。`);
      return { imported: 0, failed: 0, skipped: duplicates };
    }
    let imported = 0;
    let failed = 0;
    const insertedRows = [];
    for (let i = 0; i < fresh.length; i += 100) {
      const batch = fresh.slice(i, i + 100).map((r) => ({ ...r, user_id: state.user.id }));
      // v0.31.0：取回插入的行本地提交，不再全量重拉。
      const { data, error } = await client
        .from("projects")
        .insert(batch)
        .select(listColumns());
      if (error) {
        failed += batch.length;
        ui.showToast(`导入失败（第 ${i + 1}–${i + batch.length} 条）：${error.message}`);
      } else {
        imported += batch.length;
        insertedRows.push(...(data || []));
      }
    }
    insertedRows.forEach((row) => upsertLocalProject(row));
    afterLocalChange();
    return { imported, failed, skipped: duplicates };
  }

  /**
   * v0.4.0：复制项目。副本：名称 +“（副本）”、状态回到“报名中”、
   * 保证金状态回到“未缴纳”、清单全部未完成、PDF 持久化字段清空；
   * 其余字段原样复制（含 4 个截止时间、金额/保证金数值），不复制 id / 时间戳 / deleted_at。
   */
  async function cloneProject(id) {
    const client = getClient();
    const state = getState();
    // v0.30.0：离线快照下拦截写操作（同上）。
    if (state.offlineSnapshot) {
      ui.showToast("当前为离线快照，联网后才能复制项目。");
      return false;
    }
    const project = state.projects.find((p) => p.id === id);
    if (!project) return false;
    if (
      !(await ui.confirmDialog({
        title: "复制项目",
        message: `复制「${project.name}」为新项目吗？`,
        confirmText: "复制",
      }))
    )
      return false;
    await ensureExtraColumns();
    // insert 载荷派生自注册表（uiToDbInsert：UI 形态 → DB 列）；
    // 副本特例仍显式覆盖：名称 +“（副本）”、状态回到“报名中”、
    // 中标结果不跟（副本是一次新投标）、保证金状态回到“未缴纳”、
    // 清单全部未完成、PDF 持久化字段清空；开标时刻随副本复制。
    const payload = stripUnavailableColumns({
      user_id: state.user.id,
      ...uiToDbInsert(project),
      name: `${project.name}（副本）`,
      status: "报名中",
      result: null,
      checklist: (project.checklist || []).map((item) => ({ ...item, done: false })),
      guarantee_status: "未缴纳",
      pdf_text: null,
      pdf_filename: null,
      pdf_parsed_at: null,
    });
    // v0.31.0：取回副本行本地提交，不再全量重拉。
    const { data, error } = await client
      .from("projects")
      .insert(payload)
      .select(listColumns())
      .single();
    if (error) {
      ui.showToast(`复制失败：${error.message}`);
      return false;
    }
    upsertLocalProject(data);
    afterLocalChange();
    ui.showToast(`已复制为「${payload.name}」。`);
    return true;
  }

  const exportCsv = (projects) => {
    // 导出列派生自注册表（csv 定义 + csvOrder 列序；v0.6.0：开标时间第一列，
    // v0.4.0：清单 + PDF 文件名补在末尾）。无 get 的列默认取 p[key] ?? ""；
    // 清单两列（计数 / 详情）由 checklist 字段的一对 get 得出。
    const columns = exportCsvColumns();
    const headers = columns.map((c) => c.label);
    const rows = projects.map((p) =>
      columns.map((c) =>
        typeof c.get === "function" ? c.get(p) : (p[c.key] ?? "")
      )
    );
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
   * v0.35.0：默认不包含 pdf_text（每项最多 20 万字，几十项就几十 MB，手机上容易内存告急）；
   * 需要全文备份时显式传 { includePdfText: true }。恢复逻辑兼容缺字段的行。
   */
  const exportBackup = async ({ includePdfText = false } = {}) => {
    const client = getClient();
    const state = getState();
    const uid = state.user?.id;
    if (!uid) {
      ui.showToast("未登录，无法备份。");
      return false;
    }
    try {
      await ensureExtraColumns();
      const PAGE_SIZE = 500;
      const MAX_ROWS = 10000;
      const allRows = [];
      let from = 0;
      while (from < MAX_ROWS) {
        const { data, error } = await client
          .from("projects")
          .select(includePdfText ? "*" : listColumns())
          .eq("user_id", uid)
          .order("created_at", { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || !data.length) break;
        allRows.push(...data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      // 第 4 批第 1 步：新备份不再带 5 个 AI 列（含全文备份的 select "*" 路径）。
      const exportRows = allRows.map(stripAiColumns);
      const now = new Date();
      const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const payload = {
        app: "bid-desk",
        version: APP_VERSION,
        exportedAt: now.toISOString(),
        includesPdfText: Boolean(includePdfText),
        count: exportRows.length,
        projects: exportRows,
      };
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json;charset=utf-8",
        })
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `bid-desk-backup-${stamp}.json`;
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
      ui.showToast(
        `备份已下载，共 ${exportRows.length} 条（含回收站，不含招标全文）。仅含项目，不含我的资质。`
      );
      return true;
    } catch (err) {
      ui.showToast(`备份失败：${err?.message || err}`);
      return false;
    }
  };

  // v0.8.1：从备份恢复 —— 只写本账号数据；库里有、备份里没有的项目一律不动。
  // decideOverwrite({ overlap, fresh }) 仅在有重叠时调用，返回 true = 覆盖已有。
  // v0.28.0：恢复前拍一张"恢复前快照"（仅内存）：被覆盖行的当前内容；
  // 写过程记进度（已写入条数、失败批次），失败时报清进度并给一次撤销机会。
  const restoreBackup = async (text, decideOverwrite) => {
    const client = getClient();
    const state = getState();
    const uid = state.user?.id;
    if (!uid) {
      ui.showToast("未登录，无法恢复。");
      return false;
    }
    const parsed = parseBackupPayload(text, uid);
    if (!parsed.ok) {
      ui.showToast(`恢复失败：${parsed.error}`);
      return false;
    }
    const { rows, duplicates } = parsed;
    if (!rows.length) {
      ui.showToast("备份中没有项目，无需恢复。");
      return false;
    }
    // 恢复前快照 + 本次写入记录（失败撤销用；成功时不产生额外开销以外的写入）
    let beforeRows = new Map();
    let writtenInsertIds = [];
    let writtenUpdateIds = [];
    let totalToWrite = 0;
    let failedBatch = 0;
    try {
      // 现有编号集合（只拉 id，分批同导出备份）
      const existingIds = new Set();
      const PAGE_SIZE = 500;
      const MAX_ROWS = 10000;
      let from = 0;
      while (from < MAX_ROWS) {
        const { data, error } = await client
          .from("projects")
          .select("id")
          .eq("user_id", uid)
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || !data.length) break;
        for (const row of data) existingIds.add(row.id);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      const { insert, update } = splitRestoreRows(rows, existingIds);
      // v0.35.0：三态决定 —— overwrite / insert-only / abort；取消就是一条都不写。
      let mode = "insert-only";
      if (update.length && typeof decideOverwrite === "function") {
        mode = resolveRestoreDecision(
          await decideOverwrite({ overlap: update.length, fresh: insert.length })
        );
      }
      if (mode === "abort") {
        ui.showToast("已取消恢复，没有写入任何数据。");
        return false;
      }
      const overwrite = mode === "overwrite";
      // 旧库没有 bid_time / result 列时，备份里带的这两列要去掉，否则整批 upsert 报错。
      await ensureExtraColumns();
      // 第 12 节 D：旧备份里的 bidding_company 可能缺失或为空白，数据库 CHECK 要求 trim() > 0，统一归一化为 '未填写'。
      // 第 4 批第 1 步：旧备份里的 5 个 AI 列恢复时剥离，不再写回库。
      const writeRows = rows.map(stripUnavailableColumns).map(stripAiColumns).map((row) => ({
        ...row,
        bidding_company: String(row.bidding_company || "").trim() || "未填写",
      }));
      // 恢复前快照：只拉会被覆盖的那些行的当前内容（覆盖模式才需要）
      if (overwrite && update.length) {
        const ids = update.map((r) => r.id);
        for (let k = 0; k < ids.length; k += 200) {
          const { data, error } = await client
            .from("projects")
            .select("*")
            .eq("user_id", uid)
            .in("id", ids.slice(k, k + 200));
          if (error) throw error;
          for (const row of data || []) beforeRows.set(row.id, row);
        }
      }
      totalToWrite = overwrite ? writeRows.length : writeRows.filter((r) => !existingIds.has(r.id)).length;
      const BATCH = 100;
      if (overwrite) {
        for (let i = 0; i < writeRows.length; i += BATCH) {
          const batch = writeRows.slice(i, i + BATCH);
          const { error } = await client
            .from("projects")
            .upsert(batch, { onConflict: "id" });
          if (error) {
            failedBatch = i / BATCH + 1;
            throw error;
          }
          for (const r of batch) {
            (existingIds.has(r.id) ? writtenUpdateIds : writtenInsertIds).push(r.id);
          }
        }
      } else {
        const freshRows = writeRows.filter((r) => !existingIds.has(r.id));
        for (let i = 0; i < freshRows.length; i += BATCH) {
          const batch = freshRows.slice(i, i + BATCH);
          const { error } = await client
            .from("projects")
            .insert(batch);
          if (error) {
            failedBatch = i / BATCH + 1;
            throw error;
          }
          writtenInsertIds.push(...batch.map((r) => r.id));
        }
      }
      const inserted = insert.length;
      const updated = overwrite ? update.length : 0;
      const skipped = duplicates + (overwrite ? 0 : update.length);
      await loadProjects();
      ui.showToast(
        `恢复完成：新增 ${inserted} 条${updated ? `，覆盖 ${updated} 条` : ""}${skipped ? `，跳过 ${skipped} 条` : ""}。`
      );
      return true;
    } catch (err) {
      const written = writtenInsertIds.length + writtenUpdateIds.length;
      await loadProjects();
      if (!written) {
        ui.showToast(`恢复失败：${err?.message || err}`);
        return false;
      }
      // 已写入一部分：报清进度，并给一次撤销机会。
      const undo = await ui.confirmDialog({
        title: "恢复失败",
        message: `已写入 ${written} 条（共 ${totalToWrite} 条），失败在第 ${failedBatch} 批：${err?.message || err}。是否撤销本次恢复，把已写入的内容还原？`,
        confirmText: "撤销本次恢复",
        cancelText: "保留已写入的",
      });
      if (!undo) return false;
      try {
        for (let i = 0; i < writtenInsertIds.length; i += 100) {
          const { error } = await client
            .from("projects")
            .delete()
            .eq("user_id", uid)
            .in("id", writtenInsertIds.slice(i, i + 100));
          if (error) throw error;
        }
        const back = writtenUpdateIds
          .map((id) => beforeRows.get(id))
          .filter(Boolean);
        for (let i = 0; i < back.length; i += 100) {
          const { error } = await client
            .from("projects")
            .upsert(back.slice(i, i + 100), { onConflict: "id" });
          if (error) throw error;
        }
        await loadProjects();
        ui.showToast("已撤销本次恢复。");
      } catch (undoErr) {
        await loadProjects();
        ui.showToast(`撤销失败：${undoErr?.message || undoErr}，请用备份文件手动恢复。`);
      }
      return false;
    }
  };

  // v0.29.0：企业资质库 —— 读 / 增改 / 删。资质库是企业档案，不进备份与重置。
  const QUAL_CATEGORIES = ["施工资质", "安全生产", "注册人员", "业绩", "其他"];
  // 表未建时（用户还没执行 supabase.sql 第 9 节）只提示一次，别每次登录都弹。
  let qualMissingToastShown = false;
  async function loadQualifications() {
    const client = getClient();
    const state = getState();
    const uid = state.user?.id;
    if (!uid) return [];
    const { data, error } = await client
      .from("qualifications")
      .select("*")
      .eq("user_id", uid)
      .order("category", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      if (error.code === "42P01") {
        if (!qualMissingToastShown) {
          qualMissingToastShown = true;
          ui.showToast(
            "资质库未就绪：请在 Supabase SQL Editor 执行 supabase.sql 第 9 节。"
          );
        }
        return [];
      }
      ui.showToast(`资质库加载失败：${error.message}`);
      return [];
    }
    return (data || []).map((row) => ({
      id: row.id,
      category: row.category,
      name: row.name,
      details: row.details || "",
      expires_at: row.expires_at || "",
    }));
  }
  async function saveQualification(qual, editingId) {
    const state = getState();
    if (state.offlineSnapshot) {
      ui.showToast("当前为离线快照，联网后才能保存资质。");
      return false;
    }
    const category = String(qual?.category || "").trim();
    const name = String(qual?.name || "").trim().slice(0, 100);
    const details = String(qual?.details || "").trim().slice(0, 200);
    const expires_at = String(qual?.expires_at || "").trim() || null;
    if (!QUAL_CATEGORIES.includes(category)) {
      ui.showToast("请选择资质类别。");
      return false;
    }
    if (!name) {
      ui.showToast("请填写资质名称。");
      return false;
    }
    const payload = { category, name, details: details || null, expires_at };
    const query = editingId
      ? getClient()
          .from("qualifications")
          .update(payload)
          .eq("id", editingId)
          .eq("user_id", state.user.id)
      : getClient()
          .from("qualifications")
          .insert({ ...payload, user_id: state.user.id })
          .select("id")
          .single();
    const { data, error } = await query;
    if (error) {
      if (error.code === "42P01") {
        ui.showToast(
          "资质库未就绪：请在 Supabase SQL Editor 执行 supabase.sql 第 9 节。"
        );
      } else {
        ui.showToast(`保存失败：${error.message}`);
      }
      return false;
    }
    // v0.31.0：本地提交 + 只重绘资质列表，不再重拉整张资质表。
    const quals = [...(state.qualifications || [])];
    const saved = {
      id: editingId || data?.id || `tmp-${Date.now()}`,
      category,
      name,
      details: details || "",
      expires_at: expires_at || "",
    };
    const qi = quals.findIndex((q) => q.id === saved.id);
    if (qi >= 0) quals[qi] = saved;
    else quals.push(saved);
    setState({ qualifications: quals });
    ui.renderQualList(quals);
    ui.showToast(editingId ? "资质已更新。" : "资质已添加。");
    return editingId || data?.id || false;
  }
  async function deleteQualification(id) {
    const state = getState();
    if (state.offlineSnapshot) {
      ui.showToast("当前为离线快照，联网后才能删除资质。");
      return false;
    }
    const ok = await ui.confirmDialog({
      title: "删除资质",
      message: "确定删除这条资质吗？已用它对照过的分析结果不受影响。",
      confirmText: "删除",
      cancelText: "取消",
    });
    if (!ok) return false;
    const { error } = await getClient()
      .from("qualifications")
      .delete()
      .eq("id", id)
      .eq("user_id", state.user.id);
    if (error) {
      ui.showToast(`删除失败：${error.message}`);
      return false;
    }
    // v0.31.0：本地移除 + 只重绘资质列表，不再重拉整张资质表。
    const quals = (state.qualifications || []).filter((q) => q.id !== id);
    setState({ qualifications: quals });
    ui.renderQualList(quals);
    return true;
  }

  // v0.33.0：日历订阅令牌 —— 令牌即钥匙，凭令牌只读该用户的待开标项目。
  // v1.0.3：新令牌只把 SHA-256 哈希写入数据库，明文仅保存在生成设备的 localStorage；
  // 旧版明文 token 仍可读取，执行 supabase.sql 第 15 节后会迁移为哈希。
  // 表未建时（用户还没执行 supabase.sql 第 10 节）只提示一次，别每次打开都弹。
  let calendarMissingToastShown = false;
  const calendarTableMissing = (error) => {
    if (error?.code !== "42P01") return false;
    if (!calendarMissingToastShown) {
      calendarMissingToastShown = true;
      ui.showToast(
        "日历订阅未就绪：请先在 Supabase SQL Editor 执行 supabase.sql 第 10 节。"
      );
    }
    return true;
  };
  // 第 3 批：返回对象 { token, expired, expiresAt, lastReadAt }。
  // 新版哈希令牌无法从数据库反解，明文只从当前设备 localStorage 恢复；
  // 如果用户清空了本机存储，界面会提示重新生成链接。
  const calendarLocalTokenKey = (uid) => `bid-desk-calendar-token:${uid}`;
  const readLocalCalendarToken = (uid) => {
    try {
      const value = localStorage.getItem(calendarLocalTokenKey(uid));
      return isValidCalendarToken(value) ? value : null;
    } catch {
      return null;
    }
  };
  const saveLocalCalendarToken = (uid, token) => {
    try {
      localStorage.setItem(calendarLocalTokenKey(uid), token);
    } catch {
      // 无痕模式或存储已满时，链接仍会在当前界面显示。
    }
  };
  const clearLocalCalendarToken = (uid) => {
    try {
      localStorage.removeItem(calendarLocalTokenKey(uid));
    } catch {}
  };
  const sha256Hex = async (value) => {
    if (!globalThis.crypto?.subtle || typeof TextEncoder === "undefined") return null;
    const bytes = new TextEncoder().encode(value);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  };
  async function getCalendarToken() {
    const state = getState();
    const uid = state.user?.id;
    if (!uid) return null;
    const query = (columns) =>
      getClient()
        .from("calendar_tokens")
        .select(columns)
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1);
    let { data, error } = await query("token, token_hash, created_at, expires_at, last_read_at");
    if (error && /token_hash|expires_at|last_read_at/.test(error.message || "")) {
      ({ data, error } = await query("token, created_at"));
    }
    if (error) {
      if (calendarTableMissing(error)) return null;
      ui.showToast(`订阅链接读取失败：${error.message}`);
      return null;
    }
    const row = data?.[0];
    if (!row) return { token: null, expired: false, expiresAt: null, lastReadAt: null };
    const expired = isCalendarTokenExpired(row.expires_at);
    const localToken = row.token
      ? null
      : readLocalCalendarToken(uid);
    const localTokenMatches =
      Boolean(localToken && row.token_hash) &&
      (await sha256Hex(localToken)) === row.token_hash;
    return {
      token: expired ? null : row.token || (localTokenMatches ? localToken : null),
      expired,
      expiresAt: row.expires_at || null,
      lastReadAt: row.last_read_at || null,
    };
  }
  async function createCalendarToken() {
    const state = getState();
    const uid = state.user?.id;
    if (!uid) return null;
    if (state.offlineSnapshot) {
      ui.showToast("当前为离线快照，联网后才能生成订阅链接。");
      return null;
    }
    const token =
      globalThis.crypto?.randomUUID?.() ||
      `cal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    // 第 3 批：显式写 expires_at（与 DB 默认值一致，双保险）；第 13 节还没执行时
    // 该列不存在，降级为不带 expires_at 的插入（DB 默认值在执行后才生效）。
    const expiresAt = new Date(
      Date.now() + CALENDAR_TOKEN_TTL_DAYS * 24 * 3600 * 1000
    ).toISOString();
    const tokenHash = await sha256Hex(token);
    if (!tokenHash) {
      ui.showToast("当前浏览器不支持安全令牌生成，请使用最新版浏览器。");
      return null;
    }
    let { error } = await getClient()
      .from("calendar_tokens")
      .insert({ user_id: uid, token: null, token_hash: tokenHash, expires_at: expiresAt });
    if (error && /token_hash|expires_at/.test(error.message || "")) {
      // 兼容尚未执行第 15 节迁移的旧库：暂时沿用旧明文字段，升级后新链接会改为哈希。
      ({ error } = await getClient()
        .from("calendar_tokens")
        .insert({ user_id: uid, token, expires_at: expiresAt }));
      if (error && /expires_at/.test(error.message || "")) {
        ({ error } = await getClient()
          .from("calendar_tokens")
          .insert({ user_id: uid, token }));
      }
    }
    if (error) {
      if (calendarTableMissing(error)) return null;
      ui.showToast(`订阅链接生成失败：${error.message}`);
      return null;
    }
    saveLocalCalendarToken(uid, token);
    return token;
  }
  async function revokeCalendarTokens() {
    const state = getState();
    const uid = state.user?.id;
    if (!uid) return false;
    if (state.offlineSnapshot) {
      ui.showToast("当前为离线快照，联网后才能停用订阅。");
      return false;
    }
    const { error } = await getClient()
      .from("calendar_tokens")
      .delete()
      .eq("user_id", uid);
    if (error) {
      if (calendarTableMissing(error)) return false;
      ui.showToast(`停用订阅失败：${error.message}`);
      return false;
    }
    clearLocalCalendarToken(uid);
    return true;
  }

  return {
    loadProjects,
    loadDeletedProjects,
    loadProjectPdfText,
    purgeExpiredTrash,
    migrateLocalProjects,
    subscribeToProjects,
    applyRealtimeChange,
    saveProject,
    updateProjectFields,
    importProjects,
    cloneProject,
    deleteProject,
    deleteProjects,
    restoreProject,
    permanentlyDeleteProject,
    permanentlyDeleteProjects,
    exportCsv,
    exportBackup,
    restoreBackup,
    loadQualifications,
    saveQualification,
    deleteQualification,
    getCalendarToken,
    createCalendarToken,
    revokeCalendarTokens,
    isCalendarTableMissing: () => calendarMissingToastShown,
    toUiProject,
    validate,
  };
}
