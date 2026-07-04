# Obsidian Personal OS Plugin 要件定義書 v2.0

- 版数: v2.0
- 作成日: 2026-07-04
- 前版: v1.1
- 改版理由: v1.1の矛盾点・未定義事項の解消(改版履歴は末尾参照)

---

## 1. 概要

### 1.1 目的

Obsidianを「人生・仕事・学習・資産・健康」を管理する Personal Operating System(Personal OS)として利用できるプラグインを提供する。

Markdownを唯一のデータソースとし、AI(ChatGPT・Claude等)が理解しやすい構造を採用する。

### 1.2 利用形態

- 当面は開発者個人の利用を前提とする
- 将来的にObsidian Community Pluginとしての公開を視野に入れる
- そのため、コード品質・設定の汎用性・多言語対応の余地は公開を見据えた設計とする(公開対応自体はMVP対象外)

---

## 2. コンセプト

### Markdown First

- すべてのデータはMarkdownで管理する
- 独自DBは持たない
- Gitで管理しやすい構造にする

### AI First

- AIがMarkdownだけで状況を理解できる
- Frontmatterで構造化する
- AI向けコンテキストを生成できる

### Local First

- ローカルファイルを正本とする

### Cross Platform

対応環境:

- Windows / macOS / Linux / iOS / Android

---

## 3. 外部プラグイン依存

本プラグインは以下のコミュニティプラグインに依存する。

| プラグイン | 用途 | 必須/任意 |
|---|---|---|
| Tasks | Todoの記法(絵文字メタデータ)・クエリ基盤 | 必須 |
| Dataview | インラインフィールド(`priority::` 等)の解釈・集計 | 必須 |

### 依存に関する要件

- 起動時に依存プラグインの有効化状態をチェックする
- 未導入・無効の場合、設定画面および通知で導入を促すメッセージを表示する
- 依存プラグインが無効な状態では、Todo関連機能(§12)を機能制限モードとし、エンティティ管理(Goal/Project/Ticket)は動作可能とする

---

## 4. ディレクトリ構成

Root Directoryは設定画面から変更できる。

```
{RootDirectory}/
├── Goals/
├── Projects/
├── Tickets/
├── Reviews/
├── Resources/
├── Templates/
├── Inbox/
└── Archive/
```

- 管理対象はRoot Directory配下のみとする
- v1.1に存在した `Todo.md` および `Daily/` は役割が定義されないため廃止する(Todoは§12の通りTicket/Project/Inbox内で管理する)
- v1.1に存在した `Dashboard.md` は廃止する(Dashboardはプラグイン独自Viewとして提供、§9)

---

## 5. エンティティ

以下を管理する。

- Goal
- Project
- Ticket
- Todo
- Review
- Resource
- Inbox
- Archive

内部ではすべて共通Entityとして扱う。

---

## 6. 階層

```
Goal
    │
    ▼
Project
    │
    ▼
Ticket
    │
    ▼
Todo
```

例:

```
Goal: 家族
└── Project: 住宅購入
    ├── Ticket: 住宅ローン比較
    │   ├── Todo: SBI銀行を調べる
    │   ├── Todo: auじぶん銀行を調べる
    │   └── Todo: 比較表を作る
    └── Ticket: 引っ越し準備
```

---

## 7. データモデル

### 7.1 Goal

人生・仕事・趣味などの継続的な目標・カテゴリ。Projectを複数保持できる。

```yaml
---
type: goal
status: active
priority: high
review_cycle: quarterly
last_reviewed:
tags:
  - life
labels:
---
```

- Goalのstatusは `active` / `paused` / `done` / `archived` の4値とする
- GoalはKanban管理の対象外とする(一覧・プレビューで管理する。§10)

### 7.2 Project

成果を達成するためのプロジェクト。

```yaml
---
type: project
status: active
goal: "[[家族]]"
priority: high
progress: 40
start:
due:
review_cycle: weekly
last_reviewed:
tags:
  - life
labels:
  - important
---
```

### 7.3 Ticket

Projectを構成する成果物・Issue・課題。

```yaml
---
type: ticket
status: doing
project: "[[住宅購入]]"
goal: "[[家族]]"
priority: high
progress: 20
due:
tags:
labels:
---
```

### 7.4 Todo

