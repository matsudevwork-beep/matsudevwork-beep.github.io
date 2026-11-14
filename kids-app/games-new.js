/* =========================================================
   2026-11-08 しんさく の あそび（しさく）
   ・おえかき（2さい から。てくび を つかう）／たしざん・ひきざん／プログラミング／えいご の ことば
   ・アルファベット を かく は なぞり（app.js の startTrace("abc")、データ は alphabet.js）
   ・しくみ は games.js と おなじ（startGame → GAMES[しゅるい] → gameDone）
   ========================================================= */

/* ---------------------------------------------------------
   おえかき：お題 の 絵 に、みほん を みて から じゆう に かく
   ・ねらい：ペン（ゆび）に なれる、てくび を まわす・ふる・とんとん する
   ・上手 か どうか は 判定 しない。かけば かならず ほめる
   ・2さい むけ：線 は ふとく、さいしょ の 1本 の ゆび だけ（てのひら が ふれても かかない）
   --------------------------------------------------------- */
const lerp = (a, b, t) => a + (b - a) * t;
// ぐるぐる を ならべた 線（cx,cy を まんなか に、半径 R の 円 の a0〜a1 に そって n かい まわる）
function loopsOnArc(cx, cy, R, a0, a1, n, r) {
  const pts = [];
  for (let i = 0; i <= n * 24; i++) {
    const t = i / (n * 24), th = lerp(a0, a1, t), a = t * n * Math.PI * 2;
    pts.push([cx + R * Math.cos(th) + r * Math.sin(a), cy + R * Math.sin(th) - r * Math.cos(a)]);
  }
  return [pts];
}
function zigzagOnArc(cx, cy, r1, r2, a0, a1, teeth) {
  const pts = [];
  for (let i = 0; i <= teeth * 2; i++) {
    const th = lerp(a0, a1, i / (teeth * 2)), R = i % 2 ? r2 : r1;
    pts.push([cx + R * Math.cos(th), cy + R * Math.sin(th)]);
  }
  return [pts];
}
const DRAW_TOPICS = [
  { key: "hair", motion: "ぐるぐる", color: "#6B4A33", ask: "おともだち に かみのけ を かいてね",
    base: `<circle cx="180" cy="245" r="92" fill="#FFE3C8" stroke="#C99A72" stroke-width="4"/>
      <circle cx="148" cy="240" r="9" fill="#4A3428"/><circle cx="212" cy="240" r="9" fill="#4A3428"/>
      <circle cx="128" cy="270" r="12" fill="#FFB9A8" opacity=".7"/><circle cx="232" cy="270" r="12" fill="#FFB9A8" opacity=".7"/>
      <path d="M155 282 Q180 302 205 282" fill="none" stroke="#4A3428" stroke-width="5" stroke-linecap="round"/>
      <path class="draw-hint" d="M82 225 A100 100 0 0 1 278 225"/>`,
    demo: () => loopsOnArc(180, 245, 100, Math.PI * 1.08, Math.PI * 1.92, 7, 20),
    done: "ぐるぐる じょうず！ すてきな かみのけ だね" },
  { key: "leaf", motion: "ぐるぐる", color: "#49B36A", ask: "き に はっぱ を いっぱい かいてね",
    base: `<path d="M163 395 V235 Q163 215 150 200 M197 395 V235 Q197 215 210 200" fill="none" stroke="#8A6A4F" stroke-width="6"/>
      <rect x="163" y="230" width="34" height="165" fill="#B48A64"/>
      <path d="M180 260 L140 205 M180 250 L222 198 M180 230 V180" stroke="#8A6A4F" stroke-width="8" stroke-linecap="round"/>
      <rect x="0" y="390" width="360" height="10" fill="#C9DFA6"/>
      <circle class="draw-hint" cx="180" cy="160" r="98"/>`,
    demo: () => loopsOnArc(180, 160, 62, 0, Math.PI * 2, 9, 24),
    done: "はっぱ が いっぱい！ げんきな き に なったね" },
  { key: "rain", motion: "ちょんちょん", color: "#3C9BE0", ask: "くも から あめ を ふらせてね",
    base: `<g fill="#fff" stroke="#BFC9D6" stroke-width="4"><circle cx="125" cy="100" r="42"/><circle cx="185" cy="78" r="56"/><circle cx="245" cy="102" r="42"/></g>
      <rect x="95" y="100" width="180" height="42" fill="#fff"/><path d="M90 142 H280" stroke="#BFC9D6" stroke-width="4"/>
      <text x="180" y="385" text-anchor="middle" font-size="58">🐸</text>
      <rect class="draw-hint" x="70" y="165" width="220" height="150" rx="20"/>`,
    demo: () => [110, 155, 200, 245, 135, 180, 225, 270].map((x, i) => [[x, i < 4 ? 175 : 245], [x - 6, i < 4 ? 210 : 280]]),
    done: "ざあざあ あめ が ふってきた！ かえる さん が よろこんでるよ" },
  { key: "mane", motion: "ギザギザ", color: "#E9824C", ask: "ライオン に たてがみ を かいてね",
    base: `<circle cx="180" cy="225" r="64" fill="#FFD36B" stroke="#C9963A" stroke-width="4"/>
      <circle cx="157" cy="215" r="7" fill="#4A3428"/><circle cx="203" cy="215" r="7" fill="#4A3428"/>
      <path d="M170 240 H190 L180 252 Z" fill="#8A5A3B"/><path d="M180 252 Q170 265 160 258 M180 252 Q190 265 200 258" fill="none" stroke="#8A5A3B" stroke-width="4" stroke-linecap="round"/>
      <circle class="draw-hint" cx="180" cy="225" r="100"/>`,
    demo: () => zigzagOnArc(180, 225, 76, 112, -Math.PI / 2, Math.PI * 1.5, 16),
    done: "ギザギザ かっこいい！ つよそうな ライオン だね" },
  { key: "grass", motion: "たて の せん", color: "#49B36A", ask: "じめん に くさ を はやしてね",
    base: `<rect x="0" y="320" width="360" height="80" fill="#C99E73"/><path d="M0 320 H360" stroke="#8A6A4F" stroke-width="4"/>
      <text x="300" y="380" text-anchor="middle" font-size="40">🐞</text><text x="70" y="120" text-anchor="middle" font-size="54">☀️</text>
      <rect class="draw-hint" x="30" y="220" width="300" height="100" rx="16"/>`,
    demo: () => [50, 85, 120, 155, 190, 225, 260, 295].map((x) => [[x, 318], [x + 4, 255]]),
    done: "くさ が ぐんぐん のびたね！" },
  { key: "wave", motion: "なみなみ", color: "#3C9BE0", ask: "うみ に なみ を かいてね",
    base: `<rect x="0" y="150" width="360" height="250" fill="#DDF1FB"/><text x="250" y="330" font-size="44">🐟</text>
      <text x="90" y="135" font-size="56">⛵</text>
      <rect class="draw-hint" x="20" y="170" width="320" height="200" rx="16"/>`,
    demo: () => [205, 265].map((y) => Array.from({ length: 41 }, (_, i) => [30 + i * 7.5, y + 16 * Math.sin(i / 40 * Math.PI * 6)])),
    done: "なみなみ じょうず！ おさかな が およいでる みたい" },
];

