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
src/MathOrganizer.jsx   単一ファイルのコンポーネント（default export: MathOrganizer）
```

## 依存

- `react` (18+)
- `lucide-react`

## 使い方

```jsx
import MathOrganizer from "./src/MathOrganizer";

export default function App() {
  return <MathOrganizer />;
}
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