Markdownチェックボックスで管理する。記法はTasksプラグイン互換とし、インラインフィールドはDataview記法を用いる。

```markdown
- [ ] SBI銀行へ電話する 📅 2026-07-10 [priority:: high]
```

対応メタデータ:

| 項目 | 記法 | 提供元 |
|---|---|---|
| 期限 | `📅 YYYY-MM-DD` | Tasks |
| 開始日 | `🛫 YYYY-MM-DD` | Tasks |
| 完了日 | `✅ YYYY-MM-DD` | Tasks(完了時に自動付与) |
| 優先度 | `[priority:: high]` | Dataview |
| ラベル | `[labels:: urgent]` | Dataview |

Todoの所属先:

- Ticket(ノート本文内)
- Project(ノート本文内)
- Inbox(Inbox内のノート)

所属はTodoが記載されたノートのfrontmatter(`type`)から判定する。

### 7.5 Review

レビュー履歴。`Reviews/` 配下にMarkdownとして保存する。

```yaml
---
type: review
target: "[[住宅購入]]"
cycle: weekly
reviewed_at: 2026-07-04
decision: continue
---
```

### 7.6 Resource

メモ・資料・URL・参考情報。

---

## 8. Frontmatter

### 標準プロパティ

- type / status / goal / project / priority / progress / start / due
- review_cycle / last_reviewed / archived_at / tags / labels

### progress(進捗率)の算出

progressは配下要素の完了率から**自動計算**する。

- Ticket: `完了Todo数 ÷ 全Todo数 × 100`(小数点以下四捨五入)
- Project: 配下Ticketのprogressの平均値。Todoを直接保持する場合はTicket 1件相当として平均に含める
- Todoが0件のTicketは `progress: 0` とする
- 計算結果はfrontmatterの `progress` に書き戻す(Git差分でも進捗が追える状態を維持する)
- ユーザーがfrontmatterを手動編集した場合、次回の再計算時に自動計算値で上書きされる(手動上書きの保持は行わない)

### 任意プロパティ

任意プロパティも追加可能。未知のプロパティは保持する(削除・改変しない)。

```yaml
energy: high
cost: 300000
owner: me
quarter: Q3
```

---

## 9. Dashboard

プラグイン独自UI(Obsidian Viewペイン)として提供する。Markdownファイルへの書き出しは行わない。

### 表示Widget

- Today's Todo
- Active Goals
- Active Projects
- Active Tickets
- Review Needed
- Overdue
- Blocked
- Recent Updates
- Activity Log

Widgetは自由に並び替え・表示/非表示切替ができる。

### 判定ロジック

| Widget | 判定条件 |
|---|---|
| Today's Todo | 未完了かつ `📅` が本日以前のTodo |
| Overdue | 未完了かつ `📅` が本日より前のTodo、または `due` が本日より前で未完了status(§10-11参照)のProject/Ticket |
| Review Needed | `last_reviewed + review_cycle` が本日以前のGoal/Project |
| Blocked | Blocker(§17)が1件以上設定された未完了のProject/Ticket |
| Recent Updates | ファイル更新日時の降順(直近N件、Nは設定可能) |

---

## 10. Goal管理

機能:

- 作成 / 編集 / 削除 / アーカイブ / プレビュー

GoalはKanban管理の対象外とする。status別の一覧表示とプレビューで管理する。

---

## 11. Project管理

機能:

- 作成 / 編集 / 削除 / アーカイブ / Kanban / プレビュー

表示:

- Goal / Ticket / Todo / Progress / Blocker / Review / Properties

### Kanbanとstatusの対応

Kanban列とfrontmatterの `status` 値は1対1で対応し、カード移動時にstatusを自動更新する。

| Kanban列 | status値 |
|---|---|
| Backlog | `backlog` |
| Active | `active` |
| Waiting | `waiting` |
| Review | `review` |
| Done | `done` |
| Archive | `archived` |

`done` `archived` 以外を「未完了status」と定義する(§9の判定で使用)。

---

## 12. Ticket管理

機能:

- 作成 / 編集 / 削除 / アーカイブ / Kanban / プレビュー

表示:

- Project / Todo / Notes / Review / Properties

### Kanbanとstatusの対応

