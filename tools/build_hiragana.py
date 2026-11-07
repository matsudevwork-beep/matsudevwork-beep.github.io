"""
KanjiVG のデータから kids-app/hiragana.js を作るスクリプト
-------------------------------------------------------------
使い方（ふだんは使わなくてOK。字やことばを直したいときだけ）:
  1. KanjiVG の ひらがな SVG（例: 03042.svg = あ）を 1つのフォルダに入れる
     https://github.com/KanjiVG/kanjivg/tree/master/kanji
  2. python3 tools/build_hiragana.py <SVGのフォルダ>
  3. kids-app/hiragana.js が作りなおされる

KanjiVG: Copyright (C) 2009-2026 Ulrich Apel. CC BY-SA 3.0
https://kanjivg.tagaini.net/  https://creativecommons.org/licenses/by-sa/3.0/
このスクリプトでの加工：線の座標を アプリの画面（360×480）に合わせて 拡大・移動しただけ。
"""
import json
import os
import re
import sys

# 109×109 の KanjiVG を、画面のまんなか（180, 250）に 3倍で おく
SCALE = 3.0
OX = 180 - 54.5 * SCALE
OY = 250 - 54.5 * SCALE

# 字の じゅんばん：かんたんな字 → あいうえお順
ORDER = "しつくへのてこいりと" + "あうえおかきけさすせそたちなにぬねはひふほまみむめもやゆよらるれろわをん"

# その字の ことば（words の中で その字に色がつく）
WORDS = {
    "あ": [("🐜", "あり"), ("🍬", "あめ")],
    "い": [("🐶", "いぬ"), ("🍓", "いちご")],
    "う": [("🐮", "うし"), ("🌊", "うみ")],
    "え": [("🦐", "えび"), ("🚉", "えき")],
    "お": [("🍙", "おにぎり"), ("👹", "おに")],
    "か": [("🐸", "かえる"), ("☂️", "かさ")],
    "き": [("🦊", "きつね"), ("🍄", "きのこ")],
    "く": [("🐻", "くま"), ("🚗", "くるま")],
    "け": [("🎂", "けーき"), ("🐛", "けむし")],
    "こ": [("🐨", "こあら"), ("🥛", "こっぷ")],
    "さ": [("🐟", "さかな"), ("🐒", "さる")],
    "し": [("🦌", "しか"), ("🚄", "しんかんせん")],
    "す": [("🍉", "すいか"), ("🍣", "すし")],
    "せ": [("🧼", "せっけん"), ("🛤️", "せんろ")],
    "そ": [("☁️", "そら"), ("🛷", "そり")],
    "た": [("🐙", "たこ"), ("🥚", "たまご")],
    "ち": [("🦋", "ちょうちょ"), ("🧀", "ちーず")],
    "つ": [("🌙", "つき"), ("🧱", "つみき")],
    "て": [("🖐️", "て"), ("📺", "てれび")],
    "と": [("🍅", "とまと"), ("⏰", "とけい")],
    "な": [("🍆", "なす"), ("🍐", "なし")],
    "に": [("🐔", "にわとり"), ("🥕", "にんじん")],
    "ぬ": [("🧸", "ぬいぐるみ"), ("🎨", "ぬりえ")],
    "ね": [("🐱", "ねこ"), ("🐭", "ねずみ")],
    "の": [("🚃", "のりもの"), ("🌾", "のはら")],
    "は": [("🌸", "はな"), ("🦷", "は")],
    "ひ": [("🐤", "ひよこ"), ("✈️", "ひこうき")],
    "ふ": [("🎈", "ふうせん"), ("⛵", "ふね")],
    "へ": [("🐍", "へび"), ("🚁", "へりこぷたー")],
    "ほ": [("⭐", "ほし"), ("📚", "ほん")],
    "ま": [("🪟", "まど"), ("🫘", "まめ")],
    "み": [("🍊", "みかん"), ("💧", "みず")],
    "む": [("🐛", "むし"), ("🌾", "むぎ")],
    "め": [("👓", "めがね"), ("👁️", "め")],
    "も": [("🍑", "もも"), ("🌳", "もり")],
    "や": [("🐐", "やぎ"), ("⛰️", "やま")],
    "ゆ": [("⛄", "ゆきだるま"), ("❄️", "ゆき")],
    "よ": [("🌃", "よる"), ("🪀", "よーよー")],
    "ら": [("🦁", "らいおん"), ("📻", "らじお")],
    "り": [("🍎", "りんご"), ("🐿️", "りす")],
    "る": [("🔍", "るーぺ"), ("💎", "るびー")],
    "れ": [("🍋", "れもん"), ("🚂", "れっしゃ")],
    "ろ": [("🚀", "ろけっと"), ("🕯️", "ろうそく")],
    "わ": [("🐊", "わに"), ("🐕", "わんわん")],
    "を": [("📖", "ほんを よむ"), ("🍙", "ごはんを たべる")],
    "ん": [("🍞", "ぱん"), ("🍊", "みかん")],
}

