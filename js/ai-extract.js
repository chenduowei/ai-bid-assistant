/**
 * 招标文件 LLM 关键信息抽取与风险分析
 * 支持 OpenAI 兼容接口（OpenAI / DeepSeek / 通义等）
 * API Key 仅保存在浏览器 localStorage，不上传到本项目后端
 */

import {
  AI_KEY_STORAGE,
  AI_BASE_STORAGE,
  AI_MODEL_STORAGE,
} from "./utils.js";

const DEFAULT_BASE = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT = `你是工程建设行业招标文件分析助手。请根据用户提供的招标文件文本，提取关键投标信息，并识别废标风险与注意事项。
必须只输出一个合法 JSON 对象，不要 Markdown 代码块，不要其它说明。JSON 结构如下：
{
  "project_name": "项目名称",
  "project_type": "项目类型或工程类别",
  "bid_date": "开标日期，格式 YYYY-MM-DD，不确定则空字符串",
  "guarantee": "投标保证金或保函要求原文摘要",
  "contact": "招标人或代理机构联系人/电话摘要",
  "qualification": ["资格要求要点1", "要点2"],
  "invalid_bid_clauses": ["废标条款1", "条款2"],
  "risk_summary": "100字以内的整体风险摘要",
  "risk_points": [
    { "level": "high|medium|low", "text": "风险点描述" }
  ],
  "notes": "其它值得注意的信息"
}`;

function getAiConfig() {
  return {
    apiKey: localStorage.getItem(AI_KEY_STORAGE) || "",
    baseUrl: (localStorage.getItem(AI_BASE_STORAGE) || DEFAULT_BASE).replace(
      /\/$/,
      ""
    ),
    model: localStorage.getItem(AI_MODEL_STORAGE) || DEFAULT_MODEL,
  };
}

export function saveAiConfig({ apiKey, baseUrl, model }) {
  if (apiKey !== undefined) localStorage.setItem(AI_KEY_STORAGE, apiKey.trim());
  if (baseUrl !== undefined)
    localStorage.setItem(AI_BASE_STORAGE, baseUrl.trim() || DEFAULT_BASE);
  if (model !== undefined)
    localStorage.setItem(AI_MODEL_STORAGE, model.trim() || DEFAULT_MODEL);
}

export function loadAiConfigToForm(elements) {
  const cfg = getAiConfig();
  if (elements.aiApiKey) elements.aiApiKey.value = cfg.apiKey;
  if (elements.aiBaseUrl) elements.aiBaseUrl.value = cfg.baseUrl;
  if (elements.aiModel) elements.aiModel.value = cfg.model;
}

function truncateText(text, maxChars = 28000) {
  if (!text || text.length <= maxChars) return text;
  return (
    text.slice(0, maxChars) +
    "\n\n[文本过长，已截断。请优先分析前述内容中的开标、保证金、资格与废标条款。]"
  );
}

function parseJsonLoose(content) {
  let raw = (content || "").trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) raw = raw.slice(start, end + 1);
  return JSON.parse(raw);
}

export function createAiExtract({ ui }) {
  async function analyzeTenderText(fullText, onProgress) {
    const cfg = getAiConfig();
    if (!cfg.apiKey) {
      throw new Error("请先在「AI 设置」中填写 API Key。");
    }
    onProgress?.("正在调用大模型分析…");
    const body = {
      model: cfg.model,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `请分析以下招标文件文本并按要求输出 JSON：\n\n${truncateText(fullText)}`,
        },
      ],
    };
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `模型请求失败（${res.status}）：${errText.slice(0, 200) || res.statusText}`
      );
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("模型未返回有效内容。");
    onProgress?.("正在解析结构化结果…");
    const parsed = parseJsonLoose(content);
    return normalizeResult(parsed);
  }

  function normalizeResult(raw) {
    const riskPoints = Array.isArray(raw.risk_points)
      ? raw.risk_points.map((p) =>
          typeof p === "string"
            ? { level: "medium", text: p }
            : {
                level: ["high", "medium", "low"].includes(p.level)
                  ? p.level
                  : "medium",
                text: String(p.text || "").trim(),
              }
        )
      : [];
    return {
      name: String(raw.project_name || "").trim(),
      type: String(raw.project_type || "").trim(),
      date: String(raw.bid_date || "").trim(),
      guarantee: String(raw.guarantee || "").trim(),
      contact: String(raw.contact || "").trim(),
      notes: [
        raw.notes,
        Array.isArray(raw.qualification) && raw.qualification.length
          ? "【资格要求】\n" + raw.qualification.join("\n")
          : "",
        Array.isArray(raw.invalid_bid_clauses) && raw.invalid_bid_clauses.length
          ? "【废标条款】\n" + raw.invalid_bid_clauses.join("\n")
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
      riskSummary: String(raw.risk_summary || "").trim(),
      riskPoints,
      extractedMeta: raw,
    };
  }

  function applyToForm(elements, result) {
    if (result.date && elements.form.date) elements.form.date.value = result.date;
    if (result.type && elements.form.type)
      elements.form.type.value = result.type;
    if (result.name && elements.form.name)
      elements.form.name.value = result.name;
    if (result.guarantee && elements.form.guarantee)
      elements.form.guarantee.value = result.guarantee;
    if (result.contact && elements.form.contact)
      elements.form.contact.value = result.contact;
    if (result.notes && elements.form.notes)
      elements.form.notes.value = result.notes;
  }

  function renderAiResultPanel(container, result) {
    if (!container) return;
    const points = (result.riskPoints || [])
      .map(
        (p) =>
          `<li><span class="risk-level ${p.level}">${p.level}</span>${escape(p.text)}</li>`
      )
      .join("");
    container.innerHTML = `
      <div class="ai-result-card">
        <h3>AI 分析结果</h3>
        <p class="risk-summary">${escape(result.riskSummary || "无摘要")}</p>
        ${points ? `<ul class="risk-points">${points}</ul>` : ""}
        <p class="ai-hint">已尝试回填到「新增/编辑项目」表单，请核对后保存。保存后风险报告会显示在项目卡片上。</p>
      </div>`;
  }

  function escape(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  return {
    analyzeTenderText,
    applyToForm,
    renderAiResultPanel,
    getAiConfig,
    saveAiConfig,
    loadAiConfigToForm,
  };
}
