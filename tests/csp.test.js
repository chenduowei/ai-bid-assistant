import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const vercel = JSON.parse(
  fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8")
);
const headers = vercel.headers[0].headers;
const csp = headers.find((h) => h.key === "Content-Security-Policy");

test("batch3 CSP：已切强制，不再是 Report-Only", () => {
  assert.ok(csp, "vercel.json 应含 Content-Security-Policy 头");
  assert.equal(
    headers.some((h) => h.key === "Content-Security-Policy-Report-Only"),
    false,
    "不应再保留 Report-Only 头"
  );
});

test("batch3 CSP：script-src 只留 jsDelivr，cdnjs 已无人用", () => {
  const scriptSrc = csp.value.match(/script-src ([^;]+)/)[1];
  assert.match(scriptSrc, /cdn\.jsdelivr\.net/);
  assert.doesNotMatch(scriptSrc, /cdnjs\.cloudflare\.com/);
});

test("batch3 CSP：connect-src 收窄到 Supabase，不再放行任意 https:", () => {
  const connectSrc = csp.value.match(/connect-src ([^;]+)/)[1];
  assert.doesNotMatch(connectSrc, /(^| )https:( |$)/);
  assert.match(connectSrc, /https:\/\/\*\.supabase\.co/);
  assert.match(connectSrc, /wss:\/\/\*\.supabase\.co/);
});

test("batch3 CSP：worker-src 不再含 CDN 源，但保留 blob:（Supabase 实时同步心跳用 Blob Worker）", () => {
  const workerSrc = csp.value.match(/worker-src ([^;]+)/)[1];
  assert.doesNotMatch(workerSrc, /cdnjs\.cloudflare\.com/);
  assert.doesNotMatch(workerSrc, /cdn\.jsdelivr\.net/);
  assert.match(workerSrc, /blob:/);
});

test("batch3 HSTS：不在 vercel.json 里重复加，Vercel 平台默认已下发", () => {
  assert.equal(
    headers.some((h) => h.key === "Strict-Transport-Security"),
    false,
    "Vercel 默认已下发 HSTS（实测含 includeSubDomains + preload），自加会重复"
  );
});
