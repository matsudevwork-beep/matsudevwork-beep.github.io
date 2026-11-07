/* =========================================================
   あいぼうと せんかき（試作版）メインプログラム
   ---------------------------------------------------------
   大きく4つの部分に分かれています。
     1. データの保存と読み込み（端末の中だけに保存）
     2. 声と吹き出し（キャラのしゃべり）
     3. ホーム画面（なでる・タップ・えさをドラッグであげる）
     4. なぞり画面（せんかき・ひらがな。●から★へ線を引く判定と応援）
   ========================================================= */

/* ---------------------------------------------------------
   1. データの保存と読み込み
   --------------------------------------------------------- */
const SAVE_KEY = "aibou-proto-v1";
const DAILY_REWARD_LIMIT = 15;  // 1日にもらえるごほうびの上限（やめどき）。2026-11-07 長男の試用で 5→15 に
const MAX_STAGE = 10;

// 次の段階に上がるのに必要なポイント（段階が上がるほど少し多く）
const needPoints = (stage) => 3 + stage;

function defaultState() {
  return {
    petType: null,     // えらんだあいぼう
    stage: 1,          // 成長段階 1〜10
    points: 0,         // 今の段階でたまったポイント
    water: 1,          // 最初に1つずつプレゼント（あげ方を覚えてもらうため）
    food: 1,
    level: 0,          // 次に出すせんかきの問題番号
    hiraLevel: 0,      // 次に出すひらがなの番号
    sound: true,
    graduated: [],     // 10段階まで育てたあいぼう（ずかん）
    pets: {},          // あいぼうごとの育ち具合（とちゅうで かえても もどってこられる）
    daily: { date: "", rewards: 0 },
    learnedDrag: false // 一度でもえさをあげたか（ヒント表示用）
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = Object.assign(defaultState(), JSON.parse(raw));
      if (!s.pets) s.pets = {};
      if (typeof s.hiraLevel !== "number") s.hiraLevel = 0;
      return s;
    }
  } catch (e) { /* 保存できない環境でも動くようにする */ }
  return defaultState();
}

function saveState() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
}

let state = loadState();

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// きょう、まだ ごほうびを もらえるか
function rewardsLeftToday() {
  if (state.daily.date !== todayKey()) return DAILY_REWARD_LIMIT;
  return Math.max(0, DAILY_REWARD_LIMIT - state.daily.rewards);
}

/* あいぼうを えらぶ／かえる
   いまのあいぼうの育ち具合を しまってから、えらんだ子の育ち具合を とりだします。
   （とちゅうで ほかの子を ためしても、もどれば つづきから） */
function choosePet(type) {
  if (state.petType) state.pets[state.petType] = { stage: state.stage, points: state.points };
  const saved = state.pets[type] || { stage: 1, points: 0 };
  state.petType = type;
  state.stage = saved.stage;
  state.points = saved.points;
  saveState();
  return !!state.pets[type];
}

/* ---------------------------------------------------------
   2. 声と吹き出し
   --------------------------------------------------------- */
const pick = (list) => list[Math.floor(Math.random() * list.length)];
let lastSpeakAt = 0;

/**
 * キャラにしゃべらせる
 * @param {HTMLElement} bubbleEl - 吹き出しの要素
 * @param {string} text - ことば
 * @param {boolean|number} force - true なら必ずしゃべる。数字なら「前回から何ミリ秒あいていればしゃべるか」
 */
function say(bubbleEl, text, force = false, holdMs = 2200) {
  const now = Date.now();
  // しゃべりすぎないよう、前回から一定時間（通常1.6秒）はがまんする
  const gap = force === true ? 0 : (typeof force === "number" ? force : 1600);
  if (now - lastSpeakAt < gap) return;
  lastSpeakAt = now;

  bubbleEl.textContent = text;
  bubbleEl.classList.add("show");
  clearTimeout(bubbleEl._timer);
  bubbleEl._timer = setTimeout(() => bubbleEl.classList.remove("show"), holdMs);

  speak(text);
}

// 読み上げ（試作用に端末の機能を使う。本番は録音した声に差し替え）
// 画面の ●・★ は「まる」「ほし」と よむ
function speak(text) {
  if (state.sound && "speechSynthesis" in window) {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/●/g, "まる").replace(/★/g, "ほし").replace(/[〜「」]/g, ""));
      u.lang = "ja-JP";
      u.pitch = 1.5;
      u.rate = 0.95;
      speechSynthesis.speak(u);
    } catch (e) {}
  }
}

