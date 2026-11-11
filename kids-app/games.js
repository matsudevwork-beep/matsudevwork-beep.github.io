/* =========================================================
   ためしの あそび（しさく）
   ・めいろ／かず を かぞえる／てんびん／てんつなぎ／みち つなぎ／とけい
   ・どれも おわったら itemDone(しゅるい) を よぶ（ごほうび・おけいこ は app.js）
   ・すすみ は state.gameLevel[しゅるい] に 保存
   ========================================================= */
const gameArea = $("game-area");
const gameTools = $("game-tools");
const gameBubble = $("game-bubble");
let game = null;   // いまの あそび

const gLevel = (type) => state.gameLevel[type] || 0;
// おなじ もんだい が つづけて 出ない ように（2026-11-12 代表）。make() を やりなおして、まえ と ちがう もの に する
const lastProblem = {};
function fresh(type, make, sigOf = (x) => JSON.stringify(x)) {
  let x, s;
  for (let i = 0; i < 30; i++) { x = make(); s = sigOf(x); if (s !== lastProblem[type]) break; }
  lastProblem[type] = s;
  return x;
}
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const rand = (n) => Math.floor(Math.random() * n);
const currentScreenIs = (name) => $(`screen-${name}`).classList.contains("active");

function startGame(type) {
  if (game && game.cleanup) game.cleanup();
  game = { type, t0: Date.now(), miss: 0 };   // miss：まちがい（できるように なったこと を みる）
  gameArea.innerHTML = "";
  gameTools.innerHTML = "";
  gameArea.className = `game-area game-${type}`;
  $("game-pet").innerHTML = makePetSVG(state.petType, state.stage, true);
  showScreen("game");
  GAMES[type](game);
}

// hold：ウィンドウ（つぎ へ）を 出す まで の じかん。おえかき は 絵 を ゆっくり みて ほしい ので ながく、声 が おわる まで まつ
function gameDone(msg, hold = 1400) {
  if (game.finished) return;
  game.finished = true;
  const type = game.type;
  recordItem(type, { ms: Date.now() - game.t0, miss: game.miss });
  state.gameLevel[type] = gLevel(type) + 1;
  saveState();
  say(gameBubble, withName(msg || pick(VOICE.clear), 0.3), true);
  playAnim($("game-pet"), "bounce", 600);
  const me = game;
  const go = () => { if (game === me && currentScreenIs("game")) itemDone(type); };   // とちゅう で もどったら なにも しない
  if (hold > 1400) setTimeout(() => whenQuiet(() => setTimeout(go, 1200)), hold);
  else setTimeout(go, hold);
}

$("btn-game-back").onclick = () => {
  if (game && game.cleanup) game.cleanup();
  speechStop();
  goHome();
};

function svgEl(tag, attrs) {
  const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}
function toLocal(svg, e) { return svgXY(svg, e.clientX, e.clientY); }   // app.js の svgXY（Safari でも くるわない）

const GAMES = {};

/* ---------------------------------------------------------
   ④ めいろ：●から おうち まで、ゆびで みち を たどる
   ・かべ は とおれない。もどる ときは きた みち を なぞれば OK
   ・レベル が あがると めいろ が おおきく なる
   --------------------------------------------------------- */
