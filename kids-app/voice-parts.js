/* =========================================================
   録音 の 声 を「部品」で つなぐ（2026-11-16 代表：録音 する 数 を へらしたい）
   ---------------------------------------------------------
   しくみ の 説明 は docs/voice-system.md（かえる まえ に かならず 読む）
   ・まず 文 まるごと の 録音 を さがす（いままで どおり）
   ・なければ 文 を 部品 に わけて、録音 を つなげて ならす
       例「し」を かこう！ ●から ★へ なぞってね
         → 「し」（1もじ の 録音）＋「を かこう！ まるから ほしへ なぞってね」（部品 の 録音）
       例 ゆうとくん、すごいね → ゆ＋う＋と（1もじ）＋くん＋すごいね
   ・すうじ は よみ に なおして から さがす（3 → さん、3こ → さんこ、4じ → よじ、5ふん → ごふん）
   ・1もじ の 録音（kana-001 など。表 では「#あ」）で 字 を 1つずつ よむ のは、
     なまえ と「」の なか の 1もじ だけ（ロボット みたい に ならない ように）
   ・どうしても つなげない とき は null → 文 ぜんぶ を 端末 の よみあげ に する（とちゅう で 声 が まざらない）
   ・この ファイル は ブラウザ と node（tools/check_voice_parts.js）の 両方 で うごく
   ========================================================= */
