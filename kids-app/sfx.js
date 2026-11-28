/* =========================================================
   こうかおん と おんがく（2026-11-28 代表）
   ・ファイル は つかわず、Web Audio で その場 で 作る（ネット なし でも 鳴る・軽い）
   ・<audio>・new Audio() は つかわない（iPhone の カメラ の よこ に しるし が 出る。docs/voice-system.md）
   ・声 より 小さく。おと が オフ（state.sound が false）の とき は 鳴らさない
   ・つかう ところ：あいぼう を えらんだ（decide）／ダンス（dance）／おふろ（shower）／めいろ・みちつなぎ（bgm）
   ========================================================= */
const Sfx = (() => {
  const on = () => typeof state === "undefined" || state.sound !== false;
  const ctx = () => (on() && typeof getAudioCtx === "function" ? getAudioCtx() : null);

  // 1つ の 音（三角波 など）。t0 は 鳴らす 時刻（ac.currentTime と おなじ ものさし）
  function note(ac, out, freq, t0, dur, type = "triangle", vol = 0.25) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    t0 = Math.max(t0, ac.currentTime);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(out);
    o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
  }
  const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);   // MIDI の 音 の ばんごう → ヘルツ

  // けってい：ぴろりん（3つ の 音 が のぼる）
  function decide() {
    const ac = ctx(); if (!ac) return;
    const out = ac.createGain(); out.gain.value = 0.5; out.connect(ac.destination);
    const now = ac.currentTime + 0.01;
    [[76, 0], [79, 0.07], [84, 0.14]].forEach(([n, t]) => note(ac, out, hz(n), now + t, 0.35, "triangle", 0.3));
    note(ac, out, hz(88), now + 0.14, 0.4, "sine", 0.12);
  }

  // シャワー：ざーっ（白い ノイズ を ふるわせて、はじめ と おわり を なめらか に）
  let showerNode = null;
  function shower(sec = 9) {
    stopShower();
    const ac = ctx(); if (!ac) return;
    const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 900;
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 7000;
    const g = ac.createGain();
    const lfo = ac.createOscillator(), lfoG = ac.createGain();   // しずく の ゆらぎ
    lfo.frequency.value = 7; lfoG.gain.value = 0.02; lfo.connect(lfoG); lfoG.connect(g.gain);
    const t0 = ac.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.09, t0 + 0.6);
    g.gain.setValueAtTime(0.09, Math.max(t0 + 0.6, t0 + sec - 1.2));
    g.gain.linearRampToValueAtTime(0.0001, t0 + sec);
    src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(ac.destination);
    src.start(t0); lfo.start(t0); src.stop(t0 + sec + 0.1); lfo.stop(t0 + sec + 0.1);
    showerNode = { src, lfo, g, ac };
  }
  function stopShower() {
    if (!showerNode) return;
    const { src, lfo, g, ac } = showerNode;
    showerNode = null;
    try { g.gain.cancelScheduledValues(ac.currentTime); g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.1); src.stop(ac.currentTime + 0.4); lfo.stop(ac.currentTime + 0.4); } catch (e) {}
  }

  // たのしい メロディ（ドレミ の 音 の ばんごう・ながさ は はく）
  const SONGS = {
    // ダンス：はずむ 2小節 × 2
    dance: { bpm: 126, mel: [[72, .5], [76, .5], [79, .5], [76, .5], [77, .5], [81, .5], [79, 1], [76, .5], [79, .5], [84, .5], [79, .5], [77, .5], [74, .5], [72, 1]],
      bass: [[48, 1], [55, 1], [53, 1], [55, 1], [48, 1], [55, 1], [50, 1], [48, 1]] },
    // めいろ・みちつなぎ：ゆっくり かわいい（くりかえす）
    walk: { bpm: 96, mel: [[67, .5], [72, .5], [76, .5], [74, .5], [72, 1], [67, 1], [69, .5], [72, .5], [74, .5], [72, .5], [71, 1], [-1, 1],
      [67, .5], [72, .5], [76, .5], [79, .5], [77, 1], [74, 1], [76, .5], [74, .5], [71, .5], [74, .5], [72, 1], [-1, 1]],
      bass: [[48, 2], [53, 2], [50, 2], [55, 2], [48, 2], [53, 2], [55, 2], [48, 2]] },
  };
  // 1まわり ぶん を 予約 して、その ながさ（びょう）を かえす
  function schedule(ac, out, song, at) {
    const beat = 60 / song.bpm;
    let t = at;
    song.mel.forEach(([n, b]) => { if (n > 0) note(ac, out, hz(n), t, b * beat * 0.9, "triangle", 0.22); t += b * beat; });
    let tb = at;
    song.bass.forEach(([n, b]) => { note(ac, out, hz(n), tb, b * beat * 0.8, "sine", 0.28); tb += b * beat; });
    return Math.max(t, tb) - at;
  }

  // ダンス の あいだ だけ（sec びょう）
  let danceOut = null;
  function dance(sec = 4) {
    stopDance();
    const ac = ctx(); if (!ac) return;
    const out = ac.createGain(); out.gain.value = 0.35; out.connect(ac.destination);
    const t0 = ac.currentTime + 0.05;
    let t = t0;
    while (t - t0 < sec) t += schedule(ac, out, SONGS.dance, t);
    out.gain.setValueAtTime(0.35, Math.max(t0, t0 + sec - 0.4));
    out.gain.linearRampToValueAtTime(0.0001, t0 + sec);
    danceOut = { out, ac };
    setTimeout(() => { if (danceOut && danceOut.out === out) stopDance(); }, sec * 1000 + 200);
  }
  function stopDance() {
    if (!danceOut) return;
    const { out, ac } = danceOut;
    danceOut = null;
    try { out.gain.cancelScheduledValues(ac.currentTime); out.gain.setTargetAtTime(0.0001, ac.currentTime, 0.05); setTimeout(() => out.disconnect(), 400); } catch (e) {}
  }

  // めいろ・みちつなぎ の おんがく：とめる まで くりかえす（さき に 2まわり ぶん だけ 予約 して、たりなく なったら たす）
  let bgmState = null;
  function bgm(name = "walk") {
    if (bgmState && bgmState.name === name) return;   // もう ながれて いる（つぎ の もんだい でも そのまま）
    stopBgm();
    const ac = ctx(); if (!ac) return;
    const out = ac.createGain(); out.gain.value = 0.0001; out.connect(ac.destination);
    out.gain.setTargetAtTime(0.18, ac.currentTime, 0.4);
    const st = { name, out, ac, next: ac.currentTime + 0.1, timer: null };
    const fill = () => {
      if (bgmState !== st) return;
      if (st.ac !== (typeof audioCtx !== "undefined" ? audioCtx : st.ac)) { stopBgm(); return; }   // 音 の しくみ が 作りなおされた
      while (st.next < ac.currentTime + 6) st.next += schedule(ac, out, SONGS[name], st.next);
      st.timer = setTimeout(fill, 2000);
    };
    bgmState = st;
    fill();
  }
  function stopBgm() {
    if (!bgmState) return;
    const { out, ac, timer } = bgmState;
    bgmState = null;
    clearTimeout(timer);
    try { out.gain.cancelScheduledValues(ac.currentTime); out.gain.setTargetAtTime(0.0001, ac.currentTime, 0.15); setTimeout(() => out.disconnect(), 800); } catch (e) {}
  }

  function stopAll() { stopShower(); stopDance(); stopBgm(); }
  return { decide, shower, stopShower, dance, stopDance, bgm, stopBgm, stopAll };
})();
