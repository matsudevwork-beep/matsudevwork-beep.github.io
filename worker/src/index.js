/* =========================================================
   ぶにゅう の 小さな サーバー（Cloudflare Workers）2026-11-24
   ---------------------------------------------------------
   /api/events        名前のない 数 を うけとる
   /api/paid/start    メールアドレス → 払っている人なら 6けたの 確認コード を メールで 送る
   /api/paid/finish   コード が あっていれば、この端末 を 有料に する（1家族 5台まで）
   /api/paid/refresh  まだ 払っているか 聞きなおす
   /api/paid/release  この端末 の 有料 を 外す
   /api/chat/send・list           アプリ の 中 の チャット（保護者 → 運営。2026-11-26）
   /admin・/api/admin/*            代表 の 管理ページ（ログイン は 代表 の メール に 届く 6けた。ADMIN_MAIL は secret）
   ・秘密 の カギ（STRIPE_SECRET・RESEND_KEY・HASH_SALT）は `wrangler secret put` で 入れる。コードに 書かない
   ・メールアドレス は 保存しない（ハッシュ だけ）。答え方 で「この人 が 買ったか」が わからない ように する
   ・おなじ住所（アプリ と おなじ ドメイン）からだけ 使う前提。ほかの サイト から は よべない（CORS を 出さない）
   ========================================================= */

const DAY = 24 * 60 * 60 * 1000;
const CODE_TTL = 10 * 60 * 1000;
const MAX_TRIES = 5;
const MAX_DEVICES = 5;
const GRACE = 3 * DAY;               // 期限 の あと 少し まつ（電波 が ない 日 も あるので）
const EVENTS = new Set(["free_start", "lock_view", "trial_start", "trial_summary", "paid_start"]);   // trial_summary：3日間のようす を 見た（s=1 は おわった あと）2026-11-26
const ACTIVE = new Set(["active", "trialing", "past_due"]);   // past_due：カード の 更新 まち（すぐ 止めない）

import { adminPage } from "./admin-page.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const h = (env, kind, value) => sha256(`${env.HASH_SALT}:${kind}:${value}`);