GAMES.draw = (g) => {
  const lv = gLevel("draw");
  const topic = DRAW_TOPICS[lv % DRAW_TOPICS.length];
  g.topic = topic.key;
  $("game-label").textContent = `おえかき ・ ${topic.motion}`;
  const svg = svgEl("svg", { viewBox: "0 0 360 400", class: "draw-svg" });
  const base = svgEl("g", { class: "draw-base" });
  base.innerHTML = topic.base;
  const ink = svgEl("g", { class: "draw-ink" });
  const demoLayer = svgEl("g", { class: "draw-demo" });
  svg.append(svgEl("rect", { x: 0, y: 0, width: 360, height: 400, rx: 20, fill: "#fff" }), base, ink, demoLayer);
  gameArea.append(svg);

  // いろ（3〜4しょく。1タップ で かえる）
  const colors = [topic.color, "#E8604C", "#F2B84B", "#3C9BE0", "#49B36A"].filter((c, i, a) => a.indexOf(c) === i).slice(0, 4);
  let color = colors[0];
  const pal = document.createElement("div");
  pal.className = "draw-palette";
  colors.forEach((c, i) => {
    const b = document.createElement("button");
    b.className = "draw-color" + (i ? "" : " on");
    b.style.background = c;
    b.setAttribute("aria-label", "いろ");
    b.onclick = () => { color = c; pal.querySelectorAll(".draw-color").forEach((x) => x.classList.toggle("on", x === b)); };
    pal.append(b);
  });
  gameArea.append(pal);

  const btnAgain = document.createElement("button");
  btnAgain.className = "sub-btn";
  btnAgain.textContent = "▶ みほん";
  const btnDone = document.createElement("button");
  btnDone.className = "big-btn";
  btnDone.textContent = "できた！";
  gameTools.append(btnAgain, btnDone);

  // みほん：あいぼう が ゆっくり かいて みせる → きえる
  let demoing = false;
  const playDemo = () => {
    demoing = true;
    clearTimeout(g.demoTimer);
    demoLayer.getAnimations().forEach((x) => x.cancel());   // まえ の「きえる」を とりけす
    demoLayer.innerHTML = "";
    const strokes = topic.demo();
    const each = Math.max(450, 4200 / strokes.length);   // 2さい に みえる はやさ
    say(gameBubble, "みててね！", true, 1500);
    strokes.forEach((pts, i) => {
      const p = svgEl("polyline", { points: pts.map((q) => q.join(",")).join(" "), fill: "none", stroke: topic.color, "stroke-width": 12, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0.85 });
      demoLayer.append(p);
      const len = p.getTotalLength();
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
      p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: each, delay: 300 + i * each, fill: "forwards", easing: "ease-in-out" });
    });
    const total = 300 + strokes.length * each;
    g.demoTimer = setTimeout(() => {
      demoLayer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, fill: "forwards" });
      setTimeout(() => { demoLayer.innerHTML = ""; demoing = false; }, 700);
      say(gameBubble, `こんどは ${callName() || "きみ"} の ばん！ ${topic.ask}`, true, 3500);
    }, total + 500);
  };
  // とちゅう で かきはじめたら、みほん は おしまい（2026-11-08 代表）
  const stopDemo = () => {
    clearTimeout(g.demoTimer);
    demoLayer.getAnimations().forEach((x) => x.cancel());
    demoLayer.querySelectorAll("polyline").forEach((p) => p.getAnimations().forEach((x) => x.cancel()));
    demoLayer.innerHTML = "";
    demoing = false;
  };
  btnAgain.onclick = () => { if (!demoing && !g.finished) playDemo(); };

  // かく（さいしょ の 1本 の ゆび だけ）
  let cur = null, pid = null, inkLen = 0;
  svg.classList.add("draw-surface");   // ゆび で かく ばしょ（app.js の タッチ の はし わたし）
  svg.addEventListener("pointerdown", (e) => {
    if (g.finished || pid !== null) return;
    if (demoing) { stopDemo(); say(gameBubble, "いいね！ じゆう に かいてね", true, 2000); }
    pid = e.pointerId;
    const p = toLocal(svg, e);
    cur = { pts: [[p.x, p.y]], el: svgEl("polyline", { fill: "none", stroke: color, "stroke-width": 16, "stroke-linecap": "round", "stroke-linejoin": "round" }) };
    cur.el.setAttribute("points", `${p.x},${p.y} ${p.x + 0.1},${p.y}`);
    ink.append(cur.el);
    try { svg.setPointerCapture(e.pointerId); } catch (err) {}
  });
  svg.addEventListener("pointermove", (e) => {
    if (!cur || e.pointerId !== pid) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    (evs.length ? evs : [e]).forEach((ev) => {
      const p = toLocal(svg, ev);
      const last = cur.pts[cur.pts.length - 1];
      inkLen += Math.hypot(p.x - last[0], p.y - last[1]);
      cur.pts.push([p.x, p.y]);
    });
    cur.el.setAttribute("points", cur.pts.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" "));
  });
  const end = (e) => { if (e.pointerId === pid) { cur = null; pid = null; } };
  svg.addEventListener("pointerup", end);
  svg.addEventListener("pointercancel", end);
  g.inkLen = () => inkLen;   // たしかめ用

  btnDone.onclick = () => {
    if (g.finished) return;
    if (demoing) stopDemo();
    if (inkLen < 80) { say(gameBubble, "もうすこし かいて みよう！", true); return; }
    base.classList.add("cheer");
    ink.classList.add("cheer");
    svg.classList.add("done");
    gameDone(withName(topic.done, 0.5), 3500);   // 2026-11-08 代表：絵 が うごく の を みてから
  };
  g.cleanup = () => clearTimeout(g.demoTimer);
  setTimeout(() => { if (game === g) playDemo(); }, 400);
};

