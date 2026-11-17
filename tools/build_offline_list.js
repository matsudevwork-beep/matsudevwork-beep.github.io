#!/usr/bin/env node
/* =========================================================
   ネット が なくても ぜんぶ つかえる ように する ための いちらん を つくる（2026-11-17 代表）
   ---------------------------------------------------------
   つかいかた：node tools/build_offline_list.js
   ・kids-app/ の 中 の アプリ が つかう ファイル（画面・しくみ・絵・声）を ぜんぶ ならべて
     kids-app/offline-files.js に かく
   ・sw.js が この いちらん を 読んで、さいしょ に ひらいた とき に まとめて スマホ に とっておく
   ・中身 が かわると「はん（バージョン）」の しるし も かわるので、スマホ は 新しい ほう に いれかわる
   ・絵 や 声 を 足したら この コマンド を うつ（build_voice_ids.js からも じどう で よばれる）
   ========================================================= */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const APP = path.join(__dirname, "..", "kids-app");
const OUT = path.join(APP, "offline-files.js");
const KEEP = /\.(html|css|js|png|svg|jpg|webp|mp3|webmanifest)$/i;
const SKIP = new Set(["sw.js", "offline-files.js", "_audit.js"]);

const files = [];
(function walk(dir) {
  for (const name of fs.readdirSync(dir).sort()) {
    if (name.startsWith(".")) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) { walk(full); continue; }
    const rel = path.relative(APP, full).split(path.sep).join("/");
    if (!KEEP.test(name) || SKIP.has(rel)) continue;
    files.push(rel);
  }
})(APP);

const hash = crypto.createHash("sha1");
let bytes = 0;
for (const f of files) {
  const buf = fs.readFileSync(path.join(APP, f));
  bytes += buf.length;
  hash.update(f).update(buf);
}
const version = hash.digest("hex").slice(0, 10);

fs.writeFileSync(OUT, `/* ネット なし でも つかう ため に とっておく ファイル（じどう で つくる ファイル。手 で なおさない）
   つくりなおし：node tools/build_offline_list.js */
self.OFFLINE_VERSION = "${version}";
self.OFFLINE_FILES = ${JSON.stringify(["./", ...files], null, 0).replace(/","/g, '",\n  "').replace(/^\[/, "[\n  ").replace(/\]$/, "\n]")};
`);
console.log(`オフライン用 ${files.length}こ（${(bytes / 1024 / 1024).toFixed(1)}MB）→ kids-app/offline-files.js（はん ${version}）`);
