# POS-1 AI-DLC 振り返り学習ノート（retro note）

> このユニット（チケット）で**何を学んだか**を残す永続資産。`progress.md`（揮発・再開用）とは別物。
> 各 Stage の境界で notable な気づきだけ追記し、Gate 3 で KPT を蒸留する。

## メタ

- ticket: POS-1
- 機能概要: webapp に labels を接続（詳細画面の表示・編集 / 一覧のチップ表示・フィルタ）。実装済みで未配線だった TagChipsEdit の配線完遂
- Stage 宣言の結果: 全 Stage 実行（Tier 2・spec 実行=単一レイヤー判定が際どいため安全側・Gate 2 委任）
- トークン実測: 未計測（/cost 相当値の取得なし。機械記録があるのはレビュー 3 体分のみ: 93,775 + 74,233 + 82,663）
- 着手日 / 完了日: 2026-07-07 / 2026-07-07

## 各 Stage の気づき（材料・軽量）

| Stage | 気づき（摩擦・想定外・判断） |
|-------|------------------------------|
| 1 要件整理＋Stage 宣言 | 「ラベル機能を実装」の依頼が、実は Obsidian 側実装済み・webapp 側未配線という状態だった。既存実装調査を要件確定の前に回したことで、スコープを「新規開発」でなく「配線完遂」に正しく縮小できた |
| 2 spec 作成 | webapp のロジックを root Vitest で試験するには「import ゼロの純関数」に寄せる必要がある（root tsconfig に paths がなく、vitest alias も obsidian のみ）。既存 sortEntities.ts は @domain import のため未テストのままという構造的制約を発見 |
| 2/5 ハーネス | engine の nudge hook（spec ディレクトリ名 = state 名を提案）と artifact guard（state 名 = チケット番号のみを期待、glob `<name>-*`）の命名規約が不一致。state/POS-1.md に合わせたため、spec 内 md を編集するたび nudge が誤発火する |
| 6 セルフレビュー | 3 体とも Must/Should ゼロ。IMO 3 件は全て spec 本文の記述精度（コードでなく doc 側の修正で解消）。spec を先に固めてから委譲する型がそのまま効いた |

## 振り返り（KPT）

> Gate 3 で蒸留する。

### Keep（効いた・次も続ける）
- 要件確定の前に既存実装調査（Explore 委譲）を回したことで、依頼の実体が「新規開発」でなく「実装済み部品の配線完遂」だと判明し、スコープを最小化できた
- spec を具体値（シグネチャ・配線イメージ・i18n キー・変更禁止範囲）まで固めてから implementer に委譲 → self-review 3 体で Must/Should ゼロの一発通過
- テスト不能な UI 層からロジックを依存ゼロ純関数（entityFilter.ts）へ切り出す設計判断を spec 段階で行った

### Problem（詰まった・摩擦・想定外）

- `[tooling]` engine の nudge hook（spec ディレクトリ名 = state 名）と artifact guard（state 名 = チケット番号・glob `<name>-*`）の命名規約が不一致。spec 配下の md を編集するたび nudge が誤発火する
- `[tooling]` webapp レイヤーに自動テスト基盤（コンポーネントテスト）が無く、UI 配線の担保が build + 手動確認頼み（本ボルト固有ではなく P3 以来の構造的制約）

### Try（次ボルト以降でフローをこう変える）
- nudge hook と artifact guard の state 命名規約を片方に統一する（ハーネス修正ボルト）
- root vitest に `@domain` alias を追加して webapp/src/lib のテスト可能範囲を広げるか検討（sortEntities.ts も未テストのまま）

## フロー改善アクション

| Try | 還流先 | ステータス |
|-----|--------|-----------|
| nudge hook / artifact guard の state 命名規約統一 | `.claude/hooks/aidlc-engine-nudge.sh` + `.claude/aidlc/src/state/`（guard） | 未対応 |
| root vitest への `@domain` alias 追加検討 | `vitest.config.ts`（+ `.claude/rules/testing.md` 注記） | 未対応（検討） |
