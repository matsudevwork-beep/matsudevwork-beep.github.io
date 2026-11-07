"""
ひらがな を よむ AI を つくる スクリプト
------------------------------------------------
使い方（Mac）:
  python3 -m venv .venv && .venv/bin/pip install torch numpy pillow   （さいしょ の 1かい だけ）
  .venv/bin/python tools/ai/train_hira.py
  → kids-app/ai/hira-model.js が できる（ブラウザ で うごく AI の 中身）

しくみ:
  1. kids-app/hiragana.js の 書き順 の 線（KanjiVG を 加工 したもの、CC BY-SA 3.0）を よみこむ
  2. 線 を すこし ずつ ゆがめ・ふるわせ・ずらして、手 で 書いた ような 字 を たくさん つくる
     （子ども の 字 は ガタガタ・はみだし・線 の ずれ が おおい ので、それ に にせる）
  3. 小さな 画像認識 の AI（CNN）を 学習 させる
  4. 重み を 8bit に ちぢめて、ブラウザ 用 の js ファイル に 書きだす
     ※ この AI（学習ずみ の 重み）も KanjiVG から つくった もの なので CC BY-SA 3.0 で 公開 する

ほか の データ（ETL など）は つかって いない。
"""
import json
import math
import os
import random
import re
import sys
import base64

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
SIZE = 48          # AI に いれる 画像 の 大きさ（48×48）
CANVAS = 128       # ここ で 描いて から 48 に ちぢめる
PER_CLASS = int(os.environ.get("PER_CLASS", "700"))
EPOCHS = int(os.environ.get("EPOCHS", "14"))
SEED = 7
random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)


# ---------- 1. 書き順 の 線 を よむ ----------
def load_kana(fname, var):
    text = open(os.path.join(ROOT, "kids-app", fname), encoding="utf-8").read()
    body = text[text.index(f"const {var} = [") + len(f"const {var} = "):]
    body = body[: body.index("];") + 1]
    items = json.loads(re.sub(r",\s*\]", "]", body))
    return [(it["char"], it["strokes"]) for it in items]


TOKEN = re.compile(r"[MmLlHhVvCcSsQqTtZz]|-?(?:\d*\.\d+|\d+\.?)(?:[eE]-?\d+)?")


def path_points(d, steps=14):
    """SVG の 線 を 点 の ならび に する"""
    toks = TOKEN.findall(d)
    pts, i, cmd = [], 0, None
    cx = cy = sx = sy = 0.0
    lc = None  # まえ の 制御点（S/T 用）

    def num():
        nonlocal i
        v = float(toks[i]); i += 1
        return v

    def cubic(p0, p1, p2, p3):
        for k in range(1, steps + 1):
            t = k / steps
            a = (1 - t) ** 3; b = 3 * (1 - t) ** 2 * t; c = 3 * (1 - t) * t * t; e = t ** 3
            pts.append((a * p0[0] + b * p1[0] + c * p2[0] + e * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + e * p3[1]))

    while i < len(toks):
        if toks[i].isalpha():
            cmd = toks[i]; i += 1
            if cmd in "Zz":
                pts.append((sx, sy)); cx, cy = sx, sy; continue
        rel = cmd.islower(); C = cmd.upper()
        if C == "M":
            x, y = num(), num()
            if rel: x += cx; y += cy
            cx, cy, sx, sy = x, y, x, y; pts.append((x, y)); lc = None
            cmd = "l" if rel else "L"
        elif C == "L":
            x, y = num(), num()
            if rel: x += cx; y += cy
            pts.append((x, y)); cx, cy = x, y; lc = None
        elif C == "H":
            x = num() + (cx if rel else 0); pts.append((x, cy)); cx = x; lc = None
        elif C == "V":
            y = num() + (cy if rel else 0); pts.append((cx, y)); cy = y; lc = None
        elif C == "C":
            x1, y1, x2, y2, x, y = [num() for _ in range(6)]
            if rel: x1 += cx; y1 += cy; x2 += cx; y2 += cy; x += cx; y += cy
            cubic((cx, cy), (x1, y1), (x2, y2), (x, y)); lc = (x2, y2); cx, cy = x, y
        elif C == "S":
            x2, y2, x, y = [num() for _ in range(4)]
            if rel: x2 += cx; y2 += cy; x += cx; y += cy
            x1, y1 = (2 * cx - lc[0], 2 * cy - lc[1]) if lc else (cx, cy)
            cubic((cx, cy), (x1, y1), (x2, y2), (x, y)); lc = (x2, y2); cx, cy = x, y
        elif C == "Q":
            x1, y1, x, y = [num() for _ in range(4)]
            if rel: x1 += cx; y1 += cy; x += cx; y += cy
            c1 = (cx + 2 / 3 * (x1 - cx), cy + 2 / 3 * (y1 - cy)); c2 = (x + 2 / 3 * (x1 - x), y + 2 / 3 * (y1 - y))
            cubic((cx, cy), c1, c2, (x, y)); lc = None; cx, cy = x, y
        else:
            raise ValueError(f"しらない 線 の かきかた: {cmd}")
    return pts


