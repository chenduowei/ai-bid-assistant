import { test } from "node:test";
import assert from "node:assert/strict";
import { createAiExtract } from "../js/ai-extract.js";

const { _test } = createAiExtract({ ui: {} });
const { normalizeBidDate, parseJsonLoose, validateExtracted, normalizeResult, splitIntoChunks, parseSseChunk } = _test;

test("normalizeBidDate：只接受真实存在的 YYYY-MM-DD", () => {
  assert.equal(normalizeBidDate("2026-08-10"), "2026-08-10");
  assert.equal(normalizeBidDate("2026/8/10"), "2026-08-10");
  assert.equal(normalizeBidDate("2026年8月10日"), "2026-08-10");
  assert.equal(normalizeBidDate("2026-02-30"), "");
  assert.equal(normalizeBidDate("待定"), "");
  assert.equal(normalizeBidDate("详见文件"), "");
  assert.equal(normalizeBidDate(""), "");
  assert.equal(normalizeBidDate("2026-13-01"), "");
});

test("normalizeResult：非法日期不进表单字段", () => {
  const r = normalizeResult({ project_name: "某项目", bid_date: "2026年13月40日" });
  assert.equal(r.date, "");
  assert.equal(r.name, "某项目");
});

test("normalizeResult：风险等级白名单", () => {
  const r = normalizeResult({
    project_name: "某项目",
    risk_points: [{ level: 'high"><img src=x onerror=alert(1)>', text: "保证金过高" }],
  });
  assert.equal(r.riskPoints[0].level, "medium");
});

test("parseJsonLoose：能从 Markdown 代码块中取出 JSON", () => {
  const parsed = parseJsonLoose('```json\n{"project_name":"A","bid_date":"2026-08-10"}\n```');
  assert.equal(parsed.project_name, "A");
});

test("validateExtracted：空结果不通过", () => {
  assert.notEqual(validateExtracted({}), "");
  assert.equal(validateExtracted({ project_name: "A" }), "");
});

test("splitIntoChunks：短文本不切分，长文本切多块", () => {
  assert.equal(splitIntoChunks("abc").length, 1);
  assert.ok(splitIntoChunks("x".repeat(50000), 24000).length >= 3);
});

test("normalizeResult：结论带页码原文对象，字符串旧形态兼容", () => {
  const r = normalizeResult({
    project_name: "某项目",
    qualification: [
      { text: "须有施工资质", page: 18, quote: "投标人须具备…" },
      "旧字符串要点",
    ],
    invalid_bid_clauses: [{ text: "逾期无效", page: "第36页", quote: "原文" }],
    risk_points: [
      { level: "high", text: "保证金过高", page: 12, quote: "保证金 80 万" },
      { level: "critical", text: "等级非法" },
      "字符串风险点",
    ],
  });
  assert.deepEqual(r.qualification[0], {
    text: "须有施工资质",
    page: 18,
    quote: "投标人须具备…",
    verified: false,
  });
  assert.deepEqual(r.qualification[1], {
    text: "旧字符串要点",
    page: null,
    quote: "",
    verified: false,
  });
  assert.equal(r.invalidBidClauses[0].page, 36);
  assert.equal(r.riskPoints[0].level, "high");
  assert.equal(r.riskPoints[0].page, 12);
  assert.equal(r.riskPoints[1].level, "medium");
  assert.equal(r.riskPoints[2].level, "medium");
  assert.equal(r.riskPoints[2].text, "字符串风险点");
});

test("normalizeResult：给不出页码留 null，不编造", () => {
  const r = normalizeResult({
    project_name: "某项目",
    qualification: [{ text: "要点", page: null, quote: "" }],
  });
  assert.equal(r.qualification[0].page, null);
  assert.equal(r.qualification[0].quote, "");
});

test("splitIntoChunks：按页码标记分块并带页码区间", () => {
  const text =
    "【第 1 页】aaaa\n【第 2 页】bbbb\n【第 3 页】cccc";
  const chunks = splitIntoChunks(text, 100);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].startPage, 1);
  assert.equal(chunks[0].endPage, 3);
  const small = splitIntoChunks(text, 12);
  assert.ok(small.length >= 2);
  assert.equal(small[0].startPage, 1);
  assert.ok(small[small.length - 1].endPage === 3);
});

test("splitIntoChunks：无页码时按字符切，短文本单块", () => {
  const chunks = splitIntoChunks("x".repeat(50000), 24000);
  assert.ok(chunks.length >= 3);
  assert.equal(chunks[0].startPage, null);
  assert.equal(splitIntoChunks("abc").length, 1);
});

/* v0.17.0：分析进度与取消 —— 用桩 localStorage/fetch 测真逻辑 */

const AI_JSON = JSON.stringify({ project_name: "测试项目", bid_date: "2026-08-10" });

function stubLocalStorage() {
  const orig = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: () => "test-key",
    setItem: () => {},
    removeItem: () => {},
  };
  return () => {
    if (orig === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = orig;
  };
}

function stubFetchOk() {
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    text: async () => "",
    json: async () => ({ choices: [{ message: { content: AI_JSON } }] }),
  });
  return () => {
    globalThis.fetch = origFetch;
  };
}

