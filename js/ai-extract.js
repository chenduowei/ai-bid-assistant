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
  normalizeEvidenceItem,
  normalizeEvidenceItems,
  getEvidenceState,
  qualMatchBadge,
  qualMatchSummary,
} from "./utils.js";

const DEFAULT_BASE = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";
/** 单次请求建议上限（字符），超出则走分块
 * v0.18.2：24000 → 48000 —— 14.5 万字文档从 7 块减到 4 块，少 3 次往返；
 * 模型长上下文足够，单块摘要质量不受损。 */
const CHUNK_CHARS = 48000;
/** v0.18.2：分块摘要并行路数（2 路）。串行是慢的主因；3 路以上中转限流
 * 429 概率明显上升，2 路是速度与限流的平衡点，失败有退避与串行回退兜底。 */
const SUMMARY_CONCURRENCY = 2;
/** v0.18.2：流式进度估算 —— 单次请求内按已收字符占期望输出的比例推进，
 * 收到期望量时卡在 90%，请求完成再跳满；期望只是刻度，不是承诺。 */
const EXPECTED_SUMMARY_CHARS = 1600;
const EXPECTED_FINAL_CHARS = 6000;
const MAX_RETRIES = 1;
/** 单次模型请求超时（120 秒），防网络卡死一直转圈 */
const AI_REQUEST_TIMEOUT_MS = 120000;
const AI_MAX_TOKENS = 4000;
/** v0.29.0：终稿输出上限 8000 —— 终稿 JSON 含 page+quote，条目多时 4000 会截断；
 * 仅终稿调用用这个值，分块摘要仍用 4000。上限是封顶不是用量，短文档不会多花 token，
 * 长文档多花的只是超出 4000 的那部分输出 token。 */
