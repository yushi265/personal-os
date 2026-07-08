import type * as React from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { AlertTriangle, ChevronRight, CircleCheck, Flame, ListTodo } from "lucide-react";
import { OPEN_STATUSES, type Entity } from "@domain/entity";
import { today } from "@domain/date";
import type { Todo } from "@domain/todo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CountUp } from "@/components/CountUp";
import { StatusBadge } from "@/components/StatusBadge";
import { TiltCard } from "@/components/TiltCard";
import { DueLabel } from "@/components/DueLabel";
import { ProgressBar } from "@/components/ProgressBar";
import { useHomeSummary } from "@/hooks/useHomeSummary";
import { useEntities } from "@/hooks/useEntities";
import { usePageTitle } from "@/hooks/usePageTitle";
import { entityDetailPath, todoDetailPath } from "@/lib/links";
import { staggerContainer, waveItem, waveTransition } from "@/lib/motion";
import { homeMoreLabel, t } from "@i18n/ja";

interface SummaryCardDef {
  label: string;
  value: number;
  tone: "default" | "danger" | "warning" | "accent";
  icon: React.ComponentType<{ className?: string }>;
}

// Geist案(design-refs/geist-final.dc.html)は白黒基調+控えめなアクセントの世界観のため、
// 旧デザイン(P6-C9)の彩度高めのグラデーション背景は撤去する。トーン別の強調は「値が1件以上ある時だけ
// 該当色にする」アイコン/数値の色分けのみに絞る。
const TONE_ACCENT_CLASS: Record<SummaryCardDef["tone"], string> = {
  default: "text-muted-foreground",
  danger: "text-destructive",
  // amber-600はカード地に対して3.0:1とAA下限すれすれのため700で余裕を持たせる(WCAG 1.4.3)
  warning: "text-amber-700 dark:text-amber-400",
  accent: "text-brand",
};

/** 1セクションに表示する最大行数。超過分は「ほか N 件」で件数のみ示す */
const MAX_SECTION_ROWS = 8;

/** セクション行の表示内容。entity行とtodo行を同じ見た目で並べるための共通形 */
interface HomeRowDef {
  key: string;
  to?: string;
  title: string;
  /** タイトル右に薄く出す文脈(親プロジェクト名など) */
  sub?: string;
  status?: string;
  due?: string;
  progress?: number;
  /** due以外の理由で載る行の説明チップ(レビュー待ち) */
  chip?: string;
}

function projectTitleOf(entity: Entity, projectTitles: Map<string, string>): string | undefined {
  return entity.project ? projectTitles.get(entity.project) : undefined;
}

function entityRow(entity: Entity, projectTitles: Map<string, string>, opts?: Partial<HomeRowDef>): HomeRowDef {
  return {
    key: entity.path,
    to: entityDetailPath(entity),
    title: entity.title,
    sub: projectTitleOf(entity, projectTitles),
    ...opts,
  };
}

function todoRow(todo: Todo, parentTitles: Map<string, string>, opts?: Partial<HomeRowDef>): HomeRowDef {
  return {
    key: `${todo.filePath}:${todo.line}`,
    to: todoDetailPath(todo),
    title: todo.text,
    sub: parentTitles.get(todo.parentPath),
    ...opts,
  };
}

function HomeRow({ row, today: now }: { row: HomeRowDef; today: string }) {
  const content = (
    <>
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate text-sm font-medium">{row.title}</span>
        {row.sub && <span className="hidden truncate text-xs text-faint sm:inline">{row.sub}</span>}
      </span>
      {row.status && (
        <span className="shrink-0">
          <StatusBadge status={row.status} />
        </span>
      )}
      {row.chip && (
        <span className="inline-flex h-[22px] shrink-0 items-center whitespace-nowrap rounded-full border border-border px-2.5 font-mono text-[11px] text-violet-700 dark:text-violet-400">
          {row.chip}
        </span>
      )}
      {row.progress !== undefined && (
        <span className="hidden w-40 shrink-0 sm:block">
          <ProgressBar value={row.progress} />
        </span>
      )}
      {row.due && (
        <span className="shrink-0 font-mono text-xs">
          <DueLabel due={row.due} today={now} />
        </span>
      )}
    </>
  );

  const rowClass = "flex h-11 items-center gap-3 border-b border-hairline px-4 last:border-b-0";

  // 詳細画面を持たない行(Inbox配下のTodo等)はリンクにしない
  if (!row.to) {
    return (
      <div className={rowClass}>
        {content}
        <span className="h-4 w-4 shrink-0" aria-hidden="true" />
      </div>
    );
  }
  return (
    <Link
      to={row.to}
      // active:scaleで行自体を押し込める触感にする(transformもtransition対象へ追加)
      className={`${rowClass} group transition-[background-color,border-color,color,transform] duration-150 hover:bg-surface active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring`}
    >
      {content}
      <ChevronRight
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-ghost transition-transform duration-150 group-hover:translate-x-0.5"
      />
    </Link>
  );
}

