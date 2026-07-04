# Obsidian Personal OS Plugin ブラウザUI 設計書 v1.0

- 版数: v1.0
- 作成日: 2026-07-04
- 対応要件: `requirements-browser-ui.md` v1.0(ユーザー承認済み)
- 位置づけ: 第4次機能追加の設計書
- 実装: 本書はスコープ外(設計のみ)

---

## 1. 設計方針

### 1.1 既存資産との関係

ブラウザUIは要件§1.2で「並行して存在する第2のフロントエンド」と明記されている。Obsidian内Svelte UI(`src/ui/`)は無変更のまま残し、本機能は次の3層を**新設**する。

```
webapp/           … ブラウザSPA(独立ワークスペース、Vite)
src/server/       … プラグイン内蔵サーバー(新設、デスクトップ限定)
src/domain/       … 既存。webappからも直接importして再利用(変更なし)
```

書き込み経路は要件§1.2の通り単一(既存Services経由)を維持する。サーバーはブラウザからのリクエストを**既存のEntityService/TodoService/MemoService等へそのまま委譲する薄い変換層**であり、Vaultへの新しいアクセス経路を作らない。これにより`SelfWriteGuard`・`ProgressService`・`ActivityLogService`など既存の整合性機構は変更なしで機能し続ける。

### 1.2 本書のスコープ

要件§3.1で設計に委ねられた技術スタック選定を含め、次の8点を確定する。

1. フロントエンドスタック(React+shadcn/ui vs Svelte+shadcn-svelte)
2. リポジトリ構成(ワークスペース分割・成果物同梱方式)
3. サーバー設計(構成・認証・ポート・プッシュ方式)
4. API設計(コントラクト・DTO・エラー規約)
5. ブラウザUI設計(ルーティング・状態管理・コンポーネント対応)
6. セキュリティ設計
7. テスト方針
8. 実装フェーズ計画

---

## 2. フロントエンドスタック選定

### 2.1 比較

| 判断軸 | React + shadcn/ui | Svelte 5 + shadcn-svelte |
|---|---|---|
| domain型・集計ロジックの再利用性 | 同等。`src/domain/`はObsidian非依存の純粋TSであり、フレームワークを問わずimport可能 | 同等(上に同じ) |
| shadcnエコシステムの成熟度 | **shadcn/uiが原典**。コンポーネント数・Block(定型レイアウト)数・保守頻度・ドキュメント・LLM学習量(コード生成の外れにくさ)のいずれも最大 | shadcn-svelteはコミュニティ移植版。コンポーネント追従に数週間〜数ヶ月のラグがあり、Block等の一部資産は未移植 |
| 既存コードベースとの保守一貫性 | Obsidian内UIと別スタックになる | Svelteで揃うが、**UIコンポーネント自体はどのみち共有できない**(要件§1.2で並行フロントエンドと確定済み、design-memo.md実績でも共通化対象はdomain層まで)。一貫性のメリットは「開発者が2つ目の構文を覚えずに済む」点に限定される |
| バンドル・ビルド構成 | webappは完全に独立ビルド(Vite)。プラグイン本体(esbuild)のバンドルサイズに一切影響しない | 同上。差はない(Svelteの軽量性はObsidianペイン用UIの制約であり、ローカルサーバー配信のSPAには効かない) |
| 実装速度・情報量 | コンポーネント例・AI生成支援(v0等)・Issue解決事例が桁違いに多い。ドリルダウン画面群(表・ダイアログ・トースト・コマンドパレット)を要件通りに揃える速度が読める | 情報量で劣り、shadcn-svelteの未対応コンポーネントに当たった場合は自作コストが乗る |

### 2.2 決定: **React + shadcn/ui**

**根拠**: 「既存コードベースがSvelteである」ことの一貫性メリットは、要件がブラウザUIを独立した第2フロントエンドと位置づけている時点でほぼ消える(UIコンポーネントの共有はそもそも発生しない)。一方でshadcnエコシステムの成熟度差は実装期間・保守コストに直接効く実質的な差である。要件§1.1「shadcn系デザインシステムでモダンな操作性を作り込みたい」という目的に対し、本家shadcn/uiを使う方が要件の意図に忠実。ドメイン型の再利用性はどちらを選んでも同等なため、決め手にならない。

以降、本書はこの決定を前提に設計する。

---

## 3. リポジトリ構成

### 3.1 ワークスペース化

ルート`package.json`に`workspaces`フィールドを追加し、npmワークスペースとして`webapp/`を追加する(単純なサブディレクトリ+独立`package.json`のみだと、`npm install`のディレクトリ分割・依存重複・CIコマンドが煩雑になるため)。

```jsonc
// package.json(ルート、追加分のみ)
{
  "workspaces": ["webapp"],
  "scripts": {
    // 既存スクリプトは無変更
    "webapp:dev": "npm run dev --workspace webapp",
    "webapp:build": "npm run build --workspace webapp",
    "build": "tsc --noEmit && node esbuild.config.mjs production && npm run webapp:build"
  }
}
```

