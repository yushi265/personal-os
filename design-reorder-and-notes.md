# Obsidian Personal OS Plugin 手動並び替え・コメント/メモ 設計書 v1.0

- 版数: v1.0
- 作成日: 2026-07-05
- 親文書: 要件定義書 v2.0 / UIファースト操作 v1.0 / ドリルダウンナビゲーション v1.0 / タイムスタンプ付きメモ 設計書 v1.0(design-memo.md)
- 位置づけ: F2(手動並び替え)/ F3(コメント/メモ)のミニ設計書。実装は行わない

---

## 機能A: D&Dによる手動並び替え(Project / Ticket / Todo)

### A-1. 並び順の永続化方式(確定事項)

| 対象 | 決定 |
|---|---|
| Project / Ticket | frontmatterに `order: number` を追加。疎な連番(100, 200, 300…)方式 |
| Todo | 新規プロパティなし。本文中の**行の物理順序そのもの**が並び順 |

**理由**: Entity側はMarkdown First原則(design.md §1.1「ファイル単体で意味が読める」)に従い、並び順もfrontmatterという唯一の構造化レイヤーに載せる。Todoは元々「行の並び=表示順」が自明な構造であり(`TodoService`が既にappend位置のみを管理し、削除undoでも元位置を復元しない設計を容認済み — 研究§8)、新規プロパティを導入するとTodo1行ごとにfrontmatterでもTodo内部データでもない第三の位置情報を持つことになり複雑化するだけである。行移動そのものを並び替えとして扱う。

**疎な連番の挙動**:
- 新規作成エンティティは既存最大値 + 100 を採番(末尾に追加)
- 2件の間に挿入する場合は中間値(例: 100と200の間なら150)
- 中間値が取れない(隣接値の差が1、または同値の重複)場合は該当範囲を**renumber**(触れた範囲のみ100刻みで再採番。全件renumberはしない — 無関係なファイルへの書き込みをMarkdown First原則上避けるため)
- `order` 未設定のエンティティは「末尾」として扱い、複数の未設定エンティティ同士は既存のtitle/priorityソート(現行の`IndexStore.listByType`のフォールバック)で順序を決める

**確認事項**: 疎な連番の刻み幅(100)・renumber範囲(触れた前後のみ)は暫定値。実運用でのドラッグ頻度次第では枯渇が早まる可能性があり、要件確定時にユーザーへ確認したい。

### A-2. `Entity`型・`parseEntity`・関連サービスへの影響

- `src/domain/entity.ts`: `Entity`インターフェースに `order?: number` を追加し、`KNOWN_FRONTMATTER_KEYS`(現行 `type, status, goal, project, priority, progress, start, due, last_reviewed, archived_at, review_cycle, tags, labels, blockers`)に `order` を追加する。追加しないと既存の「未知キーは`extra`に逃がす」仕様(entity.ts:191-196)により`order`が型付けされず`sortEntityRows`等から参照できない
- `parseEntity`: `order`が数値でない/欠落の場合はwarning無しでundefined扱い(既存の他の任意フィールドと同じ緩やかなバリデーション方針を踏襲)
- `EntityFieldService`(研究§14): `EntityFieldKey`ユニオンに `"order"` を追加し、`updateField(path, "order", value)` で書き込み可能にする。ただし高頻度に発火するD&D操作からは専用メソッド `EntityFieldService.reorder(path, newOrder)` を新設し、`updateField`の汎用validate経路(title特別処理など不要な分岐)を通さず軽量パスで`repo.updateFrontmatter`を呼ぶことを推奨する
- ソート適用箇所は現状3箇所に分散しており(研究§6,7,10)、いずれも`order`未対応のため個別に手当てが必要:
  1. `IndexStore.listByType` — 現行はtitle localeCompareのみ。`order`昇順を優先し、両者ともorder未設定ならtitleにフォールバックする比較関数に変更
  2. `manageData.ts` の `sortEntityRows` — 現行`ManageSort.key`は`due|priority|title|progress|status`の5種。新しく`"manual"`を追加(A-3参照)
  3. Kanbanの並び(`kanbanData`相当)— 列内の並びも`order`を使うか要確認(A-3で扱う)

