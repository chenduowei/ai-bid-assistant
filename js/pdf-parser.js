/** 客户端 PDF 文本提取（pdf.js，不上传） */

let pdfjsLib = null;

async function getPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import(
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs"
  );
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
  return pdfjsLib;
}

export function createPdfParser({ elements, ui }) {
  // 解析竞态令牌：每次 parsePdf 自增，旧任务在每个 await 后检查令牌，
  // 若已不是最新任务则静默放弃，不再写 UI、不再弹失败提示。
  let parseSeq = 0;
  let currentLoadingTask = null;

  const setParseProgress = (percent, text) => {
    elements.parserStatus.classList.remove("hidden");
    elements.parseProgress.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    elements.parseProgressText.textContent = text;
  };

  async function parsePdf(file) {
    const maxSize = 50 * 1024 * 1024;
    if (!file) return null;
    if (file.size > maxSize) {
      ui.showToast("PDF 文件不能超过 50 MB。");
      return null;
    }
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      ui.showToast("选择 PDF 文件。");
      return null;
    }
    const mySeq = ++parseSeq;
    const isStale = () => mySeq !== parseSeq;
    // 取消上一次未完成的加载任务（新文件优先），旧任务的 reject 会走作废静默路径
    if (currentLoadingTask) {
      try {
        currentLoadingTask.destroy();
      } catch {
        // 忽略销毁错误
      }
      currentLoadingTask = null;
    }
    // 允许同一文件重复选择：清空 input，否则 change 事件不会再次触发
    if (elements.pdfInput) elements.pdfInput.value = "";
    elements.pdfFileName.textContent = `文件：${file.name}`;
    elements.pdfPageCount.textContent = "总页数：读取中";
    elements.parsedText.value = "";
    elements.parsedText.classList.add("hidden");
    elements.toggleTextBtn.disabled = true;
    elements.copyTextBtn.disabled = true;
    if (elements.aiAnalyzeBtn) elements.aiAnalyzeBtn.disabled = true;
    elements.dropZone?.classList.add("parsing");
    setParseProgress(0, "正在加载 PDF…");
    let loadingTask = null;
    try {
      const pdfjs = await getPdfJs();
      if (isStale()) return null;
      const data = new Uint8Array(await file.arrayBuffer());
      if (isStale()) return null;
      loadingTask = pdfjs.getDocument({ data });
      currentLoadingTask = loadingTask;
      loadingTask.onProgress = (progress) => {
        if (isStale() || !progress.total) return;
        setParseProgress(
          (progress.loaded / progress.total) * 15,
          "正在读取 PDF 文件…"
        );
      };
      const pdf = await loadingTask.promise;
      if (isStale()) {
        try {
          pdf.destroy();
        } catch {
          // 忽略
        }
        return null;
      }
      elements.pdfPageCount.textContent = `总页数：${pdf.numPages}`;
      const pages = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        if (isStale()) {
          try { page.cleanup(); } catch { /* 忽略 */ }
          try { pdf.destroy(); } catch { /* 忽略 */ }
          return null;
        }
        const content = await page.getTextContent();
        if (isStale()) {
          try { page.cleanup(); } catch { /* 忽略 */ }
          try { pdf.destroy(); } catch { /* 忽略 */ }
          return null;
        }
        const pageText = content.items
          .map((item) => item.str)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        pages.push(`【第 ${pageNumber} 页】\n${pageText}`);
        page.cleanup();
        if (!isStale()) {
          setParseProgress(
            15 + (pageNumber / pdf.numPages) * 85,
            `正在解析第 ${pageNumber} / ${pdf.numPages} 页…`
          );
        }
      }
      if (isStale()) return null;
      const fullText = pages.join("\n\n");
      elements.parsedText.value = fullText;
      elements.toggleTextBtn.disabled = false;
      // 扫描版 / 图片 PDF 几乎没有文本层：平均每页少于 20 字即判定为可疑，
      // 避免用户拿着空文本去做 AI 分析、模型瞎编。此时禁用 AI 按钮并明示原因。
      const bodyText = pages
        .map((p) => p.replace(/^【第 \d+ 页】\n/, ""))
        .join("");
      const avgCharsPerPage =
        pdf.numPages > 0 ? bodyText.length / pdf.numPages : 0;
      const isScannedLike = pdf.numPages > 0 && avgCharsPerPage < 20;
      elements.copyTextBtn.disabled = !bodyText.trim();
      if (elements.aiAnalyzeBtn)
        elements.aiAnalyzeBtn.disabled = !bodyText.trim() || isScannedLike;
      setParseProgress(100, `解析完成，共 ${pdf.numPages} 页。`);
      if (isScannedLike) {
        ui.showToast(
          "该 PDF 几乎没有可提取文本，可能是扫描版 / 图片 PDF，请先用 OCR 转文字后再分析。"
        );
      } else {
        ui.showToast("PDF 解析完成。");
      }
      pdf.destroy();
      return fullText;
    } catch (error) {
      // 旧任务被新任务作废：静默返回，不弹失败提示、不重置进度（新任务在写进度）
      if (isStale()) return null;
      setParseProgress(0, "PDF 解析失败");
      ui.showToast(
        `PDF 解析失败：${error?.message || "请确认文件未损坏或受密码保护。"}`
      );
      return null;
    } finally {
      if (currentLoadingTask === loadingTask) currentLoadingTask = null;
      // 只有最新任务负责清理 parsing 态，避免旧任务的 finally 抹掉新任务的状态
      if (typeof isStale === "function" && !isStale()) {
        elements.dropZone?.classList.remove("parsing");
      }
    }
  }

  async function copyParsedText() {
    const text = elements.parsedText.value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      elements.parsedText.classList.remove("hidden");
      elements.parsedText.select();
      document.execCommand("copy");
    }
    ui.showToast("全文已复制。");
  }

  return { parsePdf, copyParsedText, setParseProgress };
}