/* ---------------------------------------------------------
   画面の切り替え
   --------------------------------------------------------- */
const $ = (id) => document.getElementById(id);

// あいぼうの種類に合わせて、背景などの世界観を切り替える
function applyTheme() {
  $("app").className = state.petType ? `theme-${state.petType}` : "theme-select";
}

function showScreen(name) {
  applyTheme();
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $(`screen-${name}`).classList.add("active");
}

/* ---------------------------------------------------------
   お知らせ（モーダル）
   --------------------------------------------------------- */
function showModal(artHTML, text, buttonText, onClose) {
  $("modal-art").innerHTML = artHTML;
  $("modal-text").innerHTML = text;
  $("modal-btn").textContent = buttonText;
  $("modal").classList.remove("hidden");
  $("modal-btn").onclick = () => {
    $("modal").classList.add("hidden");
    if (onClose) onClose();
  };
}

/* ---------------------------------------------------------
   あいぼう選択画面
   --------------------------------------------------------- */
function renderSelect() {
  const list = $("select-list");
  list.innerHTML = "";
  Object.entries(PET_TYPES).forEach(([type, t]) => {
    const done = state.graduated.filter((g) => g === type).length;
    const nowStage = type === state.petType ? state.stage : (state.pets[type] ? state.pets[type].stage : 0);
    const badge = [
      nowStage ? `いま ${nowStage}だん` : "",
      done ? `ずかん ${done}` : "",
    ].filter(Boolean).join("<br>");
    const btn = document.createElement("button");
    btn.className = "select-card";
    btn.dataset.type = type;
    btn.innerHTML = `
      <div class="pet-thumb">${makePetSVG(type, 3, true)}</div>
      <div>
        <div class="name">${t.name}</div>
        <div class="desc">${t.desc}（${t.kind}）</div>
      </div>
      ${badge ? `<span class="done-badge">${badge}</span>` : ""}`;
    btn.onclick = () => {
      const same = type === state.petType;
      const returning = choosePet(type);
      goHome();
      const hello = same || returning ? `おかえり！ ${t.name} だよ` : `よろしくね！ ぼく ${t.name}`;
      setTimeout(() => say($("bubble"), hello, true), 300);
    };
    list.appendChild(btn);
  });
  // いまのあいぼうがいるときは「もどる」を出す
  $("btn-select-back").classList.toggle("hidden", !state.petType);
  showScreen("select");
}

/* ---------------------------------------------------------
   3. ホーム画面
   --------------------------------------------------------- */
const petEl = $("pet");

function renderHome() {
  petEl.innerHTML = makePetSVG(state.petType, state.stage);
  $("stage-label").textContent = state.stage;
  const ratio = Math.min(1, state.points / needPoints(state.stage));
  $("gauge-fill").style.width = `${ratio * 100}%`;

  $("count-water").textContent = state.water;
  $("count-food").textContent = state.food;
  document.querySelector('[data-item="water"]').classList.toggle("empty", state.water <= 0);
  document.querySelector('[data-item="food"]').classList.toggle("empty", state.food <= 0);

  $("btn-sound").textContent = state.sound ? "🔊" : "🔈";

  // まだえさをあげたことがなく、手持ちがあればヒントを出す
  const hasItem = state.water > 0 || state.food > 0;
  $("drag-hint").classList.toggle("hidden", state.learnedDrag || !hasItem);
}

function goHome() {
  $("talk-panel").classList.add("hidden");
  renderHome();
  showScreen("home");
}

// 動きのクラスを一時的につける（つけ直すとアニメーションが最初から再生される）
function playAnim(el, cls, ms) {
  el.classList.remove("bounce", "pet-happy", "eating", "grow", "dance");
  void el.offsetWidth; // ブラウザに一度描き直させる小技
  el.classList.add(cls);
  clearTimeout(el._animTimer);
  el._animTimer = setTimeout(() => el.classList.remove(cls), ms);
}

// ハートやきらきらを出す
function spawnFx(symbol, x, y) {
  const fx = document.createElement("div");
  fx.className = "fx";
  fx.textContent = symbol;
  fx.style.left = `${x}px`;
  fx.style.top = `${y}px`;
  $("effects").appendChild(fx);
  setTimeout(() => fx.remove(), 1000);
}

/* --- タップと「なでなで」の判定 ---
   指を置いて動かした距離が長ければ「なでた」、
   ほとんど動かさずに離したら「タップ」とみなします。 */
let petTouch = null;
let lastPetFxAt = 0;