### A-3. ソートとの関係(確定事項)

`ManageSort.key` に **`"manual"`を追加し、これをデフォルト値とする**(現行 `DEFAULT_ENTITY_SORT = { key: "priority", order: "asc" }` を `{ key: "manual" }` に変更)。

**理由**: 「ソートキー未指定時のみ手動順」という設計だと、列ヘッダクリックで一度でも他のソートに切り替えたユーザーが「手動順に戻す」操作方法を持たない(現行UIにはソート解除ボタンがない)。ソートキーの一つとして`"manual"`を明示的な選択肢にすれば、他のキーへ切り替えても列ヘッダ(または新設する「手動」ボタン)をクリックし直すだけで手動順に戻せる。既存の`▲/▼`インジケータ表示は`manual`時のみ非表示にする(方向の概念がないため)。

Kanban列内の並びも同じ`order`値を共有し、列内では`order`昇順固定とする(Kanbanに独自ソートUIは存在しないため、方式選択の必要がない)。

### A-4. D&D UI

**ManageTable行**:
- ドラッグハンドル(⠿)を行頭の専用セル(既存の左端、例えばチェックボックス列の隣)に追加し、**行全体をdraggableにはしない**。理由: `tasks/lessons.md`(研究§12)に記録された教訓「同一要素が競合するクリック意味(編集 vs 開く)を持つ場合、高頻度操作を素のクリックに、低頻度操作を明示的な affordance に割り当てる」に準拠する。ManageRowは既にインライン編集セル(クリック=編集開始)を複数持つため、行全体をドラッグ可能にすると「クリック=編集開始」と「ドラッグ開始」が同じ領域で衝突する。ハンドルを独立セルに分離することで衝突を構造的に排除する
- 実装はKanbanのHTML5 DnDパターン(研究§10: `draggable`, `ondragstart`/`ondragover`/`ondrop`, `dataTransfer.setData("text/plain", path)`)をそのままManageTable行に流用
- ドロップ位置インジケータ: ドラッグオーバー中の行の上端/下端どちらに挿入されるか(マウスY座標が行の上半分/下半分のどちらか)に応じて挿入線(border-top/bottom)を表示。Kanbanの列単位`dragOver`真偽値だけでは行内の挿入位置until表現できないため、この点は新規実装が必要
- **プロジェクト行のGoalセクション跨ぎドロップ**: Manage画面がGoalごとにグルーピングされたセクション構成であることを前提に、ドロップ先セクションのgoalが元と異なる場合は「goal付け替え + そのセクション内での挿入位置に応じたorder設定」を同時に行う。これは既存のF1(Goal変更メニュー)の`EntityFieldService.updateField(path, "goal", newGoal)`と、A-2の`reorder`を1回のドロップ操作内で連続実行する形になる(2回のvault書き込みで良いか、1回のfrontmatter更新にまとめるかは実装フェーズで決める)
- Todo行のD&D: `TodoList.svelte`内でも同様にハンドル付き行として実装。ドロップ確定時は`VaultRepository.processBody`で対象行を元位置から削除し新位置へ挿入する一括操作(`editLine`の単純な内容置換では行の移動を表現できないため、`processBody`で全文再構成する新規メソッドが必要。既存`editLine`の「期待内容と実際が一致しなければ照合失敗」という安全策は、削除元行の内容一致チェックとして流用する)

### A-5. モバイル代替(確定事項)

D&D不可環境(`Platform.isMobile`)では、Kanbanの既存パターン(研究§10: `⋮`メニューに移動先候補を列挙)を踏襲し、**「⋮」メニューに「上へ移動」「下へ移動」を追加**する。

**理由**: Kanbanのモバイル代替が既に「ステータス変更版」として実装済みであり、同じ`Menu` APIで「1つ上/1つ下と`order`を交換」という単純操作を追加するだけで済む。長押しD&D(タッチイベントでのドラッグ)は実装コストが高く(スクロールとの競合、Obsidianモバイル側のジェスチャーとの衝突考慮が必要)、既存のKanbanモバイル対応が既に「D&D自体を諦めてメニュー操作に倒す」判断をしている(研究§10: `draggable={!Platform.isMobile}`)ため、本機能でもその前例に合わせる。

