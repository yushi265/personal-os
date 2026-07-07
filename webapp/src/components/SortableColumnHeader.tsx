import type { SortKey, SortState } from "@/lib/sortEntities";
import { t } from "@i18n/ja";

export interface SortableColumn {
  key: SortKey;
  label: string;
  /** 対応する行(ProjectRow/TicketRow)側のセルと同じ幅・shrink指定を渡し、列位置を揃える */
  className: string;
}

/** ソート不可の列(labels等、配列でソート意味論が自明でないもの)。ソート可能列の後ろに非インタラクティブ(span)で描画する */
export interface StaticColumn {
  label: string;
  className: string;
}

// 一覧テーブルの列ヘッダ行(design-browser-ui.md P3行の拡張): Obsidian側の管理Viewと同じ操作感で
// クリック→昇順→再クリック→降順→3回目で手動順(デフォルト)に戻る3段トグル。
// gap-6/px-5はProjectRow/TicketRowの行と揃える(列位置がヘッダとずれないため)。
export function SortableColumnHeader({
  columns,
  sort,
  onSort,
  staticColumns,
}: {
  columns: SortableColumn[];
  sort: SortState;
  onSort: (key: SortKey) => void;
  staticColumns?: StaticColumn[];
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
            {active && (
              <span className="shrink-0" aria-hidden="true">
                {sort.direction === "asc" ? "▲" : "▼"}
              </span>
            )}
            {/* ソート状態はSR向けにテキストで通知(▲▼は装飾扱い、WCAG 1.3.1) */}
            {active && <span className="sr-only">{sort.direction === "asc" ? t("webapp.sort.asc") : t("webapp.sort.desc")}</span>}
          </button>
        );
      })}
      {staticColumns?.map((column) => (
        <span
          key={column.label}
          className={`truncate font-mono text-[11px] uppercase tracking-[0.06em] text-faint ${column.className}`}
        >
          {column.label}
        </span>
      ))}
    </div>
  );
}