- ルートパッケージ(プラグイン本体)自体もワークスペースのメンバーとして扱われる。npm workspacesはルートpackage.jsonが自身のコードを持ちながら`workspaces`を宣言することを許容するため、既存の`npm run dev`/`test`/`typecheck`は無変更で動く
- `build`にwebappビルドを連結し、「`npm run build`一発でプラグイン本体+webapp成果物が揃う」を保証する(要件§受け入れ基準9「既存機能への影響ゼロ」の裏付けとして、既存の`build`利用者(CIやユーザーのビルド手順)がコマンドを変えずに済む)

### 3.2 `webapp/`の内部構成

```
webapp/
├── package.json          # 独立パッケージ("private": true、Obsidianには依存しない)
├── vite.config.ts
├── tsconfig.json          # baseUrlをリポジトリルートに向け、"@domain/*" → "../src/domain/*"
├── tailwind.config.ts
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx            # ルーター定義
    ├── api/               # APIクライアント(fetchラッパ + 型)
    ├── hooks/             # TanStack Queryフック(useEntities, useEntity, useTodos...)
    ├── routes/            # 画面(Home/Projects/ProjectDetail/TicketDetail)
    ├── components/        # shadcn生成コンポーネント + 自作(EditableCell等)
    └── lib/                # cn()等shadcn標準ユーティリティ
```

### 3.3 domain型の共有方式

**判断: `shared/`パッケージは新設せず、`webapp`から`src/domain/`を相対パスで直接importする。**

```typescript
// webapp/tsconfig.json
{
  "compilerOptions": {
    "paths": { "@domain/*": ["../src/domain/*"] }
  }
}
```

理由:

- `src/domain/`は既にObsidian API非依存の純粋TypeScript(design.md §1.1「AI First」の帰結として最初から隔離されている)。パッケージ化しなくても素のimportで安全に再利用できる
- 第3パッケージ(shared)を作ると、型変更のたびに3箇所(domain本体・shared再export・webapp利用箇所)を追う必要が生じる。要件の「保守の二重化はUI止まりに抑えたい」(要件§6リスク)という前提に対し、パッケージ分割はドメイン層まで二重化を広げてしまう
- Viteのデフォルトは`root`(webapp/)外のファイル参照を拒否するため、`vite.config.ts`で`server.fs.allow`にリポジトリルートを追加する必要がある(開発サーバー限定の設定。ビルド成果物には影響しない)

将来domain層に手を入れる際は、webapp側が同じ型をそのまま使っているため「型が壊れたらtscが落ちる」形で追従漏れを機械的に検出できる。

### 3.4 成果物の同梱方式

**判断: `webapp/dist`をビルド後にプラグインディレクトリ配下へコピーし、サーバーがファイルシステムから配信する。**`main.js`へバンドルはしない。

```
.obsidian/plugins/personal-os/
├── main.js
├── manifest.json
├── styles.css
└── webapp-dist/        # ← webapp:build成果物をコピー(新設)
    ├── index.html
    ├── assets/*.js
    └── assets/*.css
```

- `esbuild.config.mjs`のprodビルド後に`fs.cpSync("webapp/dist", "webapp-dist", { recursive: true })`を追加する(新規ステップ、既存のesbuildプラグイン設定には触れない)
- `main.js`へインライン同梱(base64埋め込み等)は、JS/CSSアセットが数百KB〜MB単位になり得るため不採用。ファイルシステム配信の方がシンプルで、開発中の差し替え(webapp再ビルド→サーバー再起動不要、静的配信のみ再読込)もしやすい
- サーバー(§4)は`this.app.vault.adapter`から取得できるプラグインディレクトリの絶対パス(`(this.app.vault.adapter as FileSystemAdapter).getBasePath() + "/" + this.manifest.dir`)を起点に`webapp-dist/`を読み、静的配信する

---

## 4. サーバー設計(プラグイン側)

### 4.1 モジュール構成

```
src/server/
├── HttpServer.ts     # ライフサイクル(start/stop)。Platform.isDesktopApp分岐の境界
├── ApiRouter.ts       # (method, path, query, body, deps) → {status, body} の純粋寄り関数
├── AuthGuard.ts       # トークン検証・Origin検証
├── SseHub.ts          # SSE購読者管理 + eventBus購読
├── StaticServer.ts    # webapp-dist/ 配信 + SPAフォールバック
├── TokenStore.ts      # トークン生成・設定への保存
├── dto.ts             # Entity/Todo/Memo → JSON DTO変換(§5.2)
└── types.ts           # ApiDeps等、テスト用の依存インターフェース
```

### 4.2 モバイルビルドで壊れない方式