petEl.addEventListener("pointerdown", (e) => {
  if (petTouch) return; // 2本目の指（手のひら等）は無視
  petTouch = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, petted: false };
  try { petEl.setPointerCapture(e.pointerId); } catch (err) {}
});

petEl.addEventListener("pointermove", (e) => {
  if (!petTouch || e.pointerId !== petTouch.id) return;
  petTouch.moved += Math.hypot(e.clientX - petTouch.x, e.clientY - petTouch.y);
  petTouch.x = e.clientX;
  petTouch.y = e.clientY;

  if (petTouch.moved > 60) {
    const bathing = Date.now() < bathUntil;
    if (!petEl.classList.contains("pet-happy")) say($("bubble"), pick(bathing ? PLAY_VOICE.bath : VOICE.pet));
    playAnim(petEl, "pet-happy", 700);
    petTouch.petted = true;
    const now = Date.now();
    if (now - lastPetFxAt > (bathing ? 120 : 250)) {
      const area = $("pet-area").getBoundingClientRect();
      spawnFx(bathing ? "🫧" : "💗", e.clientX - area.left, e.clientY - area.top - 20);
      lastPetFxAt = now;
    }
  }
});

function endPetTouch(e) {
  if (!petTouch || e.pointerId !== petTouch.id) return;
  if (!petTouch.petted && petTouch.moved < 20) {
    playAnim(petEl, "bounce", 600);
    say($("bubble"), pick(VOICE.tap));
  }
  petTouch = null;
}
petEl.addEventListener("pointerup", endPetTouch);
petEl.addEventListener("pointercancel", () => { petTouch = null; });

/* --- えさ・みずをドラッグであげる --- */
let drag = null;

document.querySelectorAll(".tray-item").forEach((itemEl) => {
  itemEl.addEventListener("pointerdown", (e) => {
    if (drag) return;
    const kind = itemEl.dataset.item;
    if (state[kind] <= 0) {
      // きょうの ごほうびが おわっていたら「また あした」と伝える
      say($("bubble"), pick(rewardsLeftToday() > 0 ? VOICE.hungry : VOICE.full), true);
      return;
    }
    // 指についてくる分身を作る
    const ghost = document.createElement("div");
    ghost.className = "dragging";
    ghost.innerHTML = kind === "water" ? makeWaterSVG() : makeFoodSVG();
    document.body.appendChild(ghost);
    drag = { id: e.pointerId, kind, ghost };
    moveGhost(e);
    try { itemEl.setPointerCapture(e.pointerId); } catch (err) {}
  });

  itemEl.addEventListener("pointermove", (e) => {
    if (drag && e.pointerId === drag.id) moveGhost(e);
  });

  itemEl.addEventListener("pointerup", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const r = petEl.getBoundingClientRect();
    // あいぼうの絵の中央付近（からだのあたり）に落としたら成功
    const inside = e.clientX > r.left + r.width * 0.15 && e.clientX < r.right - r.width * 0.15 &&
                   e.clientY > r.top + r.height * 0.25 && e.clientY < r.bottom;
    const kind = drag.kind;
    drag.ghost.remove();
    drag = null;
    if (inside) feed(kind);
  });

  itemEl.addEventListener("pointercancel", () => {
    if (drag) { drag.ghost.remove(); drag = null; }
  });
});

function moveGhost(e) {
  drag.ghost.style.left = `${e.clientX}px`;
  drag.ghost.style.top = `${e.clientY}px`;
}

function feed(kind) {
  state[kind] -= 1;
  state.points += kind === "water" ? 1 : 2;
  state.learnedDrag = true;
  playAnim(petEl, "eating", 1300);
  say($("bubble"), pick(kind === "water" ? VOICE.eatWater : VOICE.eatFood), true);
  const area = $("pet-area").getBoundingClientRect();
  spawnFx(kind === "water" ? "💧" : "✨", area.width / 2, area.height / 2);

  // 成長チェック
  if (state.points >= needPoints(state.stage)) {
    state.points -= needPoints(state.stage);
    state.stage += 1;
    saveState();
    renderHome();
    setTimeout(() => levelUp(), 1300);
    return;
  }
  saveState();
  renderHome();
}