const AI_FINAL_MAX_TOKENS = 8000;

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
  "qualification": [{"text": "资格要求要点", "page": 18, "quote": "对应的原文摘录，尽量短", "match": "matched|missing|unclear", "match_note": "对照自有资质的依据，一句话"}],
  "invalid_bid_clauses": [{"text": "废标条款", "page": 36, "quote": "对应的原文摘录，尽量短"}],
  "risk_summary": "100字以内的整体风险摘要",
  "risk_points": [
    { "level": "high|medium|low", "text": "风险点描述", "page": 12, "quote": "对应的原文摘录，尽量短" }
  ],
  "notes": "其它值得注意的信息（不要重复资格与废标条款）"
}
证据要求：每条 qualification、invalid_bid_clauses、risk_points 都必须带 page（数字，对应原文中的【第 N 页】标记）和 quote（该结论对应的原文摘录，不超过 100 字）；如果原文中找不到对应出处，page 写 null、quote 写空字符串，绝不要编造页码。`;

/** v0.29.0：把用户的自有资质拼成提示词片段（纯函数，可单测）。没有资质时
 * 返回空字符串，调用方不追加对照要求，模型只做常规提取。 */
function formatQualificationsForPrompt(list) {
  if (!Array.isArray(list) || !list.length) return "";
  return list
    .map((q) => {
      const name = String(q?.name || "").trim();
      if (!name) return null;
      const category = String(q?.category || "其他").trim();
      const details = String(q?.details || "").trim();
      const expires = String(q?.expires_at || "").trim();
      return (
        "- [" + category + "] " + name +
        (details ? "（" + details + "）" : "") +
        (expires ? "，有效期至 " + expires : "")
      );
    })
    .filter(Boolean)
    .join("\n");
}

const CHUNK_SUMMARY_PROMPT = `你是工程建设行业招标文件分析助手。请对以下「招标文件片段」做要点摘要，重点保留：项目名称、招标单位、金额、开标时间、保证金、联系人、资格要求、废标条款、明显风险。
只输出纯文本摘要（不要 JSON），控制在 800 字以内。摘要里保留每条信息的页码（原文【第 N 页】标记），不要丢掉出处；不同页的内容分开写，注明页码范围。`;

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

/**
 * 按页分块（v0.15.0）：返回 [{text, startPage, endPage}]。
 * 先按原文【第 N 页】标记切成页，再把整页打包进块；单页超长时页内再按
 * 段落边界切分。无页码标记的文本按旧逻辑纯按字符切。短文本返回单块。
 */
function splitIntoChunks(text, maxChars = CHUNK_CHARS) {
  const src = String(text || "");
  if (!src) return [{ text: "", startPage: null, endPage: null }];
  // 按页码标记切分：每段以【第 N 页】开头，未命中的开头部分归为 page=null。
  const markerRe = /【第\s*(\d+)\s*页】/g;
  const pages = [];
  let lastIndex = 0;
  let lastPage = null;
  let m;
  while ((m = markerRe.exec(src)) !== null) {
    if (m.index > lastIndex) {
      pages.push({ page: lastPage, text: src.slice(lastIndex, m.index) });
    }
    lastPage = Number(m[1]);
    lastIndex = m.index;
  }
  if (lastIndex < src.length) {
    pages.push({ page: lastPage, text: src.slice(lastIndex) });
  }
  // 页内按段落边界切分（旧逻辑）。
  const splitLong = (str) => {
    if (str.length <= maxChars) return [str];
    const out = [];
    let start = 0;
    while (start < str.length) {
      let end = Math.min(start + maxChars, str.length);
      if (end < str.length) {
        const slice = str.slice(start, end);
        const lastBreak = Math.max(
          slice.lastIndexOf("\n\n"),
          slice.lastIndexOf("\n"),
          slice.lastIndexOf("。")
        );
        if (lastBreak > maxChars * 0.5) end = start + lastBreak + 1;
      }
      out.push(str.slice(start, end));
      start = end;
    }
    return out;
  };
  const chunks = [];
  let current = null;
  const flush = () => {
    if (current) chunks.push(current);
    current = null;
  };
  const trackPage = (chunk, page) => {
    if (page === null) return;
    chunk.startPage =
      chunk.startPage === null ? page : Math.min(chunk.startPage, page);
    chunk.endPage =
      chunk.endPage === null ? page : Math.max(chunk.endPage, page);
  };
  for (const page of pages) {
    for (const part of splitLong(page.text)) {
      if (!current) {
        current = { text: part, startPage: null, endPage: null };
        trackPage(current, page.page);
        continue;
      }
      if (current.text.length + part.length <= maxChars) {
        current.text += part;
        trackPage(current, page.page);
      } else {
        flush();
        current = { text: part, startPage: null, endPage: null };
        trackPage(current, page.page);
      }
    }
  }
  flush();
  return chunks.length
    ? chunks
    : [{ text: "", startPage: null, endPage: null }];
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
  // v0.16.0：AI 结果面板折叠态（内存，同一轮分析内重渲染保持；换一份新结果时恢复展开）。
  let aiPanelCollapsed = false;
  let lastPanelResult = null;
  // v0.17.0：分析取消 —— 用户点“终止分析”时 abort 当前请求与后续分块。
  // 每次分析新建一个 controller；分析中再点分析先拦下，避免两路并发。
  let analysisController = null;
  const CANCELLED_MESSAGE = "已终止分析。";

  function cancelAnalysis() {
    analysisController?.abort();
  }

  // 合并多个 AbortSignal（超时 + 用户取消）：任一 abort 即 abort 合成信号。
  // 不用 AbortSignal.any（旧浏览器/Safari 低版本无此 API）。
  function combineSignals(...signals) {
    const ctrl = new AbortController();
    for (const s of signals) {
      if (!s) continue;
      if (s.aborted) {
        ctrl.abort(s.reason);
        return ctrl.signal;
      }
      s.addEventListener("abort", () => ctrl.abort(s.reason), { once: true });
    }
    return ctrl.signal;
  }

  // v0.18.2：流式（SSE）解析 —— parseSseChunk 是纯函数（可单测），一次只
  // 解析 buffer 里已完整的行，最后一行残段留给下次；data 行里的 delta.content
  // 拼起来就是本次输出。role-only 首包、[DONE]、注释行、坏行都跳过。
  function parseSseChunk(buffer) {
    const lines = String(buffer).split("\n");
    const rest = lines.pop();
    const contents = [];
    let truncated = false;
    for (let line of lines) {
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const obj = JSON.parse(data);
        const delta = obj.choices?.[0]?.delta?.content;
        if (delta) contents.push(delta);
        const msg = obj.choices?.[0]?.message?.content;
        if (msg) contents.push(msg);
        // v0.29.0：finish_reason=length 说明输出撞到上限被截断。
        if (obj.choices?.[0]?.finish_reason === "length") truncated = true;
      } catch {
        // 坏行跳过，不让一行脏数据毁掉整段输出
      }
    }
    return { contents, rest, truncated };
  }

  // 标记"中转不支持流式"：只在这种情况下回退非流式；取消、超时、HTTP 错
  // 误都不是它，不回退（回退了也一样错，还白费一次请求）。
  class StreamUnsupportedError extends Error {}

  // v0.18.2：读 SSE 流。onChars(已收字符数) 随 token 到达而回调，调用方据此
  // 在本次请求的进度带里推进。流里没见到 SSE 数据（中转无视 stream 参数
  // 直接回了 JSON，或 body 不可读）即报 StreamUnsupported，由 callChat 回退。
  async function readStreamContent(res, signal, onChars) {
    const contentType = res.headers?.get?.("content-type") || "";
    if (!res.body || typeof res.body.getReader !== "function") {
      throw new StreamUnsupportedError("中转未返回可读流");
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let received = "";
    let truncated = false;
    let sawSse = contentType.includes("text/event-stream");
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { contents, rest, truncated: t } = parseSseChunk(buffer);
        buffer = rest;
        if (t) truncated = true;
        if (contents.length) sawSse = true;
        for (const c of contents) {
          received += c;
          onChars?.(received.length);
        }
      }
      buffer += decoder.decode();
      const tail = parseSseChunk(`${buffer}\n`);
      if (tail.truncated) truncated = true;
      for (const c of tail.contents) {
        received += c;
        onChars?.(received.length);
      }
    } finally {
      try {
        reader.cancel();
      } catch {
        // 读完/取消后无需再处理
      }
    }
    if (!sawSse) throw new StreamUnsupportedError("中转未返回 SSE 流");
    if (truncated) {
      throw new Error("模型输出被截断（超出输出上限），内容未能完整输出；请缩短文档后重试。");
    }
    if (!received) throw new Error("模型未返回有效内容。");
    return received;
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // 可重试的错误：限流与服务端瞬错才值得重试；401（密钥错）与取消不重试。
  const isRetryableError = (err) =>
    /429|500|502|503|504/.test(err?.message || "") ||
    /超时/.test(err?.message || "");

  async function postChatCompletions(cfg, body, signal) {
    let res;
    try {
      res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      // 用户取消优先于超时：两者都表现为 AbortError。
      if (signal?.aborted && err?.name === "AbortError") {
        // 区分取消与超时：取消信号 abort 时抛取消文案，否则报超时。
        throw new Error("模型请求超时（120 秒），请检查网络或稍后重试。");
      }
      // v0.29.0：fetch 抛错只剩网络层原因（域名不通/断网/Base URL 错），包一层中文。
      throw new Error("网络不通：模型请求未发出，请检查网络或 Base URL 设置。");
    }
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `模型请求失败（${res.status}）：${errText.slice(0, 200) || res.statusText}`
      );
    }
    return res;
  }

  async function callChatNonStream(messages, signal, cfg, maxTokens = AI_MAX_TOKENS) {
    const res = await postChatCompletions(
      cfg,
      {
        model: cfg.model,
        temperature: 0.2,
        max_tokens: maxTokens,
        messages,
      },
      signal
    );
    const data = await res.json();
    const choice = data.choices?.[0];
    // v0.29.0：finish_reason=length 说明输出撞到上限被截断——内容是不完整 JSON，
    // 直接报截断，别让下游拿半截 JSON 去猜。
    if (choice?.finish_reason === "length") {
      throw new Error("模型输出被截断（超出输出上限），内容未能完整输出；请缩短文档后重试。");
    }
    const content = choice?.message?.content;
    if (!content) throw new Error("模型未返回有效内容。");
    return content;
  }

  // v0.18.2：先试流式（边收 token 边通过 onStreamChars 推进度），中转不
  // 支持流式时回退一次非流式；取消/超时/HTTP 错误直接抛，不回退。
  // onStreamChars(已收字符数) 由调用方映射到本次请求的进度带。
  async function callChat(messages, onProgress, cancelSignal, onStreamChars, maxTokens = AI_MAX_TOKENS) {
    const cfg = getAiConfig();
    if (!cfg.apiKey) {
      throw new Error("请先在「AI 设置」中填写 API Key。");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
    const signal = combineSignals(controller.signal, cancelSignal);
    try {
      const streamRes = await postChatCompletions(
        cfg,
        {
          model: cfg.model,
          temperature: 0.2,
          max_tokens: maxTokens,
          stream: true,
          messages,
        },
        signal
      );
      try {
        return await readStreamContent(streamRes, signal, onStreamChars);
      } catch (err) {
        if (err instanceof StreamUnsupportedError) {
          return await callChatNonStream(messages, signal, cfg, maxTokens);
        }
        throw err;
      }
    } catch (err) {
      if (cancelSignal?.aborted) throw new Error(CANCELLED_MESSAGE);
      if (err?.name === "AbortError") {
        throw new Error("模型请求超时（120 秒），请检查网络或稍后重试。");
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // v0.18.2：分块摘要 2 路并行（worker 池，顺序由下标保证，摘要拼回时按原序）。
  // 进度是真的按完成量算：每块占 70/n 个点，块内流式按已收字符推进到该块的
  // 90%，块完成跳满；文案带已用时间与按已完成块平均耗时估的剩余时间。
  // 失败处理：限流/服务端错先退避重试一次，再失败进失败清单；并行跑完后，
  // 失败的块逐块串行再试一次（中转限流下串行更容易过），还失败才整体报错。
  // 取消与 401 这类不可重试错误不进失败清单，直接抛出去，不白费重试。
  async function summarizeChunks(chunks, onProgress, cancelSignal) {
    const n = chunks.length;
    const summaries = new Array(n);
    const fracs = new Array(n).fill(0);
    const startedAt = Date.now();
    let done = 0;
    let lastReportAt = 0;
    let lastPct = -1;
    const report = (force = false) => {
      const now = Date.now();
      const frac = fracs.reduce((a, b) => a + b, 0) / n;
      const pct = 10 + Math.round(frac * 70);
      // 流式回调来得密：百分比没变且 300ms 内报过就跳过，别让进度条 DOM 狂刷。
      if (!force && pct === lastPct && now - lastReportAt < 300) return;
      lastReportAt = now;
      lastPct = pct;
      const elapsed = Math.round((now - startedAt) / 1000);
      const avgMs = done > 0 ? (now - startedAt) / done : 0;
      const remain = Math.max(
        0,
        Math.round((avgMs * (n - done)) / SUMMARY_CONCURRENCY / 1000)
      );
      onProgress?.(
        `长文档分块摘要中（${done}/${n}）· 已用 ${elapsed} 秒${done > 0 ? `，预计还剩 ${remain} 秒` : ""}…`,
        pct
      );
    };

    const summarizeOne = async (i, attempts = 2) => {
      if (cancelSignal?.aborted) throw new Error(CANCELLED_MESSAGE);
      // v0.15.0：分块带页码区间进提示词，摘要才留得住出处。
      const chunk = chunks[i];
      const range =
        chunk.startPage !== null && chunk.endPage !== null
          ? chunk.startPage === chunk.endPage
            ? `第 ${chunk.startPage} 页`
            : `第 ${chunk.startPage}–${chunk.endPage} 页`
          : "";
      const label = range
        ? `【片段 ${i + 1}/${n} · ${range}】`
        : `【片段 ${i + 1}/${n}】`;
      let lastError = null;
      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          const content = await callChat(
            [
              { role: "system", content: CHUNK_SUMMARY_PROMPT },
              { role: "user", content: `${label}\n\n${chunk.text}` },
            ],
            onProgress,
            cancelSignal,
            // 流式进度：按已收字符占期望输出的比例推到该块的 90%，完成再跳满。
            (received) => {
              fracs[i] = Math.min(received / EXPECTED_SUMMARY_CHARS, 0.9);
              report();
            }
          );
          summaries[i] = `【片段 ${i + 1} 摘要${range ? ` · ${range}` : ""}】\n${content.trim()}`;
          fracs[i] = 1;
          done += 1;
          report(true);
          return;
        } catch (err) {
          if (err?.message === CANCELLED_MESSAGE) throw err;
          lastError = err;
          if (!isRetryableError(err) || attempt >= attempts) throw err;
          await sleep(1000 * attempt);
          if (cancelSignal?.aborted) throw new Error(CANCELLED_MESSAGE);
        }
      }
      throw lastError || new Error("分块摘要失败");
    };

    const failures = [];
    let next = 0;
    const workers = Array.from(
      { length: Math.min(SUMMARY_CONCURRENCY, n) },
      async () => {
        for (;;) {
          if (cancelSignal?.aborted) throw new Error(CANCELLED_MESSAGE);
          const i = next;
          next += 1;
          if (i >= n) return;
          try {
            await summarizeOne(i);
          } catch (err) {
            if (err?.message === CANCELLED_MESSAGE) throw err;
            if (!isRetryableError(err)) throw err;
            failures.push(i);
          }
        }
      }
    );
    await Promise.all(workers);
    // 串行回退：并行阶段失败的块逐块再试一次（限流下串行更容易过）。
    for (const i of failures) {
      if (cancelSignal?.aborted) throw new Error(CANCELLED_MESSAGE);
      await sleep(1000);
      await summarizeOne(i);
    }
    return summaries.join("\n\n");
  }

  async function analyzeOnce(textForModel, onProgress, cancelSignal, qualifications) {
    if (cancelSignal?.aborted) throw new Error(CANCELLED_MESSAGE);
    onProgress?.("正在调用大模型分析…", 85);
    // v0.29.0：资质对照 —— 把自有资质拼进终稿提示词，让模型逐条判断
    // （壹级 = 一级这类同义，本地字符串比对做不了，只能靠模型理解）。
    const qualBlock = formatQualificationsForPrompt(qualifications);
    const qualInstruction = qualBlock
      ? `

