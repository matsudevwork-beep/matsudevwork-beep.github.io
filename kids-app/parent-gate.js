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

  const api = { makeGateQuestion, checkGateAnswer };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.ParentGate = api;
})();