GAMES.maze = (g) => {
  const lv = gLevel("maze");
  const cols = Math.min(5 + Math.floor(lv / 2), 7);
  const rows = Math.min(6 + Math.floor(lv / 2), 9);
  $("game-label").textContent = `めいろ ${lv + 1}`;
  const C = 50; // 1マス

  // かべ を つくる（2026-11-07 代表：わかれみち を ふやす）
  // ・あちこち から すこしずつ ほる やりかた で、みち の とちゅう に わかれみち と いきどまり を たくさん つくる
  // ・こたえ の みち に わかれみち が すくない ときは つくりなおす
  const dirs = [[-1, 0, "n", "s"], [1, 0, "s", "n"], [0, -1, "w", "e"], [0, 1, "e", "w"]];
  const inside = (r, c) => r >= 0 && r < rows && c >= 0 && c < cols;
  const build = () => {
    const w = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ n: 1, e: 1, s: 1, w: 1 })));
    const seen = Array.from({ length: rows }, () => Array(cols).fill(false));
    const active = [[rand(rows), rand(cols)]];
    seen[active[0][0]][active[0][1]] = true;
    while (active.length) {
      // たいてい は ランダム な ばしょ から ほる（＝ わかれみち が ふえる）
      const i = Math.random() < 0.75 ? rand(active.length) : active.length - 1;
      const [r, c] = active[i];
      const nb = shuffle(dirs.slice()).filter(([dr, dc]) => inside(r + dr, c + dc) && !seen[r + dr][c + dc]);
      if (!nb.length) { active.splice(i, 1); continue; }
      const [dr, dc, d, back] = nb[0];
      w[r][c][d] = 0;
      w[r + dr][c + dc][back] = 0;
      seen[r + dr][c + dc] = true;
      active.push([r + dr, c + dc]);
    }
    return w;
  };
  const openSides = (w, r, c) => ["n", "e", "s", "w"].filter((k) => !w[r][c][k]).length;
  const solutionOf = (w) => {   // スタート から ゴール まで の みち
    const prev = { "0,0": null }, q = [[0, 0]];
    while (q.length) {
      const [r, c] = q.shift();
      if (r === rows - 1 && c === cols - 1) break;
      for (const [dr, dc, d] of dirs) {
        const k = `${r + dr},${c + dc}`;
        if (!w[r][c][d] && !(k in prev)) { prev[k] = [r, c]; q.push([r + dr, c + dc]); }
      }
    }
    const out = [];
    for (let p = [rows - 1, cols - 1]; p; p = prev[`${p[0]},${p[1]}`]) out.unshift(p);
    return out;
  };
  const needForks = Math.min(2 + lv, 5);
  let walls, forks = 0;
  for (let t = 0; t < 60; t++) {
    const w = build();
    const sol = solutionOf(w);
    // わかれみち＝ こたえ の みち の うち、ほか にも いける みち が ある ばしょ
    const f = sol.filter(([r, c], i) => openSides(w, r, c) >= (i === 0 ? 2 : 3)).length;
    if (!walls || f > forks) { walls = w; forks = f; }
    if (f >= needForks && sol.length >= rows + cols - 1) break;
  }
  const W = cols * C, H = rows * C;
  const svg = svgEl("svg", { viewBox: `-8 -8 ${W + 16} ${H + 16}`, class: "maze-svg" });
  svg.append(svgEl("rect", { x: 0, y: 0, width: W, height: H, rx: 10, fill: "#FFF8EC" }));
  const pathLine = svgEl("polyline", { points: "", fill: "none", stroke: "#FFB36B", "stroke-width": 22, "stroke-linecap": "round", "stroke-linejoin": "round" });
  svg.append(pathLine);
  let d = "";
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = c * C, y = r * C, w = walls[r][c];
    if (w.n) d += `M${x} ${y} h${C} `;
    if (w.w) d += `M${x} ${y} v${C} `;
    if (r === rows - 1 && w.s) d += `M${x} ${y + C} h${C} `;
    if (c === cols - 1 && w.e) d += `M${x + C} ${y} v${C} `;
  }
  svg.append(svgEl("path", { d, stroke: "#8A6A4F", "stroke-width": 6, "stroke-linecap": "round", fill: "none" }));
  const goal = svgEl("text", { x: W - C / 2, y: H - C / 2 + 13, "text-anchor": "middle", "font-size": 34 });
  goal.textContent = "🏠";
  svg.append(goal);
  const token = svgEl("circle", { r: 15, fill: "#FF8A5B", stroke: "#fff", "stroke-width": 4 });
  svg.append(token);
  gameArea.append(svg);

  const path = [[0, 0]];
  Object.assign(g, { walls, rows, cols, C, svg, forks });   // たしかめ用
  const center = ([r, c]) => [c * C + C / 2, r * C + C / 2];
  const draw = () => {
    pathLine.setAttribute("points", path.map((p) => center(p).join(",")).join(" "));
    const [x, y] = center(path[path.length - 1]);
    token.setAttribute("cx", x); token.setAttribute("cy", y);
  };
  draw();
  const open = ([r, c], [rr, cc]) => {
    if (rr === r - 1 && cc === c) return !walls[r][c].n;
    if (rr === r + 1 && cc === c) return !walls[r][c].s;
    if (cc === c - 1 && rr === r) return !walls[r][c].w;
    if (cc === c + 1 && rr === r) return !walls[r][c].e;
    return false;
  };
  let active = false;
  svg.classList.add("draw-surface");   // ゆび で かく ばしょ（app.js の タッチ の はし わたし）
  svg.addEventListener("pointerdown", (e) => {
    const p = toLocal(svg, e);
    const [x, y] = center(path[path.length - 1]);
    if (Math.hypot(p.x - x, p.y - y) > C * 0.8) { say(gameBubble, "●を さわって すすもう"); return; }
    active = true;
    try { svg.setPointerCapture(e.pointerId); } catch (err) {}
  });
  svg.addEventListener("pointermove", (e) => {
    if (!active || g.finished) return;
    const p = toLocal(svg, e);
    const cell = [Math.floor(p.y / C), Math.floor(p.x / C)];
    if (cell[0] < 0 || cell[0] >= rows || cell[1] < 0 || cell[1] >= cols) return;
    const cur = path[path.length - 1];
    if (cell[0] === cur[0] && cell[1] === cur[1]) return;
    const prev = path[path.length - 2];
    if (prev && prev[0] === cell[0] && prev[1] === cell[1]) { path.pop(); draw(); return; }  // もどる
    if (open(cur, cell)) {
      path.push(cell); draw();
      if (cell[0] === rows - 1 && cell[1] === cols - 1) gameDone("ゴール！ おうちに ついたね");
    } else {
      const now = Date.now();
      g.miss += 1;
      if (now - (g.lastWall || 0) > 1500) { g.lastWall = now; say(gameBubble, "かべ だよ。ほかの みち を さがそう", true); }
    }
  });
  const end = () => { active = false; };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  setTimeout(() => say(gameBubble, "●を うごかして おうち まで いこう", true, 3000), 300);
};

/* ---------------------------------------------------------
   ⑦ かず を かぞえる：ひとつずつ さわって かぞえて、かず を えらぶ
   --------------------------------------------------------- */
