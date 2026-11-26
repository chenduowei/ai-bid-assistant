/* AI Bid Assistant — PWA Service Worker（版本以 CACHE_NAME 为准，v0.35.0 起注释不再另写版本号）
 * 缓存应用壳（不含 supabase-config.js：该文件只存在于用户本地部署，
 * 缓存它会在全新部署上导致 addAll 整体失败）。离线时返回缓存页面。
 * 铁律：每次发版必须同步改 CACHE_NAME，否则旧缓存钉住新版、
 * 用户刷新也看不到新功能（v0.8.1 教训：只改了页面没改 sw.js，
 * 缓存名不变导致新版按钮一直不出现）。发版前跑 npm run check:version 校验。
 */
const CACHE_NAME = "bid-assistant-v1.0.3";
const APP_SHELL = [
  "./",
  "./index.html",
  // v0.51.4 batch3：styles.css 已拆成 css/ 下 5 个文件（按 index.html 引用顺序进壳）
  "./css/base.css",
  "./css/layout.css",
  "./css/components.css",
  "./css/views.css",
  "./css/breakpoints.css",
  "./app.js",
  "./js/utils.js",
  "./js/fields.js",
  "./js/ui.js",
  "./js/projects.js",
  "./js/auth.js",
  "./js/data-io.js",
  // v0.35.0：四个抽屉的交互模块（app.js 直接 import，漏在壳外离线会断）
  "./js/drawers.js",
  // v0.51.5：设置弹窗交互模块（同上）
  "./js/settings.js",
  // v0.34.0：js/ics.js 之前漏在壳外（目前只被 api/calendar.js 引入，浏览器侧暂未 import，
  // 但补上后 APP_SHELL 与 js/ 目录一一对应；将来客户端直接 import 也不会离线断）。
  "./js/ics.js",
  // v0.35.0：Supabase SDK 改为仓库内 vendor 文件，一并进壳（离线时也至少能打开外壳）
  "./vendor/supabase-2.117.3.min.js",
  "./favicon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  // v0.55.0 B7：iOS 启动图（index.html 里 8 档 apple-touch-startup-image 的同一批文件）
  "./icons/splash-1290x2796.png",
  "./icons/splash-1179x2556.png",
  "./icons/splash-1284x2778.png",
  "./icons/splash-1170x2532.png",
  "./icons/splash-1125x2436.png",
  "./icons/splash-1242x2688.png",
  "./icons/splash-750x1334.png",
  "./icons/splash-640x1136.png",
  "./manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        // P0 修复：不用 cache.addAll()——它原子失败，清单里一个文件 404
        // 就整壳装不上；v0.50 已删的 js/pdf-parser.js / js/ai-extract.js
        // 已从 APP_SHELL 移除。逐个缓存，单个失败只记日志、不阻塞安装。
        Promise.allSettled(APP_SHELL.map((url) => cache.add(url))).then(
          (results) => {
            const failed = results
              .map((r, i) => (r.status === "rejected" ? APP_SHELL[i] : null))
              .filter(Boolean);
            if (failed.length) {
              console.warn("[sw] 离线壳部分文件缓存失败：", failed);
            }
          }
        )
      )
      .then(() => self.skipWaiting())
      .catch((err) => {
        // 打开缓存本身失败才到这里：记日志，不阻塞页面，联机仍可正常使用
        console.warn("[sw] 打开离线缓存失败：", err);
      })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // 只接管同源请求；跨域（Supabase / CDN）一律走网络
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((res) => {
          // 导航请求离线兜底：网络失败时返回缓存的 index.html
          return res;
        })
        .catch(async () => {
          // v0.35.3：离线兜底必须一定返回一个 Response —— 原先直接把 caches.match() 的
          // 结果（可能 undefined）交给 respondWith，会抛 TypeError，控制台报错还看不出原因。
          if (request.mode === "navigate") {
            const shell = await caches.match("./index.html");
            if (shell) return shell;
          } else {
            const cached = await caches.match(request, { ignoreSearch: true });
            if (cached) return cached;
          }
          return new Response("", { status: 504, statusText: "Offline" });
        });
    })
  );
});
