// プラン（無料／トライアル／有料）の判定のテスト。実行：node --test tests/
const test = require("node:test");
const assert = require("node:assert");
const P0 = require("../kids-app/plan.js");
// 下の テスト は 無料プランを 始めた あと（live）の 判定 を みる
const P = { ...P0, planOf: (r, n, o = {}) => P0.planOf(r, n, { live: true, ...o }) };

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 11, 1);

test("何もなければ 無料", () => {
  assert.strictEqual(P.planOf({}, NOW), "free");
});

test("トライアルは 3日間だけ、すぎたら 無料に もどる", () => {
  const rec = { trialStart: NOW };
  assert.strictEqual(P.TRIAL_DAYS, 3);
  assert.strictEqual(P.planOf(rec, NOW + 2 * DAY), "trial");
  assert.strictEqual(P.planOf(rec, NOW + 3 * DAY - 1), "trial");
  assert.strictEqual(P.planOf(rec, NOW + 3 * DAY), "free");
  assert.strictEqual(P.trialDaysLeft(rec, NOW + 0.5 * DAY), 3);
  assert.strictEqual(P.trialDaysLeft(rec, NOW + 2.5 * DAY), 1);
  assert.strictEqual(P.trialDaysLeft(rec, NOW + 4 * DAY), 0);
});

test("トライアルは 1台で 1回だけ", () => {
  const rec = {};
  assert.strictEqual(P.startTrial(rec, NOW), true);
  assert.strictEqual(P.startTrial(rec, NOW + 30 * DAY), false);
  assert.strictEqual(rec.trialStart, NOW);
});

test("有料の しるし が 期限内なら 有料（トライアルより 強い）", () => {
  const rec = { trialStart: NOW, paid: { until: NOW + 40 * DAY } };
  assert.strictEqual(P.planOf(rec, NOW + 1 * DAY), "paid");
  assert.strictEqual(P.planOf(rec, NOW + 41 * DAY), "free");
});

test("開発用の切りかえは localhost のときだけ きく", () => {
  const rec = { devPlan: "paid" };
  assert.strictEqual(P.planOf(rec, NOW, { dev: false }), "free");
  assert.strictEqual(P.planOf(rec, NOW, { dev: true }), "paid");
  assert.strictEqual(P.planOf({ devPlan: "zzz" }, NOW, { dev: true }), "free");
  assert.strictEqual(P.isDevHost("localhost"), true);
  assert.strictEqual(P.isDevHost("127.0.0.1"), true);
  assert.strictEqual(P.isDevHost("bunyu.pages.dev"), false);
  assert.strictEqual(P.isDevHost("localhost.evil.com"), false);
});

test("上限：無料は 子ども1人・あいぼう1体・レベル5、有料とトライアルは 3・3・10", () => {
  assert.deepStrictEqual(
    [P.limitsOf("free").kids, P.limitsOf("free").pets, P.limitsOf("free").maxStage, P.limitsOf("free").offline],
    [1, 1, 5, false]);
  for (const p of ["trial", "paid"]) {
    const l = P.limitsOf(p);
    assert.deepStrictEqual([l.kids, l.pets, l.maxStage, l.offline], [3, 3, 10, true]);
  }
});

test("値段は 1か所に まとまっている", () => {
  assert.deepStrictEqual(P.PRICES, { monthly: 780, yearly: 7800, founderMonthly: 580, founderYearly: 5800, founderSeats: 50 });
});

test("19ジャンル ぜんぶに ステージ1 の はんい が ある", () => {
  const types = ["line", "read", "story", "draw", "hira", "kata", "num", "maze", "clock", "calc", "code",
    "abc", "eng", "shape", "free", "count", "balance", "dots", "road"];
  assert.strictEqual(types.length, 19);
  for (const t of types) assert.ok(P.FREE_STAGE[t], t);
});

test("ステージ1 の 中で くりかえす（無料）", () => {
  // かず は 5もん → 6もんめ は 1もんめ に もどる
  assert.strictEqual(P.freeIndex("count", 0), 0);
  assert.strictEqual(P.freeIndex("count", 4), 4);
  assert.strictEqual(P.freeIndex("count", 5), 0);
  assert.strictEqual(P.freeIndex("count", 12), 2);
});

test("字で きめた ステージ1（ひらがな あ行）", () => {
  const list = [{ char: "し" }, { char: "あ" }, { char: "つ" }, { char: "い" }, { char: "う" }, { char: "え" }, { char: "お" }, { char: "か" }];
  assert.deepStrictEqual([0, 1, 2, 3, 4, 5].map((n) => list[P.freeItemIndex("hira", n, list)].char),
    ["あ", "い", "う", "え", "お", "あ"]);
  assert.strictEqual(P.inFreeStage("hira", list, 1), true);   // あ
  assert.strictEqual(P.inFreeStage("hira", list, 7), false);  // か
});

test("にがて れんしゅう は 無料では つかえない", () => {
  assert.strictEqual(P.canUse("free", "review"), false);
  assert.strictEqual(P.canUse("trial", "review"), true);
  assert.strictEqual(P.canUse("free", "hira"), true);
});

test("無料プランを始めるまでは 無料β（ぜんぶ 使える）。パソコンでは 本当の 判定", () => {
  assert.strictEqual(P0.FREE_PLAN_LIVE, false);
  assert.strictEqual(P0.planOf({}, NOW), "beta");
  assert.strictEqual(P0.limitsOf("beta").maxStage, 10);
  assert.strictEqual(P0.canUse("beta", "review"), true);
  assert.strictEqual(P0.planOf({}, NOW, { dev: true }), "free");
});