function levelUp() {
  const t = PET_TYPES[state.petType];
  if (state.stage >= MAX_STAGE) {
    // 10段階まで成長 → ずかんに登録して次のあいぼうへ
    state.stage = MAX_STAGE;
    renderHome();
    playAnim(petEl, "grow", 1300);
    say($("bubble"), "ありがとう！ こんなに おおきく なったよ！", true);
    setTimeout(() => {
      showModal(
        `<div class="big-pet">${makePetSVG(state.petType, MAX_STAGE)}</div>`,
        `${t.stages[MAX_STAGE - 1]}<br>ずかんが ぜんぶ そろったよ`,
        "つぎの あいぼうを えらぶ",
        () => {
          state.graduated.push(state.petType);
          delete state.pets[state.petType]; // つぎに えらんだら 1だんから
          state.petType = null;
          saveState();
          renderSelect();
        }
      );
    }, 1500);
    return;
  }
  playAnim(petEl, "grow", 1300);
  // 資料の進化図鑑のことばで、何が変わったかを伝える
  say($("bubble"), `${state.stage}だん！ ${t.stages[state.stage - 1]}`, true);
  const area = $("pet-area").getBoundingClientRect();
  ["🌟", "✨", "🌟"].forEach((s, i) =>
    setTimeout(() => spawnFx(s, area.width * (0.3 + 0.2 * i), area.height * 0.4), i * 150));
}

$("btn-sound").onclick = () => {
  state.sound = !state.sound;
  if (!state.sound && "speechSynthesis" in window) speechSynthesis.cancel();
  saveState();
  renderHome();
};


/* ---------------------------------------------------------
   あそぶ（えさが なくても、いつでも あいぼうと やりとり できる）
   ・成長ポイントは つかない（そだつのは せんかき だけ）
   ・こたえは どこにも 保存しない
   --------------------------------------------------------- */
let bathUntil = 0;
let danceTimer = null;

function areaCenter() {
  const a = $("pet-area").getBoundingClientRect();
  return { w: a.width, h: a.height };
}

const PLAY = {
  // ボールを なげると、あいぼうが キャッチ
  ball() {
    const ball = document.createElement("div");
    ball.className = "ball-fx";
    ball.textContent = "⚽";
    $("effects").appendChild(ball);
    setTimeout(() => {
      ball.remove();
      playAnim(petEl, "bounce", 600);
      say($("bubble"), pick(PLAY_VOICE.ball), true);
      const { w, h } = areaCenter();
      spawnFx("⭐", w * 0.5, h * 0.4);
    }, 650);
  },
  // おふろ：しばらく なでると あわあわ
  bath() {
    bathUntil = Date.now() + 9000;
    petEl.classList.add("bathing");
    say($("bubble"), "おふろ だ〜！ ごしごし なでてね", true);
    const { w, h } = areaCenter();
    for (let i = 0; i < 6; i++) setTimeout(() => spawnFx("🫧", w * (0.25 + Math.random() * 0.5), h * (0.4 + Math.random() * 0.4)), i * 120);
    clearTimeout(PLAY._bathTimer);
    PLAY._bathTimer = setTimeout(() => {
      petEl.classList.remove("bathing");
      say($("bubble"), pick(PLAY_VOICE.bathEnd), true);
      for (let i = 0; i < 3; i++) setTimeout(() => spawnFx("✨", w * (0.3 + 0.2 * i), h * 0.45), i * 150);
    }, 9000);
  },
  // ダンス：いっしょに おどる
  dance() {
    say($("bubble"), pick(PLAY_VOICE.dance), true);
    petEl.classList.remove("bounce", "pet-happy", "eating", "grow");
    petEl.classList.add("dance");
    const { w, h } = areaCenter();
    let n = 0;
    clearInterval(danceTimer);
    danceTimer = setInterval(() => {
      spawnFx(n % 2 ? "🎵" : "🎶", w * (n % 2 ? 0.2 : 0.8), h * 0.5);
      if (++n >= 8) { clearInterval(danceTimer); petEl.classList.remove("dance"); }
    }, 450);
  },
  // おはなし：あいぼうの しつもんに えらんで こたえる
  talk() {
    const q = pick(TALKS.filter((t) => t !== PLAY._lastTalk));
    PLAY._lastTalk = q;
    say($("bubble"), q.q, true, 60000);
    playAnim(petEl, "bounce", 600);
    const box = $("talk-choices");
    box.innerHTML = "";
    q.choices.forEach((c) => {
      const b = document.createElement("button");
      b.className = "talk-choice";
      b.innerHTML = `<span class="talk-icon">${c.icon}</span><span>${c.label}</span>`;
      b.onclick = () => {
        $("talk-panel").classList.add("hidden");
        say($("bubble"), c.reply, true, 3200);
        playAnim(petEl, "pet-happy", 1200);
        const { w, h } = areaCenter();
        ["💗", "💗"].forEach((s, i) => setTimeout(() => spawnFx(s, w * (0.4 + 0.2 * i), h * 0.4), i * 200));
      };
      box.appendChild(b);
    });
    $("talk-panel").classList.remove("hidden");
  },
};