# 1かくで かける字は、手づくりの線を そのまま つかう（2026-11-07 代表：いまのままでOK）
HANDMADE = {
    "し": "M140 110 V310 Q140 390 210 382 Q260 375 292 320",
    "つ": "M65 205 Q200 140 268 190 Q320 240 262 310 Q222 352 160 352",
    "く": "M235 100 Q170 175 118 250 Q170 325 235 400",
    "へ": "M45 300 Q95 220 130 185 Q150 168 172 190 L318 345",
    "の": "M190 150 Q175 260 125 330 Q92 372 72 318 Q52 222 152 170 Q262 140 300 232 Q328 330 215 382",
    "て": "M60 150 Q170 150 300 118 Q185 195 162 282 Q150 372 245 382",
}

TOKEN = re.compile(r"[MmLlHhVvCcSsQqTtZz]|-?(?:\d*\.\d+|\d+\.?)(?:[eE]-?\d+)?")


def fmt(n):
    s = f"{n:.1f}"
    return s[:-2] if s.endswith(".0") else s


def transform(d):
    """SVG の線の書き方を、拡大・移動した 座標に 書きかえる"""
    out, cmd, nums = [], None, []
    tokens = TOKEN.findall(d)

    def flush():
        if cmd is None:
            return
        rel = cmd.islower()
        c = cmd.upper()
        vals = []
        for i, v in enumerate(nums):
            v = float(v)
            if c == "H":
                vals.append(v * SCALE + (0 if rel else OX))
            elif c == "V":
                vals.append(v * SCALE + (0 if rel else OY))
            else:
                vals.append(v * SCALE + (0 if rel else (OX if i % 2 == 0 else OY)))
        out.append(cmd + " ".join(fmt(v) for v in vals))

    for t in tokens:
        if t.isalpha():
            flush()
            cmd, nums = t, []
        else:
            nums.append(t)
    flush()
    return " ".join(out)


def strokes_of(svg_text, code):
    found = re.findall(rf'id="kvg:{code}-s(\d+)"[^>]*\sd="([^"]+)"', svg_text)
    found.sort(key=lambda x: int(x[0]))
    return [transform(d) for _, d in found]


def main(folder):
    items = []
    for ch in ORDER:
        code = format(ord(ch), "05x")
        if ch in HANDMADE:
            items.append({"char": ch, "strokes": [HANDMADE[ch]],
                          "words": [{"icon": i, "word": w} for i, w in WORDS[ch]]})
            continue
        with open(os.path.join(folder, f"{code}.svg"), encoding="utf-8") as f:
            strokes = strokes_of(f.read(), code)
        if not strokes:
            raise SystemExit(f"{ch} の線が見つかりません")
        words = [{"icon": i, "word": w} for i, w in WORDS[ch]]
        items.append({"char": ch, "strokes": strokes, "words": words})

    head = """/* =========================================================
   ひらがな なぞり の データ（46字）
   ---------------------------------------------------------
   ・このファイルは tools/build_hiragana.py で 自動で 作っています。
     直すときは スクリプトを 直して 作りなおしてください。
   ・strokes：かきじゅん の じゅんばんに 1かくずつ（SVGの線の書き方）
   ・words：その字の ことば（かけたあとに 出る。さわると よみあげ）

   書き順の線のデータ：KanjiVG
     Copyright (C) 2009-2026 Ulrich Apel
     https://kanjivg.tagaini.net/
     ライセンス：CC BY-SA 3.0 https://creativecommons.org/licenses/by-sa/3.0/
     加工：アプリの画面に合わせて 線の座標を 拡大・移動しました。
   ※ 1かくの字（し つ く へ の て）は 手づくりの線（KanjiVG ではない）
   このファイル（加工したデータ）も CC BY-SA 3.0 で 公開します。
   ========================================================= */
const HIRAGANA = [
"""
    lines = []
    for it in items:
        lines.append("  " + json.dumps(it, ensure_ascii=False) + ",")
    out = head + "\n".join(lines) + "\n];\n"
    dest = os.path.join(os.path.dirname(__file__), "..", "kids-app", "hiragana.js")
    with open(dest, "w", encoding="utf-8") as f:
        f.write(out)
    print(f"{len(items)}字 を書き出しました → {os.path.normpath(dest)}")


if __name__ == "__main__":
    main(sys.argv[1])
