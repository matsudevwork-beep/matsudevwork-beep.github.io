/* =========================================================
   アプリ の 中 の チャット（保護者 ⇔ ぶにゅう の 運営）2026-11-26 代表
   ---------------------------------------------------------
   ・フォーム に うつる より 気軽 に。保護者メニュー（カギ の 先）から だけ ひらく
   ・名前・メールアドレス は 持たない。端末 ごと の でたらめな 番号（計測 の 番号 とは べつ）で やりとり
   ・代表 は 管理ページ（/admin）で 読んで 返事。返事 は 次 に アプリ を ひらいた とき に とどく
   ・サーバー（Cloudflare）で 出して いる とき だけ。GitHub Pages では いままで どおり 感想フォーム
   ========================================================= */
const CHAT_KEY = "bunyu-chat-v1";
// 本番（bunew.app）は、代表 が 読める ように なる まで（本番 に RESEND_KEY・ADMIN_MAIL を 入れる まで）チャット を 出さず 感想フォーム（2026-11-28）
// 入れたら CHAT_HOLD_HOSTS を から [] に する
const CHAT_HOLD_HOSTS = ["bunew.app", "www.bunew.app", "bunyu.matsu-dev-work.workers.dev"];
const CHAT_ON = location.protocol === "https:" && !location.hostname.endsWith("github.io") && !CHAT_HOLD_HOSTS.includes(location.hostname);
const CHAT_POLL_MS = 20 * 1000;
// はじめ の あいさつ（2026-11-27 代表 の 文）。サーバー には 送らず、いつも いちばん うえ に 出す
const CHAT_HELLO = "アプリのご質問や改善点、「こんな遊びがほしい」など、お気軽にお送りください！ お返事は、この画面に届きます。お子さまのお名前など、個人情報は書かないでください。";
// 送った あと の 自動 の お返事（2026-11-27 代表）。代表 が お返事 する まで は 1かい だけ（つづけて 送っても くりかえさない）
const CHAT_AUTO = "お問い合わせありがとうございます。内容を確認し、2日以内には必ずお返事いたします。今しばらくお待ちください。";

