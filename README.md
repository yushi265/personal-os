# Personal OS

Obsidianを「人生・仕事・学習」を管理する **Personal Operating System** にするコミュニティプラグイン。

すべてのデータはVault内のMarkdownファイル(frontmatter)に保存されます。独自DBなし、ローカル完結、Git管理しやすく、AIがそのまま読める構造です。

> **Status**: 個人利用フェーズ。コミュニティプラグインとしての公開は将来予定。

## コンセプト

- **Markdown First** — 全データは `.md` ファイル。プラグインは読み取り+整形+書き戻しのみ
- **AI First** — frontmatterで構造化。AI Export/Summaryでそのまま文脈をAIに渡せる
- **Local First** — ネットワーク通信なし(ブラウザUIもlocalhost限定・opt-in)
- **Cross Platform** — デスクトップ/モバイル対応(`isDesktopOnly: false`)

## 主な機能

### 階層タスク管理
`Project → Ticket → Todo` の3階層。分類はラベルで。

- **統合管理View** — ドリルダウン型ナビゲーション(一覧→プロジェクト詳細→チケット詳細)、インライン編集、D&D手動並び替え、列ソート、フィルタ+保存ビュー
- **Dashboard** — 今日のTodo・期限超過・レビュー対象などのウィジェット+統計
- **Kanban** — ステータス列へのD&D(モバイルはメニュー操作)
- **Timeline / 検索 / クイックスイッチャー**
- **進捗自動計算** — Todo完了率→チケット→プロジェクトへ自動ロールアップしfrontmatterへ書き戻し
- **昇格** — Todo→Ticket→Project(wikilink維持)
- **コメント&メモ** — チケット/プロジェクトにタイムスタンプ付きコメント(`## Memo`)と自由記述メモ(`## Note`)
- **Undo** — 削除・Archiveは「元に戻す」トースト方式
- **モバイル最適化** — カードレイアウト、タップ=開く/長押し=操作メニュー

### ブラウザUI(デスクトップ・opt-in)
プラグイン内蔵のローカルHTTPサーバー(トークン認証・`127.0.0.1` 限定・デフォルトOFF)経由で、モダンなWeb UI(React + Geistデザイン)から同じデータを操作できます。SSEでObsidianと双方向リアルタイム同期。

**PWA対応**: Chrome/Edgeのアドレスバーのインストールアイコン、またはSafariの「ファイル > Dockに追加」で、独立ウィンドウのアプリとしてインストールできます。Obsidianが起動していない間もアプリ自体は起動し、接続案内を表示します(データの閲覧・操作はObsidian起動中のみ)。Safariの追加アプリ等でトークンを求められた場合は、設定画面の「トークンをコピー」でコピーし、アプリの入力欄へ貼り付けてください。

トラブルシュート: プラグイン更新後に古い画面が表示される場合は、アプリを一度開き直してください(Service Workerが自動更新します)。解消しない場合はブラウザの `127.0.0.1:<ポート>` のサイトデータを削除して再アクセスしてください。

### AI連携
- **AI Export** — 全プロジェクト/チケット/Todoの状況をMarkdownでクリップボードへ
- **AI Summary** — ルールベースのダイジェスト生成

## 必要なプラグイン

Todo機能には以下のコミュニティプラグインが必要です(未導入時はEntity管理のみの機能制限モードで動作):

- [Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) — Todo記法(絵文字メタデータ)
- [Dataview](https://github.com/blacksmithgu/obsidian-dataview) — インラインフィールドの解釈

## データ形式の例

```yaml
---
type: ticket
status: doing
project: "[[住宅購入]]"
priority: high
progress: 50
due: 2026-07-10
labels:
  - 家族
---

## Todo
- [ ] SBI銀行へ電話する 📅 2026-07-10 [priority:: high]

## Memo

### 2026-07-05 10:30
銀行から回答きた。金利は1.2%で確定
```

未知のfrontmatterプロパティは保持されます(削除・改変しません)。

## インストール(手動)

1. `npm install && npm run build`
2. `main.js` / `manifest.json` / `styles.css` / `webapp-dist/` を `{Vault}/.obsidian/plugins/personal-os/` へコピー
3. Obsidianの設定でコミュニティプラグインを有効化 → Personal OS をON

## 開発

```bash
npm install
npm run dev        # esbuild watch
npm run build      # 本番ビルド(webapp含む)
npm run test       # Vitest(400+ unit tests)
npm run typecheck  # tsc + svelte-check
npm run webapp:dev # ブラウザUIの開発サーバー
```

### アーキテクチャ

```
Presentation(Svelte / React) → Services → Domain(純粋関数) → Infrastructure(Vault I/O)
```

- Domain層はObsidian API非依存の純粋TypeScript(モックなしでテスト可能)
- 全ファイルI/Oは `VaultRepository` に集約(`processFrontMatter` / `vault.process` / `renameFile`)
- インメモリインデックス(`IndexStore`)+差分更新で大規模Vault対応
- 設計ドキュメント: `requirements*.md` / `design*.md`(意思決定の履歴込み)

## License

[MIT](LICENSE)

同梱の Geist / Geist Mono フォントは [Vercel](https://vercel.com/font) による [SIL Open Font License 1.1](webapp/public/fonts/geist/LICENSE.txt) です。
