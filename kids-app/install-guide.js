/* ---------------------------------------------------------
   「ホーム画面に追加してから遊んでね」の案内（2026-11-28 代表）
   ・ブラウザ（Safari・Chrome）で開いているときだけ、さいしょに出す
     （ホーム画面から開いたアプリ＝display-mode: standalone／navigator.standalone では出さない）
   ・スマホ・タブレット（iPhone・iPad・Android）だけ自動で出す。パソコンでは出さない
   ・「あとで」で閉じたら SNOOZE_DAYS 日は出さない。保護者メニューからいつでも見られる
   ・保護者向けなので声はなし。漢字まじりのふつうの文
   ・手順の絵は、いまはかんたんな図（SVG）。スクショにさしかえるときは
     INSTALL_SHOTS に絵のファイルを書く（例 "ios-1": "img/install/ios-1.webp"）
   ・本公開で App Store／Google Play のアプリにしたら、この案内はいらなくなる
   --------------------------------------------------------- */
const INSTALL_SNOOZE_KEY = "bunyu-install-later";
const INSTALL_SNOOZE_DAYS = 3;
const INSTALL_SHOTS = {
  "ios-1": "", "ios-2": "", "ios-3": "",
  "iosx-1": "", "iosx-2": "", "iosx-3": "",
  "and-1": "", "and-2": "", "and-3": "",
};

// パソコン（localhost）で ためす とき だけ：?ua=ios ／ ios-chrome ／ android ／ app（ホーム画面のアプリのふり）
const INSTALL_DEV_UA = (() => {
  if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return "";
  return new URLSearchParams(location.search).get("ua") || "";
})();
const INSTALL_FAKE_UA = {
  ios: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  "ios-chrome": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1",
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36",
  app: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
};
const installEnv = (() => {
  const ua = INSTALL_FAKE_UA[INSTALL_DEV_UA] || navigator.userAgent || "";
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  // iPhone で Safari 以外（Chrome・Firefox・Edge・LINE など アプリの中のブラウザ）
  const iosOther = ios && (/CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|Line\/|Instagram|FBAN|FBAV/.test(ua) || !/Safari/.test(ua));
  return { ios, android, iosOther, mobile: ios || android };
})();

function isStandalone() {
  if (INSTALL_DEV_UA === "app") return true;
  return window.matchMedia("(display-mode: standalone)").matches
    || window.matchMedia("(display-mode: fullscreen)").matches
    || navigator.standalone === true;
}

// Android の Chrome：「入れられるよ」の しらせ を とっておいて、ボタン で 出す
let installPromptEv = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPromptEv = e;
  if (!$("install-modal").classList.contains("hidden")) renderInstallSteps();
});
window.addEventListener("appinstalled", () => {
  installPromptEv = null;
  if (!$("install-modal").classList.contains("hidden")) showInstallDone();
});

/* かんたんな図（あとでスクショにさしかえる） */
const INSTALL_ICONS = {
  share: `<svg viewBox="0 0 48 48"><rect x="12" y="18" width="24" height="22" rx="4" fill="none" stroke="#2F7DF6" stroke-width="3.2"/><rect x="20" y="14" width="8" height="8" fill="#fff"/><path d="M24 29V7M17 13.5 24 6.5l7 7" fill="none" stroke="#2F7DF6" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  addHome: `<svg viewBox="0 0 48 48"><rect x="9" y="9" width="30" height="30" rx="7" fill="none" stroke="#5A4636" stroke-width="3.2"/><path d="M24 17v14M17 24h14" stroke="#5A4636" stroke-width="3.2" stroke-linecap="round"/></svg>`,
  addBtn: `<svg viewBox="0 0 48 48"><rect x="4" y="13" width="40" height="22" rx="11" fill="#2F7DF6"/><text x="24" y="29" text-anchor="middle" font-size="12" font-weight="800" fill="#fff" font-family="sans-serif">追加</text></svg>`,
  safari: `<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="17" fill="#fff" stroke="#2F7DF6" stroke-width="3.2"/><path d="M31 17 26.5 26.5 17 31l4.5-9.5z" fill="#FF5A4E"/><path d="M26.5 26.5 17 31l4.5-9.5z" fill="#2F7DF6"/></svg>`,
  paste: `<svg viewBox="0 0 48 48"><rect x="6" y="15" width="36" height="18" rx="9" fill="#F1ECE4" stroke="#C9B9A4" stroke-width="2"/><path d="M14 24h14" stroke="#9A8473" stroke-width="3" stroke-linecap="round"/><path d="M33 19v10" stroke="#2F7DF6" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  menu: `<svg viewBox="0 0 48 48"><rect x="8" y="8" width="32" height="32" rx="10" fill="#F1ECE4"/><circle cx="24" cy="15" r="3.4" fill="#5A4636"/><circle cx="24" cy="24" r="3.4" fill="#5A4636"/><circle cx="24" cy="33" r="3.4" fill="#5A4636"/></svg>`,
  phonePlus: `<svg viewBox="0 0 48 48"><rect x="13" y="5" width="22" height="38" rx="5" fill="none" stroke="#5A4636" stroke-width="3"/><path d="M24 17v12M18 23h12" stroke="#1E8E5A" stroke-width="3.2" stroke-linecap="round"/></svg>`,
  installBtn: `<svg class="wide" viewBox="0 0 80 48"><rect x="2" y="12" width="76" height="24" rx="12" fill="#1A73E8"/><text x="40" y="28.5" text-anchor="middle" font-size="11.5" font-weight="800" fill="#fff" font-family="sans-serif">インストール</text></svg>`,
};

