/*
  用意する パーツ（絵）の いちらん を つくる
  ------------------------------------------------
  使い方：node tools/build_parts_list.js
  → docs/parts-list.md（よむ用）と docs/parts-list.csv（スプレッドシート用）

  ・ボタン・プログラミング の ブロック など：kids-app/parts.js の PART_GROUPS
  ・ことば・かず・えいご などの「え」：アプリ の なか の えもじ を ぜんぶ あつめる（1しゅるい 1まい）
*/
const fs = require("fs");
const path = require("path");
const APP = path.join(__dirname, "..", "kids-app");
const { PART_GROUPS, picName, PARTS_READY } = require(path.join(APP, "parts.js"));

// えもじ ごと に、どの ファイル の どんな ことば で つかって いるか
const FILE_USE = {
  "hiragana.js": "ひらがな の ことば", "katakana.js": "カタカナ の ことば", "alphabet.js": "アルファベット の ことば",
  "numbers.js": "すうじ の ことば", "levels.js": "せんかき・いっしょに よもう・ものがたり・おはなし", "games.js": "かず・てんびん・めいろ など",
  "games-new.js": "たしざん・えいご・おえかき など", "app.js": "べんきょう の メニュー・ごほうび", "releases.js": "しんさく の おしらせ",
};
const SKIP = new Set(["©", "▶", "◀", "⬆", "⬇", "⬅", "➡", "✋", "🔁", "🗑", "👆"]);   // ボタン・ブロック は 上 の パーツ で 用意
const re = /\p{Extended_Pictographic}️?/gu;
const UNITS = new Set(["ひき", "まい", "ほん", "だい", "こ", "わ"]);
const CODEWORDS = new Set(["strokes", "middle", "start", "end", "none", "left", "right", "auto", "center", "bold", "normal", "true", "false", "char", "calc", "word", "icon"]);
const pics = new Map();   // emoji → { words:Set, files:Set, n }
for (const f of fs.readdirSync(APP).filter((x) => /\.(js|html)$/.test(x) && x !== "parts.js" && x !== "sw.js")) {
  const lines = fs.readFileSync(path.join(APP, f), "utf8").split("\n");
  lines.forEach((line) => {
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) return;   // コメント は のぞく
    for (const m of line.matchAll(re)) {
      const e = m[0].replace(/️/g, "");
      if (SKIP.has(e)) continue;
      const p = pics.get(e) || { words: new Set(), files: new Set(), n: 0 };
      p.files.add(FILE_USE[f] || f);
      p.n += 1;
      // おなじ 行 の いちばん ちかい「ことば」（ひらがな・カタカナ・英語）を さがす
      const isWord = (t) => (/^[ぁ-んァ-ヶー 　。、！？\/]+$/.test(t) && t.replace(/\s/g, "").length >= 2 && !UNITS.has(t))
        || (/^[a-z][a-z ]{2,}$/.test(t) && !CODEWORDS.has(t));
      const strs = [...line.matchAll(/["'`]([^"'`]{1,16})["'`]/g)].filter((q) => isWord(q[1].trim()));
      re.lastIndex = 0;
      if (strs.length) {
        // ことば → えもじ の じゅん が おおいので、まえ に ある もの を すこし ゆうせん
        const dist = (q) => q.index < m.index ? m.index - (q.index + q[0].length) : q.index - m.index + 6;
        const best = strs.sort((a, b) => dist(a) - dist(b))[0][1].trim();
        if (best.length <= 12 && !/[{}$<>]/.test(best)) p.words.add(best);
      }
      pics.set(e, p);
    }
  });
}

const PIC_SIZE = "240x240";
const rows = [];   // [グループ, ファイル名, いま, なに の 絵, 大きさ, 形式, つかう ところ, メモ, とどいた]
PART_GROUPS.forEach(([group, list]) => list.forEach(([name, emoji, size, where, note]) => {
  rows.push([group, `${name}.png`, emoji, where.split("：").pop(), size, "PNG（背景 とうめい）", where, note, PARTS_READY.has(name) ? "○" : ""]);
}));
// なに の 絵：Unicode の 名前（英語。tools/emoji-names.json）。いま の えもじ と おなじ もの を かいて もらう
const EN = JSON.parse(fs.readFileSync(path.join(__dirname, "emoji-names.json"), "utf8"));
const picRows = [...pics].map(([e, p]) => [p.files.size > 1 ? "え（いくつか の あそび で つかう）" : `え：${[...p.files][0]}`, `${picName(e)}.png`, e,
  EN[e] || "（いま の 絵 と おなじ もの）", PIC_SIZE, "PNG（背景 とうめい）", [...p.files].join("／"), "", PARTS_READY.has(picName(e)) ? "○" : ""]);
// よく つかう もの（いくつか の あそび で 出る）を さき に
picRows.sort((a, b) => (b[6].split("／").length - a[6].split("／").length) || a[0].localeCompare(b[0], "ja"));
rows.push(...picRows);

// ---- CSV ----
const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
const head = ["グループ", "ファイル名", "いま の 絵", "なに の 絵", "大きさ（px）", "ファイル の しゅるい", "つかう ところ", "メモ", "とどいた"];
fs.writeFileSync(path.join(__dirname, "..", "docs", "parts-list.csv"), "﻿" + [head, ...rows].map((r) => r.map(esc).join(",")).join("\n") + "\n");

// ---- Markdown ----
const groups = [...new Set(rows.map((r) => r[0]))];
let md = `# 用意する パーツ（絵）の いちらん

> 自動で つくった 表 です（\`node tools/build_parts_list.js\`）。手で なおさず、\`kids-app/parts.js\` を なおして つくりなおして ください。
> スプレッドシート で 見る とき は \`docs/parts-list.csv\` を 取りこむ。

## ぜんぶ に きょうつう の きまり
- **ファイル の しゅるい：PNG**（背景 は とうめい。色 は sRGB。Canva なら「背景 とうめい」に チェック して PNG で ダウンロード）
- **大きさ**：下 の 表 の とおり（画面 で 出す いちばん 大きい 大きさ の 2ばい。タブレット でも ぼやけない）。たて・よこ の 比 は かえない
- **よはく**：絵 の まわり に 1わり くらい あける（はし まで かかない）
- **せん の ふとさ・色 の かんじ を そろえる**（キャラクター の 絵 と おなじ タッチ）
- **ファイル名**：表 の とおり（英小文字・数字・ハイフン だけ）。\`kids-app/img/parts/\` に おく
- 1まい できる ごと に 入れて OK。とどいた ものから \`kids-app/parts.js\` の \`PARTS_READY\` に なまえ を たす と、アプリ が その 絵 に かわる（まだ の ものは いま の えもじ の まま）

## かず
| グループ | まい |
|---|---|
${groups.map((g) => `| ${g} | ${rows.filter((r) => r[0] === g).length} |`).join("\n")}
| **ごうけい** | **${rows.length}** |

## おすすめ の じゅんばん
1. **プログラミング**（ブロック 6・ばめん 8）… いま 作りなおした 画面。ここ が かわる と いちばん 見た目 が よく なる
2. **きょうつう の ボタン・しるし**（8）… どの 画面 にも 出る
3. **え（いくつか の あそび で つかう）**… 1まい で いくつも の 画面 が かわる
4. のこり の え（ひらがな の ことば など）は、まいつき の しんさく と いっしょ に すこしずつ
`;
for (const g of groups) {
  md += `\n## ${g}\n\n| ファイル名 | いま | なに の 絵 | 大きさ | しゅるい | つかう ところ・メモ |\n|---|---|---|---|---|---|\n`;
  rows.filter((r) => r[0] === g).forEach((r) => {
    md += `| \`${r[1]}\`${r[8] ? " ✅" : ""} | ${r[2]} | ${r[3]} | ${r[4]} | ${r[5].replace("（背景 とうめい）", "")} | ${[r[6], r[7]].filter(Boolean).join("。")} |\n`;
  });
}
fs.writeFileSync(path.join(__dirname, "..", "docs", "parts-list.md"), md);
console.log(`パーツ ${rows.length} こ（ボタン など ${rows.length - picRows.length}・え ${picRows.length}）→ docs/parts-list.md / .csv`);