### A-6. ブラウザUI(webapp)側のスコープ(確定事項)

**初版はスコープ外**。webapp側は`order`フィールドを読み取って**表示順にのみ反映**する(既存の`listByType`相当のソート処理にorder比較を追加する程度の最小対応)が、webapp上でのD&D操作自体は実装しない。

**理由**: 研究§11の通りwebappには並び替えUIの前例が皆無であり、React Query + optimistic update + drag libraryの新規導入が必要になる。Obsidian側で確立した並び順をwebappが「壊さず表示する」ことさえ保証できれば、要件上の主目的(Obsidian内での手動整理)は満たせる。webapp側でのD&D実装は別フェーズの追加要件として切り出す。

### A-7. テストケース定義

| # | 対象 | シナリオ |
|---|---|---|
| T-1 | order比較関数 | 両者orderあり→数値昇順。片方のみorderあり→orderありが前。両方なし→title fallback |
| T-2 | 疎な連番採番 | 新規作成時は既存最大+100。中間挿入で差が2以上ある場合は中間値。差が1/0の場合はrenumber |
| T-3 | renumber範囲 | 影響を受けるのは衝突箇所の前後のみで、無関係なエンティティのorderは変化しない |
| T-4 | Todo行移動 | `processBody`による行の削除+再挿入で、対象行の内容が保持されたまま位置のみ変わる。移動対象以外の行は不変 |
| T-5 | manual↔他ソート切替 | `ManageSort.key`を`manual`から他キーへ切替→元のorder値はfrontmatterに残ったまま表示順のみ変わる。`manual`に戻すと元の並びが復元される |
| T-6 | Goal跨ぎドロップ | プロジェクト行を別Goalセクションへドロップ→goalフィールドと新セクション内でのorderが両方更新される |

---

## 機能B: メモ→コメント改名 + シンプルメモ追加

### B-1. 保存形式と互換(確定事項)

| 対象 | 決定 |
|---|---|
| コメント(既存タイムスタンプ付きメモの改名) | ストレージは`## Memo`見出しのまま変更しない。UIラベルのみ「コメント」に変更 |
| メモ(新規シンプルテキスト) | 専用セクション `## Note` に本文をそのまま保存 |

**理由(コメントを`## Memo`のまま据え置く根拠)**: design-memo.md §7フィードバック事項1で「見出しが一度作られたら残る」という前提を明示的に選択しており、既存Vaultには既に`## Memo`見出しを持つノートが本番運用で存在しうる。案(b)の「新規は`## Comments`・読み取りは両見出し対応」は移行期間中は動くが、`parseMemoSection`・`appendMemo`・`updateMemo`・`removeMemo`(研究§3)すべてに「どちらの見出しか」の分岐を恒久的に持ち込むことになり、design-memo.mdが確立した「`appendTodoToSection`と相似形」というシンプルな設計を複雑化させる。Markdown上の見出し文字列(`## Memo`)とUI上の呼称(「コメント」)がズレることは許容する — Obsidianの他プラグイン(例: Tasksプラグインの絵文字記法)でも「見出し/記法」と「UI表示名」が完全一致しないことは珍しくなく、実害はUIラベルの一貫性で吸収できる。

**メモ用に`## Note`を選ぶ理由**: 既存の予約済み見出しは`## Todo`(Todoセクション、`todo.ts`)と`## Memo`(コメント、`memo.ts`)の2つ。新規メモ用に`## Comments`（英語表記のみ変更）ではなく完全に別名`## Note`を選ぶことで、コメント側の見出し文字列に一切触れずに済み、B-1で決めた「`## Memo`は不変」という決定と矛盾しない。`## Note`はTodo/Memoいずれの既存パターン(見出し検出→なければ`[]`または新規作成)ともバッティングしない新規の予約語である。

### B-2. メモ(`## Note`)のドメイン設計

`## Memo`と違い、メモは「1エンティティに1つ」「タイムスタンプなし」「編集の都度上書き」という単純な性質のため、`memo.ts`のブロック走査ロジック(見出し+複数エントリ)を流用する必要はない。

