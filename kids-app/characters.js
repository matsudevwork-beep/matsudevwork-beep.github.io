/* =========================================================
   キャラクターの絵を作るファイル
   ---------------------------------------------------------
   ・添付資料「ゆるキャラ進化図鑑」の3体（こぐま／ショベルカー／
     にんじん）と、それぞれ10段階の進化の絵を使っています。
   ・今は1枚絵（方式A）なので、動きは体全体のぽよん・ぷにっ・ゆらゆら。
     本番はパーツ分けした絵（方式B）で、まばたき・口・手も動かす予定です。
   ========================================================= */

const PET_TYPES = {
  animal: {
    name: "ころん", kind: "こぐま", desc: "どうぶつ の なかま", counter: "ひき",
    title: "どうぶつ しんか ずかん", catch: "まるくて ぽにょっと そだっていく！",
    line: "#8A6A4F",
    stages: [
      "ちいさな まるい ようたい",
      "おおきな おみみと てあしが はえた",
      "ほっぺに うっすら もよう",
      "おなかに もようが ついた",
      "おみみの うちがわに いろが ついて しっぽが はえた",
      "あたまに はっぱの かざり",
      "ほっぺが はっきりして ちいさな リュック",
      "おみみに おうかんの かざり",
      "ふわふわ しっぽと むねもとの リボン",
      "かんせい！ こぐまの おうさま！",
    ],
  },
  car: {
    name: "ぶっぶ", kind: "ショベルカー", desc: "はたらく くるま の なかま", counter: "だい",
    title: "はたらくくるま しんか ずかん", catch: "まるくて ぽにょっと がんばるよ！",
    line: "#8C6420",
    stages: [
      "まるい ボディ！",
      "タイヤが 2つ！",
      "ショベルが ついたよ！",
      "まどが ついたよ！",
      "タイヤが 4つに！",
      "アームが のびたよ！",
      "キャタピラに なったよ！",
      "ショベルが おおきく！",
      "ちからもちに なったよ！",
      "おうさまに なったよ！",
    ],
  },
  veggie: {
    name: "キャロ", kind: "にんじん", desc: "やさい の なかま", counter: "ほん",
    title: "やさい しんか ずかん", catch: "まるくて ぽにょっと おいしく そだつ！",
    line: "#9A5A2A",
    stages: [
      "たねの めばえ",
      "ちいさな オレンジの まるみに め",
      "はっぱが 2まい",
      "からだが すこし ながく なる",
      "はっぱが ふえて てあしが できる",
      "からだに うすい しましま",
      "はっぱが ひろがって エプロン！",
      "おおきく まるく なって しろい みずたま",
      "はっぱの かんむりと こべら！",
      "りょうりずきな にんじん おうじ・おうじょ！",
    ],
  },
};

/* ---------- キャラクター画像 ----------
   資料「ゆるキャラ進化図鑑」の絵を、背景透過の画像として使っています。
   [横幅, 高さ] は元画像の大きさ（px）。資料の中での大きさの差＝成長の差なので、
   この比率を使って「段階が上がると大きくなる」を表現します。 */
const PET_IMAGES = {
  animal: [[102,122],[160,167],[162,171],[167,175],[188,178],[184,200],[179,191],[180,201],[219,200],[249,252]],
  car:    [[115,98],[144,118],[198,128],[214,139],[201,146],[219,176],[225,170],[239,186],[289,215],[331,225]],
  veggie: [[60,79],[80,108],[93,130],[89,183],[107,203],[111,207],[117,217],[137,229],[166,232],[204,262]],
};

/**
 * あいぼうの絵（HTML）を作る
 * @param {string} type  - "animal" / "car" / "veggie"
 * @param {number} stage - 成長段階 1〜10
 * @param {boolean} fullSize - true なら枠いっぱいに表示（アイコン用）。
 *                             false なら段階に合わせた大きさで、足もとをそろえて表示
 */
