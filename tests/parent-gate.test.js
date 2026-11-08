// 保護者のカギ（かけざん）のテスト。実行：node --test tests/
const test = require("node:test");
const assert = require("node:assert");
const { makeGateQuestion, checkGateAnswer } = require("../kids-app/parent-gate.js");

test("makeGateQuestion uses 3..9", () => {
  const lo = makeGateQuestion(() => 0);
  assert.deepStrictEqual([lo.a, lo.b, lo.answer], [3, 3, 9]);
  const hi = makeGateQuestion(() => 0.9999);
  assert.deepStrictEqual([hi.a, hi.b, hi.answer], [9, 9, 81]);
});

test("text format", () => {
  assert.strictEqual(makeGateQuestion(() => 0).text, "3 × 3 は？");
});

test("random range", () => {
  for (let i = 0; i < 1000; i++) {
    const q = makeGateQuestion();
    assert.ok(q.a >= 3 && q.a <= 9 && Number.isInteger(q.a));
    assert.ok(q.b >= 3 && q.b <= 9 && Number.isInteger(q.b));
    assert.strictEqual(q.answer, q.a * q.b);
  }
});

test("checkGateAnswer", () => {
  const q = { answer: 42 };
  assert.strictEqual(checkGateAnswer(q, "42"), true);
  assert.strictEqual(checkGateAnswer(q, " 42 "), true);
  assert.strictEqual(checkGateAnswer(q, "24"), false);
  assert.strictEqual(checkGateAnswer(q, ""), false);
  assert.strictEqual(checkGateAnswer(q, "4a"), false);
  assert.strictEqual(checkGateAnswer(q, "042"), false);
});
