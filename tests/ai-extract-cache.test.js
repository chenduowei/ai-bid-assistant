import test from "node:test";
import assert from "node:assert/strict";
import {
  fastHash,
  chunkCacheKey,
  createChunkSummaryCache,
} from "../js/ai-extract.js";

/** 最小 sessionStorage 替身：只实现 getItem / setItem / removeItem。 */
function memoryStorage() {
  const map = new Map();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

test("fastHash：同文本同哈希，不同文本不同哈希，空文本也能算", () => {
  const a = fastHash("招标文件正文".repeat(500));
  const b = fastHash("招标文件正文".repeat(500));
  assert.equal(a, b);
  assert.notEqual(a, fastHash("招标文件正文".repeat(500) + "x"));
  assert.equal(typeof fastHash(""), "string");
  assert.ok(fastHash("").length > 0);
  // 只用于缓存键：必须是 URL/存储安全的字符
  assert.match(a, /^[0-9a-z]+$/);
});

test("chunkCacheKey：模型 / 提示词版本 / 块号 / 文档任一不同即不同键", () => {
  const base = { docHash: "abc123", chunkIndex: 0, model: "gpt-4o-mini" };
  const k = chunkCacheKey(base);
  assert.equal(k, chunkCacheKey({ ...base }));
  assert.notEqual(k, chunkCacheKey({ ...base, chunkIndex: 1 }));
  assert.notEqual(k, chunkCacheKey({ ...base, model: "deepseek-chat" }));
  assert.notEqual(k, chunkCacheKey({ ...base, docHash: "abc124" }));
  assert.notEqual(k, chunkCacheKey({ ...base, promptVersion: "2" }));
  assert.match(k, /^bidai:chunk:1:gpt-4o-mini:abc123:0$/);
  // 分块参数变了（同一块号对应不同正文）时，靠块正文哈希拒绝旧摘要
  assert.notEqual(k, chunkCacheKey({ ...base, chunkHash: "zz99" }));
  assert.match(chunkCacheKey({ ...base, chunkHash: "zz99" }), /:0:zz99$/);
});

test("createChunkSummaryCache：写入后可读，键之间互不串", () => {
  const storage = memoryStorage();
  const cache = createChunkSummaryCache(storage);
  assert.equal(cache.get("k1"), null);
  assert.equal(cache.set("k1", "【片段 1 摘要】金额 500 万"), true);
  assert.equal(cache.set("k2", "【片段 2 摘要】保证金 10 万"), true);
  assert.equal(cache.get("k1"), "【片段 1 摘要】金额 500 万");
  assert.equal(cache.get("k2"), "【片段 2 摘要】保证金 10 万");
  assert.equal(cache.get("k3"), null);
});

test("createChunkSummaryCache：超上限从最旧的开始淘汰，索引同步", () => {
  const storage = memoryStorage();
  const cache = createChunkSummaryCache(storage);
  for (let i = 0; i < 45; i += 1) cache.set(`k${i}`, `摘要 ${i}`);
  const index = JSON.parse(storage.getItem("bidai:chunk-index"));
  assert.equal(index.length, 40);
  // 最早的 5 条已被清掉，最新的还在
  assert.equal(cache.get("k0"), null);
  assert.equal(cache.get("k4"), null);
  assert.equal(cache.get("k5"), "摘要 5");
  assert.equal(cache.get("k44"), "摘要 44");
  // 重复写同一个键不占新位置，只把它挪到队尾
  cache.set("k5", "摘要 5 改写");
  const after = JSON.parse(storage.getItem("bidai:chunk-index"));
  assert.equal(after.length, 40);
  assert.equal(after[after.length - 1], "k5");
  assert.equal(cache.get("k5"), "摘要 5 改写");
});

test("createChunkSummaryCache：没有 storage 或 storage 抛错时静默降级", () => {
  const noStorage = createChunkSummaryCache(null);
  assert.equal(noStorage.get("k"), null);
  assert.equal(noStorage.set("k", "v"), false);

  // 隐私模式 / 配额满：setItem 抛错，不能把异常抛到分析流程里
  const full = {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
    removeItem: () => {},
  };
  const cache = createChunkSummaryCache(full);
  assert.equal(cache.get("k"), null);
  assert.equal(cache.set("k", "v"), false);
});

test("createChunkSummaryCache：空键或非字符串值不写", () => {
  const storage = memoryStorage();
  const cache = createChunkSummaryCache(storage);
  assert.equal(cache.set("", "v"), false);
  assert.equal(cache.set("k", null), false);
  assert.equal(storage.map.size, 0);
});
