#!/usr/bin/env node
/*
  名前 の 声 を ElevenLabs で 作る（2026-11-21 代表：1もじ を つなぐ と 不自然）

  つかいかた（app フォルダ で）：
    node tools/make_name_voices.js ゆうと はる しょうた
    → ../voice-work/names/ゆうと-kun.mp3・ゆうと-chan.mp3・ゆうと.mp3 …（まず ここ で 聞いて たしかめる）

  ・声 は こぐまん と おなじ「Sameno」。文 の 頭 に [ゆっくり][かわいく][幼い声] を つける
  ・名前 の うしろ に「、」を つける（「ゆうとくん、」。よびかけ の 読み方 に なる）
  ・声 の 設定 は ElevenLabs に しまって ある こぐまん の 設定（速め 1.09・表情 すこし など）を そのまま つかう
    （2026-11-21 代表：ききくらべ で これ が いちばん 近い＝J。ゆれ を へらす と かわいさ が 消える）
  ・API キー は Mac の キーチェーン（名前 bunyu-elevenlabs）から よむ。ファイル にも 画面 にも 出さない
    しまいかた（ターミナル で 1かい だけ。キー を きかれたら はりつけて Enter。画面 には 出ない）：
      security add-generic-password -a "$USER" -s bunyu-elevenlabs -w
  ・もう ある ファイル は 作らない（クレジット を むだ に しない）。作りなおす とき は ファイル を 消す
  ・ためし：DRY=1 node tools/make_name_voices.js ゆうと  → 作る 文 と つかう クレジット の めやす だけ 出す
*/
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const VOICE_NAME = process.env.VOICE || "Sameno";
const MODEL = process.env.MODEL || "eleven_v3";          // [ゆっくり] など の タグ が きく モデル
const TAGS = "[ゆっくり][かわいく][幼い声]";
const OUT = path.join(__dirname, "..", "..", "voice-work", "names");   // 公開 リポジトリ の 外
const SUFFIX = [["くん", "-kun"], ["ちゃん", "-chan"], ["", ""]];

const names = process.argv.slice(2).filter((n) => /^[ぁ-ゖー]+$/.test(n));
if (!names.length) {
  console.log("名前 を ひらがな で 書いて ください：node tools/make_name_voices.js ゆうと はる");
  process.exit(1);
}

const jobs = [];
for (const n of names) for (const [suf, tag] of SUFFIX) {
  const file = path.join(OUT, `${n}${tag}.mp3`);
  if (!fs.existsSync(file)) jobs.push({ text: `${TAGS}${n}${suf}、`, file });
}
const credits = jobs.reduce((a, j) => a + j.text.length, 0);
console.log(`作る：${jobs.length}こ（クレジット の めやす：${credits}）`);
if (process.env.DRY) { jobs.forEach((j) => console.log("  " + j.text)); process.exit(0); }
if (!jobs.length) process.exit(0);

let key;
try {
  key = execFileSync("security", ["find-generic-password", "-s", "bunyu-elevenlabs", "-w"], { encoding: "utf8" }).trim();
} catch (e) {
  console.log("API キー が キーチェーン に ありません。ターミナル で つぎ を うって ください：");
  console.log('  security add-generic-password -a "$USER" -s bunyu-elevenlabs -w');
  process.exit(1);
}

(async () => {
  const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": key } });
  if (!r.ok) { console.log(`声 の 一覧 が とれません（${r.status}）。キー の 権限 を みて ください`); process.exit(1); }
  const voices = (await r.json()).voices || [];
  const v = voices.find((x) => x.name === VOICE_NAME) || voices.find((x) => x.name.includes(VOICE_NAME));
  if (!v) {
    console.log(`「${VOICE_NAME}」の 声 が「マイボイス」に ありません。ElevenLabs の 画面 で 声 を 追加 して ください`);
    console.log("いま ある 声：" + voices.map((x) => x.name).join("、"));
    process.exit(1);
  }
  // こぐまん の 声 に しまって ある 設定（ElevenLabs の 画面 で 作る とき と おなじ）
  const sr = await fetch(`https://api.elevenlabs.io/v1/voices/${v.voice_id}/settings`, { headers: { "xi-api-key": key } });
  if (!sr.ok) { console.log(`声 の 設定 が とれません（${sr.status}）`); process.exit(1); }
  const settings = await sr.json();
  console.log("声 の 設定：" + JSON.stringify(settings));
  fs.mkdirSync(OUT, { recursive: true });
  for (const j of jobs) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${v.voice_id}?output_format=mp3_44100_64`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: j.text, model_id: MODEL, language_code: "ja", voice_settings: settings }),
    });
    if (!res.ok) {
      console.log(`× ${j.text}：${res.status} ${(await res.text()).slice(0, 200)}`);
      if (res.status === 401 || res.status === 402 || res.status === 429) process.exit(1);   // キー・クレジット・回数 の もんだい は とめる
      continue;
    }
    fs.writeFileSync(j.file, Buffer.from(await res.arrayBuffer()));
    console.log(`○ ${path.basename(j.file)}`);
  }
  console.log(`できた → ${OUT}`);
})();