| Kanban列 | status値 |
|---|---|
| Backlog | `backlog` |
| Ready | `ready` |
| Doing | `doing` |
| Waiting | `waiting` |
| Review | `review` |
| Done | `done` |

`done` 以外を「未完了status」と定義する。アーカイブされたTicketは `status: archived` としKanbanに表示しない。

---

## 13. Todo管理

機能:

- 作成 / 編集 / 完了 / 削除 / Quick Add

フィルタ:

- 今日 / 今週 / Overdue / Goal / Project / Ticket / Priority / Tags / Labels

Todoの記法・メタデータは§7.4に準ずる。完了時はTasksプラグインの動作に準じ `✅ YYYY-MM-DD` を付与する。

---

## 14. Inbox

Quick Captureの保存先。

用途:

- 思いつき / 一時Todo / メモ

---

## 15. 昇格

```
Todo → Ticket → Project
```

昇格時の処理:

1. 新規Entity作成
2. テンプレート適用
3. Todo移動
4. Dashboard更新

元Todoの扱いは以下から選択できる:

- 削除
- 完了
- リンク化

---

## 16. Review

周期:

- Daily / Weekly / Monthly / Quarterly / Yearly

内容:

- Progress / Blocker / Next Action
- 判断: Continue / Pause / Complete

`Reviews/` 配下にMarkdownとして保存し、対象Entityの `last_reviewed` を更新する。

---

## 17. Blocker

Project・TicketにBlockerを設定できる。Dashboardで確認できる。

Blockerはfrontmatterの任意プロパティ、または本文内の専用セクションで管理する(実装方式は基本設計で確定する)。

---

## 18. Timeline

開始日(`start`)・期限(`due`)をもとに簡易タイムラインを表示する。

---

## 19. Activity Log

記録対象:

- 作成 / 更新 / Status変更 / Review / Archive / 昇格

Markdownへ保存する。

---

## 20. Archive

Goal・Project・Ticket・TodoをArchiveできる。

- Archive時、対象ノートを `Archive/` へ移動し、frontmatterに `archived_at` を付与、statusを `archived` に更新する

---

## 21. Template

テンプレート:

- Life / Work / Learning / Finance / Health / Travel

ユーザーが追加できる。

---

## 22. AI Export

Markdown形式で生成する。

対象:

- Goals / Projects / Tickets / Todo / Reviews / Blockers

クリップボードコピー対応。

---

## 23. AI Summary

AIへ貼り付けるための要約を生成する。

- MVPではLLM(大規模言語モデル)は使用せず、**ルールベース**でVault内データを集計・整形して要約Markdownを生成する
- 要約に含める内容例: Active Project数と一覧、Overdue件数、Review Needed一覧、直近のActivity
- AI API(Claude等)によるリアルタイム要約生成は将来拡張(§32)とする

---

## 24. Saved Views

保存できる内容:

- フィルタ / ソート / 表示モード

例:

- 今週 / 仕事 / 人生 / レビュー対象

---

## 25. Advanced Search

検索対象:

- 全文 / Goal / Project / Ticket / Todo / Priority / Tags / Labels / Due

クエリ例:

```
type:ticket status:doing priority:high
```

---

## 26. タグ・ラベル

### Tags

Obsidian標準タグを利用する。

```yaml
tags:
  - ai
  - work
```

### Labels

管理用ラベル。

```yaml
labels:
  - urgent
  - blocked
```

機能:

- 追加 / 編集 / 削除 / フィルタ / Dashboard表示 / Saved Views対応

---

## 27. Project Preview

右ペインで表示する。

表示内容:

- Goal / Progress / Ticket / Todo / Notes / Review / Blocker / Properties

---

## 28. コマンド

- Create Goal
- Create Project
- Create Ticket
- Create Todo
- Open Dashboard
- Open Review
- Promote Todo to Ticket
- Promote Ticket to Project
- Archive Entity
- Export AI Context
- Refresh Index

---

## 29. 設定

設定可能項目:

- Root Directory
- Goals Folder / Projects Folder / Tickets Folder / Inbox Folder / Archive Folder / Templates Folder
- Dashboard Widget(表示/非表示・並び順・Recent Updates件数)
- Review Cycle(デフォルト値)
- Kanban Columns(列名のカスタマイズ。status値との対応は維持)
- Default Priority

