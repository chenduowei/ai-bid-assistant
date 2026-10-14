/**
 * 招标文件 LLM 关键信息抽取与风险分析
 * 支持 OpenAI 兼容接口（OpenAI / DeepSeek / 通义等）
 * API Key 仅保存在浏览器 localStorage，不上传到本项目后端
 *
 * P0 增强：
 * - 抽取招标单位、项目金额
 * - 资格要求 / 废标条款独立结构化（不再默认拼进 notes）
 * - 超长文本分块摘要 + 汇总
 * - 结果校验与失败自动重试一次
 */

import {
  AI_KEY_STORAGE,
  AI_BASE_STORAGE,
  AI_MODEL_STORAGE,
} from "./utils.js";

const DEFAULT_BASE = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";
/** 单次请求建议上限（字符），超出则走分块 */
const CHUNK_CHARS = 24000;
const MAX_RETRIES = 1;
/** 单次模型请求超时（120 秒），防网络卡死一直转圈 */
const AI_REQUEST_TIMEOUT_MS = 120000;
const AI_MAX_TOKENS = 4000;

const SYSTEM_PROMPT = `你是工程建设行业招标文件分析助手。请根据用户提供的招标文件文本，提取关键投标信息，并识别废标风险与注意事项。
必须只输出一个合法 JSON 对象，不要 Markdown 代码块，不要其它说明。JSON 结构如下：
{
  "project_name": "项目名称",
  "project_type": "项目类型或工程类别",
  "tenderer": "招标人/招标单位或代理机构名称",
  "amount": "项目金额或投资估算原文摘要，无则空字符串",
  "bid_date": "开标日期，格式 YYYY-MM-DD，不确定则空字符串",
  "guarantee": "投标保证金或保函要求原文摘要",
  "contact": "招标人或代理机构联系人/电话摘要",
  "qualification": ["资格要求要点1", "要点2"],
  "invalid_bid_clauses": ["废标条款1", "条款2"],
  "risk_summary": "100字以内的整体风险摘要",
  "risk_points": [
    { "level": "high|medium|low", "text": "风险点描述" }
  ],
  "notes": "其它值得注意的信息（不要重复资格与废标条款）"
}`;

const CHUNK_SUMMARY_PROMPT = `你是工程建设行业招标文件分析助手。请对以下「招标文件片段」做要点摘要，重点保留：项目名称、招标单位、金额、开标时间、保证金、联系人、资格要求、废标条款、明显风险。
只输出纯文本摘要（不要 JSON），控制在 800 字以内。`;

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

function splitIntoChunks(text, maxChars = CHUNK_CHARS) {
  if (!text || text.length <= maxChars) return [text || ""];
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length) {
      // 尽量在段落边界切断
      const slice = text.slice(start, end);
      const lastBreak = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf("\n"),
        slice.lastIndexOf("。")
      );
      if (lastBreak > maxChars * 0.5) end = start + lastBreak + 1;
    }
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
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

/**
 * 严格校验并归一化开标日期。
 * 接受 YYYY-MM-DD / YYYY/MM/DD / YYYY年M月D日，非法日期（如 2026-02-30、
 * “待定”“详见文件”）返回 ""，避免塞进 <input type="date"> 被浏览器静默丢掉。
 */
function normalizeBidDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const m = raw.match(/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (!m) return "";
  const [, y, mo, d] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "";
  }
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function asStringArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "string" ? item.trim() : String(item?.text || item || "").trim()
      )
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function validateExtracted(raw) {
  if (!raw || typeof raw !== "object") {
    return "模型返回不是对象";
  }
  // 至少应有一项关键信息或风险
  const hasCore =
    raw.project_name ||
    raw.bid_date ||
    raw.guarantee ||
    (Array.isArray(raw.qualification) && raw.qualification.length) ||
    (Array.isArray(raw.invalid_bid_clauses) && raw.invalid_bid_clauses.length) ||
    raw.risk_summary ||
    (Array.isArray(raw.risk_points) && raw.risk_points.length);
  if (!hasCore) return "模型未提取到有效投标信息";
  return "";
}

