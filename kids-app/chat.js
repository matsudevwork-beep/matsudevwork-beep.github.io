/* =========================================================
   アプリ の 中 の チャット（保護者 ⇔ ぶにゅう の 運営）2026-11-26 代表
   ---------------------------------------------------------
   ・フォーム に うつる より 気軽 に。保護者メニュー（カギ の 先）から だけ ひらく
   ・名前・メールアドレス は 持たない。端末 ごと の でたらめな 番号（計測 の 番号 とは べつ）で やりとり
   ・代表 は 管理ページ（/admin）で 読んで 返事。返事 は 次 に アプリ を ひらいた とき に とどく
   ・サーバー（Cloudflare）で 出して いる とき だけ。GitHub Pages では いままで どおり 感想フォーム
   ========================================================= */
const CHAT_KEY = "bunyu-chat-v1";
const CHAT_ON = location.protocol === "https:" && !location.hostname.endsWith("github.io");
const CHAT_POLL_MS = 20 * 1000;
const CHAT_HELLO = "ご質問・ご要望・不具合のご報告など、なんでもお気軽にどうぞ！ お返事は、この画面に届きます（数日かかることがあります）。お子さまのお名前など、個人情報は書かないでください。";

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
  if (btn) btn.classList.toggle("has-reply", on);
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
  for (const m of chatLoad().msgs || []) add(m.admin ? "them" : "me", m.body, `${m.admin ? "ぶにゅう・" : ""}${chatTime(m.at)}`);
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
});
