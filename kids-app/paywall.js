/* =========================================================
   無料プラン の カギ・ロック画面・料金・トライアル・有料の確認（2026-11-24 代表）
   ---------------------------------------------------------
   ・プラン の 判定 は plan.js（Plan）だけ。ここ は 画面 と ながれ
   ・子ども が 見る ロック画面 には 料金 を 出さない。「おうちの ひとに みせる」→ 保護者のカギ（かけざん）→ 料金
     （2026-11-24 代表：保護者のカギの先。11/15 決定：子どもは とまらない）
   ・有料 の 確認：親 の メールアドレス ＋ 6けた の 確認コード（サーバー：worker/）。
     メールアドレス は 端末 に 保存 しない。のこす の は「確認ずみ の しるし」と 期限 だけ
   ・1家族 5台 まで（サーバー が かぞえる）
   ========================================================= */

// 支払いページ（Stripe の 支払いリンク）。代表 が Stripe で 作ったら 入れる。空 の あいだ は「準備中」
// 本番（お金 が 動く）。本番 の 申請 の あと に 入れる
const PAY_LINKS_LIVE = { monthly: "", yearly: "", founderMonthly: "", founderYearly: "" };
// テスト（お金 は 動かない）。開発用 の 住所 と パソコン だけ で つかう（2026-11-26 代表 が 作成。秘密 では ない）
const PAY_LINKS_TEST = {
  monthly: "https://buy.stripe.com/test_fZucN43RL2n3dbfbNk6kg00",   // 月額 780円
  yearly: "https://buy.stripe.com/test_00w14m8819PvgnraJg6kg01",    // 年額 7,800円
  founderMonthly: "", founderYearly: "",
};
const PAY_LINKS = Plan.dev() ? PAY_LINKS_TEST : PAY_LINKS_LIVE;
// 解約・カード の 変更（Stripe の カスタマーポータル。購入 した メールアドレス で 入る）2026-11-26 代表 が 作成
const PORTAL_LINK = Plan.dev() ? "https://billing.stripe.com/p/login/test_fZucN43RL2n3dbfbNk6kg00" : "";   // 本番 は 申請 の あと
const PAY_API = "/api/paid";
const PAID_RECHECK_MS = 3 * Plan.DAY;   // 3日 に 1かい、まだ 払って いるか 聞きなおす

const yen = (n) => n.toLocaleString("ja-JP");
// カギ の 絵（2026-11-24 代表：絵文字 では なく かわいい 絵 に。img/ui/lock.svg は オリジナル）
const lockIcon = (cls = "lock-badge") => `<img class="${cls}" src="img/ui/lock.svg" alt="カギ">`;

/* ---------- 子ども が 見る ところ ---------- */
function petLocked(type) {
  return Plan.isFree() && !!state.petType && type !== state.petType;
}

// ロック画面（子ども 向け）。kind：stage／feature／pet／kid／petlevel
function childLock(kind, type, stageNo) {
  Track.track("lock_view", { g: type || kind, s: stageNo || 0 });
  const text = "ここから さきは<br>おうちの ひとと いっしょに あけてね";
  showModal(`<div class="lock-art"><div class="big-pet">${state.petType ? makePetSVG(state.petType, state.stage) : ""}</div>${lockIcon("lock-key")}</div>`,
    text, "おうちの ひとに みせる", () => openGate(() => openPlanModal(kind)),
    "もどる", () => {});
  speak("ここから さきは おうちの ひとと いっしょに あけてね", true);
}

// べんきょう の タイル を おした とき
function openStudy(type) {
  if (!Plan.can(type)) { childLock("feature", type, 0); return; }
  if (freeLimited(type)) { stageSheet(type); return; }
  startType(type);
}

// ステージ の いちらん（無料 の とき だけ。有料 は 今まで どおり すぐ はじまる）
function stageSheet(type) {
  const [l1, l2] = Plan.FREE_STAGE[type].label;
  const art = `<div class="stage-list">
    <div class="stage-row open"><b>ステージ 1</b><span>${l1}</span><em>▶</em></div>
    <div class="stage-row locked"><b>ステージ 2〜</b><span>${l2}</span><em>${lockIcon("lock-inline")}</em></div></div>`;
  showModal(art, STUDY[type].name, "▶ ステージ1 で あそぶ", () => startType(type),
    "ステージ2 を ひらく", () => childLock("stage", type, 2));
  $("modal-btn2").insertAdjacentHTML("afterbegin", lockIcon("lock-inline") + " ");
}

