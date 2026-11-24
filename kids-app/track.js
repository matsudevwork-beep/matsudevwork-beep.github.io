/* =========================================================
   名前のない 数 を 数える（2026-11-24 代表：あとで 数字を 見るため）
   ---------------------------------------------------------
   ・送るのは「端末の でたらめな番号・できごと・日時・(ロックなら)ジャンルと ステージ」だけ
   ・子どもの名前・記録・メールアドレスは 送らない。有料の確認用の番号とも つなげない（別の番号）
   ・保護者メニューで オフに できる（オフなら 何も ためない・送らない）
   ・ネットが ないときは 端末に ためて（200こ まで）、つながったら まとめて 送る
   ・送り先は おなじ住所の /api/events（Cloudflare）。サーバーが まだ ないときは ためておくだけ
   できごと：free_start（無料で はじめた）／lock_view（ロック画面）／trial_start／paid_start
   ========================================================= */
(function () {
  const KEY = "bunyu-track-v1";
  const ENDPOINT = "/api/events";
  const MAX_QUEUE = 200;
  const ALLOWED = new Set(["free_start", "lock_view", "trial_start", "paid_start"]);

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; } };
  const save = (r) => { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch (e) {} };
  const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now().toString(36));

  // 中身は きまった 形だけ（よけいな ものを 送らない）
  function clean(props) {
    const out = {};
    if (!props) return out;
    if (typeof props.g === "string" && /^[a-z]{1,12}$/.test(props.g)) out.g = props.g;
    if (Number.isInteger(props.s) && props.s >= 0 && props.s < 100) out.s = props.s;
    if (typeof props.fromTrial === "boolean") out.fromTrial = props.fromTrial;
    return out;
  }

  function track(name, props) {
    if (!ALLOWED.has(name)) return;
    const r = load();
    if (r.off) return;
    if (!r.id) r.id = newId();
    r.q = (r.q || []).concat([{ e: name, t: Date.now(), ...clean(props) }]).slice(-MAX_QUEUE);
    save(r);
    flush();
  }

  let sending = false;
  function flush() {
    const r = load();
    if (r.off || !r.q || !r.q.length || sending || !navigator.onLine) return;
    if (location.protocol !== "https:") return;   // パソコンで ためしている ときは 送らない
    sending = true;
    const batch = r.q.slice(0, 50);
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, events: batch }),
      credentials: "omit",
      keepalive: true,
    }).then((res) => {
      if (!res.ok) return;
      const now = load();
      now.q = (now.q || []).slice(batch.length);
      save(now);
    }).catch(() => {}).finally(() => { sending = false; });
  }

  function setOff(off) {
    const r = load();
    r.off = !!off;
    if (off) { delete r.q; delete r.id; }   // オフ にしたら ためた ものと 番号も すてる
    save(r);
  }

  window.Track = { track, flush, setOff, isOff: () => !!load().off };
  window.addEventListener("online", flush);
})();
