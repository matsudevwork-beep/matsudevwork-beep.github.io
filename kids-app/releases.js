/* =========================================================
   まいつき の しんさく（2026-11-08 代表：「毎月 新作◯個 配信」を 強み に）
   ・あたらしい あそび・お題 を 足したら、ここ に 1行 足す（いちばん うえ が さいしん）
   ・さいしん の 月 の もの に「NEW」が つき、べんきょう 画面 に おしらせ が 出る
   ・items：STUDY の しゅるい（app.js）。count：その 月 に ふえた お題 の かず（ずかん・え など も ふくむ）
   ========================================================= */
const RELEASES = [
  {
    month: "2026-11", label: "11がつ",
    items: ["draw", "calc", "code", "abc", "eng"],
    count: 5,
    note: "おえかき・たしざん ひきざん・プログラミング・アルファベット・えいご の ことば",
  },
];

const latestRelease = () => RELEASES[0];
const isNew = (type) => !!latestRelease() && latestRelease().items.includes(type);
function releaseBanner() {
  const r = latestRelease();
  if (!r) return "";
  return `<div class="release-banner"><span class="release-gift">🎁</span>
    <span><b>${r.label} の しんさく ${r.count}こ！</b><br><small>まいつき あたらしい あそび が ふえるよ</small></span></div>`;
}
