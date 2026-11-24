-- ぶにゅう の サーバー（Cloudflare D1）の 表（2026-11-24）
-- メールアドレス・子どもの情報 は 保存しない。保存するのは「ハッシュ（元に戻せない しるし）」と Stripe の お客さん番号 だけ

-- 名前のない 数（90日で 消す）
CREATE TABLE IF NOT EXISTS events (
  day TEXT NOT NULL,          -- 2026-12-01（日付だけ。時刻は 持たない）
  device TEXT NOT NULL,       -- 端末の でたらめな番号 の ハッシュ
  name TEXT NOT NULL,         -- free_start / lock_view / trial_start / paid_start
  genre TEXT,                 -- ロック画面の ジャンル
  stage INTEGER,              -- ロック画面の ステージ
  from_trial INTEGER          -- paid_start の とき：トライアルから？
);
CREATE INDEX IF NOT EXISTS events_day ON events(day);

-- 確認コード（10分で 切れる・5回 まちがえたら 使えない）
CREATE TABLE IF NOT EXISTS codes (
  email_hash TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  customer TEXT NOT NULL,     -- Stripe の お客さん番号（cus_...）
  expires INTEGER NOT NULL,
  tries INTEGER NOT NULL DEFAULT 0
);

-- 有料 の 端末（1家族 5台 まで）
CREATE TABLE IF NOT EXISTS devices (
  customer TEXT NOT NULL,
  device_hash TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created INTEGER NOT NULL,
  PRIMARY KEY (customer, device_hash)
);

-- 送りすぎ を ふせぐ（1時間ごとに 数える。キーは ハッシュ）
CREATE TABLE IF NOT EXISTS rate (
  key TEXT PRIMARY KEY,
  hour INTEGER NOT NULL,
  n INTEGER NOT NULL
);
