/* =========================================================
   ぶにゅう の 小さな サーバー（Cloudflare Workers）2026-11-24
   ---------------------------------------------------------
   /api/events        名前のない 数 を うけとる
   /api/paid/start    メールアドレス → 払っている人なら 6けたの 確認コード を メールで 送る
   /api/paid/finish   コード が あっていれば、この端末 を 有料に する（1家族 5台まで）
   /api/paid/refresh  まだ 払っているか 聞きなおす
   /api/paid/release  この端末 の 有料 を 外す
   ・秘密 の カギ（STRIPE_SECRET・RESEND_KEY・HASH_SALT）は `wrangler secret put` で 入れる。コードに 書かない
   ・メールアドレス は 保存しない（ハッシュ だけ）。答え方 で「この人 が 買ったか」が わからない ように する
   ・おなじ住所（アプリ と おなじ ドメイン）からだけ 使う前提。ほかの サイト から は よべない（CORS を 出さない）
   ========================================================= */

const DAY = 24 * 60 * 60 * 1000;
const CODE_TTL = 10 * 60 * 1000;
const MAX_TRIES = 5;
const MAX_DEVICES = 5;
const GRACE = 3 * DAY;               // 期限 の あと 少し まつ（電波 が ない 日 も あるので）
const EVENTS = new Set(["free_start", "lock_view", "trial_start", "paid_start"]);
const ACTIVE = new Set(["active", "trialing", "past_due"]);   // past_due：カード の 更新 まち（すぐ 止めない）

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

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS ? env.ASSETS.fetch(req) : new Response("not found", { status: 404 });
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
    ]);
  },
};
