/* AI Bid Assistant — PWA Service Worker（v0.8.2）
 * 缓存应用壳（不含 supabase-config.js：该文件只存在于用户本地部署，
 * 缓存它会在全新部署上导致 addAll 整体失败）。离线时返回缓存页面。
 * 铁律：每次发版必须同步改 CACHE_NAME，否则旧缓存钉住新版、
 * 用户刷新也看不到新功能（v0.8.1 教训：只改了页面没改 sw.js，
 * 缓存名不变导致新版按钮一直不出现）。
 */
const CACHE_NAME = "bid-assistant-v0.8.2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./js/utils.js",
  "./js/ui.js",
  "./js/projects.js",
  "./js/auth.js",
  "./js/pdf-parser.js",
  "./js/ai-extract.js",
  "./favicon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => {
        // 首次缓存失败不阻塞页面，联机时仍可正常使用
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
        .catch(() => {
          if (request.mode === "navigate") {
            return caches.match("./index.html");
          }
          return caches.match(request, { ignoreSearch: true });
        });
    })
  );
});