const chatLoad = () => { try { return JSON.parse(localStorage.getItem(CHAT_KEY) || "{}") || {}; } catch (e) { return {}; } };
const chatSave = (r) => { try { localStorage.setItem(CHAT_KEY, JSON.stringify(r)); } catch (e) {} };
function chatId() {
  const r = chatLoad();
  if (!r.id) { r.id = crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now().toString(36); chatSave(r); }
  return r.id;
}
async function chatApi(path, body) {
  const res = await fetch(`/api/chat/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, credentials: "omit", body: JSON.stringify(body),
  });
  return res.json();
}
// サーバー の 新しい ぶん を 手もと に たす（手もと に も のこす ので、ネット が なくても 前 の やりとり は 見える）
function chatMerge(msgs) {
  const r = chatLoad();
  const have = new Set((r.msgs || []).map((m) => m.id));
  r.msgs = (r.msgs || []).concat((msgs || []).filter((m) => !have.has(m.id))).sort((a, b) => a.id - b.id).slice(-300);
  chatSave(r);
  return r;
}
const chatLastId = () => { const m = chatLoad().msgs || []; return m.length ? m[m.length - 1].id : 0; };
const chatUnread = () => { const r = chatLoad(); return (r.msgs || []).some((m) => m.admin && m.id > (r.seen || 0)); };

// 運営 から の 返事 が ある か 聞く（いちど でも 送った こと が ある とき だけ）
async function chatRefresh() {
  const r = chatLoad();
  if (!CHAT_ON || !r.id || !r.sent || !navigator.onLine) return;
  try {
    const j = await chatApi("list", { id: r.id, after: chatLastId() });
    if (j.ok) chatMerge(j.messages);
  } catch (e) {}
  chatBadges();
}
function chatBadges() {
  const on = chatUnread();
  document.querySelectorAll(".parent-gate").forEach((b) => b.classList.toggle("has-reply", on));
  const note = document.getElementById("parent-chat-note");
  if (note) note.textContent = on ? "（お返事が届いています）" : "（ご質問・ご要望など）";
  const btn = document.getElementById("parent-chat");
  if (btn) {
    btn.classList.toggle("has-reply", on);
    const lines = btn.querySelectorAll(".btn-txt .nw");
    if (lines.length === 2) { lines[0].textContent = on ? "お返事が" : "チャットで"; lines[1].textContent = on ? "届きました" : "送る"; }
  }
}

const chatTime = (t) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`; };
function chatRender() {
  const box = document.getElementById("chat-msgs");
  box.textContent = "";
  const add = (cls, text, small) => {
    const d = document.createElement("div");
    d.className = `chat-msg ${cls}`;
    d.textContent = text;   // かならず 文字 として（HTML に しない）
    if (small) { const s = document.createElement("small"); s.textContent = small; d.append(s); }
    box.append(d);
  };
  add("them", CHAT_HELLO, "ぶにゅう");
  const rec = chatLoad();
  const autos = rec.autos || [];
  for (const m of rec.msgs || []) {
    add(m.admin ? "them" : "me", m.body, `${m.admin ? "ぶにゅう・" : ""}${chatTime(m.at)}`);
    const a = autos.find((x) => x.after === m.id);
    if (a) add("them auto", CHAT_AUTO, `ぶにゅう（自動のお返事）・${chatTime(a.at)}`);
  }
  const st = document.getElementById("chat-status");
  if (st) box.append(st);
  box.scrollTop = box.scrollHeight;
  const r = chatLoad();
  r.seen = chatLastId();
  chatSave(r);
  chatBadges();
}
let chatTimer = null;
function openChat() {
  document.getElementById("chat-modal").classList.remove("hidden");
  chatRender();
  chatRefresh().then(chatRender);
  clearInterval(chatTimer);
  chatTimer = setInterval(() => {
    if (document.getElementById("chat-modal").classList.contains("hidden")) { clearInterval(chatTimer); return; }
    const before = chatLastId();
    chatRefresh().then(() => { if (chatLastId() !== before) chatRender(); });
  }, CHAT_POLL_MS);
}
function chatStatus(text) {
  let st = document.getElementById("chat-status");
  if (!st) { st = document.createElement("p"); st.id = "chat-status"; st.className = "chat-status"; }
  st.textContent = text;
  if (text) document.getElementById("chat-msgs").append(st); else st.remove();
  const box = document.getElementById("chat-msgs");
  box.scrollTop = box.scrollHeight;
}
// 自動 の お返事 は 手もと だけ（サーバー・管理ページ には 入れない）。
// さいご の 運営 の お返事 より あと に まだ 出して いなければ、いま 送った ぶん の あと に 1つ
function chatAutoReply(r) {
  const msgs = r.msgs || [];
  const lastAdmin = msgs.filter((m) => m.admin).reduce((n, m) => Math.max(n, m.id), 0);
  r.autos = (r.autos || []).filter((a) => msgs.some((m) => m.id === a.after));
  if (r.autos.some((a) => a.after > lastAdmin)) return;
  const mine = msgs.filter((m) => !m.admin);
  if (!mine.length) return;
  r.autos.push({ after: mine[mine.length - 1].id, at: Date.now() });
}
let chatSending = false;
async function chatSend() {
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text || chatSending) return;
  if (!navigator.onLine) { chatStatus("ネットにつながっていないため、送れませんでした。"); return; }
  chatSending = true;
  document.getElementById("chat-send").disabled = true;
  chatStatus("送っています…");
  try {
    const plan = window.Plan ? Plan.current() : null;
    const j = await chatApi("send", { id: chatId(), text, plan, after: chatLastId() });
    if (j.ok) {
      input.value = "";
      const r = chatMerge(j.messages);
      r.sent = true;
      chatAutoReply(r);
      chatSave(r);
      chatStatus("");
      chatRender();
    } else chatStatus(j.error === "slow" ? "たくさん送られたため、少し時間をおいてからお送りください。" : "送れませんでした。もう一度お試しください。");
  } catch (e) { chatStatus("送れませんでした。ネットにつながっているか確かめて、もう一度お試しください。"); }
  finally { chatSending = false; document.getElementById("chat-send").disabled = false; }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!CHAT_ON) return;
  // 感想フォーム の かわり に チャット（app.js が フォーム の ボタン を 出した あと に かくす）
  setTimeout(() => document.getElementById("parent-feedback").classList.add("hidden"), 0);
  document.getElementById("parent-chat").classList.remove("hidden");
  document.getElementById("parent-chat").onclick = openChat;
  document.getElementById("chat-close").onclick = () => { document.getElementById("chat-modal").classList.add("hidden"); clearInterval(chatTimer); };
  document.getElementById("chat-form").onsubmit = (e) => { e.preventDefault(); chatSend(); };
  chatBadges();
  chatRefresh();
  // アプリ に もどって きた とき も 返事 を 見る
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") chatRefresh(); });
  // ひらいた まま でも 3分 ごと に 見る（お返事 に 気づける ように）
  setInterval(() => { if (document.visibilityState === "visible") chatRefresh(); }, 3 * 60 * 1000);
});
