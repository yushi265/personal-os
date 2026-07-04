# Obsidian Personal OS Plugin タイムスタンプ付きメモ 設計書 v1.0

- 版数: v1.0
- 作成日: 2026-07-04
- 親文書: 要件定義書 v2.0 / UIファースト操作 v1.0 / ドリルダウンナビゲーション v1.0 / **タイムスタンプ付きメモ要件定義書 v1.0**(requirements-memo.md、以下「要件書」)
- 位置づけ: 第3次機能追加の設計書

---

## 1. 設計方針

### 1.1 既存資産との対応

本機能は既存の「## Todoセクション検出・作成」(`domain/todo.ts` の `appendTodoToSection`、design-ui-first.md §4.4)と構造的に相似形である。相違点は次の2点のみ。

1. Todoは1行完結だが、メモは「`### YYYY-MM-DD HH:mm` 見出し + 複数行本文」というブロック単位である
2. Todoの編集・削除は `VaultRepository.editLine()` の**行番号+期待内容照合**で対象を特定するが、メモはIndexStoreに保持されず永続的な行番号を持たないため、**見出し+本文の内容一致**で対象を特定する(§3.2)

新設するのは `domain/memo.ts` / `services/MemoService.ts` / `ui/components/MemoSection.svelte` の3ファイルのみ。`date.ts` に1関数追加する。既存ファイルへの変更は埋め込み3箇所(TicketDetailScreen/ProjectDetailScreen/Preview)の数行追加にとどまる。

### 1.2 IndexStoreに保持しない、という制約が意味すること

要件§4「メモの読み出しはIndexStoreに保持せず、詳細画面表示時に本文をオンデマンド読込する」は、単なる実装方針ではなく後述の**自己書き込みイベント抑制**(§3.3)と直結する重要な制約である。IndexStoreに保持しないため、Todoのように「一度読み込んだ位置情報(line番号)をUI側で持ち回して次の操作に使う」ことができない。編集・削除のたびに「今の本文でその内容が一意に存在するか」を再確認する設計になる(§3.2)。

---

## 2. Domain層(`src/domain/memo.ts` 新設)

Obsidian APIに依存しない純粋関数のみ。`src/domain/todo.ts` の `appendTodoToSection` と同一の走査ロジック(次見出し検出・末尾改行なし対応)を流用する。

```typescript
export interface Memo {
  datetime: string; // "YYYY-MM-DD HH:mm" 固定形式
  text: string;      // 本文(複数行はそのまま、末尾の空行を除去)
}
```

`Memo` は行番号を持たない。位置情報の代わりに `{ datetime, text }` の内容そのものが「今どのメモを指しているか」の識別子になる(要件§2.1「見出し+本文の照合で特定」)。

### 2.1 `parseMemoSection(body): Memo[]`

- `## Memo`(完全一致、`appendTodoToSection` の `TODO_SECTION_HEADING` と同じ規約)を検出。なければ `[]`
- セクション内を先頭から走査し、`/^### \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/` に一致する行を見出しとして検出
- 見出しの直後から、次の見出し行(`### ...` に限らず `#{1,6}\s` 全レベル)またはセクション終端(次の `#{1,6}\s` 見出し or 本文末尾)までを本文として収集し、末尾の空行を trim して1件の `Memo` にする
- `## Memo` 直後〜最初の有効な見出しまでの記述、および見出しパターンに一致しない行(自由文、`### 見出し` だが日時形式でないもの等)は**メモとして解釈せず、戻り値に含めない**(要件§2.2)。これらは読み取り専用の走査であり書き換えないため、そのまま本文に残り続ける(保全)
- 見出し表記ゆれ(`### 2026/07/04 16:30` 等)は非対応。`appendTodoToSection` の `## TODO` 大文字非対応と同じ扱い(§6フィードバック事項)

### 2.2 `appendMemo(body, datetime, text): string`

`appendTodoToSection` と同一の挿入位置ロジック(セクションなければ末尾に新規作成、あれば次見出し直前 or 本文末尾の中の最後の非空行の直後)を、単一行ではなく `["", "### " + datetime, ...text.split("\n")]` のブロック単位で適用する。先頭に空行を1本挟むことで、要件§2.1の出力例(ブロック間が空行区切り)と一致させる。セクション新規作成時は `\n\n## Memo\n\n### {datetime}\n{text}\n` となり、こちらも空行込みで例と一致する。

