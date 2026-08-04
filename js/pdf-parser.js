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
      ui.showToast("请选择 PDF 文件。");
      return null;
    }
    elements.pdfFileName.textContent = `文件：${file.name}`;
    elements.pdfPageCount.textContent = "总页数：读取中";
    elements.parsedText.value = "";
    elements.parsedText.classList.add("hidden");
    elements.toggleTextBtn.disabled = true;
    elements.copyTextBtn.disabled = true;
    if (elements.aiAnalyzeBtn) elements.aiAnalyzeBtn.disabled = true;
    setParseProgress(0, "正在加载 PDF…");
    try {
      const pdfjs = await getPdfJs();
      const data = new Uint8Array(await file.arrayBuffer());
      const loadingTask = pdfjs.getDocument({ data });
      loadingTask.onProgress = (progress) => {
        if (progress.total)
          setParseProgress(
            (progress.loaded / progress.total) * 15,
            "正在读取 PDF 文件…"
          );
      };
      const pdf = await loadingTask.promise;
      elements.pdfPageCount.textContent = `总页数：${pdf.numPages}`;
      const pages = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item) => item.str)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        pages.push(`【第 ${pageNumber} 页】\n${pageText}`);
        page.cleanup();
        setParseProgress(
          15 + (pageNumber / pdf.numPages) * 85,
          `正在解析第 ${pageNumber} / ${pdf.numPages} 页…`
        );
      }
      const fullText = pages.join("\n\n");
      elements.parsedText.value = fullText;
      elements.toggleTextBtn.disabled = false;
      elements.copyTextBtn.disabled = !fullText;
      if (elements.aiAnalyzeBtn) elements.aiAnalyzeBtn.disabled = !fullText;
      setParseProgress(100, `解析完成，共 ${pdf.numPages} 页。`);
      ui.showToast("PDF 文本解析完成。");
      pdf.destroy();
      return fullText;
    } catch (error) {
      setParseProgress(0, "解析失败");
      ui.showToast(
        `PDF 解析失败：${error?.message || "请确认文件未损坏或受密码保护。"}`
      );
      return null;
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
    ui.showToast("全文已复制到剪贴板。");
  }

  return { parsePdf, copyParsedText, setParseProgress };
}
