// v0.9.0：版本一致性校验 —— package.json 是唯一事实来源，
// sw.js 缓存名、changelog 标题、页眉文案必须同步，否则发版后
// 旧缓存钉住新版（v0.8.1 教训）或用户报不出版本号。
// v0.14.1：README 与 notes.md 也纳入校验（此前两处长期停在 v0.8.0）。
// 用法：npm run check:version（发版前必跑）。
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = pkg.version;
const checks = [
  ["sw.js", `bid-assistant-v${version}`, readFileSync(join(root, "sw.js"), "utf8")],
  [
    "docs/changelog.md",
    `## [${version}]`,
    readFileSync(join(root, "docs/changelog.md"), "utf8"),
  ],
  ["index.html", `v${version}`, readFileSync(join(root, "index.html"), "utf8")],
  ["README.md", `v${version}`, readFileSync(join(root, "README.md"), "utf8")],
  [
    "docs/notes.md",
    `v${version}`,
    readFileSync(join(root, "docs/notes.md"), "utf8"),
  ],
  [
    "js/utils.js",
    `APP_VERSION = "${version}"`,
    readFileSync(join(root, "js/utils.js"), "utf8"),
  ],
];
let failed = false;
for (const [file, needle, text] of checks) {
  if (!text.includes(needle)) {
    console.error(
      `版本不一致：${file} 中找不到 ${needle}（package.json 当前为 ${version}）`
    );
    failed = true;
  }
}
if (failed) process.exit(1);
console.log(
  `版本一致：${version}（package.json / sw.js / changelog / 页眉 / README / notes / utils.js APP_VERSION）`
);