function randomCode() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0] % 1000000).padStart(6, "0");
}
function randomToken() {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}
// ながさ が おなじ 文字列 を、時間 の ちがい で ばれない ように くらべる
function sameText(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const isUuidish = (s) => typeof s === "string" && /^[A-Za-z0-9-]{16,64}$/.test(s);
const normEmail = (s) => (typeof s === "string" ? s.trim().toLowerCase() : "");
const okEmail = (s) => s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

async function readJson(req, max = 16 * 1024) {
  if (!(req.headers.get("Content-Type") || "").startsWith("application/json")) return null;
  const len = Number(req.headers.get("Content-Length") || 0);
  if (len > max) return null;
  const text = await req.text();
  if (text.length > max) return null;
  try { return JSON.parse(text); } catch (e) { return null; }
}

// 1時間 に n回 まで（key は ハッシュ に して 保存）
async function tooMany(env, kind, value, limit) {
  const key = await h(env, `rate-${kind}`, value);
  const hour = Math.floor(Date.now() / 3600000);
  const row = await env.DB.prepare("SELECT hour, n FROM rate WHERE key = ?").bind(key).first();
  if (!row || row.hour !== hour) {
    await env.DB.prepare("INSERT OR REPLACE INTO rate (key, hour, n) VALUES (?, ?, 1)").bind(key, hour).run();
    return false;
  }
  if (row.n >= limit) return true;
  await env.DB.prepare("UPDATE rate SET n = n + 1 WHERE key = ?").bind(key).run();
  return false;
}

/* ---------- Stripe ---------- */
async function stripe(env, path) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET}` },
  });
  if (!res.ok) throw new Error(`stripe ${res.status}`);
  return res.json();
}
// メールアドレス → 払っている お客さん番号（なければ null）
async function activeCustomerByEmail(env, email) {
  const list = await stripe(env, `customers?limit=10&email=${encodeURIComponent(email)}`);
  for (const c of list.data || []) {
    const until = await activeUntil(env, c.id);
    if (until) return { customer: c.id, until };
  }
  return null;
}
// お客さん番号 → 払っている 期限（ミリ秒。なければ 0）
async function activeUntil(env, customer) {
  const subs = await stripe(env, `subscriptions?customer=${encodeURIComponent(customer)}&status=all&limit=10`);
  let best = 0;
  for (const s of subs.data || []) {
    if (!ACTIVE.has(s.status)) continue;
    const end = (s.current_period_end || (s.items && s.items.data[0] && s.items.data[0].current_period_end) || 0) * 1000;
    best = Math.max(best, end);
  }
  return best ? best + GRACE : 0;
}

/* ---------- メール（Resend）---------- */
async function sendCode(env, email, code) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [email],
      subject: "【ぶにゅう】確認コード",
      text: `ぶにゅう の 有料プランの確認コードです。\n\n${code}\n\n10分間有効です。お心当たりがない場合は、このメールを破棄してください。\nこのコードを、ほかの人に教えないでください。`,
    }),
  });
  if (!res.ok) throw new Error(`mail ${res.status}`);
}

/* ---------- できごと ---------- */
async function events(req, env) {
  const body = await readJson(req, 32 * 1024);
  if (!body || !isUuidish(body.id) || !Array.isArray(body.events) || body.events.length > 50) return json({ ok: false }, 400);
  if (await tooMany(env, "events", body.id, 120)) return json({ ok: false }, 429);
  const device = await h(env, "event-device", body.id);
  const now = Date.now();
  const stmts = [];
  for (const e of body.events) {
    if (!e || !EVENTS.has(e.e) || typeof e.t !== "number" || e.t > now + DAY || e.t < now - 90 * DAY) continue;
    const day = new Date(e.t).toISOString().slice(0, 10);
    const genre = typeof e.g === "string" && /^[a-z]{1,12}$/.test(e.g) ? e.g : null;
    const stage = Number.isInteger(e.s) && e.s >= 0 && e.s < 100 ? e.s : null;
    const fromTrial = typeof e.fromTrial === "boolean" ? (e.fromTrial ? 1 : 0) : null;
    stmts.push(env.DB.prepare("INSERT INTO events (day, device, name, genre, stage, from_trial) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(day, device, e.e, genre, stage, fromTrial));
  }
  if (stmts.length) await env.DB.batch(stmts);
  return json({ ok: true });
}

/* ---------- 有料 の 確認 ---------- */
async function paidStart(req, env, ctx) {
  const body = await readJson(req);
  const email = normEmail(body && body.email);
  if (!body || !okEmail(email) || !isUuidish(body.device)) return json({ ok: false }, 400);
  const ip = req.headers.get("CF-Connecting-IP") || "";
  if (await tooMany(env, "start-email", email, 5) || await tooMany(env, "start-ip", ip, 20)) return json({ ok: false, error: "slow" }, 429);
  // Stripe に 聞く・メール を 送る のは 返事 の あと（Codex 2026-11-24：返事 の 速さ で 買った人 か わかって しまう のを ふせぐ）
  ctx.waitUntil((async () => {
    try {
      const found = await activeCustomerByEmail(env, email);
      if (!found) return;
      const code = randomCode();
      await env.DB.prepare("INSERT OR REPLACE INTO codes (email_hash, code_hash, customer, expires, tries) VALUES (?, ?, ?, ?, 0)")
        .bind(await h(env, "email", email), await h(env, "code", `${email}:${code}`), found.customer, Date.now() + CODE_TTL).run();
      await sendCode(env, email, code);
    } catch (e) { console.error(e && e.message); }
  })());
  // 買って いなくても おなじ 答え・おなじ 速さ（だれ が 買ったか を 調べられない ように）
  return json({ ok: true });
}

async function paidFinish(req, env) {
  const body = await readJson(req);
  const email = normEmail(body && body.email);
  if (!body || !okEmail(email) || !/^\d{6}$/.test(String(body.code || "")) || !isUuidish(body.device)) return json({ ok: false }, 400);
  const ip = req.headers.get("CF-Connecting-IP") || "";
  if (await tooMany(env, "finish-ip", ip, 30) || await tooMany(env, "finish-email", email, 10)) return json({ ok: false, error: "slow" }, 429);
  const emailHash = await h(env, "email", email);
  // Codex 2026-11-24：よんで から ふやす と、同時 に 送られた とき 5回 を こえる → 1つ の SQL で「ふやす＋上限」を いっしょ に
  const row = await env.DB.prepare(
    "UPDATE codes SET tries = tries + 1 WHERE email_hash = ? AND tries < ? AND expires > ? RETURNING code_hash, customer")
    .bind(emailHash, MAX_TRIES, Date.now()).first();
  if (!row) return json({ ok: false, error: "code" }, 400);
  const given = await h(env, "code", `${email}:${body.code}`);
  if (!sameText(given, row.code_hash)) return json({ ok: false, error: "code" }, 400);
  const until = await activeUntil(env, row.customer);
  if (!until) return json({ ok: false, error: "code" }, 400);

  const deviceHash = await h(env, "pay-device", body.device);
  const have = await env.DB.prepare("SELECT device_hash FROM devices WHERE customer = ?").bind(row.customer).all();
  const already = (have.results || []).some((d) => d.device_hash === deviceHash);
  if (!already && (have.results || []).length >= MAX_DEVICES) return json({ ok: false, error: "devices" }, 403);

  const token = randomToken();
  await env.DB.batch([
    env.DB.prepare("INSERT OR REPLACE INTO devices (customer, device_hash, token_hash, created) VALUES (?, ?, ?, ?)")
      .bind(row.customer, deviceHash, await h(env, "token", token), Date.now()),
    env.DB.prepare("DELETE FROM codes WHERE email_hash = ?").bind(emailHash),   // コード は 1回 きり
  ]);
  return json({ ok: true, token, until });
}

async function byToken(env, body) {
  if (!body || typeof body.token !== "string" || !/^[0-9a-f]{64}$/.test(body.token) || !isUuidish(body.device)) return null;
  const row = await env.DB.prepare("SELECT customer, device_hash FROM devices WHERE token_hash = ?").bind(await h(env, "token", body.token)).first();
  if (!row || row.device_hash !== await h(env, "pay-device", body.device)) return null;
  return row;
}

async function paidRefresh(req, env) {
  const body = await readJson(req);
  const row = await byToken(env, body);
  if (!row) return json({ ok: false });
  const until = await activeUntil(env, row.customer);
  if (!until) {
    await env.DB.prepare("DELETE FROM devices WHERE customer = ? AND device_hash = ?").bind(row.customer, row.device_hash).run();
    return json({ ok: false });
  }
  return json({ ok: true, until });
}

async function paidRelease(req, env) {
  const body = await readJson(req);
  const row = await byToken(env, body);
  if (row) await env.DB.prepare("DELETE FROM devices WHERE customer = ? AND device_hash = ?").bind(row.customer, row.device_hash).run();
  return json({ ok: true });
}

/* ---------- チャット（2026-11-26 代表：フォーム より 気軽 に。アプリ の 中 で 運営 と やりとり） ---------- */
const CHAT_MAX = 1000;
const CHAT_KEEP = 365 * DAY;
const NOTIFY_GAP = 30 * 60 * 1000;   // おなじ 人 から は 30分 に 1かい だけ 代表 に メール
const PLANS = new Set(["free", "trial", "paid", "beta"]);
const cleanText = (s) => (typeof s === "string" ? s.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").trim().slice(0, CHAT_MAX) : "");

async function sendMail(env, to, subject, text) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text }),
  });
  if (!res.ok) throw new Error(`mail ${res.status}`);
}
const chatRows = (env, thread, after = 0) => env.DB.prepare(
  "SELECT id, admin, body, at FROM chat WHERE thread = ? AND id > ? ORDER BY id LIMIT 200").bind(thread, after).all();

async function chatSend(req, env, ctx) {
  const body = await readJson(req);
  const text = cleanText(body && body.text);
  if (!body || !isUuidish(body.id) || !text) return json({ ok: false }, 400);
  if (await tooMany(env, "chat", body.id, 20)) return json({ ok: false, error: "slow" }, 429);
  const thread = await h(env, "chat", body.id);
  const now = Date.now();
  const plan = PLANS.has(body.plan) ? body.plan : null;
  let t = await env.DB.prepare("SELECT no, notified_at FROM chat_threads WHERE thread = ?").bind(thread).first();
  if (!t) {
    await env.DB.prepare("INSERT INTO chat_threads (thread, no, last_at, unread, notified_at, plan) VALUES (?, (SELECT COALESCE(MAX(no), 0) + 1 FROM chat_threads), ?, 0, 0, ?)")
      .bind(thread, now, plan).run();
    t = await env.DB.prepare("SELECT no, notified_at FROM chat_threads WHERE thread = ?").bind(thread).first();
  }
  await env.DB.batch([
    env.DB.prepare("INSERT INTO chat (thread, admin, body, at) VALUES (?, 0, ?, ?)").bind(thread, text, now),
    env.DB.prepare("UPDATE chat_threads SET last_at = ?, unread = unread + 1, plan = COALESCE(?, plan) WHERE thread = ?").bind(now, plan, thread),
  ]);
  // 代表 に メール で 知らせる（おなじ 人 から は 30分 に 1かい・ぜんぶ で 1時間 30通 まで）
  if (env.ADMIN_MAIL && now - (t.notified_at || 0) > NOTIFY_GAP && !(await tooMany(env, "notify", "all", 30))) {
    await env.DB.prepare("UPDATE chat_threads SET notified_at = ? WHERE thread = ?").bind(now, thread).run();
    const where = new URL(req.url).origin + "/admin";
    ctx.waitUntil(sendMail(env, env.ADMIN_MAIL, `【ぶにゅう】チャット #${t.no} に 新しい 連絡`,
      `${text.slice(0, 300)}${text.length > 300 ? "…" : ""}\n\nお返事 は 管理ページ から：${where}`).catch((e) => console.error(e.message)));
  }
  const rows = await chatRows(env, thread, Number(body.after) || 0);
  return json({ ok: true, messages: rows.results || [] });
}
async function chatList(req, env) {
  const body = await readJson(req);
  if (!body || !isUuidish(body.id)) return json({ ok: false }, 400);
  if (await tooMany(env, "chatlist", body.id, 200)) return json({ ok: false, error: "slow" }, 429);
  const thread = await h(env, "chat", body.id);
  const rows = await chatRows(env, thread, Number(body.after) || 0);
  return json({ ok: true, messages: rows.results || [] });
}

