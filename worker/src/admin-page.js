/* =========================================================
   代表 の 管理ページ（/admin）2026-11-26
   ・チャット の 一覧 と お返事。スマホ で 見やすく
   ・ログイン：「コードを送る」→ 代表 の メール（ADMIN_MAIL）に 6けた → 30日 そのまま
   ・保護者 の 文 は かならず textContent で 出す（HTML として 出さない）
   ========================================================= */
const HTML = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>ぶにゅう 管理ページ</title>
<style>
  body { margin: 0; font-family: -apple-system, "Hiragino Sans", sans-serif; background: #FFF8EE; color: #4A3B2C; }
  header { position: sticky; top: 0; background: #F6A96B; color: #fff; padding: 10px 14px; display: flex; align-items: center; gap: 8px; }
  header b { flex: 1; font-size: 17px; }
  header button { background: #fff3; color: #fff; border: 0; border-radius: 10px; padding: 6px 10px; font-size: 14px; }
  main { padding: 12px; max-width: 720px; margin: 0 auto; }
  .card { background: #fff; border-radius: 14px; padding: 12px; margin-bottom: 10px; box-shadow: 0 1px 3px #0001; }
  .row { display: flex; gap: 8px; align-items: center; }
  .thread { cursor: pointer; }
  .thread .no { font-weight: 800; }
  .thread .last { color: #6b5a48; font-size: 14px; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .badge { background: #E5534B; color: #fff; border-radius: 99px; padding: 1px 8px; font-size: 12px; font-weight: 800; }
  .tag { background: #EEE3D3; border-radius: 8px; padding: 1px 6px; font-size: 12px; }
  .when { margin-left: auto; color: #998; font-size: 12px; }
  .msgs { display: flex; flex-direction: column; gap: 8px; padding-bottom: 130px; }
  .msg { max-width: 82%; padding: 8px 12px; border-radius: 16px; white-space: pre-wrap; word-break: break-word; line-height: 1.6; }
  .msg small { display: block; color: #998; font-size: 11px; margin-top: 2px; }
  .them { background: #fff; align-self: flex-start; border-bottom-left-radius: 4px; }
  .me { background: #FFE2C7; align-self: flex-end; border-bottom-right-radius: 4px; }
  .composer { position: fixed; left: 0; right: 0; bottom: 0; background: #fff; padding: 8px; display: flex; gap: 8px; box-shadow: 0 -1px 4px #0002; }
  textarea { flex: 1; font-size: 16px; border: 1px solid #E2D3C0; border-radius: 12px; padding: 8px; min-height: 60px; font-family: inherit; }
  input { font-size: 22px; letter-spacing: 6px; padding: 8px; border: 1px solid #E2D3C0; border-radius: 12px; width: 10em; }
  .btn { background: #F08A4B; color: #fff; border: 0; border-radius: 12px; padding: 10px 16px; font-size: 16px; font-weight: 800; }
  .btn:disabled { opacity: .5; }
  .sub { background: #fff; color: #F08A4B; border: 2px solid #F08A4B; }
  .note { color: #8a7866; font-size: 13px; line-height: 1.6; }
  .err { color: #C0392B; font-weight: 700; }
  .hidden { display: none !important; }
</style></head>
<body>
<header><button id="back" class="hidden">← 一覧</button><b id="title">ぶにゅう 管理ページ</b><button id="logout" class="hidden">ログアウト</button></header>
<main>
  <section id="login" class="hidden">
    <div class="card">
      <p><b>ログイン</b></p>
      <p class="note">代表のメールアドレスに、6けたのコードを送ります（10分間有効）。</p>
      <p><button id="send" class="btn">コードを送る</button></p>
      <p class="row"><input id="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000"><button id="ok" class="btn">ログイン</button></p>
      <p id="loginMsg" class="note"></p>
    </div>
  </section>
  <section id="list" class="hidden">
    <p class="note">新しい連絡が来ると、代表のメールにお知らせが届きます（同じ人からは30分に1回）。お返事は、相手が次にアプリを開いたときに届きます。</p>
    <div id="threads"></div>
  </section>
  <section id="chat" class="hidden">
    <p id="info" class="note"></p>
    <div id="msgs" class="msgs"></div>
    <div class="composer"><textarea id="reply" maxlength="1000" placeholder="お返事を書く（保護者の方に届きます）"></textarea><button id="sendReply" class="btn">送る</button></div>
  </section>
</main>
<script>
const $ = (id) => document.getElementById(id);
let token = localStorage.getItem("bunyu-admin") || "";
let current = null;
const PLAN = { free: "無料", trial: "トライアル", paid: "有料", beta: "無料β" };
async function api(path, body = {}) {
  const r = await fetch("/api/admin/" + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, token }) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { token = ""; localStorage.removeItem("bunyu-admin"); show("login"); throw new Error("login"); }
  return j;
}
const when = (t) => { const d = new Date(t); return (d.getMonth() + 1) + "/" + d.getDate() + " " + d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0"); };
function show(name) {
  ["login", "list", "chat"].forEach((n) => $(n).classList.toggle("hidden", n !== name));
  $("back").classList.toggle("hidden", name !== "chat");
  $("logout").classList.toggle("hidden", name === "login");
  if (name !== "chat") $("title").textContent = "ぶにゅう 管理ページ";
}
async function loadList() {
  const j = await api("threads");
  show("list");
  const box = $("threads");
  box.textContent = "";
  if (!j.threads || !j.threads.length) { box.innerHTML = '<p class="note">まだ連絡はありません。</p>'; return; }
  for (const t of j.threads) {
    const c = document.createElement("div");
    c.className = "card thread";
    const top = document.createElement("div"); top.className = "row";
    const no = document.createElement("span"); no.className = "no"; no.textContent = "#" + t.no; top.append(no);
    if (t.plan) { const g = document.createElement("span"); g.className = "tag"; g.textContent = PLAN[t.plan] || t.plan; top.append(g); }
    if (t.unread) { const b = document.createElement("span"); b.className = "badge"; b.textContent = "未読 " + t.unread; top.append(b); }
    const w = document.createElement("span"); w.className = "when"; w.textContent = when(t.last_at); top.append(w);
    const last = document.createElement("div"); last.className = "last"; last.textContent = (t.last_admin ? "あなた：" : "") + (t.last || "");
    c.append(top, last);
    c.onclick = () => openThread(t);
    box.append(c);
  }
}
async function openThread(t) {
  current = t;
  $("title").textContent = "#" + t.no + (t.plan ? "（" + (PLAN[t.plan] || t.plan) + "）" : "");
  $("info").textContent = "名前・メールアドレスは持っていません。個人情報は聞かないでください。";
  const j = await api("thread", { thread: t.thread });
  show("chat");
  const box = $("msgs"); box.textContent = "";
  for (const m of j.messages || []) {
    const d = document.createElement("div"); d.className = "msg " + (m.admin ? "me" : "them");
    d.textContent = m.body;
    const s = document.createElement("small"); s.textContent = (m.admin ? "あなた・" : "") + when(m.at); d.append(s);
    box.append(d);
  }
  window.scrollTo(0, document.body.scrollHeight);
}
$("send").onclick = async () => {
  $("loginMsg").textContent = "送っています…";
  const r = await fetch("/api/admin/login-start", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const j = await r.json().catch(() => ({}));
  $("loginMsg").textContent = j.ok ? "メールを送りました。届いたコードを入れてください。" : j.error === "slow" ? "回数が多すぎます。1時間ほどおいてください。" : j.error === "setup" ? "ADMIN_MAIL がまだ入っていません。" : "送れませんでした。";
};
$("ok").onclick = async () => {
  const r = await fetch("/api/admin/login-finish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: $("code").value.trim() }) });
  const j = await r.json().catch(() => ({}));
  if (j.ok) { token = j.token; localStorage.setItem("bunyu-admin", token); $("code").value = ""; loadList(); }
  else $("loginMsg").textContent = "コードが違うか、期限が切れています。";
};
$("sendReply").onclick = async () => {
  const text = $("reply").value.trim();
  if (!text || !current) return;
  $("sendReply").disabled = true;
  try { const j = await api("reply", { thread: current.thread, text }); if (j.ok) { $("reply").value = ""; await openThread(current); } }
  finally { $("sendReply").disabled = false; }
};
$("back").onclick = () => loadList();
$("logout").onclick = async () => { try { await api("logout"); } catch (e) {} token = ""; localStorage.removeItem("bunyu-admin"); show("login"); };
if (token) loadList().catch(() => {}); else show("login");
</script>
</body></html>`;

export function adminPage() {
  return new Response(HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'",
    },
  });
}