function makePetSVG(type, stage, fullSize = false) {
  const [w, h] = PET_IMAGES[type][stage - 1];
  const src = `img/${type}-${String(stage).padStart(2, "0")}.png`;
  const alt = `${PET_TYPES[type].name} レベル${stage}`;
  if (fullSize) {
    return `<div class="pet-art"><img class="body-group" src="${src}" alt="${alt}" draggable="false" style="width:100%;height:100%;object-fit:contain;object-position:50% 100%"></div>`;
  }
  // そのキャラの一番大きい姿（10段階）を枠いっぱいとして、相対的な大きさを決める
  const all = PET_IMAGES[type];
  const maxSide = Math.max(...all.map(([a, b]) => Math.max(a, b)));
  const r = Math.max(w, h) / maxSide;      // 本来の大きさ（0〜1）
  const shown = 0.45 + 0.55 * r;           // 小さすぎると触りにくいので、最小でも45%に
  const k = shown / Math.max(w, h);
  return `<div class="pet-art"><img class="body-group" src="${src}" alt="${alt}" draggable="false"
            style="width:${(w * k * 100).toFixed(1)}%;height:${(h * k * 100).toFixed(1)}%"></div>`;
}

// みず（しずく）のアイコン
function makeWaterSVG() {
  return `
  <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <path d="M32 6 C24 20 14 30 14 40 a18 18 0 0 0 36 0 C50 30 40 20 32 6 z"
          fill="#9AD6F2" stroke="#4F8DB0" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="25" cy="40" rx="4" ry="7" fill="#fff" opacity=".7"/>
  </svg>`;
}

// ごはん（まるいおだんご）のアイコン
function makeFoodSVG() {
  return `
  <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="36" r="20" fill="#FFC98B" stroke="#B9774A" stroke-width="3"/>
    <path d="M32 16 q2 -8 10 -8 q-2 8 -10 8" fill="#86C35C" stroke="#4E8A3A" stroke-width="2"/>
    <ellipse cx="25" cy="31" rx="5" ry="3.5" fill="#fff" opacity=".6"/>
  </svg>`;
}

/* ---------------------------------------------------------
   ボタンや あそびの マーク（キャラの絵に あわせた やわらかい手がき風）
   ・ふちは こげ茶、中は うすい色、白い つや
   ・本番は イラストレーターさんの絵に さしかえ予定
   --------------------------------------------------------- */
const LINE = "#8A6A4F";
const UI_ICONS = {
  ball: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="34" r="22" fill="#FFF8EC" stroke="${LINE}" stroke-width="3"/>
    <path d="M32 25 l8 6 -3 9 h-10 l-3 -9 z" fill="#F2B98C" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M32 25 v-12 M40 31 l11 -4 M37 40 l7 10 M27 40 l-7 10 M24 31 l-11 -4" stroke="${LINE}" stroke-width="2.5" stroke-linecap="round"/>
    <ellipse cx="22" cy="24" rx="5" ry="3" fill="#fff" opacity=".8" transform="rotate(-30 22 24)"/>
  </svg>`,
  bubble: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <circle cx="26" cy="38" r="16" fill="#D9F0FB" stroke="#6FA3C2" stroke-width="3"/>
    <circle cx="45" cy="22" r="10" fill="#E6F5FC" stroke="#6FA3C2" stroke-width="3"/>
    <circle cx="48" cy="45" r="6" fill="#E6F5FC" stroke="#6FA3C2" stroke-width="2.5"/>
    <path d="M17 33 a10 10 0 0 1 8 -8" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M40 19 a5 5 0 0 1 4 -3" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  </svg>`,
  note: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 46 V16 l24 -6 v30" fill="none" stroke="${LINE}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M24 16 l24 -6 v7 l-24 6 z" fill="#FFB38A" stroke="${LINE}" stroke-width="3" stroke-linejoin="round"/>
    <ellipse cx="18" cy="47" rx="8" ry="6.5" fill="#FFB38A" stroke="${LINE}" stroke-width="3"/>
    <ellipse cx="42" cy="41" rx="8" ry="6.5" fill="#FFB38A" stroke="${LINE}" stroke-width="3"/>
    <ellipse cx="15" cy="45" rx="2.5" ry="1.6" fill="#fff" opacity=".8"/>
  </svg>`,
  talk: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 14 h40 a6 6 0 0 1 6 6 v20 a6 6 0 0 1 -6 6 h-22 l-10 9 v-9 h-8 a6 6 0 0 1 -6 -6 v-20 a6 6 0 0 1 6 -6 z"
          fill="#FFE7CC" stroke="${LINE}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="22" cy="30" r="3.2" fill="${LINE}"/><circle cx="32" cy="30" r="3.2" fill="${LINE}"/><circle cx="42" cy="30" r="3.2" fill="${LINE}"/>
    <ellipse cx="16" cy="19" rx="3.5" ry="2" fill="#fff" opacity=".8"/>
  </svg>`,
  eraser: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <g transform="rotate(-30 32 32)">
      <rect x="10" y="22" width="44" height="22" rx="6" fill="#F8C3CC" stroke="${LINE}" stroke-width="3"/>
      <path d="M30 22 h16 a8 8 0 0 1 8 8 v6 a8 8 0 0 1 -8 8 h-16 z" fill="#A9D6F0" stroke="${LINE}" stroke-width="3" stroke-linejoin="round"/>
      <rect x="15" y="26" width="10" height="3" rx="1.5" fill="#fff" opacity=".8"/>
    </g>
    <path d="M10 54 q6 -3 12 0 q6 3 12 0" fill="none" stroke="#D9BFA0" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,
};

