# Obsidian Personal OS Plugin ブラウザUI PWA化 調査+設計書 v1.1

- 版数: v1.1(v1.0: 2026-07-08 調査+設計 → v1.1: 同日、実装spec `docs/spec/POS-2-pwa/` 確定に伴う改訂)
- 作成日: 2026-07-08
- 位置づけ: `requirements-browser-ui.md` §1.3 でスコープ外(将来拡張)とされた「オフライン動作・PWA化」の実現可否調査と設計
- 前提: 第4次機能追加(ブラウザUI、`design-browser-ui.md` v1.0)の実装が完了していること
- 実装の正本: `docs/spec/POS-2-pwa/`(チケット POS-2)
- v1.1 の変更点: ①manifestを `manifest.json` 名で生成し**サーバー側変更(§5)を不要化**(`.json` は既存MIMEマップで配信可能なため。vite-plugin-pwaの `manifestFilename` 指定) ②アイコン配色の要判断(§7.3)は「青 `#2563eb` に刷新+favicon.svgも更新」で確定(Gate 1・2026-07-08) ③テスト方針(§8)のTDD対象をStaticServerから `webapp/src/api/client.ts`(unreachableハンドラ)に変更

---

## 1. 調査結果: 実現可否

**結論: 実現可能。** ブラウザUIの現行構成(`http://127.0.0.1:{port}` からの静的配信)は、PWAの技術要件をほぼそのまま満たす。以下、要件ごとの検証結果。

### 1.1 セキュアコンテキスト要件(最大の懸念だった点)

PWAのService Worker登録・インストールにはHTTPSが必須だが、**ループバックアドレスは例外としてセキュアコンテキスト扱いになる**(W3C Secure Contexts仕様の「potentially trustworthy origin」)。

> For a PWA to be installable it must be served using the `https` protocol, **or from a local development environment using `localhost` or `127.0.0.1` — with or without a port number.**(MDN "Making PWAs installable")

つまり現行の `http://127.0.0.1:27141` のままで、TLS化なしにService Worker・manifest・インストールがすべて動く。サーバー側にHTTPS対応を足す必要はない。

### 1.2 インストール要件(ブラウザ別)

| ブラウザ | インストール手段 | 要件 | 検証結果 |
|---|---|---|---|
| Chrome / Edge (デスクトップ) | アドレスバーのインストールアイコン | manifest(`name`+`icons` 192/512px+`start_url`+`display`)。**Service Workerは現在は必須ではない**(MDN明記。かつての「fetchハンドラ付きSW必須」は撤廃済み) | 満たせる。manifest追加のみでインストール可能になる |
| Safari 17+ (macOS Sonoma+) | ファイル > Dockに追加 | manifest不要(任意のサイトを追加可能)。manifestがあれば表示名・アイコン・display等がカスタマイズされる | 満たせる。ただしストレージ分離の注意あり(§7.2) |
| Firefox (デスクトップ) | ネイティブのPWAインストール非対応 | — | 対象外(タブ利用は従来通り可能) |

- オフライン動作(アプリシェルのキャッシュ)にはService Workerが引き続き必要。インストール可能化とオフライン動作は独立した要件であり、本設計では両方実装する(§4)。

### 1.3 現行構成との適合性

| 確認項目 | 現状 | PWA適合性 |
|---|---|---|
| 配信オリジン | `http://127.0.0.1:{port}`(`HttpServer.ts` が `127.0.0.1` 固定bind) | ○ セキュアコンテキスト(§1.1) |
| 静的配信 | `StaticServer.ts` がwebapp-dist/を配信。`.js`/`.json`/`.png`/`.svg` のMIMEは定義済み | ○ manifestを `manifest.json` 名で生成すれば既存 `.json` マップで配信できる(v1.1で確定。`.webmanifest` 名+MIME追加案は§5の通り撤回) |
| SPAフォールバック | 未知パスは `index.html` を200で返す | ○ `navigateFallback` と両立。副作用なし(§5.2) |
| トークン認証 | `localStorage`(オリジン固有)+ Bearerヘッダ。静的アセットは認証不要 | ○ インストール済みPWAはブラウザと同一オリジンストレージを共有(Chrome/Edge)。manifest/sw.jsの無認証配信も既存方針のまま |
| SSE(`/api/events`) | `EventSource` +クエリ文字列トークン | ○ Service Workerのprecache対象外パスは素通しされ干渉しない(§4.3) |
| アイコン | `favicon.svg` のみ | ✗ PNG 192/512px(+maskable)の新規作成が必要(§3.2) |
| ビルド | Vite 5(`vite: ^5.4.21`) | ○ `vite-plugin-pwa` 最新(1.3.0)はVite 3〜8対応(peerDependencies確認済み) |

