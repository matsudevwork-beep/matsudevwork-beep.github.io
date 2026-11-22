#!/usr/bin/env node
/*
  アルファベット A〜Z（new-080〜105）の 声 を ElevenLabs で 作る（2026-11-22 代表：英語 らしい 声 ＝ Matilda）
  こぐまん の 声 で ためした が 英語 らしく ない → Jessica・Matilda・Alice を ききくらべ → Matilda

  つかいかた（app フォルダ で）：
    node tools/make_alphabet_voices.js            → まだ アプリ に も review に も ない 字 を 作る
    ONLY=A,R node tools/make_alphabet_voices.js   → その 字 だけ（作りなおし）
    node tools/make_alphabet_voices.js words      → 英語 の ことば（録音リスト の メモ が「英語」の 行。apple・red・Yes! など）も おなじ 声 で（2026-11-22 代表）
    ONLY=new-106,new-161 node tools/make_alphabet_voices.js words → その ID だけ
  ・作った 声 は ../voice-work/review/ へ（アプリ には 入れない）。代表 が 聞いて OK → node tools/review_voices.js apply ID
  ・文 は「[cheerful] A!」。モデル eleven_v4、設定 は こぐまん と おなじ
*/
const { execFileSync } = require("child_process"); const fs = require("fs"); const path = require("path");
const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "kids-app", "audio");
const R = path.resolve(process.env.OUT || path.join(ROOT, "..", "voice-work", "review"));
const VOICE = "XrExE9yKIg1WjnnlVkGX";   // Matilda
const set = { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true };
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
const key = execFileSync("security", ["find-generic-password", "-s", "bunyu-elevenlabs", "-w"], { encoding: "utf8" }).trim();
(async () => {
  fs.mkdirSync(R, { recursive: true });
  const LIST = path.join(R, "list.json");
  const list = fs.existsSync(LIST) ? JSON.parse(fs.readFileSync(LIST)) : {};
  let n = 0;
  const jobs = [];
  if (process.argv[2] === "words") {
    const csv = fs.readFileSync(path.join(ROOT, "docs", "voice-script.csv"), "utf8").replace(/^\uFEFF/, "").split("\n").slice(1);
    for (const line of csv) {
      const c = line.match(/"((?:[^"]|"")*)"/g); if (!c) continue;
      const [id, , yomi, , , memo] = c.map((x) => x.slice(1, -1).replace(/""/g, '"'));
      if (memo !== "英語") continue;
      const t = yomi.replace(/[!！]+$/, "");
      jobs.push([id, `[cheerful] ${t.charAt(0).toUpperCase() + t.slice(1)}!`, yomi, id]);
    }
  } else {
    for (let i = 0; i < 26; i++) { const L = String.fromCharCode(65 + i); jobs.push([`new-${String(80 + i).padStart(3, "0")}`, `[cheerful] ${L}!`, L, L]); }
  }
  for (const [id, text, L, key2] of jobs) {
    if (only ? !(only.includes(key2) || only.includes(id)) : (fs.existsSync(path.join(AUDIO, id + ".mp3")) || fs.existsSync(path.join(R, id + ".mp3")))) continue;
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, { method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ text, model_id: "eleven_v4", voice_settings: set }) });
    if (!res.ok) { console.log("×", id, res.status, (await res.text()).slice(0, 200)); continue; }
    fs.writeFileSync(path.join(R, id + ".mp3"), Buffer.from(await res.arrayBuffer()));
    list[id] = { type: process.argv[2] === "words" ? "英語 の ことば（Matilda）" : "アルファベット（Matilda）", text: L }; n++; console.log("○", id, L);
  }
  fs.writeFileSync(LIST, JSON.stringify(list, null, 1));
  console.log(`できた：${n}こ（${R}）→ node tools/review_voices.js で 聞く ページ を 作る`);
})();