const INSTALL_STEPS = {
  ios: [
    { id: "ios-1", icon: "share", text: "画面の下（iPadは上）の<b>共有ボタン</b>を押す<small>見つからないときは「…」の中にあります</small>" },
    { id: "ios-2", icon: "addHome", text: "<b>「ホーム画面に追加」</b>を選ぶ<small>下にスクロールすると出てきます</small>" },
    { id: "ios-3", icon: "addBtn", text: "右上の<b>「追加」</b>を押す" },
  ],
  iosOther: [
    { id: "iosx-1", icon: "safari", text: "<b>Safari</b>で開き直してください<small>下のボタンでアドレスをコピーできます</small>" },
    { id: "iosx-2", icon: "paste", text: "Safariのアドレス欄に<b>貼りつけて</b>開く" },
    { id: "iosx-3", icon: "share", text: "<b>共有ボタン</b> →「ホーム画面に追加」→「追加」" },
  ],
  android: [
    { id: "and-1", icon: "menu", text: "Chromeの右上の<b>︙（メニュー）</b>を押す" },
    { id: "and-2", icon: "phonePlus", text: "<b>「ホーム画面に追加」</b>または「アプリをインストール」を選ぶ" },
    { id: "and-3", icon: "installBtn", text: "<b>「インストール」</b>（または「追加」）を押す" },
  ],
};

let installTab = installEnv.android ? "android" : "ios";
let installFromMenu = false;

function installShot(step) {
  const src = INSTALL_SHOTS[step.id];
  return src ? `<img src="${src}" alt="">` : INSTALL_ICONS[step.icon];
}

function renderInstallSteps() {
  document.querySelectorAll("#install-tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === installTab));
  const box = $("install-steps");
  const extra = $("install-extra");
  extra.innerHTML = "";
  // Android で「入れられるよ」の しらせ が 来て いる とき は、ボタン 1つ で 入れられる
  if (installTab === "android" && installEnv.android && installPromptEv) {
    box.innerHTML = `<div class="install-one">
        <button id="install-now" class="big-btn" type="button">アプリとして入れる</button>
        <p>押すと確認の画面が出ます。<b>「インストール」</b>を押してください。</p>
      </div>`;
    $("install-now").onclick = async () => {
      const ev = installPromptEv; if (!ev) return;
      installPromptEv = null;
      try {
        ev.prompt();
        const r = await ev.userChoice;
        if (r && r.outcome === "accepted") { showInstallDone(); return; }
      } catch (e) {}
      renderInstallSteps();
    };
    return;
  }
  const key = installTab === "ios" && installEnv.iosOther ? "iosOther" : installTab;
  box.innerHTML = INSTALL_STEPS[key].map((s, i) => `<div class="install-step">
      <span class="install-num">${i + 1}</span>
      <span class="install-pic">${installShot(s)}</span>
      <span class="install-txt">${jpBreaks(s.text)}</span>
    </div>`).join("");
  if (key === "iosOther") {
    extra.innerHTML = `<button id="install-copy" class="sub-btn small" type="button">このページのアドレスをコピー</button>`;
    $("install-copy").onclick = async () => {
      const url = location.origin + location.pathname;
      let ok = false;
      try { await navigator.clipboard.writeText(url); ok = true; } catch (e) {}
      $("install-copy").textContent = ok ? "コピーしました" : url;
    };
  }
}

function openInstallGuide(fromMenu) {
  installFromMenu = !!fromMenu;
  $("install-later").textContent = fromMenu ? "閉じる" : "あとで";
  $("install-menu-note").classList.toggle("hidden", !!fromMenu);
  $("install-done").classList.add("hidden");
  $("install-body").classList.remove("hidden");
  // iPhone の Safari 以外 の とき は「Safari」の いいかた に
  $("install-why-1").innerHTML = jpBreaks(installEnv.android
    ? "ブラウザで開いただけだと、記録が消されることがあります。"
    : "Safariで開いただけだと、7日ほど使わないと記録が消されることがあります。");
  renderInstallSteps();
  $("install-modal").classList.remove("hidden");
}
function closeInstallGuide() {
  $("install-modal").classList.add("hidden");
  if (!installFromMenu) { try { localStorage.setItem(INSTALL_SNOOZE_KEY, String(Date.now())); } catch (e) {} }
}
function showInstallDone() {
  $("install-body").classList.add("hidden");
  $("install-done").classList.remove("hidden");
  $("install-menu-note").classList.add("hidden");
  $("install-later").textContent = "閉じる";
  installFromMenu = true;   // 入れた あと は「あとで」の きろく は いらない
}

$("install-tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-tab]"); if (!b) return;
  installTab = b.dataset.tab; renderInstallSteps();
});
$("install-later").onclick = closeInstallGuide;
$("parent-install").onclick = () => openInstallGuide(true);
// 動かない 文 も ことば の きれめ で 改行
document.querySelectorAll("#install-modal .install-why p, #install-modal .install-warn, #install-modal .install-move, #install-done p").forEach((el) => { el.innerHTML = jpBreaks(el.innerHTML); });

// ホーム画面 の アプリ では 保護者メニュー の ボタン も 出さない
$("parent-install-row").classList.toggle("hidden", isStandalone());

(function autoShowInstall() {
  if (isStandalone() || !installEnv.mobile) return;
  let last = 0;
  try { last = Number(localStorage.getItem(INSTALL_SNOOZE_KEY)) || 0; } catch (e) {}
  if (Date.now() - last < INSTALL_SNOOZE_DAYS * 86400000) return;
  setTimeout(() => openInstallGuide(false), 500);
})();
