#!/usr/bin/env node
/* =========================================================
   録音した 声 を アプリ に つなぐ 表 を つくる（2026-11-15 代表：声 を フォルダ に いれたら 反映 したい）
   ---------------------------------------------------------
   つかいかた：kids-app/audio/ に <ID>.mp3 を いれたら
     node tools/build_voice_ids.js
   ・docs/voice-script.csv（ID と 画面の文字）と audio/ の ファイル を くらべて、
     ある ファイル だけ を kids-app/voice-ids.js に かく
   ・アプリ は しゃべる とき に この 表 を みて、録音 が あれば それ を ならす（なければ 端末 の よみあげ）
   ・キャラ ごと の 声（pet-001-animal など）は、いま の あいぼう の 声 だけ を つかう（ほか の キャラ の 声 では よまない）
   ========================================================= */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CSV = path.join(ROOT, "docs/voice-script.csv");
const AUDIO = path.join(ROOT, "kids-app/audio");
const OUT = path.join(ROOT, "kids-app/voice-ids.js");
const PETS = ["animal", "car", "veggie"];

// app.js・kids-app/voice-parts.js の voiceKey()・tools/build_voice_list.js と おなじ きまり（かえる とき は 4つ とも）
const voiceKey = (t) => String(t).replace(/●/g, "まる").replace(/★/g, "ほし")
  .replace(/[\s　〜~「」！!？?…。、,.♪・ー-]/g, "").replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));  // カタカナ は ひらがな と おなじ 声（コップ＝こっぷ）

function parseCsv(text) {
  const rows = [];
  let row = [], cur = "", q = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); rows.push(row); row = []; cur = "";
    } else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

const have = new Set(fs.readdirSync(AUDIO).filter((f) => f.endsWith(".mp3")).map((f) => f.slice(0, -4)));
const [head, ...rows] = parseCsv(fs.readFileSync(CSV, "utf8"));
const iId = head.indexOf("ID"), iShown = head.indexOf("画面の文字"), iYomi = head.findIndex((h) => h.startsWith("よみ"));

const map = {};     // key → "trace-001" または { animal: "pet-001-animal", … }
const known = new Set();
let used = 0;
for (const r of rows) {
  const id = r[iId];
  if (!id) continue;
  known.add(id);
  if (!have.has(id)) continue;
  const pet = PETS.find((p) => id.endsWith(`-${p}`));
  // 1もじ の 録音（kana-）は「#あ」の ように べつ の なまえ で のせる（なまえ・「し」など 1もじ ずつ よむ ところ だけ で つかう。
  // ふつう の 文 の なか の「は（わ）」「と」などと まざらない ように）
  // その 場面 だけ の 録音（numcard-：すうじ の カード）は「@ID」で のせる（おなじ ことば の ほか の 録音 と まざらない。app.js の speakOwn）
  if (/^numcard-/.test(id)) { map["@" + id] = id; used++; continue; }
  const isKana = /^kana-/.test(id);
  for (const t of new Set([r[iShown], r[iYomi]])) {
    const k = (isKana ? "#" : "") + voiceKey(t || "");
    if (!k) continue;
    if (pet) { if (typeof map[k] !== "object") map[k] = {}; map[k][pet] = id; }
    else if (!map[k]) map[k] = id;
    if (isKana) break;   // 1もじ は 画面 の 字 だけ（よみ は おなじ）
  }
  used++;
}
const unknown = [...have].filter((id) => !known.has(id)).sort();

// まもる こと の たしかめ（docs/voice-system.md）：iPhone の カメラ の よこ に しるし が でる ならしかた を つかって いないか
for (const f of fs.readdirSync(path.join(ROOT, "kids-app")).filter((f) => f.endsWith(".js"))) {
  const src = fs.readFileSync(path.join(ROOT, "kids-app", f), "utf8").replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, "");
  if (/new Audio\(|audioSession\.type\s*=\s*["']playback|createElement\(["']audio/.test(src))
    console.log(`⚠ ${f}：<audio>・new Audio()・audioSession "playback" は つかわない（カメラ の よこ に しるし が でる）`);
}
const out = `/* 録音した 声 の 表（じどう で つくる ファイル。手 で なおさない）
   つくりなおし：node tools/build_voice_ids.js（kids-app/audio/ に 声 を いれた あと）
   ことば → 録音 ファイル の ID。キャラ ごと の 声 は { animal, car, veggie } */
const VOICE_IDS = ${JSON.stringify(map, null, 0).replace(/,"/g, ',\n  "').replace(/^\{/, "{\n  ").replace(/\}$/, "\n}")};
`;
fs.writeFileSync(OUT, out);
console.log(`録音 ファイル ${have.size}こ のうち ${used}こ を つないだ → kids-app/voice-ids.js`);
if (unknown.length) console.log(`リスト に ない 名前（つながらない）：${unknown.join(", ")}`);

// 声 が ふえたら、ネット なし でも つかう ため の いちらん も つくりなおす
require("./build_offline_list.js");
