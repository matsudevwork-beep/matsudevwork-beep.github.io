#!/usr/bin/env node
/*
  すうじ・かぞえ方 の 声 を「ならべて かぞえて 言わせて、1こ ずつ 切り出す」（2026-11-23）
  1こ だけ 言わせる と 声 が さがる ので、「いっぴき、にひき、さんびき…」と かぞえさせる と 自然 に なる（2026-11-22 わかった こと）

  つかいかた（app フォルダ で）：
    node tools/make_count_voices.js num-001..011          → ぜろ〜じゅう を 1つ の 声 で 作って 切る
    node tools/make_count_voices.js counter-001..010
    DRY=1 …  → 作る 文 だけ 出す
  ・ID は docs/voice-script.csv の「よみ」を つかう。「A..B」は おなじ あたま の 番号 の あいだ ぜんぶ
  ・こぐまん（Sameno・v4・[元気に][かわいく][幼い声]）。できた 声 は ../voice-work/review/ に（アプリ には 入れない）
  ・切れめ は ffmpeg の しずか な ところ の うち ながい もの。もと の 声 は ../voice-work/count-seq/ に とっておき、もう いちど うつ と 切りなおす だけ（REDO=1 で 作りなおし）
*/
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const REVIEW = path.join(ROOT, "..", "voice-work", "review");
const TAGS = "[元気に][かわいく][幼い声]";
const SETTINGS = { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true };

