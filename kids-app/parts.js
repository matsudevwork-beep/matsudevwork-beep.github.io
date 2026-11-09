/* パーツ（絵）の いちらん と さしかえ の しくみ（2026-11-09 代表：やじるし・えもじ は ぜんぶ 用意した 絵 に かえる）
   ------------------------------------------------------------------
   ・絵 が とどいたら kids-app/img/parts/<なまえ>.png に おいて、下の PARTS_READY に なまえ を たす
     → その パーツ は 絵 に なる。まだ の ものは いまの えもじ の まま（アプリ は こわれない）
   ・パーツ の いちらん（大きさ・ファイル の しゅるい つき）は node tools/build_parts_list.js で
     docs/parts-list.md と docs/parts-list.csv に なる。ここ に たしたら つくりなおす
   ・size：画面 で 出す いちばん 大きい ばあい の 2ばい（タブレット・こまかい 画面 でも ぼやけない ように）
*/
const PARTS_READY = new Set([
  // 例："code-up", "code-down",
]);

// [なまえ, いまの えもじ, 大きさ(px), つかう ところ, メモ]
const PART_GROUPS = [
  ["プログラミング（ブロック と ばめん）", [
    ["code-up", "⬆️", "240x160", "プログラミング：うえ に すすむ ブロック", "ブロック の 形 ごと 1まい の 絵（パズル の ような でっぱり つき）。やじるし は 白"],
    ["code-down", "⬇️", "240x160", "プログラミング：した に すすむ ブロック", "code-up と おなじ 形・色"],
    ["code-left", "⬅️", "240x160", "プログラミング：ひだり に すすむ ブロック", "code-up と おなじ 形・色"],
    ["code-right", "➡️", "240x160", "プログラミング：みぎ に すすむ ブロック", "code-up と おなじ 形・色"],
    ["code-take", "✋", "240x160", "プログラミング：もつ ブロック", "色 を かえて（きいろ など）ほか と くべつ"],
    ["code-loop", "🔁", "240x160", "プログラミング：くりかえし ブロック", "色 を かえて（むらさき など）。×2 の 文字 は アプリ が かさねる"],
    ["code-start", "▶", "320x120", "プログラミング：スタート ボタン", "文字 なし の ボタン の 絵（「スタート」は アプリ が かく）でも よい"],
    ["code-trash", "🗑️", "160x160", "プログラミング：ごみばこ（ブロック を すてる）", "ふた が あく 絵 も あれば code-trash-open"],
    ["code-tile", "（みどり の マス）", "200x200", "プログラミング：くさはら の マス", "すきま なく ならべる。まわり に 2px くらい の ふち"],
    ["code-tile2", "（こい みどり の マス）", "200x200", "プログラミング：くさはら の マス（ちがう 色）", "いちまつ もよう に する とき"],
    ["code-rock", "🪨", "200x200", "プログラミング：いわ（とおれない）", "せはいけい は とうめい"],
    ["code-snack", "🍪", "200x200", "プログラミング：おやつ（ゴール ／ もつ もの）", ""],
    ["code-home", "🏠", "200x200", "プログラミング：おうち（とどける ばしょ）", ""],
    ["code-flag", "（スタート の 文字）", "200x200", "プログラミング：スタート の マス の しるし", "はた など"],
  ]],
  ["かたち（空間）", [
    ["shape-cell", "（いろ の マス）", "120x120", "かたち うつし：ぬった マス", "色 ちがい を 4つ：shape-cell-red / -blue / -yellow / -green"],
    ["shape-mirror", "（まんなか の せん）", "40x400", "かたち うつし：かがみ の せん", "たて に のびる 絵"],
  ]],
  ["きょうつう の ボタン・しるし", [
    ["ui-back", "←", "120x120", "どの 画面 でも：もどる", ""],
    ["ui-prev", "◀", "120x120", "カレンダー：まえ の つき", ""],
    ["ui-next", "▶", "120x120", "カレンダー：つぎ の つき・ものがたり：つぎ の ページ", ""],
    ["ui-close", "✕", "120x120", "おはなし：とじる", ""],
    ["ui-star", "★", "80x80", "カレンダー：おけいこ ぜんぶ の 日・きょうの おけいこ", ""],
    ["ui-hand", "👆", "80x80", "ホーム：「ひっぱって あげてね」の ゆび", ""],
    ["ui-start-dot", "●", "80x80", "せんかき・ひらがな：かきはじめ の しるし", "いまは 絵 で かいている。かえる なら"],
    ["ui-goal-star", "★", "80x80", "せんかき：ゴール の ほし", "いまは 絵 で かいている。かえる なら"],
  ]],
];

const PARTS = {};
PART_GROUPS.forEach(([group, list]) => list.forEach(([name, emoji, size, where, note]) => { PARTS[name] = { name, emoji, size, where, note, group }; }));

// ことば・かず・えいご などの「え」は、えもじ ごと に 1まい：pic-<えもじ の ばんごう>.png（例：🐶 → pic-1f436.png）
// いちらん は tools/build_parts_list.js が アプリ の なか の えもじ を ぜんぶ あつめて つくる
const picName = (emoji) => "pic-" + [...String(emoji).replace(/\uFE0F/g, "")].map((ch) => ch.codePointAt(0).toString(16)).join("-");
function picHTML(emoji, cls = "") {
  const nm = picName(emoji);
  if (PARTS_READY.has(nm)) return `<img class="part ${cls}" src="img/parts/${nm}.png" alt="" draggable="false">`;
  return emoji;
}

// 絵 が あれば <img>、まだ なら えもじ（なまえ が ない とき は そのまま 文字）
function partHTML(name, cls = "") {
  const p = PARTS[name];
  if (PARTS_READY.has(name)) return `<img class="part ${cls}" src="img/parts/${name}.png" alt="" draggable="false">`;
  return `<span class="part part-emoji ${cls}">${p ? p.emoji : name}</span>`;
}
if (typeof module !== "undefined" && module.exports) module.exports = { PARTS, PART_GROUPS, PARTS_READY, picName };
