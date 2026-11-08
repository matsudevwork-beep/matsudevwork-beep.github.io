/* 保護者のカギ：大人だけが解ける かけざん の問題
   問題づくりと答えあわせだけ（画面は app.js）。ブラウザでも node（テスト）でも読める */
(function () {
  // 3〜9 × 3〜9（答えは 9〜81 の2けたまで）。rand はテストで決まった値を入れるため
  function makeGateQuestion(rand = Math.random) {
    const a = 3 + Math.floor(rand() * 7);
    const b = 3 + Math.floor(rand() * 7);
    return { a, b, answer: a * b, text: `${a} × ${b} は？` };
  }

  // 入力は数字の文字列（1〜2けた）。前後の空白は気にしない
  function checkGateAnswer(question, input) {
    const s = String(input).trim();
    if (!/^\d{1,2}$/.test(s)) return false;
    return Number(s) === question.answer;
  }

  // 3回まちがえたら 30びょう こたえられない（あてずっぽう で とおれないように）
  const MAX_WRONG = 3, LOCK_MS = 30000;
  function registerWrong(s, now) {
    const wrong = s.wrong + 1;
    return wrong >= MAX_WRONG ? { wrong: 0, lockUntil: now + LOCK_MS } : { wrong, lockUntil: s.lockUntil };
  }
  function isLocked(s, now) { return now < s.lockUntil; }

  const api = { makeGateQuestion, checkGateAnswer, registerWrong, isLocked };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.ParentGate = api;
})();