// 上のボタン（あいぼうを かえる・ずかん・おと）と よむ画面の スピーカー
Object.assign(UI_ICONS, {
  change: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 28 a18 18 0 0 1 32 -9" fill="none" stroke="${LINE}" stroke-width="4" stroke-linecap="round"/>
    <path d="M40 13 l8 6 -9 4 z" fill="#FFB38A" stroke="${LINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M50 36 a18 18 0 0 1 -32 9" fill="none" stroke="${LINE}" stroke-width="4" stroke-linecap="round"/>
    <path d="M24 51 l-8 -6 9 -4 z" fill="#9AD6F2" stroke="${LINE}" stroke-width="3" stroke-linejoin="round"/>
  </svg>`,
  gear: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <path d="M54.4 27.0 L54.4 37.0 L48.0 37.7 L45.3 42.6 L51.4 44.3 L44.3 51.4 L39.3 47.3 L33.9 48.9 L37.0 54.4 L27.0 54.4 L26.3 48.0 L21.4 45.3 L19.7 51.4 L12.6 44.3 L16.7 39.3 L15.1 33.9 L9.6 37.0 L9.6 27.0 L16.0 26.3 L18.7 21.4 L12.6 19.7 L19.7 12.6 L24.7 16.7 L30.1 15.1 L27.0 9.6 L37.0 9.6 L37.7 16.0 L42.6 18.7 L44.3 12.6 L51.4 19.7 L47.3 24.7 L48.9 30.1 Z" fill="#E9DCC8" stroke="${LINE}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="32" cy="32" r="7" fill="#FFF8EC" stroke="${LINE}" stroke-width="3"/>
  </svg>`,
  calendar: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="14" width="44" height="40" rx="7" fill="#FFF8EC" stroke="${LINE}" stroke-width="3"/>
    <path d="M10 26 h44" stroke="${LINE}" stroke-width="3"/>
    <path d="M12 21 a7 7 0 0 1 7 -7 h26 a7 7 0 0 1 7 7 v5 h-40 z" fill="#F2B98C"/>
    <path d="M22 10 v8 M42 10 v8" stroke="${LINE}" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="32" cy="40" r="8" fill="none" stroke="#E8604C" stroke-width="2.6"/>
    <path d="M32 40 m-2 0 a2 2 0 1 1 4 0 a4 4 0 1 1 -8 0" fill="none" stroke="#E8604C" stroke-width="2"/>
  </svg>`,
  book: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <path d="M32 18 C24 12 14 12 8 14 v34 c6 -2 16 -2 24 4 z" fill="#FFE7CC" stroke="${LINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M32 18 C40 12 50 12 56 14 v34 c-6 -2 -16 -2 -24 4 z" fill="#FFD9C2" stroke="${LINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M14 24 c4 -1 9 -1 12 1 M14 32 c4 -1 9 -1 12 1 M38 25 c3 -2 8 -2 12 -1" stroke="#C9A98A" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    <path d="M44 31 l1.8 3.6 4 .6 -2.9 2.8 .7 4 -3.6 -1.9 -3.6 1.9 .7 -4 -2.9 -2.8 4 -.6 z" fill="#FFC94D" stroke="${LINE}" stroke-width="1.6" stroke-linejoin="round"/>
  </svg>`,
  soundOn: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 26 h10 l14 -12 v36 l-14 -12 h-10 z" fill="#FFE7CC" stroke="${LINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M42 24 q5 8 0 16 M48 18 q10 14 0 28" fill="none" stroke="${LINE}" stroke-width="3.5" stroke-linecap="round"/>
  </svg>`,
  soundOff: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 26 h10 l14 -12 v36 l-14 -12 h-10 z" fill="#EFE6DA" stroke="${LINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M42 25 l12 14 M54 25 l-12 14" stroke="#C98E7A" stroke-width="3.5" stroke-linecap="round"/>
  </svg>`,
});