`node:http`はNode専用APIのため、モバイル(Obsidianアプリ、Node実行環境なし)では読み込み自体が失敗し得る。既存の`esbuild.config.mjs`は`external: [...builtins]`でNode組み込みモジュールをバンドル対象から除外済みのため、コード上は`require("http")`が実行時に初めて解決される形になる。これを前提に:

```typescript
// src/server/HttpServer.ts
import { Platform } from "obsidian";

export class HttpServer {
  private server: import("http").Server | null = null;

  async start(port: number, deps: ApiDeps): Promise<number> {
    if (!Platform.isDesktopApp) return -1; // 呼び出し側でこの分岐は事前にガードされる想定だが二重防御
    const http = require("http") as typeof import("http"); // dynamic require: モバイルバンドルはこの行に到達しない
    // ...
  }
}
```

- `main.ts`側で`this.server = new HttpServer()`のインスタンス化自体はモバイルでも安全(クラス定義のみでNode APIを参照しない)。実際に`http`を`require`するのは`start()`内、かつ`start()`は設定画面のトグルON・`Platform.isDesktopApp`確認後にしか呼ばれない
- 設定画面(SettingsTab)側もサーバー関連の項目を`Platform.isDesktopApp`が`false`の場合はセクションごと非表示にする(要件§2)

### 4.3 起動シーケンス・ポート試行

```
設定でサーバーON
  │
  ▼
TokenStore: 未生成ならトークン生成(crypto.randomUUID()相当、data.json保存)
  │
  ▼
HttpServer.start(settings.server.port)
  │
  ├─ EADDRINUSE → port+1で再試行(最大20回)
  │
  ▼
実際にbindできたポートをSettingsTabに表示 + Notice(URL付き、設定でOFF可)
```

- バインドは`127.0.0.1`固定(要件§2、`0.0.0.0`を渡さない)
- OFF・プラグインunload・Obsidian終了で`server.close()`(`onunload`に登録)

### 4.4 設定スキーマ拡張

```typescript
// settings/settings.ts への追加
interface POSSettings {
  // ...既存フィールドは無変更
  server: {
    enabled: boolean;       // default: false(要件§2「デフォルトOFF」)
    port: number;           // default: 27141(§7.2で理由説明)
    token: string;          // default: ""(初回有効化時に生成)
    notifyOnStart: boolean; // default: true
  };
}
```

- `DEFAULT_SETTINGS`への追加のみ。既存の`Object.assign({}, DEFAULT_SETTINGS, await this.loadData())`(main.ts:119)によりv0のdata.jsonにも後方互換で追記される

### 4.5 SettingsTabの項目(追加分)

| 項目 | 種別 | 挙動 |
|---|---|---|
| ブラウザUIを有効にする | Toggle | ON時`HttpServer.start()`、OFF時`stop()`。`Platform.isDesktopApp`が偽ならセクション自体を非表示 |
| ポート | Text(数値) | 変更時は稼働中なら再起動して反映。実際にバインドできたポート(自動繰り上げ後)を隣に表示 |
| ブラウザで開く | Button | `http://127.0.0.1:{実ポート}/?token={token}`を`window.open`相当(Obsidianの`shell.openExternal`)で開く |
| トークンを再生成 | Button | 確認ダイアログ→新トークン生成・保存・既存接続は次回リクエストから401(強制ログアウト相当) |
| 起動時にURLを通知する | Toggle | Notice表示のON/OFF |

### 4.6 プッシュ方式: WebSocket vs SSE

| 判断軸 | WebSocket | SSE(Server-Sent Events) |
|---|---|---|
| 通信方向 | 双方向 | 単方向(サーバー→クライアント) |
| 要件との適合 | 要件§3.4は「変更通知の受信」のみで、操作は全てREST(要件・本書とも双方向通信は不要) | **要件が必要とする単方向プッシュそのもの** |
| 依存追加 | 素の`http`upgradeを自前実装するとフレーミング・ping/pong・マスキング処理が必要で工数が重い。実用には`ws`パッケージ追加が現実的(esbuildの`external`に追加、Obsidianデスクトップ=Electron環境なのでNode版`ws`がそのまま動く。バンドルサイズはmain.jsには影響しない=`external`指定のためモバイル安全性の検証だけ追加で必要) | **追加依存ゼロ**。`http.ServerResponse`に`Content-Type: text/event-stream`を設定し接続を保持したまま`res.write("data: ...\n\n")`するだけで実現できる |
| 再接続 | 自前実装が必要(要件§3.4「自動再接続」) | ブラウザの`EventSource`が**標準で自動再接続**する(`retry:`ディレクティブで間隔調整も可能)。要件の「切断時バナー+自動再接続」の後半を実装コストゼロで満たす |
| 認証 | ヘッダ設定可(接続時ハンドシェイクにAuthorizationを乗せられる) | `EventSource`はカスタムヘッダを送れない制約があり、**トークンをクエリ文字列で渡す例外的経路が必要**(§6.1で扱う) |

