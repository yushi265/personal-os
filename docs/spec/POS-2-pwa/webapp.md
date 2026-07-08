# POS-2: webapp（ブラウザ表示層）詳細設計

> レイヤー規約: webapp は React SPA（`webapp/`）。UI コンポーネントのテストはビルド+型チェック+手動が既存方針、
> root Vitest でテストするコードは import 文ゼロに限る（codekb/shared.md）。

## 担保 AC（[index.md](./index.md) の AC からの引用）

- **AC-1**: `npm run webapp:build` の成果物（webapp/dist）に `manifest.json`・`sw.js`・PWAアイコン3点（192/512/maskable 512）が含まれ、`index.html` に manifest リンクと `theme-color` メタが注入されている
- **AC-2**: Chrome DevTools の Application > Manifest でエラー・インストール可能性警告がゼロで、アドレスバーからスタンドアロンアプリとしてインストールできる
- **AC-3**: Service Worker はビルド成果物のみを precache し、`/api/` 配下のリクエストをキャッシュ・ナビゲーションフォールバックの対象にしない
- **AC-4**: サーバー到達不可時（fetch が TypeError）、`request()` が unreachable ハンドラを発火して `ApiError(status=0)` を投げ、webapp は全画面の ServerUnreachableScreen（案内文言＋再試行ボタン）を表示する
- **AC-5**: UnauthorizedScreen でトークンを入力して適用すると `localStorage` に保存されリロードで認証済み状態に復帰する。401 時に既存どおりトークン破棄と unauthorized ハンドラ発火が行われる
- **AC-7**: テーマ切替（light / dark / system 追従）に応じて `<meta name="theme-color">` の content が `#f8fafc`（light）/ `#000000`（dark）に切り替わる
- **AC-8**: `favicon.svg` が青基調（`#2563eb`）に更新され、PWA アイコン 3 点と同一の図柄・配色である
- **AC-9**: 既存の全テストが green のまま、`npm run build`（プラグイン＋webapp）と両 typecheck が成功し、SSE 同期・既存画面の挙動が変わらない
- **AC-10**: README に PWA 利用手順・トラブルシュートの節が追加され、`requirements-browser-ui.md` §1.3 の「オフライン動作・PWA化」がスコープイン済みとして更新され、`design-pwa.md` が実装との乖離なく更新されている

## このレイヤーが公開する契約（外部インターフェース）

| 操作 | 名前 / パス | 入出力・型・制約 | 認証・アクセス制御 | 用途 |
|------|------------|-----------------|-------------------|------|
| 追加 | `webapp/dist/manifest.json` | 下記 manifest 確定値。`application/json` で配信（StaticServer 既存マップ） | 不要（静的アセット・秘密なし） | インストール可能化 |
| 追加 | `webapp/dist/sw.js` | vite-plugin-pwa（generateSW）生成。precache=ビルド成果物のみ | 不要（同上） | アプリシェルのオフライン起動 |
| 追加 | `webapp/public/pwa-192.png` / `pwa-512.png` / `pwa-maskable-512.png` | PNG 192²/512²/512²(maskable=セーフゾーン中央 80%) | 不要 | manifest icons |
| 変更 | `webapp/public/favicon.svg` | 図柄維持（角丸四角+白三角）・地色 `#0f9d58`→`#2563eb` | 不要 | AC-8 |
| 追加 | `client.ts` の `setServerUnreachableHandler(handler: () => void): void` | `setUnauthorizedHandler` と同形。`request()` が fetch の `TypeError` 捕捉時に発火し `ApiError(0, "server unreachable")` を throw | — | AC-4 |
| 追加 | i18n キー（本レイヤー所有・`src/i18n/ja.ts` へ追記） | 下記文言表 | — | 新画面の文言 |

### manifest 確定値（`vite.config.ts` の `manifest` オプション）