※ v1.1にあった「Todo保存先」設定は、`Todo.md` 廃止に伴い削除する。

---

## 30. 非機能要件

### パフォーマンス

- MetadataCache利用
- 差分更新
- 大規模Vault対応

### データ

- Markdownのみ / Frontmatter管理 / Gitで差分が分かりやすい / 独自DBを持たない

### AI

- AIが理解しやすいMarkdown / AI Export対応 / Frontmatterを活用

### クロスプラットフォーム

- Windows / macOS / Linux / iOS / Android
- モバイル(iOS/Android)ではデスクトップ専用APIを使用しない

### 保守性(将来公開を見据えて)

- Obsidian Plugin Guidelines準拠を目標とする
- 設定値のハードコード禁止
- UI文言はリソース化し、多言語対応可能な構造とする(MVPは日本語のみで可)

---

## 31. MVP

- Dashboard(独自View)
- Goal管理(Kanban除く)
- Project管理
- Ticket管理
- Todo管理(Tasks/Dataview依存)
- Inbox
- Todo→Ticket昇格
- Ticket→Project昇格
- Review
- Archive
- Activity Log
- Saved Views
- AI Export
- AI Summary(ルールベース)
- タグ・ラベル
- Advanced Search
- Project Preview

---

## 32. 将来拡張

- GitHub Projects同期
- GitHub Issues同期
- Google Calendar同期
- ガントチャート
- Habit Tracker
- 通知
- Graph View連携
- モバイル専用UI
- AI APIとのリアルタイム連携(AI Summaryの自動生成を含む)
- Obsidian Community Pluginとしての公開
- 多言語対応(英語UI)
- progressの手動上書きモード

---

## 33. ワークフロー

```
Quick Capture
      │
      ▼
    Inbox
      │
      ▼
     Todo
      │
      ▼
Promote to Ticket
      │
      ▼
Promote to Project
      │
      ▼
 Link to Goal
      │
      ▼
    Review
      │
      ▼
   Archive
```

---

## 34. 受け入れ基準

- Markdownのみで全データを管理できる
- Frontmatterでプロパティを管理できる
- 任意プロパティを追加でき、未知のプロパティが保持される
- Obsidian標準タグとラベルを利用できる
- Dashboard(独自View)で全体状況を把握できる
- Project・TicketをKanbanで管理でき、カード移動でstatusが更新される
- Goal → Project → Ticket → Todo の階層を管理できる
- progressが配下要素の完了率から自動計算される
- TodoをTicketへ昇格できる
- TicketをProjectへ昇格できる
- プレビュー画面で内容を確認できる
- AIへ渡せるMarkdownを生成できる(AI Export / AI Summary)
- Tasks/Dataviewプラグイン未導入時に導入を促すメッセージが表示される
- Root Directory配下のみを管理対象にできる
- Windows・macOS・Linux・iOS・Androidで同じVaultを利用できる
- Git管理しても差分が分かりやすい

---

## 付録A. v1.1からの主な変更点

| # | 変更内容 | 理由 |
|---|---|---|
| 1 | Todo記法をTasks/Dataviewプラグイン依存と明記(§3, §7.4) | 記法の出自が未定義だったため。依存チェック要件を追加 |
| 2 | progressを自動計算に確定(§8) | 手動/自動が未定義だったため |
| 3 | AI SummaryをMVPではルールベースと明記(§23) | LLM利用の有無が未定義だったため |
| 4 | Dashboardをプラグイン独自Viewに確定、`Dashboard.md` 廃止(§4, §9) | 実体が未定義だったため |
| 5 | `Todo.md` / `Daily/` を廃止(§4) | 役割が本文で未定義のため |
| 6 | GoalをKanban対象外に確定、受け入れ基準を修正(§10, §34) | 9章と33章(旧)の矛盾解消 |
| 7 | Kanban列とstatus値のマッピングを定義(§11, §12) | `status: doing` と列名の不一致解消 |
| 8 | Dashboard Widgetの判定ロジックを定義(§9) | Overdue / Review Needed の条件が未定義だったため |
| 9 | Goal用frontmatter・Review用frontmatterを定義(§7.1, §7.5) | データモデルが未定義だったため |
| 10 | 利用形態(個人利用→将来公開)を明記(§1.2, §30, §32) | 配布形態の確認結果を反映 |
