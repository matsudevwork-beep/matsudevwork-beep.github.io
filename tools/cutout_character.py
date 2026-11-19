#!/usr/bin/env python3
"""
手がきの キャラ の 絵 から、キャラ だけ を 切りぬく（背景・かげ・消し忘れ の ペン を とうめい に する）
（2026-11-20 代表：こぐまん の 新しい 絵。消し忘れた ペン の あと や 色 が のこって いる）

つかいかた：
  .venv/bin/python tools/cutout_character.py もと.png できあがり.png [--size 600]

しくみ：
  1. こい 茶色 の りんかく線 を さがす
  2. りんかく線 で かこまれた ところ を「キャラ」に する（外 の かげ・よごれ は すてる）
  3. いちばん 大きい かたまり だけ のこす（はなれた ところ の ペン の あと を すてる）
  4. まわり の よぶん を けずって、ながい ほう を --size px に する
"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

args = [a for a in sys.argv[1:] if not a.startswith("--")]
SIZE = int(sys.argv[sys.argv.index("--size") + 1]) if "--size" in sys.argv else 600
if "--size" in sys.argv:
    args.remove(str(SIZE))
src, dst = args[0], args[1]

src_im = Image.open(src).convert("RGBA")
# とうめい な ところ にも 色 が のこって いる（消しゴム の あと）ので、白い 紙 に のせて から みる
im = Image.new("RGBA", src_im.size, (255, 255, 255, 255))
im.alpha_composite(src_im)
im = im.convert("RGB")
src_a = np.asarray(src_im)[..., 3].astype(np.float32)
rgb = np.asarray(im).astype(np.float32)
lum = rgb @ np.array([0.299, 0.587, 0.114], dtype=np.float32)

LINE = 150          # これ より くらい 色 を りんかく線 と みる
GAP = 3             # 線 の すきま を ふさぐ ための ふとらせ（px）

line = lum < LINE
line_img = Image.fromarray((line * 255).astype(np.uint8))
fat = line_img.filter(ImageFilter.MaxFilter(GAP * 2 + 1))   # 線 を ふとらせて すきま を とじる

# 外 から ぬりつぶし → ぬれなかった ところ ＝ 線 と その 内がわ
canvas = Image.new("L", im.size, 0)
canvas.paste(fat)
pad = Image.new("L", (im.width + 2, im.height + 2), 0)
pad.paste(canvas, (1, 1))
ImageDraw.floodfill(pad, (0, 0), 128)
outside = np.asarray(pad)[1:-1, 1:-1] == 128
inside = ~outside

# いちばん 大きい かたまり だけ
lab = Image.fromarray((inside * 255).astype(np.uint8))
arr = np.asarray(lab).copy()
best, best_n, label = None, 0, 1
ys, xs = np.nonzero(arr == 255)
work = Image.fromarray(arr).copy()   # copy しないと floodfill が きかない
for y, x in zip(ys[::50], xs[::50]):
    if work.getpixel((int(x), int(y))) != 255:
        continue
    label += 1
    if label >= 255:
        break
    ImageDraw.floodfill(work, (int(x), int(y)), label)
    n = int((np.asarray(work) == label).sum())
    if n > best_n:
        best, best_n = label, n
mask = np.asarray(work) == best

# ふとらせた ぶん を もどす（線 の 外がわ の 白い ふち を のこさない）
m = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(GAP * 2 + 1))
core = np.asarray(m) > 0
ring = (np.asarray(m.filter(ImageFilter.MaxFilter(5))) > 0) & ~core

# ふち は 線 の こさ で すこし すける（ぎざぎざ に しない）
alpha = np.zeros(lum.shape, np.float32)
alpha[core] = 255
dark = np.clip((235 - lum) / (235 - 90), 0, 1) * 255
alpha[ring] = dark[ring]

alpha = np.minimum(alpha, src_a)   # もと の 絵 で とうめい な ところ は とうめい の まま
out = np.dstack([rgb, alpha]).astype(np.uint8)
# ふち の 色 は 線 の 色 に そろえる（白っぽい ふち を ださない）
line_col = np.median(rgb[line & core], axis=0) if (line & core).any() else np.array([90, 60, 30])
out[ring, :3] = line_col.astype(np.uint8)

res = Image.fromarray(out)
bbox = res.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
res = res.crop(bbox)
scale = SIZE / max(res.size)
if scale < 1:
    res = res.resize((round(res.width * scale), round(res.height * scale)), Image.LANCZOS)
res.save(dst, optimize=True)
print(f"{dst}：{res.width}×{res.height}")
