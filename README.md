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