const NUM_WORDS = ["", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう", "じゅう"];
GAMES.count = (g) => {
  const lv = gLevel("count");
  const max = lv < 5 ? 5 : 10;
  const answer = fresh("count", () => lv < 2 ? 1 + rand(3) : 1 + rand(max));   // さいしょ は 1〜3 こ
  const item = pick(["🍎", "🍓", "🐟", "🌸", "⭐", "🐤", "🍙", "🚗"]);
  $("game-label").textContent = `かず ${lv + 1}`;
  const box = document.createElement("div");
  box.className = "count-items";
  let counted = 0;
  for (let i = 0; i < answer; i++) {
    const b = document.createElement("button");
    b.className = "count-item";
    b.innerHTML = `<span class="count-emoji">${item}</span><span class="count-num"></span>`;
    b.onclick = () => {
      if (b.classList.contains("on") || g.finished) return;
      counted += 1;
      b.classList.add("on");
      b.querySelector(".count-num").textContent = counted;
      speak(NUM_WORDS[counted], true);
      if (counted === answer) setTimeout(showChoices, 700);
    };
    box.append(b);
  }
  gameArea.append(box);
  const choiceBox = document.createElement("div");
  choiceBox.className = "count-choices hidden";
  gameArea.append(choiceBox);

  function showChoices() {
    say(gameBubble, "いくつ あった？", true, 4000);
    const opts = new Set([answer]);
    while (opts.size < 3) { const v = 1 + rand(max); opts.add(v); }
    choiceBox.innerHTML = "";
    shuffle([...opts]).forEach((v) => {
      const c = document.createElement("button");
      c.className = "count-choice";
      c.textContent = v;
      c.onclick = () => {
        if (g.finished) return;
        speak(NUM_WORDS[v], true);
        if (v === answer) gameDone(`せいかい！ ${countWord(answer, "こ")}！`);
        else {
          g.miss += 1;
          say(gameBubble, "もういちど かぞえて みよう", true);
          counted = 0;
          box.querySelectorAll(".count-item").forEach((x) => { x.classList.remove("on"); x.querySelector(".count-num").textContent = ""; });
          choiceBox.classList.add("hidden");
        }
      };
      choiceBox.append(c);
    });
    choiceBox.classList.remove("hidden");
  }
  setTimeout(() => say(gameBubble, `${item} を ひとつずつ さわって かぞえよう`, true, 3000), 300);
};

/* ---------------------------------------------------------
   ⑦' てんびん：ひだり の 大きな すうじ と おなじ かず だけ、あいぼう（レベル1 の すがた）を みぎ の おさら に のせる
   ・したの あいぼう を ゆび で つかんで、みぎ の おさら に はこぶ（ドラッグ＆ドロップ）
   ・おさら の あいぼう を つかんで そと に だす と おりる
   ・レベル：すうじ 1〜3 → 1〜5 → 1〜10（2026-11-07 代表：ひだり は すうじ）
   --------------------------------------------------------- */
GAMES.balance = (g) => {
  const lv = gLevel("balance");
  const left = fresh("balance", () => 1 + rand(lv < 2 ? 3 : lv < 5 ? 5 : 10));
  let right = 0;
  g.left = left;   // たしかめ用
  $("game-label").textContent = `てんびん ${lv + 1}`;
  // みぎ に のせる のは あいぼう の レベル1 の すがた（2026-11-09 代表）
  const kind = state.petType || "animal";
  const tokSrc = `img/${kind}-01.png`;
  const [tw, th] = PET_IMAGES[kind][0];
  const unit = { animal: "ひき", car: "だい", veggie: "ほん" }[kind] || "こ";
  const nm = petName();
  const tokImg = () => `<img src="${tokSrc}" alt="" draggable="false">`;

  const svg = svgEl("svg", { viewBox: "0 0 360 320", class: "balance-svg" });
  gameArea.append(svg);
  const pool = document.createElement("div");
  pool.className = "balance-pool";
  gameArea.append(pool);
  const POOL = 10;

  let angle = 0, target = 0, raf = 0;
  const tiltOf = () => Math.max(-18, Math.min(18, (left - right) * 6));   // ひだり が おもい と ひだり が さがる
  const ducksIn = (n, cx, cy) => {   // おさら の うえ に ならべる（5こ で 1だん）
    let out = "";
    const H = 34, W = H * tw / th;
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / 5), col = i % 5, inRow = Math.min(5, n - row * 5);
      const x = cx + (col - (inRow - 1) / 2) * 25;
      out += `<image href="${tokSrc}" x="${x - W / 2}" y="${cy - 4 - H - row * 30}" width="${W}" height="${H}"/>`;
    }
    return out;
  };
  const DROP = 90;   // おさら を つる ひも の ながさ（たて に 大きく）
  const pan = (x, y, inner, side) => `
    <g class="balance-pan" data-side="${side}">
      <line x1="${x}" y1="${y}" x2="${x - 50}" y2="${y + DROP}" stroke="#C9A98A" stroke-width="3"/>
      <line x1="${x}" y1="${y}" x2="${x + 50}" y2="${y + DROP}" stroke="#C9A98A" stroke-width="3"/>
      <path d="M${x - 62} ${y + DROP} Q${x} ${y + DROP + 30} ${x + 62} ${y + DROP} Z" fill="#F3E2C9" stroke="#8A6A4F" stroke-width="4" stroke-linejoin="round"/>
      <rect class="pan-hit" x="${x - 70}" y="${y - 20}" width="140" height="${DROP + 55}" fill="transparent"/>
      ${inner(x, y + DROP + 2)}
    </g>`;
  // ひだり は 立体 の 大きな すうじ（おもり の 絵 は やめた。2026-11-09 代表）
  const weight = (x, y) => {
    // 2026-11-12 代表：2ばい くらい に。2けた は はば が ある ので すこし ちいさく、はし で きれない ところ に よせる
    const fs = left >= 10 ? 112 : 170, half = (left >= 10 ? 1.15 : 0.6) * fs / 2;
    const cx = Math.max(x, half + 4);
    const t = (dy, attrs) => `<text x="${cx}" y="${y - 2 + dy}" text-anchor="middle" font-size="${fs}" font-weight="800" ${attrs}>${left}</text>`;
    let side = "";
    for (let d = 7; d >= 1; d--) side += t(d, 'fill="#B4562E"');   // あつみ（下 に かさねて 立体 に）
    return `<g class="balance-num">${t(9, 'fill="rgba(0,0,0,.18)"')}${side}${t(0, 'fill="#FF8A4C" stroke="#fff" stroke-width="3" paint-order="stroke"')}</g>`;
  };
  const render = () => {
    const a = angle * Math.PI / 180, L = 116, cx = 180, cy = 120;
    const lx = cx - L * Math.cos(a), ly = cy + L * Math.sin(a);
    const rx = cx + L * Math.cos(a), ry = cy - L * Math.sin(a);
    svg.innerHTML = `
      <path d="M180 120 L150 280 H210 Z" fill="#C9A98A" stroke="#8A6A4F" stroke-width="4" stroke-linejoin="round"/>
      <rect x="110" y="278" width="140" height="14" rx="7" fill="#8A6A4F"/>
      <line x1="${lx}" y1="${ly}" x2="${rx}" y2="${ry}" stroke="#8A6A4F" stroke-width="10" stroke-linecap="round"/>
      <circle cx="180" cy="120" r="9" fill="#FFD27A" stroke="#8A6A4F" stroke-width="3"/>
      ${pan(lx, ly, weight, "left")}
      ${pan(rx, ry, (x, y) => ducksIn(right, x, y), "right")}`;
    svg.querySelector('[data-side="right"]').classList.toggle("hover", !!g.overPan);
  };
  const animate = () => {
    cancelAnimationFrame(raf);
    const step = () => {
      angle += (target - angle) * 0.18;
      if (Math.abs(target - angle) < 0.2) angle = target;
      render();
      if (angle !== target) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };
  const drawPool = () => {
    pool.innerHTML = "";
    for (let i = 0; i < POOL - right; i++) {
      const b = document.createElement("div");
      b.className = "balance-duck";
      b.innerHTML = tokImg();
      pool.append(b);
    }
  };
  const changed = () => {
    target = tiltOf();
    animate();
    drawPool();
    if (right === left) {
      setTimeout(() => {
        if (right !== left || g.finished) return;
        gameDone(`ぴったり！ ${NUM_WORDS[left]} と ${NUM_WORDS[left]} で おなじ だね`);
      }, 900);
    }
  };
  function addDuck() {
    if (g.finished || right >= POOL) return;
    right += 1;
    speak(NUM_WORDS[right], true);
    if (right > left) { g.miss += 1; say(gameBubble, `おもすぎる みたい。おさら の ${nm} を そと に だそう`, true); }
    changed();
  }
  function removeDuck() {
    if (g.finished || right <= 0) return;
    right -= 1;
    speak(right ? NUM_WORDS[right] : "ぜろ", true);
    changed();
  }
  g.add = addDuck; g.remove = removeDuck;   // たしかめ用

  // ---- ドラッグ＆ドロップ ----
  let drag = null;   // { from: "pool" | "pan", el, id }
  const overRightPan = (e) => {
    const hitBox = svg.querySelector('[data-side="right"] .pan-hit');
    if (!hitBox) return false;
    const b = hitBox.getBoundingClientRect();
    return e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom;
  };
  const moveFloat = (e) => { const [x, y] = appXY(e.clientX, e.clientY); drag.el.style.transform = `translate(${x - 26}px, ${y - 30}px) scale(1.15)`; };
  const startDrag = (e, from) => {
    if (g.finished || drag) return;
    e.preventDefault();
    const el = document.createElement("div");
    el.className = "balance-float";
    el.innerHTML = tokImg();
    $("app").append(el);
    drag = { from, el, id: e.pointerId };
    if (from === "pan") { right -= 1; target = tiltOf(); animate(); }   // おさら から もちあげた
    else pool.lastElementChild && pool.lastElementChild.remove();
    moveFloat(e);
  };
  pool.addEventListener("pointerdown", (e) => { if (e.target.closest(".balance-duck")) startDrag(e, "pool"); });
  svg.addEventListener("pointerdown", (e) => {
    if (e.target.closest('[data-side="right"]') && right > 0) startDrag(e, "pan");
  });
  const onMove = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    moveFloat(e);
    const over = overRightPan(e);
    if (over !== !!g.overPan) { g.overPan = over; render(); }
  };
  const onUp = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const over = overRightPan(e);
    const from = drag.from;
    drag.el.remove();
    drag = null;
    g.overPan = false;
    if (over) {
      if (from === "pan") { right += 1; changed(); }      // おなじ おさら に もどした
      else addDuck();
    } else if (from === "pan") {
      right += 1; removeDuck();                            // そと に だした ＝ おりる
    } else {
      drawPool();                                          // おさら に とどかなかった
    }
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  g.cleanup = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    if (drag) drag.el.remove();
  };
  angle = target = tiltOf();
  render();
  drawPool();
  setTimeout(() => say(gameBubble, `「${left}」と おなじ だけ、${nm} を ${countWord(left, unit)} みぎ の おさら に のせよう`, true, 4000), 300);
};