// 無料 の レベル5 で おなか が いっぱい に なった とき（1日1かい だけ ロック画面）
function petAtCap() {
  sayPet($("bubble"), "いっぱい たべたね！ ぼく もっと おおきく なれるんだ", true);
  const rec = Plan.load();
  if (rec.capDay === todayKey()) return;
  rec.capDay = todayKey();
  Plan.save(rec);
  setTimeout(() => childLock("petlevel", "pet", Plan.limits().maxStage + 1), 2600);
}

/* トライアル の 最終日 と おわった あと（2026-11-26 代表：続けたい・続けさせたい と 思える ように）
   ホーム に きた とき、あいぼう が「おうちの ひとに みせてね」→ カギ → 3日間のようす（app.js の showTrialSummary）
   ・最終日 は 1かい、おわった あと は 見て もらう まで 1日1かい（3日 まで）。子ども に お金 の 話 は しない */
function maybeTrialEnd() {
  if (!currentScreenIs("home") || !$("modal").classList.contains("hidden")) return;
  if (kidThanks()) return;
  const plan = Plan.current(), rec = Plan.load(), today = todayKey();
  if (!Plan.trialUsed() || rec.trialAskDay === today) return;
  const lastDay = plan === "trial" && Plan.daysLeft() === 1 && !rec.trialLastAsked;
  const ended = plan === "free" && !rec.trialSummarySeen && (rec.trialEndAsks || 0) < 3;
  if (!lastDay && !ended) return;
  rec.trialAskDay = today;
  if (lastDay) rec.trialLastAsked = true; else rec.trialEndAsks = (rec.trialEndAsks || 0) + 1;
  Plan.save(rec);
  const text = "3にち いっしょに がんばったね！<br>おうちの ひとに みせてね";
  showModal(`<div class="big-pet">${state.petType ? makePetSVG(state.petType, state.stage) : ""}</div>`,
    text, "おうちの ひとに みせる", () => openGate(() => showTrialSummary()), "あとで", () => {});
  speak("3にち いっしょに がんばったね！ おうちの ひとに みせてね", true);
}

/* 買って くれた 人 へ の「ありがとう」（2026-11-26 代表：感謝 を 伝えられる 画面）
   ・保護者：確認 が できた とき に 1かい。あいぼう 3体 が そろって、ひらいた もの と 代表 から の ひとこと
   ・子ども：「お子さまに見せる」か、つぎ に ホーム に きた とき、あいぼう が よろこぶ（お金 の 話 は しない） */
// 代表 から の ひとこと（【代表 が 直す】たたき台）
const THANKS_LETTER = "ぶにゅうは、3人の男の子を育てている母が、わが子と一緒に作っているアプリです。選んでくださって、本当にありがとうございます。毎月、新しい遊びとあいぼうを<span class=\"nobr\">お届けします。</span>「ここが使いにくい」「こんな遊びがほしい」など、<span class=\"nobr\">お気軽に</span>チャットへご連絡ください！";
// あいぼう 3体 は レベル を そろえる（2026-11-26 代表：レベル3）
const THANKS_STAGE = 3;
const thanksPets = () => Object.keys(PET_TYPES).map((t) => `<div class="thanks-pet">${makePetSVG(t, THANKS_STAGE)}</div>`).join("");
function showThanks() {
  const pets = thanksPets();
  $("thanks-pets").innerHTML = pets;
  const items = [
    "すべての遊びが、ぜんぶ",
    "すべてのあいぼう・レベル10まで",
    "きょうだい3人まで",
    "オフライン対応",
    "毎月、新作の遊びとあいぼうを追加！",
  ];
  $("thanks-list").innerHTML = items.map((x) => `<li>${x}</li>`).join("");
  $("thanks-letter").innerHTML = jpBreaks(THANKS_LETTER).replace(/(<span class="nobr">[^<]*)<wbr>/g, "$1");
  $("thanks-confetti").innerHTML = Array.from({ length: 24 }, (_, i) =>
    `<i style="left:${(i * 37) % 100}%;animation-delay:${(i % 8) * 0.25}s;background:${["#F6B26B", "#7EC8E3", "#F49AC1", "#9BD67B", "#FFD966"][i % 5]}"></i>`).join("");
  $("thanks-modal").classList.remove("hidden");
}
// 子ども：あいぼう が よろこぶ
function kidThanks() {
  const rec = Plan.load();
  if (!rec.thanksKid) return false;
  delete rec.thanksKid;
  Plan.save(rec);
  const pets = thanksPets();
  showModal(`<div class="thanks-pets kid">${pets}</div>`, "やったー！ ぜんぶの あそびが ひらいたよ！<br>これからも いっしょに あそぼうね", "うん！", () => {});
  speak("やったー！ ぜんぶの あそびが ひらいたよ！ これからも いっしょに あそぼうね", true);
  if (typeof petMood === "function") petMood("happy", 2600);
  return true;
}