### 2.3 `updateMemo(body, expected, newText): string | null` / `removeMemo(body, expected): string | null`

```typescript
export function updateMemo(body: string, expected: Memo, newText: string): string | null {
  // parseMemoSectionと同じ走査で各メモの開始行・終了行を控えつつ、
  // datetime === expected.datetime && text === expected.text に一致するブロックを収集
  // 一致件数 !== 1 なら null(0件=既に変更/削除された、複数件=同一分内の重複メモで一意特定不能)
  // 一致1件ならその見出し行はそのまま(datetime維持)、本文行のみ newText.split("\n") に差し替え
}

export function removeMemo(body: string, expected: Memo): string | null {
  // 同じ特定ロジックで対象ブロックを1件に絞り、見出し行+本文行+直前の区切り空行1行を削除
  // 0件/複数件は null
}
```

`updateMemo`/`removeMemo` は内部的に「見出し行番号+本文範囲」を一時的に持つが、これは関数内のローカル変数にとどまり、`Memo` 型やUI層には一切露出しない。呼び出しごとに毎回、渡された `body`(=書き込み直前の最新本文)に対して再特定する。

### 2.4 `nowStamp(): string`(`src/domain/date.ts` に追加)

```typescript
/** タイムスタンプ付きメモ用: "YYYY-MM-DD HH:mm" を端末ローカル時刻で返す(today()の時刻拡張) */
export function nowStamp(): string {
  const d = new Date();
  return `${today()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
```

`today()` は日付部分のみを対象にした既存関数のため、時刻を含む新規メモのタイムスタンプ生成には手を加えず新関数として追加する(既存呼び出し元への影響を避ける)。

---

## 3. Service層(`src/services/MemoService.ts` 新設)

`TodoService` と同じ薄いオーケストレーション層。`VaultRepository` のみに依存し、`IndexStore`/`Indexer` は使わない(要件§4により、reindex対象にする必要がないため)。

```typescript
export type MemoWriteResult = "ok" | "conflict";

export class MemoService {
  constructor(private repo: VaultRepository) {}

  async list(path: string): Promise<Memo[]> {
    const body = await this.repo.readBody(path); // cachedRead(design.md方針を踏襲)
    return parseMemoSection(body);
  }

  async add(path: string, text: string): Promise<void> {
    const datetime = nowStamp();
    await this.repo.processBody(path, (body) => appendMemo(body, datetime, text.trim()));
  }

  async update(path: string, expected: Memo, newText: string): Promise<MemoWriteResult> {
    let result: MemoWriteResult = "ok";
    await this.repo.processBody(path, (body) => {
      const next = updateMemo(body, expected, newText.trim());
      if (next === null) { result = "conflict"; return body; } // 変更なしで返す(vault.processは常にstringを要求)
      return next;
    });
    if (result === "conflict") new Notice(t("memo.conflict"));
    return result;
  }

  async remove(path: string, expected: Memo): Promise<MemoWriteResult> {
    let result: MemoWriteResult = "ok";
    await this.repo.processBody(path, (body) => {
      const next = removeMemo(body, expected);
      if (next === null) { result = "conflict"; return body; }
      return next;
    });
    if (result === "conflict") new Notice(t("memo.conflict"));
    return result;
  }
}
```

### 3.1 conflict処理はTodoService.handleMismatchと何が違うか

`TodoService.handleMismatch`(既存)は line-mismatch 時に `indexer.reindexFile()` を呼んでIndexStoreを最新化する。`MemoService` はメモをIndexStoreに保持しないため、reindexする対象がない。conflict時にできることは「Notice表示」までで、**一覧の再読込はUI側(MemoSection.svelte)の責務**になる(§4.2)。i18nキーは新規 `E007`(既存 `E003`「ノートが更新されています。再読み込みしました。」と役割が同じだが、自動再読込をServiceが保証できない点が異なるため文言を分ける): `"メモの内容が変更されています。一覧を最新の状態に更新しました。"` — Notice表示と同時にMemoSection側で必ず再読込するため、文言としては「更新しました」と言い切ってよい(§4.2で保証)。

### 3.2 なぜ内容一致特定でconflictがoptimisticに検出できるか

`add`/`update`/`remove` はいずれも `VaultRepository.processBody`(`vault.process`、アトミック)のコールバック内で最新の `body` を受け取ってから `updateMemo`/`removeMemo` を実行する。つまり「UIが最後に `list()` した時点の内容」と「実際に書き込む瞬間の最新本文」の差分が、この関数呼び出しの中で自動的に検出される。TodoのeditLineが行番号のズレを検出するのと同じ役割を、メモでは内容一致件数(0/1/複数)が担う。

---

## 4. UI層

### 4.1 `src/ui/components/MemoSection.svelte`(共通部品、新設)

`TodoList.svelte`(design-drilldown-nav.md §3.4で確立した「3箇所で同一の書き込み経路・表示構成を持つセクションは切り出す」方針)と同じ位置づけの共通コンポーネント。

```typescript
let {
  plugin,
  path,
}: {
  plugin: PersonalOSPlugin;
  path: string;
} = $props();

let memos = $state<Memo[]>([]);
let visibleCount = $state(10); // 「もっと見る」用(要件§3.1)
let editingIndex = $state<number | null>(null); // 新しい順配列内のindex。textarea化対象
let newText = $state("");

let loadToken = 0;
async function reload(): Promise<void> {
  const token = ++loadToken;
  const next = await plugin.memoService.list(path);
  if (token !== loadToken) return; // pathが切り替わった後に古い結果が届いた場合は破棄
  memos = next;
}

$effect(() => {
  path; // pathが変わるたびに再読込(画面遷移で埋め込み対象が変わるケース)
  void reload();
});

$effect(() => {
  const ref = plugin.eventBus.onEvent("index-updated", () => void reload()); // 外部編集の反映(要件受け入れ基準9)
  return () => plugin.eventBus.offref(ref);
});

const sorted = $derived([...memos].reverse()); // 新しい順(要件§1.2)

async function submitAdd(): Promise<void> {
  const text = newText.trim();
  if (!text) return;
  await plugin.memoService.add(path, text);
  newText = "";
  await reload(); // 自分の書き込みはindex-updatedが発火しないため明示的に再読込(§4.2)
}

async function submitEdit(memo: Memo, next: string): Promise<void> {
  const result = await plugin.memoService.update(path, memo, next);
  editingIndex = null;
  if (result === "conflict") return; // Notice済み。以降のreloadは共通処理へ
  await reload();
}

function requestRemove(memo: Memo): void {
  new ConfirmModal(plugin.app, {
    message: memoDeleteConfirmMessage(memo.text),
    onConfirm: async () => {
      const result = await plugin.memoService.remove(path, memo);
      await reload(); // ok/conflict いずれの場合も最新化
    },
  }).open();
}
```

- 入力欄はセクション先頭に常設(要件§1.2)。`<textarea>` の `keydown` で Enter=送信・Shift+Enter=改行を制御する(`TodoList.svelte` のフォームは `<input type="text">` + `onsubmit` のみで改行制御が不要だったため流用できず、本コンポーネント独自に実装する新規パターン)
- 表示は `sorted.slice(0, visibleCount)`。`memos.length > visibleCount` の場合のみ「もっと見る」ボタンを表示し `visibleCount += 10`(要件§3.1)
- 編集: `editingIndex` に該当メモのindexをセットして該当行を `<textarea>` 化。Enter確定(`submitEdit`)・Esc/blurで `editingIndex = null` に戻す(入力破棄)
- 削除: `ConfirmModal`(既存、変更不要)経由で確認
- 0件時: 軽い空メッセージ(`t("memo.empty")`)を一覧部分にのみ出し、入力欄は常に表示したまま(要件§3.1)
- `plugin.capability.todoFeatures` を一切参照しない。呼び出し元の `{#if}` 分岐にも含めない(要件§3.3「capability無関係に動作」であり、Todoの`{#if plugin.capability.todoFeatures}`ブロックの**外**に置く)

### 4.2 非同期読込とSvelte状態の組み合わせ方(設計上の要点)

既存の3画面は2つの異なるデータ供給方式を持つ。

| 画面 | 既存の方式 |
|---|---|
| Preview.svelte | `PreviewView`(ItemView)が `active-leaf-change`/`index-updated` を購読し、非同期 `buildData()` の結果を `Writable<PreviewData>` ストアへpushする |
| TicketDetailScreen / ProjectDetailScreen | `Manage.svelte` 配下の通常コンポーネントとして、`plugin.store`(IndexStore、同期API)から `$derived` で直接読む |

メモは要件§4により**どちらの経路にも乗せられない**(IndexStoreを経由しないため`$derived`で読めず、かつ`PreviewData`に混ぜ込むと「PreviewViewだけがメモを先読みし、Ticket/ProjectDetailScreenは別の再読込手段を用意する」という非対称な実装が2通り必要になる)。そこで**`MemoSection.svelte` 自身が `path` propを受け取り、自分の力で非同期読込を完結させる**設計とした。呼び出し側(Preview.svelte / TicketDetailScreen.svelte / ProjectDetailScreen.svelte)は `<MemoSection {plugin} path={entity.path} />` を置くだけでよく、既存の `PreviewData` 型・`ManageScreen` 型のいずれにも変更を加えない。

**もう一つの重要な設計判断**: `SelfWriteGuard`(500ms TTL)は `Indexer.reindexFile` の入口で自己書き込みを検出すると**その場で処理を打ち切り、`index-updated` イベント自体を発火しない**(`src/infra/Indexer.ts` の `reindexFile` 冒頭 `if (this.selfWriteGuard.isSuppressed(file.path)) return;`)。つまり `MemoService.add/update/remove` が `processBody` を呼んだ直後は、**自分の書き込みに対して `index-updated` は飛んでこない**。これに気づかず「書き込み後は `index-updated` を待てば一覧が更新される」設計にすると、自分が追加したメモが画面に反映されないまま500ms間ハングして見える不具合になる。したがって:

- 自分の操作(add/update/remove)の直後は、**戻り値を待って明示的に `reload()` を呼ぶ**
- `index-updated` の購読は**他者(手書き編集・外部ツール・別ウィンドウでの編集)による変更を拾うため専用**と位置づける

この2系統を分けて実装することが、要件§5受け入れ基準2(自分の追加が即座に一覧反映)と基準9(外部編集後の自動最新化)を両方満たすための唯一の方法である。

### 4.3 埋め込み3箇所

| ファイル | 挿入位置 | 変更内容 |
|---|---|---|
| `TicketDetailScreen.svelte` | Todoセクション(`pos-manage-detail-section`)の下 | `<section class="pos-manage-detail-section"><h3>{t("preview.section.memo")}</h3><MemoSection {plugin} path={screen.path} /></section>` を追加。`{#if plugin.capability.todoFeatures}` の**外側**に置く |
| `ProjectDetailScreen.svelte` | 同上(Todoセクションの下) | 同上、`path={screen.path}` |
| `Preview.svelte` | 既存の `<details class="pos-preview-section">{t("preview.section.todos")}...</details>` の直後 | `<details class="pos-preview-section"><summary>{t("preview.section.memo")}</summary><MemoSection {plugin} path={entity.path} /></details>` を追加 |

いずれも `path`/`entity.path` を渡すのみで、既存の `commitXxx` 系関数や `screen`/`$data` の型定義に変更は不要。

---

## 5. テストケース定義(Vitest、`domain/memo.ts` 対象)

### 5.1 `parseMemoSection`

| # | 入力 | 期待 |
|---|---|---|
| P-1 | `## Memo` セクションなし | `[]` |
| P-2 | 見出し1件+単一行本文 | `Memo` 1件、text完全一致 |
| P-3 | 見出し複数件+複数行本文混在 | 件数・各textの複数行が正しく分離される |
| P-4 | `## Memo` 内に形式外の自由文(見出しなしの文章)が先頭にある | その部分は無視され、以降の有効な見出しのみ `Memo` 化される |
| P-5 | 見出しは日時形式だが直後に別の `##`/`###` 見出し(形式外)が続く | 直前メモのtextはその見出し直前までで打ち切られ、形式外見出し自体はメモとして含まれない |
| P-6 | 同一分内に同一見出しが複数回出現(重複) | 別々の `Memo` として両方とも配列に含まれる(要件§2.1「重複可」) |
| P-7 | セクション末尾、本文最終行に改行なし | 末尾メモのtextが欠落・破損せず取得できる |

### 5.2 `appendMemo`

| # | 入力 | 期待 |
|---|---|---|
| A-1 | `## Memo` セクションなし | 末尾に `\n\n## Memo\n\n### {datetime}\n{text}\n` が追加される |
| A-2 | セクションに既存メモが1件以上ある | 最後の非空行の直後に空行+新規ブロックが追記される |
| A-3 | 複数行の `text` | 全行が改行区切りでそのまま挿入される |
| A-4 | `## Memo` の後に別セクション(`## Todo`等)が続く | 後続セクションの手前に挿入され、後続セクションは変更されない |

### 5.3 `updateMemo` / `removeMemo`

| # | シナリオ | 期待 |
|---|---|---|
| U-1 | 一致するメモが1件のみ | 対象ブロックの本文のみ置換(見出し日時は維持)/削除 され、他のブロックは無変更 |
| U-2 | 一致件数0件(既に外部で変更・削除済み) | `null`(conflict) |
| U-3 | 一致件数2件以上(重複メモの同時編集) | `null`(conflict) |
| U-4 | 削除対象が本文の唯一のメモ(削除後セクションが空になる) | `## Memo` 見出し自体は残す(空セクションとして残置。次回 `appendMemo` がそのまま追記できる状態を維持) |

---

## 6. 実装フェーズ計画

| Phase | 内容 | 成果物・テスト |
|---|---|---|
| **M1: Domain + Service** | `domain/memo.ts`(`parseMemoSection`/`appendMemo`/`updateMemo`/`removeMemo`)、`domain/date.ts` に `nowStamp()` 追加、`services/MemoService.ts`、i18nキー(`memo.*`/`E007`)追加 | Vitest: §5.1〜5.3全件。既存199件のテストが壊れないことを確認 |
| **M2: UI組込** | `ui/components/MemoSection.svelte` 新設、`TicketDetailScreen.svelte`/`ProjectDetailScreen.svelte`/`Preview.svelte` への埋め込み、`main.ts` への `MemoService` インスタンス化・DI配線 | 手動確認: 要件§5受け入れ基準1〜10を1件ずつチェック。test-vault上でTicket/Project/Previewの3箇所からの追加・編集・削除・手書きメモとの共存を確認 |

M1はM2に依存されるが、M1単体でVitestが完結するため、既存の他機能開発と並行して着手できる。

---

## 7. 要件へのフィードバック事項

1. **削除後の空セクションの扱い(§2.1追記推奨)**: 最後の1件を削除した場合に `## Memo` 見出し自体を残すか除去するかが要件書に明記されていなかった。本設計では**見出しを残す**(空セクションとして残置)とした。理由: 除去すると次回追加時に「セクション新規作成」経路(空行込みの体裁)を通ることになり、削除→追加を繰り返した際の本文の空行の入り方が一定しなくなるため、常に「セクションは一度作られたら残る」という`appendTodoToSection`と同じ前提で統一した。
2. **conflict(§4非機能要件「不一致ならNotice+再読込」)の再読込主体**: 要件書はTodoのeditLine方式(Service層がreindexまで行う)を踏襲する書きぶりだったが、メモはIndexStoreを経由しないため、実際に一覧を再読込する主体は**UI層(MemoSection.svelte)**になる(§4.2で詳述)。Service層はNotice表示までを担当する、という役割分担を明記することを推奨する。
3. **`SelfWriteGuard`により自分の書き込み直後は`index-updated`が発火しないこと**: 要件§4「書き込み後の画面反映は既存index-updatedフロー+ローカル再読込」という記述は、実装上は「自分の操作は明示的なローカル再読込のみで反映され、`index-updated`は外部変更専用」という形になる(§4.2)。要件書の当該記述は正しいが、両者の役割分担が曖昧に読めるため、次版で明記することを推奨する。