投标人自有资质（用于对照资格要求）：
${qualBlock}
对照要求：对每条 qualification 增加 match 字段（matched=自有资质满足、missing=自有资质不满足或缺失、unclear=无法判断）和 match_note 字段（一句话说明依据，如“自有壹级满足要求”）；没有提供自有资质时 match 写 unclear、match_note 写“未录入自有资质”。`
      : "";
    // v0.18.2：最终调用也走流式进度 —— 在 85→95 的带子里按已收字符推进，
    // 收到期望量卡在 94%，出结果再跳 95%；中转不支持流式时进度仍停在 85，
    // 与 v0.17.0 行为一致，不会更差。
    const content = await callChat(
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `请分析以下招标文件文本并按要求输出 JSON：\n\n${textForModel}${qualInstruction}`,
        },
      ],
      onProgress,
      cancelSignal,
      (received) => {
        const frac = Math.min(received / EXPECTED_FINAL_CHARS, 0.9);
        onProgress?.("正在调用大模型分析…", 85 + Math.round(frac * 10));
      },
      AI_FINAL_MAX_TOKENS
    );
    onProgress?.("正在解析结构化结果…", 95);
    const parsed = parseJsonLoose(content);
    const err = validateExtracted(parsed);
    if (err) throw new Error(err);
    return normalizeResult(parsed);
  }

  async function analyzeTenderText(fullText, onProgress, qualifications) {
    if (!fullText || !String(fullText).trim()) {
      throw new Error("没有可分析的文本。");
    }
    if (analysisController) {
      throw new Error("已有分析在进行中，请先终止当前分析。");
    }
    const controller = new AbortController();
    analysisController = controller;
    const cancelSignal = controller.signal;
    try {
      onProgress?.("正在准备分析…", 5);
      const text = String(fullText);
      const chunks = splitIntoChunks(text, CHUNK_CHARS);
      let textForModel = text;

      if (chunks.length > 1) {
        onProgress?.(
          `文档较长（约 ${Math.round(text.length / 1000)}k 字），将分 ${chunks.length} 块摘要后汇总…`,
          10
        );
        textForModel = await summarizeChunks(chunks, onProgress, cancelSignal);
        textForModel =
          textForModel +
          "\n\n[以上为分块摘要汇总，请基于这些摘要完成最终 JSON 抽取。]";
      }

      let lastError = null;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0)
            onProgress?.(`结果校验失败，正在重试（${attempt}/${MAX_RETRIES}）…`, 85);
          return await analyzeOnce(
            textForModel,
            onProgress,
            cancelSignal,
            qualifications
          );
        } catch (err) {
          // 取消不重试：直接把“已终止分析”抛出去，别让重试把它盖掉。
          if (err?.message === CANCELLED_MESSAGE) throw err;
          // v0.29.0：密钥错 / 模型名错 / 输出截断重试也没用，直接抛，别白白等一次。
          // 其余错误（429 / 5xx / 超时 / 网络闪断 / JSON 校验失败）仍重试一次。
          if (
            /模型请求失败（(401|403|404|400)）/.test(err?.message || "") ||
            /输出被截断/.test(err?.message || "")
          ) {
            throw err;
          }
          lastError = err;
          if (attempt >= MAX_RETRIES) break;
        }
      }
      throw lastError || new Error("AI 分析失败");
    } finally {
      if (analysisController === controller) analysisController = null;
    }
  }

  function normalizeResult(raw) {
    // v0.15.0：风险点带证据（page/quote/verified）；字符串旧形态兼容进对象。
    const riskPoints = Array.isArray(raw.risk_points)
      ? raw.risk_points
          .map((p) => {
            const item = normalizeEvidenceItem(p);
            if (!item) return null;
            return {
              level:
                p &&
                typeof p === "object" &&
                ["high", "medium", "low"].includes(p.level)
                  ? p.level
                  : "medium",
              ...item,
            };
          })
          .filter(Boolean)
      : [];

    const qualification = normalizeEvidenceItems(raw.qualification);
    const invalidBidClauses = normalizeEvidenceItems(raw.invalid_bid_clauses);

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

  // v0.19.0：面板底部只剩一个动作 ——「回填到表单」。分析只展示、不动表单；
  // 保存方式不在这里选：回填后表单自己的保存按钮即定新建/更新；文本与结论
  // 的直接保存走操作区的「保存到项目」。绑定与全局模式同一套面板。
  function renderAiResultPanel(container, result) {
    if (!container) return;
    if (lastPanelResult !== result) {
      aiPanelCollapsed = false;
      lastPanelResult = result;
    }
    const sanitizeLevel = (level) =>
      ["high", "medium", "low"].includes(level) ? level : "medium";
    // v0.15.0：分析结果面板只读展示证据（页码 + 原文 + 状态），核对开关在项目卡片上。
    const evidenceMeta = (item) => {
      const it = item && typeof item === "object" ? item : {};
      const state = getEvidenceState(it);
      const page = it.page
        ? `<span class="evidence-page">第 ${escape(it.page)} 页</span>`
        : "";
      const quote = it.quote
        ? `<span class="evidence-quote" title="${escape(it.quote)}">“${escape(it.quote)}”</span>`
        : "";
      // v0.29.0：资质对照徽标（只在资格要求条目上；面板是只读预览，徽标与卡片共用）。
      return `<div class="evidence-meta">${page}${quote}<span class="evidence-state ${state.cls}">${state.label}</span>${qualMatchBadge(it)}</div>`;
    };
    const points = (result.riskPoints || [])
      .map(
        (p) =>
          `<li><span class="risk-level ${sanitizeLevel(p.level)}">${escape(p.level || "medium")}</span><div class="risk-point-body"><div>${escape(p.text)}</div>${evidenceMeta(p)}</div></li>`
      )
      .join("");
    const qual = (result.qualification || [])
      .map((q) => `<li><div>${escape(q.text ?? q)}</div>${evidenceMeta(q)}</li>`)
      .join("");
    const qualSummary = qualMatchSummary(result.qualification);
    const invalid = (result.invalidBidClauses || [])
      .map((c) => `<li><div>${escape(c.text ?? c)}</div>${evidenceMeta(c)}</li>`)
      .join("");
    const metaBits = [
      result.tenderer ? `招标单位：${escape(result.tenderer)}` : "",
      result.amount ? `项目金额：${escape(result.amount)}` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    container.innerHTML = `
      <div class="ai-result-card${aiPanelCollapsed ? " collapsed" : ""}">
        <div class="ai-result-head"><h3>AI 分析结果</h3><button class="btn secondary section-collapse-btn" type="button" data-action="ai-panel-toggle" aria-expanded="${aiPanelCollapsed ? "false" : "true"}">${aiPanelCollapsed ? "展开" : "收起"}</button></div>
        <div class="ai-result-body">
        ${metaBits ? `<p class="ai-meta">${metaBits}</p>` : ""}
        <p class="risk-summary">${escape(result.riskSummary || "无摘要")}</p>
        ${
          qual
            ? `<div class="ai-section"><strong>资格要求</strong>${qualSummary ? `<span class="struct-summary">${escape(qualSummary)}</span>` : ""}<ul class="struct-list">${qual}</ul></div>`
            : ""
        }
        ${
          invalid
            ? `<div class="ai-section"><strong>废标条款</strong><ul class="struct-list">${invalid}</ul></div>`
            : ""
        }
        ${points ? `<div class="ai-section"><strong>风险点</strong><ul class="risk-points">${points}</ul></div>` : ""}
        </div>
        <div class="ai-next">
          <div class="ai-next-text">分析完成，请核对结果。</div>
        </div>
      </div>`;
    // v0.16.0：面板折叠开关（容器本身不替换，监听绑在本次渲染的按钮上即可）。
    container
      .querySelector('[data-action="ai-panel-toggle"]')
      ?.addEventListener("click", () => {
        aiPanelCollapsed = !aiPanelCollapsed;
        renderAiResultPanel(container, result);
      });
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
    cancelAnalysis,
    applyToForm,
    renderAiResultPanel,
    getAiConfig,
    saveAiConfig,
    loadAiConfigToForm,
    // 便于测试
    _test: {
      formatQualificationsForPrompt,
      splitIntoChunks,
      parseJsonLoose,
      validateExtracted,
      normalizeResult,
      normalizeBidDate,
      parseSseChunk,
    },
  };
}
