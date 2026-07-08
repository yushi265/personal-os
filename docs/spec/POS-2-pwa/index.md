# POS-2: ブラウザUIのPWA化

> 実装 spec の入口。読み手は人間（Gate 1/2/3 承認者）。AI 実装エージェントはレイヤー別 .md（[webapp.md](./webapp.md) / [ui.md](./ui.md)）を読む。
> 上流設計: [`design-pwa.md`](../../../design-pwa.md) v1.0（調査+設計書）。本 spec が実装の契約であり、design-pwa.md との乖離は「判断根拠」に明記済み（AC-10 で design-pwa.md 側を追従更新する）。

## 概要

ブラウザUI（webapp）を PWA 化する。Web App Manifest + Service Worker により (1) Chrome/Edge のインストール・Safari「Dockに追加」でスタンドアロンアプリとして起動できる、(2) サーバー未起動（=Obsidian 未起動）でもアプリシェルが起動し全画面案内を出す、(3) トークンの手動受け渡し経路（コピー・貼り付け）を整備する。

## 対象範囲

- 対象レイヤー:
  - [webapp.md](./webapp.md) — vite-plugin-pwa 導入・manifest・SW・アイコン・ServerUnreachableScreen・UnauthorizedScreen 拡張・theme-color 連動・`client.ts` 拡張
  - [ui.md](./ui.md) — SettingsTab「トークンをコピー」ボタン（Obsidian 内設定画面）
- 対象ドメイン: なし（domain / services / infra は無変更）
- **`src/server/` は無変更**（Tier 1 トリガー `server-auth` の対象に触れない。判断根拠参照）
- 対象外（やらないこと）:
  - Vault データのオフライン閲覧（API レスポンスの SW キャッシュ）。古い Todo 完了状態等を「現在」として見せる事故防止
  - オフライン書き込みキュー（単一書き込み経路の原則に反する複雑さ）
  - プッシュ通知・バックグラウンド同期
  - モバイル対応・apple-touch-icon 等の iOS 固有メタ（サーバーが `127.0.0.1` バインドで同一マシン限定のため物理的に届かない）
  - インストール促進 UI（`beforeinstallprompt` ボタン）。ブラウザ標準のインストール UI に任せる
  - ポート自動繰り上げ挙動の変更（「ポート固定モード」は将来オプションとして design-pwa.md §7.1 に記録済み）

## ユニット計画

単一ユニット。

## 受け入れ基準（AC）

- [ ] **AC-1**: `npm run webapp:build` の成果物（webapp/dist）に `manifest.json`・`sw.js`・PWAアイコン3点（192/512/maskable 512）が含まれ、`index.html` に manifest リンクと `theme-color` メタが注入されている
- [ ] **AC-2**: Chrome DevTools の Application > Manifest でエラー・インストール可能性警告がゼロで、アドレスバーからスタンドアロンアプリとしてインストールできる
- [ ] **AC-3**: Service Worker はビルド成果物のみを precache し、`/api/` 配下のリクエストをキャッシュ・ナビゲーションフォールバックの対象にしない
- [ ] **AC-4**: サーバー到達不可時（fetch が TypeError）、`request()` が unreachable ハンドラを発火して `ApiError(status=0)` を投げ、webapp は全画面の ServerUnreachableScreen（案内文言＋再試行ボタン）を表示する
- [ ] **AC-5**: UnauthorizedScreen でトークンを入力して適用すると `localStorage` に保存されリロードで認証済み状態に復帰する。401 時に既存どおりトークン破棄と unauthorized ハンドラ発火が行われる
- [ ] **AC-6**: SettingsTab のサーバーセクションに「トークンをコピー」ボタンがあり、クリックでトークンがクリップボードへコピーされ完了 Notice が出る。トークン未生成時はコピーせず案内 Notice を出す
- [ ] **AC-7**: テーマ切替（light / dark / system 追従）に応じて `<meta name="theme-color">` の content が `#f8fafc`（light）/ `#000000`（dark）に切り替わる
- [ ] **AC-8**: `favicon.svg` が青基調（`#2563eb`）に更新され、PWA アイコン 3 点と同一の図柄・配色である
- [ ] **AC-9**: 既存の全テストが green のまま、`npm run build`（プラグイン＋webapp）と両 typecheck が成功し、SSE 同期・既存画面の挙動が変わらない
- [ ] **AC-10**: README に PWA 利用手順・トラブルシュートの節が追加され、`requirements-browser-ui.md` §1.3 の「オフライン動作・PWA化」がスコープイン済みとして更新され、`design-pwa.md` が実装との乖離なく更新されている