### 1.4 この構成に固有の制約(要件上の割り切り)

1. **データはObsidian起動中しか取れない**(要件§1.2「Obsidian起動中のみ利用可能」は不変)。PWA化で得られるオフライン性は「**アプリシェルが起動し、案内画面が出る**」まで。Vaultデータのオフライン閲覧・書き込みキューはスコープ外とする(§2.2)
2. **PWAのオリジンはポート込みで固定される。** 現行のポート自動繰り上げ(EADDRINUSE→+1、最大20回)が発動するとインストール済みPWAから見たサーバーが消える(リスクと緩和は§7.1)
3. Safari「Dockに追加」はlocalStorageを引き継がない(ストレージ分離)ため、トークンの再受け渡し手段が要る(§7.2、§6.2で解決)

---

## 2. 設計方針

### 2.1 スコープ

本設計で実現するのは次の3点。

1. **インストール可能化**: Chrome/Edgeのインストールアイコン・Safariの「Dockに追加」で、独立ウィンドウのアプリとして起動できる(manifest追加)
2. **アプリシェルのオフライン起動**: サーバー未起動(=Obsidian未起動)でもPWAが白画面ではなく起動し、状況を案内する(Service Worker+案内画面)
3. **未接続時UXの整備**: 「サーバーに接続できません」全画面案内+再試行、トークン手動入力による復帰経路

### 2.2 スコープ外(明示)

- **Vaultデータのオフライン閲覧**: APIレスポンスのSWキャッシュは行わない。古いVaultデータを「現在の状態」として見せる事故(特にTodoの完了状態)の方が、閲覧できないことより害が大きい。TanStack Queryのインメモリキャッシュ(タブ生存中)で十分とする
- **オフライン書き込みキュー**: 単一書き込み経路(既存Services経由)の原則に反する複雑さを持ち込むため不採用。オフライン時の操作はエラートーストで即時失敗させる(現行挙動のまま)
- **プッシュ通知・バックグラウンド同期**: 要件が存在しない
- **モバイル対応**: サーバーが`127.0.0.1`バインドである以上、同一マシンのブラウザからしか届かない。LAN公開(要件§1.3の別項目)が実現しない限りモバイルPWAは物理的に不可能であり、本設計では扱わない

### 2.3 実装手段: vite-plugin-pwa(generateSWモード)を採用

| 判断軸 | vite-plugin-pwa | Service Worker手書き |
|---|---|---|
| ハッシュ付きアセットのprecacheリスト生成 | ビルド時に自動生成(Viteの出力と常に同期) | 自前のビルドステップが必要。ハッシュ更新の追従漏れ=「更新したのに古いUIが出る」バグの温床 |
| 依存追加 | devDependency 1つ(+workbox系peer、いずれもビルド時のみ。実行時依存・main.jsへの影響ゼロ) | ゼロ |
| 更新戦略・フォールバック | `registerType`/`navigateFallback` 等の宣言的設定で完結 | skipWaiting/clientsClaim/キャッシュ世代管理を自前実装 |

**決定: vite-plugin-pwa。** 「依存追加は最小限に」の既存思想とは天秤になるが、SWのキャッシュ世代管理は自前実装だと事故りやすい代表格であり、ビルド時専用devDependencyのコスト(モバイルバンドル・プラグイン審査への影響なし)に対してリターンが大きい。manifest生成も同プラグインに寄せて設定を1箇所(`vite.config.ts`)に集約する。

---

## 3. Web App Manifest設計