/* ---------- 保護者 が 見る ところ（カギ の 先） ---------- */
const PLAN_REASON = {
  stage: "このステージから先は、有料プランで遊べます。",
  feature: "この遊びは、有料プランで遊べます。",
  pet: "あいぼうを3体から選べるのは、有料プランです。",
  petlevel: "無料プランでは、あいぼうはレベル5まで育ちます。有料プランではレベル10まで育ちます。",
  kid: "きょうだい（3人まで）は、有料プランで使えます。",
  report: "週のレポートは、有料プランで見られます。",
  course: "おけいこの中身を変えるのは、有料プランの機能です。",
  trialEnd: "3日間、遊んでくれてありがとうございました。この続きは有料プランで遊べます。",
};

function openPlanModal(reason) {
  const plan = Plan.current();
  const P = Plan.PRICES;
  const status = plan === "beta" ? "いまは無料β版です（すべての遊びを使えます）"
    : plan === "paid" ? "いまのプラン：有料プラン（ありがとうございます）"
    : plan === "trial" ? `いまのプラン：${Plan.TRIAL_DAYS}日間の無料トライアル中（あと${Plan.daysLeft()}日）`
    : Plan.trialUsed() ? "いまのプラン：無料プラン（トライアルは終わりました）" : "いまのプラン：無料プラン";
  $("plan-status").textContent = status;
  $("plan-reason").textContent = (reason && PLAN_REASON[reason]) || "";
  $("plan-prices").innerHTML = jpBreaks(
    `<b>もっと遊ぶには</b><br>月額 ${yen(P.monthly)}円 ／ 年額 ${yen(P.yearly)}円（税込・きょうだい3人まで・端末5台まで）`);
  const canTrial = plan === "free" && !Plan.trialUsed();
  $("plan-trial").classList.toggle("hidden", !canTrial);
  $("plan-trial-summary").classList.toggle("hidden", !(Plan.trialUsed() && (plan === "trial" || plan === "free")));
  const ready = !!(PAY_LINKS.monthly && PAY_LINKS.yearly);
  $("plan-buy-monthly").disabled = !ready;
  $("plan-buy-yearly").disabled = !ready;
  $("plan-buy-note").textContent = ready ? "お支払いは Stripe の画面で行います。カード情報は、このアプリには届きません。"
    : "お支払いの受付は準備中です（12月に始まる予定です）。";
  $("plan-buy").classList.toggle("hidden", plan === "paid" || plan === "beta");
  $("plan-release").classList.toggle("hidden", !Plan.load().paid);
  $("plan-portal").classList.toggle("hidden", !Plan.load().paid || !PORTAL_LINK);
  $("verify-portal").classList.toggle("hidden", !PORTAL_LINK);
  $("plan-to-verify").classList.toggle("hidden", plan === "paid" || plan === "beta");
  $("plan-track").checked = !Track.isOff();
  $("plan-dev").classList.toggle("hidden", !Plan.dev());
  $("plan-dev-select").value = Plan.load().devPlan || "";
  showVerifyStep("email");
  planView("main");
  $("plan-modal").classList.remove("hidden");
}


