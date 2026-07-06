# アーキテクチャ概要

Personal OS は Obsidian コミュニティプラグイン。データは全て Vault 内の Markdown ファイル（frontmatter 込み）に保持し、
独自 DB・バイナリ形式は持たない。表示層は 2 種類ある: Obsidian 内 UI（`ui`、Svelte）と、ブラウザから使うスタンドアロン UI
（`webapp`、React。ローカル HTTP サーバー経由でプラグインと通信）。

## 全体像

```
利用者（Obsidian アプリ内 / ブラウザ）
  └─ ui/       Obsidian ItemView + Svelte（Dashboard/Kanban/Preview 等）
  └─ webapp/   ブラウザ React UI（npm workspace）
        │  src/server/（HttpServer・StaticServer・AuthGuard）がトークン認証・Origin 検査を行い webapp からの唯一の入口になる
        │
  └─ services/ EntityService・TodoService・PromoteService・ReviewService・ProgressService 等（Application 層。オーケストレーション）
        │
  └─ domain/   entity・todo・progress・judge・query・date（純粋関数のみ・Obsidian API 非依存・フルユニットテスト可能）
        │
  └─ infra/    VaultRepository・IndexStore・Indexer・SelfWriteGuard・DataviewAdapter・TasksAdapter・EventBus（全 Vault I/O の集約点）
        │
  Obsidian Vault（.md ファイル + frontmatter）/ Tasks・Dataview プラグイン（任意導入・欠落時は Todo 機能が degrade）
```

| レイヤー | 責務 |
|--------|------|
| `ui`（Obsidian 内表示層） | Obsidian `ItemView` + Svelte コンポーネント。Dashboard/Kanban/Preview/Modal |
| `webapp`（ブラウザ表示層） | React SPA。`src/server/` が公開する HTTP API 経由でプラグインの状態を操作・購読（SSE） |
| `services`（Application 層） | domain + infra を orchestrate。Obsidian API を直接触らない |
| `domain`（Domain 層） | 純粋関数のみ。Obsidian API 非依存でモック不要のユニットテストが可能 |
| `infra`（Infrastructure 層） | Vault I/O は `VaultRepository` に集約。Tasks/Dataview アクセスは `TasksAdapter` / `DataviewAdapter` に分離。`SelfWriteGuard`（500ms TTL）が進捗書き戻しの無限ループを防止 |

## 依存方向

```
ui / webapp  →  services  →  domain
                    ↓
                  infra  →  Obsidian Vault
```

- `domain` は Obsidian API に依存しない（infra を逆向きに参照しない）。
- `services` は Obsidian API を直接叩かず、必ず `infra` 経由で Vault にアクセスする。
- `webapp` は `src/server/` の HTTP API（トークン認証・Origin 検査つき）を介してのみプラグイン状態に触れる。ここがセキュリティ境界（Tier 1 トリガー `server-auth`）。
- 全 Vault 書き込みは `VaultRepository`（+ 書き戻しループ防止の `SelfWriteGuard`）に集約する（Tier 1 トリガー `vault-write`）。壊すとユーザーの Markdown データを破損する。
- frontmatter スキーマ（保存データ形式）は `src/domain/entity.ts` が正本（Tier 1 トリガー `entity-schema`）。未知の frontmatter プロパティは `entity.extra` に保持し書き戻し時も温存する。

## モジュール構造

エンティティ階層は `Goal → Project → Ticket → Todo` の 1 本のみで、ドメイン別の Bounded Context 分割は行わない（詳細は `design.md` §2.1, §3 参照）。

## サブツリー / モジュールの入口

サブツリー分割はしていない（単一リポジトリ・単一 `.claude/` ハーネス）。プロジェクト固有の設計判断は次のドキュメントを正本とする。

| ドキュメント | 内容 |
|------------|------|
| `../requirements.md` | 要件定義 |
| `../design.md` | 基本設計（レイヤ構成・データ設計・主要ロジック・UI 設計） |
| `../detail-design.md` | 詳細設計 |
