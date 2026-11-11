/* =========================================================
   年れい ごと の「きょうの おけいこ」（2026-11-12 代表：月齢 で 中身 を きめたい・親 が えらべる と なお よい）
   ---------------------------------------------------------
   ・ここ を なおす と、おすすめ の 中身 が かわる（代表 が 直接 なおして OK）
   ・steps：[しゅるい, もんだい の かず] を やる じゅん に ならべる
     しゅるい の なまえ：line せんかき／hira ひらがな／read いっしょに よもう／story ものがたり／kata カタカナ／
       num すうじ を かく／abc アルファベット／free おてほん なしで かく／draw おえかき／shape かたち うつし／
       count かず を かぞえる／balance てんびん／calc たしざん・ひきざん／clock とけい／maze めいろ／dots てんつなぎ／
       road みち つなぎ／code プログラミング／eng えいご の ことば
   ・fun：true なら さいご に「おたのしみ」（あまり やって いない あそび）を 1こ たす
   ・保護者メニュー で 年れい を えらぶ と この おすすめ に なる。さらに 中身 を 1つずつ かえられる（その 子 だけ の 設定）
   ・どの 年れい でも「にがて」が ある とき は、字 の れんしゅう の あと に 1〜2こ 入る
   ・字 を ぜんぶ おえた 子 は 自動 で つぎ へ（ひらがな → カタカナ、よもう → ものがたり、せんかき は かず を はんぶん）
   ========================================================= */
const COURSE_BANDS = [
  { id: "2a", label: "2歳0か月〜2歳6か月", steps: [["draw", 1], ["shape", 2], ["count", 3]], fun: false },
  { id: "2b", label: "2歳7か月〜3歳0か月", steps: [["line", 5], ["draw", 1], ["count", 3], ["shape", 2]], fun: false },
  { id: "3a", label: "3歳1か月〜3歳6か月", steps: [["line", 10], ["maze", 2], ["count", 5], ["dots", 2]], fun: true },
  { id: "3b", label: "3歳7か月〜4歳0か月", steps: [["line", 10], ["hira", 3], ["read", 3], ["maze", 2]], fun: true },
  { id: "4a", label: "4歳1か月〜4歳6か月", steps: [["line", 20], ["hira", 5], ["read", 5]], fun: true },
  { id: "4b", label: "4歳7か月〜5歳0か月", steps: [["line", 10], ["hira", 5], ["read", 5], ["calc", 3]], fun: true },
  { id: "5", label: "5歳", steps: [["hira", 5], ["kata", 5], ["story", 1], ["calc", 5], ["code", 2]], fun: true },
  { id: "6", label: "6歳", steps: [["kata", 5], ["num", 5], ["calc", 5], ["code", 3], ["clock", 3]], fun: true },
];
// 年れい を えらんで いない とき（いままで の おけいこ と おなじ）
const DEFAULT_BAND = "4a";
const courseBand = (id) => COURSE_BANDS.find((b) => b.id === id) || COURSE_BANDS.find((b) => b.id === DEFAULT_BAND);
