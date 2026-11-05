import { test, after} from "node:test";
import assert from "node:assert/strict";
import { createAiExtract} from "../js/ai-extract.js";

/* v0.18.2：流式 + 并行摘要的回归测试 —— fetch 与 localStorage 全局打桩
* （node --test 每个文件单独进程，桩只影响本文件）。 */

const origFetch = globalThis.fetch;
const origLocalStorage = globalThis.localStorage;
after(() => {
globalThis.fetch = origFetch;
globalThis.localStorage = origLocalStorage;
});

const store = {
"bid-assistant-ai-key": "k",
"bid-assistant-ai-base": "https://example.com/v1",
"bid-assistant-ai-model": "m",
};
globalThis.localStorage = {
getItem: (k) => store[k]?? "",
setItem: (k, v) => {
store[k] = v;
},
};

const enc = new TextEncoder();
const sseLine = (content) =>
`data: ${JSON.stringify({ choices: [{ delta: { content}}]})}\n`;
function sseReader(chunks) {
let i = 0;
return {
async read() {
if (i >= chunks.length) return { done: true, value: undefined};
return { done: false, value: enc.encode(chunks[i++])};
},
cancel() {},
};
}

const FINAL_JSON = JSON.stringify({
project_name: "P",
bid_date: "2026-12-01",
guarantee: "10万",
qualification: [{ text: "Q", page: 2, quote: "q"}],
invalid_bid_clauses: [],
risk_summary: "S",
risk_points: [],
});

test("analyzeTenderText：流式摘要 2 路并行、429 重试一次、摘要按原序进最终调用", async () => {
let fetchCalls = 0;
let failFirst429 = true;
let finalUserContent = "";
globalThis.fetch = async (url, opts) => {
const body = JSON.parse(opts.body);
fetchCalls += 1;
if (body.messages[0].content.includes("只输出一个合法 JSON")) {
finalUserContent = body.messages[1].content;
return {
ok: true,
headers: { get: () => "text/event-stream"},
body: {
getReader: () =>
sseReader([
sseLine(FINAL_JSON.slice(0, 30)),
sseLine(FINAL_JSON.slice(30)),
"data: [DONE]\n",
]),
},
};
}
if (failFirst429 && body.messages[1].content.includes("片段 1/")) {
failFirst429 = false;
return {
ok: false,
status: 429,
statusText: "Too Many Requests",
text: async () => "rate limited",
};
}
const frag = body.messages[1].content.match(/片段 (\d+)/)?.[1] || "?";
const text = `摘要${frag}内容`;
return {
ok: true,
headers: { get: () => "text/event-stream"},
body: {
getReader: () =>
sseReader([
sseLine(text.slice(0, 3)),
sseLine(text.slice(3)),
"data: [DONE]\n",
]),
},
};
};

const { analyzeTenderText} = createAiExtract({ ui: {}});
const page = (n) => "【第 " + n + " 页】\n" + "招标内容。".repeat(4000);
const text = page(1) + page(2) + page(3) + page(4) + page(5);
assert.equal(text.length, 100040);

const pcts = [];
const result = await analyzeTenderText(text, (msg, pct) => pcts.push(pct));
assert.equal(result.name, "P");
assert.equal(result.date, "2026-12-01");
// 3 块摘要按完成量推进（10→33→57→80），最终调用 85→95
for (const p of [5, 10, 33, 57, 80, 85, 95]) {
assert.ok(pcts.includes(p), `进度应经过 ${p}%`);
}
// 并行不乱序：最终调用收到的摘要仍是 1、2、3
assert.deepEqual(
[...finalUserContent.matchAll(/片段 (\d+) 摘要/g)].map((m) => m[1]),
["1", "2", "3"]
);
// 3 块摘要 + 429 重试 1 次 + 最终调用 = 5 次请求
assert.equal(fetchCalls, 5);
});

test("analyzeTenderText：中转不回 SSE 时回退非流式，仍能出结果", async () => {
globalThis.fetch = async (url, opts) => {
const body = JSON.parse(opts.body);
if (body.stream) {
return {
ok: true,
headers: { get: () => "application/json"},
body: { getReader: () => sseReader(['{"choices":[]}'])},
};
}
return {
ok: true,
text: async () => "",
json: async () => ({
choices: [
{
message: {
content: JSON.stringify({
project_name: "FB",
bid_date: "2026-11-01",
risk_summary: "x",
}),
},
},
],
}),
};
};

const { analyzeTenderText} = createAiExtract({ ui: {}});
const result = await analyzeTenderText("短文本测试", () => {});
assert.equal(result.name, "FB");
assert.equal(result.date, "2026-11-01");
});
