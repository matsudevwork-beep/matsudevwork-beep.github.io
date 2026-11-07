/* =========================================================
   字 を よむ AI（ブラウザ の なか だけ で うごく。字 は 外 に 送らない）
   ・HIRA_MODEL（ai/hira-model.js）の 重み を つかって、かいた 線 が どの ひらがな か を あてる
   ・つかいかた：AIReader.read(strokes) → [{ char, p }, …]（p＝自信 0〜1、たかい じゅん）
     strokes＝[[{x,y}, …], …]（線 ごと の 点 の ならび。座標 は なんでも よい）
   ・学習 の しかた は tools/ai/train_hira.py
   ========================================================= */
const AIReader = (() => {
  if (typeof HIRA_MODEL === "undefined") return { ready: false, read: () => [] };
  const M = HIRA_MODEL;
  const SIZE = M.size;
  const CANVAS = 128;

  // 8bit の 重み を もとに もどす
  const layers = {};
  for (const L of M.layers) {
    const bin = atob(L.w);
    const out = L.shape[0];
    const per = bin.length / out;
    const w = new Float32Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      let v = bin.charCodeAt(i);
      if (v > 127) v -= 256;
      w[i] = v * L.scale[Math.floor(i / per)];
    }
    layers[L.name] = { w, b: Float32Array.from(L.b), shape: L.shape };
  }

  // 3×3 の たたみこみ（まわり に 0 を たす）＋ ReLU ＋ 2×2 の 最大値 で ちぢめる
  function convReluPool(x, C, H, W, L) {
    const [O] = L.shape;
    const y = new Float32Array(O * H * W);
    for (let o = 0; o < O; o++) {
      const bo = L.b[o];
      for (let i = 0; i < H; i++) for (let j = 0; j < W; j++) {
        let s = bo;
        for (let c = 0; c < C; c++) {
          const wb = ((o * C + c) * 9);
          const xb = c * H * W;
          for (let di = -1; di <= 1; di++) {
            const ii = i + di;
            if (ii < 0 || ii >= H) continue;
            for (let dj = -1; dj <= 1; dj++) {
              const jj = j + dj;
              if (jj < 0 || jj >= W) continue;
              s += x[xb + ii * W + jj] * L.w[wb + (di + 1) * 3 + (dj + 1)];
            }
          }
        }
        y[(o * H + i) * W + j] = s > 0 ? s : 0;
      }
    }
    const H2 = H >> 1, W2 = W >> 1;
    const z = new Float32Array(O * H2 * W2);
    for (let o = 0; o < O; o++) for (let i = 0; i < H2; i++) for (let j = 0; j < W2; j++) {
      const b = (o * H + i * 2) * W + j * 2;
      z[(o * H2 + i) * W2 + j] = Math.max(y[b], y[b + 1], y[b + W], y[b + W + 1]);
    }
    return { z, C: O, H: H2, W: W2 };
  }

  function forward(input) {
    let r = { z: input, C: 1, H: SIZE, W: SIZE };
    for (const n of ["c1", "c2", "c3", "c4"]) r = convReluPool(r.z, r.C, r.H, r.W, layers[n]);
    const fc = layers.fc;
    const [O, I] = fc.shape;
    const logits = new Float32Array(O);
    for (let o = 0; o < O; o++) {
      let s = fc.b[o];
      for (let i = 0; i < I; i++) s += r.z[i] * fc.w[o * I + i];
      logits[o] = s;
    }
    const mx = Math.max(...logits);
    const e = logits.map((v) => Math.exp(v - mx));
    const sum = e.reduce((a, b) => a + b, 0);
    return Array.from(e, (v) => v / sum);
  }

  // 線 を 48×48 の 画像 に（学習 の とき と おなじ そろえかた）
  const big = document.createElement("canvas");
  big.width = big.height = CANVAS;
  const small = document.createElement("canvas");
  small.width = small.height = SIZE;
  function toInput(strokes) {
    const all = strokes.flat();
    if (!all.length) return null;
    const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
    const mnx = Math.min(...xs), mny = Math.min(...ys), mxx = Math.max(...xs), mxy = Math.max(...ys);
    const span = Math.max(mxx - mnx, mxy - mny, 1e-3);
    const sc = CANVAS * 0.78 / span;
    const ox = (CANVAS - (mxx - mnx) * sc) / 2 - mnx * sc;
    const oy = (CANVAS - (mxy - mny) * sc) / 2 - mny * sc;
    const g = big.getContext("2d");
    g.fillStyle = "#000"; g.fillRect(0, 0, CANVAS, CANVAS);
    g.strokeStyle = "#fff"; g.fillStyle = "#fff";
    g.lineWidth = CANVAS * 0.075; g.lineCap = "round"; g.lineJoin = "round";
    for (const s of strokes) {
      if (!s.length) continue;
      g.beginPath();
      g.moveTo(s[0].x * sc + ox, s[0].y * sc + oy);
      for (const p of s) g.lineTo(p.x * sc + ox, p.y * sc + oy);
      if (s.length === 1) g.lineTo(s[0].x * sc + ox + 0.1, s[0].y * sc + oy);
      g.stroke();
    }
    const h = small.getContext("2d", { willReadFrequently: true });
    h.imageSmoothingEnabled = true;
    h.imageSmoothingQuality = "medium";
    h.drawImage(big, 0, 0, SIZE, SIZE);
    const d = h.getImageData(0, 0, SIZE, SIZE).data;
    const x = new Float32Array(SIZE * SIZE);
    for (let i = 0; i < SIZE * SIZE; i++) x[i] = d[i * 4] / 255;
    return x;
  }

  // SVG の 線（M x y L x y …）を 点 の ならび に
  function parsePath(d) {
    const out = [];
    let cur = null;
    const re = /([ML])\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/g;
    let m;
    while ((m = re.exec(d))) {
      if (m[1] === "M") { cur = []; out.push(cur); }
      if (cur) cur.push({ x: +m[2], y: +m[3] });
    }
    return out;
  }

  function read(strokes) {
    const x = toInput(strokes);
    if (!x) return [];
    const p = forward(x);
    return M.chars.map((char, i) => ({ char, p: p[i] })).sort((a, b) => b.p - a.p);
  }
  return { ready: true, read, parsePath, chars: M.chars };
})();
