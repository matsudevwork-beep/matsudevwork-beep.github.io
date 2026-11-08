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
    readLevel: 0,      // 次に出す「いっしょに よもう」の番号
    storyIndex: 0,     // 次に読む ものがたり
    kataLevel: 0,      // 次に出すカタカナ
    numLevel: 0,       // 次に出す すうじ
    abcLevel: 0,       // 次に出す アルファベット
    gameLevel: {},     // ためしの あそび（めいろ など）ごとの すすみ
    sets: {},          // しゅるい ごとの「おやつ まで あと なんこ」の かず
    played: {},        // しゅるい ごとに やった かず（にがて・すき を みる）
    course: null,      // きょうの おけいこ
    sound: true,
    graduated: [],     // 10段階まで育てたあいぼう（ずかん）
    pets: {},          // あいぼうごとの育ち具合（とちゅうで かえても もどってこられる）
    daily: { date: "", rewards: 0, playMs: 0, log: {}, restAt: 0 },
    child: { name: "", suffix: "ちゃん" },   // よびかけ用の おなまえ（この端末の中だけ。外には送らない）
    days: {},          // がんばり カレンダー：{ "2026-11-7": { n: やった かず, c: おけいこ ぜんぶ できたか } }
    playLimit: 20,     // あそぶ 時間の めやす（分）。0＝なし
    stats: {},         // 日ごと・しゅるい ごとの うまさ（はやさ・まっすぐさ・まちがい）。30日ぶん だけ のこす
    last: {},          // おなじ もんだい の まえ の けっか（「まえより はやく かけたね」用）
    firsts: {},        // はじめて できた ひ（あたらしく かけた もじ など）
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
      if (typeof s.readLevel !== "number") s.readLevel = 0;
      if (typeof s.storyIndex !== "number") s.storyIndex = 0;
      if (typeof s.kataLevel !== "number") s.kataLevel = 0;
      if (typeof s.numLevel !== "number") s.numLevel = 0;
      if (typeof s.abcLevel !== "number") s.abcLevel = 0;
      ["gameLevel", "sets", "played", "days", "stats", "last", "firsts"].forEach((k) => { if (!s[k]) s[k] = {}; });
      if (!s.child) s.child = { name: "", suffix: "ちゃん" };
      if (typeof s.playLimit !== "number") s.playLimit = 20;
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

// きょう の きろく（日づけ が かわったら あたらしく する）
function ensureDaily() {
  const today = todayKey();
  if (state.daily.date !== today) state.daily = { date: today, rewards: 0, playMs: 0, log: {}, restAt: 0 };
  if (!state.daily.log) state.daily.log = {};
  if (typeof state.daily.playMs !== "number") state.daily.playMs = 0;
  return state.daily;
}

/* おなまえ（2026-11-07 代表：なまえを よんで あげたい）
   ・ほごしゃメニューで いれる ニックネーム。この端末の中だけに 保存し、外には 送らない */
function callName() {
  const c = state.child || {};
  return c.name ? c.name + (c.suffix || "") : "";
}
// ときどき なまえ を よんで あげる（p＝よぶ かくりつ）
function withName(text, p = 0.5) {
  const n = callName();
  return n && Math.random() < p ? `${n}、${text}` : text;
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
// ・2026-11-08：まえ の 声 が おわるまで つぎ を まつ（とちゅう で きれない）。まって いい のは 3つ まで
// ・now：さわった とき の 声（かぞえる・ことば を きく など）は、まって いる 声 を けして すぐ よむ
// 画面の ●・★ は「まる」「ほし」と よむ
const speech = { cur: null, queue: [], safety: null, quiet: [] };
function speechFinish(item) {
  if (speech.cur !== item) return;
  clearTimeout(speech.safety);
  speech.cur = null;
  const n = speech.queue.shift();
  if (n) speechStart(n);
  else { const q = speech.quiet; speech.quiet = []; q.forEach((f) => f()); }
}
function speechStart(item) {
  speech.cur = item;
  try {
    const u = new SpeechSynthesisUtterance(item.text);
    u.lang = item.lang;
    if (item.voice) u.voice = item.voice;
    u.pitch = item.pitch;
    u.rate = item.rate;
    u.onend = u.onerror = () => speechFinish(item);
    // onend が こない 端末 の ための ほけん（字 の かず から おおよそ の ながさ）
    speech.safety = setTimeout(() => speechFinish(item), 2000 + item.text.length * 320 / item.rate);
    speechSynthesis.speak(u);
  } catch (e) { speechFinish(item); }
}
function speechEnqueue(item, now) {
  if (!state.sound || !("speechSynthesis" in window)) return;
  if (now) {
    speech.queue = [];
    if (speech.cur) { speech.cur = null; clearTimeout(speech.safety); try { speechSynthesis.cancel(); } catch (e) {} }
    speechStart(item);
    return;
  }
  if (!speech.cur) { try { speechSynthesis.cancel(); } catch (e) {} speechStart(item); return; }
  speech.queue.push(item);
  if (speech.queue.length > 3) speech.queue.shift();
}
// しゃべって いる 声 も まって いる 声 も ぜんぶ とめる（あそび を でる とき など）
function speechStop() {
  speech.queue = [];
  speech.cur = null;
  clearTimeout(speech.safety);
  try { if ("speechSynthesis" in window) speechSynthesis.cancel(); } catch (e) {}
  const q = speech.quiet; speech.quiet = []; q.forEach((f) => f());
}
// 声 が ぜんぶ おわったら fn（音 なし の とき は すぐ）
function whenQuiet(fn) {
  if (!speech.cur && !speech.queue.length) fn();
  else speech.quiet.push(fn);
}
function speak(text, now = false) {
  speechEnqueue({ text: String(text).replace(/●/g, "まる").replace(/★/g, "ほし").replace(/[〜「」]/g, ""), lang: "ja-JP", pitch: 1.5, rate: 0.95 }, now);
}

// 英語 で よむ（アルファベット・えいご）。英語 の 声 が ない ばあい も、ことば は 画面 に 出る
function speakEn(text, now = false, rate = 0.8) {
  const vs = "speechSynthesis" in window ? speechSynthesis.getVoices() : [];
  const voice = vs.find((x) => /^en[-_]US/i.test(x.lang)) || vs.find((x) => /^en/i.test(x.lang));
  speechEnqueue({ text, lang: "en-US", voice, pitch: 1.2, rate }, now);
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
function showModal(artHTML, text, buttonText, onClose, button2Text, onClose2) {
  $("modal-art").innerHTML = artHTML;
  $("modal-text").innerHTML = text;
  $("modal-btn").textContent = buttonText;
  $("modal").classList.remove("hidden");
  $("modal-btn").onclick = () => {
    $("modal").classList.add("hidden");
    if (onClose) onClose();
  };
  // 2つめの ボタン（「ホームに もどる」など）
  $("modal-btn2").classList.toggle("hidden", !button2Text);
  $("modal-btn2").textContent = button2Text || "";
  $("modal-btn2").onclick = () => {
    $("modal").classList.add("hidden");
    if (onClose2) onClose2();
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
      nowStage ? `いま レベル${nowStage}` : "",
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
      const who = callName();
      const hello = same || returning ? `${who ? who + "、" : ""}おかえり！ ${t.name} だよ`
        : `よろしくね${who ? " " + who : ""}！ ぼく ${t.name}`;
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

  $("btn-sound").innerHTML = UI_ICONS[state.sound ? "soundOn" : "soundOff"];

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
  // 絵のマーク（UI_ICONS）が あれば それを、なければ 文字（絵文字）を出す
  if (UI_ICONS[symbol]) { fx.innerHTML = UI_ICONS[symbol]; fx.classList.add("fx-icon"); }
  else fx.textContent = symbol;
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
      spawnFx(bathing ? "bubble" : "💗", e.clientX - area.left, e.clientY - area.top - 20);
      lastPetFxAt = now;
    }
  }
});

