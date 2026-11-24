#!/usr/bin/env node
/*
  声 の 大きさ を そろえる（2026-11-24 代表：キャロ だけ 小さい と トラブル に なりかねない → 3体 とも おなじ 大きさ に）
  ・キャロ（Kaori）は ほか より 3〜4 ぐらい 小さかった（LUFS：こぐまん -17.0・しょべるん -18.7・キャロ -21.5）
  ・ぜんぶ の 声 を おなじ 大きさ（-18 LUFS ＝ いま の こぐまん の 部品 の 平均 ぐらい）に して アプリ に 入れる
  ・もと の 声（../voice-work/audio-128k/）は かえない。そこ から 大きさ を あわせて 64k に する

  つかいかた（app フォルダ で）：
    node tools/normalize_voices.js            → アプリ の 声 を ぜんぶ そろえなおす（3〜5分）
    node tools/normalize_voices.js pet-001-veggie,extra-102 → その ID だけ
  ・review_voices.js apply も この しくみ で 入れる ので、あたらしい 声 も しぜん に そろう
  ・LUFS は「人 が 聞いた とき の 大きさ」の ものさし。1もじ など みじかい 声 は はかれない ので、くりかえして はかる
*/
const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const AUDIO = path.join(ROOT, "kids-app", "audio");
const BACKUP = path.join(ROOT, "..", "voice-work", "audio-128k");
const TARGET = -18;              // そろえる 大きさ（LUFS）
const MAX_UP = 12, MAX_DOWN = 8; // 1つ の 声 で かえる はば（dB）。はかりまちがい で 大きく なりすぎない よう に

function loudness(file) {
  const parse = (s) => { const m = [...s.matchAll(/^\s*I:\s+(-?[\d.]+) LUFS/gm)]; return m.length ? +m[m.length - 1][1] : null; };
  const stderrOf = (loop) => {
    const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", ...(loop ? ["-stream_loop", "5"] : []), "-i", file, "-af", "ebur128", "-f", "null", "-"], { encoding: "utf8" });
    return r.stderr || "";
  };
  let v = parse(stderrOf(false));
  if (v === null || v <= -60) v = parse(stderrOf(true));   // みじかい 声 は くりかえして はかる
  return v === null || v <= -60 ? null : v;
}

// src（128k の もと の 声）を 大きさ を そろえて dest（アプリ の 64k）に する。かえた dB を かえす
function writeNormalized(src, dest) {
  const l = loudness(src);
  const gain = l === null ? 0 : Math.max(-MAX_DOWN, Math.min(MAX_UP, TARGET - l));
  const af = `volume=${gain.toFixed(2)}dB,alimiter=limit=0.89:level=disabled`;   // 大きく した とき に 音 が われない よう に（-1dB で おさえる）
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-af", af, "-ac", "1", "-b:a", "64k", dest]);
  return { lufs: l, gain };
}

module.exports = { loudness, writeNormalized, TARGET };

if (require.main === module) {
  const arg = process.argv[2];
  const ids = arg ? arg.split(",") : fs.readdirSync(AUDIO).filter((f) => f.endsWith(".mp3")).map((f) => f.slice(0, -4));
  let done = 0; const miss = [], big = [];
  for (const id of ids) {
    const src = path.join(BACKUP, `${id}.mp3`);
    if (!fs.existsSync(src)) { miss.push(id); continue; }
    const r = writeNormalized(src, path.join(AUDIO, `${id}.mp3`));
    if (r.lufs === null || Math.abs(TARGET - r.lufs) > 9) big.push(`${id}(${r.lufs})`);
    if (++done % 100 === 0) console.log(`… ${done}こ`);
  }
  console.log(`そろえた：${done}こ（${TARGET} LUFS）`);
  if (miss.length) console.log(`もと の 声 が ない：${miss.join(" ")}`);
  if (big.length) console.log(`はかれない・とても ちがう（はば を おさえた）：${big.join(" ")}`);
}
