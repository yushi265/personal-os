import type * as React from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { AlertTriangle, CircleCheck, Flame, ListTodo } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CountUp } from "@/components/CountUp";
import { useHomeSummary } from "@/hooks/useHomeSummary";
import { entityDetailPath, todoDetailPath } from "@/lib/links";
import { listTransition, staggerContainer, staggerItem } from "@/lib/motion";
import { t } from "@i18n/ja";

interface SummaryCardDef {
  label: string;
  value: number;
  to: string;
  tone: "default" | "danger" | "warning" | "accent";
  icon: React.ComponentType<{ className?: string }>;
}

// tone別のグラデーション(design P6-C9)。ライト/ダーク両テーマで破綻しないよう彩度低めのfrom/toに留める。
const TONE_GRADIENT: Record<SummaryCardDef["tone"], string> = {
  default: "from-sky-500/10 to-sky-500/0",
  danger: "from-red-500/15 to-red-500/0",
  warning: "from-amber-500/15 to-amber-500/0",
  accent: "from-violet-500/15 to-violet-500/0",
};

const TONE_ICON_CLASS: Record<SummaryCardDef["tone"], string> = {
  default: "text-sky-600 dark:text-sky-400",
  danger: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
  accent: "text-violet-600 dark:text-violet-400",
};

// ホーム画面(design-browser-ui.md §6.2、§9 P4行「5. ホームからの詳細ジャンプ」)。
// カードの集計対象が1件のみに絞れる場合はその詳細へ、複数件の場合は一覧へ遷移する。
export function Home() {
  const summary = useHomeSummary();
  const reduced = useReducedMotion();

  if (summary.isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    );
  }
  if (summary.isError) return <p className="text-destructive">{t("webapp.loadError")}</p>;

  const singleTarget = (items: { count: number; to: string | undefined }[]): string => {
    const withTarget = items.filter((i) => i.count > 0);
    if (withTarget.length === 1 && withTarget[0].count === 1 && withTarget[0].to) return withTarget[0].to;
    return "/projects";
  };

  const cards: SummaryCardDef[] = [
    {
      label: t("webapp.home.todayTodo"),
      value: summary.todayTodoCount,
      icon: ListTodo,
      tone: "default",
      to: singleTarget([{ count: summary.todayTodos.length, to: summary.todayTodos[0] && todoDetailPath(summary.todayTodos[0]) }]),
    },
    {
      label: t("webapp.home.overdue"),
      value: summary.overdueTodoCount + summary.overdueEntityCount,
      icon: Flame,
      tone: "danger",
      to: singleTarget([
        { count: summary.overdueTodos.length, to: summary.overdueTodos[0] && todoDetailPath(summary.overdueTodos[0]) },
        { count: summary.overdueEntities.length, to: summary.overdueEntities[0] && entityDetailPath(summary.overdueEntities[0]) },
      ]),
    },
    {
      label: t("webapp.home.reviewNeeded"),
      value: summary.reviewNeededCount,
      icon: AlertTriangle,
      tone: "accent",
      to: singleTarget([{ count: summary.reviewNeededEntities.length, to: summary.reviewNeededEntities[0] && entityDetailPath(summary.reviewNeededEntities[0]) }]),
    },
    {
      label: t("webapp.home.activeProjects"),
      value: summary.activeProjectCount,
      icon: CircleCheck,
      tone: "default",
      to: "/projects",
    },
  ];

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <motion.div key={card.label} variants={staggerItem} transition={listTransition(!!reduced)}>
            <Link to={card.to}>
              <Card
                className={`group relative overflow-hidden bg-gradient-to-br transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md ${TONE_GRADIENT[card.tone]}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription>{card.label}</CardDescription>
                    <Icon className={`h-4 w-4 ${TONE_ICON_CLASS[card.tone]}`} />
                  </div>
                  <CardTitle
                    className={
                      (card.tone === "danger" || card.tone === "warning") && card.value > 0
                        ? TONE_ICON_CLASS[card.tone]
                        : undefined
                    }
                  >
                    <CountUp value={card.value} />
                  </CardTitle>
                </CardHeader>
                <CardContent />
              </Card>
            </Link>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