# ---------- 2. 手書き ふう に ゆがめて 描く ----------
def jitter_stroke(pts, size):
    p = np.array(pts, dtype=np.float64)
    n = len(p)
    # はし を すこし けずる／のばす
    if n > 4:
        a = int(n * random.uniform(0, 0.1)); b = n - int(n * random.uniform(0, 0.1))
        p = p[a:max(b, a + 2)]
    # ふるえ（なめらか な なみ）
    t = np.linspace(0, 1, len(p))
    amp = size * random.uniform(0, 0.035)
    for _ in range(2):
        f = random.uniform(1, 5); ph = random.uniform(0, 6.3)
        p[:, 0] += amp * np.sin(2 * math.pi * f * t + ph)
        p[:, 1] += amp * np.cos(2 * math.pi * f * t + ph * 1.3)
    p += np.random.normal(0, size * 0.004, p.shape)   # こまかい ガタガタ
    # この 線 だけ ずれる・まわる・大きさ が かわる
    c = p.mean(axis=0)
    ang = math.radians(random.uniform(-10, 10)); s = random.uniform(0.85, 1.15)
    R = np.array([[math.cos(ang), -math.sin(ang)], [math.sin(ang), math.cos(ang)]]) * s
    p = (p - c) @ R.T + c + np.random.uniform(-size * 0.07, size * 0.07, 2)
    return p


def render(strokes_pts, width_ratio=None):
    """点 の ならび（線 ごと）を 48×48 の 画像 に。字 の 大きさ と 位置 は そろえる（アプリ と おなじ やりかた）"""
    allp = np.concatenate(strokes_pts)
    mn, mx = allp.min(axis=0), allp.max(axis=0)
    span = max(mx[0] - mn[0], mx[1] - mn[1], 1e-3)
    sc = CANVAS * 0.78 / span
    off = (CANVAS - (mx - mn) * sc) / 2 - mn * sc
    img = Image.new("L", (CANVAS, CANVAS), 0)
    dr = ImageDraw.Draw(img)
    w = int(CANVAS * (width_ratio if width_ratio else random.uniform(0.05, 0.1)))
    for p in strokes_pts:
        q = [tuple(x) for x in (p * sc + off)]
        if len(q) >= 2:
            dr.line(q, fill=255, width=w, joint="curve")
        r = w / 2
        for e in (q[0], q[-1]):
            dr.ellipse([e[0] - r, e[1] - r, e[0] + r, e[1] + r], fill=255)
    img = img.resize((SIZE, SIZE), Image.BILINEAR)
    return np.asarray(img, dtype=np.float32) / 255.0


