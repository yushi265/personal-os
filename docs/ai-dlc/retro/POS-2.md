# POS-2 AI-DLC 振り返り学習ノート（retro note）

> このユニット（チケット）で**何を学んだか**を残す永続資産。`progress.md`（揮発・再開用）とは別物。
> 各 Stage の境界で notable な気づきだけ追記し、Gate 3 で KPT を蒸留する。
> 証跡（テスト数・ゲート結果）は progress.md / PR を指すポインタに留め、ここに転記しない。
> ループの全体像と還流先は [README.md](./README.md)。

## メタ

- ticket: POS-2
- 機能概要: ブラウザUI（webapp）のPWA化。manifest+Service Worker によるインストール可能化・アプリシェルのオフライン起動・未接続時UX（ServerUnreachableScreen / トークン手動入力）。設計正本は `design-pwa.md` v1.0
- Stage 宣言の結果: 全 Stage 実行（Tier 1・spec 実行=server-auth トリガー該当のため。Gate 2 非委任）
- トークン実測: 未計測（/cost 相当値の取得なし）
- 着手日 / 完了日: 2026-07-08 / 2026-07-08

## 各 Stage の気づき（材料・軽量）

> notable なものだけ。摩擦・想定外・判断を 1〜2 行。無ければ省略してよい。

| Stage | 気づき（摩擦・想定外・判断） |
|-------|------------------------------|
| 1 要件整理＋Stage 宣言 | 初回宣言を Tier 2 と誤判定 → `tier-triggers.json` の server-auth（`src/server/**` 存在判定）確認で Tier 1 へ昇格再宣言。ティア判定は定義表の文言だけでなく**機械トリガーの glob を必ず突合**すべき |
| 2 spec 作成 | ①`server.md` 新設案は却下（spec-sections センサーの LAYER_FILES 外=機械検査の空白）。webapp.md/ui.md へ集約（POS-1 前例整合）。②Explore の発見: vite-plugin-pwa の `manifestFilename: "manifest.json"` で `.webmanifest` MIME 追加が不要になり **`src/server/`（Tier 1 トリガー）を無改修化できた**。「Tier 1 領域に触れない実装代替が無いか」を spec 段階で探すのは有効な手筋 |

## 振り返り（KPT）

> Gate 3 で蒸留する。このノートの主役。

### Keep（効いた・次も続ける）
- Stage 2a の Explore 調査で機械設定（tier-triggers.json / spec-sections.ts の LAYER_FILES / vitest 環境）まで対象にしたことで、ティア誤宣言の早期是正と spec レイヤーファイル名の正しい選択ができた
- 「Tier 1 トリガー領域に触れない実装代替」の探索（manifest.json 命名 → src/server 無改修化）。リスク面と工数の両方を削減
- 実装 3 体並列のファイル所有完全分離（webapp基盤 / ランタイム配線 / SettingsTab）+ 共有契約物（i18n キー）のメインループ事前配置で、コンフリクトゼロ・受領検査も全件一発 pass
- import 文ゼロ制約（POS-1 の学び）を事前に踏まえて client.ts を TDD 対象に選定できた（codekb の再利用が効いた実例）

### Problem（詰まった・摩擦・想定外）

> 各項目の先頭に分類タグ `[カテゴリ]` を付ける（棚卸しでの再発チェック集計キー）。
> カテゴリ: `spec` / `tdd` / `review` / `gate` / `boundary` / `security` / `tooling` / `other`。

- [gate] 初回ティア判定で risk-tiers.md の定義表の文言だけを見て Tier 2 と誤宣言。tier-triggers.json の glob（`src/server/**`・存在判定）との突合で Tier 1 該当が判明し昇格再宣言の往復が 1 回発生
- [tooling] qlmanage の SVG→PNG 変換が透過を白背景に合成する（実装エージェントが発見・Chrome headless + sips 縮小で解決。codekb 記録済み）
- [tooling] aidlc-engine nudge hook の state 命名誤発火が POS-1 に続き再発（既知・無視で対応。learnings の未対応 Try に該当）

### Try（次に変える・ハーネスへ還流）

- ティア判定手順（Stage 0+1）に「変更予定ファイルと tier-triggers.json の glob を突合する」を明記する（還流先候補: `.claude/rules/risk-tiers.md` 運用節 or ai-dlc-flow Stage 0+1）
- （POS-1 未対応 Try の再発確認）nudge hook / artifact guard の state 命名規約統一は棚卸しで対応