function stubFetchHang() {
  const origFetch = globalThis.fetch;
  const abortErr = () =>
    Object.assign(new Error("aborted"), { name: "AbortError" });
  globalThis.fetch = (url, opts) =>
    new Promise((_, reject) => {
      const signal = opts?.signal;
      if (signal?.aborted) return reject(abortErr());
      signal?.addEventListener("abort", () => reject(abortErr()), { once: true });
    });
  return () => {
    globalThis.fetch = origFetch;
  };
}

test("analyzeTenderText：长文档进度百分比单调递增且小于 100", async () => {
  const restoreStorage = stubLocalStorage();
  const restoreFetch = stubFetchOk();
  try {
    const ai = createAiExtract({ ui: {} });
    const percents = [];
    const result = await ai.analyzeTenderText("x".repeat(50000), (msg, pct) => {
      if (typeof pct === "number") percents.push(pct);
    });
    assert.equal(result.name, "测试项目");
    assert.ok(percents.length >= 5, `应至少上报 5 次进度，实际 ${percents.length}`);
    for (const p of percents) {
      assert.ok(p > 0 && p < 100, `百分比应在 (0,100) 内，实际 ${p}`);
    }
    for (let i = 1; i < percents.length; i++) {
      assert.ok(percents[i] >= percents[i - 1], "百分比应单调不减");
    }
    assert.ok(percents.includes(85), "最终调用应在 85%");
  } finally {
    restoreFetch();
    restoreStorage();
  }
});

test("analyzeTenderText：终止分析抛“已终止分析。”且不重试", async () => {
  const restoreStorage = stubLocalStorage();
  const restoreFetch = stubFetchHang();
  try {
    const ai = createAiExtract({ ui: {} });
    const p = ai.analyzeTenderText("短文本", () => {});
    await new Promise((r) => setTimeout(r, 10));
    ai.cancelAnalysis();
    await assert.rejects(p, /已终止分析/);
  } finally {
    restoreFetch();
    restoreStorage();
  }
});

test("analyzeTenderText：分析进行中再调直接拒绝", async () => {
  const restoreStorage = stubLocalStorage();
  const restoreFetch = stubFetchHang();
  try {
    const ai = createAiExtract({ ui: {} });
    const first = ai.analyzeTenderText("短文本", () => {});
    await assert.rejects(ai.analyzeTenderText("短文本", () => {}), /已有分析在进行中/);
    ai.cancelAnalysis();
    await assert.rejects(first, /已终止分析/);
  } finally {
    restoreFetch();
    restoreStorage();
  }
});

/* v0.19.0：AI 面板底部只剩「回填到表单」—— 绑定与全局同一套，不再分
   新建/更新/直存/编辑四种按钮，也不再有「选择保存方式」与下拉框提示 */

function fakePanelContainer() {
  return { innerHTML: "", querySelector: () => null };
}

const PANEL_RESULT = {
  riskSummary: "风险摘要",
  qualification: [],
  invalidBidClauses: [],
  riskPoints: [],
};

test("renderAiResultPanel：面板底部只有一个「回填到表单」，不分模式", () => {
  const ai = createAiExtract({ ui: {} });
  const c = fakePanelContainer();
  ai.renderAiResultPanel(c, PANEL_RESULT);
  assert.ok(c.innerHTML.includes('data-action="ai-apply-form"'));
  assert.ok(c.innerHTML.includes("回填到表单"));
  assert.ok(c.innerHTML.includes("分析完成，请核对结果。"));
  assert.ok(!c.innerHTML.includes('data-action="ai-save-new"'));
  assert.ok(!c.innerHTML.includes('data-action="ai-save-update"'));
  assert.ok(!c.innerHTML.includes('data-action="ai-save-attach"'));
  assert.ok(!c.innerHTML.includes('data-action="ai-save-edit"'));
  assert.ok(!c.innerHTML.includes("选择保存方式"));
  assert.ok(!c.innerHTML.includes("已回填表单"));
});

/* ============ v0.18.2：分块放大 + 流式 SSE 解析 ============ */

test("splitIntoChunks：默认块大小 48k，14.5 万字切 4 块", () => {
  assert.equal(splitIntoChunks("x".repeat(50000)).length, 2);
  assert.equal(splitIntoChunks("x".repeat(145478)).length, 4);
  assert.equal(splitIntoChunks("abc").length, 1);
});

test("parseSseChunk：拼出 delta 内容，跳过首包/[DONE]/坏行", () => {
  const sse = [
    'data: {"choices":[{"delta":{"role":"assistant"}}]}',
    'data: {"choices":[{"delta":{"content":"你好"}}]}',
    'data: {"choices":[{"delta":{"content":"世界"}}]}',
    "data: [DONE]",
    "",
  ].join("\n");
  const { contents, rest } = parseSseChunk(`${sse}\n`);
  assert.deepEqual(contents, ["你好", "世界"]);
  assert.equal(rest, "");
});

test("parseSseChunk：行被 TCP 切半时残段留给下次", () => {
  const first = parseSseChunk('data: {"choices":[{"delta":{"content":"你');
  assert.deepEqual(first.contents, []);
  const second = parseSseChunk(`${first.rest}好"}}]}\n`);
  assert.deepEqual(second.contents, ["你好"]);
  assert.equal(second.rest, "");
});

test("parseSseChunk：坏行不毁掉整段输出", () => {
  const { contents } = parseSseChunk(
    'data: 不是 JSON\n\ndata: {"choices":[{"delta":{"content":"有效"}}]}\n'
  );
  assert.deepEqual(contents, ["有效"]);
});