export function createAiExtract({ ui }) {
  async function callChat(messages, onProgress) {
    const cfg = getAiConfig();
    if (!cfg.apiKey) {
      throw new Error("请先在「AI 设置」中填写 API Key。");
    }
    const body = {
      model: cfg.model,
      temperature: 0.2,
      max_tokens: AI_MAX_TOKENS,
      messages,
    };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (err?.name === "AbortError") {
        throw new Error("模型请求超时（120 秒），请检查网络或稍后重试。");
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `模型请求失败（${res.status}）：${errText.slice(0, 200) || res.statusText}`
      );
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("模型未返回有效内容。");
    return content;
  }

  async function summarizeChunks(chunks, onProgress) {
    const summaries = [];
    for (let i = 0; i < chunks.length; i++) {
      onProgress?.(
        `长文档分块摘要中（${i + 1}/${chunks.length}）…`
      );
      const content = await callChat(
        [
          { role: "system", content: CHUNK_SUMMARY_PROMPT },
          {
            role: "user",
            content: `【片段 ${i + 1}/${chunks.length}】\n\n${chunks[i]}`,
          },
        ],
        onProgress
      );
      summaries.push(`【片段 ${i + 1} 摘要】\n${content.trim()}`);
    }
    return summaries.join("\n\n");
  }

  async function analyzeOnce(textForModel, onProgress) {
    onProgress?.("正在调用大模型分析…");
    const content = await callChat(
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `请分析以下招标文件文本并按要求输出 JSON：\n\n${textForModel}`,
        },
      ],
      onProgress
    );
    onProgress?.("正在解析结构化结果…");
    const parsed = parseJsonLoose(content);
    const err = validateExtracted(parsed);
    if (err) throw new Error(err);
    return normalizeResult(parsed);
  }

  async function analyzeTenderText(fullText, onProgress) {
    if (!fullText || !String(fullText).trim()) {
      throw new Error("没有可分析的文本。");
    }
    const text = String(fullText);
    const chunks = splitIntoChunks(text, CHUNK_CHARS);
    let textForModel = text;

    if (chunks.length > 1) {
      onProgress?.(`文档较长（约 ${Math.round(text.length / 1000)}k 字），将分 ${chunks.length} 块摘要后汇总…`);
      textForModel = await summarizeChunks(chunks, onProgress);
      textForModel =
        textForModel +
        "\n\n[以上为分块摘要汇总，请基于这些摘要完成最终 JSON 抽取。]";
    }

    let lastError = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) onProgress?.(`结果校验失败，正在重试（${attempt}/${MAX_RETRIES}）…`);
        return await analyzeOnce(textForModel, onProgress);
      } catch (err) {
        lastError = err;
        // 网络/HTTP 错误也允许重试一次
        if (attempt >= MAX_RETRIES) break;
      }
    }
    throw lastError || new Error("AI 分析失败");
  }

  function normalizeResult(raw) {
    const riskPoints = Array.isArray(raw.risk_points)
      ? raw.risk_points
          .map((p) =>
            typeof p === "string"
              ? { level: "medium", text: p }
              : {
                  level: ["high", "medium", "low"].includes(p.level)
                    ? p.level
                    : "medium",
                  text: String(p.text || "").trim(),
                }
          )
          .filter((p) => p.text)
      : [];

    const qualification = asStringArray(raw.qualification);
    const invalidBidClauses = asStringArray(raw.invalid_bid_clauses);

    // notes 仅保留模型给出的其它信息，不再自动拼接资格/废标（已独立字段）
    const notes = String(raw.notes || "").trim();

    return {
      name: String(raw.project_name || "").trim(),
      type: String(raw.project_type || "").trim(),
      tenderer: String(raw.tenderer || "").trim(),
      amount: String(raw.amount || "").trim(),
      date: normalizeBidDate(raw.bid_date),
      guarantee: String(raw.guarantee || "").trim(),
      contact: String(raw.contact || "").trim(),
      notes,
      qualification,
      invalidBidClauses,
      riskSummary: String(raw.risk_summary || "").trim(),
      riskPoints,
      extractedMeta: {
        ...raw,
        _analyzed_at: new Date().toISOString(),
      },
    };
  }

  function applyToForm(elements, result) {
    const validDate = normalizeBidDate(result.date);
    if (validDate && elements.form.date) elements.form.date.value = validDate;
    if (result.type && elements.form.type)
      elements.form.type.value = result.type;
    if (result.name && elements.form.name)
      elements.form.name.value = result.name;
    if (result.tenderer && elements.form.tenderer)
      elements.form.tenderer.value = result.tenderer;
    // v0.3.0：项目金额已拆为数值 + 单位。AI 返回的是原文摘要，
    // 从中抽第一个数字填数值，并按“万元/元”关键字推断单位。
    if (result.amount && elements.form.amountValue) {
      const numMatch = String(result.amount).match(/-?\d[\d,]*(\.\d+)?/);
      if (numMatch) {
        elements.form.amountValue.value = numMatch[0].replace(/,/g, "");
      }
      if (elements.form.amountUnit) {
        if (String(result.amount).includes("万元"))
          elements.form.amountUnit.value = "万元";
        else if (String(result.amount).includes("元"))
          elements.form.amountUnit.value = "元";
      }
    } else if (result.amount && elements.form.amount) {
      elements.form.amount.value = result.amount;
    }
    // v0.4.0：保证金模型原文只写入“保证金要求原文”框（选填），不参与必填校验。
    if (result.guarantee && elements.form.guarantee)
      elements.form.guarantee.value = result.guarantee;
    if (result.contact && elements.form.contact)
      elements.form.contact.value = result.contact;
    if (result.notes && elements.form.notes)
      elements.form.notes.value = result.notes;
  }

  function renderAiResultPanel(container, result) {
    if (!container) return;
    const sanitizeLevel = (level) =>
      ["high", "medium", "low"].includes(level) ? level : "medium";
    const points = (result.riskPoints || [])
      .map(
        (p) =>
          `<li><span class="risk-level ${sanitizeLevel(p.level)}">${escape(p.level || "medium")}</span>${escape(p.text)}</li>`
      )
      .join("");
    const qual = (result.qualification || [])
      .map((q) => `<li>${escape(q)}</li>`)
      .join("");
    const invalid = (result.invalidBidClauses || [])
      .map((c) => `<li>${escape(c)}</li>`)
      .join("");
    const metaBits = [
      result.tenderer ? `招标单位：${escape(result.tenderer)}` : "",
      result.amount ? `项目金额：${escape(result.amount)}` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    container.innerHTML = `
      <div class="ai-result-card">
        <h3>AI 分析结果</h3>
        ${metaBits ? `<p class="ai-meta">${metaBits}</p>` : ""}
        <p class="risk-summary">${escape(result.riskSummary || "无摘要")}</p>
        ${
          qual
            ? `<div class="ai-section"><strong>资格要求</strong><ul class="struct-list">${qual}</ul></div>`
            : ""
        }
        ${
          invalid
            ? `<div class="ai-section"><strong>废标条款</strong><ul class="struct-list">${invalid}</ul></div>`
            : ""
        }
        ${points ? `<div class="ai-section"><strong>风险点</strong><ul class="risk-points">${points}</ul></div>` : ""}
        <p class="ai-hint">已尝试回填到「新增/编辑项目」表单，请核对后保存。资格要求与废标条款将结构化写入项目，保存后在卡片中展示。</p>
      </div>`;
  }

  function escape(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  return {
    analyzeTenderText,
    applyToForm,
    renderAiResultPanel,
    getAiConfig,
    saveAiConfig,
    loadAiConfigToForm,
    // 便于测试
    _test: {
      splitIntoChunks,
      parseJsonLoose,
      validateExtracted,
      normalizeResult,
      normalizeBidDate,
      asStringArray,
    },
  };
}
