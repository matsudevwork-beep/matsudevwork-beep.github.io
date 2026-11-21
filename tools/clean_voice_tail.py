#!/usr/bin/env python3
"""
作った 声 の 前後 の「プチッ」を けずる（2026-11-21 代表：キャロ の 声 の あと に 変な 1音 が 入って いた）

  つかいかた（app フォルダ で）：
    .venv/bin/python tools/clean_voice_tail.py kids-app/audio/pet-005-veggie.mp3 …
    DRY=1 … → けずる ところ を 出す だけ

  ・声 の まえ・あと に、しずか な ところ（0.3びょう 以上）を はさんで ぽつん と ある 短い 音（0.15びょう より 短い）を 消す
  ・のこった 声 の まえ 0.05びょう・あと 0.25びょう だけ のこして むおん を けずる（ElevenLabs は おわり に 1びょう ほど むおん が つく）
  ・けずった ファイル は おなじ 名前 で 上書き（mp3 64kbps）
"""
import os, subprocess, sys
import numpy as np

SR = 44100
WIN = int(SR * 0.01)


def load(p):
    b = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-f", "s16le", "-ac", "1", "-ar", str(SR), "-"],
                       capture_output=True, check=True).stdout
    return np.frombuffer(b, np.int16).astype(np.float32) / 32768


def segments(x):
    n = len(x) // WIN
    env = np.sqrt((x[: n * WIN].reshape(n, WIN) ** 2).mean(1))
    on = env > max(0.008, env.max() * 0.06)
    segs, i = [], 0
    while i < n:
        if on[i]:
            j = i
            while j < n and on[j]:
                j += 1
            segs.append([i, j])
            i = j
        else:
            i += 1
    merged = []
    for s in segs:   # 0.3びょう より 近い ものは ひとつ の 声
        if merged and s[0] - merged[-1][1] < 30:
            merged[-1][1] = s[1]
        else:
            merged.append(s)
    return merged


def clean(path, dry):
    x = load(path)
    segs = segments(x)
    if not segs:
        return
    keep = [s for s in segs if s[1] - s[0] >= 15] or segs   # 0.15びょう より 短い ぽつん は 消す
    a = max(0, keep[0][0] * WIN - int(SR * 0.05))
    b = min(len(x), keep[-1][1] * WIN + int(SR * 0.25))
    dropped = len(segs) - len(keep)
    print(f"{os.path.basename(path)}  {len(x)/SR:.2f}s → {(b-a)/SR:.2f}s" + (f"  プチッ {dropped}こ けした" if dropped else ""))
    if dry:
        return
    y = x[a:b].copy()
    f = int(SR * 0.02)
    y[:f] *= np.linspace(0, 1, f)
    y[-f:] *= np.linspace(1, 0, f)
    raw = (np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes()
    tmp = path + ".tmp.mp3"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", "-",
                    "-c:a", "libmp3lame", "-b:a", "64k", tmp], input=raw, check=True)
    os.replace(tmp, path)


if __name__ == "__main__":
    for p in sys.argv[1:]:
        clean(p, bool(os.environ.get("DRY")))
