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
  koguman: { memo: "こぐまん の 声", voice: "Sameno", tags: GENKI,   // 2026-11-22 代表：おっとり（[ゆっくり]）は 元気 な 声 と ならぶ と 気になる・ほか の キャラ と の 差 も 大きい → 元気 に そろえる
    alsoShared: true, onlyWhenAsked: true, ...V4 },
};
// V2=1 … multilingual v2（日本語指定・タグ なし）で 作る。v4 で どうしても 言い方 が へん な もの 用（ごほん・ごだい・ひまり で OK だった）
if (process.env.V2) for (const c of Object.values(CHARA)) Object.assign(c, { model: "eleven_multilingual_v2", lang: "ja", tags: "", settings: { stability: 0.7, similarity_boost: 0.95, style: 0, use_speaker_boost: true } });
const CHARA_MEMOS = Object.values(CHARA).map((c) => c.memo);
const SKIP_SHARED = ["英語"];
const YOMI = [[/しょべるん/g, "ショベルン"], [/♪/g, ""]];   // 声 を 作る とき だけ の 書きかえ
// 1こ ずつ の 書きかえ（2026-11-21 代表：ききなおして おかしかった もの。タグ も ここ で たせる）
const FIX = {
  "pet-008-car": "ごくごく、 おいしい！",
  "pet-009-car": "ぷはーっ！",
  "pet-017-car": "もう一回 投げて！",   // 2026-11-21 代表：「〜」だと 言い方 が へん → c 案
  "pet-017-animal": "もう一回 投げて〜！",   // 2026-11-22 代表：ためした が いま の アプリ の 声 の まま に（作りなおさない）
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
  "dots-001": { tags: GENKI, text: "数字の順番に、点をつなごう！何ができるかな？" },   // 2026-11-23 代表：「1」は v4・v2・つなぎ どれも へん → ことば を「すうじ の じゅんばん に」に かえた（画面 も）
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
  // 2026-11-21 こぐまん 3かいめ（50こ）：とけい は「十二時！」と おなじ 形（元気に・漢字・！）。「十分」は じゅうぶん と 読まれる ので ひらがな。ほめる 文 は 元気に＋漢字＋「、」
  "clock-002": { tags: GENKI, text: "一時！" },
  "clock-003": { tags: GENKI, text: "二時！" },
  "clock-004": { tags: GENKI, text: "三時！" },
  "clock-005": { tags: GENKI, text: "四時！" },
  "clock-006": { tags: GENKI, text: "五時！" },
  "clock-007": { tags: GENKI, text: "六時！" },
  "clock-008": { tags: GENKI, text: "しち時！" },
  "clock-009": { tags: GENKI, text: "はち時！" },   // 「八時」は はっち に なる
  "clock-010": { tags: GENKI, text: "九時！" },
  "clock-011": { tags: GENKI, text: "十時！" },
  "clock-012": { tags: GENKI, text: "十一時！" },
  "clock-013": { tags: GENKI, text: "ちょうど だね！" },   // 「ちょうど！」は さがる → 代表：c 案
  "clock-014": { tags: GENKI, text: "五分！" },
  "clock-015": { tags: GENKI, text: "じゅっぷん！" },
  "clock-016": { tags: GENKI, text: "十五分！" },
  "clock-017": { tags: GENKI, text: "にじゅっぷん！" },
  "clock-018": { tags: GENKI, text: "二十五分！" },
  "clock-019": { tags: GENKI, text: "さんじゅっぷん！" },
  "clock-020": { tags: GENKI, text: "三十五分！" },
  "clock-021": { tags: GENKI, text: "よんじゅっぷん！" },
  "clock-022": { tags: GENKI, text: "四十五分！" },
  "clock-023": { tags: GENKI, text: "ごじゅっぷん！" },
  "clock-024": { tags: GENKI, text: "五十五分！" },
  "clock-025": "針を動かして",
  "clock-026": "にしよう",
  "count-004": [{ tags: GENKI, text: "いくつあった？" }, { tags: GENKI, text: "幾つ、あった？" }],   // 2026-11-23 代表 NG → ためし 2つ
  "count-005": "もう一度、数えてみよう",
  "count-006": { tags: GENKI, text: "正解！" },
  "grow-015": { tags: GENKI, text: "道つなぎ" },
  "grow-016": { tags: GENKI, text: "前より、まっすぐ引けるようになったね！" },
  "grow-017": { tags: GENKI, text: "前より、はみ出さないで書けるようになったね！" },
  "grow-018": { tags: GENKI, text: "前より、速く書けるようになったね！" },
  "grow-019": { tags: GENKI, text: "消しゴムを使うのが、減ったね！" },
  "grow-020": { tags: GENKI, text: "前より、すらすら読めるようになったね！" },
  "grow-021": { tags: GENKI, text: "一人で読める言葉が、増えたね！" },
  "grow-022": { tags: GENKI, text: "順番に、読めるようになったね！" },
  "grow-023": { tags: GENKI, text: "前より、速くできるようになったね！" },
  "grow-024": { tags: GENKI, text: "前より、間違いが減ったね！" },
  "grow-025": { tags: GENKI, text: "前より、たくさんできたね！" },
  "grow-026": "初めて",
  "grow-027": { tags: GENKI, text: "ができたね！" },
  "grow-028": "新しく",
  "grow-029": { tags: GENKI, text: "が書けるようになったね！" },
  "grow-030": { tags: GENKI, text: "が読めるようになったね！" },
  "grow-031": "全部で",
  "grow-032": { tags: GENKI, text: "この文字が書けるようになったよ！" },
  "grow-033": { tags: GENKI, text: "にちも、頑張ってるね！" },
  "grow-034": { tags: GENKI, text: "初めての勉強、できたね！" },
  "grow-035": { tags: GENKI, text: "今日は、たくさん頑張ったね！" },
  "grow-036": "そろそろ、一休みしよう",
  // 2026-11-21 日 の かず（ふつか・みっか…）と「も がんばってるね！」。みじかい ので 元気に（[ゆっくり] だと ささやく）
  // 日 の かず は 1こ ずつ だと へん（代表）→ 文 まるごと。漢字（代表：a 案）
  "grow-038": { tags: GENKI, text: "二日も、頑張ってるね！" },
  "grow-039": { tags: GENKI, text: "三日も、頑張ってるね！" },
  "grow-040": { tags: GENKI, text: "四日も、頑張ってるね！" },
  "grow-041": { tags: GENKI, text: "五日も、頑張ってるね！" },
  "grow-042": { tags: GENKI, text: "六日も、頑張ってるね！" },
  "grow-043": { tags: GENKI, text: "七日も、頑張ってるね！" },
  "grow-044": { tags: GENKI, text: "八日も、頑張ってるね！" },
  "grow-045": { tags: GENKI, text: "九日も、頑張ってるね！" },
  "grow-046": { tags: GENKI, text: "十日も、頑張ってるね！" },
  "grow-033": { tags: GENKI, text: "も、頑張ってるね！" },
  "grow-037": { tags: GENKI, text: "毎日、頑張ってるね！" },
  // 2026-11-21 こぐまん 5かいめ：ものがたり は 漢字＋「、」。こぐまん は「コグマン」（sword-022 と おなじ）。さけぶ 文 は 元気に
  "story-007": "「きれいだね」と、コグマンは言いました。",
  "story-009": "アヒルは「ガアガア」と鳴きました。",   // 代表：a 案（カタカナ）   // 「があがあ」が へん（代表）
  "story-010": "コグマンも「ガアガア」と、真似をしました。",
  "story-011": "空から、ぽつぽつ雨が降ってきました。",
  "story-012": "大きな葉っぱの下で、雨宿り。",
  "story-013": "雨がやむと、虹が出ました。",
  "story-014": { tags: GENKI, text: "「わあ、虹だ！」" },
  // 「にこにこ」は「にこにこ」「ニコニコ」「、」なし ぜんぶ へん（代表）
  "story-015": { tags: "[かわいく][幼い声]", text: "コグマンは、ニコニコ、おうちに帰りました。" },   // 2026-11-23 代表：c（元気に なし・ニコニコ）
  "story-016": "ショベルンの、お散歩",
  "story-017": "ショベルンは、お散歩に行きます。",
  "story-018": "「きれいだね」と、ショベルンは言いました。",
  "story-019": "ショベルンも「ガアガア」と、真似をしました。",   // story-010 に あわせる（代表）
  "story-020": { tags: "[うれしそうに][かわいく][幼い声]", text: "ショベルンは、にこにこ、おうちに帰りました。" },   // 代表：b 案
  "story-021": "キャロの、お散歩",
  "story-022": "キャロは、お散歩に行きます。",
  "story-023": "「きれいだね」と、キャロは言いました。",
  "story-024": "キャロも「ガアガア」と、真似をしました。",
  "story-025": { tags: "[うれしそうに][かわいく][幼い声]", text: "キャロは、にこにこ、おうちに帰りました。" },   // 代表：b 案
  "story-026": "ショベルンの、砂場",
  "story-027": "ショベルンは、働く車。",
  "story-028": "今日は、公園でお仕事です。",
  "story-029": "子どもたちが「砂場を作って」と言いました。",
  "story-030": "ショベルンは、砂をすくいます。",
  "story-031": "ざっく、ざっく、砂がたまっていきます。",
  "story-032": "あれ？大きな石がありました。",
  "story-033": "「よいしょ、よいしょ」ショベルンは頑張ります。",
  "story-034": { tags: GENKI, text: "いしわ、ごろんとどきました。" },   // 2026-11-23 代表：b（は を わ と 書く）
  "story-035": "ふかふかの砂場ができました。",
  "story-036": "子どもたちは、砂でお城を作ります。",
  "story-037": { tags: GENKI, text: "「ショベルン、ありがとう！」" },
  "story-038": "ショベルンは嬉しくて、「ぷっぷっぷ」と鳴らしました。",
  "story-039": "キャロと、芋虫",
  "story-040": "キャロは、畑のにんじん。",
  "story-041": { tags: GENKI, text: "まいにち、おひさまを あびて います。" },   // 2026-11-23 代表：b（ひらがな）
  "story-042": "ある日、芋虫がやってきました。",
  "story-043": "「お腹がすいたよう」芋虫は、泣きそうです。",
  "story-044": "キャロは、自分の葉っぱをあげました。",   // 2026-11-21 代表：文 を かえた
  "story-045": "芋虫は、もぐもぐ食べました。",
  "story-046": "それから、眠ってしまいました。",
  "story-047": "何日も、何日も、たちました。",
  "story-048": "ある朝、きれいな蝶々が飛んできました。",
  "story-049": "「あのときの芋虫だよ。ありがとう」",
  "story-050": "ちょうちょは、はたけを、ひらひら とびました。",   // 代表：b 案（ひらがな）   // 「ひらひら とびひらしました」に なった（代表）
  "story-051": "キャロは、にっこり笑いました。",
  "count-001": "お花",
  "count-002": "お星さま",
  "count-003": "を、ひとつずつ触って数えよう",
  "count-011": "右のお皿に乗せよう",
  "count-014": { tags: GENKI, text: "ぴったり！" },
  "count-016": "で、同じだね",
  // 2026-11-21 こぐまん 6かいめ（しんさく）：漢字＋「、」・さけぶ 文 と 1語 は 元気に・こぐまん は コグマン
  "new-001": { tags: GENKI, text: "見ててね！" },
  "new-002": { tags: GENKI, text: "いいね！自由に描いてね" },
  "new-003": { tags: GENKI, text: "もう少し、描いてみよう！" },
  "new-004": "今度は",
  "new-005": { tags: GENKI, text: "君の番！" },
  // 2026-11-21 代表：「の番！」（ゆっくり）は イントネーション が いい けど、もっと 元気 に → 「の番！」の まま タグ を 元気 に
  "new-006": { tags: "[元気いっぱいに][かわいく][幼い声]", text: "の、番！" },   // 代表：c 案
  "new-007": "お友達に、髪の毛を描いてね",
  "new-008": { tags: GENKI, text: "ぐるぐる上手！素敵な髪の毛だね" },
  "new-009": "木に、葉っぱをいっぱい描いてね",
  "new-010": { tags: GENKI, text: "葉っぱがいっぱい！元気な木になったね" },
  "new-011": "雲から、雨を降らせてね",
  "new-012": { tags: GENKI, text: "ざあざあ、雨が降ってきた！カタツムリさんが喜んでるよ" },
  "new-013": "ライオンに、たてがみを描いてね",
  "new-014": { tags: GENKI, text: "ギザギザ、かっこいい！強そうなライオンだね" },
  "new-015": "地面に、草を生やしてね",
  "new-016": { tags: GENKI, text: "草が、ぐんぐん伸びたね！" },
  "new-017": "海に、波を描いてね",
  "new-018": { tags: GENKI, text: "なみなみ、じょうず！お魚が泳いでるみたい" },   // 「上手」が へん（代表）
  "new-019": "ひよこが",
  "new-020": "何羽",
  "new-021": "お魚が",
  "new-022": "何匹",
  "new-023": "てんとう虫が",
  "new-024": "うさぎが",
  "new-025": "りんごが",
  "new-026": "何個",
  "new-027": "いちごが",
  "new-028": "クッキーが",
  "new-029": "何枚",
  "new-030": "おにぎりが",
  "new-031": "コグマンが",
  "new-032": "ショベルンが",
  "new-033": "キャロが",
  "new-034": "いるよ",
  "new-035": "あるよ",
  "new-036": "食べたよ。もぐもぐ",
  "new-037": { tags: GENKI, text: "来たよ！" },
  "new-039": "残りは",
  "new-040": "触って、数えてもいいよ",
  // 2026-11-21 代表：たす・ひく・わ の イントネーション が おかしい。「3 たす 2 は 5」の まんなか に はさむ 部品 なので、
  // 文 の とちゅう の 言い方（うしろ に「、」）と 漢字 を ためす
  "new-041": { tags: "[ゆっくり][かわいく][幼い声]", text: "足す、" },   // 代表：b 案（2かい 言ったら 1かいめ を つかう）
  "new-042": [{ tags: GENKI, text: "引く、" }, { tags: "[ゆっくり][かわいく][幼い声]", text: "引く、" }, { tags: GENKI, text: "ひく、" }],
  "new-043": [{ tags: GENKI, text: "わ、" }, { tags: "[ゆっくり][かわいく][幼い声]", text: "わ、" }, { tags: GENKI, text: "は、" }],   // 「3 たす 2 は 5」の「は」（わ と よむ）。「羽」は まちがい
  "new-044": { tags: GENKI, text: "惜しい！ひとつずつ触って、数えてみよう" },
  "new-045": "ブロックを並べて、「スタート」を押してね",   // アプリ の 文 に あわせた
  "new-046": "ブロックを並べて、おやつまで連れていってね",
  // 「上」は 言い方 が へん、「うえ！」「うえ」も へん（2026-11-21 代表）。みぎ・した・ひだり は「〇〇！」（元気に）で OK
  // new-047「うえ」・new-042「ひく」は 1語 だと へん → ならべて 言わせて 切りだした（作りなおす とき は docs/voice-system.md）。new-043 は kana-044 を つかいまわし
  "new-047": { tags: GENKI, text: "うえ！" },
  "new-048": { tags: GENKI, text: "みぎ！" },   // 2026-11-23 代表：元気 に そろえる とき a   // 「右」は 言い方 が へん（代表）
  "new-049": { tags: GENKI, text: "した！" },   // 2026-11-23 代表：a   // 「下」は 言い方 が へん（代表）
  "new-050": { tags: GENKI, text: "ひだり！" },   // 2026-11-23 代表：a   // 「左」は 言い方 が へん（代表）
  "new-051": "番目で、岩に止まっちゃった。どこを直す？",
  // 2026-11-21 こぐまん 7かいめ：漢字＋「、」・1語 と さけぶ 文 は 元気に（1語 が へん なら ならべて 切りだす）
  "count-007": "と、同じだけ、",
  "count-008": "コグマンを",
  "count-009": "ショベルンを",
  "count-010": "キャロを",
  "count-012": "重すぎるみたい。お皿の",
  "count-013": "外に出そう",
  "count-015": { tags: GENKI, text: "と" },   // 代表：a 案
  "new-052": "番目で、端で止まっちゃった。どこを直す？",
  "new-053": { tags: "[かわいく][幼い声]", text: "おやつまで、届かなかった。ブロックを足してみよう" },   // ゆっくり すぎ → [ゆっくり] なし（代表）
  "new-054": { tags: GENKI, text: "おやつに着いた！やったね" },
  "new-055": { tags: GENKI, text: "おやつに着いた！" },
  "new-056": "のブロックで、いけたね",
  "new-058": "ブロックがいっぱいだよ。いらないブロックを、ゴミ箱へ",
  "new-059": "消すときは、ゴミ箱へ運んでね",
  "new-060": "繰り返しは、矢印のブロックに重ねてね",
  "new-061": { tags: GENKI, text: "消したよ" },
  "new-062": { tags: GENKI, text: "2回" },
  "new-063": { tags: GENKI, text: "3回" },
  "new-065": "おやつで、持つブロックを使って、おうちまで届けよう",
  "new-066": { tags: GENKI, text: "持つ" },
  "new-067": { tags: GENKI, text: "持ったよ！" },
  "new-068": "番目：ここには、おやつがないよ。どこで持つ？",
  "new-069": "おやつを持っていないよ。持つブロックで持とう",
  "new-070": { tags: "[かわいく][幼い声]", text: "おうちまで、届かなかった。ブロックを足してみよう" },
  "new-071": { tags: GENKI, text: "おうちに届けた！プログラム完成！" },
  "new-072": "お手本と、同じ形を塗ってね",
  "new-073": "お手本と、同じ色、同じ場所を塗ってね",
  "new-074": "鏡に映したみたいに、右側を塗ってね",
  "new-075": { tags: GENKI, text: "赤" },
  "new-076": { tags: GENKI, text: "青" },
  "new-077": "どこか違うみたい。お手本と、よく比べてみよう",
  "new-078": { tags: GENKI, text: "お手本と同じ形！ぴったりだね" },
  "new-079": { tags: GENKI, text: "鏡に映したみたい！ぴったりだね" },
  "new-132": { tags: GENKI, text: "動物" },
  "new-134": { tags: GENKI, text: "果物" },
  "new-139": { tags: GENKI, text: "いろ" },   // 1語 だと へん → 「どうぶつ、くだもの、いろ、からだ。」から 切りだす（代表）
  "new-153": { tags: GENKI, text: "体" },
  "new-159": "の英語だよ。絵を触って、聞いてみよう",
  "new-160": "聞いた言葉の絵は、どれ？",
  "counter-021": { tags: GENKI, text: "いちわ" },
  "counter-022": { tags: GENKI, text: "にわ" },
  "counter-023": { tags: GENKI, text: "さんわ" },
  "counter-024": { tags: GENKI, text: "よんわ" },
  "counter-025": { tags: GENKI, text: "ごわ" },
  "counter-026": { tags: GENKI, text: "ろくわ" },
  "counter-027": { tags: GENKI, text: "七羽" },   // 代表：b 案（漢字）
  "counter-028": { tags: GENKI, text: "八羽" },
  "counter-029": { tags: GENKI, text: "きゅうわ" },
  "counter-030": { tags: GENKI, text: "じゅうわ" },
  "counter-031": { tags: GENKI, text: "いちまい" },
  // 2026-11-22 つづき：にっこり・わらいました・プログラミング2・かぞえ方39・すうじのカード 1〜7（みじかい ので [元気に]）
  "sword-108": { tags: GENKI, text: "にっこり" },
  "sword-109": { tags: "[かわいく][幼い声]", text: "わらいました。" },   // 代表：a 案
  "new-057": { tags: GENKI, text: "ブロックを、プログラムに運んでね" },
  "new-064": { tags: GENKI, text: "矢印の後に使うと、二回進むよ" },
  "counter-032": { tags: GENKI, text: "にまい" },
  "counter-033": { tags: GENKI, text: "さんまい" },
  "counter-034": { tags: GENKI, text: "よんまい" },
  "counter-035": { tags: GENKI, text: "ごまい" },
  "counter-036": { tags: GENKI, text: "ろくまい" },
  "counter-037": { tags: GENKI, text: "ななまい" },
  "counter-038": { tags: GENKI, text: "はちまい" },
  "counter-039": { tags: GENKI, text: "きゅうまい" },
  "counter-040": { tags: GENKI, text: "じゅうまい" },
  "counter-041": { tags: GENKI, text: "いっぽん" },
  "counter-042": { tags: GENKI, text: "いっぽん、にほん、さんぼん、よんほん、ごほん、ろっぽん、ななほん、はっぽん。" },   // 代表：042 は a・047 は b を 切りだし（手 で 切った ので 作りなおさない）
  "counter-043": { tags: GENKI, text: "さんぼん" },
  "counter-044": { tags: GENKI, text: "よんほん" },
  "counter-045": { tags: GENKI, text: "ごほん" },   // 代表：multilingual v2（ja・stability 0.7・similarity 0.95）で 作った もの を OK（2026-11-22。この スクリプト では 作らない・作りなおさない）
  "counter-046": { tags: GENKI, text: "ろっぽん" },
  "counter-047": { tags: GENKI, text: "ななほん" },
  "counter-048": { tags: GENKI, text: "はっぽん" },
  "counter-049": { tags: GENKI, text: "きゅうほん" },
  "counter-050": { tags: GENKI, text: "じゅっぽん" },
  "counter-051": { tags: GENKI, text: "いちだい" },
  "counter-052": { tags: GENKI, text: "にだい" },
  "counter-053": { tags: GENKI, text: "さんだい" },
  "counter-054": { tags: GENKI, text: "よんだい" },
  "counter-055": { tags: GENKI, text: "ごだい" },   // 代表：v4 では 何を しても 言い方 が へん → multilingual v2（language_code ja）で 作った もの を OK（2026-11-22。この スクリプト では 作らない・作りなおさない）
  "counter-056": { tags: GENKI, text: "ろくだい" },
  "counter-057": { tags: GENKI, text: "ななだい" },
  "counter-058": { tags: GENKI, text: "はちだい" },
  "counter-059": { tags: GENKI, text: "きゅうだい" },
  "counter-060": { tags: GENKI, text: "じゅうだい" },
  "counter-061": { tags: GENKI, text: "ひとつ" },
  "counter-062": { tags: GENKI, text: "ふたつ" },
  "counter-063": { tags: GENKI, text: "みっつ" },
  "counter-064": { tags: GENKI, text: "みっつ、よっつ、いつつ、むっつ、ななつ、やっつ、ここのつ。" },   // 代表：064・066・067・068 は a を 切りだし（作りなおさない）
  "counter-065": { tags: GENKI, text: "いつつ" },
  "counter-066": { tags: GENKI, text: "むっつ" },
  "counter-067": { tags: GENKI, text: "ななつ" },
  "counter-068": { tags: GENKI, text: "やっつ" },
  "counter-069": { tags: GENKI, text: "ここのつ" },
  "counter-070": { tags: GENKI, text: "とお" },
  "numcard-001": { tags: GENKI, text: "いち" },
  "numcard-002": { tags: GENKI, text: "に" },
  "numcard-003": { tags: GENKI, text: "さん" },
  "numcard-004": { tags: GENKI, text: "よん" },
  "numcard-005": { tags: GENKI, text: "ご" },
  "numcard-006": { tags: GENKI, text: "ろく" },
  "numcard-007": { tags: GENKI, text: "なな" },
  "extra-001": { tags: GENKI, text: "ブロックを、並べてね" },   // 代表：a 案
  // 元気 に そろえる とき 代表 NG（2026-11-22）→ ためし
  "sensei-004": { tags: "[かわいく][幼い声]", text: "道の真ん中を、通って書けたね" },   // 2026-11-22 代表：元気・タグすくなめ・v2 どれも ちがう → いま の 声（ゆっくり）の まま。作りなおさない
  "trace-001": { tags: "[かわいく][幼い声]", text: "丸から星へ、線を引いてね！" },   // 2026-11-22 代表：元気・タグすくなめ・v2 どれも ちがう → いま の 声（ゆっくり）の まま。作りなおさない
  "trace-003": { tags: "[かわいく][幼い声]", text: "道に戻ろう！" },   // 2026-11-22 代表：元気・タグすくなめ・v2 どれも ちがう → いま の 声（ゆっくり）の まま。作りなおさない
  "trace-013": { tags: "[かわいく][幼い声]", text: "丸から、始めてね" },   // 2026-11-22 代表：元気・タグすくなめ・v2 どれも ちがう → いま の 声（ゆっくり）の まま。作りなおさない
  "trace-014": { tags: GENKI, text: "続きか、丸から、書けるよ" },   // 代表：a 案
  // なまえ（そのまま）で 代表 NG（2026-11-22）→ ためし
  "yobu-031": { tags: GENKI, text: "葵" },   // 代表：b 案（2かい 言った ので 切った）
  "yobu-046": { tags: GENKI, text: "ひまり" },   // 代表：multilingual v2（ja・stability 0.7・similarity 0.95）で 作った もの を OK（この スクリプト では 作らない・作りなおさない）
  "yobu-067": { tags: GENKI, text: "アカリ" },   // 代表：a 案
  "extra-002": { tags: "[かわいく][幼い声]", text: "音を出すよ" },   // 代表：a 案
  "extra-003": { tags: GENKI, text: "お名前が、入っていないよ" },
  "extra-004": { tags: GENKI, text: "それは" },   // 部品：それは＋ことば＋もう一度、聞いてみよう
  "extra-005": { tags: GENKI, text: "もう一度、聞いてみよう" },
  "extra-006": { tags: GENKI, text: "四角の中に" },   // 代表：c 案（「ます」は 読み が へん → ことば を「しかく の なか に」に かえた。2026-11-22）
  "extra-007": { tags: GENKI, text: "を、書いてね" },
  // 2026-11-22 ずかん・カレンダー など の もれ（extra-008〜061）
  "extra-008": { tags: GENKI, text: "動物しんか図鑑" },
  "extra-009": { tags: GENKI, text: "はたらく車しんか図鑑" },
  "extra-010": { tags: GENKI, text: "野菜しんか図鑑" },
  "extra-011": { tags: GENKI, text: "勉強した日に、花丸がつくよ" },
  "extra-012": { tags: GENKI, text: "一月は" },
  "extra-013": { tags: GENKI, text: "二月は" },
  "extra-014": { tags: GENKI, text: "三月は" },
  "extra-015": { tags: GENKI, text: "四月は" },
  "extra-016": { tags: GENKI, text: "五月は" },
  "extra-017": { tags: GENKI, text: "六月は" },
  "extra-018": { tags: GENKI, text: "しちがつは" },
  "extra-019": { tags: GENKI, text: "八月は" },
  "extra-020": { tags: GENKI, text: "九月は" },
  "extra-021": { tags: GENKI, text: "じゅうがつは" },
  "extra-022": { tags: GENKI, text: "十一月は" },
  "extra-023": { tags: GENKI, text: "十二月は" },
  "extra-024": { tags: GENKI, text: "いちにち、頑張ったね！" },
  "extra-025": { tags: GENKI, text: "ふつか、頑張ったね！" },
  "extra-026": [{ tags: GENKI, text: "三日、頑張ったね！" }, { tags: GENKI, text: "三日、頑張ったね！" }, { tags: GENKI, text: "三日、頑張ったね！" }],   // 2026-11-23 代表：漢字 の 言い方 は よい が 雑音 → おなじ 文 で 3かい 作って えらぶ
  "extra-027": [{ tags: GENKI, text: "四日、頑張ったね！" }, { tags: GENKI, text: "よっか！がんばったね！" }],   // 2026-11-23 代表 NG → 漢字 と ひらがな で ためし
  "extra-028": [{ tags: GENKI, text: "五日、頑張ったね！" }, { tags: GENKI, text: "いつか！がんばったね！" }],   // 2026-11-23 代表 NG → 漢字 と ひらがな で ためし
  "extra-029": [{ tags: GENKI, text: "六日、頑張ったね！" }, { tags: GENKI, text: "むいか！がんばったね！" }],   // 2026-11-23 代表 NG → 漢字 と ひらがな で ためし
  "extra-030": [{ tags: GENKI, text: "七日、頑張ったね！" }, { tags: GENKI, text: "なのか！がんばったね！" }],   // 2026-11-23 代表 NG → 漢字 と ひらがな で ためし
  "extra-031": [{ tags: GENKI, text: "八日、頑張ったね！" }, { tags: GENKI, text: "ようか！がんばったね！" }],   // 2026-11-23 代表 NG → 漢字 と ひらがな で ためし
  "extra-032": [{ tags: GENKI, text: "九日、頑張ったね！" }, { tags: GENKI, text: "ここのか！がんばったね！" }],   // 2026-11-23 代表 NG → 漢字 と ひらがな で ためし
  "extra-033": { tags: GENKI, text: "とおか、頑張ったね！" },
  "extra-034": { tags: GENKI, text: "じゅういちにち、頑張ったね！" },
  "extra-035": { tags: GENKI, text: "じゅうににち、頑張ったね！" },
  "extra-036": { tags: GENKI, text: "じゅうさんにち、頑張ったね！" },
  "extra-037": { tags: GENKI, text: "じゅうよっか、頑張ったね！" },
  "extra-038": { tags: GENKI, text: "じゅうごにち、頑張ったね！" },
  "extra-039": { tags: GENKI, text: "じゅうろくにち、頑張ったね！" },
  "extra-040": { tags: GENKI, text: "じゅうしちにち、頑張ったね！" },
  "extra-041": { tags: GENKI, text: "じゅうはちにち、頑張ったね！" },
  "extra-042": { tags: GENKI, text: "じゅうくにち、頑張ったね！" },
  "extra-043": [{ tags: GENKI, text: "二十日、頑張ったね！" }, { tags: GENKI, text: "はつか！がんばったね！" }],   // 2026-11-23 代表 NG → 漢字 と ひらがな で ためし
  "talk-017": [{ tags: GENKI, text: "どこに行きたい？" }, { tags: GENKI, text: "どこに、いきたい？" }],   // 2026-11-23 代表 NG → ためし 2つ
  "talk-020": [{ tags: GENKI, text: "ぞうさん、見たいな〜！" }, { tags: GENKI, text: "象さん、見たいな〜！" }],   // 2026-11-23 代表：「見たいな〜」に して みて
  "talk-033": [{ tags: GENKI, text: "僕のこと、好き？" }, { tags: GENKI, text: "ぼくのこと、すき？" }],   // 2026-11-23 代表 NG
  "word-105": { tags: GENKI, text: "鳥が飛ぶ。" },   // 2026-11-23 元気 に そろえる 9回め（「本を読む。」の 形 に そろえる）
  "word-106": [{ tags: GENKI, text: "ハナが、咲く。" }, { tags: GENKI, text: "お花が、咲く。" }],   // 2026-11-23 代表：「花」の 言い方 が へん → a カタカナ／b「お花」から「お」を 切る／c は V2=1「花が咲く。」
  "word-107": { tags: GENKI, text: "雨が降る。" },   // 2026-11-23 元気 に そろえる 9回め（「本を読む。」の 形 に そろえる）
  "word-108": { tags: GENKI, text: "星が光る。" },   // 2026-11-23 元気 に そろえる 9回め（「本を読む。」の 形 に そろえる）
  "word-109": { tags: GENKI, text: "魚が泳ぐ。" },   // 2026-11-23 元気 に そろえる 9回め（「本を読む。」の 形 に そろえる）
  "word-110": { tags: GENKI, text: "うさぎが跳ねる。" },   // 2026-11-23 元気 に そろえる 9回め（「本を読む。」の 形 に そろえる）
  "word-111": { tags: GENKI, text: "くまが食べる。" },   // 2026-11-23 元気 に そろえる 9回め（「本を読む。」の 形 に そろえる）
  "word-112": { tags: GENKI, text: "船が進む。" },   // 2026-11-23 元気 に そろえる 9回め（「本を読む。」の 形 に そろえる）
  "word-113": { tags: GENKI, text: "りんごは赤い。" },   // 2026-11-23 元気 に そろえる 9回め（「本を読む。」の 形 に そろえる）
  "word-114": { tags: GENKI, text: "海は広い。" },   // 2026-11-23 元気 に そろえる 9回め（「本を読む。」の 形 に そろえる）
  "word-115": { tags: GENKI, text: "象は大きい。" },   // 2026-11-23 元気 に そろえる 9回め（「本を読む。」の 形 に そろえる）
  "word-116": { tags: GENKI, text: "ねずみは小さい。" },   // 2026-11-23 元気 に そろえる 9回め（「本を読む。」の 形 に そろえる）
  "word-117": { tags: GENKI, text: "車が走る。" },   // 2026-11-23 元気 に そろえる 9回め（「本を読む。」の 形 に そろえる）
  "word-086": { tags: GENKI, text: "本を読む。" },   // 2026-11-23 代表：b
  "word-087": { tags: GENKI, text: "ご飯を、食べる" },   // 2026-11-23 元気 に そろえる 8回め
  "word-103": { tags: GENKI, text: "犬が、走る" },   // 2026-11-23 元気 に そろえる 8回め
  "word-104": { tags: GENKI, text: "猫が、寝る" },   // 2026-11-23 元気 に そろえる 8回め
  "story-001": { tags: GENKI, text: "右上から、線をなぞって読もう" },   // 2026-11-23 元気 に そろえる 6回め（漢字 に して 読み を はっきり）
  "story-002": { tags: GENKI, text: "おしまい！最後まで読めたね！" },   // 2026-11-23 元気 に そろえる 6回め（漢字 に して 読み を はっきり）
  "story-003": { tags: GENKI, text: "コグマンのお散歩" },   // 2026-11-23 元気 に そろえる 6回め（漢字 に して 読み を はっきり）
  "story-004": { tags: GENKI, text: "今日は、いい天気。" },   // 2026-11-23 元気 に そろえる 6回め（漢字 に して 読み を はっきり）
  "story-005": { tags: GENKI, text: "コグマンは、お散歩に行きます。" },   // 2026-11-23 元気 に そろえる 6回め（漢字 に して 読み を はっきり）
  "story-006": { tags: GENKI, text: "道に、赤い花が咲いています。" },   // 2026-11-23 元気 に そろえる 6回め（漢字 に して 読み を はっきり）
  "story-008": { tags: GENKI, text: "池のそばに、アヒルがいました。" },   // 2026-11-23 元気 に そろえる 6回め（漢字 に して 読み を はっきり）
  "free-001": { tags: GENKI, text: "苦手を、やっつけよう！" },   // 2026-11-23 元気 に そろえる 4回め（漢字 に して 読み を はっきり）
  "free-002": { tags: GENKI, text: "を、ゆっくり丁寧に書こう" },   // 2026-11-23 元気 に そろえる 4回め（漢字 に して 読み を はっきり）
  "free-003": [{ tags: GENKI, text: "お手本を見てね！" }, { tags: GENKI, text: "お手本を、見てね！" }],   // 2026-11-23 代表：うしろ に 文 が つづく と 言い方 が へん → 文 を 「おてほん を みてね！「あ」を かいて みよう」に かえる 案（ここ で 文 が おわる）
  "free-004": { tags: GENKI, text: "を書いてみよう" },   // 2026-11-23 元気 に そろえる 4回め（漢字 に して 読み を はっきり）
  "free-006": { tags: GENKI, text: "って読めたよ！" },   // 2026-11-23 元気 に そろえる 4回め（漢字 に して 読み を はっきり）
  "free-007": { tags: GENKI, text: "に見えるよ！上手！" },   // 2026-11-23 元気 に そろえる 4回め（漢字 に して 読み を はっきり）
  "free-008": { tags: GENKI, text: "惜しい！お手本をよく見て、もう一度書いてみよう" },   // 2026-11-23 元気 に そろえる 4回め（漢字 に して 読み を はっきり）
  "free-009": { tags: GENKI, text: "最後まで頑張ったね！次はきっと書けるよ" },   // 2026-11-23 元気 に そろえる 4回め（漢字 に して 読み を はっきり）
  "trace-019": { tags: GENKI, text: "いいね！もう一回書こう" },   // 2026-11-23 元気 に そろえる 4回め（漢字 に して 読み を はっきり）
  "trace-020": { tags: GENKI, text: "あと一回！最後は丁寧に書こう" },   // 2026-11-23 元気 に そろえる 4回め（漢字 に して 読み を はっきり）
  "name-003": [{ tags: GENKI, text: "の番だね！" }, { tags: GENKI, text: "の、番だね" }],   // 2026-11-23 代表 NG → ためし 2つ
  "extra-044": { tags: GENKI, text: "にじゅういちにち、頑張ったね！" },
  "extra-045": { tags: GENKI, text: "にじゅうににち、頑張ったね！" },
  "extra-046": { tags: GENKI, text: "にじゅうさんにち、頑張ったね！" },
  "extra-047": { tags: GENKI, text: "にじゅうよっか、頑張ったね！" },
  "extra-048": { tags: GENKI, text: "にじゅうごにち、頑張ったね！" },
  "extra-049": { tags: GENKI, text: "にじゅうろくにち、頑張ったね！" },
  "extra-050": { tags: GENKI, text: "にじゅうしちにち、頑張ったね！" },
  "extra-051": { tags: GENKI, text: "にじゅうはちにち、頑張ったね！" },
  "extra-052": { tags: GENKI, text: "にじゅうくにち、頑張ったね！" },
  "extra-053": { tags: GENKI, text: "さんじゅうにち、頑張ったね！" },
  "extra-054": { tags: GENKI, text: "さんじゅういちにち、頑張ったね！" },
  "extra-055": { tags: GENKI, text: "お手本なしで書く" },
  "extra-056": { tags: GENKI, text: "苦手練習" },
  "extra-057": { tags: GENKI, text: "お絵かき" },
  "extra-058": { tags: GENKI, text: "足し算、引き算" },
  "extra-059": { tags: GENKI, text: "おやつ届け" },
  "extra-060": { tags: GENKI, text: "アルファベット" },
  "extra-061": { tags: GENKI, text: "英語の言葉" },
  // アルファベット（2026-11-22 代表：まず こぐまん の 声 で。聞きにくければ 英語 らしい 声）。a＝英語 の 字、b＝カタカナ
  "new-080": [{ tags: GENKI, text: "A" }, { tags: GENKI, text: "エー" }],
  "new-081": [{ tags: GENKI, text: "B" }, { tags: GENKI, text: "ビー" }],
  "new-082": [{ tags: GENKI, text: "C" }, { tags: GENKI, text: "シー" }],
  "new-083": [{ tags: GENKI, text: "D" }, { tags: GENKI, text: "ディー" }],
  "new-084": [{ tags: GENKI, text: "E" }, { tags: GENKI, text: "イー" }],
  "new-085": [{ tags: GENKI, text: "F" }, { tags: GENKI, text: "エフ" }],
  "new-086": [{ tags: GENKI, text: "G" }, { tags: GENKI, text: "ジー" }],
  "new-087": [{ tags: GENKI, text: "H" }, { tags: GENKI, text: "エイチ" }],
  "new-088": [{ tags: GENKI, text: "I" }, { tags: GENKI, text: "アイ" }],
  "new-089": [{ tags: GENKI, text: "J" }, { tags: GENKI, text: "ジェー" }],
  "new-090": [{ tags: GENKI, text: "K" }, { tags: GENKI, text: "ケー" }],
  "new-091": [{ tags: GENKI, text: "L" }, { tags: GENKI, text: "エル" }],
  "new-092": [{ tags: GENKI, text: "M" }, { tags: GENKI, text: "エム" }],
  "new-093": [{ tags: GENKI, text: "N" }, { tags: GENKI, text: "エヌ" }],
  "new-094": [{ tags: GENKI, text: "O" }, { tags: GENKI, text: "オー" }],
  "new-095": [{ tags: GENKI, text: "P" }, { tags: GENKI, text: "ピー" }],
  "new-096": [{ tags: GENKI, text: "Q" }, { tags: GENKI, text: "キュー" }],
  "new-097": [{ tags: GENKI, text: "R" }, { tags: GENKI, text: "アール" }],
  "new-098": [{ tags: GENKI, text: "S" }, { tags: GENKI, text: "エス" }],
  "new-099": [{ tags: GENKI, text: "T" }, { tags: GENKI, text: "ティー" }],
  "new-100": [{ tags: GENKI, text: "U" }, { tags: GENKI, text: "ユー" }],
  "new-101": [{ tags: GENKI, text: "V" }, { tags: GENKI, text: "ブイ" }],
  "new-102": [{ tags: GENKI, text: "W" }, { tags: GENKI, text: "ダブリュー" }],
  "new-103": [{ tags: GENKI, text: "X" }, { tags: GENKI, text: "エックス" }],
  "new-104": [{ tags: GENKI, text: "Y" }, { tags: GENKI, text: "ワイ" }],
  "new-105": [{ tags: GENKI, text: "Z" }, { tags: GENKI, text: "ゼット" }],
  "numcard-008": { tags: GENKI, text: "はち" },
  "numcard-009": { tags: GENKI, text: "きゅう" },
  "numcard-010": { tags: GENKI, text: "じゅう" },
  // sensei-003「まる！」は 声 が さがる ので やめて「いいね！」に（trace-005 を つかいまわす。2026-11-21 代表）
  "sensei-008": "最後まで書けたね",
  "sensei-009": "番目の線が、とっても綺麗",   // 代表：a 案
  "sensei-010": "番目の線を、ゆっくりなぞってみよう",   // 代表：a 案
  // sensei-012：b「次は 道の まんなかを…」が よいが「次は」が さがる（代表）
  "sensei-012": "こんどは 道の まんなかを ゆっくり 通ってみよう",   // 代表：c 案（画面 も「こんどは」に）
  // sword-022「こぐまんも」の 言い方 が へん（代表）
  "sword-022": "コグマンも",   // 代表：b 案（カタカナ）
  // 2026-11-22 つづき（sword-056〜105）。いしは・ちょうちょは・はたけを は ものがたり の 文 で 代表 が えらんだ ひらがな
  "sword-056": { tags: GENKI, text: "浴びて、いしは、石が、たまって。" },   // 代表：ならべて 言わせて 切りだし（056 は b・057/058/062/075/080/088/089 は a。手 で 切った ので 作りなおさない）
  "sword-057": { tags: GENKI, text: "あれ？" },
  "sword-058": { tags: GENKI, text: "石が" },
  "sword-059": { tags: GENKI, text: "ありました" },
  "sword-060": { tags: GENKI, text: "よいしょ、よいしょ" },
  "sword-061": { tags: GENKI, text: "頑張ります" },
  "sword-062": { tags: GENKI, text: "いしは" },
  "sword-063": { tags: GENKI, text: "ごろんと" },
  "sword-064": { tags: GENKI, text: "どきました" },
  "sword-065": { tags: GENKI, text: "ふかふかの" },
  "sword-066": { tags: GENKI, text: "砂場が" },
  "sword-067": { tags: GENKI, text: "できました" },
  "sword-068": { tags: GENKI, text: "子どもたちは" },
  "sword-069": { tags: GENKI, text: "砂で" },
  "sword-070": { tags: GENKI, text: "お城を" },
  "sword-071": { tags: GENKI, text: "作ります" },
  "sword-072": { tags: GENKI, text: "ショベルン" },
  "sword-073": { tags: GENKI, text: "ありがとう" },
  "sword-074": { tags: GENKI, text: "嬉しくて" },
  "sword-075": { tags: GENKI, text: "ぷっぷっぷと" },
  "sword-076": { tags: GENKI, text: "鳴らしました" },
  "sword-077": { tags: GENKI, text: "畑の" },
  "sword-078": { tags: GENKI, text: "毎日" },
  "sword-079": { tags: GENKI, text: "砂を、おひさまを、畑を。" },   // 代表：a 案（切りだし。手 で 切った ので 作りなおさない）
  "sword-080": { tags: GENKI, text: "浴びて" },
  "sword-081": { tags: GENKI, text: "ある" },
  "sword-082": { tags: GENKI, text: "芋虫が" },
  "sword-083": { tags: GENKI, text: "やって" },
  "sword-084": { tags: GENKI, text: "お腹が" },
  "sword-085": { tags: GENKI, text: "すいたよう" },
  "sword-086": { tags: GENKI, text: "芋虫は" },
  "sword-087": { tags: GENKI, text: "泣きそうです" },
  "sword-088": { tags: GENKI, text: "自分の" },
  "sword-089": { tags: GENKI, text: "葉っぱを" },
  "sword-090": { tags: GENKI, text: "あげました" },
  "sword-091": { tags: GENKI, text: "もぐもぐ" },
  "sword-092": { tags: GENKI, text: "食べました" },
  "sword-093": { tags: GENKI, text: "それから" },
  "sword-094": { tags: GENKI, text: "眠って" },
  "sword-095": { tags: GENKI, text: "しまいました" },
  "sword-096": { tags: GENKI, text: "何日も" },
  "sword-097": { tags: GENKI, text: "たちました" },
  "sword-098": { tags: GENKI, text: "朝" },
  "sword-099": { tags: GENKI, text: "きれいな" },
  "sword-100": { tags: GENKI, text: "蝶々が" },
  "sword-101": { tags: GENKI, text: "飛んで" },
  "sword-102": { tags: GENKI, text: "あのときの" },
  "sword-103": { tags: GENKI, text: "芋虫" },
  "sword-104": { tags: GENKI, text: "ちょうちょは" },
  "sword-105": { tags: GENKI, text: "はたけを" },   // 代表：a 案（story-050 から 切りだし。106 ひらひら・107 とびました も。手 で 切った ので 作りなおさない）
  // ものがたり の ことば（1つ ずつ）：短い ことば は [ゆっくり] だと 2かい 言う ので [元気に]、できる だけ 漢字（2026-11-22）
  "sword-002": { tags: GENKI, text: "今日は" },
  "sword-003": { tags: GENKI, text: "いい" },
  "sword-004": { tags: GENKI, text: "天気" },
  "sword-005": { tags: GENKI, text: "コグマンは" },
  "sword-006": { tags: GENKI, text: "お散歩に" },
  "sword-007": { tags: GENKI, text: "行きます" },
  "sword-008": { tags: GENKI, text: "道に" },
  "sword-009": { tags: GENKI, text: "赤い" },
  "sword-010": { tags: GENKI, text: "お花が" },   // 代表：c 案
  "sword-011": { tags: GENKI, text: "咲いて" },
  "sword-012": { tags: GENKI, text: "います" },
  "sword-013": { tags: GENKI, text: "きれいだね、と" },   // 代表：c 案
  "sword-014": { tags: GENKI, text: "言いました" },
  "sword-015": { tags: GENKI, text: "池の、虹が、砂を、砂が。" },   // 代表：a 案（ならべて 言わせて 切りだし。手 で 切った ので 作りなおさない）
  "sword-016": { tags: GENKI, text: "そばに" },
  "sword-017": { tags: GENKI, text: "アヒルが" },
  "sword-018": { tags: GENKI, text: "いました" },
  "sword-019": { tags: GENKI, text: "アヒルは" },   // 2026-11-22 代表：NG → ためし
  "sword-020": { tags: GENKI, text: "ガアガアと" },
  "sword-021": { tags: GENKI, text: "鳴きました" },
  "sword-023": { tags: GENKI, text: "真似を" },
  "sword-024": { tags: GENKI, text: "しました" },
  "sword-025": { tags: GENKI, text: "空から" },
  "sword-026": { tags: GENKI, text: "ぽつぽつ" },
  "sword-027": { tags: GENKI, text: "雨が" },
  "sword-028": { tags: GENKI, text: "降って" },
  "sword-029": { tags: GENKI, text: "きました" },
  "sword-030": { tags: GENKI, text: "大きな" },
  "sword-031": { tags: GENKI, text: "葉っぱの" },
  "sword-032": { tags: GENKI, text: "下で" },
  "sword-033": { tags: GENKI, text: "雨宿り" },
  "sword-034": { tags: GENKI, text: "止むと" },   // 代表：b 案
  "sword-035": { tags: GENKI, text: "池の、虹が、砂を、砂が。" },   // 代表：a 案（ならべて 言わせて 切りだし。手 で 切った ので 作りなおさない）
  "sword-036": { tags: GENKI, text: "出ました" },
  "sword-039": { tags: GENKI, text: "おうちに" },
  "sword-040": { tags: GENKI, text: "帰りました" },
  "sword-041": { tags: GENKI, text: "ショベルンは" },
  "sword-043": { tags: GENKI, text: "キャロは" },
  "sword-045": { tags: GENKI, text: "働く" },
  "sword-046": { tags: GENKI, text: "公園で" },
  "sword-047": { tags: GENKI, text: "お仕事" },
  "sword-048": { tags: GENKI, text: "です。" },   // 代表：b 案
  "sword-049": { tags: GENKI, text: "子どもたちが" },
  "sword-050": { tags: GENKI, text: "砂場を" },
  "sword-051": { tags: GENKI, text: "「作って」と" },
  "sword-052": { tags: GENKI, text: "池の、虹が、砂を、砂が。" },   // 代表：a 案（ならべて 言わせて 切りだし。手 で 切った ので 作りなおさない）
  "sword-053": { tags: GENKI, text: "すくいます" },
  "sword-054": { tags: GENKI, text: "ざっく" },
  "sword-055": { tags: GENKI, text: "池の、虹が、砂を、砂が。" },   // 代表：a 案（ならべて 言わせて 切りだし。手 で 切った ので 作りなおさない）
  "sword-038": { tags: "[かわいく][幼い声]", text: "ニコニコ" },   // 代表：b 案
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
    // こぐまん の ホーム の ことば（pet-NNN-animal）は、しょべるん で なおした 読み（FIX の pet-NNN-car）を つかう（2026-11-22：元気 に そろえる とき）
    const fx = FIX[r[iId]] !== undefined ? FIX[r[iId]] : FIX[r[iId].replace(/-animal$/, "-car")];
    const fixes = Array.isArray(fx) ? fx : [fx];
    fixes.forEach((fix, k) => {
      let text = (fix && fix.text) || (typeof fix === "string" ? fix : r[iText]);   // { tags } だけ なら もと の 文
      const tags = process.env.V2 ? "" : (fix && fix.tags) || CHARA[t].tags;
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