/* ---------------------------------------------------------
   たしざん・ひきざん：おはなし で かず を かんがえる
   ・あわせて いくつ：「ひよこ が 2わ。1わ きたよ。ぜんぶで なんわ？」
   ・のこり いくつ：「りんご が 3こ。しょべるん が 1こ たべたよ。のこりは？」
   ・レベル：5まで の たしざん → 5まで の たしざん・ひきざん → 10まで（しき も 出す）
   ・こたえ の あと は かならず しき を みせる（2 ＋ 1 ＝ 3）
   --------------------------------------------------------- */
const CALC_ADD = [["🐤", "わ", "ひよこ"], ["🐟", "ひき", "おさかな"], ["🐞", "ひき", "てんとうむし"], ["🐰", "ひき", "うさぎ"]];
const CALC_SUB = [["🍎", "こ", "りんご"], ["🍓", "こ", "いちご"], ["🍪", "まい", "クッキー"], ["🍙", "こ", "おにぎり"]];
GAMES.calc = (g) => {
  const lv = gLevel("calc");
  const max = lv < 6 ? 5 : 10;
  const [sub, a, b] = fresh("calc", () => {
    const sub = lv >= 3 && Math.random() < 0.5;
    let a, b;
    if (sub) { a = 2 + rand(max - 1); b = 1 + rand(Math.min(a - 1, lv < 6 ? 2 : 5)); }
    else { a = 1 + rand(lv < 6 ? 3 : 6); b = 1 + rand(Math.min(max - a, lv < 6 ? 2 : 4)); }
    return [sub, a, b];
  });
  const answer = sub ? a - b : a + b;
  const [icon, unit, nm] = pick(sub ? CALC_SUB : CALC_ADD);
  const showEq = lv >= 6;
  Object.assign(g, { a, b, sub, answer });   // たしかめ用
  $("game-label").textContent = `${sub ? "ひきざん" : "たしざん"} ${lv + 1}`;

  const box = document.createElement("div");
  box.className = "calc-items";
  const eq = document.createElement("div");
  eq.className = "calc-eq" + (showEq ? "" : " hidden");
  eq.textContent = `${a} ${sub ? "−" : "＋"} ${b} ＝ ？`;
  const choiceBox = document.createElement("div");
  choiceBox.className = "count-choices hidden";
  gameArea.append(eq, box, choiceBox);

  let counted = 0;
  const addItem = (cls) => {
    const it = document.createElement("button");
    it.className = "count-item calc-item " + (cls || "");
    it.innerHTML = `<span class="count-emoji">${icon}</span><span class="count-num"></span>`;
    it.onclick = () => {   // さわって かぞえられる
      if (it.classList.contains("on") || it.classList.contains("eaten") || g.finished) return;
      counted += 1;
      it.classList.add("on");
      it.querySelector(".count-num").textContent = counted;
      speak(NUM_WORDS[counted], true);
    };
    box.append(it);
    return it;
  };
  const resetCount = () => {
    counted = 0;
    box.querySelectorAll(".calc-item").forEach((x) => { x.classList.remove("on"); x.querySelector(".count-num").textContent = ""; });
  };
  for (let i = 0; i < a; i++) addItem();
  const T = [];
  const later = (ms, fn) => T.push(setTimeout(() => { if (game === g && !g.finished) fn(); }, ms));
  g.cleanup = () => T.forEach(clearTimeout);
  // 声 が おわってから つぎ へ（とちゅう で きれない ように）。音 なし でも minMs は まつ
  const afterTalk = (minMs, fn) => later(minMs, () => whenQuiet(() => later(300, fn)));

  say(gameBubble, `${nm} が ${countWord(a, unit)} ${sub ? "あるよ" : "いるよ"}`, true, 2600);
  afterTalk(1600, () => {
    if (sub) {
      const items = [...box.querySelectorAll(".calc-item")].slice(-b);
      items.forEach((x, i) => setTimeout(() => x.classList.add("eaten"), i * 350));
      say(gameBubble, `${petName()} が ${countWord(b, unit)} たべたよ。もぐもぐ`, true, 2600);
      playAnim($("game-pet"), "bounce", 600);
    } else {
      for (let i = 0; i < b; i++) setTimeout(() => addItem("fly-in"), i * 350);
      say(gameBubble, `${countWord(b, unit)} きたよ！`, true, 2400);
    }
    afterTalk(1400, askStep);
  });
  const ask = sub ? `のこりは ${askWord(unit)}？` : `ぜんぶで ${askWord(unit)}？`;
  const askStep = () => {
    say(gameBubble, `${ask} さわって かぞえても いいよ`, true, 4000);
    const opts = new Set([answer]);
    while (opts.size < 3) opts.add(rand(max + 1));
    shuffle([...opts]).forEach((v) => {
      const c = document.createElement("button");
      c.className = "count-choice";
      c.textContent = v;
      c.onclick = () => {
        if (g.finished) return;
        speak(NUM_WORDS[v] || "ゼロ", true);
        if (v === answer) {
          eq.textContent = `${a} ${sub ? "−" : "＋"} ${b} ＝ ${answer}`;
          eq.classList.remove("hidden");
          eq.classList.add("solved");
          gameDone(`せいかい！ ${NUM_WORDS[a]} ${sub ? "ひく" : "たす"} ${NUM_WORDS[b]} は ${NUM_WORDS[answer] || "ゼロ"}！`);
        } else {
          g.miss += 1;
          resetCount();
          say(gameBubble, `おしい！ ${icon} を ひとつずつ さわって かぞえて みよう`, true);
          box.classList.remove("hint"); void box.offsetWidth; box.classList.add("hint");
        }
      };
      choiceBox.append(c);
    });
    choiceBox.classList.remove("hidden");
  };
};

