# ぶにゅう の サーバー（Cloudflare）— 2026-11-24 作成・**まだ公開していない**

アプリ（`kids-app/`）と、小さなサーバー（`src/index.js`）を **おなじ住所** で出します。
サーバーがするのは2つだけです。①名前のない数を数える ②払った人の確認（メール＋6けたのコード・1家族5台まで）

## 保存するもの・しないもの
| 保存する | 保存しない |
|---|---|
| 端末の でたらめな番号の ハッシュ（元に戻せない しるし） | 子どもの名前・記録・書いた字 |
| できごと・日付・ロックした ジャンル／ステージ | メールアドレス（ハッシュだけ）・IPアドレス（回数を数える1時間だけ、ハッシュで） |
| Stripe の お客さん番号（cus_…）と 有料の端末 | カード情報（Stripe だけが持つ） |

数は90日、確認コードは10分で消えます（毎日の自動そうじ）。

## 公開の手順（代表と いっしょに・お金や契約に かかわる所は 代表）
1. Cloudflare の無料アカウントを作る（**代表**。開発用アカウントのメールで）
2. パソコンで `cd worker` → `npx wrangler login`（**代表**がブラウザでログイン）
3. データベースを作る：`npx wrangler d1 create bunyu` → 出てきた ID を `wrangler.toml` の `database_id` に入れる
4. 表を作る：`npx wrangler d1 execute bunyu --remote --file=schema.sql`
5. 秘密のカギを入れる（**画面に出さない・ファイルに書かない**）
   - `npx wrangler secret put HASH_SALT`（でたらめな長い文字。`openssl rand -hex 32` で作る）
   - `npx wrangler secret put STRIPE_SECRET`（Stripe の **制限付きキー**。読むだけ：Customers と Subscriptions の Read）
   - `npx wrangler secret put RESEND_KEY`（メールを送るサービス Resend のキー。無料で月3,000通）
6. 公開：`npx wrangler deploy` → `https://bunyu.<名前>.workers.dev` で開ける
7. 独自ドメインを使うなら Cloudflare でつなぐ（**代表**が決める）

## 本番と開発（2026-11-24 代表決定：サーバーは2つ）
- **開発用は作成ずみ**（2026-11-24）：https://bunyu-dev.matsu-dev-work.workers.dev ／ データベース `bunyu-dev` ／ 入れたカギ：HASH_SALT だけ（STRIPE_SECRET・RESEND_KEY はまだ）
- 道具は `worker/` で `npm install` 済み（`npx wrangler …`）
| | 公開のコマンド | Stripe | データベース |
|---|---|---|---|
| 本番 | `npx wrangler deploy` | 本番モード | `bunyu` |
| 開発 | `npx wrangler deploy --env dev` | **テストモード** | `bunyu-dev` |

- 開発用も 上の手順 3〜5 を `--env dev` をつけて行う（例：`npx wrangler d1 create bunyu-dev`、`npx wrangler d1 execute bunyu-dev --remote --env dev --file=schema.sql`、`npx wrangler secret put STRIPE_SECRET --env dev`）
- **開発用には テストモードのカギ（`rk_test_…`）、本番には 本番のカギ（`rk_live_…`）**。取り違えないように、入れる前に頭の文字を見る
- あとで GitHub とつなぐ：`dev` ブランチ → 開発、`main` → 本番 に自動で出るようにする（いまは手でコマンド）
- 開発用の住所は 人に教えない

## もどす・とっておく（バックアップ用のサーバーは作らない）
- **公開をまちがえた**：Cloudflare の画面 → Workers → bunyu → Deployments → 1つ前の版を「Rollback」（または `npx wrangler rollback`）
- **データベースを少し前に戻す**：`npx wrangler d1 time-travel restore bunyu --timestamp=<日時>`【要確認：無料で何日前まで戻せるか】
- **月1回 ファイルに書き出す**：`npx wrangler d1 export bunyu --remote --output=../../backup/bunyu-YYYY-MM.sql`
  - 書き出したファイルは **公開リポジトリに入れない**（`08_kids-app/backup/` はリポジトリの外）
- プログラム・絵・声は GitHub に全部の版が残っている。子どもの記録はサーバーにない（端末の「記録をとっておく・もどす」）

## 数の見かた（Cloudflare の画面 → D1 → bunyu → Console）
```sql
-- 無料で使いはじめた人数（日ごと）
SELECT day, COUNT(DISTINCT device) FROM events WHERE name='free_start' GROUP BY day;
-- ロック画面：どのジャンル・ステージで止まったか（回数と人数）
SELECT genre, stage, COUNT(*) AS 回数, COUNT(DISTINCT device) AS 人数 FROM events WHERE name='lock_view' GROUP BY genre, stage ORDER BY 回数 DESC;
-- トライアルを始めた人数
SELECT COUNT(DISTINCT device) FROM events WHERE name='trial_start';
-- トライアルから有料になった人数
SELECT COUNT(DISTINCT device) FROM events WHERE name='paid_start' AND from_trial=1;
```
