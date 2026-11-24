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
const PAY_LINKS = { monthly: "", yearly: "", founderMonthly: "", founderYearly: "" };
const PAY_API = "/api/paid";
const PAID_RECHECK_MS = 3 * Plan.DAY;   // 3日 に 1かい、まだ 払って いるか 聞きなおす

const yen = (n) => n.toLocaleString("ja-JP");

/* ---------- 子ども が 見る ところ ---------- */
function petLocked(type) {
  return Plan.isFree() && !!state.petType && type !== state.petType;
}

// ロック画面（子ども 向け）。kind：stage／feature／pet／kid／petlevel
function childLock(kind, type, stageNo) {
  Track.track("lock_view", { g: type || kind, s: stageNo || 0 });
  const text = "ここから さきは<br>おうちの ひとと いっしょに あけてね";
  showModal(`<div class="lock-art"><div class="big-pet">${state.petType ? makePetSVG(state.petType, state.stage) : ""}</div><span class="lock-key">🔒</span></div>`,
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
    <div class="stage-row locked"><b>ステージ 2〜</b><span>${l2}</span><em>🔒</em></div></div>`;
  showModal(art, STUDY[type].name, "▶ ステージ1 で あそぶ", () => startType(type),
    "🔒 ステージ2 を ひらく", () => childLock("stage", type, 2));
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

/* ---------- 保護者 が 見る ところ（カギ の 先） ---------- */
const PLAN_REASON = {
  stage: "このステージから先は、有料プランで遊べます。",
  feature: "この遊びは、有料プランで遊べます。",
  pet: "あいぼうを3体から選べるのは、有料プランです。",
  petlevel: "無料プランでは、あいぼうはレベル5まで育ちます。有料プランではレベル10まで育ちます。",
  kid: "きょうだい（3人まで）は、有料プランで使えます。",
  report: "週のレポートは、有料プランで見られます。",
  course: "おけいこの中身を変えるのは、有料プランの機能です。",
};

function openPlanModal(reason) {
  const plan = Plan.current();
  const P = Plan.PRICES;
  const status = plan === "paid" ? "いまのプラン：有料プラン（ありがとうございます）"
    : plan === "trial" ? `いまのプラン：7日間の無料トライアル中（あと${Plan.daysLeft()}日）`
    : Plan.trialUsed() ? "いまのプラン：無料プラン（トライアルは終わりました）" : "いまのプラン：無料プラン";
  $("plan-status").textContent = status;
  $("plan-reason").textContent = (reason && PLAN_REASON[reason]) || "";
  $("plan-prices").innerHTML = jpBreaks(
    `<b>もっと遊ぶには</b><br>月額 ${yen(P.monthly)}円 ／ 年額 ${yen(P.yearly)}円（税込・きょうだい3人まで・端末5台まで）`);
  const canTrial = plan === "free" && !Plan.trialUsed();
  $("plan-trial").classList.toggle("hidden", !canTrial);
  const ready = !!(PAY_LINKS.monthly && PAY_LINKS.yearly);
  $("plan-buy-monthly").disabled = !ready;
  $("plan-buy-yearly").disabled = !ready;
  $("plan-buy-note").textContent = ready ? "お支払いは Stripe の画面で行います。カード情報は、このアプリには届きません。"
    : "お支払いの受付は準備中です（12月に始まる予定です）。";
  $("plan-buy").classList.toggle("hidden", plan === "paid");
  $("plan-track").checked = !Track.isOff();
  $("plan-dev").classList.toggle("hidden", !Plan.dev());
  $("plan-dev-select").value = Plan.load().devPlan || "";
  showVerifyStep("email");
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
  $("parent-plan-note").textContent = plan === "paid" ? "（有料プラン）"
    : plan === "trial" ? `（トライアル あと${Plan.daysLeft()}日）` : "（無料プラン）";
  $("parent-report").classList.toggle("plan-locked", !Plan.can("weeklyReport"));
  $("parent-course-edit").classList.toggle("plan-locked", !Plan.can("courseEdit"));
}

/* ---------- ボタン を つなぐ・ひらいた とき（app.js の $ など が できて から） ---------- */
document.addEventListener("DOMContentLoaded", () => {
  $("plan-close").onclick = () => $("plan-modal").classList.add("hidden");
  $("plan-trial").onclick = () => {
    if (!Plan.beginTrial()) return;
    Track.track("trial_start");
    applyPlanToOffline();
    $("plan-modal").classList.add("hidden");
    $("parent-menu").classList.add("hidden");
    showModal(`<div class="big-pet">${state.petType ? makePetSVG(state.petType, state.stage) : ""}</div>`,
      jpBreaks("7日間の無料トライアルが始まりました。<br>すべての遊び・あいぼう3体・レベル10まで使えます。<br>8日目に自動で無料プランに戻ります（お金はかかりません）。"),
      "とじる", () => { if (currentScreenIs("study")) renderStudyMenu(); });
  };
  $("plan-buy-monthly").onclick = () => { if (PAY_LINKS.monthly) window.open(PAY_LINKS.monthly, "_blank", "noopener"); };
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
        Plan.save(rec);
        verifyEmail = ""; $("verify-email").value = ""; $("verify-code").value = "";
        Track.track("paid_start", { fromTrial });
        applyPlanToOffline();
        openPlanModal();
        showVerifyStep("done", "確認できました。有料プランが使えます。ありがとうございます！");
        return;
      }
      showVerifyStep("code", r.error === "devices"
        ? "このご契約では、すでに5台で使われています。使っていない端末で「この端末の有料を外す」をしてから、もう一度お試しください"
        : r.error === "slow" ? "回数が多すぎます。しばらくしてからお試しください" : "コードが違うか、期限が切れています");
    } catch (e) { showVerifyStep("code", "いまは確認できません。もう一度お試しください"); }
  };
  $("verify-back").onclick = () => showVerifyStep("email");
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
  (function onOpen() {
    const rec = Plan.load();
    if (!rec.freeStarted) {
      rec.freeStarted = true;
      Plan.save(rec);
      if (Plan.current() === "free") Track.track("free_start");
    }
    applyPlanToOffline();
    recheckPaid();
    Track.flush();
  })();
});
