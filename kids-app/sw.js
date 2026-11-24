/* オフライン対応（サービスワーカー）
   ・有料・トライアル：画面・しくみ・絵・声 を ぜんぶ スマホ に とっておく（2026-11-17 代表）
     無料：画面・しくみ だけ。絵 と 声 は つかった もの だけ のこる（2026-11-24 代表：ネット なし は 有料 の 特典）
     とっておく いちらん は offline-files.js（node tools/build_offline_list.js で つくる）
   ・ふだん は まず ネット から 最新 を 取りに行き、つながらない とき だけ とっておいた 版 を つかう */
importScripts("offline-files.js");
const CACHE = "bunyu-" + self.OFFLINE_VERSION;

// さいしょ は 画面 と しくみ（html・css・js・アイコン）だけ。絵 と 声 は つかった とき に とっておく
// 有料・トライアル の とき だけ、アプリ が「ぜんぶ とっておいて」と たのむ（2026-11-24 代表：ネット なし は 有料 の 特典）
const isCore = (f) => f === "./" || /\.(html|css|js|webmanifest)$/.test(f) || /^icon-|^favicon/.test(f);
function cacheList(list) {
  return caches.open(CACHE).then((c) =>
    // 1こ ずつ とっておく（どれか 1こ が とれなくても、ほか は のこす）。もう ある もの は とばす
    Promise.all(list.map((f) => c.match(f).then((hit) => hit ||
      fetch(f, { cache: "no-cache" }).then((res) => (res.ok ? c.put(f, res) : null)).catch(() => {})))));
}

self.addEventListener("install", (e) => {
  e.waitUntil(cacheList(self.OFFLINE_FILES.filter(isCore)));
  self.skipWaiting();
});

self.addEventListener("message", (e) => {
  if (!e.data || e.data.type !== "plan" || !e.data.full) return;
  e.waitUntil(cacheList(self.OFFLINE_FILES));
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