### 4.7 決定: **SSE**

**根拠**: 要件が求めるのは変更通知の一方向プッシュのみであり、双方向性を要さない。追加依存が不要な点(モバイルバンドルへの影響検証が要らない、コミュニティプラグイン審査で外部依存追加の説明責任が増えない)と、自動再接続がブラウザ標準機能でまかなえる点が要件§3.4の実装コストを大きく下げる。認証面の制約(ヘッダ不可)は、SSE専用エンドポイントに限りクエリ文字列トークンを許可する例外ルールで解決する(§6.1)。

```typescript
// src/server/SseHub.ts(骨格)
export class SseHub {
  private clients = new Set<import("http").ServerResponse>();

  constructor(eventBus: POSEventBus) {
    eventBus.onEvent("index-updated", (paths) => this.broadcast("index-updated", paths));
  }

  subscribe(res: import("http").ServerResponse): void {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(": connected\n\n"); // コメント行でコネクション確立を即座に確定させる
    this.clients.add(res);
    res.on("close", () => this.clients.delete(res));
  }

  private broadcast(event: string, payload: unknown): void {
    const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const res of this.clients) res.write(data);
  }
}
```

`index-updated`のペイロード(変更パス配列。design.md §2.3 `eventBus.emit("index-updated", paths)`相当)をそのまま転送する。クライアント側はこのpath配列を見て、該当pathを含むキャッシュのみをinvalidateする(§5.3)。

---

## 5. API設計

### 5.1 エンドポイント一覧

パスセグメントに`/`を含むVaultパスをそのまま埋め込むとURLエンコードが煩雑になるため、**エンティティ・Todo・メモの対象特定は原則クエリパラメータ`path`で行う**(例: `/api/entity?path=PersonalOS/Projects/住宅購入.md`)。

| メソッド | パス | 用途 | 呼ぶService | 備考 |
|---|---|---|---|---|
| GET | `/api/meta` | vault名・capability・設定抜粋 | — (plugin直参照) | 「Obsidianで開く」URL組み立て・機能制限バナー用 |
| GET | `/api/entities?type=project\|ticket\|goal&group=goal` | 一覧 | `store.listByType` / `groupProjectsByGoal`(manageData.ts) | `group=goal`指定時のみGoalグルーピング形状を返す(§5.1.1) |
| GET | `/api/entity?path=` | 詳細(子・Todo・メモを含めない素のEntity) | `store.get` | 404: E102 |
| GET | `/api/entity/children?path=` | 子Entity一覧(チケット一覧・Todo一覧用) | `store.getChildren` | |
| POST | `/api/entities` | 新規作成 | `entityService.create` | body: `CreateEntityInput`相当 |
| PATCH | `/api/entity/field?path=` | フィールド更新 | `entityFieldService.updateField` | body: `{ key, value }`。titleはrename扱い |
| POST | `/api/entity/status?path=` | status変更(Kanban相当だがブラウザ版はドロップダウン) | `entityService.changeStatus` | body: `{ next }` |
| POST | `/api/entity/archive?path=` | アーカイブ | `entityService.archive` | |
| DELETE | `/api/entity?path=` | 削除(vault.trash) | `entityService.delete` | 確認はクライアント側ダイアログ |
| POST | `/api/entity/promote-todo?path=` | Todo→Ticket昇格 | `promoteService.promoteTodoToTicket` | pathはTodo所属ノート。body: `{ todo, options }` |
| POST | `/api/entity/promote-ticket?path=` | Ticket→Project昇格 | `promoteService.promoteTicketToProject` | |
| GET | `/api/todos?parent=` | 指定Entity配下のTodo一覧 | `store.getTodos` / `collectProjectTodos` | `scope=direct\|all`(Project詳細の直下/すべて切替、manageData.ts流用) |
| POST | `/api/todos?parent=` | QuickAdd | `todoService.quickAdd` | |
| PATCH | `/api/todos/toggle` | 完了トグル | `todoService.toggle` | body: `Todo`全体(line番号照合のため) |
| PATCH | `/api/todos` | インライン編集 | `todoService.updateInline` | body: `{ todo, patch }` |
| DELETE | `/api/todos` | 削除 | `todoService.remove` | body: `Todo`全体 |
| GET | `/api/memos?path=` | メモ一覧 | `memoService.list` | |
| POST | `/api/memos?path=` | メモ追加 | `memoService.add` | body: `{ text }` |
| PATCH | `/api/memos?path=` | メモ編集 | `memoService.update` | body: `{ expected, newText }`。conflictは409 |
| DELETE | `/api/memos?path=` | メモ削除 | `memoService.remove` | body: `{ expected }`。conflictは409 |
| GET | `/api/events` | SSE購読 | `sseHub.subscribe` | トークンはクエリ文字列(§6.1) |

