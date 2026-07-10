# POS-3: infra 詳細設計

> レイヤー規約: Vault I/O は VaultRepository 集約・Dataview アクセスは DataviewAdapter に分離（[architecture.md](../../architecture.md)）。
> 設定（`src/settings/`）とプラグイン起動（`src/main.ts` の設定ロード）もこのファイルで扱う。

## 担保 AC（[index.md](./index.md) の AC からの引用）

- **AC-4**: `- [-] ` で始まる Todo 行が cancelled として索引され（`done: false`）、その行の編集・削除・並び替えが E003 conflict にならず成功する（既存潜在バグの修正）
- **AC-10**: `kanbanColumnNames.ticket` に cancelled の既定ラベルが追加され、cancelled キーを持たない既存 data.json でも読み込み時に補完されて設定タブに列名行が出る

## このレイヤーが公開する契約（外部インターフェース）

| 操作 | 名前 | 入出力・型・制約 | 用途 |
|------|------|-----------------|------|
| 変更 | `DataviewAdapter.toTodo` | `statusChar = 1文字の t.status`（欠落時は `t.completed ? "x" : " "`）、`done = t.completed`。`statusChar === "-"` のとき `done` は必ず false に正規化 | checkbox 生文字の索引化（AC-4 の読み取り側） |
| 変更 | `STask`（dataview-types.ts） | `status?: string` を追加（Dataview の task status 文字） | 型の追随 |
| 変更 | `DEFAULT_SETTINGS.kanbanColumnNames.ticket` | `cancelled: "Cancelled"` を追加（`done` と `archived` の間） | 型エラー解消（`Record<TicketStatus, string>`）+ 列名既定 |
| 追加 | `fillKanbanColumnNames(saved, defaults)`（settings.ts・純粋関数） | saved の project/ticket それぞれについて、defaults にあって saved に無いキーを補完して返す。**既存のカスタム列名は温存** | 既存 data.json（cancelled キー無し）の読み込み時補完（AC-10） |

- `main.ts` の設定ロード（`Object.assign({}, DEFAULT_SETTINGS, await loadData())` 直後）で `fillKanbanColumnNames` を適用する。

### Dataview の `[-]` 表現の一次確認（実装前・RED の一部）

Dataview の STask が `[-]` を `status: "-"` として返すことを test-vault で確認する（静的分析では未検証のため）:
`- [-]確認用todo` を test-vault のチケットに書き、開発者コンソールで `app.plugins.plugins.dataview.api.page("<path>").file.tasks[0].status` を確認。
想定と異なる場合は spec を先に更新して報告する（Gate 2 委任中でも doc 先行更新は不変）。

## このレイヤーが依存する下位の契約（呼び出す相手）

- Dataview plugin API（`page.file.tasks` の STask）。未導入時は既存の capability degradation（todoFeatures=false）に従う（本変更で挙動追加なし）。

## 実装配置

- `src/infra/DataviewAdapter.ts` — toTodo の statusChar 読み取り
- `src/infra/dataview-types.ts` — STask.status 型追加
- `src/settings/settings.ts` — DEFAULT_SETTINGS 追記・fillKanbanColumnNames
- `src/main.ts` — 設定ロード時の補完適用（1行）

## 異常系挙動

| シナリオ | 本レイヤーの挙動 |
|---|---|
| Dataview が status を返さない（旧版 Dataview） | `t.completed` から `"x"` / `" "` を導出（cancelled は認識されないが従来挙動と同一・クラッシュしない） |
| data.json の kanbanColumnNames が欠落/部分的 | fillKanbanColumnNames が既定値で補完（ユーザーのカスタム名は上書きしない） |

## テストケース（技法注記付き）

- [同値分割] toTodo: STask.status `"-"` → statusChar `"-"`・done false / `"x"`+completed → statusChar `"x"`・done true / `" "` → open
- [代表値] toTodo: status 欠落＋completed=true → statusChar `"x"`（フォールバック）
- [代表値] toTodo: status `"-"` かつ completed=true（矛盾入力）→ done false に正規化
- [代表値] fillKanbanColumnNames: ticket に cancelled キー無し → 既定 `"Cancelled"` 補完 / 既存キー `done: "完了"`（カスタム名）→ 温存
- [境界値] fillKanbanColumnNames: saved が空オブジェクト → 全キー補完 / saved が全キー保持 → 変更なし（同値を返す）
