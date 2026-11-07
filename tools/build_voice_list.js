/*
  こえ の 録音リスト（台本）を つくる スクリプト
  ------------------------------------------------
  使い方：node tools/build_voice_list.js
  → docs/voice-script.md（よむ用）と docs/voice-script.csv（表計算ソフトで 録音の チェック用）が できる

  ・ことば・もじ・ものがたり などは kids-app の データ から 自動で あつめる
  ・アプリ の なかに ちょくせつ かいてある 声かけ は、下の FIXED に 手で かいてある
    （app.js / games.js に あたらしい say(...) を ふやしたら、ここにも たす）
*/
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const APP = path.join(__dirname, "..", "kids-app");
const ctx = vm.createContext({});
const code = ["characters.js", "levels.js", "hiragana.js", "katakana.js", "numbers.js"]
  .map((f) => fs.readFileSync(path.join(APP, f), "utf8")).join("\n;\n");
const D = vm.runInContext(code + "\n;({ PET_TYPES, VOICE, PLAY_VOICE, TALKS, READS, STORIES, HIRAGANA, KATAKANA, NUMBERS })", ctx);

const PETS = ["animal", "car", "veggie"].map((k) => ({ key: k, name: D.PET_TYPES[k].name }));
const NAMES = { animal: D.PET_TYPES.animal.name, car: D.PET_TYPES.car.name, veggie: D.PET_TYPES.veggie.name };
const NUM = ["ぜろ", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう", "じゅう"];
const numWord = (n) => n <= 10 ? NUM[n] : n < 20 ? "じゅう" + NUM[n - 10] : "にじゅう";
const HOURS = ["じゅうにじ", "いちじ", "にじ", "さんじ", "よじ", "ごじ", "ろくじ", "しちじ", "はちじ", "くじ", "じゅうじ", "じゅういちじ"];
const MINS = ["ちょうど", "ごふん", "じゅっぷん", "じゅうごふん", "にじゅっぷん", "にじゅうごふん", "さんじゅっぷん",
  "さんじゅうごふん", "よんじゅっぷん", "よんじゅうごふん", "ごじゅっぷん", "ごじゅうごふん"];
// アプリ が よむ とき と おなじ ように なおす（●→まる など）
// 「」や 〜 は 言いかた の めやす に なるので のこす
const yomi = (t) => t.replace(/●/g, "まる").replace(/★/g, "ほし").replace(/<br>/g, " ");

const rows = [];   // { sec, id, text, when, note }
const seen = new Set();
const sections = [];
function section(key, title, desc) { sections.push({ key, title, desc, n: 0 }); }
function add(text, when, note = "", { dedupe = true } = {}) {
  const sec = sections[sections.length - 1];
  const t = text.trim();
  if (!t) return;
  if (dedupe && seen.has(t)) return;   // おなじ ぶん は 1かい だけ 録音
  seen.add(t);
  sec.n += 1;
  rows.push({ sec: sec.title, id: `${sec.key}-${String(sec.n).padStart(3, "0")}`, text: t, yomi: yomi(t), when, note });
}

/* 1. あいぼう の ことば（ホーム） */
section("pet", "1. あいぼう の ことば（ホーム）", "あいぼう が ホームで しゃべる ことば。キャラ の 声で");
const voiceWhen = { tap: "あいぼう を さわった", pet: "なでた", eatWater: "みず を あげた", eatFood: "ごはん を あげた",
  hungry: "おなか が すいた", full: "きょう の ごはん は おしまい" };
for (const k of Object.keys(voiceWhen)) D.VOICE[k].forEach((t) => add(t, voiceWhen[k]));
const playWhen = { ball: "ボール", bath: "おふろ（なでている）", bathEnd: "おふろ おわり", dance: "ダンス" };
for (const k of Object.keys(playWhen)) D.PLAY_VOICE[k].forEach((t) => add(t, `あそぶ：${playWhen[k]}`));
add("おふろ だ〜！ ごしごし なでてね", "あそぶ：おふろ はじめ");
add("ありがとう！ こんなに おおきく なったよ！", "せいちょう した");
PETS.forEach((p) => {
  add(`よろしくね！ ぼく ${p.name}`, "はじめて えらんだ", `${p.name} の 声`);
  add(`おかえり！ ${p.name} だよ`, "もどって きた", `${p.name} の 声`);
});

/* 2. しんか（レベル アップ） */
section("lvup", "2. しんか（レベル アップ）", "「レベル3！」のあとに つづく ことば。キャラ ごと に 10こ");
PETS.forEach((p) => D.PET_TYPES[p.key].stages.forEach((s, i) =>
  add(`レベル${i + 1}！ ${s}`, "レベル が あがった", `${p.name} の 声`, { dedupe: false })));

/* 3. おはなし */
section("talk", "3. おはなし（しつもん と へんじ）", "しつもん の あと、子ども が えらんだ こたえ に へんじ を する");
D.TALKS.forEach((q) => {
  add(q.q, "おはなし：しつもん");
  q.choices.forEach((c) => add(c.reply, `おはなし：「${c.label}」を えらんだ`));
});
add("また おはなし しようね", "おはなし おわり");

/* 4. せんかき・もじ を かく */
section("trace", "4. せんかき・もじ を かく（こえかけ）", "なぞる とき の こえかけ");
D.VOICE.start.forEach((t) => add(t, "せんかき はじめ"));
["off", "good", "resume", "clear"].forEach((k) => D.VOICE[k].forEach((t) =>
  add(t, { off: "みち から はずれた", good: "うまく かけている", resume: "とちゅう から", clear: "できた！（ほか の あそび でも つかう）" }[k])));
add("●から はじめてね", "●いがい から かきはじめた");
add("つづきか ●から かけるよ", "とちゅう で ゆび を はなした");
add("けしたよ！ ●から かいてね", "けしゴム");
for (let k = 2; k <= 4; k++) add(`いいね！ つぎは ${k}ばんめ`, "2かくめ いこう に すすむ");

section("char", "5. もじ を かく（1もじ ずつ）", "ひらがな・カタカナ・すうじ。「〇」を かこう／「〇」が かけたね の 2つ ずつ");
[...D.HIRAGANA, ...D.KATAKANA, ...D.NUMBERS].forEach((h) => {
  add(`「${h.char}」を かこう！ ●から ★へ なぞってね`, `もじ を かく：はじめ`);
  add(`「${h.char}」が かけたね！`, "もじ を かく：できた");
});

/* 6. 1もじ の よみ */
section("kana", "6. 1もじ の よみ", "「いっしょに よもう」で 1もじ ずつ さわった とき。はっきり みじかく");
const kana = new Set();
D.HIRAGANA.forEach((h) => kana.add(h.char));
D.KATAKANA.forEach((h) => kana.add(h.char));
D.READS.forEach((r) => [...r.word.replace(/ /g, "")].forEach((c) => kana.add(c)));
[...kana].forEach((c) => add(c, "1もじ さわった", "", { dedupe: false }));

/* 7. ことば */
section("word", "7. ことば", "もじ が かけたあと の ことばカード・よもう の ことば と みじかい ぶん");
[...D.HIRAGANA, ...D.KATAKANA].forEach((h) => h.words.forEach((w) => add(w.word, `ことばカード（${h.char}）`)));
D.READS.forEach((r) => add(r.word, "いっしょに よもう（あいぼう が よむ）"));
D.READS.forEach((r) => add(`${r.word}！`, "いっしょに よもう：「せーの！」の あと、げんき よく", "", { dedupe: true }));

section("read", "8. いっしょに よもう（こえかけ）", "");
add("いっしょに よもう！ ひだりから さわってね", "はじめ");
add("こっちから よもう", "じゅんばん が ちがう");
add("せーの！", "みんな で よむ まえ");

/* 9. ものがたり */
section("story", "9. ものがたり（ページ ごと）", "えほん の ように ゆっくり。{name} の おはなし は 3キャラ ぶん");
add("みぎうえ から せんを なぞって よもう", "ものがたり はじめ");
add("おしまい！ さいごまで よめたね！", "ものがたり おわり");
const fill = (t, who) => t.replace(/\{name\}/g, NAMES[who]).replace(/\{animal\}/g, NAMES.animal)
  .replace(/\{car\}/g, NAMES.car).replace(/\{veggie\}/g, NAMES.veggie);
D.STORIES.forEach((st) => {
  const usesName = JSON.stringify(st).includes("{name}");
  const whos = usesName ? PETS.map((p) => p.key) : ["animal"];
  whos.forEach((who) => {
    add(fill(st.title, who).replace(/\//g, " "), "ものがたり：だいめい");
    st.pages.forEach((pg, i) => add(fill(pg.text, who).replace(/\//g, " "), `「${fill(st.title, who)}」${i + 1}ページ`));
  });
});
section("sword", "10. ものがたり の ことば（よめない とき の おたすけ）", "ゆび を とめた／さわった ことば を 1つ だけ よむ。「〇〇」だよ の かたち で");
const swords = new Set();
D.STORIES.forEach((st) => PETS.forEach((p) => st.pages.forEach((pg) =>
  fill(pg.text, p.key).split(/[\/ ]/).forEach((w) => { w = w.replace(/[、。！？「」]/g, ""); if (w) swords.add(w); }))));
[...swords].forEach((w) => add(`「${w}」だよ`, "ことば を おしえる"));

/* 11. かず */
section("num", "11. かず（すうじ の よみ）", "かぞえる・てんびん・てんつなぎ で つかう");
for (let n = 0; n <= 20; n++) add(numWord(n), "かず を かぞえる", "", { dedupe: false });
section("count", "12. かず の あそび（こえかけ）", "");
const ITEMS = ["りんご", "いちご", "さかな", "おはな", "おほしさま", "ひよこ", "おにぎり", "くるま"];
ITEMS.forEach((it) => add(`${it} を ひとつずつ さわって かぞえよう`, "かず を かぞえる：はじめ", "※ いまは 絵文字 を よんで しまう。録音 に したら この ぶん に"));
add("いくつ あった？", "かず を かぞえる：えらぶ");
add("もういちど かぞえて みよう", "まちがえた");
for (let n = 1; n <= 10; n++) add(`せいかい！ ${NUM[n]} こ！`, "かず を かぞえる：せいかい");
for (let n = 1; n <= 10; n++) add(`おもり は「${n}」。ひよこ を ${NUM[n]} わ、みぎ の おさら に のせよう`, "てんびん：はじめ");
add("おもすぎる みたい。おさら の ひよこ を そと に だそう", "てんびん：のせすぎ");
for (let n = 1; n <= 10; n++) add(`ぴったり！ ${NUM[n]} と ${NUM[n]} で おなじ だね`, "てんびん：できた");

section("dots", "13. てんつなぎ", "");
add("1 から じゅんばん に てん を つなごう。なに が できるかな？", "はじめ");
add("さいご は 1 に もどろう", "さいご の てん まで いった");
for (let n = 1; n <= 20; n++) add(`つぎ は ${numWord(n)}`, "ちがう てん を さわった");
["おうち", "おほしさま", "ヨット", "おさかな", "ちょうちょ", "ねこ", "ハート", "ロケット"].forEach((nm) => {
  add(`${nm}！`, "え が うかびあがった");
  add(`${nm} が できたよ！`, "できた");
});

section("game", "14. めいろ・みちつなぎ", "");
add("●を うごかして おうち まで いこう", "めいろ：はじめ");
add("●を さわって すすもう", "めいろ：●いがい を さわった");
add("かべ だよ。ほかの みち を さがそう", "めいろ：かべ");
add("ゴール！ おうちに ついたね", "めいろ：できた");
add("パネル を さわって まわして、おうち まで みち を つなげよう", "みちつなぎ：はじめ");
add("とことこ…", "みちつなぎ：あいぼう が あるく");
add("ついた！ おうち に かえれたね", "みちつなぎ：できた");

/* とけい：くみあわせ が おおいので「パーツ」で 録音して つなげる */
section("clock", "15. とけい（パーツ で 録音して つなげる）", "〇じ〇ふん の くみあわせ は 144とおり あるので、パーツ に わけて 録音する");
HOURS.forEach((h) => add(h, "みじかい はり を とめた／じかん の パーツ", "", { dedupe: false }));
MINS.forEach((m) => add(m, "ながい はり を とめた／じかん の パーツ", "", { dedupe: false }));
add("はり を うごかして", "はじめ（まえ）＋じかん＋「に しよう」");
add("に しよう", "はじめ（うしろ）");
add("せいかい！", "せいかい（このあと に じかん）");

/* 16. ごほうび・おけいこ（いまは 文字 だけ。声 を つけるなら） */
section("reward", "16. ごほうび・おけいこ（いまは 文字 だけ／声 を つける なら）", "いまは よみあげて いない。声 が あると 字 が よめない 子 も わかる");
add("おやつ（みず と ごはん）を もらったよ！", "おやつ ゲット");
add("きょうの ごはんは おしまい！ ボール や おはなしで あそべるよ", "1にち の じょうげん");
for (let n = 1; n <= 9; n++) add(`できた！ あと ${n}こ で おやつ`, "1セット の とちゅう");

/* 17. できるように なったこと（2026-11-07 代表：かならず いう） */
section("grow", "17. まえより できるように なったこと", "ごほうび・ひとやすみ の とき に かならず 1つ いう。「しゅるい、〜！」の かたち");
add("まえより まっすぐ かけたね！", "おなじ もんだい を まえより まっすぐ");
add("まえより はやく かけたね！", "おなじ もんだい を まえより はやく");
add("まえより けしゴム が へったね！", "おなじ もんだい で けしゴム が へった");
const TRACE_N = { line: "せんかき", hira: "ひらがな", kata: "カタカナ", num: "すうじ を かく" };
const READ_N = { read: "いっしょに よもう", story: "ものがたり" };
const GAME_N = { maze: "めいろ", count: "かず を かぞえる", balance: "てんびん", dots: "てんつなぎ", road: "みち つなぎ", clock: "とけい" };
for (const [k, nm] of Object.entries(TRACE_N)) {
  add(`${nm}、まえより ${k === "line" ? "まっすぐ ひけるように" : "はみださないで かけるように"} なったね！`, "まっすぐさ が よく なった");
  add(`${nm}、まえより はやく かけるように なったね！`, "はやさ");
  add(`${nm}、けしゴム を つかう のが へったね！`, "けしゴム");
}
for (const nm of Object.values(READ_N)) {
  add(`${nm}、まえより すらすら よめるように なったね！`, "はやさ");
  add(`${nm}、ひとりで よめる ことば が ふえたね！`, "おたすけ が へった");
  add(`${nm}、じゅんばん に よめるように なったね！`, "まちがい が へった");
}
for (const nm of Object.values(GAME_N)) {
  add(`${nm}、まえより はやく できるように なったね！`, "はやさ");
  add(`${nm}、まえより まちがい が へったね！`, "まちがい が へった");
}
for (const nm of [...Object.values(TRACE_N), ...Object.values(READ_N), ...Object.values(GAME_N)]) {
  add(`${nm}、まえより たくさん できたね！`, "かず が ふえた", "※ アプリ では うしろ に（3こ → 5こ）と 字 で だす");
  add(`はじめて ${nm} が できたね！`, "はじめて やった");
}
add("あたらしく", "あたらしい もじ／ことば（まえ）", "パーツ：あたらしく ＋「もじ」＋ が かけるように なったね");
add("が かけるように なったね！", "あたらしい もじ（うしろ）");
add("が よめるように なったね！", "あたらしい ことば（うしろ）");
add("ぜんぶ で", "つみかさね（まえ）", "パーツ：ぜんぶ で ＋ かず ＋ この もじ が…");
add("この もじ が かけるように なったよ！", "つみかさね（うしろ）");
add("にち も がんばってるね！", "つづけた ひ（かず の あと）");
add("はじめて の べんきょう、できたね！", "さいしょ の ひ");
add("きょうは たくさん がんばったね！", "ひとやすみ");
add("そろそろ ひとやすみ しよう", "ひとやすみ（めやす の 時間 を こえた）");

/* 18. せんせい の ひとこと（2026-11-07 しさく） */
section("sensei", "18. せんせい の ひとこと（もじ が かけた あと）", "しるし ＋ ほめる こと 1つ ＋（はなまる で ない とき）コツ 1つ を つなげて ながす。せんせい の 声");
["はなまる！", "にじゅうまる！", "まる！"].forEach((t) => add(t, "しるし"));
["みち の まんなか を とおって かけたね", "どの せん も いっき に かけたね", "いっき に かけたね", "さいご まで ていねい に かけたね", "さいご まで かけたね"]
  .forEach((t) => add(t, "ほめる"));
for (let k = 1; k <= 4; k++) add(`${k}ばんめ の せん が とっても きれい`, "ほめる（いちばん きれい な せん）");
for (let k = 1; k <= 4; k++) add(`${k}ばんめ の せん を ゆっくり なぞって みよう`, "コツ（いちばん はみだした せん）");
add("ゆび を はなさずに かいて みよう", "コツ（とちゅう で なんども はなした）");
add("つぎは みち の まんなか を ゆっくり とおって みよう", "コツ");

/* 19. にがて れんしゅう ・ おてほん なしで かく（AIせんせい） */
section("free", "19. にがて れんしゅう ・ おてほん なしで かく", "にがて の 字 と、AIせんせい が よむ あそび。字 が はいる もの は 字 ごと に");
D.HIRAGANA.concat(D.KATAKANA, D.NUMBERS).forEach((h) => add(`にがて を やっつけよう！「${h.char}」を ゆっくり ていねい に かこう`, "にがて れんしゅう：はじめ"));
D.HIRAGANA.forEach((h) => {
  add(`おてほん を みて「${h.char}」を かいて みよう`, "おてほん なし：はじめ");
  add(`はなまる！ AIせんせい も「${h.char}」って よめたよ！`, "おてほん なし：よめた");
  add(`「${h.char}」に みえるよ！ じょうず！`, "おてほん なし：だいたい よめた");
  add(`AIせんせい も「${h.char}」って よめたよ`, "なぞり の あと の せんせい");
});
add("おしい！ おてほん を よく みて、もういちど かいて みよう", "おてほん なし：よめなかった（2かい まで）");
add("さいご まで がんばったね！ つぎ は きっと かけるよ", "おてほん なし：3かいめ で おわり");

/* ---- かきだし ---- */
const total = rows.length;
const byPet = rows.filter((r) => /の 声$/.test(r.note)).length;
let md = `# こえ の 録音リスト（台本）

> このファイルは \`node tools/build_voice_list.js\` で 自動で 作っています（手で なおさず、スクリプトを なおして 作りなおす）。
> 録音の チェックは 同じ中身の \`voice-script.csv\` を スプレッドシートで ひらくと べんり です。

- ぜんぶ で **${total}こ**（そのうち キャラ ごと に ちがう 声 が いる もの ${byPet}こ）
- ファイル名 は **ID と おなじ** にする（例：\`pet-001.m4a\`）。あとで アプリ が ID で 声 を さがせる ように
- 「よみ」が 録音 する 文（画面 の ●→まる、★→ほし に なおして ある）。「」は せりふ、〜 は のばす めやす
- 文字 は ぜんぶ ひらがな。区切り の スペース は「ひといき」の めやす

## 録音 の きまり（おすすめ）
| こと | めやす |
|---|---|
| 形式 | m4a（AAC）か mp3、モノラル、44.1kHz |
| 長さ | 1ファイル 1文。前後 の むおん は 0.2びょう くらい |
| 声 | あいぼう の 声 は 1人 に そろえる（キャラ ごと に かえる なら 3人／3しゅるい）。ナレーション（ものがたり・1もじ）は べつ の 声 でも OK |
| 音量 | ぜんぶ の ファイル で そろえる（あとで まとめて ととのえて も よい） |
| 1もじ の よみ | 「は」は「は」と よむ（「わ」に しない）。みじかく はっきり |

## もくじ
${sections.map((s) => `- ${s.title}（${s.n}こ）`).join("\n")}
`;
for (const s of sections) {
  md += `\n## ${s.title}（${s.n}こ）\n${s.desc ? s.desc + "\n" : ""}\n| ID | よみ | つかう ところ | メモ |\n|---|---|---|---|\n`;
  rows.filter((r) => r.sec === s.title).forEach((r) => {
    md += `| ${r.id} | ${r.yomi.replace(/\|/g, "｜")} | ${r.when} | ${r.note} |\n`;
  });
}
const csvCell = (v) => `"${String(v).replace(/"/g, '""')}"`;
const csv = "﻿" + [["ID", "しゅるい", "よみ（録音する文）", "画面の文字", "つかう ところ", "メモ", "録音ずみ"]]
  .concat(rows.map((r) => [r.id, r.sec, r.yomi, r.text, r.when, r.note, ""]))
  .map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
const out = path.join(__dirname, "..", "docs");
fs.writeFileSync(path.join(out, "voice-script.md"), md);
fs.writeFileSync(path.join(out, "voice-script.csv"), csv);
console.log(`${total}こ を 書き出しました（キャラ べつ ${byPet}こ）`);
sections.forEach((s) => console.log(`  ${s.title}: ${s.n}`));
