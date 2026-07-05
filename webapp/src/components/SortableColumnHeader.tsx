import type { SortKey, SortState } from "@/lib/sortEntities";

export interface SortableColumn {
  key: SortKey;
  label: string;
  /** 対応する行(ProjectRow/TicketRow)側のセルと同じ幅・shrink指定を渡し、列位置を揃える */
  className: string;
}

// 一覧テーブルの列ヘッダ行(design-browser-ui.md P3行の拡張): Obsidian側の管理Viewと同じ操作感で
// クリック→昇順→再クリック→降順→3回目で手動順(デフォルト)に戻る3段トグル。
// gap-6/px-5はProjectRow/TicketRowの行と揃える(列位置がヘッダとずれないため)。
export function SortableColumnHeader({
  columns,
  sort,
  onSort,
}: {
  columns: SortableColumn[];
  sort: SortState;
  onSort: (key: SortKey) => void;
}) {
  return (
    <div className="flex h-9 items-center gap-6 border-b border-hairline bg-surface px-5">
      {columns.map((column) => {
        const active = sort.key === column.key && sort.direction !== undefined;
        return (
          <button
            key={column.key}
            type="button"
            onClick={() => onSort(column.key)}
            className={`flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.06em] text-faint transition-colors hover:text-fg ${column.className}`}
          >
            <span className="truncate">{column.label}</span>
            {active && <span className="shrink-0">{sort.direction === "asc" ? "▲" : "▼"}</span>}
          </button>
        );
      })}
    </div>
  );
}