/* ---------- 有料 の 確認（メール ＋ 6けた の コード） ---------- */
function payDevice() {
  const rec = Plan.load();
  if (!rec.device) {
    rec.device = crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now().toString(36);
    Plan.save(rec);
  }
  return rec.device;
}
async function payApi(path, body) {
  const res = await fetch(`${PAY_API}/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 400 && res.status !== 403 && res.status !== 429) throw new Error("server");
  return res.json();
}
function showVerifyStep(step, msg) {
  $("verify-email-row").classList.toggle("hidden", step !== "email");
  $("verify-code-row").classList.toggle("hidden", step !== "code");
  $("verify-msg").textContent = msg || "";
  // 左 の ①②③ の いま の ところ を 太く
  const now = step === "email" ? 1 : step === "code" ? 2 : 3;
  [1, 2, 3].forEach((i) => $(`vstep-${i}`).classList.toggle("now", i === now));
}
// 料金 の 画面 の 2つ の 中身：main（始める）／verify（購入済みの方の確認）
// 2026-11-25 代表：メール の 欄 が スクロール しないと 見えず、わからない 人 が 出そう → 画面 を 分けて 入口 を めだたせる
function planView(view) {
  $("plan-main").classList.toggle("hidden", view !== "main");
  $("plan-verify").classList.toggle("hidden", view !== "verify");
  $("plan-title").textContent = view === "verify" ? "購入済みの方の確認" : "プラン";
  $("plan-modal").dataset.view = view;
}
function openVerify(msg) {
  planView("verify");
  showVerifyStep("email", msg);
  // ホーム画面 に 追加 した アプリ と Safari で は 記録 が 別 → Safari で ひらいて いる とき だけ 知らせる
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  $("verify-pwa-note").classList.toggle("hidden", standalone);
}
let verifyEmail = "";

// この 端末 の 有料 を 外す（5台 の 枠 を あける）

// ときどき「まだ 払って いるか」を 聞きなおす（解約 して いたら 無料 に もどる）
async function recheckPaid() {
  const rec = Plan.load();
  if (!rec.paid || !navigator.onLine || location.protocol !== "https:") return;
  if (Date.now() - (rec.paid.checkedAt || 0) < PAID_RECHECK_MS) return;
  try {
    const r = await payApi("refresh", { token: rec.paid.token, device: payDevice() });
    const now = Plan.load();
    if (r.ok && typeof r.until === "number") now.paid = { ...now.paid, until: r.until, checkedAt: Date.now() };
    else if (r.ok === false) delete now.paid;
    Plan.save(now);
    applyPlanToOffline();
  } catch (e) { /* つながらない とき は 期限 まで その まま */ }
}

/* ---------- ネット なし（有料・トライアル だけ ぜんぶ とっておく） ---------- */
function applyPlanToOffline() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready.then((reg) => {
    if (reg.active) reg.active.postMessage({ type: "plan", full: Plan.limits().offline });
  }).catch(() => {});
}

/* ---------- 保護者メニュー の プラン の ボタン ---------- */
function renderPlanNote() {
  const plan = Plan.current();
  $("parent-plan-note").textContent = plan === "beta" ? "（無料β版）"
    : plan === "paid" ? "（有料プラン）"
    : plan === "trial" ? `（トライアル あと${Plan.daysLeft()}日）` : "（無料プラン）";
  $("parent-report").classList.toggle("plan-locked", !Plan.can("weeklyReport"));
  $("parent-course-edit").classList.toggle("plan-locked", !Plan.can("courseEdit"));
}

/* ---------- ボタン を つなぐ・ひらいた とき（app.js の $ など が できて から） ---------- */
document.addEventListener("DOMContentLoaded", () => {
  // もどる：確認 の 画面 なら 始める 画面 へ、始める 画面 なら とじる
  $("plan-close").onclick = () => {
    if ($("plan-modal").dataset.view === "verify") { planView("main"); return; }
    $("plan-modal").classList.add("hidden");
  };
  $("plan-to-verify").onclick = () => { openVerify(); if (!$("app").classList.contains("rot")) setTimeout(() => $("verify-email").focus(), 50); };   // まわして いる とき は 欄 を おして から 入力 シート
  $("plan-trial").onclick = () => {
    if (!Plan.beginTrial()) return;
    const rec = Plan.load();
    rec.trialSnap = { pet: state.petType, stage: state.stage };   // 3日間のようす で「レベル2 → 4」を 出す
    Plan.save(rec);
    Track.track("trial_start");
    applyPlanToOffline();
    $("plan-modal").classList.add("hidden");
    $("parent-menu").classList.add("hidden");
    showModal(`<div class="big-pet">${state.petType ? makePetSVG(state.petType, state.stage) : ""}</div>`,
      jpBreaks(`${Plan.TRIAL_DAYS}日間の無料トライアルが始まりました。<br>すべての遊び・あいぼう3体・レベル10まで使えます。<br>${Plan.TRIAL_DAYS + 1}日目に自動で無料プランに戻ります（お金はかかりません）。<br>最終日に「${Plan.TRIAL_DAYS}日間のようす」をお見せします。`),
      "とじる", () => { if (currentScreenIs("study")) renderStudyMenu(); });
  };
  $("plan-buy-monthly").onclick = () => { if (PAY_LINKS.monthly) window.open(PAY_LINKS.monthly, "_blank", "noopener"); };
  const openPortal = () => { if (PORTAL_LINK) window.open(PORTAL_LINK, "_blank", "noopener"); };
  $("plan-portal").onclick = openPortal;
  $("verify-portal").onclick = openPortal;
  $("plan-buy-yearly").onclick = () => { if (PAY_LINKS.yearly) window.open(PAY_LINKS.yearly, "_blank", "noopener"); };
  $("plan-track").onchange = () => Track.setOff(!$("plan-track").checked);
  $("plan-dev-select").onchange = () => {
    Plan.setDevPlan($("plan-dev-select").value || null);
    applyPlanToOffline();
    openPlanModal();
  };
  $("verify-send").onclick = async () => {
    const email = $("verify-email").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) { showVerifyStep("email", "メールアドレスの形を確かめてください"); return; }
    verifyEmail = email;
    try {
      const r = await payApi("start", { email, device: payDevice() });
      if (r.error === "slow") { showVerifyStep("email", "回数が多すぎます。しばらくしてからお試しください"); return; }
      showVerifyStep("code", "ご購入が確認できたメールアドレスに、6けたの確認コードを送りました（10分間有効）。届かないときは、迷惑メールのフォルダもご確認ください。");
    } catch (e) { showVerifyStep("email", "いまは確認できません。ネットにつながっているか確かめて、もう一度お試しください"); }
  };
  $("verify-ok").onclick = async () => {
    const code = $("verify-code").value.trim();
    if (!/^\d{6}$/.test(code)) { showVerifyStep("code", "6けたの数字を入れてください"); return; }
    try {
      const r = await payApi("finish", { email: verifyEmail, code, device: payDevice() });
      if (r.ok && r.token && typeof r.until === "number") {
        const rec = Plan.load();
        const fromTrial = typeof rec.trialStart === "number";
        rec.paid = { token: r.token, until: r.until, checkedAt: Date.now() };
        verifyEmail = ""; $("verify-email").value = ""; $("verify-code").value = "";
        Track.track("paid_start", { fromTrial });
        applyPlanToOffline();
        rec.thanksKid = true;   // つぎ に ホーム に きた とき、あいぼう が よろこぶ
        Plan.save(rec);
        showVerifyStep("done", "確認できました。この端末で有料プランが使えます。ありがとうございます！");
        $("plan-modal").classList.add("hidden");
        showThanks();
        return;
      }
      showVerifyStep("code", r.error === "devices"
        ? "このご契約では、すでに5台で使われています。使っていない端末で「この端末の有料を外す」をしてから、もう一度お試しください"
        : r.error === "slow" ? "回数が多すぎます。しばらくしてからお試しください" : "コードが違うか、期限が切れています");
    } catch (e) { showVerifyStep("code", "いまは確認できません。もう一度お試しください"); }
  };
  $("verify-back").onclick = () => showVerifyStep("email");
  // キーボード の「改行・確定」で すすむ
  $("verify-email").onkeydown = (e) => { if (e.key === "Enter") $("verify-send").click(); };
  $("verify-code").onkeydown = (e) => { if (e.key === "Enter") $("verify-ok").click(); };
  $("plan-release").onclick = async () => {
    const rec = Plan.load();
    if (!rec.paid) return;
    if (!confirm("この端末の有料プランを外しますか？（記録は消えません。あとで同じメールアドレスで、また確認できます）")) return;
    try { await payApi("release", { token: rec.paid.token, device: payDevice() }); } catch (e) {}
    delete rec.paid;
    Plan.save(rec);
    applyPlanToOffline();
    openPlanModal();
  };
  $("parent-plan").onclick = () => openPlanModal();
  $("plan-trial-summary").onclick = () => showTrialSummary();
  $("thanks-close").onclick = () => { $("thanks-modal").classList.add("hidden"); if (currentScreenIs("study")) renderStudyMenu(); };
  $("thanks-kid").onclick = () => {
    $("thanks-modal").classList.add("hidden");
    $("parent-menu").classList.add("hidden");
    goHome();   // ホーム で あいぼう が よろこぶ（maybeTrialEnd → kidThanks）
  };
  (function onOpen() {
    const rec = Plan.load();
    // 無料β の あいだ は 数えない（無料プランが 始まってから、はじめて 無料で ひらいた ときに 1回）
    if (!rec.freeStarted && Plan.current() === "free") {
      rec.freeStarted = true;
      Plan.save(rec);
      Track.track("free_start");
    }
    applyPlanToOffline();
    recheckPaid();
    Track.flush();
    // Stripe で 払った あと もどって きた とき（支払いリンク の もどり先 を「…/?bought=1」に する）
    if (new URLSearchParams(location.search).get("bought") === "1") {
      history.replaceState(null, "", location.pathname);
      if (Plan.current() !== "paid") {
        openPlanModal();
        openVerify("お支払いありがとうございます。購入したときのメールアドレスを入れて、確認コードを受け取ってください。");
      }
    }
  })();
});