### 3.1 manifest内容(`vite.config.ts` の `manifest` オプションで宣言)

> v1.1: ファイル名は標準の `manifest.webmanifest` ではなく **`manifest.json`**(`manifestFilename: "manifest.json"`)とする。`.json` はStaticServerの既存MIMEマップ(`application/json`)で配信でき、ブラウザはmanifestのMIMEを厳格要求しない(manifest.jsonはCRA等で広く実績のある慣行)。これにより`src/server/`(セキュリティ境界・Tier 1トリガー)を無改修にできる。

```jsonc
{
  "name": "Personal OS",
  "short_name": "Personal OS",
  "description": "Obsidian Personal OS ブラウザUI",
  "lang": "ja",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "theme_color": "#f8fafc",       // light --bg(index.cssのデザイントークンと一致させる)
  "background_color": "#f8fafc",  // 起動スプラッシュの地色
  "icons": [
    { "src": "/pwa-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/pwa-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/pwa-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- `start_url: "/"` にトークンは含めない(manifestは静的ファイルであり秘密を置けない)。初回にブラウザで `?token=` 付きURLを開いた時点で `localStorage` に保存済みのため、インストール後の起動はトークンなしURLで問題ない(Chrome/Edge。Safariの例外は§7.2)
- `display: standalone`: 独立ウィンドウ。ブラウザUIはアプリとして常時開いておく用途が主のため
- ダークテーマ時のウィンドウ枠色: manifest の `theme_color` は1色しか持てないため、`ThemeProvider` がテーマ切替時に `<meta name="theme-color">` を `--bg` の実値(`#f8fafc` / `#000000`)へ書き換える(Chromeのstandaloneウィンドウは動的変更を反映する)。数行の追加で済むP2の磨き込み項目とする

### 3.2 アイコン

- `webapp/public/` に `pwa-192.png` / `pwa-512.png` / `pwa-maskable-512.png` を**静的ファイルとしてコミット**する。生成は `npx @vite-pwa/assets-generator` 等の使い捨て実行で行い、ビルドパイプラインには組み込まない(アイコンは頻繁に変わらず、ビルド毎生成は複雑さに見合わない)
- 図柄は既存 `favicon.svg`(角丸四角+白三角)を踏襲し、**地色を青 `#2563eb` に刷新**する(v1.1確定。`favicon.svg` 自体も同時に青へ更新)。maskable版は全面ベタ塗り(角丸・透過なし)+セーフゾーン(中央80%)に三角を収めた版を作る
- ~~要判断(フィードバック事項§7.3)~~ → **解決済み(v1.1)**: Gate 1(2026-07-08)で「青に刷新」を人間が確定。第5次のプライマリ青統一とブランド整合

---

## 4. Service Worker設計

### 4.1 vite-plugin-pwa設定(`webapp/vite.config.ts` への追加)

```typescript
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: { /* §3.1 */ },
      workbox: {
        // アプリシェル一式をprecache(JS/CSS/HTML/アイコン/Geistフォント)
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // オフライン時・未知パスへのナビゲーションはSPAシェルへ
        navigateFallback: "index.html",
        // /api/ 配下はナビゲーションフォールバック対象外(JSONやSSEにindex.htmlを返さない)
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  // 既存設定は無変更
});
```

### 4.2 更新戦略: `registerType: "autoUpdate"`

- プラグイン更新でwebapp-distが差し替わる → 次回PWA起動時(またはナビゲーション時)にブラウザがsw.jsの更新を検出 → 新SWが `skipWaiting`+`clientsClaim` で即時有効化され、開いているページは自動リロードで新版になる
- 「更新があります」プロンプトUI(`prompt`モード)は作らない。ローカル配信で更新は常に自分のプラグイン更新由来であり、確認する意味がない(KISS)
- sw.jsの更新チェックはブラウザ標準仕様によりHTTPキャッシュをバイパスするため、`StaticServer` がキャッシュヘッダを一切送らない現状のままで陳腐化しない

### 4.3 キャッシュ戦略(何をキャッシュし、何をしないか)