document.querySelectorAll(".play-btn").forEach((b) => {
  b.onclick = () => PLAY[b.dataset.play]();
});
$("talk-close").onclick = () => {
  $("talk-panel").classList.add("hidden");
  say($("bubble"), "また おはなし しようね", true);
};
$("btn-change").onclick = () => renderSelect();
$("btn-select-back").onclick = () => goHome();

/* ---------------------------------------------------------
   しんか ずかん（10段階のすがた。まだのところはシルエット）
   --------------------------------------------------------- */
function renderZukan() {
  const type = state.petType;
  const t = PET_TYPES[type];
  const complete = state.graduated.includes(type);
  $("zukan-title").textContent = t.title;
  $("zukan-catch").textContent = t.catch;
  const grid = $("zukan-grid");
  grid.innerHTML = "";
  for (let s = 1; s <= MAX_STAGE; s++) {
    const open = complete || s <= state.stage;
    const cell = document.createElement("div");
    cell.className = "zukan-cell" + (open ? "" : " locked") + (s === state.stage && !complete ? " now" : "");
    cell.innerHTML = `
      <span class="zukan-no">${s}</span>
      ${makePetSVG(type, s)}
      <div class="zukan-cap">${open ? t.stages[s - 1] : "？？？"}</div>`;
    grid.appendChild(cell);
  }
  showScreen("zukan");
}
$("btn-zukan").onclick = () => renderZukan();
$("btn-zukan-back").onclick = () => goHome();

/* ---------------------------------------------------------
   4. なぞり画面（せんかき・ひらがな 共通）
   ・せんかき：1本の線を ●から★へ
   ・ひらがな：かきじゅん どおりに 1かくずつ ●から★へ
   --------------------------------------------------------- */
const SVG_NS = "http://www.w3.org/2000/svg";
const TOLERANCE = 30;   // 道の真ん中からどれだけ離れてもOKか（幼児向けに甘め）
const ROAD_WIDTH = 46;  // 見た目の道の太さ
// ★に さわったら ゴールにする はんい と、そのとき すすんでいてほしい わりあい
// （2026-11-07 調整：さいしょ＝ほぼ さいごまで／前回＝★の外44・8わり → いま＝★の上24・9わり）
const GOAL_RADIUS = 24;
const GOAL_PROGRESS = 0.9;
const traceSvg = $("trace-svg");
const traceBubble = $("trace-bubble");

let trace = null;         // 今の問題の状態
let traceMode = "line";   // "line"＝せんかき、"hira"＝ひらがな

function el(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  return node;
}

// 今の問題（どちらのモードでも「strokes＝かく の ならび」にそろえる）
function currentLesson() {
  if (traceMode === "hira") {
    const i = state.hiraLevel % HIRAGANA.length;
    const h = HIRAGANA[i];
    return { label: `ひらがな「${h.char}」`, strokes: h.strokes, char: h.char, words: h.words };
  }
  const i = state.level % LEVELS.length;
  return { label: `${i + 1}. ${LEVELS[i].name}`, strokes: [LEVELS[i].path] };
}

const roadAttrs = (d, color, width = ROAD_WIDTH) => ({
  d, fill: "none", stroke: color, "stroke-width": width, "stroke-linecap": "round", "stroke-linejoin": "round",
});

function startTrace(mode = traceMode) {
  traceMode = mode;
  const lesson = currentLesson();
  $("level-label").textContent = lesson.label;
  $("mini-pet").innerHTML = makePetSVG(state.petType, state.stage, true);
  traceSvg.innerHTML = "";

  // ひらがなは、うしろに 字の おてほん（うすい字）を おく
  if (lesson.char) {
    const sample = el("text", { x: 180, y: 250, "text-anchor": "middle", "dominant-baseline": "central",
      "font-size": 300, fill: "#EFE2CF", "font-weight": 800 });
    sample.textContent = lesson.char;
    traceSvg.append(sample);
  }
  // すべての かく の 道（うすい色）
  const roads = lesson.strokes.map((d) => el("path", roadAttrs(d, "#F3E2C9")));
  traceSvg.append(...roads);
  const doneLayer = el("g", {});   // おわった かく
  traceSvg.append(doneLayer);

  trace = { lesson, roads, doneLayer, layer: null, finished: false, pointerId: null };
  setupStroke(0);

  showScreen("trace");
  const first = lesson.char ? `「${lesson.char}」を かこう！ ●から ★へ なぞってね` : pick(VOICE.start);
  setTimeout(() => say(traceBubble, first, true), 300);
}

