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
if (!m) { console.log("例：node tools/make_count_voices.js num-001..011"); process.exit(1); }
const ids = [];
for (let i = +m[2]; i <= +m[3]; i++) ids.push(`${m[1]}-${String(i).padStart(3, "0")}`);
const words = ids.map((id) => yomi[id].replace(/[！!。、\s]/g, ""));
const text = TAGS + words.join("、") + "。";
console.log(text);
if (process.env.DRY) process.exit(0);

const key = execFileSync("security", ["find-generic-password", "-s", "bunyu-elevenlabs", "-w"], { encoding: "utf8" }).trim();
(async () => {
  const vs = await (await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": key } })).json();
  const v = vs.voices.find((x) => x.name.startsWith("Sameno"));
  // もと の 声 と「どの 字 を 何秒 に 言ったか」は とっておく（切りなおし は クレジット なし。REDO=1 で 作りなおし）
  const seq = path.join(REVIEW, "..", "count-seq", `${arg}.mp3`);
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
  const body = words.join("、");
  const startIdx = ch.join("").lastIndexOf(body);
  if (startIdx < 0) { console.log("字 の 時間 が 見つからない", ch.join("")); process.exit(1); }
  const dur = +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", seq], { encoding: "utf8" });
  const cuts = []; let k = startIdx;
  words.forEach((w, i) => {
    const a0 = t0[k], a1 = t1[k + w.length - 1];
    const nxt = i < words.length - 1 ? t0[k + w.length + 1] : dur;
    const prevEnd = i > 0 ? cuts[i - 1][1] : 0;
    // はじめ は まえ の ことば と の まんなか より あと、おわり は つぎ の ことば と の まんなか まで
    cuts.push([Math.max(prevEnd, a0 - 0.06), Math.min(nxt, a1 + (nxt - a1) / 2)]);
    k += w.length + 1;
  });
  ids.forEach((id, i) => {
    const [a, b] = cuts[i];
    const s = Math.max(0, a), e = b;
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(s), "-to", String(e), "-i", seq,
      "-af", "afade=t=in:d=0.02,areverse,afade=t=in:d=0.04,areverse", "-c:a", "libmp3lame", "-b:a", "128k", path.join(REVIEW, `${id}.mp3`)]);
    console.log(`○ ${id}  ${words[i]}  ${(e - s).toFixed(2)}s`);
  });
})();
