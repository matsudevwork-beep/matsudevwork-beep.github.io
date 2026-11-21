#!/usr/bin/env node
/*
  しょべるん・キャロ・こぐまん の 声 を ElevenLabs で 作る（2026-11-21 代表）

  つかいかた（app フォルダ で）：
    node tools/make_chara_voices.js          → しょべるん と キャロ の まだ ない 声 を ぜんぶ 作る
    node tools/make_chara_voices.js car      → しょべるん だけ（veggie ＝ キャロ だけ）
    node tools/make_chara_voices.js koguman  → こぐまん（Sameno・v4）。こぐまん の 声 の 行 と、キャラ ごと で ない 行（英語 は のぞく）
    ONLY=lvup-001,kana-072 node tools/make_chara_voices.js koguman → その ID だけ（ためし に 少し だけ 作る とき）
    DRY=1 node tools/make_chara_voices.js    → 作る 文 と クレジット の めやす だけ 出す
  そのあと：node tools/build_voice_ids.js（声 の 表 と ネット なし の 一覧 を 作りなおす）

  ・作る 声 は docs/voice-script.csv の「メモ」が「しょべるん の 声」「キャロ の 声」の 行
  ・しょべるん ＝「Kano」、キャロ ＝「Kaori」。文 の 頭 に [元気に][かわいく][幼い声]（ききくらべ で 2ばん）
  ・しょべるん・キャロ の 設定 は ElevenLabs に しまって ある その 声 の 設定（v3）。こぐまん は 画面 と おなじ v4 の 設定（下 の V4_KOGUMAN）
  ・「しょべるん」は「ショベルン」と 書いて わたす（「ショベル」と おなじ 言い方 に なる。画面 の 文字 は かえない）
  ・もう kids-app/audio に ある ID は 作らない。作りなおす とき は その mp3 を 消す
  ・API キー は キーチェーン（bunyu-elevenlabs）から よむ
*/
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "kids-app", "audio");
// しょべるん・キャロ：v3・声 に しまった 設定・日本語 指定・64kbps（ききくらべ で きめた ので かえない）
const V3 = { tags: "[元気に][かわいく][幼い声]", model: "eleven_v3", lang: "ja", format: "mp3_44100_64" };
// こぐまん：代表 が 画面 で 作る とき と おなじ 設定（2026-11-21 ききくらべ で「同じ に 聞こえる」）。
//   声 に しまった 設定（similarity 1.0・style 0.2・speed 1.09）は つかわない。言語 は 自動
const V4_KOGUMAN = {
  tags: "[ゆっくり][かわいく][幼い声]", model: "eleven_v4", lang: null, format: "mp3_44100_128",
  settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true },
};
const CHARA = {
  car: { memo: "しょべるん の 声", voice: "Kano", ...V3 },
  veggie: { memo: "キャロ の 声", voice: "Kaori", ...V3 },
  // こぐまん は「こぐまん の 声」の 行 ＋ キャラ ごと で ない 行（部品・こえかけ・かず など。英語 は のぞく）。
  // 数 が 多い ので、名前 を つけた とき だけ 作る（node tools/make_chara_voices.js koguman）
  koguman: { memo: "こぐまん の 声", voice: "Sameno", alsoShared: true, onlyWhenAsked: true, ...V4_KOGUMAN },
};
const CHARA_MEMOS = Object.values(CHARA).map((c) => c.memo);
const SKIP_SHARED = ["英語"];
const YOMI = [[/しょべるん/g, "ショベルン"], [/♪/g, ""]];   // 声 を 作る とき だけ の 書きかえ
// 1こ ずつ の 書きかえ（2026-11-21 代表：ききなおして おかしかった もの。タグ も ここ で たせる）
const FIX = {
  "pet-008-car": "ごくごく、 おいしい！",
  "pet-009-car": "ぷはーっ！",
  "pet-017-car": "もう一回 投げて〜",
  "pet-023-car": "[歌うように]らんらん、 いっしょに おどろう！",
  "pet-026-car": "おふろだ〜！ ごしごし なでてね",
  // キャロ（2026-11-21 代表：言えて いない ところ が 多い → すきま を あけず、できる だけ 漢字 に する）
  "pet-001-veggie": "えへへ",
  "pet-002-veggie": "くすぐったい〜",
  "pet-003-veggie": "なあに？",
  "pet-004-veggie": "遊ぼ！",
  "pet-005-veggie": "気持ちいい〜",
  "pet-006-veggie": "なでなで、嬉しい！",
  "pet-007-veggie": "もっともっと〜",
  "pet-008-veggie": "ごくごく、美味しい！",
  "pet-009-veggie": "ぷはーっ！",
  "pet-010-veggie": "もぐもぐ、美味しい！",
  "pet-011-veggie": "ごちそうさま！",
  "pet-012-veggie": "線かきして、ご飯もらおう！",
  "pet-013-veggie": "今日はお腹いっぱい！また明日ね",
  "pet-014-veggie": "ごちそうさま！また明日遊ぼう",
  "pet-015-veggie": "取ったー！",
  "pet-016-veggie": "ナイスパス！",
  "pet-017-veggie": "もう一回投げて〜",
  "pet-018-veggie": "ぽーん！楽しい！",
  "pet-019-veggie": "あわあわ〜",
  "pet-021-veggie": "ピカピカ！気持ち良かった〜",
  "pet-022-veggie": "さっぱりしたよ！ありがとう",
  "pet-023-veggie": "[歌うように]らんらん、一緒に踊ろう！",
  "pet-024-veggie": "ぴょんぴょん、楽しいね",
  "pet-025-veggie": "くるくる〜、ダンスだよ",
  "pet-026-veggie": "お風呂だ〜！ごしごし撫でてね",
  "pet-027-veggie": "ありがとう！こんなに大きくなったよ！",
  "pet-032": "よろしくね！僕、キャロ",
  "pet-033": "おかえり！キャロだよ",
  "pet-034-veggie": "おはよう！今日も遊ぼ",
  "pet-035-veggie": "こんにちは！今日も遊ぼ",
  "pet-036-veggie": "こんばんは！今日も遊ぼ",
  "pet-037-veggie": "大好き！",
  "lvup-017": "レベル2！ほっぺに色がついたよ！",
  "lvup-018": "レベル3！葉っぱが3枚になったよ！",
  "lvup-019": "レベル4！体が伸びたよ！",
  "lvup-020": "レベル5！手と足ができたよ！",
  "lvup-021": "レベル6！リボンがついたよ！",
  "lvup-022": "レベル7！エプロンをつけたよ！",
  "lvup-023": "レベル8！泡立て器を持ったよ！",
  "lvup-024": "レベル9！コックさんの帽子をつけたよ！",
  "lvup-027": "レベル10！料理好きなにんじん王子様になったよ！",
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
const types = want.length ? want : Object.keys(CHARA).filter((t) => !CHARA[t].onlyWhenAsked);
const ONLY = process.env.ONLY ? process.env.ONLY.split(",").map((s) => s.trim()) : null;   // ONLY=lvup-001,kana-072 で その ID だけ
const rows = parseCSV(fs.readFileSync(path.join(ROOT, "docs", "voice-script.csv"), "utf8").replace(/^﻿/, ""));
const head = rows.shift();
const iId = head.indexOf("ID"), iText = head.findIndex((h) => h.startsWith("よみ")), iMemo = head.indexOf("メモ");

const jobs = [];
for (const t of types) {
  for (const r of rows) {
    if (!r[iId]) continue;
    const memo = (r[iMemo] || "").trim();
    const shared = CHARA[t].alsoShared && !CHARA_MEMOS.includes(memo) && !SKIP_SHARED.includes(memo);
    if (memo !== CHARA[t].memo && !shared) continue;
    if (ONLY && !ONLY.includes(r[iId])) continue;
    const file = path.join(AUDIO, `${r[iId]}.mp3`);
    if (fs.existsSync(file)) continue;
    let text = FIX[r[iId]] || r[iText];
    for (const [a, b] of YOMI) text = text.replace(a, b);
    jobs.push({ type: t, id: r[iId], text: CHARA[t].tags + text.trim(), file });
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
    let settings = CHARA[t].settings;
    if (!settings) {
      const s = await fetch(`https://api.elevenlabs.io/v1/voices/${v.voice_id}/settings`, { headers: { "xi-api-key": key } });
      settings = await s.json();
    }
    use[t] = { id: v.voice_id, settings };
  }
  let n = 0;
  for (const j of jobs) {
    const c = CHARA[j.type];
    const body = { text: j.text, model_id: c.model, voice_settings: use[j.type].settings };
    if (c.lang) body.language_code = c.lang;
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${use[j.type].id}?output_format=${c.format}`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify(body),
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