/* ---------------------------------------------------------
   ⑦'' てんつなぎ：1 → 2 → 3 … と じゅんばん に てん を つなぐと、え が できあがる（2026-11-07 代表）
   ・ゆび で なぞって つなぐ（つぎ の てん を さわる だけ でも OK）
   ・レベル：1〜5 → 1〜13 → じょうきゅう 1〜20
   --------------------------------------------------------- */
const numWord = (n) => n <= 10 ? NUM_WORDS[n] : n < 20 ? "じゅう" + NUM_WORDS[n - 10] : "にじゅう";
// ハート：20こ の てん（くぼみ と さき が かさならない ように 手で おいた）
const heartPts = [[178, 62], [215, 45], [255, 55], [282, 88], [288, 130], [272, 172], [245, 205], [213, 235], [182, 260], [150, 284],
  [118, 260], [87, 235], [55, 205], [28, 172], [12, 130], [18, 88], [45, 55], [85, 45], [122, 62], [150, 95]];
// え の データ（300×300 の なか）。さいご の てん の あと は 1 に もどって できあがり
const DOT_PICS = [
  [ // 1〜5、1〜7
    { name: "おうち", fill: "#F7C08A", pts: [[60, 260], [60, 140], [150, 50], [240, 140], [240, 260]],
      deco: `<rect x="128" y="190" width="44" height="70" rx="6" fill="#B07A50"/><rect x="80" y="160" width="36" height="34" rx="4" fill="#BFE3F5" stroke="#fff" stroke-width="4"/><rect x="184" y="160" width="36" height="34" rx="4" fill="#BFE3F5" stroke="#fff" stroke-width="4"/>` },
    { name: "おほしさま", fill: "#FFD45C", pts: [[150, 30], [222, 262], [34, 118], [266, 118], [78, 262]],
      deco: `<circle cx="132" cy="160" r="6" fill="#5A4636"/><circle cx="168" cy="160" r="6" fill="#5A4636"/><path d="M136 182 Q150 194 164 182" stroke="#5A4636" stroke-width="4" fill="none" stroke-linecap="round"/>` },
    { name: "ヨット", fill: "#8FC1E3", pts: [[150, 40], [230, 190], [260, 200], [215, 262], [85, 262], [40, 200], [150, 200]],
      deco: `<path d="M150 40 L230 190 H150 Z" fill="#fff"/><path d="M0 285 Q25 270 50 285 T100 285 T150 285 T200 285 T250 285 T300 285" stroke="#5FA8D3" stroke-width="6" fill="none"/>` },
  ],
  [ // 1〜10、1〜13
    { name: "おさかな", fill: "#FF9E7A", pts: [[30, 150], [90, 95], [170, 90], [225, 135], [285, 90], [270, 150], [285, 210], [225, 165], [170, 210], [90, 205]],
      deco: `<circle cx="82" cy="138" r="10" fill="#fff"/><circle cx="84" cy="139" r="5" fill="#5A4636"/><path d="M140 110 Q160 150 140 190" stroke="#fff" stroke-width="5" fill="none" opacity=".7"/>` },
    { name: "ちょうちょ", fill: "#C9A6E8", pts: [[150, 80], [210, 40], [265, 70], [240, 145], [270, 215], [205, 250], [150, 190], [95, 250], [30, 215], [60, 145], [35, 70], [90, 40]],
      deco: `<rect x="140" y="70" width="20" height="150" rx="10" fill="#8A6A4F"/><circle cx="210" cy="100" r="16" fill="#FFE07A"/><circle cx="90" cy="100" r="16" fill="#FFE07A"/><circle cx="215" cy="200" r="11" fill="#FFE07A"/><circle cx="85" cy="200" r="11" fill="#FFE07A"/>` },
    { name: "ねこ", fill: "#FFD9A8", pts: [[70, 40], [115, 95], [185, 95], [230, 40], [250, 120], [260, 170], [240, 225], [195, 258], [150, 265], [105, 258], [60, 225], [40, 170], [50, 120]],
      deco: `<circle cx="115" cy="160" r="9" fill="#5A4636"/><circle cx="185" cy="160" r="9" fill="#5A4636"/><path d="M142 190 L158 190 L150 200 Z" fill="#E9824C"/><path d="M150 200 Q140 214 128 208 M150 200 Q160 214 172 208" stroke="#5A4636" stroke-width="3" fill="none"/><path d="M60 190 H105 M62 205 L105 198 M240 190 H195 M238 205 L195 198" stroke="#8A6A4F" stroke-width="3" stroke-linecap="round"/>` },
  ],
  [ // じょうきゅう：1〜18、1〜20
    { name: "ハート", fill: "#FF8FA3", pts: heartPts,
      deco: `<path d="M60 90 Q75 68 100 72" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round" opacity=".8"/>` },
    { name: "ロケット", fill: "#E8EEF3", pts: [[150, 20], [185, 70], [196, 130], [196, 170], [240, 215], [245, 272], [198, 245], [180, 250], [165, 285], [150, 262], [135, 285], [120, 250], [102, 245], [55, 272], [60, 215], [104, 170], [104, 130], [115, 70]],
      deco: `<circle cx="150" cy="125" r="22" fill="#8FC1E3" stroke="#5E7487" stroke-width="5"/><path d="M135 255 L150 290 L165 255 Z" fill="#FFB938"/><path d="M150 20 L185 70 H115 Z" fill="#FF8A5B"/>` },
  ],
];
GAMES.dots = (g) => {
  const lv = gLevel("dots");
  const tier = lv < 3 ? 0 : lv < 6 ? 1 : 2;
  const pic = DOT_PICS[tier][lv % DOT_PICS[tier].length];
  const n = pic.pts.length;
  $("game-label").textContent = `てんつなぎ 1〜${n}`;
  const R = tier === 2 ? 14 : 17;
  const svg = svgEl("svg", { viewBox: "-25 -25 350 350", class: "dots-svg" });
  const fillLayer = svgEl("g", { class: "dots-pic" }), inkLayer = svgEl("g", {}), dotLayer = svgEl("g", {});
  // うすい みち（2026-11-07 代表：みち を うすく かいて おく）
  const guide = svgEl("polygon", { points: pic.pts.map((p) => p.join(",")).join(" "), fill: "none", stroke: "#F1E2CC",
    "stroke-width": 16, "stroke-linejoin": "round" });
  svg.append(guide, fillLayer, inkLayer, dotLayer);
  gameArea.append(svg);
  const dots = pic.pts.map(([x, y], i) => {
    const d = svgEl("g", { class: "dot" });
    const ring = svgEl("circle", { cx: x, cy: y, r: R + 8, fill: "none", stroke: "#FF8A5B", "stroke-width": 3, class: "dot-ring" });
    const c = svgEl("circle", { cx: x, cy: y, r: R, fill: "#fff", stroke: "#8A6A4F", "stroke-width": 3 });
    const t = svgEl("text", { x, y: y + (tier === 2 ? 5 : 6), "text-anchor": "middle", "font-size": tier === 2 ? 15 : 18, "font-weight": 800, fill: "#5A4636" });
    t.textContent = i + 1;
    d.append(ring, c, t);
    dotLayer.append(d);
    return { g: d, c, x, y };
  });
  // step：つないだ かず。0〜n-1 は その ばんごう の てん、n は さいご に 1 へ もどる
  let step = 0, ink = null;
  const targetIdx = () => (step === n ? 0 : step);
  const lastIdx = () => step - 1;
  Object.assign(g, { pic, next: () => step });   // たしかめ用
  const mark = () => dots.forEach((d, i) => {
    d.g.classList.toggle("next", step <= n && i === targetIdx());
    d.c.setAttribute("fill", i < step ? "#FFD27A" : "#fff");
  });
  mark();
  const hit = (p) => {
    const t = dots[targetIdx()];
    if (Math.hypot(t.x - p.x, t.y - p.y) < R + 14) return targetIdx();   // つぎ の てん を ゆうせん
    let best = -1, bd = R + 14;
    dots.forEach((d, i) => { const dd = Math.hypot(d.x - p.x, d.y - p.y); if (dd < bd) { bd = dd; best = i; } });
    return best;
  };
  // かいた とおり の せん（まっすぐ に なおさない）
  const startInk = (d) => {
    ink = { pts: [[d.x, d.y]], el: svgEl("polyline", { fill: "none", stroke: "#FF8A5B", "stroke-width": 7, "stroke-linecap": "round", "stroke-linejoin": "round" }) };
    inkLayer.append(ink.el);
  };
  const addInk = (p) => {
    const q = ink.pts[ink.pts.length - 1];
    if (Math.hypot(q[0] - p.x, q[1] - p.y) < 2) return;
    ink.pts.push([Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]);
    ink.el.setAttribute("points", ink.pts.map((x) => x.join(",")).join(" "));
  };
  const connect = () => {
    const i = targetIdx();
    step += 1;
    if (step <= n) speak(numWord(i + 1), true);
    mark();
    if (step === n) say(gameBubble, "さいご は 1 に もどろう", true);
    if (step === n + 1) complete();
  };
  const complete = () => {
    ink = null;
    const poly = svgEl("polygon", { points: pic.pts.map((p) => p.join(",")).join(" "), fill: pic.fill });
    const deco = svgEl("g", {});
    deco.innerHTML = pic.deco;
    fillLayer.append(poly, deco);
    svg.classList.add("complete");   // え が じわっ と うかびあがる（style.css）
    speak(`${pic.name}！`);
    setTimeout(() => gameDone(`${pic.name} が できたよ！`), 2600);
  };
  const wrongTap = () => {
    g.miss += 1;
    const now = Date.now();
    if (now - (g.lastWrong || 0) < 1500) return;
    g.lastWrong = now;
    const t = targetIdx() + 1;
    say(gameBubble, `つぎ は ${t} だよ`, true);
    speak(`つぎ は ${numWord(t)}`, true);
  };
  svg.classList.add("draw-surface");   // ゆび で かく ばしょ（app.js の タッチ の はし わたし）
  svg.addEventListener("pointerdown", (e) => {
    if (g.finished || step > n) return;
    const p = toLocal(svg, e);
    const i = hit(p);
    if (step === 0 && i === 0) { connect(); startInk(dots[0]); }
    else if (step > 0 && i === targetIdx() && i !== lastIdx()) { startInk(dots[lastIdx()]); addInk(p); connect(); if (step <= n) startInk(dots[lastIdx()]); }
    else if (step > 0 && i === lastIdx()) startInk(dots[i]);      // さいご に つないだ てん から つづき
    else if (i >= 0) { wrongTap(); return; }
    else return;
    try { svg.setPointerCapture(e.pointerId); } catch (err) {}
  });
  svg.addEventListener("pointermove", (e) => {
    if (!ink || g.finished) return;
    const p = toLocal(svg, e);
    addInk(p);
    if (hit(p) === targetIdx()) {
      const t = dots[targetIdx()];
      addInk(t);
      connect();
      if (step <= n) startInk(t);   // つぎ の せん は ここ から
    }
  });
  const end = () => { ink = null; };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  setTimeout(() => say(gameBubble, "1 から じゅんばん に てん を つなごう。なに が できるかな？", true, 4000), 300);
};