/* ---------- 代表 の 管理ページ ---------- */
const ADMIN_TTL = 30 * DAY;
async function adminLoginStart(req, env, ctx) {
  if (!env.ADMIN_MAIL) return json({ ok: false, error: "setup" }, 400);
  const ip = req.headers.get("CF-Connecting-IP") || "x";
  if (await tooMany(env, "adminlogin", ip, 5)) return json({ ok: false, error: "slow" }, 429);
  const code = randomCode();
  const key = await h(env, "admin", "login");
  await env.DB.prepare("INSERT OR REPLACE INTO codes (email_hash, code_hash, customer, expires, tries) VALUES (?, ?, 'admin', ?, 0)")
    .bind(key, await h(env, "code", code), Date.now() + CODE_TTL).run();
  await sendMail(env, env.ADMIN_MAIL, "【ぶにゅう】管理ページ の ログインコード", `管理ページ の ログインコード です。\n\n${code}\n\n10分間 有効 です。心当たり が なければ 何も しないで ください。`);
  return json({ ok: true });
}
async function adminLoginFinish(req, env) {
  const body = await readJson(req);
  if (!body || !/^\d{6}$/.test(body.code || "")) return json({ ok: false }, 400);
  const key = await h(env, "admin", "login");
  const row = await env.DB.prepare("SELECT code_hash, expires, tries FROM codes WHERE email_hash = ?").bind(key).first();
  if (!row || row.expires < Date.now() || row.tries >= MAX_TRIES) return json({ ok: false, error: "code" }, 403);
  if (!sameText(row.code_hash, await h(env, "code", body.code))) {
    await env.DB.prepare("UPDATE codes SET tries = tries + 1 WHERE email_hash = ?").bind(key).run();
    return json({ ok: false, error: "code" }, 403);
  }
  const token = randomToken();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM codes WHERE email_hash = ?").bind(key),
    env.DB.prepare("INSERT INTO admin_sessions (token_hash, expires) VALUES (?, ?)").bind(await h(env, "admin-token", token), Date.now() + ADMIN_TTL),
  ]);
  return json({ ok: true, token });
}
async function isAdmin(env, body) {
  if (!body || typeof body.token !== "string" || body.token.length !== 64) return false;
  const row = await env.DB.prepare("SELECT expires FROM admin_sessions WHERE token_hash = ?").bind(await h(env, "admin-token", body.token)).first();
  return !!row && row.expires > Date.now();
}
async function adminApi(path, req, env) {
  const body = await readJson(req);
  if (!(await isAdmin(env, body))) return json({ ok: false, error: "login" }, 401);
  if (path === "threads") {
    const r = await env.DB.prepare(`SELECT t.thread, t.no, t.last_at, t.unread, t.plan,
      (SELECT body FROM chat c WHERE c.thread = t.thread ORDER BY id DESC LIMIT 1) AS last,
      (SELECT admin FROM chat c WHERE c.thread = t.thread ORDER BY id DESC LIMIT 1) AS last_admin
      FROM chat_threads t ORDER BY t.last_at DESC LIMIT 100`).all();
    return json({ ok: true, threads: r.results || [] });
  }
  if (typeof body.thread !== "string" || !/^[0-9a-f]{64}$/.test(body.thread)) return json({ ok: false }, 400);
  if (path === "thread") {
    await env.DB.prepare("UPDATE chat_threads SET unread = 0 WHERE thread = ?").bind(body.thread).run();
    const r = await chatRows(env, body.thread, 0);
    return json({ ok: true, messages: r.results || [] });
  }
  if (path === "reply") {
    const text = cleanText(body.text);
    if (!text) return json({ ok: false }, 400);
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO chat (thread, admin, body, at) SELECT ?, 1, ?, ? WHERE EXISTS (SELECT 1 FROM chat_threads WHERE thread = ?)").bind(body.thread, text, now, body.thread),
      env.DB.prepare("UPDATE chat_threads SET last_at = ?, unread = 0 WHERE thread = ?").bind(now, body.thread),
    ]);
    return json({ ok: true });
  }
  if (path === "logout") {
    await env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(await h(env, "admin-token", body.token)).run();
    return json({ ok: true });
  }
  return json({ ok: false }, 404);
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname === "/admin" || url.pathname === "/admin/") return adminPage();
    if (!url.pathname.startsWith("/api/")) {
      if (!env.ASSETS) return new Response("not found", { status: 404 });
      const res = await env.ASSETS.fetch(req);
      if (!env.NOINDEX) return res;
      // 開発用：検索 に 出さない
      const out = new Response(res.body, res);
      out.headers.set("X-Robots-Tag", "noindex, nofollow");
      return out;
    }
    if (req.method !== "POST") return json({ ok: false }, 405);
    // ほかの サイト から の よびだし は ことわる（ブラウザ が つける Origin を 見る）
    const origin = req.headers.get("Origin");
    if (origin && origin !== url.origin) return json({ ok: false }, 403);
    try {
      switch (url.pathname) {
        case "/api/events": return await events(req, env);
        case "/api/paid/start": return await paidStart(req, env, ctx);
        case "/api/paid/finish": return await paidFinish(req, env);
        case "/api/paid/refresh": return await paidRefresh(req, env);
        case "/api/paid/release": return await paidRelease(req, env);
        case "/api/chat/send": return await chatSend(req, env, ctx);
        case "/api/chat/list": return await chatList(req, env);
        case "/api/admin/login-start": return await adminLoginStart(req, env, ctx);
        case "/api/admin/login-finish": return await adminLoginFinish(req, env);
        case "/api/admin/threads": return await adminApi("threads", req, env);
        case "/api/admin/thread": return await adminApi("thread", req, env);
        case "/api/admin/reply": return await adminApi("reply", req, env);
        case "/api/admin/logout": return await adminApi("logout", req, env);
        default: return json({ ok: false }, 404);
      }
    } catch (e) {
      console.error(e && e.message);   // くわしい 中身 は 返さない
      return json({ ok: false, error: "server" }, 500);
    }
  },
  // 毎日 1かい：90日 より 古い 数・切れた コード・古い 回数 を 消す
  async scheduled(_ev, env) {
    const old = new Date(Date.now() - 90 * DAY).toISOString().slice(0, 10);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM events WHERE day < ?").bind(old),
      env.DB.prepare("DELETE FROM codes WHERE expires < ?").bind(Date.now()),
      env.DB.prepare("DELETE FROM rate WHERE hour < ?").bind(Math.floor(Date.now() / 3600000) - 2),
      env.DB.prepare("DELETE FROM chat WHERE at < ?").bind(Date.now() - CHAT_KEEP),
      env.DB.prepare("DELETE FROM chat_threads WHERE last_at < ?").bind(Date.now() - CHAT_KEEP),
      env.DB.prepare("DELETE FROM admin_sessions WHERE expires < ?").bind(Date.now()),
    ]);
  },
};