```typescript
// src/domain/note.ts (新設)
const NOTE_SECTION_HEADING = "## Note";

export function parseNote(body: string): string {
  // "## Note" 見出しを検出。なければ ""
  // 見出し直後から次の見出し(#{1,6}\s)または本文末尾までを本文として返す(末尾空行はtrim)
}

export function setNote(body: string, text: string): string {
  // text === "" の場合: "## Note" セクション自体を除去する(空メモを保存し続ける意味がないため、
  //   コメントの「空セクションは残す」方針とは意図的に異ならせる。理由はB-2確認事項参照)
  // text !== "" の場合: セクションが無ければ末尾に新規作成、あれば本文を丸ごと text に置換(追記ではなく上書き)
}
```

**確認事項**: 「メモを全部消したら`## Note`見出しも消す」という非対称な扱い(コメントは空でも見出しを残す)は本設計独自の判断であり、要件書に明記がない。統一性を優先するなら見出しを残す方が既存パターン(design-memo.md §7-1)と一貫するため、要件確定時にどちらを採るかユーザーに確認したい。

### B-3. UI: 詳細画面・Previewの構成(確定事項)

- 配置順: **メモ(テキストエリア)を上、コメント(既存MemoSection改名)を下**。理由: メモは「今のエンティティの現在地」を表す1つの要約であり、コメントは時系列の追記ログである。詳細画面を開いた際に先に要約を目に入れる方が自然というdesign-ui-first.mdの「上から下に読めば状況がわかる」流儀に合う
- 保存方式: **フォーカスアウト(blur)で自動保存**。デバウンス自動保存(タイピング中に都度保存)ではなく、明示保存ボタンでもない。理由: デバウンス方式は「保存済みかどうか」の状態表示が別途必要になり(既存コンポーネントにはそうした状態表示の前例がない)、明示保存ボタンは「1エンティティ1メモ」という軽量な用途に対して操作コストが見合わない。blur保存は`MemoSection.svelte`の`<textarea>`実装(Enter/Shift+Enter制御、研究§4)に近い複雑度で実装でき、Obsidianの他のインライン編集(ManageRowの各種フィールド)とも一貫する
- 編集競合時の扱い: コメントと違い1エンティティ1メモで内容一致チェックの必要がない(常に「今の全文で上書き」)ため、`MemoService`のようなconflict検出は行わない。**単純に最後にblurした内容で上書きする**(外部同時編集は既存の`Todo`インライン編集と同程度のリスクとして許容し、`SelfWriteGuard`によるイベント抑制のみ考慮すればよい)

### B-4. 命名の全面整理(確定事項)

| 対象 | 決定 |
|---|---|
| UIラベル・i18nキー | 全面改名(`memo.*` → `comment.*`、新規`note.*`追加) |
| コンポーネント名 | `MemoSection.svelte` → `CommentSection.svelte` にリネーム(新規`NoteSection.svelte`を追加) |
| サービス名 | `MemoService` → `CommentService` にリネーム |
| 型名(`Memo`) | `Comment`にリネーム(`src/domain/memo.ts` → `comment.ts`、中身の関数群も`parseCommentSection`等に改名) |
| webapp `MemoPanel`/`/api/memos` | **コンポーネント名は`CommentPanel`へ改名するが、APIパスは`/api/memos`のまま維持** |

**理由**: UI・型・サービス名はコード内部の一貫性のためコストをかけてでも全面改名する(中途半端に「表示だけComment、内部はMemoのまま」を続けると新規参加者が混乱する)。一方でAPIパスは「見出し文字列を変えない」というB-1の判断と同じ理由で、外部との契約面(webapp↔プラグイン間のHTTP API)は変更コストに見合うメリットが薄いため据え置く。既存のAPIクライアント実装(研究§11: `webapp/src/api/endpoints.ts`)への影響を避け、リネームは表示名レベルに限定する。

### B-5. IndexStoreのmemoCount(💬バッジ)への影響