function HomeSection({
  label,
  emptyText,
  rows,
  today: now,
}: {
  label: string;
  emptyText: string;
  rows: HomeRowDef[];
  today: string;
}) {
  const visible = rows.slice(0, MAX_SECTION_ROWS);
  const hidden = rows.length - visible.length;

  return (
    <section aria-label={label} className="space-y-2">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.06em] text-faint">
        {label} — {rows.length}
      </h2>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-[13px] text-faint">{emptyText}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          {visible.map((row) => (
            <HomeRow key={row.key} row={row} today={now} />
          ))}
          {hidden > 0 && <p className="border-t border-hairline px-4 py-2 text-xs text-faint">{homeMoreLabel(hidden)}</p>}
        </div>
      )}
    </section>
  );
}

// ホーム画面(design-browser-ui.md §6.2)。サマリカード(件数)に加えて、Obsidian内Dashboard(design.md §5.2)
// 相当の実体リスト(今日の期限/進行中/要対応/アクティブプロジェクト)を表示し、各行から詳細へジャンプできるようにする。
// 「今日の期限」「要対応」はTodoだけでなくdue付きのproject/ticketも対象にする(チケットのdueで回す運用でもホームが機能するように)。
export function Home() {
  const summary = useHomeSummary();
  const ticketsQuery = useEntities("ticket");
  const projectsQuery = useEntities("project");
  const reduced = useReducedMotion();
  usePageTitle(t("webapp.home.title"));

  if (summary.isLoading || ticketsQuery.isLoading || projectsQuery.isLoading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }
  if (summary.isError || ticketsQuery.isError || projectsQuery.isError) {
    return <p className="text-destructive">{t("webapp.loadError")}</p>;
  }

  const now = today();
  const tickets = ticketsQuery.data ?? [];
  const projects = projectsQuery.data ?? [];
  const projectTitles = new Map(projects.map((p) => [p.path, p.title]));
  // Todoの親はticketの場合もあるため、両方のタイトルを引けるようにする
  const parentTitles = new Map([...projectTitles, ...tickets.map((tk) => [tk.path, tk.title] as const)]);

  // 「今日の期限」はTodoに加えてdueが今日の未完了project/ticketも対象(isOverdueと同じくOPEN_STATUSESで判定)
  const dueTodayEntities = [...projects, ...tickets].filter(
    (e) => e.due === now && (e.type === "project" || e.type === "ticket") && OPEN_STATUSES[e.type].has(e.status)
  );
  const doingTickets = tickets.filter((tk) => tk.status === "doing");
  const activeProjects = projects.filter((p) => p.status === "active");

  const cards: SummaryCardDef[] = [
    {
      label: t("webapp.home.today"),
      value: dueTodayEntities.length + summary.todayTodoCount,
      icon: ListTodo,
      tone: "default",
    },
    {
      label: t("webapp.home.overdue"),
      value: summary.overdueTodoCount + summary.overdueEntityCount,
      icon: Flame,
      tone: "danger",
    },
    {
      label: t("webapp.home.reviewNeeded"),
      value: summary.reviewNeededCount,
      icon: AlertTriangle,
      tone: "accent",
    },
    {
      label: t("webapp.home.activeProjects"),
      value: activeProjects.length,
      icon: CircleCheck,
      tone: "default",
    },
  ];

  const todayRows: HomeRowDef[] = [
    ...dueTodayEntities.map((e) => entityRow(e, projectTitles, { status: e.status })),
    ...summary.todayTodos.map((td) => todoRow(td, parentTitles)),
  ];
  // progress未設定でもバーを描画して行の体裁を揃える(ProgressBarは0%扱い)
  const doingRows: HomeRowDef[] = doingTickets.map((tk) =>
    entityRow(tk, projectTitles, { progress: tk.progress ?? 0, due: tk.due })
  );
  // 要対応: 期限切れ(entity → todo)を先に、レビュー待ちを後に並べる。
  // 期限切れとレビュー待ちの両方に該当するentityは期限切れ側に1行だけ出す(同一セクション内のkey重複を防ぐ)
  const overduePaths = new Set(summary.overdueEntities.map((e) => e.path));
  const attentionRows: HomeRowDef[] = [
    ...summary.overdueEntities.map((e) => entityRow(e, projectTitles, { due: e.due })),
    ...summary.overdueTodos.map((td) => todoRow(td, parentTitles, { due: td.dueDate })),
    ...summary.reviewNeededEntities
      .filter((e) => !overduePaths.has(e.path))
      .map((e) => entityRow(e, projectTitles, { chip: t("webapp.home.reviewChip") })),
  ];
  const activeProjectRows: HomeRowDef[] = activeProjects.map((p) =>
    entityRow(p, projectTitles, { progress: p.progress ?? 0, due: p.due })
  );

  return (
    <div className="space-y-8">
      {/* ページ見出し(WCAG 1.3.1): デザイン上は非表示だがSR向けにh1を提供する */}
      <h1 className="sr-only">{t("webapp.home.title")}</h1>
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
      >
        {cards.map((card, i) => {
          const Icon = card.icon;
          const accented = (card.tone === "danger" || card.tone === "warning") && card.value > 0;
          return (
            <motion.div key={card.label} variants={waveItem} transition={waveTransition(!!reduced, i)}>
              {/* 触感演出(TiltCard): チルト+浮き上がりに合わせてカード影をsm→lgへ深め、
                  アイコンと数値はease-bounceで弾ませる(意味は無い。触って気持ちいいだけの演出) */}
              <TiltCard>
                <Card className="group border-border transition-[background-color,border-color,color,box-shadow] duration-300 hover:shadow-lg">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardDescription className="font-mono text-[11px] uppercase tracking-[0.06em]">{card.label}</CardDescription>
                      <Icon
                        className={`h-4 w-4 text-faint transition-transform duration-300 ease-bounce group-hover:-rotate-12 group-hover:scale-125 ${accented ? TONE_ACCENT_CLASS[card.tone] : ""}`}
                      />
                    </div>
                    <CardTitle
                      className={`origin-left font-mono transition-transform duration-300 ease-bounce group-hover:scale-110 ${accented ? TONE_ACCENT_CLASS[card.tone] : ""}`}
                    >
                      <CountUp value={card.value} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent />
                </Card>
              </TiltCard>
            </motion.div>
          );
        })}
      </motion.div>

      {/* サマリカード(index 0-3)から波が続くよう、セクションはindex 4-7で入場する */}
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={waveItem} transition={waveTransition(!!reduced, 4)}>
          <HomeSection label={t("webapp.home.sectionToday")} emptyText={t("webapp.home.emptyToday")} rows={todayRows} today={now} />
        </motion.div>
        <motion.div variants={waveItem} transition={waveTransition(!!reduced, 5)}>
          <HomeSection label={t("webapp.home.sectionDoing")} emptyText={t("webapp.home.emptyDoing")} rows={doingRows} today={now} />
        </motion.div>
        <motion.div variants={waveItem} transition={waveTransition(!!reduced, 6)}>
          <HomeSection
            label={t("webapp.home.sectionAttention")}
            emptyText={t("webapp.home.emptyAttention")}
            rows={attentionRows}
            today={now}
          />
        </motion.div>
        <motion.div variants={waveItem} transition={waveTransition(!!reduced, 7)}>
          <HomeSection
            label={t("webapp.home.sectionActiveProjects")}
            emptyText={t("webapp.home.emptyActiveProjects")}
            rows={activeProjectRows}
            today={now}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
