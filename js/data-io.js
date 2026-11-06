/** 数据进出：导出 / 备份 / 恢复 / 导入 / 模板（v0.12.0 从 app.js 拆出）
 * 边界：只负责"文件 ↔ 行"的进出与按钮绑定，真正的入库 / 出库逻辑仍在 projects.js。
 * 调用方注入：elements（DOM）、getState（读当前项目）、ui（提示与确认框）、
 * projectsApi（exportCsv / exportBackup / restoreBackup / importProjects）、
 * loadSheetJS（首次导入 .xlsx 时按需加载 SheetJS，见 app.js）。
 */
import {
  parseCsvProjects,
  sheetRowsToCsv,
  buildImportCsvTemplate,
} from "./utils.js";

export function createDataIo({ elements, getState, ui, projectsApi, loadSheetJS }) {
  // v0.8.0：一键备份（直接拉 Supabase 全量，含回收站）+ 30 天备份提醒
  const runBackup = async () => {
    const ok = await projectsApi.exportBackup();
    if (ok) elements.backupTip?.classList.add("hidden");
  };

  const bindDataIo = () => {
    elements.exportBtn?.addEventListener("click", () =>
      // 导出当前筛选结果，与列表看到的一致，而非全量。
      projectsApi.exportCsv(
        ui.getCurrentFilteredProjects?.() ?? getState().projects
      )
    );

    elements.backupBtn?.addEventListener("click", runBackup);
    elements.backupNowBtn?.addEventListener("click", runBackup);
    elements.backupTipClose?.addEventListener("click", () =>
      elements.backupTip?.classList.add("hidden")
    );

    // v0.8.1：从备份恢复 —— 无重叠直接补齐；有重叠时一次确认：
    // 确定 = 用备份覆盖已有，取消 = 只补新增；库里有、备份里没有的一律不动
    // v0.12.0：离线快照下不打开文件选择框（恢复是写操作，写不上去）
    elements.restoreBtn?.addEventListener("click", () => {
      if (getState().offlineSnapshot) {
        ui.showToast("当前为离线快照，联网后才能恢复。");
        return;
      }
      elements.restoreFileInput?.click();
    });
    elements.restoreFileInput?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      let text = "";
      try {
        text = await file.text();
      } catch {
        ui.showToast("读取文件失败，重试。");
        return;
      }
      await projectsApi.restoreBackup(text, ({ overlap, fresh }) =>
        ui.confirmDialog({
          title: "恢复方式",
          message: `备份中有 ${overlap} 条已存在于当前数据库。点「覆盖已有」用备份覆盖它们，点「只补新增」只补新增的 ${fresh} 条。数据库里有、备份里没有的项目不会被删除。`,
          confirmText: "覆盖已有",
          cancelText: "只补新增",
        })
      );
    });

    elements.importBtn?.addEventListener("click", () =>
      elements.importFileInput?.click()
    );
    elements.downloadTemplateBtn?.addEventListener("click", () => {
      const csv = buildImportCsvTemplate();
      const url = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" })
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "项目导入模板.csv";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      ui.showToast("导入模板已下载。");
    });
    elements.importFileInput?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      let rows = [];
      let errors = [];
      if (/\.xlsx$/i.test(file.name)) {
        // v0.8.0：Excel 导入 —— 第一张表转 CSV 文本，复用 parseCsvProjects 的表头映射与校验
        if (!window.XLSX) {
          const loaded = await loadSheetJS();
          if (!loaded) {
            ui.showToast("Excel 解析库加载失败，请改用 CSV 导入。");
            return;
          }
        }
        try {
          const wb = window.XLSX.read(await file.arrayBuffer(), {
            type: "array",
          });
          const ws = wb.Sheets[wb.SheetNames[0]];
          if (!ws) throw new Error("空工作簿");
          const data = window.XLSX.utils.sheet_to_json(ws, {
            header: 1,
            defval: "",
            raw: false,
          });
          const parsed = parseCsvProjects(sheetRowsToCsv(data));
          rows = parsed.rows;
          errors = parsed.errors;
        } catch (err) {
          ui.showToast(`Excel 解析失败：${err?.message || err}`);
          return;
        }
      } else {
        let text = "";
        try {
          text = await file.text();
        } catch {
          ui.showToast("读取文件失败，重试。");
          return;
        }
        const parsed = parseCsvProjects(text);
        rows = parsed.rows;
        errors = parsed.errors;
      }
      if (!rows.length) {
        const detail = errors
          .slice(0, 3)
          .map((e) => `第${e.line}行：${e.reason}`)
          .join("；");
        ui.showToast(`没有可导入的行。${detail || ""}`);
        return;
      }
      const { imported, failed, skipped: dupSkipped = 0 } =
        await projectsApi.importProjects(rows);
      // v0.12.0：离线快照下 importProjects 已拦截并提示过，此处不再补第二条 toast
      if (getState().offlineSnapshot) return;
      const skipped = errors.length + failed + dupSkipped;
      const detail = errors
        .slice(0, 2)
        .map((e) => `第${e.line}行：${e.reason}`)
        .join("；");
      const dupNote = dupSkipped ? `（含重复 ${dupSkipped} 条）` : "";
      ui.showToast(
        `成功导入 ${imported} 条${skipped ? `，跳过 ${skipped} 条${dupNote}${detail ? `：${detail}` : ""}` : "。"}` +
          (errors.length > 2 ? "（更多错误见控制台）" : "")
      );
      if (errors.length > 2) console.warn("CSV 导入跳过的行：", errors);
    });
  };

  return { bindDataIo };
}