function endPetTouch(e) {
  if (!petTouch || e.pointerId !== petTouch.id) return;
  if (!petTouch.petted && petTouch.moved < 20) {
    playAnim(petEl, "bounce", 600);
    const n = callName();
    say($("bubble"), n && Math.random() < 0.35 ? pick([`${n}！ あそぼ`, `${n}、だいすき！`, `なあに？ ${n}`]) : pick(VOICE.tap));
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
          delete state.pets[state.petType]; // つぎに えらんだら レベル1から
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
  say($("bubble"), `レベル${state.stage}！ ${t.stages[state.stage - 1]}`, true);
  const area = $("pet-area").getBoundingClientRect();
  ["🌟", "✨", "🌟"].forEach((s, i) =>
    setTimeout(() => spawnFx(s, area.width * (0.3 + 0.2 * i), area.height * 0.4), i * 150));
}

$("btn-sound").onclick = () => {
  state.sound = !state.sound;
  if (!state.sound) speechStop();
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
    ball.innerHTML = UI_ICONS.ball;
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
    for (let i = 0; i < 6; i++) setTimeout(() => spawnFx("bubble", w * (0.25 + Math.random() * 0.5), h * (0.4 + Math.random() * 0.4)), i * 120);
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
      spawnFx("note", w * (n % 2 ? 0.2 : 0.8), h * 0.5);
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
const HIRA_ROAD_WIDTH = 36; // ひらがなは かく どうしが ちかいので すこし ほそく
// ゴールは「道の さいごまで なぞったら」（2026-11-07 代表：★の手前で おわるのが 気になるので さいしょの設定に もどす）
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
let reviewTarget = null;   // にがて れんしゅう で かく 字（{ mode, char }）。ふだん は null
const TRACE_DATA = () => ({ hira: HIRAGANA, kata: KATAKANA, num: NUMBERS, abc: ALPHABET });
const MODE_NAME = { hira: "ひらがな", kata: "カタカナ", num: "すうじ", abc: "アルファベット" };
function currentLesson() {
  if (reviewTarget && reviewTarget.mode === traceMode) {
    const h = TRACE_DATA()[traceMode].find((x) => x.char === reviewTarget.char);
    if (h) return { label: `にがて れんしゅう「${h.char}」`, strokes: h.strokes, char: h.char, words: h.words, review: true };
  }
  if (traceMode === "hira") {
    const i = state.hiraLevel % HIRAGANA.length;
    const h = HIRAGANA[i];
    return { label: `ひらがな「${h.char}」`, strokes: h.strokes, char: h.char, words: h.words };
  }
  if (traceMode === "kata") {
    const i = state.kataLevel % KATAKANA.length;
    const h = KATAKANA[i];
    return { label: `カタカナ「${h.char}」`, strokes: h.strokes, char: h.char, words: h.words };
  }
  if (traceMode === "num") {
    const h = NUMBERS[state.numLevel % NUMBERS.length];
    return { label: `すうじ「${h.char}」`, strokes: h.strokes, char: h.char, words: h.words };
  }
  if (traceMode === "abc") {
    const h = ALPHABET[state.abcLevel % ALPHABET.length];
    return { label: `アルファベット「${h.char}」`, strokes: h.strokes, char: h.char, words: h.words };
  }
  const i = state.level % LEVELS.length;
  return { label: `${i + 1}. ${LEVELS[i].name}`, strokes: [LEVELS[i].path] };
}

const roadAttrs = (d, color, width = (trace && trace.roadWidth) || ROAD_WIDTH) => ({
  d, fill: "none", stroke: color, "stroke-width": width, "stroke-linecap": "round", "stroke-linejoin": "round",
});

function startTrace(mode = traceMode) {
  traceMode = mode;
  const lesson = currentLesson();
  $("level-label").textContent = lesson.label;
  $("mini-pet").innerHTML = makePetSVG(state.petType, state.stage, true);
  traceSvg.innerHTML = "";

  // ※ うしろに フォントの字を うすく 出すと、道の形と ずれて 字が 2つに 見えるので 出さない（2026-11-07）
  const roadWidth = lesson.char ? HIRA_ROAD_WIDTH : ROAD_WIDTH;
  trace = { lesson, roadWidth, layer: null, finished: false, pointerId: null,
    stats: { t0: 0, on: 0, off: 0, erases: 0 } };   // できるように なったこと を みる ため
  // すべての かく の 道（うすい色）
  const roads = lesson.strokes.map((d) => el("path", roadAttrs(d, "#F3E2C9")));
  traceSvg.append(...roads);
  const doneLayer = el("g", {});   // おわった かく
  traceSvg.append(doneLayer);
  // 2かく いじょう の字は、ぜんぶの かく の はじまりに ばんごう を 出して かきじゅん が わかるように
  const badges = [];
  if (lesson.strokes.length > 1) {
    roads.forEach((r, i) => {
      const p = r.getPointAtLength(0);
      const g = el("g", {});
      g.append(el("circle", { cx: p.x, cy: p.y, r: 14, fill: "#B89A78", stroke: "#fff", "stroke-width": 3 }));
      const t = el("text", { x: p.x, y: p.y + 6, "text-anchor": "middle", "font-size": 17, "font-weight": 800, fill: "#fff" });
      t.textContent = i + 1;
      g.append(t);
      badges.push(g);
    });
  }
  Object.assign(trace, { roads, doneLayer, badges, inks: [], sstats: [] });   // inks・sstats：せんせい が みる（かいた せん と かく ごと の ようす）
  setupStroke(0);

  showScreen("trace");
  const first = lesson.review ? `にがて を やっつけよう！「${lesson.char}」を ゆっくり ていねい に かこう`
    : lesson.char ? `「${lesson.char}」を かこう！ ●から ★へ なぞってね` : pick(VOICE.start);
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
  // ばんごう：おわった かく は うすく、いまの かく は ●に 出すので かくす
  trace.badges.forEach((b, i) => {
    b.setAttribute("opacity", i < k ? 0.35 : 1);
    b.style.display = i === k ? "none" : "";
  });

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
  traceSvg.append(...trace.badges); // ばんごう は いちばん うえに
  done.setAttribute("stroke-dasharray", `0 ${len + 10}`);

  Object.assign(trace, {
    cur: { on: 0, off: 0, lifts: 0, t0: 0, t80: 0, tEnd: 0 },   // この かく の ようす
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
  trace.stats.erases += 1;
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
    if (trace.progress > 0) trace.stats.erases += 1;
    eraseStroke();
  } else {
    say(traceBubble, trace.progress === 0 ? "●から はじめてね" : "つづきか ●から かけるよ");
    return;
  }
  trace.pointerId = e.pointerId;
  if (!trace.stats.t0) trace.stats.t0 = Date.now();
  if (!trace.cur.t0) trace.cur.t0 = Date.now();
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
  if (dist <= TOLERANCE * 0.5) { trace.stats.on += 1; trace.cur.on += 1; } else { trace.stats.off += 1; trace.cur.off += 1; }   // まっすぐさ（みち の まんなか を とおった わりあい）
  if (dist <= TOLERANCE) {
    // 道の上 → 進める
    if (index > trace.progress) trace.progress = index;
    if (!trace.cur.t80 && trace.progress >= trace.samples.length * 0.8) trace.cur.t80 = Date.now();
    const doneLen = (trace.progress / (trace.samples.length - 1)) * trace.len;
    trace.done.setAttribute("stroke-dasharray", `${doneLen} ${trace.len + 10}`);

    // 1本の線のときは、半分まで来たら1回ほめる
    if (!trace.cheered && trace.lesson.strokes.length === 1 && trace.progress > trace.samples.length * 0.5) {
      trace.cheered = true;
      say(traceBubble, pick(VOICE.good));
      playAnim($("mini-pet"), "bounce", 600);
    }
  }
  // ゴール：道の さいごまで なぞったら
  if (trace.progress >= trace.samples.length - 3) {
    completeStroke();
    return;
  }
  if (dist > TOLERANCE) {
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
  trace.cur.tEnd = Date.now();
  trace.sstats.push(trace.cur);
  trace.inks.push(trace.inkD);
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
    trace.cur.lifts += 1;
    say(traceBubble, pick(VOICE.resume));
  }
}
traceSvg.addEventListener("pointerup", endTraceStroke);
traceSvg.addEventListener("pointercancel", endTraceStroke);

function finishTrace() {
  trace.finished = true;
  trace.pointerId = null;
  const lesson = trace.lesson;
  const st = trace.stats;
  const better = recordItem(traceMode, {
    key: `${traceMode}:${lesson.char || lesson.label}`,
    ms: Date.now() - (st.t0 || Date.now()), len: trace.lesson.strokes.length,
    acc: st.on / Math.max(1, st.on + st.off), erases: st.erases,
  });
  const done = lesson.char ? `「${lesson.char}」が かけたね！` : pick(VOICE.clear);
  say(traceBubble, better ? `${done} ${better}` : withName(done, 0.4), true);
  playAnim($("mini-pet"), "bounce", 600);

  if (lesson.review) { /* にがて れんしゅう は すすみ を かえない */ }
  else if (traceMode === "hira") state.hiraLevel += 1;
  else if (traceMode === "kata") state.kataLevel += 1;
  else if (traceMode === "num") state.numLevel += 1;
  else if (traceMode === "abc") state.abcLevel += 1;
  else state.level += 1;
  saveState();
  const type = lesson.review ? "review" : traceMode;
  reviewTarget = null;

  setTimeout(() => {
    if (lesson.char) { showWords(lesson, () => itemDone(type), senseiReview(lesson)); return; }
    itemDone(type);
  }, 1200);
}

// 1日の上限までは、ごほうび（みず1つ＋ごはん1つ）がもらえる。もらえたら true
function grantReward() {
  ensureDaily();
  const canReward = state.daily.rewards < DAILY_REWARD_LIMIT;
  if (canReward) {
    state.daily.rewards += 1;
    state.water += 1;
    state.food += 1;
  }
  saveState();
  return canReward;
}

// ごほうびの お知らせ
function showRewardModal(canReward, title = "", again) {
  if (canReward) {
    const who = callName();
    const g = growthToSay();   // まえより できるように なったこと を かならず 1つ
    showModal(makeWaterSVG() + makeFoodSVG(), `${title}${who ? who + "、" : ""}おやつ（みず と ごはん）を<br>もらったよ！<span class="growth-line">${g}</span>`, "あいぼうに あげる", () => goHome(),
      again ? "もっと やる" : "", again);
    setTimeout(() => speak(g), 400);
  } else {
    const g = growthToSay();
    setTimeout(() => speak(g), 400);
    showModal(
      `<div class="big-pet">${makePetSVG(state.petType, state.stage)}</div>`,
      `きょうの ごはんは おしまい！<br>ボール や おはなしで<br>あそべるよ<span class="growth-line">${g}</span>`,
      "ホームに もどる",
      () => goHome()
    );
  }
}

/* ---------------------------------------------------------
   せんせい の ひとこと（2026-11-07 代表：「AIせんせい」の しさく）
   ・かいた 字 を みて、はなまる／◎／○ と、ほめる こと 1つ ＋ コツ 1つ（ひつよう な とき だけ）
   ・みる ところ：みち の まんなか を とおれたか（かく ごと）、とちゅう で ゆび を はなしたか、
     さいご まで ゆっくり ていねい か（さいご の 2わり の はやさ）
   ・※ いまは きまり（ルール）で みている。アプリ化 の あと に 手がき認識 の AI（ML Kit）を くみあわせる よてい
   --------------------------------------------------------- */
function senseiReview(lesson) {
  const ss = trace.sstats;
  if (!ss.length) return null;
  const acc = (x) => x.on / Math.max(1, x.on + x.off);
  const accAll = ss.reduce((a, x) => a + x.on, 0) / Math.max(1, ss.reduce((a, x) => a + x.on + x.off, 0));
  const lifts = ss.reduce((a, x) => a + x.lifts, 0);
  // さいご まで ていねい：さいご の 2わり に かけた 時間 が、ぜんたい の 1.5わり いじょう
  const careful = ss.filter((x) => x.t0 && x.t80 && x.tEnd && (x.tEnd - x.t80) >= (x.tEnd - x.t0) * 0.15).length;
  const worst = ss.length > 1 ? ss.map((x, i) => ({ i, a: acc(x) })).sort((a, b) => a.a - b.a)[0] : null;
  const best = ss.length > 1 ? ss.map((x, i) => ({ i, a: acc(x) })).sort((a, b) => b.a - a.a)[0] : null;

  const mark = accAll >= 0.9 ? "hanamaru" : accAll >= 0.7 ? "double" : "single";
  // ほめる こと（いちばん よい ところ を 1つ）
  const praises = [];
  if (accAll >= 0.9) praises.push("みち の まんなか を とおって かけたね");
  if (best && best.a >= 0.9) praises.push(`${best.i + 1}ばんめ の せん が とっても きれい`);
  if (!lifts) praises.push(ss.length > 1 ? "どの せん も いっき に かけたね" : "いっき に かけたね");
  if (careful >= Math.ceil(ss.length / 2)) praises.push("さいご まで ていねい に かけたね");
  if (!praises.length) praises.push("さいご まで かけたね");
  const praise = pick(praises.slice(0, 2));
  // コツ（はなまる じゃない とき だけ。いちばん なおすと よい ところ を 1つ）
  let tip = "";
  if (mark !== "hanamaru") {
    if (worst && acc(ss[worst.i]) < 0.7) tip = `${worst.i + 1}ばんめ の せん を ゆっくり なぞって みよう`;
    else if (lifts >= 2) tip = "ゆび を はなさずに かいて みよう";
    else tip = "つぎは みち の まんなか を ゆっくり とおって みよう";
  }
  // AI が かいた 字 を よむ（ひらがな だけ。ブラウザ の なか で うごく）
  let aiLine = "";
  if (traceMode === "hira" && typeof AIReader !== "undefined" && AIReader.ready) {
    const res = AIReader.read(trace.inks.flatMap((d) => AIReader.parsePath(d)));
    trace.aiRead = res.slice(0, 3);   // たしかめ用
    if (res[0] && res[0].char === lesson.char) aiLine = `AIせんせい も「${lesson.char}」って よめたよ`;
  }
  const markHTML = mark === "hanamaru" ? HANAMARU : `<span class="sensei-mark">${mark === "double" ? "◎" : "○"}</span>`;
  const markWord = mark === "hanamaru" ? "はなまる！" : mark === "double" ? "にじゅうまる！" : "まる！";
  // かいた 字 を そのまま みせる
  const inks = trace.inks.map((d) => `<path d="${d}" fill="none" stroke="#FF8A5B" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
  const roads = lesson.strokes.map((d) => `<path d="${d}" fill="none" stroke="#EADBC4" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
  const html = `<div class="sensei">
      <div class="sensei-paper"><svg viewBox="20 60 320 380">${roads}${inks}</svg><div class="sensei-markbox">${markHTML}</div></div>
      <div class="sensei-talk"><span class="sensei-name">せんせい</span><b>${markWord}</b><br>${praise}${aiLine ? `<br><span class="sensei-ai">${aiLine}</span>` : ""}${tip ? `<br><span class="sensei-tip">${tip}</span>` : ""}</div>
    </div>`;
  return { html, say: `${markWord} ${praise}。${aiLine ? aiLine + "。" : ""}${tip ? tip : ""}`, mark, praise, tip, aiLine };
}

// ひらがな が かけたら、その字で はじまる ことば を ならべる（さわると よみあげ）
function showWords(lesson, next, review) {
  const cards = lesson.words.map((w, i) =>
    `<button class="word-card" data-i="${i}"><span class="word-icon${[...w.icon].length > 2 ? " many" : ""}">${w.icon}</span><span class="word-text${w.en ? " en" : ""}">${w.en ? w.word.replace(new RegExp(lesson.char, "i"), (m) => `<b>${m}</b>`) : w.word.split(lesson.char).join(`<b>${lesson.char}</b>`)}</span></button>`
  ).join("");
  showModal(
    (review ? review.html : "") + `<div class="word-cards">${cards}</div>`,
    `「${lesson.char}」の ことば を さわってみよう`,
    "つぎへ",
    next
  );
  if (review) setTimeout(() => speak(review.say), 300);
  document.querySelectorAll(".word-card").forEach((b) => {
    b.onclick = () => {
      const w = lesson.words[b.dataset.i];
      if (w.en) speakEn(w.word, true); else speak(w.word, true);
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
   5. いっしょに よもう
   ・ことばの 絵と、ひらがなの カードが ならぶ
   ・ひだりから じゅんばんに カードを さわると、1もじずつ よむ
   ・ぜんぶ さわったら、あいぼうと「せーの！」で ことば を よむ
   ・「いっしょに よんで」で、あいぼうが おてほんを よむ
   --------------------------------------------------------- */
let reading = null;
const readBubble = $("read-bubble");

function startRead() {
  const i = state.readLevel % READS.length;
  const r = READS[i];
  const chars = [...r.word.replace(/ /g, "")];
  reading = { r, chars, next: 0, done: false, timers: [], t0: Date.now(), miss: 0 };
  $("read-label").textContent = `よもう ${i + 1} / ${READS.length}`;
  $("read-pet").innerHTML = makePetSVG(state.petType, state.stage, true);
  $("read-pic").textContent = r.icon;
  const box = $("read-tiles");
  box.innerHTML = "";
  box.classList.toggle("long", chars.length >= 5);
  box.classList.toggle("sentence", r.word.includes(" "));
  // ことば ごとに まとめて ならべる（ぶん のときは ことば の あいだが あく）
  let k = 0;
  r.word.split(" ").forEach((w) => {
    const group = document.createElement("div");
    group.className = "read-word";
    [...w].forEach((c) => {
      const idx = k++;
      const b = document.createElement("button");
      b.className = "read-tile";
      b.textContent = c;
      b.onclick = () => tapTile(idx);
      group.appendChild(b);
    });
    box.appendChild(group);
  });
  markNext();
  showScreen("read");
  setTimeout(() => say(readBubble, "いっしょに よもう！ ひだりから さわってね", true, 3000), 300);
}

function tiles() { return [...document.querySelectorAll(".read-tile")]; }

function markNext() {
  tiles().forEach((t, k) => t.classList.toggle("next", !reading.done && k === reading.next));
}

function flash(t) { t.classList.remove("say"); void t.offsetWidth; t.classList.add("say"); }

function tapTile(k) {
  if (!reading || reading.done) return;
  const t = tiles()[k];
  if (k > reading.next) {
    reading.miss += 1;
    say(readBubble, "こっちから よもう", true);
    playAnim($("read-pet"), "bounce", 600);
    return;
  }
  speak(reading.chars[k], true);
  flash(t);
  if (k === reading.next) {
    t.classList.add("lit");
    reading.next += 1;
    markNext();
    if (reading.next >= reading.chars.length) finishRead();
  }
}

// あいぼうが 1もじずつ ひかりながら よんで、さいごに ことば を よむ
function readAlong() {
  if (!reading) return;
  reading.timers.forEach(clearTimeout);
  reading.timers = [];
  const ts = tiles();
  ts.forEach((t, k) => reading.timers.push(setTimeout(() => { flash(t); speak(reading.chars[k]); }, 700 * k)));
  reading.timers.push(setTimeout(() => {
    say(readBubble, reading.r.word, true);
    $("read-tiles").classList.remove("wave"); void $("read-tiles").offsetWidth; $("read-tiles").classList.add("wave");
  }, 700 * ts.length + 200));
}

function finishRead() {
  reading.done = true;
  reading.timers.forEach(clearTimeout);
  recordItem("read", { key: `read:${reading.r.word}`, ms: Date.now() - reading.t0, miss: reading.miss });
  state.readLevel += 1;
  saveState();
  setTimeout(() => say(readBubble, "せーの！", true), 500);
  setTimeout(() => {
    say(readBubble, `${reading.r.word}！`, true, 2500);
    $("read-tiles").classList.add("wave");
    $("read-pic").classList.add("pop");
    playAnim($("read-pet"), "bounce", 600);
  }, 1500);
  setTimeout(() => say(readBubble, withName(pick(VOICE.clear), 0.4), true), 3000);
  setTimeout(() => itemDone("read"), 4300);
}

$("btn-read-along").onclick = () => readAlong();
$("btn-read-back").onclick = () => {
  if (reading) reading.timers.forEach(clearTimeout);
  goHome();
};

/* ---------------------------------------------------------
   6. ものがたり（じょうきゅう）
   ・えほん の ように たてがき。みぎの ぎょう から よむ
   ・もじ の みぎよこ の せん を ゆびで うえから なぞりながら よむ
   ・よめない もじ は、さわったまま とまる（または タップ）と、あいぼうが その ことば を よむ
   --------------------------------------------------------- */
let story = null;
const storyBubble = $("story-bubble");
const HELP_WAIT = 1200;  // ゆびが この時間 とまったら よんであげる

const petName = () => PET_TYPES[state.petType].name;
// {name}＝いまの あいぼう、{animal}{car}{veggie}＝それぞれの あいぼう の なまえ
const fillNames = (t) => t.replace(/{(\w+)}/g, (m, k) => (k === "name" ? petName() : (PET_TYPES[k] ? PET_TYPES[k].name : m)));
const storyTitle = (st) => fillNames(st.title);
const isMark = (c) => /[、。！？「」 ]/.test(c);

function startStory() {
  const st = STORIES[state.storyIndex % STORIES.length];
  story = { st, page: 0, t0: Date.now(), helps: 0 };
  $("story-pet").innerHTML = makePetSVG(state.petType, state.stage, true);
  showScreen("story");
  renderPage();
  setTimeout(() => say(storyBubble, "みぎうえ から せんを なぞって よもう", true, 3500), 300);
}

function renderPage() {
  const page = story.st.pages[story.page];
  const text = fillNames(page.text);
  $("story-label").textContent = `${storyTitle(story.st)}　${story.page + 1} / ${story.st.pages.length}`;
  $("story-pic").textContent = page.icon;
  $("btn-story-next").classList.add("hidden");

  // ぎょう（たての れつ）ごとに、1もじずつ の はこ を つくる
  const box = $("story-text");
  box.innerHTML = "";
  const chars = [];       // { el, ch, word }
  text.split("/").forEach((line) => {
    const col = document.createElement("div");
    col.className = "story-col";
    line.split(" ").forEach((w, wi) => {
      if (wi > 0) {
        const sp = document.createElement("span");
        sp.className = "story-ch space";
        col.appendChild(sp);
        chars.push({ el: sp, ch: " ", word: "" });
      }
      const word = w.replace(/[、。！？「」]/g, "");
      [...w].forEach((c) => {
        const span = document.createElement("span");
        span.className = "story-ch" + (isMark(c) ? " mark" : "");
        span.textContent = c;
        col.appendChild(span);
        chars.push({ el: span, ch: c, word });
      });
    });
    box.appendChild(col);
  });
  Object.assign(story, { text: text.replace(/\//g, " "), chars, progress: -1, done: false, pointerId: null, helpTimer: null, lastIdx: -1, timers: [] });
  markStoryNext();
}

// つぎに よむ もじ に しるし
function markStoryNext() {
  story.chars.forEach((c, i) => c.el.classList.toggle("next", !story.done && i === nextReadable()));
}
function nextReadable() {
  let i = story.progress + 1;
  while (i < story.chars.length && isMark(story.chars[i].ch)) i++;
  return i;
}

// ゆびの いちに ある もじ（もじ の はこ と、その みぎの せん の あたり）
function charAt(x, y) {
  for (let i = 0; i < story.chars.length; i++) {
    const r = story.chars[i].el.getBoundingClientRect();
    if (x >= r.left - 6 && x <= r.right + 34 && y >= r.top && y <= r.bottom) return i;
  }
  return -1;
}

function helpRead(i) {
  const c = story.chars[i];
  if (!c || !c.word) return;
  speak(c.word, true);
  story.helps += 1;
  say(storyBubble, `「${c.word}」だよ`, true);
  // その ことば を ひからせる
  story.chars.forEach((o) => { if (o.word === c.word) { o.el.classList.remove("help"); void o.el.offsetWidth; o.el.classList.add("help"); } });
}

function storyPointer(e, type) {
  if (!story || story.done) return;
  if (type === "down") {
    if (story.pointerId !== null) return;
    story.pointerId = e.pointerId;
    story.downAt = { x: e.clientX, y: e.clientY, t: Date.now() };
    try { $("story-text").setPointerCapture(e.pointerId); } catch (err) {}
  }
  if (e.pointerId !== story.pointerId) return;
  if (type === "up") {
    clearTimeout(story.helpTimer);
    story.pointerId = null;
    // ほとんど うごかさずに はなした → タップ：その ことば を よむ
    const d = story.downAt;
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 10 && Date.now() - d.t < 500) {
      const i = charAt(e.clientX, e.clientY);
      if (i >= 0) helpRead(i);
    }
    return;
  }
  const i = charAt(e.clientX, e.clientY);
  if (i < 0) return;
  // ゆびが とまったら（おなじ もじ に いつづけたら）よんであげる
  if (i !== story.lastIdx) {
    story.lastIdx = i;
    clearTimeout(story.helpTimer);
    story.helpTimer = setTimeout(() => helpRead(i), HELP_WAIT);
  }
  // じゅんばん どおり（つぎ の もじ から 2もじ さき まで）なら すすむ
  if (i > story.progress && i <= nextReadable() + 2) {
    for (let k = story.progress + 1; k <= i; k++) story.chars[k].el.classList.add("read");
    story.progress = i;
    markStoryNext();
    if (nextReadable() >= story.chars.length) pageDone();
  }
}
const stx = () => $("story-text");
stx().addEventListener("pointerdown", (e) => storyPointer(e, "down"));
stx().addEventListener("pointermove", (e) => storyPointer(e, "move"));
stx().addEventListener("pointerup", (e) => storyPointer(e, "up"));
stx().addEventListener("pointercancel", (e) => storyPointer(e, "up"));

function pageDone() {
  story.done = true;
  clearTimeout(story.helpTimer);
  story.chars.forEach((c) => c.el.classList.add("read"));
  markStoryNext();
  say(storyBubble, pick(VOICE.good), true);
  playAnim($("story-pet"), "bounce", 600);
  $("story-pic").classList.remove("pop"); void $("story-pic").offsetWidth; $("story-pic").classList.add("pop");
  const last = story.page + 1 >= story.st.pages.length;
  $("btn-story-next").textContent = last ? "おしまい！" : "つぎの ページ ▶";
  $("btn-story-next").classList.remove("hidden");
}

$("btn-story-next").onclick = () => {
  if (story.page + 1 < story.st.pages.length) {
    story.page += 1;
    renderPage();
    return;
  }
  // さいごまで よめた
  recordItem("story", { key: `story:${story.st.title}`, ms: Date.now() - story.t0, helps: story.helps });
  state.storyIndex += 1;
  saveState();
  say(storyBubble, withName("おしまい！ さいごまで よめたね！", 0.6), true);
  setTimeout(() => itemDone("story"), 1500);
};

// おてほん：あいぼうが ぶん を よみながら、もじ を じゅんばんに ひからせる
$("btn-story-along").onclick = () => {
  if (!story) return;
  story.timers.forEach(clearTimeout);
  story.timers = [];
  speak(story.text);
  const readable = story.chars.filter((c) => !isMark(c.ch));
  readable.forEach((c, k) => story.timers.push(setTimeout(() => {
    c.el.classList.remove("help"); void c.el.offsetWidth; c.el.classList.add("help");
  }, 280 * k)));
};
$("btn-story-back").onclick = () => {
  if (story) { story.timers.forEach(clearTimeout); clearTimeout(story.helpTimer); }
  goHome();
};

/* ---------------------------------------------------------
   7. べんきょう を えらぶ ・ セット ・ きょうの おけいこ
   ・1セット（せんかき10・ひらがな5・よみ5・ものがたり1 など）おわるごとに おやつ1こ
   ・「きょうの おけいこ」は その子に あわせた くみあわせ。ぜんぶ できたら おやつ1こ
     （すきな もの ばかり に ならないように）
   --------------------------------------------------------- */
const STUDY = {
  line:  { name: "せんかき",     icon: "〰️", set: 10, base: true,  start: () => startTrace("line"),
           sub: () => `${(state.level % LEVELS.length) + 1} / ${LEVELS.length}もんめ` },
  hira:  { name: "ひらがな",     icon: "あ",  set: 5,  base: true,  start: () => startTrace("hira"),
           sub: () => `つぎは「${HIRAGANA[state.hiraLevel % HIRAGANA.length].char}」` },
  read:  { name: "いっしょに よもう", icon: "📕", set: 5, base: true, start: () => startRead(),
           sub: () => `つぎは「${READS[state.readLevel % READS.length].word}」` },
  story: { name: "ものがたり",   icon: "📖", set: 1,  base: true,  start: () => startStory(),
           sub: () => `じょうきゅう ・「${storyTitle(STORIES[state.storyIndex % STORIES.length])}」` },
  kata:  { name: "カタカナ",     icon: "ア",  set: 5,  start: () => startTrace("kata"),
           sub: () => `つぎは「${KATAKANA[state.kataLevel % KATAKANA.length].char}」` },
  num:   { name: "すうじ を かく", icon: "1",  set: 5,  start: () => startTrace("num"),
           sub: () => `つぎは「${NUMBERS[state.numLevel % NUMBERS.length].char}」` },
  free:  { name: "おてほん なしで かく", icon: "✍️", set: 3, start: () => startGame("free"),
           sub: () => "AIせんせい が よんで くれるよ" },
  maze:  { name: "めいろ",       icon: "🌀", set: 3,  start: () => startGame("maze") },
  count: { name: "かず を かぞえる", icon: "🍎", set: 5, start: () => startGame("count") },
  dots:  { name: "てんつなぎ",   icon: "✏️", set: 3,  start: () => startGame("dots") },
  road:  { name: "みち つなぎ",  icon: "🛣️", set: 3,  start: () => startGame("road") },
  review: { name: "にがて れんしゅう", icon: "💪", set: 3, start: () => startReview(),
           sub: () => `「${weakItems(3).map((w) => w.char).join("」「")}」を もういちど` },
  balance: { name: "てんびん",   icon: "⚖️", set: 3,  start: () => startGame("balance") },
  clock: { name: "とけい",       icon: "🕒", set: 3,  start: () => startGame("clock") },
  // 2026-11-08 しんさく
  draw:  { name: "おえかき",     icon: "🖍️", set: 2,  start: () => startGame("draw"),
           sub: () => "2さい から ・ てくび を つかって かこう" },
  calc:  { name: "たしざん・ひきざん", icon: "➕", set: 5, start: () => startGame("calc"),
           sub: () => "おはなし で かず を かんがえる" },
  code:  { name: "プログラミング", icon: "🧭", set: 3, start: () => startGame("code"),
           sub: () => "やじるし を ならべて おやつ へ" },
  abc:   { name: "アルファベット", icon: "A", set: 5, start: () => startTrace("abc"),
           sub: () => `つぎは「${ALPHABET[state.abcLevel % ALPHABET.length].char}」` },
  eng:   { name: "えいご の ことば", icon: "🔤", set: 5, start: () => startGame("eng"),
           sub: () => "えいご を きいて え を えらぶ" },
};
/* ---------------------------------------------------------
   にがて を みつける
   ・おなじ 字 の まえ の けっか（state.last）を みて、はみだし が おおい／けしゴム が おおい／
     ほか の 字 より ずっと じかん が かかった 字 を「にがて」に する
   ・つぎ に じょうず に かけたら state.last が かわるので、しぜん に にがて から はずれる
   --------------------------------------------------------- */
function weakItems(max = 3) {
  const list = [];
  const byMode = {};
  for (const [key, r] of Object.entries(state.last)) {
    const [mode, char] = key.split(":");
    if (!MODE_NAME[mode] || !r) continue;
    (byMode[mode] = byMode[mode] || []).push(r.ms || 0);
    list.push({ key, mode, char, r });
  }
  const median = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)] || 0; };
  const med = {};
  for (const m in byMode) med[m] = median(byMode[m]);
  return list.map((x) => {
    const reasons = [];
    let score = 0;
    if (typeof x.r.acc === "number" && x.r.acc < 0.75) { score += (0.75 - x.r.acc) * 4 + 0.5; reasons.push("はみだし が おおい"); }
    if ((x.r.erases || 0) >= 2) { score += 0.4 + x.r.erases * 0.1; reasons.push("なんども けした"); }
    if (med[x.mode] && x.r.ms > med[x.mode] * 1.8 && byMode[x.mode].length >= 4) { score += 0.4; reasons.push("じかん が かかった"); }
    return { ...x, score, reasons };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, max);
}
function startReview() {
  // おけいこ の なか なら その日 の リスト、そうでなければ いま の にがて
  const step = inCourse ? courseStep() : null;
  const keys = step && step.type === "review" ? step.keys : weakItems(3).map((w) => w.key);
  if (!keys.length) { goHome(); return; }
  const k = keys[((step ? step.done : state.sets.review) || 0) % keys.length];
  const [mode, char] = k.split(":");
  reviewTarget = { mode, char };
  startTrace(mode);
}

const TRIAL_TYPES = ["draw", "calc", "code", "abc", "eng", "free", "kata", "num", "maze", "count", "balance", "dots", "road", "clock"];
let inCourse = false;   // いま「きょうの おけいこ」で やっているか

function startType(type) {
  if (needRest()) { showRest(() => STUDY[type].start()); return; }
  STUDY[type].start();
}

/* その子に あわせて きょうの おけいこ を つくる
   ・きほん：せんかき20 → ひらがな5 → よみ5（2026-11-07 代表の例）
   ・せんかき を ひととおり おえた子は せんかき10 に へらす
   ・ひらがな を ひととおり おえた子は カタカナ5 に
   ・よみ（ことば・ぶん）を ひととおり おえた子は ものがたり1 に
   ・さいごに、ためしの あそび の うち いちばん やっていない もの を 1こ（おたのしみ） */
function buildCourse() {
  const steps = [];
  steps.push({ type: "line", count: state.level >= LEVELS.length ? 10 : 20 });
  steps.push(state.hiraLevel >= HIRAGANA.length ? { type: "kata", count: 5 } : { type: "hira", count: 5 });
  steps.push(state.readLevel >= READS.length ? { type: "story", count: 1 } : { type: "read", count: 5 });
  // にがて が あれば、1〜2こ だけ れんしゅう（2026-11-07 代表：にがて を みつけて おけいこ に）
  const weak = weakItems(2);
  if (weak.length) steps.splice(2, 0, { type: "review", count: weak.length, keys: weak.map((w) => w.key) });
  const fun = TRIAL_TYPES.filter((t) => !steps.some((x) => x.type === t))
    .sort((a, b) => (state.played[a] || 0) - (state.played[b] || 0))[0];
  steps.push({ type: fun, count: 1, fun: true });
  return steps.map((x) => ({ ...x, done: 0 }));
}

function ensureCourse() {
  if (!state.course || state.course.date !== todayKey()) {
    state.course = { date: todayKey(), steps: buildCourse(), rewarded: false };
    saveState();
  }
  return state.course;
}
const courseStep = () => ensureCourse().steps.find((x) => x.done < x.count);

function startCourse() {
  const step = courseStep();
  if (!step) {
    showModal(`<div class="big-pet">${makePetSVG(state.petType, state.stage)}</div>`,
      "きょうの おけいこ は<br>ぜんぶ できたよ！<br>また あした ね", "ホームに もどる", () => goHome());
    return;
  }
  inCourse = true;
  startType(step.type);
}

// 1こ おわった（どの しゅるい からも ここに くる）
// がんばり カレンダー と きょう の きろく に つける
function markDay(courseDone = false) {
  const k = todayKey();
  const d = state.days[k] || (state.days[k] = { n: 0, c: false });
  if (courseDone) d.c = true; else d.n += 1;
}
function itemDone(type) {
  state.played[type] = (state.played[type] || 0) + 1;
  ensureDaily().log[type] = (state.daily.log[type] || 0) + 1;
  markDay();
  if (inCourse) { courseItemDone(type); return; }

  const size = STUDY[type].set;
  state.sets[type] = (state.sets[type] || 0) + 1;
  if (state.sets[type] >= size) {
    state.sets[type] = 0;
    const can = grantReward();
    showRewardModal(can, `${STUDY[type].name} 1セット できた！<br>`, () => startType(type));
    return;
  }
  saveState();
  const left = size - state.sets[type];
  showModal(starsArt(state.sets[type], size), `できた！<br>あと ${left}こ で おやつ`, "つぎへ", () => startType(type),
    "ホームに もどる", () => goHome());
}

function courseItemDone(type) {
  const c = ensureCourse();
  const step = courseStep();
  if (step && step.type === type) step.done += 1;
  saveState();
  const next = courseStep();
  if (!next) {
    inCourse = false;
    if (!c.rewarded) {
      c.rewarded = true;
      const can = grantReward();
      markDay(true);
      showRewardModal(can, "きょうの おけいこ ぜんぶ できた！<br>");
    } else goHome();
    return;
  }
  const total = c.steps.reduce((a, x) => a + x.count, 0);
  const done = c.steps.reduce((a, x) => a + x.done, 0);
  const msg = next !== step
    ? `${STUDY[step.type].name} おわり！<br>つぎは ${STUDY[next.type].name}${next.fun ? "（おたのしみ）" : ""}`
    : `できた！<br>${STUDY[next.type].name} あと ${next.count - next.done}こ`;
  showModal(starsArt(done, total), msg, "つづける", () => startType(next.type),
    "ひとやすみ", () => { inCourse = false; goHome(); });
}

// すすみぐあい を ほし で みせる（おおいときは バー）
function starsArt(done, total) {
  if (total <= 10) {
    return `<div class="stars">${Array.from({ length: total }, (_, i) => `<span class="${i < done ? "on" : ""}">★</span>`).join("")}</div>`;
  }
  return `<div class="progress-bar"><span style="width:${Math.round(done / total * 100)}%"></span></div><div class="progress-num">${done} / ${total}</div>`;
}

function renderStudyMenu() {
  inCourse = false;
  const c = ensureCourse();
  $("course-steps").innerHTML = c.steps.map((x) =>
    `<span class="course-chip ${x.done >= x.count ? "done" : ""}">${STUDY[x.type].name}${x.fun ? "（おたのしみ）" : ""} ${x.done}/${x.count}</span>`).join("");
  const allDone = !courseStep();
  $("course-sub").textContent = allDone ? "ぜんぶ できた！ また あした" : "ぜんぶ できたら おやつ 1こ";
  $("study-course").classList.toggle("done", allDone);

  const card = (type) => {
    const t = STUDY[type];
    const left = t.set - (state.sets[type] || 0);
    const sub = t.sub ? t.sub() : "";
    return `<button class="study-card" data-type="${type}">
      <span class="study-icon ${/^[ぁ-んァ-ンA-Z0-9]$/.test(t.icon) ? "study-icon-text" : ""}">${t.icon}</span>${isNew(type) ? `<span class="new-badge">NEW</span>` : ""}
      <span><span class="study-name">${t.name}</span>
      <span class="study-sub">${sub}</span>
      <span class="study-set">おやつ まで あと ${left}こ</span></span></button>`;
  };
  $("study-base").innerHTML = (weakItems(1).length ? card("review") : "") + Object.keys(STUDY).filter((k) => STUDY[k].base).map(card).join("");
  $("study-trial").innerHTML = releaseBanner() + TRIAL_TYPES.map(card).join("");
  document.querySelectorAll(".study-card[data-type]").forEach((b) => {
    b.onclick = () => { inCourse = false; startType(b.dataset.type); };
  });
  showScreen("study");
}
$("btn-study").onclick = () => renderStudyMenu();
$("btn-study-back").onclick = () => goHome();
$("study-course").onclick = () => startCourse();

/* ---------------------------------------------------------
   8. できるように なったこと（2026-11-07 代表：かならず 書く＆言う）
   ・1もん ごとに はやさ・まっすぐさ・けしゴム・まちがい・おたすけ を きろく
   ・「きょう」と「まえに やった ひ」を くらべて、よく なった こと だけ を ことば に する
   ・よく なった こと が なくても、あたらしく できた こと や つみかさね を かならず 1つ 出す
   --------------------------------------------------------- */
const TRACE_TYPES = ["line", "hira", "kata", "num", "abc"];
const GAME_TYPES = ["maze", "count", "balance", "dots", "road", "clock", "draw", "calc", "code", "eng"];

// 1もん おわった とき に よぶ。おなじ もんだい の まえ の けっか より よければ ひとこと を かえす
function recordItem(type, r) {
  const day = todayKey();
  const all = state.stats[day] || (state.stats[day] = {});
  const t = all[type] || (all[type] = { n: 0, ms: 0, acc: 0, accN: 0, era: 0, miss: 0, helps: 0 });
  t.n += 1;
  t.ms += Math.min(r.ms || 0, 10 * 60000) / (r.len || 1);   // 1かく あたり
  if (typeof r.acc === "number") { t.acc += r.acc; t.accN += 1; }
  t.era += r.erases || 0;
  t.miss += r.miss || 0;
  t.helps += r.helps || 0;
  // あたらしく できた もの
  if (r.key && !state.firsts[r.key]) state.firsts[r.key] = day;
  // おなじ もんだい の まえ の けっか と くらべる
  let better = "";
  const prev = r.key && state.last[r.key];
  if (prev && TRACE_TYPES.includes(type)) {
    if (typeof r.acc === "number" && r.acc >= prev.acc + 0.05) better = "まえより まっすぐ かけたね！";
    else if (r.ms && prev.ms && r.ms <= prev.ms * 0.85) better = "まえより はやく かけたね！";
    else if ((r.erases || 0) < (prev.erases || 0)) better = "まえより けしゴム が へったね！";
  }
  if (r.key) state.last[r.key] = { acc: r.acc, ms: r.ms, erases: r.erases || 0, miss: r.miss || 0, helps: r.helps || 0 };
  // 30日 より まえ の きろく は けす
  const keys = Object.keys(state.stats);
  if (keys.length > 30) keys.sort((a, b) => dayNum(a) - dayNum(b)).slice(0, keys.length - 30).forEach((k) => delete state.stats[k]);
  saveState();
  return better;
}
const dayNum = (k) => { const [y, m, d] = k.split("-").map(Number); return y * 10000 + m * 100 + d; };

// きょう より まえ で、その しゅるい を やった いちばん ちかい ひ
function prevStat(type) {
  const today = dayNum(todayKey());
  const days = Object.keys(state.stats).filter((k) => dayNum(k) < today && state.stats[k][type])
    .sort((a, b) => dayNum(b) - dayNum(a));
  return days.length ? state.stats[days[0]][type] : null;
}
const avg = (t, k, n = t.n) => (n ? t[k] / n : 0);

// きょう の「できるように なったこと」の いちらん（さいご は かならず 1つ ある）
function growthList() {
  const out = [];
  const today = state.stats[todayKey()] || {};
  const name = (type) => (STUDY[type] ? STUDY[type].name : type);
  for (const [type, t] of Object.entries(today)) {
    const p = prevStat(type);
    if (!p) continue;
    const nm = name(type);
    if (TRACE_TYPES.includes(type)) {
      const verb = type === "line" ? "まっすぐ ひけるように" : "はみださないで かけるように";
      if (t.accN && p.accN && avg(t, "acc", t.accN) >= avg(p, "acc", p.accN) + 0.03) out.push({ text: `${nm}：まえより ${verb} なったね` });
      if (avg(t, "ms") <= avg(p, "ms") * 0.9) out.push({ text: `${nm}：まえより はやく かけるように なったね` });
      if (avg(p, "era") > 0 && avg(t, "era") < avg(p, "era")) out.push({ text: `${nm}：けしゴム を つかう のが へったね` });
    } else if (type === "read" || type === "story") {
      if (avg(t, "ms") <= avg(p, "ms") * 0.9) out.push({ text: `${nm}：まえより すらすら よめるように なったね` });
      if (avg(p, "helps") > 0 && avg(t, "helps") < avg(p, "helps")) out.push({ text: `${nm}：ひとりで よめる ことば が ふえたね` });
      if (avg(p, "miss") > 0 && avg(t, "miss") < avg(p, "miss")) out.push({ text: `${nm}：じゅんばん に よめるように なったね` });
    } else {
      if (avg(t, "ms") <= avg(p, "ms") * 0.9) out.push({ text: `${nm}：まえより はやく できるように なったね` });
      if (avg(p, "miss") > 0 && avg(t, "miss") < avg(p, "miss")) out.push({ text: `${nm}：まえより まちがい が へったね` });
    }
    if (t.n > p.n) out.push({ text: `${nm}：まえより たくさん できたね（${p.n}こ → ${t.n}こ）` });
  }
  // あたらしく できた もじ
  const day = todayKey();
  const newChars = Object.entries(state.firsts).filter(([k, d]) => d === day && /^(hira|kata|num|abc):/.test(k)).map(([k]) => k.split(":")[1]);
  if (newChars.length) out.push({ text: `あたらしく「${newChars.slice(-3).join("」「")}」が かけるように なったね` });
  const newWords = Object.entries(state.firsts).filter(([k, d]) => d === day && k.startsWith("read:")).map(([k]) => k.slice(5));
  if (newWords.length) out.push({ text: `あたらしく「${newWords[newWords.length - 1]}」が よめるように なったね` });
  const newTypes = Object.keys(today).filter((t) => !prevStat(t) && Object.keys(state.stats).length > 1);
  newTypes.forEach((t) => out.push({ text: `はじめて ${name(t)} が できたね` }));
  // かならず 1つ：つみかさね
  if (!out.length) {
    const chars = Object.keys(state.firsts).filter((k) => /^(hira|kata|num|abc):/.test(k)).length;
    const playedDays = Object.values(state.days).filter((r) => r.n).length;
    if (chars) out.push({ text: `ぜんぶ で ${chars}この もじ が かけるように なったよ` });
    else if (playedDays > 1) out.push({ text: `${playedDays}にち も がんばってるね` });
    else out.push({ text: "はじめて の べんきょう、できたね" });
  }
  return out;
}
// あいぼう が いう ひとこと（おなじ ことば が つづかない ように まわす）
function growthToSay() {
  const list = growthList();
  const d = ensureDaily();
  d.said = d.said || [];
  const fresh = list.find((x) => !d.said.includes(x.text)) || list[0];
  d.said.push(fresh.text);
  saveState();
  // 「せんかき：〜」の かたち を、はなしことば に
  const [head, body] = fresh.text.includes("：") ? fresh.text.split("：") : ["", fresh.text];
  return head ? `${head}、${body}！` : `${body}！`;
}

/* ---------------------------------------------------------
   9. おうち の ひと へ の 週 の レポート（2026-11-07 代表）
   ・さいきん 7日 と、その まえ の 7日 を くらべる
   ・できるように なったこと／よく やった もの／にがて と おうち で できる こと／ひとこと
   ・ぜんぶ 端末 の なか の きろく から つくる（外 には 送らない）
   --------------------------------------------------------- */
function dayKeyOf(offset) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function weekSum(from) {   // from 日 まえ から 7日 ぶん
  const out = { days: 0, ms: 0, n: 0, types: {}, keys: [] };
  for (let i = from; i < from + 7; i++) {
    const k = dayKeyOf(i);
    out.keys.push(k);
    const d = state.days[k];
    if (d && d.n) out.days += 1;
    if (d && d.ms) out.ms += d.ms;
    const st = state.stats[k] || {};
    for (const [type, t] of Object.entries(st)) {
      const a = out.types[type] || (out.types[type] = { n: 0, ms: 0, acc: 0, accN: 0, era: 0, miss: 0, helps: 0 });
      for (const f of Object.keys(a)) a[f] += t[f] || 0;
      out.n += t.n;
    }
  }
  return out;
}
function weeklyReport() {
  const now = weekSum(0), prev = weekSum(7);
  const name = (t) => (STUDY[t] ? STUDY[t].name : t);
  const who = callName() || "おこさま";
  const grow = [];
  for (const [type, t] of Object.entries(now.types)) {
    const p = prev.types[type];
    if (!p || !p.n) continue;
    const nm = name(type);
    if (t.accN && p.accN && t.acc / t.accN >= p.acc / p.accN + 0.03)
      grow.push(`${nm}：はみださずに なぞれる わりあい が ${Math.round(p.acc / p.accN * 100)}% → ${Math.round(t.acc / t.accN * 100)}%`);
    if (t.ms / t.n <= (p.ms / p.n) * 0.9)
      grow.push(`${nm}：1こ に かかる 時間 が ${Math.round(p.ms / p.n / 1000)}びょう → ${Math.round(t.ms / t.n / 1000)}びょう`);
    if (p.miss / p.n > 0 && t.miss / t.n < p.miss / p.n) grow.push(`${nm}：まちがい が へりました`);
    if (p.helps / p.n > 0 && t.helps / t.n < p.helps / p.n) grow.push(`${nm}：ひとり で よめる ことば が ふえました`);
    if (p.era / p.n > 0 && t.era / t.n < p.era / p.n) grow.push(`${nm}：けしゴム を つかう 回数 が へりました`);
  }
  const newKeys = Object.entries(state.firsts).filter(([, d]) => now.keys.includes(d)).map(([k]) => k);
  const newChars = newKeys.filter((k) => /^(hira|kata|num|abc):/.test(k)).map((k) => k.split(":")[1]);
  const newWords = newKeys.filter((k) => k.startsWith("read:")).map((k) => k.slice(5));
  if (newChars.length) grow.push(`あたらしく かけた 字：「${newChars.slice(0, 12).join("」「")}」${newChars.length > 12 ? ` ほか ${newChars.length - 12}字` : ""}`);
  if (newWords.length) grow.push(`あたらしく よめた ことば：${newWords.length}こ（「${newWords.slice(-3).join("」「")}」など）`);
  if (now.days > prev.days && prev.days) grow.push(`べんきょう した 日 が ${prev.days}日 → ${now.days}日 に ふえました`);
  if (!grow.length) grow.push(now.n ? `今週 は ${now.n}こ の もんだい に とりくみました。つづけて いる こと が いちばん の せいちょう です` : "今週 は まだ きろく が ありません");

  const top = Object.entries(now.types).sort((a, b) => b[1].n - a[1].n).slice(0, 3).map(([t, x]) => `${name(t)} ${x.n}こ`);
  const weak = weakItems(3);
  const hiraDone = Object.keys(state.firsts).filter((k) => k.startsWith("hira:")).length;

  // ひとこと（きまり で えらぶ）
  const tips = [];
  if (now.days <= 2) tips.push("1日 5分 でも、まいにち さわる と 字 が しっかり 身 に つきます。あいぼう の ごはん の 時間 を きめる のも おすすめです");
  if (weak.length) tips.push(`にがて な「${weak.map((w) => w.char).join("」「")}」は、おうち で 大人 が ゆっくり 書いて みせ、指 で なぞって もらう と おぼえやすく なります`);
  const kinds = Object.keys(now.types).length;
  if (kinds === 1) tips.push("ひとつ の あそび が お気に入り の ようです。「きょうの おけいこ」で ほか の しゅるい にも ふれられます");
  if (now.ms / 60000 > 150) tips.push("今週 は たくさん あそびました。目 を やすめる 時間 も とって あげて ください");
  if (!tips.length) tips.push("この ちょうし です！ できた ところ を いっしょ に ほめて あげて ください");

  const card = (title, body) => `<section class="rep-card"><h3>${title}</h3>${body}</section>`;
  const li = (a) => `<ul>${a.map((x) => `<li>${x}</li>`).join("")}</ul>`;
  const diff = (a, b, unit) => b ? `（先週 ${b}${unit}）` : "";
  return `
    <p class="rep-lead">${who} の さいきん 7日 の ようす です</p>
    <div class="rep-nums">
      <div><b>${now.days}</b>日<span>べんきょう した 日${diff(now.days, prev.days, "日")}</span></div>
      <div><b>${Math.round(now.ms / 60000)}</b>分<span>あそんだ 時間${diff(0, Math.round(prev.ms / 60000), "分")}</span></div>
      <div><b>${now.n}</b>こ<span>とりくんだ もんだい${diff(0, prev.n, "こ")}</span></div>
    </div>
    ${card("🌱 できるように なったこと", li(grow))}
    ${card("⭐ よく やった もの", top.length ? li(top) : "<p>まだ ありません</p>")}
    ${card("💪 にがて と、おうち で できる こと", weak.length ? li(weak.map((w) => `${MODE_NAME[w.mode]}「${w.char}」：${w.reasons.join("・")}`)) + "<p class=\"rep-note\">「きょうの おけいこ」に 自動 で 入れて れんしゅう します</p>" : "<p>いま は とくに ありません</p>")}
    ${card("💬 ひとこと", li(tips))}
    <p class="rep-note">ひらがな：46字 のうち ${hiraDone}字 を 書きました。記録 は この 端末 の なか だけ に あり、外 には 送って いません。</p>`;
}
function showReport() {
  $("parent-menu").classList.add("hidden");
  $("report-body").innerHTML = weeklyReport();
  showScreen("report");
}

/* ---------------------------------------------------------
   保護者メニュー：歯車を2秒長押しでデータをリセット
   （子どもが間違えて押しても消えないように長押しにしています）
   --------------------------------------------------------- */
// はぐるま（.parent-gate）を 2びょう ながおし で ひらく。おしている あいだ わっか が たまる
document.querySelectorAll(".parent-gate").forEach((btn) => {
  let timer = null;
  const stop = () => { clearTimeout(timer); btn.classList.remove("holding"); };
  btn.addEventListener("pointerdown", () => {
    btn.classList.add("holding");
    timer = setTimeout(() => { stop(); openParentMenu(); }, 2000);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => btn.addEventListener(ev, stop));
  // ちょっと さわった だけ なら、ながおし の ヒント を 出す
  btn.addEventListener("click", () => {
    const h = $("gate-hint");
    h.classList.remove("hidden");
    clearTimeout(h._t);
    h._t = setTimeout(() => h.classList.add("hidden"), 2200);
  });
});

function openParentMenu() {
  const left = rewardsLeftToday();
  $("parent-info").textContent = `きょうの ごほうび：あと ${left}回（1日 ${DAILY_REWARD_LIMIT}回まで）`;
  $("parent-name").value = state.child.name || "";
  $("parent-suffix").value = state.child.suffix || "";
  $("parent-limit").value = String(state.playLimit);
  const d = ensureDaily();
  const mins = Math.round(d.playMs / 60000);
  const log = Object.entries(d.log).map(([t, n]) => `${STUDY[t] ? STUDY[t].name : t} ${n}`).join("・");
  $("parent-today").textContent = `きょう：${mins}分 あそびました。${log ? "やったこと：" + log : "まだ べんきょう は していません"}`;
  const gl = growthList();
  $("parent-growth").innerHTML = `<b>まえより できるように なったこと</b><br>${gl.map((x) => "・" + x.text).join("<br>")}`;
  $("parent-menu").classList.remove("hidden");
}
$("parent-report").onclick = () => showReport();
$("btn-report-back").onclick = () => goHome();
$("parent-close").onclick = () => $("parent-menu").classList.add("hidden");
$("parent-reward").onclick = () => {
  // 試してもらうとき用：きょうの回数を 0 にもどす
  ensureDaily();
  state.daily.rewards = 0;
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

// 保護者メニュー：おなまえ・あそぶ 時間
$("parent-name").addEventListener("change", () => {
  state.child.name = $("parent-name").value.replace(/\s/g, "").slice(0, 8);
  $("parent-name").value = state.child.name;
  saveState();
});
$("parent-suffix").addEventListener("change", () => { state.child.suffix = $("parent-suffix").value; saveState(); });
$("parent-limit").addEventListener("change", () => { state.playLimit = Number($("parent-limit").value); saveState(); });
$("parent-name-try").onclick = () => {
  state.child.name = $("parent-name").value.replace(/\s/g, "").slice(0, 8);
  saveState();
  speak(callName() ? `${callName()}、だいすき！` : "おなまえ が はいって いないよ");
};

/* ---------------------------------------------------------
   あそぶ 時間の めやす（やめどき）
   ・アプリを ひらいて いる あいだ だけ 時間を かぞえる
   ・めやす を こえたら、つぎ の べんきょう を はじめる まえ に「ひとやすみ しよう」
     （むりやり とめない。「もうすこし」で 10分 のばせる）
   --------------------------------------------------------- */
const TICK = 15000;
setInterval(() => {
  if (document.visibilityState !== "visible" || !state.petType) return;
  ensureDaily().playMs += TICK;
  const dk = state.days[todayKey()] || (state.days[todayKey()] = { n: 0, c: false });
  dk.ms = (dk.ms || 0) + TICK;   // 週 の レポート 用
  if (state.daily.playMs % 60000 === 0) saveState();
}, TICK);
function needRest() {
  if (!state.playLimit) return false;
  const d = ensureDaily();
  return d.playMs >= state.playLimit * 60000 && d.playMs >= (d.restAt || 0);
}
function showRest(onMore) {
  const d = ensureDaily();
  const who = callName();
  const g = growthToSay();
  const text = `${who ? who + "、" : ""}きょうは たくさん がんばったね！<br>そろそろ ひとやすみ しよう<span class="growth-line">${g}</span>`;
  speak(`${who ? who + "、" : ""}きょうは たくさん がんばったね！ ${g} そろそろ ひとやすみ しよう`);
  showModal(`<div class="big-pet sleepy">${makePetSVG(state.petType, state.stage)}</div>`, text, "ホームに もどる",
    () => { inCourse = false; goHome(); },
    "もうすこし やる", () => { d.restAt = d.playMs + 10 * 60000; saveState(); onMore(); });
}

/* ---------------------------------------------------------
   がんばり カレンダー：べんきょう した 日 に はなまる
   ・「きょうの おけいこ」ぜんぶ できた 日 は ほし つき
   --------------------------------------------------------- */
let calMonth = null;   // { y, m }
const HANAMARU = (() => {
  // ふちが なみなみ の まる ＋ まんなか の うずまき（てがき ふう）
  let d = "";
  const N = 10, R = 20, r = 16;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2, b = ((i + 0.5) / N) * Math.PI * 2;
    const x = 24 + Math.cos(a) * r, y = 24 + Math.sin(a) * r;
    d += i === 0 ? `M${x.toFixed(1)} ${y.toFixed(1)}` : ` Q${(24 + Math.cos(b - Math.PI / N) * R * 1.12).toFixed(1)} ${(24 + Math.sin(b - Math.PI / N) * R * 1.12).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return `<svg viewBox="0 0 48 48" class="hanamaru"><path d="${d}" fill="none" stroke="#E8604C" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M24 24 m-3 0 a3 3 0 1 1 6 0 a6 6 0 1 1 -12 0 a9 9 0 1 1 18 0" fill="none" stroke="#E8604C" stroke-width="2.4" stroke-linecap="round"/></svg>`;
})();
function renderCalendar() {
  const now = new Date();
  if (!calMonth) calMonth = { y: now.getFullYear(), m: now.getMonth() };
  const { y, m } = calMonth;
  $("cal-title").textContent = `${m + 1}がつ`;
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  let html = ["にち", "げつ", "か", "すい", "もく", "きん", "ど"].map((w, i) => `<div class="cal-week ${i === 0 ? "sun" : i === 6 ? "sat" : ""}">${w}</div>`).join("");
  for (let i = 0; i < first; i++) html += `<div class="cal-cell empty"></div>`;
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const rec = state.days[`${y}-${m + 1}-${d}`];
    const isToday = y === now.getFullYear() && m === now.getMonth() && d === now.getDate();
    if (rec && rec.n) count += 1;
    html += `<div class="cal-cell ${isToday ? "today" : ""}"><span class="cal-day">${d}</span>${rec && rec.n ? HANAMARU : ""}${rec && rec.c ? `<span class="cal-star">★</span>` : ""}</div>`;
  }
  $("cal-grid").innerHTML = html;
  const who = callName();
  $("cal-sum").textContent = count ? `${who ? who + "、" : ""}${m + 1}がつ は ${count}にち がんばったね！` : "べんきょう した ひ に はなまる が つくよ";
}
$("btn-calendar").onclick = () => {
  calMonth = null;
  renderCalendar();
  showScreen("calendar");
  const n = Object.values(state.days).filter((r) => r.n).length;
  if (n) setTimeout(() => speak($("cal-sum").textContent), 300);
};
$("btn-cal-back").onclick = () => goHome();
$("btn-cal-prev").onclick = () => { calMonth.m -= 1; if (calMonth.m < 0) { calMonth.m = 11; calMonth.y -= 1; } renderCalendar(); };
$("btn-cal-next").onclick = () => { calMonth.m += 1; if (calMonth.m > 11) { calMonth.m = 0; calMonth.y += 1; } renderCalendar(); };

/* ---------------------------------------------------------
   はじめに
   --------------------------------------------------------- */
$("icon-water").innerHTML = makeWaterSVG();
document.querySelectorAll("[data-icon]").forEach((e) => { e.innerHTML = UI_ICONS[e.dataset.icon]; });
$("icon-food").innerHTML = makeFoodSVG();

// 長押しメニューやダブルタップ拡大を防ぐ
document.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("dblclick", (e) => e.preventDefault());

if (state.petType) {
  goHome();
  // ひらいた とき の あいさつ（なまえ が あれば よぶ）
  const h = new Date().getHours();
  const greet = h < 10 ? "おはよう" : h < 17 ? "こんにちは" : "こんばんは";
  const who = callName();
  setTimeout(() => say($("bubble"), who ? `${who}、${greet}！` : `${greet}！ きょうも あそぼ`, true), 600);
} else renderSelect();

// オフラインでも動くようにする（サービスワーカー）
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