| 対象 | 戦略 | 理由 |
|---|---|---|
| アプリシェル(JS/CSS/index.html/フォント/アイコン) | **precache**(ビルドハッシュで世代管理) | オフライン起動の本体。Geistフォント5ファイル+バンドルで合計~1MB台、ローカル配信なので初回コストも実質ゼロ |
| `/api/*`(REST・SSE) | **キャッシュしない(素通し)** | §2.2の通り。generateSWはprecache対象外のリクエストに `respondWith` しないため、`runtimeCaching` を設定しない限りfetch・EventSourceは無改変でネットワークへ抜ける。SSEの自動再接続(EventSource標準)も従来通り動く |
| `?token=` 付き初回URL | ナビゲーションはfallback処理のみでURL自体は保存されない | precacheへのトークン混入なし(§6.3) |

### 4.4 登録(`webapp/src/main.tsx` への追加)

```typescript
import { registerSW } from "virtual:pwa-register";

registerSW(); // consumeTokenFromUrl()の後、render前に1行。dev(vite dev server)では自動的にno-op
```

- `webapp/tsconfig.json` の `compilerOptions.types` に `"vite-plugin-pwa/client"` を追加(virtual module用の型)
- `npm run webapp:dev`(Vite devサーバー)ではSWを登録しない(`devOptions` はデフォルト無効のまま)。開発フローへの影響なし

---

## 5. サーバー側変更(プラグイン本体)

### 5.1 変更なし(v1.1で確定)

v1.0では `StaticServer.ts` のMIMEテーブルへ `.webmanifest: application/manifest+json` を1行追加する計画だったが、**manifestを `manifest.json` 名で生成する(§3.1)ことでサーバー側変更を完全に不要化した**。`src/server/` はTier 1トリガー(`server-auth`・セキュリティ境界)の保護対象であり、触れない実装代替がある以上そちらを採る。

- manifest.json(`.json` → `application/json`)・sw.js(`.js` → `text/javascript`)・PNGアイコン(`.png`)はすべて既存エントリで正しく配信される
- manifest・sw.jsは静的アセット無認証配信の既存方針(design-browser-ui.md §3.4実装判断)のままでよい。いずれも秘密情報を含まない(§6.3)
- `StaticServer.ts` / `HttpServer.ts` / `AuthGuard.ts` / API群は**一切変更しない**

### 5.2 SPAフォールバックとの相互作用(確認結果、変更不要)

- `navigateFallbackDenylist` により `/api/` へのナビゲーションフォールバックは発生しない
- 古いwebapp-dist(PWA導入前ビルド)に対して `/manifest.webmanifest` を要求した場合、既存のフォールバックで `index.html` が200で返る。Chromeはmanifest MIME不一致として無視するだけで実害なし(ビルド世代が揃えば解消する過渡状態)
- sw.jsの更新チェックで万一 `index.html` が返った場合(同上の過渡状態)、MIME不一致で更新が失敗し**既存SWが残る**(仕様上のフェイルセーフ)。致命的な状態に陥る経路はない

---

## 6. UX設計(webapp側)

### 6.1 ServerUnreachableScreen(新設)

オフラインシェルが起動しても案内がなければ「壊れた白画面」に見える。PWA化の体験の要はこの画面。

- **検知**: `api/client.ts` の `request()` で `fetch` が `TypeError`(接続不可)をthrowした場合に、`setUnauthorizedHandler` と同じパターンの `setServerUnreachableHandler` を呼ぶ(グローバルハンドラ方式。`UnauthorizedScreen` の実装パターンを踏襲し、`main.tsx` の `Root` でstate管理)
- **表示**: 全画面案内。文言は「サーバーに接続できません。Obsidianを起動し、Personal OS設定でブラウザUIがONになっているか確認してください。ポート番号が変わっている場合は設定画面の実ポート表示を確認してください」+ **再試行ボタン**(`window.location.reload()`。SWがシェルを返すためオフラインでもリロードは安全)
- **SSE切断バナー(`ConnectionBanner`)との棲み分け**: バナーは「表示済みデータがある状態での一時切断」(既存のまま)。本画面は「データ取得自体が不能」。両方発火した場合は全画面が優先される(バナーはシェル内要素のため自然にそうなる)
- 文言は既存方針通り `src/i18n/ja.ts` に追記(`webapp.unreachable.*`)