// k ばんめの かく を じゅんびする
function setupStroke(k) {
  const { lesson, roads } = trace;
  if (trace.layer) trace.layer.remove();
  const d = lesson.strokes[k];
  const road = roads[k];
  // これから かく 道は うすく、いまの 道は はっきり
  roads.forEach((r, i) => r.setAttribute("opacity", i === k ? 1 : (i > k ? 0.45 : 1)));

  const layer = el("g", {});
  const done = el("path", roadAttrs(d, "#FFD27A"));
  const guide = el("path", { d, fill: "none", stroke: "#D9BFA0", "stroke-width": 4, "stroke-dasharray": "2 12", "stroke-linecap": "round" });
  const ink = el("path", { d: "", fill: "none", stroke: "#FF8A5B", "stroke-width": 9, "stroke-linecap": "round", "stroke-linejoin": "round" });
  layer.append(done, guide, ink);

  // 線の上に3ずつ間をあけて点を並べ、判定に使う
  const len = road.getTotalLength();
  const samples = [];
  for (let s = 0; s <= len; s += 3) samples.push(road.getPointAtLength(s));
  samples.push(road.getPointAtLength(len));
  const startPt = samples[0];
  const endPt = samples[samples.length - 1];

  // スタートの● と ゴールの★
  const star = el("text", { x: endPt.x, y: endPt.y + 16, "text-anchor": "middle", "font-size": 46, fill: "#FFB938", stroke: "#C98A1E", "stroke-width": 1.5 });
  star.textContent = "★";
  const dot = el("circle", { cx: startPt.x, cy: startPt.y, r: 17, fill: "#FF8A5B", stroke: "#fff", "stroke-width": 4 });
  const ring = el("circle", { cx: startPt.x, cy: startPt.y, r: 17, fill: "none", stroke: "#FF8A5B", "stroke-width": 3 });
  ring.innerHTML = `<animate attributeName="r" values="17;34" dur="1.2s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="0.8;0" dur="1.2s" repeatCount="indefinite"/>`;
  layer.append(star, ring, dot);
  // 2かく いじょう ある字は、●に ばんごう を つける
  if (lesson.strokes.length > 1) {
    const num = el("text", { x: startPt.x, y: startPt.y + 7, "text-anchor": "middle", "font-size": 20, "font-weight": 800, fill: "#fff" });
    num.textContent = k + 1;
    layer.append(num);
  }
  traceSvg.append(layer);
  done.setAttribute("stroke-dasharray", `0 ${len + 10}`);

  Object.assign(trace, {
    strokeIndex: k, layer, samples, len, done, ink, ring,
    progress: 0,        // どこまで進んだか（samples の番号）
    pointerId: null,    // 今描いている指
    inkD: "",
    offCount: 0,
    cheered: false,
  });
}

// 画面上の指の位置を、SVGのマス目（360×480）の座標に変換する
function toSvgPoint(e) {
  const p = new DOMPoint(e.clientX, e.clientY);
  return p.matrixTransform(traceSvg.getScreenCTM().inverse());
}

// 今の進み具合の近くで、一番近い点を探す（ぐるぐるの線で別の場所に飛ばないように範囲をしぼる）
function nearest(p) {
  const { samples, progress } = trace;
  const from = Math.max(0, progress - 10);
  const to = Math.min(samples.length - 1, progress + 40);
  let best = -1, bestD = Infinity;
  for (let i = from; i <= to; i++) {
    const d = Math.hypot(samples[i].x - p.x, samples[i].y - p.y);
    if (d < bestD) { bestD = d; best = i; }
  }
  return { index: best, dist: bestD };
}

// いまの かく だけ けして、その かく の ●から
function eraseStroke() {
  trace.progress = 0;
  trace.inkD = "";
  trace.ink.setAttribute("d", "");
  trace.done.setAttribute("stroke-dasharray", `0 ${trace.len + 10}`);
  trace.ring.style.display = "";
  trace.cheered = false;
  trace.offCount = 0;
}

// 消しゴム：ぜんぶ けして、1かくめの ●から やりなおす
function eraseTrace() {
  if (!trace || trace.finished) return;
  trace.doneLayer.innerHTML = "";
  setupStroke(0);
}