/* ---------------------------------------------------------
   ②' おてほん なしで かく（AIせんせい・2026-11-07 しさく）
   ・うえ の おてほん を みながら、ます の なか に じぶん で かく（なぞる みち は ない）
   ・「できた！」で、ブラウザ の なか の AI（ai/reader.js）が どの 字 に みえるか を よむ
   ・よめたら はなまる。よめなくても 2かいめ までに しっぱい を つづけない（3かいめ は がんばり を ほめて おわり）
   --------------------------------------------------------- */
GAMES.free = (g) => {
  const lv = gLevel("free");
  // なぞり で かいた こと が ある 字 から じゅんばん に（なければ ひらがな の じゅん）
  const learned = HIRAGANA.filter((h) => state.firsts[`hira:${h.char}`]).map((h) => h.char);
  const list = learned.length >= 3 ? learned : HIRAGANA.map((h) => h.char);
  const target = list[lv % list.length];
  g.target = target;
  $("game-label").textContent = `おてほん なしで「${target}」`;
  const model = document.createElement("div");
  model.className = "free-model";
  model.innerHTML = `<span class="free-model-cap">おてほん</span><span class="free-model-char">${target}</span>`;
  gameArea.append(model);
  const svg = svgEl("svg", { viewBox: "0 0 300 300", class: "free-svg" });
  svg.innerHTML = `<rect x="4" y="4" width="292" height="292" rx="18" fill="#fff" stroke="#E6D3B8" stroke-width="4"/>
    <path d="M150 14 V286 M14 150 H286" stroke="#EADBC4" stroke-width="3" stroke-dasharray="8 10"/>`;
  const inkLayer = svgEl("g", {});
  svg.append(inkLayer);
  gameArea.append(svg);
  let strokes = [], cur = null, tries = 0;
  const btnErase = document.createElement("button");
  btnErase.className = "sub-btn erase-btn";
  btnErase.innerHTML = `<span class="btn-icon">${UI_ICONS.eraser}</span>けす`;
  const btnDone = document.createElement("button");
  btnDone.className = "big-btn";
  btnDone.textContent = "できた！";
  gameTools.append(btnErase, btnDone);
  const clear = () => { strokes = []; inkLayer.innerHTML = ""; };
  btnErase.onclick = () => { if (!g.finished) clear(); };
  svg.classList.add("draw-surface");   // ゆび で かく ばしょ（app.js の タッチ の はし わたし）
  svg.addEventListener("pointerdown", (e) => {
    if (g.finished) return;
    const p = toLocal(svg, e);
    cur = { pts: [{ x: p.x, y: p.y }], el: svgEl("polyline", { fill: "none", stroke: "#5A4636", "stroke-width": 14, "stroke-linecap": "round", "stroke-linejoin": "round" }) };
    inkLayer.append(cur.el);
    strokes.push(cur.pts);
    try { svg.setPointerCapture(e.pointerId); } catch (err) {}
  });
  svg.addEventListener("pointermove", (e) => {
    if (!cur) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    (evs.length ? evs : [e]).forEach((ev) => { const p = toLocal(svg, ev); cur.pts.push({ x: p.x, y: p.y }); });
    cur.el.setAttribute("points", cur.pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "));
  });
  const end = () => { cur = null; };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  g.strokes = () => strokes;   // たしかめ用

  const stamp = (txt) => {
    if (txt === "hanamaru") {   // てがき ふう の はなまる（app.js の HANAMARU）
      const gEl = svgEl("g", { class: "free-stamp" });
      gEl.innerHTML = HANAMARU;
      const inner = gEl.firstElementChild;
      Object.entries({ x: 196, y: 6, width: 96, height: 96 }).forEach(([k, v]) => inner.setAttribute(k, v));
      svg.append(gEl);
      return;
    }
    const t = svgEl("text", { x: 250, y: 70, "text-anchor": "middle", "font-size": 64, "font-weight": 800, fill: "#E8604C", class: "free-stamp" });
    t.textContent = txt;
    svg.append(t);
  };
  btnDone.onclick = () => {
    if (g.finished) return;
    if (!strokes.length) { say(gameBubble, `ます の なか に「${target}」を かいてね`, true); return; }
    const res = AIReader.ready ? AIReader.read(strokes) : [];
    const rank = res.findIndex((r) => r.char === target);
    const p = rank >= 0 ? res[rank].p : 0;
    g.lastRead = res.slice(0, 3);   // たしかめ用
    if (!AIReader.ready || rank === 0) {
      stamp("hanamaru");
      gameDone(`はなまる！ AIせんせい も「${target}」って よめたよ！`);
    } else if (rank <= 2 && p >= 0.08 && res[0].char !== "?") {
      stamp("◎");
      gameDone(`「${target}」に みえるよ！ じょうず！`);
    } else if (tries < 2) {
      tries += 1;
      g.miss += 1;
      say(gameBubble, "おしい！ おてほん を よく みて、もういちど かいて みよう", true);
      clear();
    } else {
      stamp("○");
      gameDone("さいご まで がんばったね！ つぎ は きっと かけるよ");
    }
  };
  setTimeout(() => say(gameBubble, `おてほん を みて「${target}」を かいて みよう`, true, 3500), 300);
};

/* ---------------------------------------------------------
   ⑤ みち つなぎ：パネル を さわって まわし、あいぼう から おうち まで みち を つなぐ
   ・みち の でぐち：うえ1 みぎ2 した4 ひだり8
   --------------------------------------------------------- */
GAMES.road = (g) => {
  const lv = gLevel("road");
  const N = lv < 3 ? 3 : 4;
  $("game-label").textContent = `みち つなぎ ${lv + 1}`;
  const U = 1, R = 2, D = 4, L = 8;
  const rot = (m) => ((m << 1) | (m >> 3)) & 15;   // みぎ に 90ど

  // ひだり の いりぐち から みぎ の でぐち まで の みち を つくる
  let route;
  const startRow = rand(N);
  for (let tries = 0; tries < 200 && !route; tries++) {
    const p = [[startRow, 0]];
    const seen = new Set([`${startRow},0`]);
    while (p.length < 40) {
      const [r, c] = p[p.length - 1];
      if (c === N - 1 && Math.random() < 0.5) break;
      const nb = shuffle([[r - 1, c], [r + 1, c], [r, c + 1]]).filter(([rr, cc]) => rr >= 0 && rr < N && cc < N && !seen.has(`${rr},${cc}`));
      if (!nb.length) break;
      p.push(nb[0]); seen.add(`${nb[0][0]},${nb[0][1]}`);
    }
    if (p[p.length - 1][1] === N - 1) route = p;
  }
  const dirTo = ([r, c], [rr, cc]) => (rr < r ? U : rr > r ? D : cc > c ? R : L);
  const grid = Array.from({ length: N }, () => Array(N).fill(0));
  route.forEach((cell, i) => {
    const a = i === 0 ? L : dirTo(cell, route[i - 1]);
    const b = i === route.length - 1 ? R : dirTo(cell, route[i + 1]);
    grid[cell[0]][cell[1]] = a | b;
  });
  const shapes = [U | D, U | R];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!grid[r][c]) grid[r][c] = pick(shapes);
  const goalRow = route[route.length - 1][0];
  // ばらばら に まわしておく（さいしょ から つながって いたら もういちど）
  const turns = grid.map((row) => row.map(() => rand(4)));
  const cur = () => grid.map((row, r) => row.map((m, c) => { let x = m; for (let k = 0; k < turns[r][c]; k++) x = rot(x); return x; }));
  // つながって いたら、とおる ます の ならび を かえす（つながって いなければ null）
  const routeNow = () => {
    const G = cur();
    let r = startRow, c = 0, from = L, steps = 0;
    const cells = [];
    while (steps++ < 50) {
      const m = G[r][c];
      if (!(m & from)) return null;
      cells.push([r, c]);
      const out = m & ~from;
      if (c === N - 1 && r === goalRow && (out & R)) return cells;
      if (out === U) { r--; from = D; } else if (out === D) { r++; from = U; } else if (out === R) { c++; from = L; } else if (out === L) { c--; from = R; } else return null;
      if (r < 0 || r >= N || c < 0 || c >= N) return null;
    }
    return null;
  };
  const solved = () => !!routeNow();
  while (solved()) turns[0][0] = (turns[0][0] + 1) % 4;
  Object.assign(g, { turns, solved, routeNow });   // たしかめ用

  const wrap = document.createElement("div");
  wrap.className = "road-wrap";
  wrap.style.setProperty("--n", N);
  const pet = document.createElement("div");
  pet.className = "road-end road-start";
  pet.style.gridRow = startRow + 1;
  pet.innerHTML = makePetSVG(state.petType, state.stage, true);
  const home = document.createElement("div");
  home.className = "road-end road-goal";
  home.style.gridRow = goalRow + 1;
  home.textContent = "🏠";
  const board = document.createElement("div");
  board.className = "road-board";
  const tileSVG = (m) => {
    const seg = [];
    if (m & U) seg.push("M50 50 V0");
    if (m & R) seg.push("M50 50 H100");
    if (m & D) seg.push("M50 50 V100");
    if (m & L) seg.push("M50 50 H0");
    return `<svg viewBox="0 0 100 100"><path d="${seg.join(" ")}" stroke="#C9A98A" stroke-width="40" stroke-linecap="round" fill="none"/>
      <path d="${seg.join(" ")}" stroke="#fff" stroke-width="5" stroke-dasharray="9 9" fill="none"/></svg>`;
  };
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const t = document.createElement("button");
    t.className = "road-tile";
    t.innerHTML = tileSVG(grid[r][c]);
    t.style.transform = `rotate(${turns[r][c] * 90}deg)`;
    t.dataset.deg = turns[r][c] * 90;
    t.onclick = () => {
      if (g.finished || g.walking) return;
      turns[r][c] = (turns[r][c] + 1) % 4;
      const deg = Number(t.dataset.deg) + 90;   // おなじ むき に まわりつづける
      t.dataset.deg = deg;
      t.style.transform = `rotate(${deg}deg)`;
      const cells = routeNow();
      if (cells) { board.classList.add("solved"); g.walking = true; setTimeout(() => walkHome(cells), 350); }
    };
    board.append(t);
  }
  wrap.append(pet, board, home);
  // つながったら、あいぼう が みち を とおって おうち まで あるく（2026-11-07 代表）
  function walkHome(cells) {
    const [bx, by] = appPos(wrap);
    const mid = (el) => { const [x, y] = appCenter(el); return [x - bx, y - by]; };
    const pts = [mid(pet), ...cells.map(([r, c]) => mid(board.children[r * N + c])), mid(home)];
    const walker = document.createElement("div");
    walker.className = "road-walker";
    walker.innerHTML = `<div class="road-walker-bob">${makePetSVG(state.petType, state.stage, true)}</div>`;
    wrap.append(walker);
    pet.style.visibility = "hidden";
    const frames = pts.map(([x, y], i) => ({ transform: `translate(${x - 23}px, ${y - 23}px)`, offset: i / (pts.length - 1) }));
    say(gameBubble, "とことこ…", true);
    const anim = walker.animate(frames, { duration: 450 * (pts.length - 1), easing: "linear", fill: "forwards" });
    g.walkAnim = anim;   // たしかめ用
    anim.onfinish = () => { home.classList.add("arrived"); gameDone("ついた！ おうち に かえれたね"); };
  }
  gameArea.append(wrap);
  setTimeout(() => say(gameBubble, "パネル を さわって まわして、おうち まで みち を つなげよう", true, 3500), 300);
};