#### 5.1.1 Goalグルーピングはサーバー側で計算する

**判断: `groupProjectsByGoal`(`src/ui/manage/manageData.ts`)をそのままサーバーから呼び出し、集計結果をJSONで返す。** ブラウザ側で再実装しない。

理由: サーバーはプラグインと同一Node/Electronプロセス内で動作するため、`manageData.ts`の関数群(`groupProjectsByGoal` / `collectProjectTodos` / `sortEntityRows` 等)は`plugin`インスタンスをそのまま渡して直接呼び出せる。これらは既に「IndexStoreから集計する純粋寄り関数」として実装済みであり、ブラウザ側で同じロジックをTypeScript/JSに再実装すると、design-memo.md §1.1が戒める「同じ判断を2箇所に書く」状態になる。`manageData.ts`はObsidian API非依存(`plugin.store`/`plugin.eventBus`型のみ参照)なので、サーバーからの呼び出しに支障はない。

### 5.2 DTO設計

**判断: Entity/Todo/Memoの既存domain型をそのままJSONにする(API専用DTOへの変換層は設けない)。**

- `Entity`/`Todo`/`Memo`はいずれも既にプレーンなデータ型(メソッドなし、循環参照なし、`goal`/`project`はwikilink解決後の`path`文字列)であり、`JSON.stringify`にそのまま耐える
- `extra`(未知frontmatterプロパティ)は**読み取り専用でそのまま透過**する。ブラウザUIの編集対象フィールドは`EntityFieldKey`(既存、`title/status/priority/due/start/reviewCycle/goal/project/tags/labels/blockers`)に限定し、`extra`への書き込みAPIは提供しない(要件§3.3の編集対象一覧と一致させるための意図的な制限。§8フィードバック事項で明記)
- 変換層を設けない理由: 変換層を挟むと「domain型を変更したのにDTO変換関数の更新を忘れる」という新しい追従漏れリスクを生む。webapp側もdomain型を直接import(§3.3)しているため、`fetch`のレスポンス型注釈にも同じ型をそのまま使える

```typescript
// webapp/src/api/client.ts(骨格)
import type { Entity } from "@domain/entity";

export async function getEntity(path: string): Promise<Entity> {
  const res = await fetch(`${API_BASE}/api/entity?path=${encodeURIComponent(path)}`, { headers: authHeader() });
  if (!res.ok) throw await ApiError.from(res);
  return res.json(); // Entity型として扱う。実行時バリデーションはしない(信頼境界内=自ホストのサーバーのため)
}
```

### 5.3 変更プッシュのペイロード設計

```json
{ "event": "index-updated", "paths": ["PersonalOS/Projects/住宅購入.md", "PersonalOS/Tickets/比較表作成.md"] }
```

- 既存の`eventBus.emitEvent("index-updated")`(現状はpayloadなしで発火、main.ts:391の`capability-changed`とは別イベント)を、Indexer側で**変更されたpath配列を積んで発火するよう拡張する**(要件では言及されていないため§8フィードバック事項に記載)
- クライアントはTanStack Queryの`queryClient.invalidateQueries({ queryKey: ["entity", path] })`を`paths`の各要素に対して呼ぶ形でピンポイント無効化する(全件再フェッチを避ける)。`path`が現在表示中の詳細画面のものであれば即座に再フェッチ、一覧画面のqueryKeyは`type`単位のため該当typeの一覧も合わせて無効化する

### 5.4 エラー規約

| HTTPステータス | ケース | エラーコード | 既存i18nとの対応 |
|---|---|---|---|
| 400 | バリデーション失敗(EntityFieldService.validateが投げる`Error`) | `E1xx`系は使わず、`{ error: e.message }`をそのまま返す(既存`t("manage.field.invalid...")`文言を流用済みのため二重定義しない) | 既存i18nメッセージそのまま |
| 401 | トークン欠落・不一致 | `E101` | 新規(サーバー機能固有) |
| 403 | Origin不一致 | `E104` | 新規 |
| 404 | Entity/Todo/Memo未検出 | `E102` | 新規。Todo/Memoのconflict(内容不一致)とは区別する |
| 409 | line-mismatch(Todo)/内容不一致(Memo)/Promote競合 | 各操作のレスポンスに`{ error, code: "E003"|"E004"|"E007" }` | **既存のE003/E004/E007をそのまま転用**。ブラウザ側は既存Obsidian内UIと同じ文言・同じ意味論でトースト表示できる |
| 500 | 想定外例外 | `E999` | `console.error`にスタック出力、レスポンスは汎用メッセージのみ(内部パス等を漏らさない) |

`ApiRouter`は既存Serviceが投げる`Error`をそのままキャッチし、`Notice`で通知する代わりにHTTPレスポンスへ変換する。既存Service層は「Obsidian UIから呼ばれてもサーバー経由で呼ばれても同じ例外を投げる」形を保ち、通知手段(Notice vs HTTPレスポンス)だけが呼び出し側で分岐する。

