#!/usr/bin/env node
/*
  作った 声 を 確かめて から アプリ に 入れる（2026-11-21 代表：ぜんぶ 確かめて OK して から 反映 する 流れ に）

  つかいかた（app フォルダ で）：
    node tools/review_voices.js              → ../voice-work/review/index.html（聞く ページ）を 作る
    node tools/review_voices.js apply ID,ID  → OK の 声 だけ アプリ（kids-app/audio）に 入れて、声 の 表 を 作りなおす
    node tools/review_voices.js apply all    → review に ある 声 を ぜんぶ 入れる
    node tools/review_voices.js drop ID,ID   → NG の 声 を review から 消す（作りなおす とき）
  ・おなじ 文 の ためし を いくつか 作る ときは dots-001__a.mp3 の ように「__」の あと に しるし。
    apply dots-001__b で dots-001 として 入り、のこり の ためし（__a など）は 消える

  ・声 は tools/make_chara_voices.js が ../voice-work/review/ に 作る（アプリ には 入らない）
  ・聞く ページ には、いま アプリ に 入って いる 声（あれば）も ならべる
*/
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "kids-app", "audio");
const REVIEW = path.resolve(process.env.OUT || path.join(ROOT, "..", "voice-work", "review"));
const LIST = path.join(REVIEW, "list.json");
const NAMES = { animal: "こぐまん", koguman: "こぐまん", car: "しょべるん", veggie: "キャロ" };

const readList = () => (fs.existsSync(LIST) ? JSON.parse(fs.readFileSync(LIST, "utf8")) : {});
const files = () => (fs.existsSync(REVIEW) ? fs.readdirSync(REVIEW).filter((f) => f.endsWith(".mp3")).map((f) => f.slice(0, -4)).sort() : []);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function pick(arg) {
  const all = files();
  if (!arg) { console.log("ID を 書いて ください（例：apply word-028,game-001 ／ apply all）"); process.exit(1); }
  if (arg === "all") return all;
  const ids = arg.split(",").map((s) => s.trim()).filter(Boolean);
  const miss = ids.filter((id) => !all.includes(id));
  if (miss.length) { console.log(`review に ない：${miss.join(" ")}`); process.exit(1); }
  return ids;
}

function page() {
  const list = readList();
  const ids = files();
  const groups = {};
  for (const id of ids) {
    const t = (list[id] && list[id].type) || "そのほか";
    (groups[t] = groups[t] || []).push(id);
  }
  const rel = path.relative(REVIEW, AUDIO).split(path.sep).join("/");
  let body = "";
  for (const [t, arr] of Object.entries(groups)) {
    body += `<h2>${esc(NAMES[t] || t)}（${arr.length}こ）</h2><table>`;
    for (const id of arr) {
      const text = (list[id] && list[id].text) || "";
      const base = id.split("__")[0];
      const old = fs.existsSync(path.join(AUDIO, `${base}.mp3`));
      body += `<tr><td class="id">${esc(id)}</td><td class="tx">${esc(text)}</td>` +
        `<td><div class="lb">あたらしい</div><audio controls preload="none" src="${esc(id)}.mp3"></audio></td>` +
        `<td>${old ? `<div class="lb">いま の アプリ</div><audio controls preload="none" src="${esc(rel)}/${esc(base)}.mp3"></audio>` : '<div class="lb">（まだ ない）</div>'}</td></tr>`;
    }
    body += "</table>";
  }
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>声 の 確かめ</title><style>
:root{--bg:#fffaf2;--fg:#3a2e25;--sub:#8a7a6c;--line:#eadfce}
@media (prefers-color-scheme:dark){:root{--bg:#1f1b17;--fg:#f2e9de;--sub:#b3a595;--line:#3a332c}}
body{background:var(--bg);color:var(--fg);font-family:-apple-system,"Hiragino Sans",sans-serif;margin:16px;max-width:1100px}
h1{font-size:20px}h2{font-size:17px;margin-top:28px}p{color:var(--sub);font-size:14px}
table{border-collapse:collapse;width:100%}td{border-bottom:1px solid var(--line);padding:6px 8px;vertical-align:middle;font-size:14px}
.id{font-family:ui-monospace,monospace;font-size:12px;color:var(--sub);white-space:nowrap}.tx{min-width:220px}
.lb{font-size:11px;color:var(--sub)}audio{height:32px;width:220px}
</style></head><body><h1>声 の 確かめ（${ids.length}こ）</h1>
<p>OK の 声 の ID を 教えて ください。アプリ に 入れる の は OK の もの だけ です。作った 日時 順 では なく ID 順。</p>${body || "<p>確かめる 声 は ありません。</p>"}</body></html>`;
  fs.mkdirSync(REVIEW, { recursive: true });
  fs.writeFileSync(path.join(REVIEW, "index.html"), html);
  console.log(`聞く ページ：${path.join(REVIEW, "index.html")}（${ids.length}こ）`);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "apply" || cmd === "drop") {
  const ids = pick(arg);
  const list = readList();
  for (const id of ids) {
    const src = path.join(REVIEW, `${id}.mp3`);
    const base = id.split("__")[0];
    if (cmd === "apply") {
      fs.copyFileSync(src, path.join(AUDIO, `${base}.mp3`));
      for (const other of files()) if (other !== id && other.split("__")[0] === base && id.includes("__")) { fs.unlinkSync(path.join(REVIEW, `${other}.mp3`)); delete list[other]; }
    }
    fs.unlinkSync(src);
    delete list[id];
  }
  fs.writeFileSync(LIST, JSON.stringify(list, null, 1));
  console.log(`${cmd === "apply" ? "アプリ に 入れた" : "消した"}：${ids.length}こ`);
  if (cmd === "apply") execFileSync("node", [path.join(__dirname, "build_voice_ids.js")], { stdio: "inherit" });
  page();
} else {
  page();
}