```jsonc
{
  "name": "Personal OS",
  "short_name": "Personal OS",
  "description": "Obsidian Personal OS ブラウザUI",
  "lang": "ja",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "theme_color": "#f8fafc",
  "background_color": "#f8fafc",
  "icons": [
    { "src": "/pwa-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/pwa-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/pwa-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### vite-plugin-pwa 設定確定値（`webapp/vite.config.ts` の plugins へ追加）

```ts
VitePWA({
  registerType: "autoUpdate",          // skipWaiting+clientsClaim。更新プロンプトUIは作らない
  manifestFilename: "manifest.json",   // .webmanifest を避け StaticServer 無改修で配信（index.md 判断根拠）
  manifest: { /* 上記確定値 */ },
  workbox: {
    globPatterns: ["**/*.{js,css,html,svg,png,woff2}"], // フォント含むアプリシェル一式（LICENSE.txt は対象外）
    navigateFallback: "index.html",
    navigateFallbackDenylist: [/^\/api\//],             // /api・SSE に index.html を返さない
    // runtimeCaching は設定しない = /api/* は SW が respondWith せず素通し（AC-3）
  },
})
```

- 依存追加: `webapp/package.json` の devDependencies に `vite-plugin-pwa`（^1.3.0。Vite 5 対応確認済み。workbox-build/workbox-window が peer として入る=ビルド時のみ・main.js への影響ゼロ）
- SW 登録: `webapp/src/main.tsx` の `consumeTokenFromUrl()` 直後に `import { registerSW } from "virtual:pwa-register";` + `registerSW();`（dev サーバーでは自動 no-op）
- 型: `webapp/src/vite-env.d.ts` に `/// <reference types="vite-plugin-pwa/client" />` を追記（無ければ新規作成）。**`tsconfig.json` の `types` は変更しない**（index.md 制約）
- `webapp/index.html` に `<meta name="theme-color" content="#f8fafc" />` を追加（初期値。動的更新は theme-provider）

### i18n 追加キー（本レイヤー所有・確定文言）

| キー | 文言 |
|---|---|
| `webapp.unreachable.title` | `サーバーに接続できません` |
| `webapp.unreachable.body` | `Obsidianを起動し、Personal OS設定でブラウザUIがONになっているか確認してください。ポート番号が変わっている場合は設定画面の実ポート表示も確認してください。` |
| `webapp.unreachable.retry` | `再試行` |
| `webapp.unauthorized.tokenPlaceholder` | `アクセストークンを貼り付け` |
| `webapp.unauthorized.tokenApply` | `トークンを適用` |

## このレイヤーが依存する下位の契約（呼び出す相手）

- StaticServer（`src/server/`・**無改修**）: `.json`→`application/json` / `.js`→`text/javascript` / `.png`/`.svg`/`.woff2` の既存 MIME マップと、`/api/` 以外の SPA フォールバック。PWA 資産はこの既存挙動だけで配信できることが本設計の前提（index.md 判断根拠）
- `src/i18n/ja.ts`: `MESSAGES` への追記（`ja.ts:172` の webapp 追記区画）。`as const` + `keyof` によりキー追加は型安全

## 実装配置

- `webapp/vite.config.ts` — VitePWA プラグイン追加（既存設定は無変更）
- `webapp/package.json` — devDependency 追加
- `webapp/index.html` — theme-color メタ追加
- `webapp/public/` — favicon.svg 更新・pwa-*.png 3 点追加（`npx @vite-pwa/assets-generator` 等の使い捨て実行で生成し**静的コミット**。ビルドパイプラインに組み込まない）
- `webapp/src/vite-env.d.ts` — 型参照
- `webapp/src/main.tsx` — `registerSW()`・Root の三項分岐拡張（`unreachable ? <ServerUnreachableScreen /> : unauthorized ? <UnauthorizedScreen /> : <App />`）・`setServerUnreachableHandler` 登録
- `webapp/src/api/client.ts` — `setServerUnreachableHandler` 新設・`request()` の fetch を try/catch（**import 文ゼロを維持**）
- `webapp/src/components/ServerUnreachableScreen.tsx` — 新設
- `webapp/src/components/UnauthorizedScreen.tsx` — トークン入力欄+適用ボタン追加
- `webapp/src/components/theme-provider.tsx` — `applyTheme()` に theme-color メタ書き換え追加
- `src/i18n/ja.ts` — 上記 5 キー追記
- `tests/webapp/client.test.ts` — 新設（下記テストケース）
- `README.md` / `requirements-browser-ui.md` / `design-pwa.md` — AC-10 の文書更新

## UI/UX 方針

- **画面フロー / 導線**: 通常時は従来どおり。到達不可時は全画面 ServerUnreachableScreen（`unauthorized` より優先。到達不可は 401 判定より前段の障害のため）。401 時は UnauthorizedScreen に「設定画面から開き直す」案内（既存）+「トークンを直接貼り付けて復帰」（新設）の 2 経路
- **主要操作とフィードバック**:
  - 再試行ボタン → `window.location.reload()`（SW がシェルを precache 済みのためオフラインでも安全。復帰時は全キャッシュ再取得を兼ねる）
  - トークン適用 → `setToken(入力値.trim())` → `window.location.reload()`。空入力時はボタン disabled
- **状態設計（出し分け）**: 初期=従来どおり / ローディング=従来どおり（変更なし）/ 到達不可=ServerUnreachableScreen / 401=UnauthorizedScreen（入力欄付き）/ SSE 一時切断=既存 ConnectionBanner（責務分担: バナー=表示済みデータありの一時切断、全画面=初期データ取得不能。全画面はシェルごと置換するため構造上優先される）
- **既存デザインシステムとの整合**: UnauthorizedScreen の既存レイアウト（`flex min-h-screen ... text-center` + h1/p）を ServerUnreachableScreen でも踏襲。入力欄=既存 `Input`、ボタン=既存 `Button`（variant="default"=primary 青）。新規 UI プリミティブは作らない（Rule of Three 非該当）

### レスポンシブ / アクセシビリティ

- 対象端末: デスクトップブラウザ+インストール済み PWA ウィンドウのみ（サーバーが `127.0.0.1` バインドのためモバイル実機は対象外）。主対象ブレークポイントは既存 webapp と同じ（デスクトップ基準・全画面案内は中央寄せ 1 カラムで幅非依存）
- タブレット/スマホ方針: N/A（上記理由で到達不能。既存 webapp の方針を変えない）
- a11y: 既存 WCAG 2.1 AA 対応を踏襲。全画面案内は `<h1>` 見出し+本文の文書構造、再試行/適用は `<button>`（既存 Button=フォーカスリング付き）、トークン入力は `<Input>` に `aria-label`（placeholder のみに依存しない）。theme-color メタは視覚装飾でありコントラスト要件に影響しない

## 異常系挙動

| シナリオ | 本レイヤーの挙動 |
|---|---|
| fetch が TypeError（接続拒否・オフライン） | `request()` が unreachable ハンドラ発火 → Root が ServerUnreachableScreen 表示。throw する ApiError は `status=0`（呼び出し元の react-query は通常どおり error 化。トースト等の二重通知はしない） |
| fetch が TypeError 以外の例外 | 従来どおり伝播（握りつぶさない） |
| 401 | 既存挙動維持: `clearToken()` + unauthorized ハンドラ + `ApiError(401)`。画面に入力欄が加わるのみ |
| トークン入力が空/空白のみ | 適用ボタン disabled（誤リロード防止） |
| SW 更新失敗（旧ビルド配信の過渡状態） | ブラウザ標準のフェイルセーフで既存 SW 維持。アプリ側の対応コードなし |
| dev サーバー（`npm run webapp:dev`） | SW 未登録（vite-plugin-pwa の devOptions 無効デフォルト）。挙動変化なし |

## テストケース（技法注記付き）

`tests/webapp/client.test.ts`（新設・root Vitest / node 環境。`globalThis.fetch`/`globalThis.localStorage` をテスト内スタブ。`client.ts` は import 文ゼロのため相対 import 可）:

- [代表値] fetch が `TypeError` を throw → unreachable ハンドラが 1 回発火し、`ApiError` が throw され `status === 0`
- [同値分割] fetch が `TypeError` 以外（`Error`）を throw → unreachable ハンドラは発火せず、その例外がそのまま伝播
- [同値分割] 200 + JSON ボディ → パース結果を返し、ハンドラ類は発火しない
- [同値分割] 401 → `localStorage` からトークンが消え、unauthorized ハンドラが発火し、`ApiError(401)` が throw される（既存挙動の回帰固定）
- [同値分割] 500 + `{error, code}` ボディ → `ApiError` の `message`/`code` にボディ値が入る
- [境界値] 204 → `undefined` を返す
- [同値分割] トークン保存済み → リクエストヘッダに `Authorization: Bearer <token>` が付く / 未保存 → 付かない

ビルド検査（AC-1/AC-3・Stage 5 で実行し証跡を残す）:

- [代表値] `npm run webapp:build` 後、`webapp/dist/` に `manifest.json`・`sw.js`・`pwa-192.png`・`pwa-512.png`・`pwa-maskable-512.png` が存在し、`dist/index.html` に `rel="manifest"` と `name="theme-color"` が含まれる
- [代表値] `sw.js` 内の precache manifest に `/api/` 起点の URL が含まれず、`navigateFallbackDenylist` 相当の除外（`api`）が生成コードに反映されている

手動確認（Gate 3 提示のチェックリスト・design-pwa.md §8 の 10 項目を使用）: インストール（AC-2）/ オフライン起動と復帰（AC-4）/ トークン手動入力（AC-5）/ テーマ切替とメタ値（AC-7）/ SSE 同期不変（AC-9）