---

## 6. ブラウザUI設計

### 6.1 セキュリティ設計

- **初回トークン受け渡し**: SettingsTabの「ブラウザで開く」が`http://127.0.0.1:{port}/?token={token}`を開く。`webapp/src/main.tsx`起動時に`?token=`をパースし`localStorage`(オリジン固有、他サイトから読めない)へ保存後、URLからは`history.replaceState`で除去する(ブラウザ履歴・共有スクショにトークンを残さないため)
- **通常APIリクエスト**: `Authorization: Bearer {token}`ヘッダ(fetchラッパで一元付与)
- **SSE購読のみ例外**: `EventSource`はカスタムヘッダ非対応のため`/api/events?token={token}`のクエリ文字列を許可する。`AuthGuard`はこのエンドポイントに限りクエリ文字列トークンも受理する(他エンドポイントはヘッダのみ)
- **401時**: `localStorage`のトークンを破棄し、「トークンが無効です。設定画面から再度開いてください」という案内画面を全画面表示(自動リトライしない。トークン再生成後の古いタブを誤動作させないため)
- **Origin検証**: リクエストに`Origin`ヘッダが付いている場合、`http://127.0.0.1:{実ポート}`と完全一致しなければ403(`E104`)。`Origin`なし(直接ナビゲーション・curl等)は許可する。トークンがlocalStorageに同一オリジンでしか読めない以上CSRF実害は薄いが、他ローカルアプリ・Webページからの誤爆リクエストを防ぐ多層防御として実装する
- **localhostバインドの実装確認方法**: `HttpServer.start()`の`server.listen(port, "127.0.0.1")`呼び出しをコードレビューで確認し、加えてテスト方針(§7)でE2E的に「他インターフェースからの疎通不可」を手動確認する(自動テストでは検証しない。CI環境でのネットワーク制約差を避けるため)

### 6.2 ルーティング表

| URL | 画面 | 対応(既存Obsidian内UI) |
|---|---|---|
| `/` | ホーム(Dashboard相当サマリカード) | design.md §5.2 Dashboard |
| `/projects` | プロジェクト一覧(Goalグルーピング) | design-drilldown-nav.md §3.1 |
| `/projects/:path` | プロジェクト詳細 | design-drilldown-nav.md §3.2 |
| `/tickets/:path` | チケット詳細 | design-drilldown-nav.md §3.2 |

- `:path`はVaultパスをそのまま`encodeURIComponent`したもの(`/`込み)。React Routerの`useParams()`で取得後`decodeURIComponent`する
- パンくず: プロジェクト詳細は「プロジェクト一覧 > {Goal名} > {Project名}」、チケット詳細は「プロジェクト一覧 > {Goal名} > {Project名} > {Ticket名}」。`shadcn/ui`の`Breadcrumb`コンポーネントを使用
- ブラウザの戻る/進む: React Routerの`createBrowserRouter`標準機能でそのまま満たされる(要件§3.2)

### 6.3 状態管理

**判断: TanStack Query(`@tanstack/react-query`)を採用する。**

- サーバー状態(Entity/Todo/Memo)のフェッチ・キャッシュ・再検証を一元管理できる。手書きの`useEffect`+`useState`によるフェッチ管理は、SSEプッシュ受信時の「該当キャッシュだけ無効化」(§5.3)のような部分更新をやろうとすると複雑化しやすく、TanStack Queryの`queryClient.invalidateQueries`/`setQueryData`がその用途に直接はまる
- 楽観的更新(要件§3.3): `useMutation`の`onMutate`でキャッシュを先に書き換え、`onError`で`context`から復元しつつ`sonner`のtoastでエラー表示、`onSettled`で該当queryを再検証する標準パターンをそのまま使う
- queryKey設計: `["entity", path]` / `["entities", type, group?]` / `["todos", parentPath, scope]` / `["memos", path]`。SSEの`paths`配列から`["entity", path]`と、そのentityの`type`を引いて`["entities", type]`系を無効化する

### 6.4 shadcnコンポーネント対応表

