# POS-2: ui（Obsidian 内表示層）詳細設計

> `src/settings/SettingsTab.ts` は architecture.md のレイヤー表に明示されないが Obsidian 内表示層の実装のため本ファイルで扱う（[index.md](./index.md) 判断根拠）。

## 担保 AC（[index.md](./index.md) の AC からの引用）

- **AC-6**: SettingsTab のサーバーセクションに「トークンをコピー」ボタンがあり、クリックでトークンがクリップボードへコピーされ完了 Notice が出る。トークン未生成時はコピーせず案内 Notice を出す
- **AC-9**: 既存の全テストが green のまま、`npm run build`（プラグイン＋webapp）と両 typecheck が成功し、SSE 同期・既存画面の挙動が変わらない

## このレイヤーが公開する契約（外部インターフェース）

| 操作 | 名前 / パス | 入出力・型・制約 | 認証・アクセス制御 | 用途 |
|------|------------|-----------------|-------------------|------|
| 追加 | SettingsTab サーバーセクションの Setting 行「トークンをコピー」 | クリック → `tokenStore.get()` をクリップボードへ。トークン空文字なら案内 Notice のみ | デスクトップ限定（既存 `renderServerSection` 内のため自動的に充足） | PWA/Dock 追加アプリでのトークン手動入力（webapp 側 AC-5）の供給元 |
| 追加 | i18n キー（本レイヤー所有・`src/i18n/ja.ts` へ追記） | 下記文言表 | — | ボタン・Notice 文言 |

### i18n 追加キー（本レイヤー所有・確定文言）

| キー | 文言 |
|---|---|
| `settings.server.copyToken` | `トークンをコピー` |
| `settings.server.copyTokenDesc` | `ブラウザUIのアクセストークンをクリップボードにコピーします。PWAなどでトークンを手動入力する時に使います。` |
| `settings.server.copyTokenDone` | `トークンをコピーしました。` |
| `settings.server.copyTokenEmpty` | `トークンが未生成です。ブラウザUIを一度有効にしてください。` |

### 実装形（既存パターンの踏襲・確定値）

`renderServerSection()` 内、「トークンを再生成」Setting（`SettingsTab.ts:222` 付近）の**直後**に追加:

```ts
new Setting(containerEl)
    .setName(t("settings.server.copyToken"))
    .setDesc(t("settings.server.copyTokenDesc"))
    .addButton((btn) =>
        btn.setButtonText(t("settings.server.copyToken")).onClick(async () => {
            const token = this.plugin.tokenStore.get();
            if (!token) {
                new Notice(t("settings.server.copyTokenEmpty"));
                return;
            }
            try {
                await navigator.clipboard.writeText(token);
                new Notice(t("settings.server.copyTokenDone"));
            } catch (e) {
                console.error("Personal OS: clipboard write failed", e);
                new Notice(t("E006"));
            }
        })
    );
```

- クリップボードの try/catch + `E006` フォールバックは `ExportService.ts:125-133` の確立パターンと同一
- サーバー起動状態は**問わない**（トークンは data.json に永続のため、サーバー OFF でもコピー可能にする。起動判定を課す「ブラウザで開く」とは要件が異なる）

## このレイヤーが依存する下位の契約（呼び出す相手）

- `this.plugin.tokenStore.get()`（既存・`SettingsTab.ts:213` で使用実績あり）
- `navigator.clipboard.writeText`（Obsidian/Electron 環境で稼働実績: `ExportService.ts:127`）

## 実装配置

- `src/settings/SettingsTab.ts` — `renderServerSection()` に Setting 1 行追加のみ
- `src/i18n/ja.ts` — 上記 4 キーを `settings.server.*` 帯（`ja.ts:157-170`）へ追記

## UI/UX 方針

- **画面フロー / 導線**: 設定 > Personal OS > ブラウザUI セクション。既存の「トークンを再生成」の直後（トークン関連操作が並ぶ）
- **主要操作とフィードバック**: クリック → 成功 Notice / 未生成 Notice / 失敗 E006 Notice（すべて既存 Notice パターン）
- **状態設計**: Obsidian の Setting 行のため独自状態なし。モバイルではセクションごと非表示（既存挙動）
- **既存デザインシステムとの整合**: `new Setting().setName().setDesc().addButton()` の既存 SettingsTab 慣用句のみ使用。新規部品なし

### レスポンシブ / アクセシビリティ

- Obsidian 設定画面のネイティブレイアウトに従属（独自レスポンシブ実装なし。Obsidian が画面幅対応を担保）
- ボタンは Obsidian 標準 `Setting.addButton`（キーボード操作・フォーカス管理は Obsidian 標準に従う）。文言は i18n キー経由でスクリーンリーダーに読み上げ可能なテキストボタン

## 異常系挙動

| シナリオ | 本レイヤーの挙動 |
|---|---|
| トークン未生成（空文字） | `Notice(t("settings.server.copyTokenEmpty"))`・クリップボードに触れない |
| クリップボード書き込み失敗 | `console.error("Personal OS: clipboard write failed", e)` + `Notice(t("E006"))`（既存の汎用コピー失敗文言） |
| モバイル | サーバーセクション自体が非表示（既存 `Platform.isDesktopApp` ガード・変更なし） |

## テストケース（技法注記付き）

- [代表値] 手動確認のみ: サーバー ON 状態でクリック → クリップボードにトークン文字列・完了 Notice / data.json の `server.token` を空にしてクリック → 案内 Notice・クリップボード不変
- **自動テストを追加しない理由（テスト削減の説明責任）**: SettingsTab には既存テストが 1 件も無く（`tests/` 配下に SettingsTab 関連 0 件・調査済み）、本変更は Obsidian API（`Setting`/`Notice`/`navigator.clipboard`）のグルーコード 1 行で分岐ロジックは空文字判定のみ。モック層を新設するコストがリスク低減に見合わない。判定ロジック（`tokenStore.get()`）と失敗パターン（`E006`）は既存実装・既存パターンの再利用で担保する