- `IndexStore.memoCounts`/`getMemoCount`(研究§6)は**コメント数**のカウントのままでよい(`## Memo`見出し検出ロジックは不変のため)。変数名・メソッド名は`commentCounts`/`getCommentCount`へリネームするが、カウント対象・アルゴリズムに変更はない
- 新規メモ(`## Note`)は**バッジ化しない**。理由: メモは「1つあるかないか」の二値であり、コメント数のような「件数」概念がバッジに乗せる情報として馴染まない。必要であれば別途「📝」等の存在有無アイコンを検討できるが、本設計のスコープでは見送る(要件確定時に必要性を確認)

### B-6. テストケース定義

| # | 対象 | シナリオ |
|---|---|---|
| N-1 | `parseNote` | `## Note`セクションなし→`""`。あり→本文全体(複数行含む)を返す |
| N-2 | `parseNote` | `## Note`の後に別セクション(`## Todo`等)が続く場合、後続セクションの内容を含まない |
| N-3 | `setNote` | 新規作成(セクションなし→text指定)で末尾に正しい見出し+本文が追加される |
| N-4 | `setNote` | 既存本文がある状態でtextを別内容に上書き→追記ではなく全置換になる |
| N-5 | `setNote` | text=""指定時、`## Note`見出し自体が除去される(B-2確認事項の暫定仕様) |
| C-1 | `Comment`型リネーム後の`comment.ts` | design-memo.md §5.1〜5.3の既存テストケースが名前のみ変更してそのまま全件パスする(振る舞いは無変更であることの回帰確認) |
| C-2 | `memoCounts`→`commentCounts`リネーム後 | 💬バッジの表示件数が既存Vaultで変化しない |

---

## 実装フェーズ分割

| Phase | 機能 | 内容 |
|---|---|---|
| **F2-1** | 機能A: Domain + Service | `Entity.order`追加、`EntityFieldService.reorder`新設、`IndexStore`/`manageData`/`kanbanData`の3箇所のソート関数に`order`比較を追加、`processBody`ベースのTodo行移動メソッド追加 |
| **F2-2** | 機能A: UI | ManageTable/TodoListへのドラッグハンドル・D&Dイベント実装、`manual`ソートキー追加、モバイル`⋮`メニューへの上下移動追加、Goal跨ぎドロップの結合実装 |
| **F3-1** | 機能B: リネーム + メモ新設 | `memo.ts`→`comment.ts`、`MemoService`→`CommentService`、`MemoSection.svelte`→`CommentSection.svelte`のリネーム一式(既存テスト移植)。`note.ts`新設+テスト |
| **F3-2** | 機能B: UI組込 | `NoteSection.svelte`新設、3画面(TicketDetailScreen/ProjectDetailScreen/Preview)への配置順変更を伴う組込、webapp `MemoPanel`→`CommentPanel`表示名変更 |

各PhaseはA/B間で依存しないため並行着手可能。F2-1はF2-2に、F3-1はF3-2にそれぞれ依存する。

---

## 要件へのフィードバック事項

1. **`order`の疎な連番刻み幅とrenumber範囲**: 要件書に具体的な数値指定がないため、本設計では暫定的に100刻み・影響範囲最小限のrenumberを採用した(A-1確認事項)。運用開始後の実測でドラッグ頻度が高い場合は刻み幅の見直しが必要になりうる。
2. **メモ(`## Note`)全消去時に見出しを残すか除去するか**: コメント(`## Memo`)は「空でも見出しを残す」という前例があるが、本設計ではメモについて逆の判断(見出しごと除去)を暫定的に採用した(B-2確認事項)。一貫性を優先するなら統一すべきであり、要件確定時に判断を仰ぎたい。
3. **webapp側のD&D実装が完全にスコープ外であること**: 要件定義がwebapp側の並び替え可否に触れていない場合、「Obsidian内でorderを設定したのにwebappでは並び替えられない」という体験差がユーザーに驚きとして映る可能性がある。初版はA-6の通り表示反映のみに留める前提で進めてよいか確認したい。
4. **Goal跨ぎドロップの書き込み回数**: プロジェクト行のGoal跨ぎドロップで goal 更新と order 更新を1回のfrontmatter書き込みにまとめるか2回に分けるかは実装フェーズでの判断とした(A-4)。中間状態でのファイル変更イベント発火回数が`ActivityLog`の記録粒度に影響しうるため、実装時に要確認。