## アーキテクチャ / レイヤー間フロー

```
ブラウザ/PWA
  ├─ 静的アセット(manifest.json / sw.js / アイコン): StaticServer(無改修)が既存MIMEマップで配信
  │    manifest.json → application/json(既存)。sw.js → text/javascript(既存)。SPAフォールバックも既存のまま
  ├─ SW: ビルド成果物のみ precache。/api/* は素通し(respondWithしない)
  └─ /api/*: 従来通り fetch + Bearer / EventSource(SSE)。到達不可(TypeError)のみ client.ts が新ハンドラで捕捉
プラグイン(Obsidian)
  └─ SettingsTab: トークンをコピー(tokenStore.get() → navigator.clipboard)
```

- レイヤー間の新規インターフェースは**なし**（API 契約・スキーマ・ルーティング不変）。共有物は `src/i18n/ja.ts` への文言キー追加のみ（各レイヤー .md が自分のキーを所有）。

## エラー・ログ方針（横断サマリ）

| シナリオ | webapp | ui（プラグイン） | 表示層の挙動 |
|---|---|---|---|
| サーバー到達不可（fetch TypeError） | `request()` が unreachable ハンドラ発火 + `ApiError(0)` | — | 全画面 ServerUnreachableScreen（再試行=リロード）。ログなし |
| 401（トークン不一致） | 既存挙動維持（トークン破棄+ハンドラ） | — | UnauthorizedScreen（**トークン手動入力欄を追加**） |
| クリップボード書き込み失敗 | — | `console.error` + `Notice(t("E006"))` | 既存 E006 文言（ExportService と同一パターン） |
| トークン未生成でコピー | — | `Notice(copyTokenEmpty)`・コピーしない | 案内 Notice のみ |
| manifest/sw 未生成の旧ビルド配信（過渡状態） | ブラウザが MIME 不一致で無視（SW 更新は失敗し既存 SW 維持=フェイルセーフ） | — | 実害なし。対応不要 |

## テスト戦略

> 基準は [.claude/rules/testing.md](../../../.claude/rules/testing.md)。webapp の UI コンポーネントはビルド+型チェック+手動確認が既存方針（design-browser-ui.md §8・POS-1 踏襲）。root Vitest でテストできる webapp コードは import 文ゼロのモジュールに限る（codekb/shared.md の既知の罠）。`client.ts` は import 文ゼロのため単体テスト対象にできる。

| AC | 単体 | レイヤー内結合 | ビルド検査/手動 |
|----|------|--------------|----------------|
| AC-1 | — | — | ビルド出力検査（dist 内容物） |
| AC-2 | — | — | 手動（DevTools Manifest・インストール） |
| AC-3 | — | — | ビルド出力検査（sw.js の precache 一覧・fallback denylist）+ 手動（SSE 動作不変） |
| AC-4 | `tests/webapp/client.test.ts`（TypeError→ハンドラ+ApiError(0)） | — | 手動（Obsidian 停止→PWA 起動→画面表示→再試行復帰） |
| AC-5 | `tests/webapp/client.test.ts`（401→clearToken+ハンドラ=回帰固定） | — | 手動（トークン入力→復帰） |
| AC-6 | —（SettingsTab はテスト前例なし・Obsidian API グルー。[ui.md](./ui.md) に削減理由明記） | — | 手動 |
| AC-7 | — | — | 手動（テーマ切替→メタ値確認） |
| AC-8 | — | — | 目視 |
| AC-9 | 既存全件（回帰） | 既存全件（回帰） | `npm run build` + 両 typecheck |
| AC-10 | — | — | 目視（文書レビュー） |

## 既存実装との関係（再利用 / 差分 / 衝突）

- **再利用**: `Input`/`Button`（`webapp/src/components/ui/`）でトークン入力欄を構成（新規部品なし）。`setUnauthorizedHandler` パターン（`client.ts` + `main.tsx` Root）を unreachable にも複製。`applyTheme()`（`theme-provider.tsx:17-21`）がテーマ変更の全経路（ThemeToggle / CommandPalette / system 変更）の集約点なので theme-color 書き換えはここ 1 箇所。クリップボードは `ExportService.ts:125-133` の try/catch+`E006` パターンを踏襲。i18n は `ja.ts` の追記区画（`ja.ts:172` コメント）へ
- **差分**: PWA/manifest/SW 関連コードは webapp 内に一切なし（grep 確認済み）= 完全新規
- **衝突・依存**: `ConnectionBanner`（SSE 切断・`Layout.tsx:64`）と ServerUnreachableScreen は責務が別（表示済みデータありの一時切断 vs 初期データ取得不能）。全画面が構造上優先される（バナーはシェル内要素）。StaticServer の SPA フォールバック（`/api/` 以外→index.html）は `createBrowserRouter` と SW の `navigateFallback` の前提として**無改修のまま**成立
- **QueryClient はオプションなし（retry デフォルト 3 回）だが変更しない**: 到達不可の検知は `request()` の TypeError で即時発火するため、クエリの retry 完了を待たない（体感遅延なし）