/* ---------------------------------------------------------
   プログラミング：やじるし の ブロック を ドラッグ で ならべて「スタート」。あいぼう が その とおり に うごく
   ・めあて（おやつ）に むけて、じゅんばん（指示）を くみたてる 力
   ・ぶつかったら とちゅう で とまって「どこ を なおす？」。まちがえた カード が ひかる
   ・レベル：カード 1まい → 2〜3まい → いわ を よける → 「くりかえし（×2）」カード → 「✋ もつ」で おやつ を おうち に とどける
   ・がめん：ひだり に マス目、みぎ に ばんごう つき の プログラム（さわると その ぎょう を けす）
   --------------------------------------------------------- */
const CODE_DIRS = { up: [-1, 0, "⬆️", "うえ"], right: [0, 1, "➡️", "みぎ"], down: [1, 0, "⬇️", "した"], left: [0, -1, "⬅️", "ひだり"] };
GAMES.code = (g) => {
  const lv = gLevel("code");
  const n = lv < 2 ? 3 : lv < 5 ? 4 : 5;
  const L = [1, 2, 3, 3, 4, 5, 6, 6][Math.min(lv, 7)];
  const rockN = lv < 3 ? 0 : Math.min(2 + lv - 3, n + 1);
  const useLoop = lv >= 5;
  const carry = lv >= 6;   // じょうきゅう：とちゅう で おやつ を「もつ」→ おうち に とどける
  $("game-label").textContent = `おやつ とどけ ${lv + 1}`;

  // もんだい を つくる（いわ が あって も いちばん ちかい みち が L ほ）
  const key = (r, c) => `${r},${c}`;
  const inside = (r, c) => r >= 0 && r < n && c >= 0 && c < n;
  const bfs = (s, goal, rocks) => {
    const dist = { [key(...s)]: 0 }, q = [s];
    while (q.length) {
      const [r, c] = q.shift();
      if (r === goal[0] && c === goal[1]) return dist[key(r, c)];
      for (const [dr, dc] of Object.values(CODE_DIRS)) {
        const k = key(r + dr, c + dc);
        if (inside(r + dr, c + dc) && !rocks.has(k) && !(k in dist)) { dist[k] = dist[key(r, c)] + 1; q.push([r + dr, c + dc]); }
      }
    }
    return Infinity;
  };
  let start, goal, item = null, rocks = new Set();
  for (let t = 0; t < 400; t++) {
    start = [rand(n), rand(n)];
    const path = [start], seen = new Set([key(...start)]);
    let ok = true;
    for (let i = 0; i < L; i++) {
      const [r, c] = path[path.length - 1];
      const nb = shuffle(Object.values(CODE_DIRS).slice()).filter(([dr, dc]) => inside(r + dr, c + dc) && !seen.has(key(r + dr, c + dc)));
      if (!nb.length) { ok = false; break; }
      path.push([r + nb[0][0], c + nb[0][1]]);
      seen.add(key(...path[path.length - 1]));
    }
    if (!ok) continue;
    goal = path[path.length - 1];
    const k = Math.ceil(L / 2);
    item = carry ? path[k] : null;
    rocks = new Set();
    const free = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!seen.has(key(r, c))) free.push(key(r, c));
    shuffle(free).slice(0, rockN).forEach((x) => rocks.add(x));
    if (key(...start) + ">" + key(...goal) === lastProblem.code && t < 300) continue;   // おなじ もんだい が つづかない ように
    if (carry ? bfs(start, item, rocks) === k && bfs(item, goal, rocks) === L - k : bfs(start, goal, rocks) === L) break;
  }
  lastProblem.code = key(...start) + ">" + key(...goal);
  Object.assign(g, { n, L, start, goal, item, rocks });   // たしかめ用

  // ---- がめん（2026-11-09 代表のイメージ）：マス目 ｜ ばんごう つき の プログラム ｜ ブロック ----
  // ブロック は ドラッグ＆ドロップ で プログラム に いれる（すきな ばしょ に はさめる）。
  // プログラム の ブロック を ごみばこ（か そと）に はこぶ と けせる。さわる だけ でも いちばん した に たせる
  const wrap = document.createElement("div");
  wrap.className = "code-wrap";
  const board = document.createElement("div");
  board.className = "code-board";
  board.style.setProperty("--n", n);
  const cellAt = {};
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const cell = document.createElement("div");
    cell.className = "code-cell" + ((r + c) % 2 ? " alt" : "");
    if (rocks.has(key(r, c))) cell.innerHTML = partHTML("code-rock");
    if (r === start[0] && c === start[1]) cell.classList.add("start");
    if (r === goal[0] && c === goal[1]) { cell.innerHTML = partHTML(carry ? "code-home" : "code-snack"); cell.classList.add("goal"); }
    if (item && r === item[0] && c === item[1]) { cell.innerHTML = partHTML("code-snack"); cell.classList.add("item"); }
    cellAt[key(r, c)] = cell;
    board.append(cell);
  }
  const walker = document.createElement("div");
  walker.className = "code-walker";
  walker.innerHTML = makePetSVG(state.petType, state.stage, true) + `<span class="code-hold">${partHTML("code-snack")}</span>`;
  board.append(walker);

  const side = document.createElement("div");
  side.className = "code-side";
  const runBtn = document.createElement("button");
  runBtn.className = "code-run";
  runBtn.innerHTML = "▶ スタート";
  const progEl = document.createElement("ol");
  progEl.className = "code-program";
  side.append(runBtn, progEl);

  const palette = document.createElement("div");
  palette.className = "code-palette";
  const trash = document.createElement("div");
  trash.className = "code-trash";
  trash.innerHTML = `<img class="code-icon-img" src="img/code-icons/trash.svg" alt="">`;
  wrap.append(board, side, palette);
  gameArea.append(wrap);

  let pos = start.slice(), holding = false;
  const place = (p, instant) => {
    walker.style.transition = instant ? "none" : "";
    walker.style.left = `${(p[1] + 0.5) / n * 100}%`;
    walker.style.top = `${(p[0] + 0.5) / n * 100}%`;
  };
  const setHold = (v) => {
    holding = v;
    walker.classList.toggle("holding", v);
    if (item) cellAt[key(...item)].classList.toggle("taken", v);
  };
  place(pos, true);

  // ---- ブロック ----
  const WORD = { up: "うえ", down: "した", left: "ひだり", right: "みぎ", take: "もつ", loop: "くりかえし" };
  // 2026-11-14 代表：矢印・手・くりかえし は 単色の シンプルな アイコン（フリー素材 MDI・Apache-2.0）に
  const blockHTML = (dir, times = 1) => `<span class="code-block b-${dir}"><img class="code-icon-img" src="img/code-icons/${dir}.svg" alt="">${times > 1 ? `<small>×${times}</small>` : ""}</span>`;
  const maxSlots = Math.min(L + (carry ? 4 : 3), 10);
  const prog = [];
  const render = () => {
    progEl.innerHTML = "";
    for (let i = 0; i < maxSlots; i++) {
      const s = document.createElement("li");
      s.className = "code-slot" + (prog[i] ? " filled" : "");
      s.dataset.i = i;
      s.innerHTML = `<b>${i + 1}</b>` + (prog[i] ? blockHTML(prog[i].dir, prog[i].times) : "");
      progEl.append(s);
    }
  };
  const kinds = ["up", "down", "left", "right"].concat(carry ? ["take"] : [], useLoop ? ["loop"] : []);
  kinds.forEach((d) => {
    const b = document.createElement("div");
    b.className = "code-pal";
    b.dataset.dir = d;
    b.setAttribute("aria-label", WORD[d]);
    b.innerHTML = blockHTML(d);
    palette.append(b);
  });
  palette.append(trash);
  render();

  const btnClear = document.createElement("button");
  btnClear.className = "sub-btn";
  btnClear.textContent = "ぜんぶ けす";
  btnClear.onclick = () => { if (!running) { prog.length = 0; render(); } };
  gameTools.append(btnClear);

  // ---- ドラッグ＆ドロップ ----
  let drag = null;   // { dir, times, from: "pal" | "prog", el, id, x0, y0, moved }
  const inRect = (el, x, y, pad = 0) => { const b = el.getBoundingClientRect(); return x >= b.left - pad && x <= b.right + pad && y >= b.top - pad && y <= b.bottom + pad; };
  // ゆび の 高さ から、なんばんめ に はさむ か
  const dropIndex = (y) => {
    const filled = [...progEl.querySelectorAll(".code-slot.filled")];
    let i = 0;
    for (const s of filled) { const b = s.getBoundingClientRect(); if (y > b.top + b.height / 2) i += 1; }
    return Math.min(i, prog.length);
  };
  const showMark = (x, y) => {
    progEl.querySelectorAll(".code-slot").forEach((s) => s.classList.remove("drop-here", "loop-here"));
    trash.classList.toggle("over", !!drag && inRect(trash, x, y, 6));
    if (!drag || !drag.moved || !inRect(side, x, y, 10)) return;
    if (drag.dir === "loop") {   // くりかえし は ブロック の うえ に かさねる
      const t = [...progEl.querySelectorAll(".code-slot.filled")].find((s) => inRect(s, x, y, 2));
      if (t) t.classList.add("loop-here");
      return;
    }
    const slot = progEl.children[Math.min(dropIndex(y), maxSlots - 1)];
    if (slot) slot.classList.add("drop-here");
  };
  const moveGhost = (e) => { const [x, y] = appXY(e.clientX, e.clientY); drag.el.style.transform = `translate(${x - 40}px, ${y - 26}px)`; };
  const addAt = (i, dir, times = 1) => {
    if (prog.length >= maxSlots) { say(gameBubble, "ブロック が いっぱい だよ。いらない ブロック を ごみばこ へ", true); return false; }
    prog.splice(i, 0, { dir, times });
    return true;
  };
  const tapAdd = (dir) => {
    if (dir === "loop") {
      const last = prog[prog.length - 1];
      if (!last || last.dir === "take") { say(gameBubble, "くりかえし は やじるし の ブロック に かさねてね", true); return; }
      last.times = last.times >= 3 ? 1 : last.times + 1;
      speak(`${last.times}かい`, true);
    } else if (addAt(prog.length, dir)) speak(WORD[dir], true);
    render();
  };
  const onDown = (e) => {
    if (running || g.finished || drag) return;
    const pal = e.target.closest(".code-pal");
    const slot = e.target.closest(".code-slot.filled");
    if (!pal && !slot) return;
    e.preventDefault();
    let dir, times = 1, from;
    if (pal) { dir = pal.dataset.dir; from = "pal"; }
    else { const i = +slot.dataset.i; ({ dir, times } = prog[i]); from = "prog"; drag = { idx: i }; }
    const el = document.createElement("div");
    el.className = "code-ghost";
    el.innerHTML = blockHTML(dir, times);
    $("app").append(el);
    drag = Object.assign(drag || {}, { dir, times, from, el, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false });
    el.style.visibility = "hidden";
    moveGhost(e);
  };
  const onMove = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8) {
      drag.moved = true;
      drag.el.style.visibility = "";
      if (drag.from === "prog") { prog.splice(drag.idx, 1); render(); }   // もちあげた
      speak(WORD[drag.dir], true);
    }
    if (!drag.moved) return;
    moveGhost(e);
    showMark(e.clientX, e.clientY);
  };
  const onUp = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    d.el.remove();
    showMark(-1, -1);
    if (!d.moved) { if (d.from === "pal") tapAdd(d.dir); else say(gameBubble, "けす ときは ごみばこ へ はこんでね", true); return; }
    const x = e.clientX, y = e.clientY;
    if (inRect(side, x, y, 10) && !inRect(trash, x, y, 6)) {
      if (d.dir === "loop") {
        const t = [...progEl.querySelectorAll(".code-slot.filled")].find((s) => inRect(s, x, y, 2));
        const p = t && prog[+t.dataset.i];
        if (p && p.dir !== "take") { p.times = p.times >= 3 ? 1 : p.times + 1; speak(`${p.times}かい`, true); }
        else say(gameBubble, "くりかえし は やじるし の ブロック に かさねてね", true);
      } else addAt(dropIndex(y), d.dir, d.times);
    } else if (d.from === "prog") speak("けしたよ", true);
    render();
  };
  wrap.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);

  let running = false;
  const T = [];
  g.cleanup = () => {
    T.forEach(clearTimeout);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    if (drag) drag.el.remove();
  };
  g.prog = prog; g.render = render;   // たしかめ用
  const backToStart = (ms) => T.push(setTimeout(() => {
    pos = start.slice(); place(pos, true); setHold(false); running = false; runBtn.disabled = false;
    progEl.querySelectorAll(".code-slot").forEach((x) => x.classList.remove("now", "bad"));
  }, ms));
  const stopAt = (idx, msg) => {
    g.miss += 1;
    progEl.children[idx].classList.add("bad");
    progEl.children[idx].scrollIntoView({ block: "nearest" });
    say(gameBubble, msg, true, 3500);
    backToStart(2600);
  };
  runBtn.onclick = () => {
    if (running || g.finished) return;
    if (!prog.length) { say(gameBubble, "ブロック を ならべてね", true); return; }
    running = true; runBtn.disabled = true;
    const moves = [];
    prog.forEach((s, i) => { for (let k = 0; k < s.times; k++) moves.push([s.dir, i]); });
    let step = 0;
    const tick = () => {
      if (game !== g) return;
      progEl.querySelectorAll(".code-slot").forEach((x, i) => x.classList.toggle("now", step < moves.length && i === moves[step][1]));
      if (step < moves.length) progEl.children[moves[step][1]].scrollIntoView({ block: "nearest" });
      if (step >= moves.length) {
        const atGoal = pos[0] === goal[0] && pos[1] === goal[1];
        if (atGoal && (!carry || holding)) {
          walker.classList.add("happy");
          if (!carry) cellAt[key(...goal)].innerHTML = "";   // おやつ を たべた
          else cellAt[key(...goal)].classList.add("done");
          const best = L + (carry ? 1 : 0);
          gameDone(carry ? "おうち に とどけた！ やったね！" :
            prog.length <= best ? `おやつ に ついた！ ${prog.length}こ の ブロック で いけたね` : "おやつ に ついた！ やったね");
        } else {
          g.miss += 1;
          say(gameBubble, atGoal ? "おやつ を もって いないよ。✋ の ブロック で もとう" :
            carry ? "おうち まで とどかなかった。ブロック を たして みよう" : "おやつ まで とどかなかった。ブロック を たして みよう", true, 3000);
          backToStart(1600);
        }
        return;
      }
      const [d, idx] = moves[step];
      if (d === "take") {
        if (item && pos[0] === item[0] && pos[1] === item[1] && !holding) {
          setHold(true);
          speak("もったよ", true);
          playAnim(walker, "bounce", 500);
          step += 1;
          T.push(setTimeout(tick, 620));
        } else stopAt(idx, `${idx + 1}ばんめ：ここ には おやつ が ないよ。どこ で もつ？`);
        return;
      }
      const [dr, dc] = CODE_DIRS[d];
      const np = [pos[0] + dr, pos[1] + dc];
      if (!inside(...np) || rocks.has(key(...np))) {
        walker.animate([{ transform: "translate(-50%,-50%)" }, { transform: `translate(calc(-50% + ${dc * 14}px), calc(-50% + ${dr * 14}px))` }, { transform: "translate(-50%,-50%)" }], { duration: 400 });
        stopAt(idx, `${idx + 1}ばんめ で ${inside(...np) ? "いわ に" : "はし で"} とまっちゃった。どこ を なおす？`);
        return;
      }
      pos = np;
      place(pos);
      step += 1;
      T.push(setTimeout(tick, 520));
    };
    tick();
  };
  setTimeout(() => say(gameBubble, lv === 0 ? "ブロック を ならべて「スタート」を おしてね"
    : carry ? "🍪 で ✋（もつ）を つかって、🏠 まで とどけよう" : "ブロック を ならべて、おやつ まで つれて いってね", true, 4000), 300);
};