### 6.2 UnauthorizedScreenへのトークン手動入力欄追加

- 現状の「設定画面から再度開いてください」案内に加え、**トークン文字列を直接貼り付ける入力欄+適用ボタン**を追加する(`setToken()` → リロード)
- 解決するケース: ①Safari「Dockに追加」のストレージ分離でlocalStorageが引き継がれない(§7.2) ②トークン再生成後のインストール済みPWA(URLバーがなく `?token=` 付きURLを開き直せない)
- トークンのコピー元: 既存SettingsTabの「ブラウザで開く」ボタン近傍に「トークンをコピー」ボタンを追加する(プラグイン側の小変更。クリップボードへ`navigator.clipboard.writeText`)

### 6.3 セキュリティ確認(新規リスクの点検)

- **precacheにVaultデータは入らない**: キャッシュ対象はビルド成果物のみ(§4.3)。APIレスポンスをディスクに残さない方針は、共有マシンでのプライバシー面でも現行同等を維持する
- **トークンの扱いは不変**: SWはリクエストヘッダに関与せず、`localStorage` 保存・Bearer付与の既存経路のまま。sw.js・manifestに秘密は含まれない
- **オリジン境界は不変**: `scope: "/"` は同一オリジン(127.0.0.1:ポート)内で閉じる。`127.0.0.1` バインド・AuthGuard・Origin検証はすべて無変更

---

## 7. リスク・フィードバック事項

### 7.1 ポート自動繰り上げとPWAオリジン固定の衝突

インストール済みPWAは `http://127.0.0.1:27141` に固定される。繰り上げ発動時の挙動と緩和:

| 繰り上げ後の27141の状態 | PWAの見え方 | 緩和 |
|---|---|---|
| 空きポート(誰もいない) | 接続不可 → ServerUnreachableScreen(§6.1、ポート確認の案内文言入り) | 画面の案内で気づける |
| 別アプリが占有 | ほぼ確実に404/接続エラー → 同上 | 同上 |
| **別Vaultの Personal OS サーバー** | トークン不一致で401 → UnauthorizedScreen | 手動トークン入力(§6.2)で意図せぬVaultに繋がる前に気づける |

- **設計判断: 自動繰り上げの挙動は変更しない**(既存要件の担保する起動成功性を優先)。デフォルトポート27141は衝突回避のために選定済みで、実発動は稀
- **将来オプション(要件側への提案)**: 「ポートを固定する(繰り上げしない)」トグルの追加。PWA常用者には予測可能性の方が価値が高い。本設計では見送り、必要が実証されてから足す(YAGNI)

### 7.2 Safari「Dockに追加」のストレージ分離

macOS SonomaのSafari web appは**Safari本体とlocalStorageを共有しない**(作成時にcookieのみコピーされる仕様)。トークンがlocalStorage保存のため、Dock追加直後のPWAは必ずUnauthorizedScreenから始まる → §6.2の手動トークン入力が必須の救済経路になる。Chrome/Edgeはプロファイルのオリジンストレージを共有するためこの問題はない。

### 7.3 アイコン配色の要判断(§3.2再掲)