const rows = fs.readFileSync(path.join(ROOT, "docs", "voice-script.csv"), "utf8").split("\n").slice(1)
  .map((l) => (l.match(/"([^"]*)"/g) || []).map((s) => s.slice(1, -1))).filter((r) => r[0]);
const yomi = Object.fromEntries(rows.map((r) => [r[0], r[2]]));
const arg = process.argv[2] || "";
const m = arg.match(/^([a-z]+)-(\d+)\.\.(\d+)$/);
const ids = [];
if (m) for (let i = +m[2]; i <= +m[3]; i++) ids.push(`${m[1]}-${String(i).padStart(3, "0")}`);
else if (/^[a-z]+-\d+(,[a-z]+-\d+)*$/.test(arg)) ids.push(...arg.split(","));   // word-001,word-020 の ように ならべて も よい
else { console.log("例：node tools/make_count_voices.js num-001..011"); process.exit(1); }
// SAY=鹿,蟻 … 言わせる 字 を かえる（漢字・カタカナ で 読み を はっきり させる とき）。SUFFIX=__a … 作る ファイル の 名前 に つける（ためし を ならべる）
const SAY = process.env.SAY ? process.env.SAY.split(",") : null;
const SUFFIX = process.env.SUFFIX || "";
const words = ids.map((id, i) => (SAY ? SAY[i] : yomi[id]).replace(/[！!。、\s]/g, ""));
const SEP = process.env.SEP || "、";   // SEP=。 … 1こ ずつ はっきり 区切って 言わせる（「いち、に」が くっついた とき）
const KEEP = process.env.KEEP ? process.env.KEEP.split(",") : null;   // KEEP=counter-005 … その ID だけ のこす（まわり は 区切り を 自然 に する ため だけ）
const text = TAGS + words.join(SEP) + "。";
console.log(text);
if (process.env.DRY) process.exit(0);

const key = execFileSync("security", ["find-generic-password", "-s", "bunyu-elevenlabs", "-w"], { encoding: "utf8" }).trim();
(async () => {
  const vs = await (await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": key } })).json();
  const v = vs.voices.find((x) => x.name.startsWith("Sameno"));
  // もと の 声 と「どの 字 を 何秒 に 言ったか」は とっておく（切りなおし は クレジット なし。REDO=1 で 作りなおし）
  const seq = path.join(REVIEW, "..", "count-seq", `${arg.slice(0, 60)}${SEP === "、" ? "" : "-sep"}${SUFFIX}.mp3`);
  const alj = seq.replace(/\.mp3$/, ".json");
  fs.mkdirSync(path.dirname(seq), { recursive: true });
  if (!fs.existsSync(alj) || process.env.REDO) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${v.voice_id}/with-timestamps?output_format=mp3_44100_128`, {
      method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: "eleven_v4", voice_settings: SETTINGS }),
    });
    if (!res.ok) { console.log(`作れません（${res.status}）`, await res.text()); process.exit(1); }
    const j = await res.json();
    fs.writeFileSync(seq, Buffer.from(j.audio_base64, "base64"));
    fs.writeFileSync(alj, JSON.stringify(j.alignment || j.normalized_alignment));
  }
  // 「、」の ところ で 切る：まえ の ことば の さいご の 字 が おわった ところ 〜 つぎ の ことば の はじめ の 字 の あいだ
  const al = JSON.parse(fs.readFileSync(alj, "utf8"));
  const ch = al.characters, t0 = al.character_start_times_seconds, t1 = al.character_end_times_seconds;
  const body = words.join(SEP);
  const startIdx = ch.join("").lastIndexOf(body);
  if (startIdx < 0) { console.log("字 の 時間 が 見つからない", ch.join("")); process.exit(1); }
  const dur = +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", seq], { encoding: "utf8" });
  // 字 の 時間 は 0.1〜0.2秒 ずれる ことが ある（2026-11-23「じゅう」の 頭 が 切れた）
  // → ことば と ことば の あいだ（字 の 時間 の まわり）で いちばん ながい しずか な ところ を さがして、そこ で 切る
  const sil = execFileSync("sh", ["-c", `ffmpeg -hide_banner -i "${seq}" -af silencedetect=noise=-38dB:d=0.03 -f null - 2>&1`], { encoding: "utf8" });
  const ss = [...sil.matchAll(/silence_start: ([\d.]+)/g)].map((x) => +x[1]);
  const se = [...sil.matchAll(/silence_end: ([\d.]+)/g)].map((x) => +x[1]);
  const gaps = ss.map((x, i) => [x, se[i] ?? dur]);
  const bounds = []; let k = startIdx;   // [ことば の おわり, つぎ の はじめ]
  words.forEach((w, i) => {
    const a1 = t1[k + w.length - 1];
    k += w.length + 1;
    if (i === words.length - 1) return;
    const b0 = t0[k];
    const cand = gaps.filter(([g0, g1]) => g1 > a1 - 0.2 && g0 < b0 + 0.1).sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]));
    bounds.push(cand.length ? [cand[0][0] + 0.05, cand[0][1] - 0.04] : [(a1 + b0) / 2, (a1 + b0) / 2]);
  });
  // あたま：さいしょ の ことば の 字 の 時間 より まえ で、いちばん あと に おわる しずか な ところ（その まえ の いき・小さな 声 を いれない）
  const first0 = t0[startIdx];
  const before = gaps.filter(([, g1]) => g1 <= first0 + 0.1);
  const head = before.length ? Math.max(0, before[before.length - 1][1] - 0.04) : 0;
  const tail = gaps.length && gaps[gaps.length - 1][1] >= dur - 0.02 ? Math.min(dur, gaps[gaps.length - 1][0] + 0.08) : dur;
  const cuts = words.map((w, i) => [i ? bounds[i - 1][1] : head, i < bounds.length ? bounds[i][0] : tail]);
  ids.forEach((id, i) => {
    if (KEEP && !KEEP.includes(id)) return;
    const [a, b] = cuts[i];
    const s = Math.max(0, a), e = b;
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(s), "-to", String(e), "-i", seq,
      "-af", "afade=t=in:d=0.02,areverse,afade=t=in:d=0.04,areverse", "-c:a", "libmp3lame", "-b:a", "128k", path.join(REVIEW, `${id}${SUFFIX}.mp3`)]);
    // 聞く ページ に 言わせた ことば を 出す（2026-11-23 代表：ID だけ だと どれ が どれ か わからない）
    const lp = path.join(REVIEW, "list.json");
    const list = fs.existsSync(lp) ? JSON.parse(fs.readFileSync(lp, "utf8")) : {};
    list[id + SUFFIX] = { type: "koguman", text: `${words[i]}（ならべて 言わせて 切り出し）`, made: new Date().toISOString() };
    fs.writeFileSync(lp, JSON.stringify(list, null, 1));
    console.log(`○ ${id}${SUFFIX}  ${words[i]}  ${(e - s).toFixed(2)}s`);
  });
})();
