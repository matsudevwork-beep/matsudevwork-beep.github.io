/* オフライン対応（サービスワーカー）
   ・さいしょ に ひらいた とき、画面・しくみ・絵・声 を ぜんぶ スマホ に とっておく（2026-11-17 代表：ネット なし でも ぜんぶ つかいたい）
     とっておく いちらん は offline-files.js（node tools/build_offline_list.js で つくる）
   ・ふだん は まず ネット から 最新 を 取りに行き、つながらない とき だけ とっておいた 版 を つかう */
importScripts("offline-files.js");
const CACHE = "bunyu-" + self.OFFLINE_VERSION;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) =>
    // 1こ ずつ とっておく（どれか 1こ が とれなくても、ほか は のこす）
    Promise.all(self.OFFLINE_FILES.map((f) =>
      fetch(f, { cache: "no-cache" }).then((res) => (res.ok ? c.put(f, res) : null)).catch(() => {})))));
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
    fetch(e.request, { cache: "no-cache" })   // スマホに ためた古い版を使わず、毎回 新しいか 確かめる
      .then((res) => {
        if (res.ok || res.type === "opaque") {  // 文字の形（Google Fonts）なども とっておく
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit ||
        // 「?」つき の アドレス で ひらいた とき も、とっておいた 画面 を だす
        (e.request.mode === "navigate" ? caches.match("./", { ignoreSearch: true }) : undefined)))
  );
});