/* ---------------------------------------------------------
   かたち うつし（2026-11-09 代表：空間把握 の ちから を そだてる あそび）
   ・おてほん の かたち を、となり の マス目 に おなじ ように ぬる（いち・むき・かず を くらべる）
   ・じょうきゅう は「かがみ」：まんなか の せん を はさんで、はんたいがわ に うつした ように ぬる
   ・ゆび で なぞる と つづけて ぬれる。ぬった マス を もういちど さわる と けせる
   ・レベル：3×3 1いろ → 4×4 → 4×4 2いろ → かがみ 4×4 → 5×5 2いろ → かがみ 6×6 2いろ
   --------------------------------------------------------- */
const SHAPE_COLORS = [["red", "#F07A5C"], ["blue", "#4C8FE0"]];
GAMES.shape = (g) => {
  const lv = gLevel("shape");
  const plan = [
    { n: 3, k: 3, colors: 1 }, { n: 3, k: 4, colors: 1 }, { n: 4, k: 5, colors: 1 }, { n: 4, k: 5, colors: 2 },
    { n: 4, k: 4, colors: 1, mirror: true }, { n: 5, k: 7, colors: 2 }, { n: 4, k: 5, colors: 2, mirror: true },
    { n: 6, k: 7, colors: 2, mirror: true },
  ][Math.min(lv, 7)];
  const { n, k, colors, mirror } = plan;
  $("game-label").textContent = `${mirror ? "かがみ" : "かたち うつし"} ${lv + 1}`;

  // かたち を つくる：つながった マス を k こ（かがみ の とき は ひだり はんぶん だけ）
  const W = mirror ? n / 2 : n;
  const key = (r, c) => `${r},${c}`;
  const cells = fresh("shape", () => {
    const cells = new Map();   // key → いろ の ばんごう
    const first = [rand(n), rand(W)];
    cells.set(key(...first), 0);
    for (let t = 0; cells.size < k && t < 500; t++) {
      const [r, c] = [...cells.keys()][rand(cells.size)].split(",").map(Number);
      const [dr, dc] = pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= n || nc < 0 || nc >= W || cells.has(key(nr, nc))) continue;
      cells.set(key(nr, nc), colors > 1 ? rand(colors) : 0);
    }
    return cells;
  }, (m) => [...m].sort().join(";"));
  if (colors > 1 && new Set(cells.values()).size < 2) cells.set([...cells.keys()][0], 1);   // 2いろ を かならず つかう
  // こたえ：うつし は おなじ ばしょ。かがみ は みぎ へ はんてん
  const answer = new Map();
  cells.forEach((v, kk) => { const [r, c] = kk.split(",").map(Number); answer.set(mirror ? key(r, n - 1 - c) : kk, v); });
  Object.assign(g, { n, mirror, answer });   // たしかめ用

  const makeGrid = (cls) => {
    const el = document.createElement("div");
    el.className = "shape-grid " + cls;
    el.style.setProperty("--n", n);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const d = document.createElement("div");
      d.className = "shape-cell" + (mirror && c === W - 1 ? " edge" : "");
      d.dataset.k = key(r, c);
      el.append(d);
    }
    return el;
  };
  const paintCell = (el, v) => {
    el.dataset.c = v == null ? "" : v;
    el.style.background = v == null ? "" : SHAPE_COLORS[v][1];
  };
  const wrap = document.createElement("div");
  wrap.className = "shape-wrap" + (mirror ? " mirror" : "");
  const play = makeGrid("shape-play");
  const mine = new Map();
  if (mirror) {
    // ひだり はんぶん は おてほん（さわれない）。まんなか に かがみ の せん
    cells.forEach((v, kk) => paintCell(play.querySelector(`[data-k="${kk}"]`), v));
    play.querySelectorAll(".shape-cell").forEach((d) => { if (+d.dataset.k.split(",")[1] < W) d.classList.add("given"); });
    const line = document.createElement("div");
    line.className = "shape-mirror";
    play.append(line);
    wrap.append(play);
  } else {
    const model = makeGrid("shape-model");
    cells.forEach((v, kk) => paintCell(model.querySelector(`[data-k="${kk}"]`), v));
    const cap = document.createElement("div");
    cap.className = "shape-cap";
    cap.innerHTML = "<span>おてほん</span>";
    cap.prepend(model);
    wrap.append(cap, play);
  }
  // いろ を えらぶ（2いろ の とき）
  let cur = 0;
  const pal = document.createElement("div");
  pal.className = "shape-pal";
  if (colors > 1) {
    SHAPE_COLORS.slice(0, colors).forEach(([nm, col], i) => {
      const b = document.createElement("button");
      b.className = "shape-color" + (i === 0 ? " on" : "");
      b.style.background = col;
      b.setAttribute("aria-label", nm === "red" ? "あか" : "あお");
      b.onclick = () => { cur = i; pal.querySelectorAll(".shape-color").forEach((x, j) => x.classList.toggle("on", j === i)); speak(nm === "red" ? "あか" : "あお", true); };
      pal.append(b);
    });
    wrap.append(pal);
  }
  gameArea.append(wrap);

  const check = () => {
    if (g.finished) return;
    const same = mine.size === answer.size && [...answer].every(([kk, v]) => mine.get(kk) === v);
    if (same) {
      play.classList.add("solved");
      gameDone(mirror ? "かがみ に うつした みたい！ ぴったり だね" : "おてほん と おなじ かたち！ ぴったり だね");
    } else if (mine.size >= answer.size) {
      g.miss += 1;
      say(gameBubble, "どこか ちがう みたい。おてほん と よく くらべて みよう", 1200);
    }
  };
  // ゆび で なぞって ぬる（さいしょ の マス で「ぬる／けす」を きめる）
  let mode = null, pid = null;
  const cellAtPt = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest(".shape-play .shape-cell:not(.given)"); };
  const apply = (d) => {
    if (!d) return;
    const kk = d.dataset.k;
    if (mode === "paint" && mine.get(kk) !== cur) { mine.set(kk, cur); paintCell(d, cur); d.animate([{ transform: "scale(.75)" }, { transform: "scale(1)" }], { duration: 180 }); }
    if (mode === "erase" && mine.has(kk)) { mine.delete(kk); paintCell(d, null); }
  };
  play.classList.add("draw-surface");   // ゆび で かく ばしょ（app.js の タッチ の はし わたし）
  play.addEventListener("pointerdown", (e) => {
    const d = cellAtPt(e.clientX, e.clientY);
    if (!d || g.finished) return;
    e.preventDefault();
    pid = e.pointerId;
    mode = mine.get(d.dataset.k) === cur ? "erase" : "paint";
    apply(d);
  });
  const onMove = (e) => { if (mode && e.pointerId === pid) apply(cellAtPt(e.clientX, e.clientY)); };
  const onUp = (e) => { if (mode && e.pointerId === pid) { mode = null; check(); } };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  g.cleanup = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); window.removeEventListener("pointercancel", onUp); };
  g.paint = (kk, v = 0) => { mine.set(kk, v); paintCell(play.querySelector(`[data-k="${kk}"]`), v); check(); };   // たしかめ用

  const btnClear = document.createElement("button");
  btnClear.className = "sub-btn";
  btnClear.textContent = "ぜんぶ けす";
  btnClear.onclick = () => { mine.clear(); play.querySelectorAll(".shape-cell:not(.given)").forEach((d) => paintCell(d, null)); };
  gameTools.append(btnClear);

  setTimeout(() => say(gameBubble, mirror ? "かがみ に うつした みたい に、みぎ がわ を ぬってね"
    : colors > 1 ? "おてほん と おなじ いろ・おなじ ばしょ を ぬってね" : "おてほん と おなじ かたち を ぬってね", true, 4000), 300);
};

