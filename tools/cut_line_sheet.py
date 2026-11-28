#!/usr/bin/env python3
"""
せんかき の 絵 の シート（3れつ×2だん に 6こ）を 1こ ずつ 切りわけて、背景 を とうめい に する（2026-11-28 代表）

つかいかた（app フォルダ で）：
  .venv/bin/python tools/cut_line_sheet.py ../illustrations/line/line-sheet-1.png rodent,cheese,dog,bone,cat,fish
  → kids-app/img/line/<なまえ>.webp（ながい 辺 300px）。なまえ は line-icons.js の LINE_ICONS と おなじ

しくみ：
  1. シート を 3×2 の マス に わける
  2. マス の ふち から つながって いる「背景 に ちかい 色」だけ を とうめい に する
     （りんかく線 の なか の 白っぽい ぬり や、ひげ は のこる）
  3. まわり の よぶん を けずって、すこし よはく を つけて ちぢめる
"""
import sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

src, names = sys.argv[1], sys.argv[2].split(",")
OUT = os.path.join(os.path.dirname(__file__), "..", "kids-app", "img", "line")
SIZE = 300
im = Image.open(src).convert("RGB")
W, H = im.size
cols, rows = 3, 2
for idx, name in enumerate(names):
    c, r = idx % cols, idx // cols
    cell = im.crop((c * W // cols, r * H // rows, (c + 1) * W // cols, (r + 1) * H // rows))
    a = np.asarray(cell).astype(int)
    bg = np.median(np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]), axis=0)   # ふち の 色 ＝ 背景
    near = (np.abs(a - bg).sum(axis=2) < 45)
    m = Image.fromarray(np.pad(near, 2, constant_values=True).astype(np.uint8) * 255).copy()   # copy：もと の 配列 と きりはなす（floodfill が きかない ため）
    ImageDraw.floodfill(m, (0, 0), 128)
    outside = (np.asarray(m)[2:-2, 2:-2] == 128)
    alpha = Image.fromarray(np.where(outside, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    rgba = cell.convert("RGBA"); rgba.putalpha(alpha)
    ys, xs = np.where(~outside)
    pad = 8
    box = (max(0, xs.min() - pad), max(0, ys.min() - pad), min(cell.width, xs.max() + pad + 1), min(cell.height, ys.max() + pad + 1))
    rgba = rgba.crop(box)
    k = SIZE / max(rgba.size)
    rgba = rgba.resize((round(rgba.width * k), round(rgba.height * k)), Image.LANCZOS)
    rgba.save(os.path.join(OUT, f"{name}.webp"), "WEBP", quality=88, method=6)
    print(name, rgba.size)
