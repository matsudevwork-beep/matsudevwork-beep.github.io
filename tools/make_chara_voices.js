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
  ・しょべるん ＝「Kano」、キャロ ＝「Kaori」。文 の 頭 に [元気に][かわいく][幼い声]（ききくらべ で 2ばん）。こぐまん ＝「Sameno」[ゆっくり][かわいく][幼い声]
  ・3体 とも 画面 と おなじ v4 の 設定（下 の V4）。2026-11-21 まで しょべるん・キャロ は v3 だった
    REDO=1 … アプリ に もう ある 声 も 作りなおす（ONLY と いっしょ に）
  ・**作った 声 は アプリ に 入れない**（2026-11-21 代表：ぜんぶ 確かめて OK して から 反映）。
    ../voice-work/review/ に 作り、review/index.html で 聞く → OK の もの を
    node tools/review_voices.js apply ID,ID（または all）で アプリ に 入れる
  ・「しょべるん」は「ショベルン」と 書いて わたす（「ショベル」と おなじ 言い方 に なる。画面 の 文字 は かえない）
  ・もう kids-app/audio に ある ID は 作らない。作りなおす とき は その mp3 を 消す
  ・API キー は キーチェーン（bunyu-elevenlabs）から よむ
*/
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "kids-app", "audio");
// 3体 とも 代表 が 画面 で 作る とき と おなじ 設定（2026-11-21 ききくらべ で「同じ に 聞こえる」）。
//   声 に しまった 設定 は つかわない。言語 は 自動。
//   2026-11-21 代表：しょべるん・キャロ も v3 は 音 が わるい → v4 に して 作りなおす
const V4 = {
  model: "eleven_v4", lang: null, format: "mp3_44100_128",
  settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true },
};
const GENKI = "[元気に][かわいく][幼い声]";
const CHARA = {
  car: { memo: "しょべるん の 声", voice: "Kano", tags: GENKI, ...V4 },
  veggie: { memo: "キャロ の 声", voice: "Kaori", tags: GENKI, ...V4 },
  // こぐまん は「こぐまん の 声」の 行 ＋ キャラ ごと で ない 行（部品・こえかけ・かず など。英語 は のぞく）。
  // 数 が 多い ので、名前 を つけた とき だけ 作る（node tools/make_chara_voices.js koguman）
  koguman: { memo: "こぐまん の 声", voice: "Sameno", tags: "[ゆっくり][かわいく][幼い声]", alsoShared: true, onlyWhenAsked: true, ...V4 },
};
const CHARA_MEMOS = Object.values(CHARA).map((c) => c.memo);
const SKIP_SHARED = ["英語"];
const YOMI = [[/しょべるん/g, "ショベルン"], [/♪/g, ""]];   // 声 を 作る とき だけ の 書きかえ
// 1こ ずつ の 書きかえ（2026-11-21 代表：ききなおして おかしかった もの。タグ も ここ で たせる）
const FIX = {
  "pet-008-car": "ごくごく、 おいしい！",
  "pet-009-car": "ぷはーっ！",
  "pet-017-car": "もう一回 投げて！",   // 2026-11-21 代表：「〜」だと 言い方 が へん → c 案
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
  // こぐまん（2026-11-21 代表：ききなおし。数字・「まる」の 言い方 が へん → 漢字 に。みじかい ことば は ささやく → 元気に）
  "word-028": { tags: GENKI, text: "亀" },   // [ゆっくり] だと 2かい 言う
  "dots-001": "1 から順番に点をつなごう。何ができるかな？",   // 「1」の あと に 半角 の すきま（代表 OK）
  "game-001": "丸を動かして、おうちまで行こう",
  "clock-001": { tags: GENKI, text: "十二時！" },
  "sensei-001": { tags: GENKI, text: "はなまる！" },
  // 2026-11-21 こぐまん 2かいめ（50こ）：まえ の ききなおし で わかった こと を さき に いれる
  //   数字 の あと は 半角 の すきま・「まる」は 漢字・みじかい ことば は 元気に・AI は「エーアイ」
  "dots-002": "最後は 1 に戻ろう",
  "dots-004": { tags: GENKI, text: "おうち！" },
  "dots-006": { tags: GENKI, text: "ヨット！" },
  "dots-007": { tags: GENKI, text: "おさかな！" },
  "dots-009": { tags: GENKI, text: "ハート！" },
  "game-002": "丸を触って進もう",
  "game-004": { tags: GENKI, text: "ゴール！おうちに着いたね" },
  "game-007": { tags: GENKI, text: "着いた！おうちに帰れたね" },
  "sensei-002": { tags: GENKI, text: "二重丸！" },
  "sensei-003": { tags: GENKI, text: "丸！" },
  "free-005": "エーアイ先生も",
  "grow-002": { tags: GENKI, text: "前より速く書けたね！" },
  "grow-003": { tags: GENKI, text: "前より消しゴムが減ったね！" },
  // 2026-11-21 代表 ききなおし（50こ の うち）
  "dots-009": { tags: GENKI, text: "ハートだ！" },   // 代表：c 案
  "game-006": "トコ トコ",   // 「…」なし
  "grow-004": { tags: GENKI, text: "線かき" },
  "grow-008": "一緒に読もう",
  "grow-013": "天秤",
  "reward-001": { tags: GENKI, text: "おやつを もらったよ！" },   // 画面 の 文字 は「おやつ（みず と ごはん）を もらったよ！」の まま
  "sensei-002": { tags: GENKI, text: "にじゅうまる！" },   // 代表：a 案
  // sensei-003：「まる！」「丸！」「まるっ！」は ぜんぶ ダメ（代表）
  "sensei-003": [{ tags: GENKI, text: "マル！" }, { tags: GENKI, text: "まるー！" }, { tags: "[うれしそうに][かわいく][幼い声]", text: "まる！" }],
  "sensei-008": "最後まで書けたね",
  "sensei-009": "番目の線が、とっても綺麗",   // 代表：a 案
  "sensei-010": "番目の線を、ゆっくりなぞってみよう",   // 代表：a 案
  // sensei-012：b「次は 道の まんなかを…」が よいが「次は」が さがる（代表）
  "sensei-012": ["つぎは、道の まんなかを ゆっくり 通ってみよう", { tags: GENKI, text: "次は 道の まんなかを ゆっくり 通ってみよう" }, "こんどは 道の まんなかを ゆっくり 通ってみよう"],
  // sword-022「こぐまんも」の 言い方 が へん（代表）
  "sword-022": ["こぐまん も", "コグマンも", { tags: GENKI, text: "こぐまんも" }],
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
const REVIEW = path.resolve(process.env.OUT || path.join(ROOT, "..", "voice-work", "review"));   // 確かめる まえ の 声 の おき場
const REDO = !!process.env.REDO;   // REDO=1 で アプリ に もう ある 声 も 作りなおす
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
    if (!REDO && fs.existsSync(path.join(AUDIO, `${r[iId]}.mp3`))) continue;
    const file = path.join(REVIEW, `${r[iId]}.mp3`);
    // FIX が 配列 なら ためし を いくつか 作る（ID__a・ID__b …。review で えらんで apply）
    const fixes = Array.isArray(FIX[r[iId]]) ? FIX[r[iId]] : [FIX[r[iId]]];
    fixes.forEach((fix, k) => {
      let text = (fix && fix.text) || fix || r[iText];
      const tags = (fix && fix.tags) || CHARA[t].tags;
      for (const [a, b] of YOMI) text = text.replace(a, b);
      const id = fixes.length > 1 ? `${r[iId]}__${"abcdef"[k]}` : r[iId];
      jobs.push({ type: t, id, text: tags + text.trim(), file: path.join(REVIEW, `${id}.mp3`) });
    });
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
    fs.mkdirSync(REVIEW, { recursive: true });
    fs.writeFileSync(j.file, Buffer.from(await res.arrayBuffer()));
    const lp = path.join(REVIEW, "list.json");
    const list = fs.existsSync(lp) ? JSON.parse(fs.readFileSync(lp, "utf8")) : {};
    list[j.id] = { type: j.type, text: j.text, made: new Date().toISOString() };
    fs.writeFileSync(lp, JSON.stringify(list, null, 1));
    n++; console.log(`○ ${j.id}  ${j.text}`);
  }
  console.log(`できた：${n}こ（${REVIEW}）→ node tools/review_voices.js で 聞く ページ を 作る`);
})();
