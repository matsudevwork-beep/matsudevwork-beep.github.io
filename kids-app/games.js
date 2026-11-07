/* =========================================================
   ためしの あそび（しさく）
   ・めいろ／かず を かぞえる／てんびん／みち つなぎ／とけい
   ・どれも おわったら itemDone(しゅるい) を よぶ（ごほうび・おけいこ は app.js）
   ・すすみ は state.gameLevel[しゅるい] に 保存
   ========================================================= */
const gameArea = $("game-area");
const gameTools = $("game-tools");
const gameBubble = $("game-bubble");
let game = null;   // いまの あそび

const gLevel = (type) => state.gameLevel[type] || 0;
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const rand = (n) => Math.floor(Math.random() * n);

function startGame(type) {
  if (game && game.cleanup) game.cleanup();
  game = { type };
  gameArea.innerHTML = "";
  gameTools.innerHTML = "";
  gameArea.className = `game-area game-${type}`;
  $("game-pet").innerHTML = makePetSVG(state.petType, state.stage, true);
  showScreen("game");
  GAMES[type](game);
}

function gameDone(msg) {
  if (game.finished) return;
  game.finished = true;
  const type = game.type;
  state.gameLevel[type] = gLevel(type) + 1;
  saveState();
  say(gameBubble, msg || pick(VOICE.clear), true);
  playAnim($("game-pet"), "bounce", 600);
  setTimeout(() => itemDone(type), 1400);
}

$("btn-game-back").onclick = () => {
  if (game && game.cleanup) game.cleanup();
  goHome();
};

function svgEl(tag, attrs) {
  const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}