(function (root) {
  // app.js の voiceKey・tools/build_voice_ids.js ・tools/build_voice_list.js と おなじ きまり（かえる とき は 4つ とも）
  const voiceKey = (t) => String(t).replace(/●/g, "まる").replace(/★/g, "ほし")
    .replace(/[\s　〜~「」！!？?…。、,.♪・ー-]/g, "").replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));  // カタカナ は ひらがな と おなじ 声（コップ＝こっぷ）
  const kataToHira = (s) => String(s).replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

  const NUMS = ["ぜろ", "いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう", "じゅう"];
  const numRead = (n) => n <= 10 ? NUMS[n] : n < 20 ? "じゅう" + NUMS[n - 10] : n === 20 ? "にじゅう" : String(n);
  const HOURS = ["じゅうにじ", "いちじ", "にじ", "さんじ", "よじ", "ごじ", "ろくじ", "しちじ", "はちじ", "くじ", "じゅうじ", "じゅういちじ"];
  const MINS = ["ちょうど", "ごふん", "じゅっぷん", "じゅうごふん", "にじゅっぷん", "にじゅうごふん", "さんじゅっぷん",
    "さんじゅうごふん", "よんじゅっぷん", "よんじゅうごふん", "ごじゅっぷん", "ごじゅうごふん"];
  const COUNTERS = {   // numbers.js の COUNTER_WORDS と おなじ（node でも うごく ように ここ にも もつ）
    ひき: ["ぜろひき", "いっぴき", "にひき", "さんびき", "よんひき", "ごひき", "ろっぴき", "ななひき", "はっぴき", "きゅうひき", "じゅっぴき"],
    こ: ["ぜろこ", "いっこ", "にこ", "さんこ", "よんこ", "ごこ", "ろっこ", "ななこ", "はっこ", "きゅうこ", "じゅっこ"],
    わ: ["ぜろわ", "いちわ", "にわ", "さんわ", "よんわ", "ごわ", "ろくわ", "ななわ", "はちわ", "きゅうわ", "じゅうわ"],
    まい: ["ぜろまい", "いちまい", "にまい", "さんまい", "よんまい", "ごまい", "ろくまい", "ななまい", "はちまい", "きゅうまい", "じゅうまい"],
    ほん: ["ぜろほん", "いっぽん", "にほん", "さんぼん", "よんほん", "ごほん", "ろっぽん", "ななほん", "はっぽん", "きゅうほん", "じゅっぽん"],
    だい: ["ぜろだい", "いちだい", "にだい", "さんだい", "よんだい", "ごだい", "ろくだい", "ななだい", "はちだい", "きゅうだい", "じゅうだい"],
    かい: ["ぜろかい", "いっかい", "にかい", "さんかい", "よんかい", "ごかい", "ろっかい", "ななかい", "はっかい", "きゅうかい", "じゅっかい"],
    にち: ["ぜろにち", "いちにち", "ふつか", "みっか", "よっか", "いつか", "むいか", "なのか", "ようか", "ここのか", "とおか"],
  };
  // すうじ を よみ に（うしろ の たんい も いっしょ に）
  function readDigits(s) {
    return s.replace(/(\d+)\s*(じ|ふん|ひき|こ|わ|まい|ほん|だい|かい|にち)?/g, (m, d, u) => {
      const n = Number(d);
      if (u === "じ" && n >= 1 && n <= 12) return HOURS[n % 12];
      if (u === "ふん" && n % 5 === 0 && n < 60) return MINS[n / 5];
      if (u && COUNTERS[u] && COUNTERS[u][n]) return COUNTERS[u][n];
      return numRead(n) + (u || "");
    });
  }

  /* 文 を「しるし つき の かな の ならび」に する
     spell：1もじ の 録音 で よんで よい ところ（なまえ・「」の なか の 1もじ） */
  function toSlots(text, name) {
    const out = [];   // { ch, spell }
    const push = (s, spell, nameStart) => { [...voiceKey(s)].forEach((ch, k) => out.push({ ch, spell, nameStart: !!nameStart && k === 0 })); };
    let rest = String(text).replace(/（[^）]*）/g, "");   // （3こ → 5こ）など は よまない
    // なまえ を さき に きりだす（なまえ の なか の すうじ・きごう は そのまま）
    const parts = name ? rest.split(name) : [rest];
    parts.forEach((p, i) => {
      if (i > 0) push(kataToHira(name), true, true);
      // 「」の なか
      p.split(/(「[^」]*」)/).forEach((q) => {
        const m = q.match(/^「([^」]*)」$/);
        if (m) {
          const inner = readDigits(m[1]);
          const one = voiceKey(m[1]).length === 1;
          push(one ? kataToHira(inner) : inner, one);
        } else push(readDigits(q), false);
      });
    });
    return out;
  }

  /* 部品 の ならび を きめる（いちばん すくない 部品 で つなぐ）
     table：voice-ids.js の VOICE_IDS（key → id か {animal,car,veggie}）
     pet：いま の あいぼう（キャラ ごと の 声 を えらぶ）
     have：つかって よい id（無い ファイル を のぞく）。かえす の は id の ならび、だめ なら null */
  function plan(text, table, pet, name, have) {
    const slots = toSlots(text, name);
    const n = slots.length;
    if (!n) return null;
    const s = slots.map((x) => x.ch).join("");
    const idOf = (k) => {
      const v = table[k];
      const id = v && typeof v === "object" ? v[pet] : v;
      return id && (!have || have(id)) ? id : null;
    };
    let maxLen = 0;
    for (const k in table) if (k.length > maxLen) maxLen = k.length;
    // best[i][f]：i もじ め まで を つないだ いちばん よい もの（f＝「ふつう の 文 の 1もじ 部品」を つかった かず）
    // こすと：部品 1つ＝1、ふつう の 文 の 1もじ 部品（「と」「は」「に」など）＝2。1つ の 文 で 3つ まで（字 を ばらばら に よまない）
    const SOLO = 3;
    const best = Array.from({ length: n + 1 }, () => new Array(SOLO + 1).fill(null));
    best[0][0] = { c: 0, prev: null, id: null };
    const put = (j, f, c, prev, id) => { if (!best[j][f] || c < best[j][f].c) best[j][f] = { c, prev, id }; };
    for (let i = 0; i < n; i++) {
      for (let f = 0; f <= SOLO; f++) {
        const cur = best[i][f];
        if (!cur) continue;
        const from = [i, f];
        for (let L = 1; L <= Math.min(maxLen, n - i); L++) {
          const id = idOf(s.slice(i, i + L));
          if (!id) continue;
          const solo = L === 1 && !slots[i].spell;
          if (solo && f >= SOLO) continue;
          put(i + L, solo ? f + 1 : f, cur.c + (solo ? 2 : 1), from, id);
        }
        // なまえ を まるごと 録音 した もの（@ゆうとくん・@ゆうと。2026-11-22 代表：よく ある なまえ は 先 に 録音 して おく）
        if (slots[i].nameStart) for (let L = 1; L <= Math.min(maxLen, n - i); L++) {
          const id = idOf("@" + s.slice(i, i + L));
          if (id) put(i + L, f, cur.c + 1, from, id);
        }
        // なまえ・「」の 1もじ：1もじ の 録音（#あ）で よむ。きゃ など 2もじ の 録音 も
        for (let L = 1; L <= 2 && i + L <= n; L++) {
          if (!slots.slice(i, i + L).every((x) => x.spell)) break;
          const id = idOf("#" + s.slice(i, i + L));
          if (id) put(i + L, f, cur.c + 1, from, id);
        }
      }
    }
    const end = best[n].filter(Boolean).sort((x, y) => x.c - y.c)[0];
    if (!end) return null;
    const ids = [];
    for (let e = end; e && e.id; e = e.prev ? best[e.prev[0]][e.prev[1]] : null) ids.unshift(e.id);
    return ids;
  }

  const api = { voiceKey, plan, readDigits, toSlots };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.VoiceParts = api;
})(typeof window !== "undefined" ? window : globalThis);
