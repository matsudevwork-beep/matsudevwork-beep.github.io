/*
  スプレッドシートで なおした せりふ を、アプリ に もどす スクリプト
  ------------------------------------------------------------
  使い方：
    1. スプレッドシートで「ファイル → ダウンロード → カンマ区切り形式（.csv）」
    2. できたファイルを docs/voice-script-edited.csv という名前で おく
    3. node tools/apply_voice_edits.js            … なにが かわるか 見るだけ（ファイルは かえない）
       node tools/apply_voice_edits.js --apply    … アプリ の ファイル を なおす
    4. node tools/build_voice_list.js で 録音リスト を つくりなおす

  くらべかた：
    ・ID ごとに、いまの docs/voice-script.csv と くらべる
    ・「画面の文字」を かえた行 → その文字 に なおす
      「よみ（録音する文）」だけ かえた行 → よみ の 文字 に なおす
    ・アプリ の .js の なかで "もとの文" と まったく おなじ ところ を さがして おきかえる
    ・名前 が 入る文（こぐまん など）や 2つ の 文 を つないだ文 は 自動で なおせないので、一覧に 出す
*/
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const APP = path.join(ROOT, "kids-app");
const NOW = path.join(ROOT, "docs", "voice-script.csv");
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const EDITED = args.find((a) => !a.startsWith("--")) || path.join(ROOT, "docs", "voice-script-edited.csv");

// CSV を 読む（"" で かこんだ 中の , や 改行 も だいじょうぶ）
function parseCSV(text) {
  text = text.replace(/^﻿/, "");
  const rows = []; let row = []; let cell = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift();
  const col = (name) => head.findIndex((h) => h.trim().startsWith(name));
  const ci = { id: col("ID"), yomi: col("よみ"), text: col("画面の文字") };
  if (ci.id < 0 || ci.text < 0) throw new Error("「ID」と「画面の文字」の 列 が 見つかりません");
  const map = new Map();
  rows.forEach((r) => { if (r[ci.id]) map.set(r[ci.id].trim(), { text: (r[ci.text] || "").trim(), yomi: (r[ci.yomi] || "").trim() }); });
  return map;
}

if (!fs.existsSync(EDITED)) {
  console.log(`なおした CSV が ありません：${path.relative(ROOT, EDITED)}\nスプレッドシートから ダウンロードして、この 名前で おいてください。`);
  process.exit(1);
}
const now = parseCSV(fs.readFileSync(NOW, "utf8"));
const edited = parseCSV(fs.readFileSync(EDITED, "utf8"));

const files = fs.readdirSync(APP).filter((f) => f.endsWith(".js") && f !== "sw.js").map((f) => path.join(APP, f));
files.push(path.join(ROOT, "tools", "build_voice_list.js"));
const src = new Map(files.map((f) => [f, fs.readFileSync(f, "utf8")]));

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const done = []; const manual = []; const missing = [];
for (const [id, a] of now) {
  const b = edited.get(id);
  if (!b) { missing.push(id); continue; }
  let to = null;
  if (b.text && b.text !== a.text) to = b.text;
  else if (b.yomi && b.yomi !== a.yomi) to = b.yomi;
  if (!to) continue;
  // "もとの文" '…' `…` の どれか で かこまれた ところ だけ を おきかえる
  const re = new RegExp(`(["'\`])${esc(a.text)}\\1`, "g");
  const hits = [];
  for (const [f, s] of src) {
    const n = (s.match(re) || []).length;
    if (n) { hits.push(`${path.relative(ROOT, f)}（${n}か所）`); src.set(f, s.replace(re, (m, qq) => qq + to + qq)); }
  }
  (hits.length ? done : manual).push({ id, from: a.text, to, hits });
}

console.log(`\n■ 自動で なおせる：${done.length} 行`);
done.forEach((d) => console.log(`  ${d.id}：「${d.from}」→「${d.to}」  … ${d.hits.join("・")}`));
console.log(`\n■ 手で なおす 必要あり（名前が 入る文 など）：${manual.length} 行`);
manual.forEach((d) => console.log(`  ${d.id}：「${d.from}」→「${d.to}」`));
if (missing.length) console.log(`\n（シートに ない ID：${missing.length} 行。行を けした／ID を かえた かも）`);

if (APPLY) {
  for (const [f, s] of src) if (s !== fs.readFileSync(f, "utf8")) fs.writeFileSync(f, s);
  console.log("\nファイル を なおしました。node tools/build_voice_list.js で 録音リスト を つくりなおしてください。");
} else {
  console.log("\n（いまは 見るだけ です。なおすときは --apply を つけて ください）");
}
