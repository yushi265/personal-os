# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
| Ticket | `backlog` / `ready` / `doing` / `waiting` / `review` / `done` / `archived` |

Kanban columns map 1:1 to status values. Column display names are configurable; status values are fixed.

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