## 実装に効く制約

- **`src/server/` に触れない**（触れる場合はティア再宣言が必要）。`manifest.json` 命名の採用（判断根拠参照）がこの制約の裏付け
- root Vitest でテストする webapp コードは **import 文ゼロ**を維持する（`client.ts` は現状ゼロ・追加コードでも import を増やさない）
- `webapp/tsconfig.json` の `compilerOptions.types` は**変更しない**（未設定のため、設定すると自動包含が限定される副作用がある）。仮想モジュール型は `webapp/src/vite-env.d.ts` の triple-slash 参照で通す
- 新規文言はすべて `src/i18n/ja.ts` に追記（ハードコード禁止・既存方針）
- `npm run build` のチェーン（webapp:build → esbuild → webapp-dist コピー）は無変更で PWA 資産が同梱される（vite-plugin-pwa は dist に出力するだけ）

## 判断根拠 / 未決事項

- **manifest ファイル名を `manifest.json` にする（vite-plugin-pwa の `manifestFilename` 指定）**: 標準名 `manifest.webmanifest` だと StaticServer の CONTENT_TYPES に `.webmanifest` が無く `application/octet-stream` 配信になる。`.json` は既存マップで `application/json` 配信され、ブラウザは manifest の MIME を厳格要求しないため実用上完全に動く（manifest.json は CRA 等で広く実績のある慣行）。**これにより `src/server/`（セキュリティ境界・Tier 1 トリガー）を無改修にできる**。却下案: `.webmanifest`+MIME 1 行追加（design-pwa.md §5.1 の原案）— セキュリティ境界のファイルに触れるコストが、拡張子の標準準拠という美観に見合わない。design-pwa.md §5 とのこの乖離は AC-10 で design-pwa.md 側を更新して解消する
- **ティアは Tier 1 のまま維持**: 上記判断で server-auth トリガーには触れなくなったが、降格には人間承認が要り、かつ本ユニットは spec 実行のため Tier 1/2 でゲート深度が実質同一（Gate 1/2/3 全てブロッキング）。降格は無意味な儀式なので行わない
- **レイヤーファイルは webapp.md + ui.md の 2 本**: `src/settings/SettingsTab.ts` は architecture.md のレイヤー表に明示されないが、Obsidian 内表示層の実装なので `ui.md` に置く（センサー認識ファイル名 domain/services/infra/ui/webapp の範囲内に収める）。`server.md` の新設案は却下（spec-sections センサーの機械検査から外れる）
- **アイコンは青（`#2563eb`）に刷新し favicon.svg も同時更新**: Gate 1（2026-07-08）で人間が確定（AskUserQuestion）。第 5 次のプライマリ青統一とブランド整合
- **再試行・トークン適用は `window.location.reload()`**: `unauthorized`/`unreachable` state に false へ戻す経路を作るより、リロードが単純確実（キャッシュ全再取得も兼ねる）。SW がシェルを precache 済みなのでオフラインでもリロードは安全
- **全画面の優先順位は unreachable > unauthorized**: 到達不可は 401 判定より前段の障害のため
- **theme_color / background_color は light の `--bg`（`#f8fafc`）**: manifest は 1 色しか持てないため light を既定にし、実行時は `applyTheme()` が `<meta name="theme-color">` を `#f8fafc`/`#000000`（dark の `--bg`）に動的更新する
- **フォント（Geist woff2 5 本・計 256K）も precache に含める**: オフライン初回起動から本文フォントを出す。合計 precache ~1MB でローカル配信のためコスト実質ゼロ
- **Gate 1 確定事項の記録**（AskUserQuestion 回答・questions.md は起票せず本節へ直接転記）: チケット=POS-2 / ティア=Tier 1（昇格再宣言・2026-07-08）/ Gate 2=非委任 / アイコン=青刷新
- 未決事項: なし
