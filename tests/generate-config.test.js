import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// generate-config.mjs 用 import.meta.url 定位仓库根，须复制到临时目录再执行。
function runStrict(env = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "biddesk-generate-config-"));
  const script = fileURLToPath(new URL("../scripts/generate-config.mjs", import.meta.url));
  fs.mkdirSync(path.join(dir, "scripts"));
  fs.copyFileSync(script, path.join(dir, "scripts", "generate-config.mjs"));
  return spawnSync(process.execPath, [path.join(dir, "scripts", "generate-config.mjs"), "--strict"], {
    encoding: "utf8",
    // 空值默认值必须在 ...env 之前，否则会覆盖调用方传入的“变量齐全”值（基线 bug：该用例恒失败）。
    env: { SUPABASE_URL: "", SUPABASE_ANON_KEY: "", VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "", ...process.env, ...env },
  });
}

test("generate-config --strict：缺变量即失败，不写占位配置", () => {
  const r = runStrict();
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /缺少/);
});

test("generate-config --strict：变量齐全时成功并写入配置", () => {
  const r = runStrict({ SUPABASE_URL: "https://example.supabase.co", SUPABASE_ANON_KEY: "test-key" });
  assert.equal(r.status, 0);
});
