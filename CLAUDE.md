# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## AI-DLC ハーネス

このリポジトリには AI-DLC 開発ハーネス（`.claude/` + `docs/`）が導入されている。ハーネスの全体像・使い方は [`.claude/README.md`](./.claude/README.md) を参照。

参照順序（実装着手前）:

1. [`docs/index.md`](./docs/index.md)（ドキュメント目次）
2. [`docs/architecture.md`](./docs/architecture.md)（全体構成・レイヤー責務・依存方向）／[`docs/ai-dlc/glossary.md`](./docs/ai-dlc/glossary.md)（AI-DLC 用語の正本）
3. 対象レイヤーの入口ドキュメントと docs
4. タスクにチケット番号が紐づく場合は `docs/spec/<TICKET>-*/`（薄い実装 spec）

横断ルール（`.claude/rules/` が正・実装着手前に必読）: [`risk-tiers.md`](./.claude/rules/risk-tiers.md) / [`spec-driven.md`](./.claude/rules/spec-driven.md) / [`simplicity.md`](./.claude/rules/simplicity.md) / [`testing.md`](./.claude/rules/testing.md) / [`task-and-pr.md`](./.claude/rules/task-and-pr.md) の 5 本。

機能実装・修正は [`ai-dlc-flow`](./.claude/skills/ai-dlc-flow/SKILL.md) スキルのフロー（要件整理 → design doc → TDD → 静的解析 → セルフレビュー → コミット、人間承認ゲート付き）に従う。

役割分担: AI が調査/設計・実装・テスト・レビュー・PR 作成を担い、人間が Gate 1 / Gate 2 / Gate 3 の承認とレビューを担う。

## Project Overview

An Obsidian community plugin called **Personal OS** — a life/work/learning management system built entirely on Markdown. All data lives in `.md` files with frontmatter; no custom DB, no binary files. Designed for eventual public release as an Obsidian Community Plugin.