/* ---------------------------------------------------------
   ⑧ とけい：みじかい はり を うごかすと「〇じ」、ながい はり を うごかすと 5ふん きざみ で「〇ふん」
   ・もんだい の じかん に あわせたら できあがり
   ・しさく：みじかい はり は ちょうど の じ に とまる（ほんもの は ふん に あわせて すこし すすむ）
   --------------------------------------------------------- */
const HOUR_WORDS = ["じゅうにじ", "いちじ", "にじ", "さんじ", "よじ", "ごじ", "ろくじ", "しちじ", "はちじ", "くじ", "じゅうじ", "じゅういちじ"];
const MIN_WORDS = ["ちょうど", "ごふん", "じゅっぷん", "じゅうごふん", "にじゅっぷん", "にじゅうごふん", "さんじゅっぷん",
  "さんじゅうごふん", "よんじゅっぷん", "よんじゅうごふん", "ごじゅっぷん", "ごじゅうごふん"];
GAMES.clock = (g) => {
  const lv = gLevel("clock");
  const target = fresh("clock", () => ({ h: 1 + rand(12), m: lv < 2 ? 0 : (lv < 4 ? pick([0, 30]) : 5 * rand(12)) }));
  const now = { h: (target.h + 3 + rand(6)) % 12 || 12, m: (target.m + 15) % 60 };
  g.target = target;   // たしかめ用
  const timeText = (h, m) => `${h}じ${m ? ` ${m}ふん` : ""}`;
  const timeWord = (h, m) => `${HOUR_WORDS[h % 12]}${m ? " " + MIN_WORDS[m / 5] : ""}`;
  $("game-label").textContent = `とけい「${timeText(target.h, target.m)}」に しよう`;

  const svg = svgEl("svg", { viewBox: "-160 -160 320 320", class: "clock-svg" });
  svg.append(svgEl("circle", { r: 150, fill: "#FFF8EC", stroke: "#8A6A4F", "stroke-width": 8 }));
  for (let i = 0; i < 60; i++) {
    const a = i * 6 * Math.PI / 180, big = i % 5 === 0;
    svg.append(svgEl("line", { x1: Math.sin(a) * (big ? 126 : 132), y1: -Math.cos(a) * (big ? 126 : 132), x2: Math.sin(a) * 140, y2: -Math.cos(a) * 140,
      stroke: "#C9A98A", "stroke-width": big ? 4 : 2, "stroke-linecap": "round" }));
  }
  for (let h = 1; h <= 12; h++) {
    const a = h * 30 * Math.PI / 180;
    const t = svgEl("text", { x: Math.sin(a) * 104, y: -Math.cos(a) * 104 + 11, "text-anchor": "middle", "font-size": 30, "font-weight": 800, fill: "#5A4636" });
    t.textContent = h;
    svg.append(t);
  }
  const hourHand = svgEl("line", { x1: 0, y1: 0, x2: 0, y2: -66, stroke: "#E9824C", "stroke-width": 14, "stroke-linecap": "round" });
  const minHand = svgEl("line", { x1: 0, y1: 0, x2: 0, y2: -112, stroke: "#5FA8D3", "stroke-width": 9, "stroke-linecap": "round" });
  svg.append(minHand, hourHand, svgEl("circle", { r: 10, fill: "#8A6A4F" }));
  gameArea.append(svg);
  const legend = document.createElement("div");
  legend.className = "clock-legend";
  legend.innerHTML = `<span><i class="hh"></i>みじかい はり＝〇じ</span><span><i class="mh"></i>ながい はり＝〇ふん</span>`;
  gameArea.append(legend);

  const hourAngle = () => (now.h % 12) * 30;
  const minAngle = () => now.m * 6;
  const draw = (ha = hourAngle(), ma = minAngle()) => {
    hourHand.setAttribute("transform", `rotate(${ha})`);
    minHand.setAttribute("transform", `rotate(${ma})`);
  };
  draw();
  const angleOf = (p) => (Math.atan2(p.x, -p.y) * 180 / Math.PI + 360) % 360;
  let dragging = null;
  svg.classList.add("draw-surface");   // ゆび で かく ばしょ（app.js の タッチ の はし わたし）
  svg.addEventListener("pointerdown", (e) => {
    if (g.finished) return;
    const p = toLocal(svg, e);
    const a = angleOf(p), dist = Math.hypot(p.x, p.y);
    const diff = (x) => Math.min(Math.abs(a - x), 360 - Math.abs(a - x));
    // はり の さき に ちかい ほう を つかむ（ながさ と むき で きめる）
    const scoreH = diff(hourAngle()) + Math.abs(dist - 60) * 0.6;
    const scoreM = diff(minAngle()) + Math.abs(dist - 105) * 0.6;
    dragging = scoreH <= scoreM ? "h" : "m";
    try { svg.setPointerCapture(e.pointerId); } catch (err) {}
  });
  svg.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const a = angleOf(toLocal(svg, e));
    if (dragging === "h") draw(a, minAngle()); else draw(hourAngle(), a);
  });
  const release = (e) => {
    if (!dragging) return;
    const a = angleOf(toLocal(svg, e));
    if (dragging === "h") {
      now.h = Math.round(a / 30) % 12 || 12;
      say(gameBubble, `${now.h}じ`, true);
      speak(HOUR_WORDS[now.h % 12], true);
    } else {
      now.m = (Math.round(a / 30) * 5) % 60;
      say(gameBubble, now.m ? `${now.m}ふん` : "ちょうど", true);
      speak(MIN_WORDS[now.m / 5], true);
    }
    dragging = null;
    draw();
    if (now.h === target.h && now.m === target.m) {
      setTimeout(() => gameDone(`せいかい！ ${timeWord(target.h, target.m)}`), 900);
    }
  };
  svg.addEventListener("pointerup", release);
  svg.addEventListener("pointercancel", () => { dragging = null; draw(); });
  setTimeout(() => say(gameBubble, `はり を うごかして ${timeText(target.h, target.m)} に しよう`, true, 3500), 300);
};
