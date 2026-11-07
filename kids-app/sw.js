/* オフライン対応（サービスワーカー）
   まずネットから最新を取りに行き、つながらないときだけ保存しておいた版を使う */
const CACHE = "aibou-proto-v17";
const FILES = ["./", "index.html", "style.css", "app.js", "characters.js", "levels.js", "hiragana.js", "katakana.js", "numbers.js", "games.js", "icon.svg", "manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
