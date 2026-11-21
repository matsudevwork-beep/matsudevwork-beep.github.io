#!/usr/bin/env node
/*
  しょべるん・キャロ の 声 を ElevenLabs で 作る（2026-11-21 代表）

  つかいかた（app フォルダ で）：
    node tools/make_chara_voices.js          → しょべるん と キャロ の まだ ない 声 を ぜんぶ 作る
    node tools/make_chara_voices.js car      → しょべるん だけ（veggie ＝ キャロ だけ）
    DRY=1 node tools/make_chara_voices.js    → 作る 文 と クレジット の めやす だけ 出す
  そのあと：node tools/build_voice_ids.js（声 の 表 と ネット なし の 一覧 を 作りなおす）

  ・作る 声 は docs/voice-script.csv の「メモ」が「しょべるん の 声」「キャロ の 声」の 行
  ・しょべるん ＝「Kano」、キャロ ＝「Kaori」。文 の 頭 に [元気に][かわいく][幼い声]（ききくらべ で 2ばん）
  ・声 の 設定 は ElevenLabs に しまって ある その 声 の 設定 を そのまま つかう
  ・「しょべるん」は「ショベルン」と 書いて わたす（「ショベル」と おなじ 言い方 に なる。画面 の 文字 は かえない）
  ・もう kids-app/audio に ある ID は 作らない。作りなおす とき は その mp3 を 消す
  ・API キー は キーチェーン（bunyu-elevenlabs）から よむ
*/
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "kids-app", "audio");
const TAGS = "[元気に][かわいく][幼い声]";
const CHARA = {
  car: { memo: "しょべるん の 声", voice: "Kano" },
  veggie: { memo: "キャロ の 声", voice: "Kaori" },
};
const YOMI = [[/しょべるん/g, "ショベルン"], [/♪/g, ""]];   // 声 を 作る とき だけ の 書きかえ
// 1こ ずつ の 書きかえ（2026-11-21 代表：ききなおして おかしかった もの。タグ も ここ で たせる）
const FIX = {
  "pet-008-car": "ごくごく、 おいしい！",
  "pet-009-car": "ぷはーっ！",
  "pet-017-car": "もう一回 投げて〜",
  "pet-023-car": "[歌うように]らんらん、 いっしょに おどろう！",
  "pet-026-car": "おふろだ〜！ ごしごし なでてね",
};

function parseCSV(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const want = process.argv.slice(2).filter((a) => CHARA[a]);
const types = want.length ? want : Object.keys(CHARA);
const rows = parseCSV(fs.readFileSync(path.join(ROOT, "docs", "voice-script.csv"), "utf8").replace(/^﻿/, ""));
const head = rows.shift();
const iId = head.indexOf("ID"), iText = head.findIndex((h) => h.startsWith("よみ")), iMemo = head.indexOf("メモ");

const jobs = [];
for (const t of types) {
  for (const r of rows) {
    if (!r[iId] || (r[iMemo] || "").trim() !== CHARA[t].memo) continue;
    const file = path.join(AUDIO, `${r[iId]}.mp3`);
    if (fs.existsSync(file)) continue;
    let text = FIX[r[iId]] || r[iText];
    for (const [a, b] of YOMI) text = text.replace(a, b);
    jobs.push({ type: t, id: r[iId], text: TAGS + text.trim(), file });
  }
}
const credits = jobs.reduce((a, j) => a + j.text.length, 0);
console.log(`作る：${jobs.length}こ（クレジット の めやす：${credits}）`);
if (process.env.DRY) { jobs.forEach((j) => console.log(`  ${j.id}  ${j.text}`)); process.exit(0); }
if (!jobs.length) process.exit(0);

let key;
try {
  key = execFileSync("security", ["find-generic-password", "-s", "bunyu-elevenlabs", "-w"], { encoding: "utf8" }).trim();
} catch (e) {
  console.log('API キー が キーチェーン に ありません：security add-generic-password -a "$USER" -s bunyu-elevenlabs -w');
  process.exit(1);
}

(async () => {
  const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": key } });
  if (!r.ok) { console.log(`声 の 一覧 が とれません（${r.status}）`); process.exit(1); }
  const voices = (await r.json()).voices || [];
  const use = {};
  for (const t of types) {
    const v = voices.find((x) => x.name.startsWith(CHARA[t].voice));
    if (!v) { console.log(`「${CHARA[t].voice}」が マイボイス に ありません`); process.exit(1); }
    const s = await fetch(`https://api.elevenlabs.io/v1/voices/${v.voice_id}/settings`, { headers: { "xi-api-key": key } });
    use[t] = { id: v.voice_id, settings: await s.json() };
  }
  let n = 0;
  for (const j of jobs) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${use[j.type].id}?output_format=mp3_44100_64`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: j.text, model_id: "eleven_v3", language_code: "ja", voice_settings: use[j.type].settings }),
    });
    if (!res.ok) {
      console.log(`× ${j.id}：${res.status} ${(await res.text()).slice(0, 200)}`);
      if ([401, 402, 429].includes(res.status)) process.exit(1);
      continue;
    }
    fs.writeFileSync(j.file, Buffer.from(await res.arrayBuffer()));
    n++; console.log(`○ ${j.id}  ${j.text}`);
  }
  console.log(`できた：${n}こ → つぎ に node tools/build_voice_ids.js`);
})();
