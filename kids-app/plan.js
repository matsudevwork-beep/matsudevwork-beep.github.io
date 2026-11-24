/* =========================================================
   プラン（無料／トライアル／有料）を きめる ところ（2026-11-24 代表）
   ---------------------------------------------------------
   ・アプリの中で「無料なら…」を 書くときは、かならず ここの 関数に 聞く（判定は ここ 1か所だけ）
   ・きめ方（上から じゅんに 見る）
       1. 有料の しるし（サーバーが「払っている」と答えた）が 期限内 → "paid"
       2. トライアルを はじめて 7日 以内                         → "trial"（中身は 有料と おなじ）
       3. それ以外                                               → "free"
   ・保存は 端末の中（localStorage "bunyu-plan-v1"）。子どもの情報は 入れない
   ・値段（PRICES）・上限（LIMITS）・無料の はんい（FREE_STAGE）も ここだけで かえる
   ・ブラウザでも node（テスト）でも 読める
   【正直な弱点】コードは公開なので、くわしい人なら しるし を 書きかえられる。
     「払ってくれた人への お礼」と考える（2026-11-12・11-21 と おなじ）
   ========================================================= */
(function () {
  const DAY = 24 * 60 * 60 * 1000;
  const PLAN_KEY = "bunyu-plan-v1";
  const TRIAL_DAYS = 7;

  /* 無料プランを 本番で はじめたか（2026-11-24）
     false のあいだは「無料β」：だれでも ぜんぶ 使える（今までと おなじ）。無料版を 公開する日に true にする
     パソコン（localhost）では いつも 本当の 判定（無料・トライアル・有料を ためせる） */
  const FREE_PLAN_LIVE = false;

  // 値段（税こみ・円）。先着50家庭の 値段も ここ（2026-11-14 代表決定）
  const PRICES = { monthly: 780, yearly: 7800, founderMonthly: 580, founderYearly: 5800, founderSeats: 50 };

  // プランごとの 上限（2026-11-24 代表：無料は 子ども1人・あいぼう1体・レベル5）
  const LIMITS = {
    free: { kids: 1, pets: 1, maxStage: 5, offline: false },
    paid: { kids: 3, pets: 3, maxStage: 10, offline: true },
  };

  // 無料で つかえない もの（親の画面・にがて れんしゅう：11/15 決定のまま）
  const PAID_FEATURES = new Set(["review", "weeklyReport", "courseEdit"]);

  /* 各ジャンルの「ステージ1」（無料で 何回でも あそべる はんい）
     count：さいしょの なんもん（おやつ1こ分＝1セット）／ chars：この字だけ（アプリの字の じゅんばんは
     書きやすい順「し つ く へ の…」なので、あ行は 字で きめる）
     label：ステージ一覧に 出す ことば（[ステージ1, ステージ2〜]） */
  const FREE_STAGE = {
    line:    { count: 10, label: ["さいしょ の 10もん", "のこり の 51もん"] },
    hira:    { chars: "あいうえお", label: ["あ ぎょう", "か ぎょう から"] },
    read:    { count: 5, label: ["さいしょ の ことば 5こ", "ことば と みじかい ぶん"] },
    story:   { count: 1, label: ["1わめ", "2わめ から"] },
    kata:    { chars: "アイウエオ", label: ["ア ぎょう", "カ ぎょう から"] },
    num:     { count: 5, label: ["1〜5", "6〜10"] },
    abc:     { count: 5, label: ["A〜E", "F〜Z"] },
    free:    { chars: "あいうえお", label: ["あ ぎょう", "ほか の 字"] },
    maze:    { count: 3, label: ["かんたん", "わかれみち が ふえる"] },
    count:   { count: 5, label: ["1〜5", "1〜10"] },
    balance: { count: 3, label: ["1〜3", "1〜5・1〜10"] },
    dots:    { count: 3, label: ["1〜5", "1〜13・1〜20"] },
    road:    { count: 3, label: ["3×3", "4×4"] },
    clock:   { count: 3, label: ["〇じ", "〇じ はん・〇ふん"] },
    draw:    { count: 2, label: ["さいしょ の 2だい", "ほか の おだい"] },
    calc:    { count: 5, label: ["かんたん", "むずかしい"] },
    code:    { count: 3, label: ["かんたん", "いわ・くりかえし"] },
    shape:   { count: 3, label: ["おなじ に ぬる", "かがみ"] },
    eng:     { count: 1, label: ["さいしょ の テーマ", "ほか の テーマ"] },
  };

  // Codex 2026-11-24：*.localhost は はずす（この 3つ だけ）
  // 開発用の住所（Cloudflare の bunyu-dev）。名前で 1つ だけ 指定する（2026-11-24 代表：本番と開発の2つ）
  const DEV_HOSTS = ["bunyu-dev.matsu-dev-work.workers.dev"];
  const isDevHost = (host) => host === "localhost" || host === "127.0.0.1" || host === "[::1]" || DEV_HOSTS.includes(host);

  function planOf(rec, now, opt = {}) {
    rec = rec || {};
    if (opt.dev && ["free", "trial", "paid"].includes(rec.devPlan)) return rec.devPlan;
    const live = typeof opt.live === "boolean" ? opt.live : FREE_PLAN_LIVE;
    if (!live && !opt.dev) return "beta";   // 無料β：ぜんぶ 使える（上限は 有料と おなじ）
    if (rec.paid && typeof rec.paid.until === "number" && now < rec.paid.until) return "paid";
    if (typeof rec.trialStart === "number" && now >= rec.trialStart && now < rec.trialStart + TRIAL_DAYS * DAY) return "trial";
    return "free";
  }
  const limitsOf = (plan) => (plan === "free" ? LIMITS.free : LIMITS.paid);
  const canUse = (plan, feature) => plan !== "free" || !PAID_FEATURES.has(feature);

  function trialDaysLeft(rec, now) {
    if (!rec || typeof rec.trialStart !== "number") return 0;
    const left = rec.trialStart + TRIAL_DAYS * DAY - now;
    return left > 0 ? Math.ceil(left / DAY) : 0;
  }
  // 1台で 1回だけ
  function startTrial(rec, now) {
    if (typeof rec.trialStart === "number") return false;
    rec.trialStart = now;
    return true;
  }

  // 無料のとき、n ばんめ（すすみ）を ステージ1 の中の ばんごうに する（count 型）
  function freeIndex(type, n) {
    const s = FREE_STAGE[type];
    const c = (s && (s.count || (s.chars && [...s.chars].length))) || 1;
    return ((n % c) + c) % c;
  }
  // 字で きめた ステージ1 のとき、list の 何ばんめ を 出すか
  function freeItemIndex(type, n, list) {
    const s = FREE_STAGE[type];
    if (!s || !s.chars) return freeIndex(type, n);
    const idx = [...s.chars].map((ch) => list.findIndex((x) => x.char === ch)).filter((i) => i >= 0);
    if (!idx.length) return 0;
    return idx[((n % idx.length) + idx.length) % idx.length];
  }
  function inFreeStage(type, list, i) {
    const s = FREE_STAGE[type];
    if (!s) return true;
    if (s.chars) return !!list[i] && s.chars.includes(list[i].char);
    return i < s.count;
  }

  const api = {
    DAY, PLAN_KEY, TRIAL_DAYS, FREE_PLAN_LIVE, PRICES, LIMITS, FREE_STAGE, PAID_FEATURES,
    isDevHost, planOf, limitsOf, canUse, trialDaysLeft, startTrial, freeIndex, freeItemIndex, inFreeStage,
  };

  /* ---- ブラウザで つかう ところ（localStorage に 保存） ---- */
  if (typeof window !== "undefined") {
    const dev = () => isDevHost(location.hostname);
    const load = () => { try { return JSON.parse(localStorage.getItem(PLAN_KEY) || "{}") || {}; } catch (e) { return {}; } };
    const save = (rec) => { try { localStorage.setItem(PLAN_KEY, JSON.stringify(rec)); } catch (e) {} };
    Object.assign(api, {
      dev, load, save,
      current: () => planOf(load(), Date.now(), { dev: dev() }),
      limits: () => limitsOf(api.current()),
      isFree: () => api.current() === "free",
      can: (feature) => canUse(api.current(), feature),
      daysLeft: () => trialDaysLeft(load(), Date.now()),
      trialUsed: () => typeof load().trialStart === "number",
      beginTrial: () => { const r = load(); const ok = startTrial(r, Date.now()); if (ok) save(r); return ok; },
      setDevPlan: (p) => { if (!dev()) return; const r = load(); if (p) r.devPlan = p; else delete r.devPlan; save(r); },
    });
    window.Plan = api;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
