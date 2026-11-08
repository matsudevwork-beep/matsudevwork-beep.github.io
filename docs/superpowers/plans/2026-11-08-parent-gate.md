# 保護者のカギ（計算問題）と感想ボタン Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保護者メニューを「2びょう ながおし」のあと、大人だけが解ける かけざん に正解しないと開けないようにし、保護者メニューに感想フォームへのボタンを置く。

**Architecture:** 問題づくりと答えあわせは新しいファイル `kids-app/parent-gate.js`（画面に関係しない小さな関数だけ。ブラウザと node の両方で読める）。画面（モーダル・数字ボタン）は既存の `index.html` / `style.css` / `app.js` に、今の `parent-menu` と同じ作りで足す。ながおし（2秒）は残し、その後に問題を出す。

**Tech Stack:** ビルドなしの HTML/CSS/JavaScript、テストは node 24 の `node --test`。

**Spec:** `../plan/2026-11-07_roadmap-design.md`（リポジトリの外：`08_kids-app/plan/`）の「4. 次に作る機能」1・4

## Global Constraints
- 子どもの個人情報は持たない。外部解析ツールは入れない。感想はフォームのリンクを開くだけ（アプリから何も送らない）
- 外部リンクは保護者メニューの中（＝カギのあと）だけに置く（Apple のキッズカテゴリ：外へのリンクと課金の前にペアレンタルゲート）
- 画面の文字は、子ども向けはひらがな。保護者向けの説明は漢字まじりでよい（今の保護者メニューと同じ）
- 変更したら `sw.js` の `CACHE` の番号を上げ、`FILES` に新しいファイルを足す
- 公開リポジトリ：秘密情報は入れない。フォームのURLは公開されてよいものだけ

## Review Focus
1. ながおしの途中で指をはなした → 問題は出ない（今の動きのまま）
2. まちがえた答え → 「ちがいます」と出て、**別の問題**に変わる（同じ問題で当てずっぽうをくり返させない）
3. 数字を3けた以上おした → 2けたまでしか入らない／「けす」で1文字けせる
4. 問題を「とじる」で閉じて、また開く → 新しい問題になる
5. `FEEDBACK_URL` が空 → 感想ボタンは出ない（まちがったリンクを出さない）

---

### Task 1: 問題づくりと答えあわせ（parent-gate.js）

**Files:**
- Create: `kids-app/parent-gate.js`
- Test: `tests/parent-gate.test.js`

**Interfaces:**
- Produces:
  - `makeGateQuestion(rand = Math.random) -> { a: number, b: number, answer: number, text: string }`
    - `a` は 3〜9、`b` は 3〜9 の整数、`answer = a * b`（9〜81）、`text` は `"${a} × ${b} は？"`
  - `checkGateAnswer(question, input: string) -> boolean`（`input` は数字の文字列。前後の空白は無視。数字以外がまざれば false）
  - ブラウザでは `window.ParentGate = { makeGateQuestion, checkGateAnswer }`、node では `module.exports` に同じもの

- [ ] **Step 1: 失敗するテストを書く**（`node:test` と `node:assert`。`require("../kids-app/parent-gate.js")`）
  - `makeGateQuestion uses 3..9`：`rand` に 0 → a=3,b=3,answer=9／0.9999 → a=9,b=9,answer=81
  - `text format`：`rand=()=>0` のとき `text === "3 × 3 は？"`
  - `random range`：1000回つくって すべて 3≤a≤9, 3≤b≤9, answer===a*b
  - `checkGateAnswer`：`{answer:42}` に `"42"`→true、`" 42 "`→true、`"24"`→false、`""`→false、`"4a"`→false、`"042"`→false
- [ ] **Step 2: 失敗を確かめる** — Run: `node --test tests/` → FAIL（Cannot find module）
- [ ] **Step 3: `kids-app/parent-gate.js` を書く**（`a = 3 + Math.floor(rand() * 7)`、b も同じ。答えあわせは `/^\d{1,2}$/` のあと `Number(input) === q.answer`、"042" は3けたなので false）
- [ ] **Step 4: 通ることを確かめる** — Run: `node --test tests/` → PASS
- [ ] **Step 5: Commit** — `git add kids-app/parent-gate.js tests/parent-gate.test.js && git commit -m "保護者のカギ：かけざんの問題づくりと答えあわせ"`

### Task 2: カギの画面・感想ボタンをつなぐ

**Files:**
- Modify: `kids-app/index.html`（`parent-menu` の前に `gate-modal` を追加／`parent-close` の前に感想ボタン／`<script src="parent-gate.js">` を `app.js` の前に）
- Modify: `kids-app/app.js:1705-1721`（ながおし完了で `openParentMenu()` → `openGate()` に変える）
- Modify: `kids-app/style.css`（数字ボタンの並び）
- Modify: `kids-app/sw.js`（`CACHE` の番号を1つ上げ、`FILES` に `"parent-gate.js"`）

**Interfaces:**
- Consumes: `window.ParentGate.makeGateQuestion()`, `window.ParentGate.checkGateAnswer(q, input)`
- Produces: `openGate()`（app.js 内）、`const FEEDBACK_URL = ""`（app.js の先頭近く。代表がフォームを作ったら入れる）

画面のきまり（文言はこのとおり）：
- タイトル「おうちの かたへ」、説明「保護者メニューを開くには、答えを入れてください」、問題 `q.text`（大きく）
- 入力欄（表示だけ）＋数字ボタン 1〜9・0 と「けす」「こたえる」。2けたまで
- まちがい：「ちがいます。もう一度どうぞ」と出し、新しい問題に変え、入力を空に
- 正解：`gate-modal` を閉じて `openParentMenu()`
- 「とじる」ボタンで閉じる。開くたびに新しい問題
- 感想ボタン：文言「アプリの感想を送る（フォームが開きます）」、`FEEDBACK_URL` が空なら `hidden`、押すと `window.open(FEEDBACK_URL, "_blank", "noopener")`
- 数字ボタンを押しても音声の読み上げはしない（子どもに答えのヒントを与えない）

- [ ] **Step 1: 上のとおりに3ファイルを直す**（既存の `.modal` `.modal-card` `.big-btn` `.sub-btn` を使う）
- [ ] **Step 2: テストを流す** — Run: `node --test tests/` → PASS（Task 1 がこわれていない）
- [ ] **Step 3: ブラウザで確かめる**（`python3 -m http.server` で `kids-app/` を開き、スマホ幅 375px で）：Review Focus 1〜5 と、正解で保護者メニューが開くこと、コンソールにエラーがないこと
- [ ] **Step 4: Commit** — `git commit -m "保護者メニューの前に かけざん の カギ、感想ボタン（URLは あとで）"`（push は代表の確認のあと）