traceSvg.addEventListener("pointerdown", (e) => {
  if (!trace || trace.finished || trace.pointerId !== null) return; // 2本目の指は無視
  // 手のひらなど、大きく触れたものは無視（対応端末のみ）
  if (e.width > 60 && e.height > 60) return;

  const p = toSvgPoint(e);
  const here = trace.samples[trace.progress];
  const start = trace.samples[0];
  const near = (q) => Math.hypot(q.x - p.x, q.y - p.y) <= TOLERANCE * 1.6;
  if (near(here)) {
    // つづきの場所から → そのまま つづける
  } else if (near(start)) {
    // とちゅうまで かいていても、●を さわったら 自動で けして はじめから
    eraseStroke();
  } else {
    say(traceBubble, trace.progress === 0 ? "●から はじめてね" : "つづきか ●から かけるよ");
    return;
  }
  trace.pointerId = e.pointerId;
  try { traceSvg.setPointerCapture(e.pointerId); } catch (err) {}
  trace.ring.style.display = "none";
  trace.inkD += `M${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
  trace.ink.setAttribute("d", trace.inkD);
});

traceSvg.addEventListener("pointermove", (e) => {
  if (!trace || e.pointerId !== trace.pointerId) return;
  // すばやく動かしたときに とびとびにならないよう、間の点も 全部つかう
  const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
  (events.length ? events : [e]).forEach((ev) => {
    if (trace.pointerId !== null && !trace.finished) traceMove(toSvgPoint(ev));
  });
});

function traceMove(p) {
  trace.inkD += `L${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
  trace.ink.setAttribute("d", trace.inkD);

  const { index, dist } = nearest(p);
  if (dist <= TOLERANCE) {
    // 道の上 → 進める
    if (index > trace.progress) trace.progress = index;
    const doneLen = (trace.progress / (trace.samples.length - 1)) * trace.len;
    trace.done.setAttribute("stroke-dasharray", `${doneLen} ${trace.len + 10}`);

    // 1本の線のときは、半分まで来たら1回ほめる
    if (!trace.cheered && trace.lesson.strokes.length === 1 && trace.progress > trace.samples.length * 0.5) {
      trace.cheered = true;
      say(traceBubble, pick(VOICE.good));
      playAnim($("mini-pet"), "bounce", 600);
    }
  }
  // ゴール：道の さいごまで 来たか、9わり以上 すすんで ★の上に さわっていたら OK
  const endPt = trace.samples[trace.samples.length - 1];
  const onStar = Math.hypot(endPt.x - p.x, endPt.y - p.y) <= GOAL_RADIUS;
  if (trace.progress >= trace.samples.length - 3 ||
      (onStar && trace.progress >= trace.samples.length * GOAL_PROGRESS)) {
    completeStroke();
    return;
  }
  if (dist > TOLERANCE && !onStar) {
    // 道からはずれた → すぐに応援
    trace.offCount += 1;
    // はずれたときの応援は、ほかの声より優先して出す（ただし1.5秒に1回まで）
    const now = Date.now();
    if (now - (trace.lastOffAt || 0) > 1500) {
      trace.lastOffAt = now;
      say(traceBubble, pick(VOICE.off), true);
    }
  }
}

// 1かく おわった
function completeStroke() {
  const k = trace.strokeIndex;
  const total = trace.lesson.strokes.length;
  if (k + 1 >= total) { finishTrace(); return; }
  // かけた かく を のこして、つぎの かく へ
  trace.doneLayer.append(el("path", roadAttrs(trace.lesson.strokes[k], "#FFD27A")), trace.ink);
  setupStroke(k + 1);
  say(traceBubble, `いいね！ つぎは ${k + 2}ばんめ`, true);
  playAnim($("mini-pet"), "bounce", 600);
}

function endTraceStroke(e) {
  if (!trace || e.pointerId !== trace.pointerId) return;
  trace.pointerId = null;
  if (!trace.finished && trace.progress > 0) {
    say(traceBubble, pick(VOICE.resume));
  }
}
traceSvg.addEventListener("pointerup", endTraceStroke);
traceSvg.addEventListener("pointercancel", endTraceStroke);

function finishTrace() {
  trace.finished = true;
  trace.pointerId = null;
  const lesson = trace.lesson;
  say(traceBubble, lesson.char ? `「${lesson.char}」が かけたね！` : pick(VOICE.clear), true);
  playAnim($("mini-pet"), "bounce", 600);

  if (traceMode === "hira") state.hiraLevel += 1; else state.level += 1;

  // 1日の上限までは、ごほうび（みず1つ＋ごはん1つ）がもらえる
  const today = todayKey();
  if (state.daily.date !== today) state.daily = { date: today, rewards: 0 };
  const canReward = state.daily.rewards < DAILY_REWARD_LIMIT;
  if (canReward) {
    state.daily.rewards += 1;
    state.water += 1;
    state.food += 1;
  }
  saveState();

  setTimeout(() => {
    if (lesson.char) { showWords(lesson, canReward); return; }
    if (canReward) {
      showModal(makeWaterSVG() + makeFoodSVG(), "みず と ごはん を<br>もらったよ！", "あいぼうに あげる", () => goHome());
    } else {
      showModal(
        `<div class="big-pet">${makePetSVG(state.petType, state.stage)}</div>`,
        "きょうの ごはんは おしまい！<br>ボール や おはなしで<br>あそべるよ",
        "ホームに もどる",
        () => goHome()
      );
    }
  }, 1200);
}

// ひらがな が かけたら、その字で はじまる ことば を ならべる（さわると よみあげ）
function showWords(lesson, canReward) {
  const cards = lesson.words.map((w, i) =>
    `<button class="word-card" data-i="${i}"><span class="word-icon">${w.icon}</span><span class="word-text"><b>${w.word[0]}</b>${w.word.slice(1)}</span></button>`
  ).join("");
  showModal(
    `<div class="word-cards">${cards}</div>`,
    `「${lesson.char}」の ことば を さわってみよう` + (canReward ? "<br><small>みず と ごはん も もらったよ！</small>" : ""),
    canReward ? "あいぼうに あげる" : "ホームに もどる",
    () => goHome()
  );
  document.querySelectorAll(".word-card").forEach((b) => {
    b.onclick = () => {
      speak(lesson.words[b.dataset.i].word);
      b.classList.remove("tapped"); void b.offsetWidth; b.classList.add("tapped");
    };
  });
}

$("btn-back").onclick = () => goHome();
$("btn-erase").onclick = () => {
  eraseTrace();
  say(traceBubble, "けしたよ！ ●から かいてね", true);
};

/* ---------------------------------------------------------
   べんきょう を えらぶ 画面
   --------------------------------------------------------- */
function renderStudyMenu() {
  $("study-line-count").textContent = `${(state.level % LEVELS.length) + 1} / ${LEVELS.length}もんめ`;
  $("study-hira-count").textContent = `つぎは「${HIRAGANA[state.hiraLevel % HIRAGANA.length].char}」`;
  showScreen("study");
}
$("btn-study").onclick = () => renderStudyMenu();
$("btn-study-back").onclick = () => goHome();
$("study-line").onclick = () => startTrace("line");
$("study-hira").onclick = () => startTrace("hira");

/* ---------------------------------------------------------
   保護者メニュー：歯車を2秒長押しでデータをリセット
   （子どもが間違えて押しても消えないように長押しにしています）
   --------------------------------------------------------- */
let resetTimer = null;
$("btn-reset").addEventListener("pointerdown", () => {
  resetTimer = setTimeout(() => {
    openParentMenu();
  }, 2000);
});

function openParentMenu() {
  const left = rewardsLeftToday();
  $("parent-info").textContent = `きょうの ごほうび：あと ${left}回（1日 ${DAILY_REWARD_LIMIT}回まで）`;
  $("parent-menu").classList.remove("hidden");
}
$("parent-close").onclick = () => $("parent-menu").classList.add("hidden");
$("parent-reward").onclick = () => {
  // 試してもらうとき用：きょうの回数を 0 にもどす
  state.daily = { date: todayKey(), rewards: 0 };
  saveState();
  $("parent-menu").classList.add("hidden");
};
$("parent-wipe").onclick = () => {
  if (confirm("【保護者の方へ】 データをすべて消して、さいしょからに しますか？")) {
    state = defaultState();
    saveState();
    $("parent-menu").classList.add("hidden");
    renderSelect();
  }
};
["pointerup", "pointerleave", "pointercancel"].forEach((ev) =>
  $("btn-reset").addEventListener(ev, () => clearTimeout(resetTimer)));

/* ---------------------------------------------------------
   はじめに
   --------------------------------------------------------- */
$("icon-water").innerHTML = makeWaterSVG();
$("icon-food").innerHTML = makeFoodSVG();

// 長押しメニューやダブルタップ拡大を防ぐ
document.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("dblclick", (e) => e.preventDefault());

if (state.petType) goHome(); else renderSelect();

// オフラインでも動くようにする（サービスワーカー）
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
