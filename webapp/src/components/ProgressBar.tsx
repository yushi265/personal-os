import { motion, useReducedMotion } from "motion/react";
import { springTransition } from "@/lib/motion";

// 進捗バー(design P6-B5、design-refs/geist-final.dc.html §一覧画面: 3pxバー w160+mono12px%)。
// 値変更(初回含む)にwidthがspringで追従する。
// showPercent=falseの場合はバーのみ描画する(プロジェクト/チケット詳細のヘッダ行はラベル側に
// 「PROGRESS — N%」として%を既に表示しているため、バーとの二重表示を避ける)。
export function ProgressBar({ value, showPercent = true, className }: { value?: number; showPercent?: boolean; className?: string }) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  const reduced = useReducedMotion();

  return (
    <div className={`flex items-center gap-2 ${showPercent ? "w-40" : "w-full"} ${className ?? ""}`}>
      <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-hairline">
        <motion.div
          className="h-full rounded-full bg-fg"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={springTransition(!!reduced)}
        />
      </div>
      {showPercent && <span className="w-8 shrink-0 text-right font-mono text-xs text-muted-foreground">{pct}%</span>}
    </div>
  );
}