Key external dependencies: [Tasks plugin](https://github.com/obsidian-tasks-group/obsidian-tasks) and [Dataview plugin](https://github.com/blacksmithgu/obsidian-dataview) must both be installed by the user. Todo features degrade gracefully when either is missing.

## Tech Stack

| Item | Choice |
|---|---|
| Language | TypeScript (strict) |
| UI | Obsidian `ItemView` + Svelte |
| Build | esbuild (Obsidian sample plugin standard) |
| Tests | Vitest |
| Target | Obsidian plugin (`isDesktopOnly: false`) |

## Commands (once scaffolded)

```bash
npm run dev      # esbuild watch mode
npm run build    # production build → main.js
npm run test     # Vitest unit tests
npm run typecheck
```

## Architecture

Four-layer separation (see `design.md §2.1`):

```
Presentation  →  Application (Services)  →  Domain  →  Infrastructure
```

- **Domain layer** (`src/domain/`): pure functions only, no Obsidian API, fully unit-testable without mocks
- **Infrastructure layer** (`src/infra/`): all Vault I/O funneled through `VaultRepository`; Tasks/Dataview access isolated in `TasksAdapter` / `DataviewAdapter`
- **Services layer** (`src/services/`): orchestrates domain + infra; never touches Obsidian API directly
- **UI layer** (`src/ui/`): Svelte components mounted into Obsidian `ItemView`s

### Critical design invariants

- `app.fileManager.processFrontMatter()` — **only** safe API for frontmatter writes; preserves unknown properties
- `vault.process()` — atomic read-modify-write for body/Todo line edits
- `app.fileManager.renameFile()` — for Archive moves (triggers Obsidian wikilink auto-update)
- Unknown frontmatter properties must be preserved in `entity.extra` and written back unchanged
- **SelfWriteGuard** (500ms TTL) prevents infinite loops from progress write-backs triggering `metadataCache changed` events

### IndexStore

In-memory index keyed by file path. Built once at startup using `MetadataCache` (no body reads except for ticket/project/inbox Todo parsing). Diff-updated per `metadataCache.on("changed")`. Only files under the configured Root Directory are indexed.

### Progress auto-calculation

`ProgressService` recalcs only the changed file's ancestors on each `changed` event:
- Ticket progress = `round(done / total * 100)` (0 if no todos)
- Project progress = average of child ticket progresses; direct todos counted as one ticket equivalent

## Planned Source Layout

```
src/
├── main.ts
├── domain/        # entity.ts, todo.ts, progress.ts, judge.ts, query.ts, date.ts
├── services/      # EntityService, TodoService, PromoteService, ReviewService,
│                  # ProgressService, ExportService, ActivityLogService, SearchService
├── infra/         # VaultRepository, IndexStore, Indexer, SelfWriteGuard,
│                  # DataviewAdapter, TasksAdapter, EventBus
├── settings/      # settings.ts (POSSettings interface), SettingsTab.ts
├── ui/
│   ├── dashboard/ # DashboardView.ts + Dashboard.svelte + widgets/
│   ├── kanban/    # KanbanView.ts + Kanban/Column/Card.svelte
│   ├── preview/   # PreviewView.ts + Preview.svelte
│   └── modals/    # CreateEntity, QuickAdd, Promote, Review
└── i18n/          # ja.ts — all UI strings (t("E001") pattern)
```

## Entity Model

Hierarchy: `Goal → Project → Ticket → Todo`

| Entity | Status values |
|---|---|
| Goal | `active` / `paused` / `done` / `archived` |
| Project | `backlog` / `active` / `waiting` / `review` / `done` / `archived` |
| Ticket | `backlog` / `ready` / `doing` / `waiting` / `review` / `done` / `cancelled` / `archived` |

Kanban columns map 1:1 to status values (ticket board hides `archived` and `cancelled` columns). Column display names are configurable; status values are fixed.

Todo checkbox states: `- [ ]` open / `- [x]` done / `- [-]` cancelled (Tasks-plugin convention). The raw checkbox char is preserved in `Todo.statusChar` and written back verbatim. Cancelled todos are excluded from progress denominators and open-work counts; cancelled tickets are excluded from project progress aggregation. Done and cancelled are both hidden by default in lists behind a single "完了・キャンセルを表示" toggle.

## Testing

Unit test targets (Vitest, no Obsidian mocks needed):
- `domain/progress.ts` — boundary cases: 0 todos, rounding, mixed project/direct-todo average
- `domain/judge.ts` — Overdue / ReviewNeeded / Blocked edge cases including same-day and month-end rollover
- `domain/query.ts` — `key:value` filter parsing + evaluation, `due:<date` range operator
- `infra/TasksAdapter.ts` — `toggleTodoLine()` including indented lines and round-trip

Integration tests: mock `VaultRepository` to test Services.

## Implementation Phases (MVP)

1. Settings / VaultRepository / IndexStore / Indexer / `parseEntity` / EntityService CRUD / SelfWriteGuard
2. DataviewAdapter / TasksAdapter / TodoService / QuickAdd
3. `judge.ts` / DashboardView + all Widgets / PreviewView / ProgressService
4. KanbanView (D&D + mobile tap-to-select) / PromoteService / Archive / ActivityLogService
5. ReviewService / SavedViewService / `query.ts` + search UI / TimelineView
6. ExportService (AI Export + AI Summary)
7. Capability degradation / ParseErrorWidget / i18n / mobile smoke test

## Key Decisions (from design docs)

- **Blockers** stored in frontmatter as `blockers: []` array (not body section) — simpler parsing, clean Git diffs
- **Ticket→Project promotion** moves the existing note via `renameFile` rather than creating a new one — preserves existing wikilinks
- **Activity Log** stored as monthly files `Logs/YYYY-MM.md` (append-only). Logs/ excluded from Recent Updates widget.
- **AI Summary** is rule-based (no LLM API calls) in MVP
- Date comparisons use ISO string lexicographic order (`YYYY-MM-DD`) to avoid timezone issues; `today()` builds the string from `new Date()` fields directly
- Dataview `index-ready` event must fire before the initial full scan
- Dashboard View refreshes are debounced 100ms to batch rapid `index-updated` events
