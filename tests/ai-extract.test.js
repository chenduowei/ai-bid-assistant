import { test } from "node:test";
import assert from "node:assert/strict";
import { createAiExtract } from "../js/ai-extract.js";

const { _test } = createAiExtract({ ui: {} });
const { normalizeBidDate, parseJsonLoose, validateExtracted, normalizeResult, splitIntoChunks } = _test;

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