| 既存UI部品(Obsidian内Svelte) | shadcn/ui対応 |
|---|---|
| Manage一覧テーブル(`ui/manage/`) | `Table`(shadcnのプリミティブ、ソートは既存`sortEntityRows`をクライアントに移植せずAPI呼び出し時のクエリパラメータとして送り**サーバー側`buildManageRows`/`sortEntityRows`をそのまま流用**する。§5.1.1と同じ判断) |
| statusバッジ・priorityバッジ | `Badge`(variantで色分け) |
| 「フィルタ▾+バッジ」ツールバー | `Popover` + `Checkbox`群(現行のコンパクトな方式を踏襲、要件§3.2の指定通り) |
| ConfirmModal(Archive/削除確認) | `AlertDialog` |
| Notice(トースト通知) | `sonner`(shadcn推奨のトーストライブラリ。`Toast`プリミティブより実装コストが低く要件§3.3の「トースト通知」に直接合致) |
| QuickAddModal | `CommandDialog`(`cmdk`ベース。ホットキーで開くコマンドパレット風の入力、要件の「グローバルなQuick Add」と相性が良い) |
| Goalグルーピングの折りたたみ | `Collapsible` |
| パンくず | `Breadcrumb` |
| インライン編集セル(title/status/priority/due等) | shadcn標準コンポーネントに直接対応物なし。`Input`/`Select`/`Popover`(日付用)を組み合わせた自作`EditableCell`を新設(design-ui-first.md §2.2の「フィールド単位の編集」という考え方は踏襲するが、コンポーネント実装はwebapp側で新規に書く) |

### 6.5 ダークモード・i18n方式

- **ダークモード**: `prefers-color-scheme`追従+手動切替。Next.js向けの`next-themes`は本プロジェクト(Vite)には不要な依存のため使わず、`localStorage`に選択状態を保存し`<html class="dark">`をトグルする最小限の`ThemeProvider`を自作する(要件§3.1、design.mdの「依存追加は最小限に」という既存の思想と一致)
- **i18n**: `src/i18n/ja.ts`(既存)を**webappから直接import**する。`ja.ts`は文字列定数とヘルパー関数のみでObsidian API非依存のため、§3.3のdomain共有と同じ`@domain`的なpath alias(`@i18n/ja` → `../src/i18n/ja`)で参照する。ブラウザUI専用の新規文言(接続バナー・401案内等)は`ja.ts`に追記する形で一元管理を維持する(要件§4「既存ja.tsの共有」を採用)

---

## 7. リスク・要件へのフィードバック事項

1. **デフォルトポートの再検討**: 要件§2は「27124近辺」を例示しているが、`27123`/`27124`はコミュニティプラグイン「Local REST API」が標準で使用するポートと重複する可能性が高い(同一環境に両プラグインが入っているケースは十分に起こり得る)。本設計ではデフォルトを`27141`とした(§4.4)。要件書側でもポート例の見直しを推奨する
2. **`index-updated`イベントへのpayload追加が前提になっている**: 現状の`eventBus.emitEvent("index-updated")`(main.ts:391相当のcapability-changedとは別、Indexer側の発火箇所)はpayloadなしで発火している。SSEの変更プッシュ(§5.3)は変更pathの配列を要するため、Indexer側の発火をpath付きに拡張する変更が本機能に伴って発生する。既存のObsidian内UI側の購読箇所(`onEvent("index-updated", ...)`)はpayloadを無視しても動作するため後方互換だが、要件書にはこの前提追加が明記されていない
3. **`extra`(未知frontmatterプロパティ)はブラウザUIから編集不可**とした(§5.2)。要件§3.3の編集対象一覧に`extra`は含まれていないため矛盾はないが、「ブラウザ経由でも表示だけはする」のか「一切見せない」のかが要件書に明記されていなかった。本設計では詳細画面に読み取り専用の折りたたみセクションとして表示する案を採るが、確定判断は次版要件で明記することを推奨する
4. **Vault名の取得経路**: 「Obsidianで開く」(`obsidian://open?vault=...`)にはVault名が要る。`/api/meta`エンドポイント(§5.1)で`app.vault.getName()`を返す形で対応した。要件書には明記がなかったため、実装上必要な補助APIとして追加したことを記録する
5. **工数**: design-memo.md実績(第3次機能追加、M1+M2の2フェーズ)と比べ本機能はサーバー基盤・API・新規フロントエンド一式を要し、要件§6の見積もり通り「これまでの機能追加1本分以上」である。§8のフェーズ計画は5フェーズに分割し、フェーズ2まででサーバー単体の疎通確認が完了する設計とした(webapp未着手でも既存機能への影響ゼロを先に検証できる)

---

## 8. テスト方針

| 対象 | 手法 | 理由 |
|---|---|---|
| `src/server/ApiRouter.ts` | Vitest。`(method, path, query, body, deps)`のシグネチャで実HTTPサーバーを起動せずルーティング・DTO変換・エラーコード対応をテストする。`deps`(EntityService等)はモック注入 | 既存`tests/`のモック方針(`tests/mocks/obsidian.ts`、Serviceをモック化してService層を結合テストする既存パターン)とそのまま揃う。`vitest.config.ts`の`include: ["tests/**/*.test.ts"]`はそのままで、`tests/server/`を新設するだけで済む |
| `src/server/HttpServer.ts` / `SseHub.ts`(実配線部分) | 自動テストなし。手動でcurl/ブラウザから疎通確認 | 実TCPソケット・SSEコネクションを跨ぐ結合はVitestのnode環境で書くメリットが薄く、モックだらけのテストになる。起動・停止・ポート自動繰り上げは手動確認手順(§8末尾)でカバーする |
| webapp(`webapp/src/`) | **ビルド通過(`vite build`)+型チェック(`tsc --noEmit`)を主要ゲートとする。コンポーネントテストは書かない** | UI層はロジック密度が低く(ロジックの本体はdomain層に既にあり、既存226件のVitestでカバー済み)、コンポーネントスナップショット/インタラクションテストのROIより手動クリックスルー確認(§8末尾)の方が早く確実。将来`api/client.ts`のような純粋関数が増えた場合はそこだけVitest対象に追加する | 
| 既存226件への影響 | サーバー・webappはいずれも新規ファイルの追加のみで、既存`src/domain`・`src/services`・`src/infra`・`src/ui`は無変更。`vitest.config.ts`の`include`パターンも変更不要なため、既存テストの実行対象・結果はどちらも変わらない | |