function toLocal(svg, e) {
  return new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
}

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
  const answer = lv < 2 ? 1 + rand(3) : 1 + rand(max);   // さいしょ は 1〜3 こ
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
      speak(NUM_WORDS[counted]);
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
        speak(NUM_WORDS[v]);
        if (v === answer) gameDone(`せいかい！ ${NUM_WORDS[answer]} こ！`);
        else {
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
   ⑦' てんびん：ひだり と おなじ かず だけ ひよこ を のせて、てんびん を まっすぐ に する
   ・したの ひよこ を さわる → みぎ の おさら に のる／おさら を さわる → 1わ おりる
   ・レベル：ひよこ どうし（1〜3 → 1〜5）→ すうじ の おもり（1〜5 → 1〜10）→ 2つ の まとまり（たしざん の まえ）
   --------------------------------------------------------- */
GAMES.balance = (g) => {
  const lv = gLevel("balance");
  const kind = lv < 3 ? "duck" : lv < 6 ? "weight" : (lv % 2 ? "two" : "weight");
  let left, parts = null;
  if (kind === "duck") left = 1 + rand(lv < 1 ? 3 : 5);
  else if (kind === "weight") left = 1 + rand(lv < 5 ? 5 : 10);
  else { parts = [1 + rand(4), 1 + rand(4)]; left = parts[0] + parts[1]; }
  let right = 0;
  g.left = left;   // たしかめ用
  g.add = () => addDuck(); g.remove = () => removeDuck();
  $("game-label").textContent = `てんびん ${lv + 1}`;

  const svg = svgEl("svg", { viewBox: "0 0 360 290", class: "balance-svg" });
  gameArea.append(svg);
  const pool = document.createElement("div");
  pool.className = "balance-pool";
  gameArea.append(pool);
  const POOL = 10;
  const drawPool = () => {
    pool.innerHTML = "";
    for (let i = 0; i < POOL - right; i++) {
      const b = document.createElement("button");
      b.className = "balance-duck";
      b.textContent = "🐤";
      b.onclick = addDuck;
      pool.append(b);
    }
  };

  let angle = 0, target = 0, raf = 0;
  const tiltOf = () => Math.max(-18, Math.min(18, (left - right) * 6));   // ひだり が おもい と ひだり が さがる
  const ducksIn = (n, cx, cy, color) => {   // おさら の うえ に ならべる（5わ で 1だん）
    let out = "";
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / 5), col = i % 5, inRow = Math.min(5, n - row * 5);
      const x = cx + (col - (inRow - 1) / 2) * 24, y = cy - 8 - row * 26;
      out += `<text x="${x}" y="${y}" text-anchor="middle" font-size="26"${color ? ` style="filter:${color}"` : ""}>🐤</text>`;
    }
    return out;
  };
  const pan = (x, y, inner, side) => `
    <g class="balance-pan" data-side="${side}">
      <line x1="${x}" y1="${y}" x2="${x - 50}" y2="${y + 70}" stroke="#C9A98A" stroke-width="3"/>
      <line x1="${x}" y1="${y}" x2="${x + 50}" y2="${y + 70}" stroke="#C9A98A" stroke-width="3"/>
      <path d="M${x - 62} ${y + 70} Q${x} ${y + 100} ${x + 62} ${y + 70} Z" fill="#F3E2C9" stroke="#8A6A4F" stroke-width="4" stroke-linejoin="round"/>
      <rect x="${x - 66}" y="${y - 10}" width="132" height="112" fill="transparent"/>
      ${inner(x, y + 72)}
    </g>`;
  const render = () => {
    const a = angle * Math.PI / 180, L = 125, cx = 180, cy = 120;
    const lx = cx - L * Math.cos(a), ly = cy + L * Math.sin(a);
    const rx = cx + L * Math.cos(a), ry = cy - L * Math.sin(a);
    const leftInner = (x, y) => {
      if (kind === "duck") return ducksIn(left, x, y);
      if (kind === "weight") return `<g><path d="M${x - 24} ${y - 4} L${x - 18} ${y - 46} H${x + 18} L${x + 24} ${y - 4} Z" fill="#8FA7B8" stroke="#5E7487" stroke-width="3" stroke-linejoin="round"/>
        <circle cx="${x}" cy="${y - 50}" r="7" fill="none" stroke="#5E7487" stroke-width="3"/>
        <text x="${x}" y="${y - 15}" text-anchor="middle" font-size="26" font-weight="800" fill="#fff">${left}</text></g>`;
      // 2つ の まとまり：きいろ と ピンク の ひよこ
      return ducksIn(parts[0], x, y, "") + ducksIn(parts[1], x, y - 28, "hue-rotate(290deg)");   // した が きいろ、うえ が ピンク
    };
    svg.innerHTML = `
      <path d="M180 120 L150 230 H210 Z" fill="#C9A98A" stroke="#8A6A4F" stroke-width="4" stroke-linejoin="round"/>
      <rect x="110" y="228" width="140" height="14" rx="7" fill="#8A6A4F"/>
      <line x1="${lx}" y1="${ly}" x2="${rx}" y2="${ry}" stroke="#8A6A4F" stroke-width="10" stroke-linecap="round"/>
      <circle cx="180" cy="120" r="9" fill="#FFD27A" stroke="#8A6A4F" stroke-width="3"/>
      ${pan(lx, ly, leftInner, "left")}
      ${pan(rx, ry, (x, y) => ducksIn(right, x, y), "right")}`;
    svg.querySelector('[data-side="right"]').onclick = removeDuck;
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
  const changed = () => {
    target = tiltOf();
    animate();
    drawPool();
    if (right === left) {
      g.finished || setTimeout(() => {
        if (right !== left || g.finished) return;
        const msg = kind === "two" ? `ぴったり！ ${NUM_WORDS[parts[0]]} と ${NUM_WORDS[parts[1]]} で ${NUM_WORDS[left]}` : `ぴったり！ おなじ ${NUM_WORDS[left]} だね`;
        gameDone(msg);
      }, 900);
    }
  };
  function addDuck() {
    if (g.finished || right >= POOL) return;
    right += 1;
    speak(NUM_WORDS[right]);
    if (right > left) say(gameBubble, "おもすぎる みたい。おさら を さわると おりるよ", true);
    changed();
  }
  function removeDuck() {
    if (g.finished || right <= 0) return;
    right -= 1;
    speak(right ? NUM_WORDS[right] : "ぜろ");
    changed();
  }
  g.cleanup = () => cancelAnimationFrame(raf);
  angle = target = tiltOf();
  render();
  drawPool();
  const first = kind === "duck" ? "ひだり と おなじ かず の ひよこ を のせて、まっすぐ に しよう"
    : kind === "weight" ? `おもり は「${left}」。ひよこ を ${NUM_WORDS[left]} わ のせよう`
    : "きいろ と ピンク、あわせて なんわ かな？ おなじ だけ のせよう";
  setTimeout(() => say(gameBubble, first, true, 4000), 300);
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
  const solved = () => {
    const G = cur();
    let r = startRow, c = 0, from = L, steps = 0;
    while (steps++ < 50) {
      const m = G[r][c];
      if (!(m & from)) return false;
      const out = m & ~from;
      if (c === N - 1 && r === goalRow && (out & R)) return true;
      if (out === U) { r--; from = D; } else if (out === D) { r++; from = U; } else if (out === R) { c++; from = L; } else if (out === L) { c--; from = R; } else return false;
      if (r < 0 || r >= N || c < 0 || c >= N) return false;
    }
    return false;
  };
  while (solved()) turns[0][0] = (turns[0][0] + 1) % 4;
  Object.assign(g, { turns, solved });   // たしかめ用

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
      if (g.finished) return;
      turns[r][c] = (turns[r][c] + 1) % 4;
      const deg = Number(t.dataset.deg) + 90;   // おなじ むき に まわりつづける
      t.dataset.deg = deg;
      t.style.transform = `rotate(${deg}deg)`;
      if (solved()) { board.classList.add("solved"); gameDone("つながった！ おうち に かえれるね"); }
    };
    board.append(t);
  }
  wrap.append(pet, board, home);
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
  const target = { h: 1 + rand(12), m: lv < 2 ? 0 : (lv < 4 ? pick([0, 30]) : 5 * rand(12)) };
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
      speak(HOUR_WORDS[now.h % 12]);
    } else {
      now.m = (Math.round(a / 30) * 5) % 60;
      say(gameBubble, now.m ? `${now.m}ふん` : "ちょうど", true);
      speak(MIN_WORDS[now.m / 5]);
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