/* ---------------------------------------------------------
   えいご の ことば：え を さわって えいご を きく → きいた ことば の え を えらぶ
   ・声 は いま は スマホ の よみあげ（英語）。本番 は 録音 を 検討
   --------------------------------------------------------- */
const ENG_SETS = [
  { name: "どうぶつ", words: [["🐱", "cat"], ["🐶", "dog"], ["🐻", "bear"], ["🐰", "rabbit"], ["🦁", "lion"], ["🐷", "pig"], ["🐟", "fish"], ["🐦", "bird"]] },
  { name: "くだもの", words: [["🍎", "apple"], ["🍌", "banana"], ["🍇", "grapes"], ["🍊", "orange"], ["🍓", "strawberry"], ["🍑", "peach"], ["🍈", "melon"]] },
  { name: "いろ", words: [["#E8604C", "red"], ["#3C9BE0", "blue"], ["#F2C94B", "yellow"], ["#49B36A", "green"], ["#F59BB8", "pink"], ["#9B6BD3", "purple"], ["#3A3A3A", "black"]] },
  { name: "のりもの", words: [["🚗", "car"], ["🚌", "bus"], ["🚃", "train"], ["🚢", "ship"], ["✈️", "airplane"], ["🚲", "bike"]] },
  { name: "からだ", words: [["👀", "eyes"], ["👃", "nose"], ["👂", "ear"], ["👄", "mouth"], ["✋", "hand"], ["🦶", "foot"]] },
];
GAMES.eng = (g) => {
  const lv = gLevel("eng");
  const set = ENG_SETS[lv % ENG_SETS.length];
  const k = lv < ENG_SETS.length ? 3 : 4;
  const words = shuffle(set.words.slice()).slice(0, k);
  const target = pick(words);
  g.target = target[1];   // たしかめ用
  $("game-label").textContent = `えいご ・ ${set.name}`;
  const pic = (w) => w[0].startsWith("#") ? `<span class="eng-color" style="background:${w[0]}"></span>` : `<span class="eng-emoji">${w[0]}</span>`;

  const box = document.createElement("div");
  box.className = "eng-cards" + (k > 3 ? " four" : "");
  const heard = new Set();
  let quiz = false;
  const cardEls = words.map((w) => {
    const b = document.createElement("button");
    b.className = "eng-card";
    b.innerHTML = `${pic(w)}<span class="eng-word">${w[1]}</span>`;
    b.onclick = () => {
      if (g.finished) return;
      b.classList.remove("tapped"); void b.offsetWidth; b.classList.add("tapped");
      if (!quiz) {
        speakEn(w[1], true);
        heard.add(w[1]);
        if (heard.size === words.length) T.push(setTimeout(startQuiz, 1300));
        return;
      }
      if (w === target) {
        b.classList.add("right");
        speakEn(`Yes! ${w[1]}!`, true);
        T.push(setTimeout(() => gameDone(`せいかい！「${w[1]}」は ${w[0].startsWith("#") ? "この いろ" : w[0]} の こと だよ`), 900));
      } else {
        g.miss += 1;
        b.classList.add("wrong");
        speakEn(w[1], true);
        say(gameBubble, `それ は「${w[1]}」。🔊 で もういちど きいてみよう`, true, 3000);
        T.push(setTimeout(() => b.classList.remove("wrong"), 600));
      }
    };
    box.append(b);
    return b;
  });
  const hear = document.createElement("button");
  hear.className = "eng-hear hidden";
  hear.textContent = "🔊 もういちど";
  hear.onclick = () => speakEn(target[1], true);
  gameArea.append(box, hear);
  const T = [];
  g.cleanup = () => T.forEach(clearTimeout);
  function startQuiz() {
    if (game !== g || g.finished) return;
    quiz = true;
    skip.remove();
    box.classList.add("quiz");
    cardEls.forEach((x) => x.classList.remove("tapped"));
    hear.classList.remove("hidden");
    say(gameBubble, "きいた ことば の え は どれ？", true, 3000);
    T.push(setTimeout(() => speakEn(target[1]), 1200));
  }
  const skip = document.createElement("button");
  skip.className = "sub-btn";
  skip.textContent = "もんだい へ";
  skip.onclick = () => { if (!quiz) startQuiz(); };
  gameTools.append(skip);
  setTimeout(() => say(gameBubble, `${set.name} の えいご だよ。え を さわって きいてみよう`, true, 3500), 300);
};