favicon踏襲(緑)か、第5次で統一したプライマリ(青#2563eb)へ刷新か。ブランド判断のため実装前に人間の確定が必要。

### 7.4 「古いUIが出る」問い合わせリスク

SW導入後は「キャッシュのせいで更新が反映されない」という定番の問い合わせ類型が生まれる。`autoUpdate`(§4.2)で通常は次回起動時に解消するが、万一の復旧手順(ブラウザのサイトデータ削除)をREADMEのトラブルシュートに1項追加する。

### 7.5 要件書の更新

`requirements-browser-ui.md` §1.3のスコープ外リストから「オフライン動作・PWA化」を昇格させ、本書§2.1のスコープ(§2.2のスコープ外の割り切り含む)を要件として追記することを推奨(実装PRと同時でよい)。

---

## 8. テスト方針

| 対象 | 手法 | 理由 |
|---|---|---|
| `webapp/src/api/client.ts`(unreachableハンドラ) | Vitest。`tests/webapp/client.test.ts` 新設(RED→GREEN)。v1.1でTDD対象をここに変更(StaticServer変更が不要化したため) | client.tsはimport文ゼロでroot Vitestからテスト可能(codekb既知の制約に適合) |
| SettingsTab「トークンをコピー」 | 既存SettingsTabのテスト方針に追従(手動確認) | UI配線のみでロジックなし(削減理由はspec ui.mdに明記) |
| webapp(manifest/SW/画面) | `npm run webapp:build` + `tsc --noEmit` 通過をゲートとし、コンポーネントテストは書かない(design-browser-ui.md §8の方針踏襲)。SW・インストールの実挙動は下記手動チェックリストで確認 | SWの自動テストは実ブラウザ環境を要し、モック化するとテスト対象が消える |

### 手動チェックリスト(受け入れ基準)

1. Chrome DevTools > Application > Manifest でエラーゼロ、Installabilityに警告なし
2. Chromeのアドレスバーからインストールでき、standaloneウィンドウで起動する
3. インストール済みPWAがトークンなしURL(`/`)で認証済み状態で開く(事前にブラウザで `?token=` 付きURLを開いた後)
4. Obsidianを終了 → PWAを起動 → 白画面ではなくServerUnreachableScreenが表示される
5. Obsidianを起動 → 再試行ボタン → 一覧が表示される
6. SSE: Obsidian側でファイル編集 → PWAに即時反映(SW導入前と同一挙動)
7. webapp再ビルド+プラグインリロード後、PWA再起動で新UIに自動更新される
8. Safari「Dockに追加」→ UnauthorizedScreen → トークン手動入力で復帰できる
9. `npm run test` 既存全件パス(プラグイン本体への影響がSettingsTabボタン+i18n文言のみであることの裏付け)
10. `npm run webapp:dev` が従来通り動く(SW未登録・HMR正常)

---

## 9. 実装フェーズ計画

| Phase | 内容 | 成果物・検証 |
|---|---|---|
| **P1: インストール可能化+オフラインシェル** | `vite-plugin-pwa` 導入(§4.1)、manifest(§3.1・`manifest.json` 名)、アイコン3点作成・コミット(§3.2・青)、`main.tsx` へ `registerSW()`(サーバー側変更なし=§5.1) | チェックリスト1・2・3・6・9・10 |
| **P2: 未接続UX+仕上げ** | ServerUnreachableScreen(§6.1)、UnauthorizedScreenトークン手動入力+SettingsTab「トークンをコピー」(§6.2)、テーマ切替連動の `theme-color` メタ(§3.1)、`ja.ts` 文言追加、READMEトラブルシュート追記(§7.4)、要件書更新(§7.5) | チェックリスト4・5・7・8。全10項目の通し確認 |

P1完了時点で「インストールできるがオフライン時は素のエラー表示」という中間状態になるが、P1/P2は連続実装を想定しており中間リリースはしない。

---

## 付録A. 用語(既存design.md付録A・design-browser-ui.md付録Aへの追加分)

| 用語 | 説明 |
|---|---|
| PWA(Progressive Web App) | Webアプリをmanifest+Service Workerでネイティブアプリ同様にインストール・オフライン起動可能にする標準技術群 |
| Web App Manifest | アプリ名・アイコン・表示モード等を宣言するJSON(`.webmanifest`)。ブラウザのインストール要件の本体 |
| Service Worker | ページとネットワークの間に入るプロキシスクリプト。本設計ではアプリシェルのprecacheのみに使い、APIは素通しする |
| precache | ビルド時に確定した静的アセット一覧をSWインストール時に一括キャッシュする方式。アセットのハッシュで世代管理される |
| maskableアイコン | OS側が任意の形(円など)に切り抜くことを前提に、セーフゾーン内に図柄を収めたアイコン形式 |
| セキュアコンテキスト | HTTPS等「安全に配信された」文脈でのみ強力なAPI(SW等)を許可するWeb標準の概念。`127.0.0.1`/`localhost` は例外的に常にセキュア扱い |
