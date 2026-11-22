#!/usr/bin/env node
/* =========================================================
   声 の 部品 の つなぎかた を たしかめる（2026-11-16）
   つかいかた：node tools/check_voice_parts.js [ためす 文 …]
   ・録音リスト（docs/voice-script.csv）が ぜんぶ 録音 できた と して、
     アプリ の 文 が どの 部品 で ならぶ か を 見せる（まだ 録音 して いない ぶん も）
   ・つなげない 文 は「よみあげ」と 出る → 部品 を 録音リスト に たす（tools/build_voice_list.js）
   ========================================================= */
const fs = require("fs");
const path = require("path");
const VP = require("../kids-app/voice-parts.js");
const ROOT = path.join(__dirname, "..");
const csv = fs.readFileSync(path.join(ROOT, "docs/voice-script.csv"), "utf8").replace(/^﻿/, "");
const rows = csv.split(/\r?\n/).slice(1).filter(Boolean).map((l) => l.slice(1, -1).split('","'));
const PETS = ["animal", "car", "veggie"];
const table = {}, yomiOf = {};
rows.forEach(([id, , yomi, shown]) => {
  yomiOf[id] = yomi;
  const pet = PETS.find((p) => id.endsWith(`-${p}`));
  const kana = /^kana-/.test(id);
  for (const t of kana ? [shown] : new Set([shown, yomi])) {
    const k = (kana ? "#" : /^yobu-/.test(id) ? "@" : "") + VP.voiceKey(t);
    if (!k) continue;
    if (pet) { table[k] = typeof table[k] === "object" ? table[k] : {}; table[k][pet] = id; }
    else if (!table[k]) table[k] = id;
  }
});
const name = process.env.NAME || "ゆうと";
const samples = process.argv.slice(2).length ? process.argv.slice(2) : [
  "「し」を かこう！ ●から ★へ なぞってね", "「ア」が かけたね！", "「3」を かこう！ ●から ★へ なぞってね", "「B」が かけたね！",
  "にがて を やっつけよう！「つ」を ゆっくり ていねい に かこう", "はなまる！ こぐまん も「あ」って よめたよ！", "はなまる！ しょべるん も「あ」って よめたよ！", "はなまる！ キャロ も「あ」って よめたよ！",
  "「3」と おなじ だけ、こぐまん を さんびき みぎ の おさら に のせよう", "ぴったり！ さん と さん で おなじ だね",
  "つぎ は じゅうに", "おうち が できたよ！", "できた！ あと 3こ で おやつ", "せいかい！ いっこ！",
  "せんかき、まえより はやく かけるように なったね！", "めいろ、まえより たくさん できたね（3こ → 5こ）！",
  "2ばんめ の せん を ゆっくり なぞって みよう", "はり を うごかして 4じ 15ふん に しよう",
  "ひよこ が さんわ いるよ", "せいかい！ いち たす に は さん！", "3ばんめ で いわ に とまっちゃった。どこ を なおす？",
  "おやつ に ついた！ 4こ の ブロック で いけたね", "「いもむし」だよ",
  "ゆうとくん、こんにちは！ きょうも あそぼ", "ゆうとくん、だいすき！", "なあに？ ゆうとくん", "こんどは ゆうとくん の ばん！ くも から あめ を ふらせてね",
  "ゆうとくんの ばん だね",
];
for (const t of samples) {
  const ids = VP.plan(t, table, "animal", name);
  console.log(ids ? `○ ${t}\n    → ${ids.map((id) => `${yomiOf[id]}`).join(" ＋ ")}` : `× ${t}\n    → よみあげ（つなげない）`);
}
