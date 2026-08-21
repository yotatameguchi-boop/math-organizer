# 問題帳 (math-organizer)

中学受験・高校受験・大学受験の数学／算数の問題を、**単元別**と**解法タイプ別**の 2 軸で整理する React コンポーネントです。

- レベル切り替え（中学受験＝小学生・算数／高校受験＝中学生・数学／大学受験＝高校生・数学）
- 単元マップとタイプ別索引の 2 タブ
- 習熟度（未着手・学習中・復習必要・習得済み）と難易度★、出典・メモ
- 問題名／出典／メモの横断検索
- 解法タイプはユーザー側で追加・削除可能
- 初回起動時に各レベルの例題を自動投入（一度削除すれば復活しません）

## 構成

```
index.html                  エントリ
src/main.jsx                マウント
src/MathOrganizer.jsx       本体（default export: MathOrganizer）
src/api.js                  サーバー同期クライアント
server/db.js                SQLite スキーマとクエリ
server/app.js               HTTP ハンドラ
server/index.js             起動スクリプト
server/*.test.js            テスト
scripts/make-artifact.mjs   dist を単一 HTML にまとめる
```

## 開発

```bash
npm install
npm run dev
```

## ビルド

```bash
npm run build          # dist/ に通常のビルド
npm run build:single   # dist/single.html に全部インライン化した 1 ファイル
```

`build:single` は CDN を一切参照しない自己完結 HTML を出力します。Claude Artifact のように
外部ホストへの通信を CSP で禁止する環境向けです。出力は ASCII のみ（日本語は `\uXXXX` と
実体参照）なので、charset 指定が無い環境でも文字化けしません。

GitHub Pages などサブパス配下に置く場合は base を指定します。

```bash
BASE_PATH=/math-organizer/ npm run build
```

## フォントについて

見出しは Shippori Mincho、本文は Noto Sans JP を Google Fonts から読み込みますが、
CSP で外部フォントが読めない環境では OS 側の明朝／ゴシック（Hiragino Mincho ProN、
Hiragino Sans など）にフォールバックします。日本語フォントは data URI 埋め込みだと
数 MB 規模になり、かつユーザー入力文字をサブセット化できないため埋め込んでいません。

## バックエンド（任意）

接続しなくてもアプリは動きます。繋ぐと複数の端末で同じ問題帳を共有できます。

```bash
npm run build     # 静的配信したい場合。dev サーバーだけで使うなら不要
npm run server
```

起動すると URL とトークンが表示されます。アプリ右上の「この端末のみ」バッジから接続設定を開き、
その 2 つを入れてください。トークンは `data/token` にも保存されます。

依存はゼロです。DB は Node 24 標準の `node:sqlite`、HTTP は `node:http` で、`data/` 配下に
SQLite ファイルを作ります（`.gitignore` 済み）。

### 環境変数

| 変数 | 既定値 | 用途 |
| --- | --- | --- |
| `PORT` | `5174` | 待ち受けポート |
| `HOST` | `127.0.0.1` | 他端末から使うなら `0.0.0.0` |
| `MO_DB` | `data/math-organizer.db` | SQLite ファイル |
| `MO_TOKEN` | `data/token` を自動生成 | 認証トークン |
| `MO_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | CORS 許可オリジン（カンマ区切り） |

### API

`/api/health` 以外は `Authorization: Bearer <token>` が必要です。

| メソッド | パス | 内容 |
| --- | --- | --- |
| `GET` | `/api/health` | 疎通確認。認証不要 |
| `GET` | `/api/state` | 全件（problems / types / seededLevels / version） |
| `PUT` | `/api/state` | スナップショット保存。`version` を付けるとズレていれば 409 と最新状態を返す。省略すると強制上書き |
| `GET` | `/api/problems` | `level` `unitId` `status` `typeId` `q` で絞り込み |
| `GET` | `/api/stats` | 総数・ステータス別・単元別の集計 |

### 同期のふるまい

- 起動時にサーバーと突き合わせ、id が同じ項目は `updatedAt` が新しい方を採ります
- 変更は 800ms まとめてから PUT します
- 409 が返ったら統合し直して再送します
- サーバーに繋がらない間も localStorage に書き続けるので、オフラインで操作しても失われません
- 削除は伝播しません。単一ユーザー前提なので、消したものが復活するより消えると困るものが残る方を選んでいます

## テスト

```bash
npm test
```

## データの保存先

`loadJSON` / `saveJSON` が次の順にフォールバックします。

1. `window.storage`（ホスト側が提供する場合）
2. `localStorage`
3. メモリ（同一セッションのみ）

使用キー:

| キー | 内容 |
| --- | --- |
| `math-problems` | 登録した問題 |
| `math-problem-types` | 解法タイプ |
| `math-seeded-levels` | 例題を投入済みのレベル |
| `math-server-config` | バックエンドの URL とトークン（端末ごと） |