def make_sample(strokes):
    base = [np.array(path_points(d)) for d in strokes]
    allp = np.concatenate(base)
    size = max(np.ptp(allp[:, 0]), np.ptp(allp[:, 1]))
    if random.random() < 0.15:
        sp = base   # ほぼ おてほん どおり
    else:
        sp = [jitter_stroke(p, size) for p in base]
    # ぜんたい を かたむける・よこ に のばす
    allp = np.concatenate(sp); c = allp.mean(axis=0)
    ang = math.radians(random.uniform(-12, 12)); sh = random.uniform(-0.18, 0.18)
    M = np.array([[math.cos(ang), -math.sin(ang)], [math.sin(ang), math.cos(ang)]]) @ np.array([[1, sh], [0, 1]])
    M = M @ np.diag([random.uniform(0.8, 1.2), random.uniform(0.85, 1.15)])
    sp = [(p - c) @ M.T + c for p in sp]
    return render(sp)


def make_junk(kana):
    """字 では ない もの（らくがき・ちがう 字 の まぜこぜ）。これ を「？」と して おぼえさせる"""
    r = random.random()
    if r < 0.4:   # ぐるぐる・なみなみ の らくがき
        sp = []
        for _ in range(random.randint(1, 3)):
            n = random.randint(20, 60)
            t = np.linspace(0, random.uniform(2, 12), n)
            a, b = random.uniform(0.5, 3), random.uniform(0.5, 3)
            x = np.cos(a * t + random.uniform(0, 6)) * random.uniform(20, 100) + np.cumsum(np.random.normal(0, 4, n))
            y = np.sin(b * t + random.uniform(0, 6)) * random.uniform(20, 100) + np.cumsum(np.random.normal(0, 4, n))
            sp.append(np.stack([x, y], 1))
        return render(sp)
    if r < 0.75:  # 2つ の 字 の 線 を まぜる
        a, b = random.sample(kana, 2)
        sa = [np.array(path_points(d)) for d in a[1]]
        sb = [np.array(path_points(d)) for d in b[1]]
        pick = random.sample(sa, max(1, len(sa) // 2 + random.randint(0, 1))) + random.sample(sb, max(1, len(sb) // 2))
        size = 200
        return render([jitter_stroke(p, size) for p in pick])
    # まっすぐ な 線 を てきとう に
    sp = []
    for _ in range(random.randint(1, 5)):
        p0 = np.random.uniform(0, 300, 2); p1 = np.random.uniform(0, 300, 2)
        sp.append(np.linspace(p0, p1, 12) + np.random.normal(0, 2, (12, 2)))
    return render(sp)


# ---------- 3. AI の かたち ----------
class Net(nn.Module):
    def __init__(self, n):
        super().__init__()
        self.c1 = nn.Conv2d(1, 16, 3, padding=1)
        self.c2 = nn.Conv2d(16, 32, 3, padding=1)
        self.c3 = nn.Conv2d(32, 64, 3, padding=1)
        self.c4 = nn.Conv2d(64, 64, 3, padding=1)
        self.fc = nn.Linear(64 * 3 * 3, n)
        self.drop = nn.Dropout(0.3)

    def forward(self, x):
        x = F.max_pool2d(F.relu(self.c1(x)), 2)   # 24
        x = F.max_pool2d(F.relu(self.c2(x)), 2)   # 12
        x = F.max_pool2d(F.relu(self.c3(x)), 2)   # 6
        x = F.max_pool2d(F.relu(self.c4(x)), 2)   # 3
        return self.fc(self.drop(x.flatten(1)))


def export(net, chars, out_path, acc):
    """重み を 8bit（出力 ごと の 倍率 つき）に して js に 書きだす"""
    layers = []
    for name, mod in [("c1", net.c1), ("c2", net.c2), ("c3", net.c3), ("c4", net.c4), ("fc", net.fc)]:
        w = mod.weight.detach().numpy().astype(np.float32)
        b = mod.bias.detach().numpy().astype(np.float32)
        flat = w.reshape(w.shape[0], -1)
        scale = np.maximum(np.abs(flat).max(axis=1), 1e-8) / 127.0
        q = np.clip(np.round(flat / scale[:, None]), -127, 127).astype(np.int8)
        layers.append({
            "name": name, "shape": list(w.shape),
            "w": base64.b64encode(q.tobytes()).decode(),
            "scale": [float(f"{x:.6g}") for x in scale],
            "b": [float(f"{x:.6g}") for x in b],
        })
    data = {"size": SIZE, "chars": chars, "layers": layers, "acc": round(acc, 4)}
    head = """/* =========================================================
   ひらがな を よむ AI（学習ずみ の 重み）
   ・tools/ai/train_hira.py で 自動 で 作って います（手 で なおさない）
   ・学習データ：hiragana.js の 書き順 の 線（KanjiVG を 加工）を ゆがめて つくった 手書き ふう の 字
     KanjiVG Copyright (C) 2009-2026 Ulrich Apel  CC BY-SA 3.0
     この AI（重み）も CC BY-SA 3.0 で 公開 します
   ========================================================= */
"""
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(head + "const HIRA_MODEL = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")


def main():
    kana = load_kana("hiragana.js", "HIRAGANA")
    chars = [c for c, _ in kana] + ["?"]   # さいご の「?」＝ 字 では ない もの
    n = len(chars)
    JUNK = PER_CLASS * 3
    print(f"{n - 1}字 × {PER_CLASS}まい ＋ 字 では ない もの {JUNK}まい を つくります…", flush=True)
    X = np.zeros(((n - 1) * PER_CLASS + JUNK, 1, SIZE, SIZE), dtype=np.float32)
    Y = np.zeros(len(X), dtype=np.int64)
    k = 0
    for ci, (_, strokes) in enumerate(kana):
        for _ in range(PER_CLASS):
            X[k, 0] = make_sample(strokes); Y[k] = ci; k += 1
    for _ in range(JUNK):
        X[k, 0] = make_junk(kana); Y[k] = n - 1; k += 1
    idx = np.random.permutation(len(X))
    X, Y = X[idx], Y[idx]
    nv = len(X) // 10
    Xv, Yv, Xt, Yt = torch.tensor(X[:nv]), torch.tensor(Y[:nv]), torch.tensor(X[nv:]), torch.tensor(Y[nv:])
    if os.environ.get("SAVE_SAMPLES"):
        sheet = Image.new("L", (SIZE * 16, SIZE * 8))
        for j in range(128):
            sheet.paste(Image.fromarray((X[j, 0] * 255).astype(np.uint8)), ((j % 16) * SIZE, (j // 16) * SIZE))
        sheet.save(os.environ["SAVE_SAMPLES"])

    net = Net(n)
    opt = torch.optim.Adam(net.parameters(), lr=2e-3)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, EPOCHS)
    acc = 0.0
    for ep in range(EPOCHS):
        net.train()
        perm = torch.randperm(len(Xt))
        for b in range(0, len(Xt), 128):
            j = perm[b:b + 128]
            xb = Xt[j]
            # すこし ずらす（位置 の ずれ に つよく）
            if random.random() < 0.5:
                xb = torch.roll(xb, shifts=(random.randint(-2, 2), random.randint(-2, 2)), dims=(2, 3))
            loss = F.cross_entropy(net(xb), Yt[j])
            opt.zero_grad(); loss.backward(); opt.step()
        sched.step()
        net.eval()
        with torch.no_grad():
            acc = (net(Xv).argmax(1) == Yv).float().mean().item()
        print(f"  {ep + 1}/{EPOCHS} かいめ：ためし の 字 の せいかい りつ {acc * 100:.1f}%", flush=True)

    os.makedirs(os.path.join(ROOT, "kids-app", "ai"), exist_ok=True)
    out = os.path.join(ROOT, "kids-app", "ai", "hira-model.js")
    export(net, chars, out, acc)
    print(f"できあがり → {os.path.normpath(out)}（{os.path.getsize(out) // 1024}KB）")


if __name__ == "__main__":
    main()