### 手動確認手順(受け入れ基準との対応)

各Phase末に要件§5の受け入れ基準10項目のうち到達済みのものをチェックする。最終確認はPhase 5末に全10項目を通しで実施する(test-vaultを使用、design-memo.md M2の手順を踏襲)。

---

## 9. 実装フェーズ計画

| Phase | 内容 | 成果物・検証方法 |
|---|---|---|
| **P1: サーバー基盤+認証+設定** | `src/server/HttpServer.ts`/`AuthGuard.ts`/`TokenStore.ts`、`POSSettings.server`拡張、SettingsTabへの項目追加(§4.5)。APIはヘルスチェック(`GET /api/meta`)のみ実装 | `curl http://127.0.0.1:{port}/api/meta`がトークンなしで401、`Authorization`ヘッダ付きで200を返すことを確認。モバイルビルド(`tsc --noEmit`後の実機/シミュレータでのプラグイン有効化)がクラッシュしないことを確認 |
| **P2: REST API全面実装** | `ApiRouter.ts`に§5.1の全エンドポイントを実装、既存Service群へ委譲。`dto.ts`(§5.2の通り実質パススルー) | Vitest: `tests/server/ApiRouter.test.ts`でエンドポイント×正常系/エラー系(400/401/404/409)を網羅。curlスクリプトで主要CRUD一巡(entity作成→field更新→archive→delete、todo追加→toggle→削除、memo追加→編集→削除)を確認 |
| **P3: webapp基盤+一覧画面** | npmワークスペース化、`webapp/`のVite+Tailwind+shadcn初期セットアップ、ルーティング(§6.2)、ホーム画面、プロジェクト一覧(Goalグルーピング、`Collapsible`+`Table`)、APIクライアント+TanStack Query配線 | `npm run webapp:build`成功、`tsc --noEmit`(webapp側)成功。手動: 一覧画面がAPIから実データを表示し、フィルタ・折りたたみが動作することを確認 |
| **P4: 詳細画面+全操作** | プロジェクト詳細・チケット詳細画面、インライン編集(`EditableCell`)、Todo/メモCRUD、Entity作成/昇格/Archive/削除ダイアログ、楽観的更新+`sonner`トースト | 手動: 要件§3.3の全操作(§受け入れ基準4)をブラウザから実行し、Obsidian側ファイルに反映されることを確認。「Obsidianで開く」ボタンの動作確認 |
| **P5: プッシュ同期+仕上げ** | `SseHub`配線、Indexer側の`index-updated`payload拡張(§8フィードバック事項2)、切断バナー+自動再接続、ダークモード最終調整、i18n文言の`ja.ts`集約完了、`webapp-dist`同梱ビルドステップ | 手動: 要件§5の受け入れ基準1〜10を通しでチェックリスト化して実施(test-vault使用)。Obsidian側での手動編集がブラウザに即反映されること、逆方向も反映されることを重点確認。既存226件のVitestが全件通過することを最終確認 |

P1・P2はwebapp着手前に完了させ、「サーバーOFF時は従来通り、ONでもAPIが仕様通り動く」ことをwebapp抜きで検証できるようにする(要件§受け入れ基準9の早期担保)。

---

## 付録A. 用語集(既存design.md付録Aに追加する用語のみ)

| 用語 | 説明 |
|---|---|
| SSE(Server-Sent Events) | サーバーからクライアントへの一方向プッシュをHTTP上で実現する標準規格。ブラウザの`EventSource`が自動再接続を含め標準実装している |
| npm workspaces | 単一リポジトリ内で複数npmパッケージを管理する仕組み。ルート`package.json`の`workspaces`フィールドで宣言する |
| shadcn/ui | Radix UIプリミティブ+Tailwind CSSで構成された、コピー&カスタマイズ前提のReact UIコンポーネント集(npmパッケージとしてではなくソースコードとして取り込む方式) |
| TanStack Query | サーバー状態のフェッチ・キャッシュ・再検証・楽観的更新を管理するReact向けライブラリ(旧React Query) |
