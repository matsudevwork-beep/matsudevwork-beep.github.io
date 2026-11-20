#!/usr/bin/env python3
"""
こぐまん の 表情（にっこり・わーい・まばたき・しゃべる）を、アプリ で 重ねる 小さな 絵 に する（2026-11-20 代表）

つかいかた（app フォルダ で）：
  .venv/bin/python tools/build_face_parts.py

もと：../illustrations/koguman/level-NN.png（代表 の 絵）と
      ../illustrations/koguman/parts-trial/koguman-0{1,2}-face-<表情>.png（顔 を かえた 絵。ChatGPT の 目・口 を 合わせた もの）
でき：kids-app/img/face/animal-NN-<表情>.webp（顔 の まわり だけ の 小さな 絵）
      kids-app/face-parts.js（その 絵 を 本体 の 絵 の どこ に 重ねるか）

しくみ：
  1. 代表 の 絵 の 顔 だけ を 表情 の 絵 に いれかえる（レベル2〜10 は 顔 の 位置 が おなじ なので レベル2 の 表情 を つかう）
  2. いつも の 切りぬき（tools/cutout_character.py）を かける → ふだん の 絵 と おなじ 大きさ・位置 に なる
  3. ふだん の 絵 と ちがう ところ（目・口）だけ を 小さく 切りだす
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ILL = os.path.join(ROOT, "..", "illustrations", "koguman")
TRIAL = os.path.join(ILL, "parts-trial")
OUT = os.path.join(ROOT, "kids-app", "img", "face")
KINDS = ["smile", "happy", "blink", "talk"]
PY = sys.executable
CUT = os.path.join(ROOT, "tools", "cutout_character.py")
SIZE = 500   # kids-app/img/animal-NN.webp と おなじ（長い 辺）

os.makedirs(OUT, exist_ok=True)
tmp = tempfile.mkdtemp()


BBOX = os.path.join(tmp, "bbox.txt")
def cutout(canvas: Image.Image, first=False) -> Image.Image:
    """first：ふだん の 絵（切りかた を おぼえる）。それ いがい は おなじ 切りかた で 切る"""
    src, dst = os.path.join(tmp, "in.png"), os.path.join(tmp, "out.png")
    canvas.save(src)
    subprocess.run([PY, CUT, src, dst, "--save-bbox" if first else "--use-bbox", BBOX], check=True, capture_output=True)
    im = Image.open(dst).convert("RGBA")
    im.thumbnail((SIZE, SIZE), Image.LANCZOS)
    return im


def face_mask(face: Image.Image, ref: Image.Image) -> Image.Image:
    """表情 の 絵 と もと の 絵 で ちがう ところ（目・口）を すこし ひろげて ふちを ぼかす"""
    a, b = np.asarray(face).astype(int), np.asarray(ref).astype(int)
    d = (np.abs(a[..., :3] - b[..., :3]).max(-1) > 10)
    m = Image.fromarray((d * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.GaussianBlur(3))
    return m


table = {}
LEVELS = [int(a) for a in sys.argv[1:]] or list(range(1, 11))   # レベル を えらんで つくりなおせる
old_js = os.path.join(ROOT, "kids-app", "face-parts.js")
if os.path.exists(old_js) and sys.argv[1:]:
    table = {int(k): v for k, v in json.loads(open(old_js).read().split("animal: ", 1)[1].rsplit(" };", 1)[0]).items()}
for n in LEVELS:
    orig = Image.open(os.path.join(ILL, f"level-{n:02d}.png")).convert("RGBA")
    normal = cutout(orig, first=True)
    boxes = {}
    for k in KINDS:
        lv = 1 if n == 1 else 2
        face = Image.open(os.path.join(TRIAL, f"koguman-0{lv}-face-{k}.png")).convert("RGBA")
        ref = Image.open(os.path.join(ILL, f"level-0{lv}.png")).convert("RGBA")
        m = face_mask(face, ref)
        variant = Image.composite(face, orig, m)          # 顔 の ところ だけ いれかえ
        v = cutout(variant)
        assert v.size == normal.size, (n, k, v.size, normal.size)
        # ふだん の 絵 と ちがう ところ だけ を のこす
        a, b = np.asarray(v).astype(int), np.asarray(normal).astype(int)
        d = (np.abs(a - b).max(-1) > 6)
        # 顔 の まわり だけ を みる（切りぬき の ふち の 色 が ほんの すこし かわる ことが ある ため）
        bb = [int(x) for x in open(BBOX).read().split(",")]
        sc = normal.size[0] / (bb[2] - bb[0])
        mb = m.getbbox()
        r = [max(0, int((mb[0] - bb[0]) * sc) - 4), max(0, int((mb[1] - bb[1]) * sc) - 4),
             int((mb[2] - bb[0]) * sc) + 5, int((mb[3] - bb[1]) * sc) + 5]
        keep = np.zeros_like(d); keep[r[1]:r[3], r[0]:r[2]] = True
        d &= keep
        dm = Image.fromarray((d * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(1.5))
        box = dm.point(lambda x: 255 if x > 4 else 0).getbbox()
        over = v.copy()
        over.putalpha(Image.fromarray(np.minimum(np.asarray(dm), np.asarray(v)[..., 3]).astype(np.uint8)))
        over = over.crop(box)
        over.save(os.path.join(OUT, f"animal-{n:02d}-{k}.webp"), "WEBP", quality=90, method=6, alpha_quality=100)
        W, H = normal.size
        boxes[k] = [round(box[0] / W * 100, 2), round(box[1] / H * 100, 2),
                    round((box[2] - box[0]) / W * 100, 2), round((box[3] - box[1]) / H * 100, 2)]
    table[n] = boxes
    print(f"レベル{n}：", boxes["happy"])

js = (
    "/* こぐまん の 表情 の 絵 を 重ねる 場所（じどう で つくる ファイル。手 で なおさない）\n"
    "   つくりなおし：.venv/bin/python tools/build_face_parts.py\n"
    "   [左, 上, はば, たかさ]（ふだん の 絵 に たいする %）。絵 は img/face/animal-NN-<表情>.webp */\n"
    "const FACE_PARTS = { animal: " + json.dumps({str(k): v for k, v in table.items()}, ensure_ascii=False) + " };\n"
)
open(os.path.join(ROOT, "kids-app", "face-parts.js"), "w").write(js)
print("ok → kids-app/img/face/, kids-app/face-parts.js")
