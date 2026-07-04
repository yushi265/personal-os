import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useHomeSummary } from "@/hooks/useHomeSummary";
import { entityDetailPath, todoDetailPath } from "@/lib/links";
import { t } from "@i18n/ja";

interface SummaryCardDef {
  label: string;
  value: number;
  to: string;
  tone?: "default" | "danger" | "warning";
}

// ホーム画面(design-browser-ui.md §6.2、§9 P4行「5. ホームからの詳細ジャンプ」)。
// カードの集計対象が1件のみに絞れる場合はその詳細へ、複数件の場合は一覧へ遷移する。
export function Home() {
  const summary = useHomeSummary();

  if (summary.isLoading) return <p className="text-muted-foreground">{t("webapp.loading")}</p>;
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
      to: singleTarget([{ count: summary.todayTodos.length, to: summary.todayTodos[0] && todoDetailPath(summary.todayTodos[0]) }]),
    },
    {
      label: t("webapp.home.overdue"),
      value: summary.overdueTodoCount + summary.overdueEntityCount,
      tone: "danger",
      to: singleTarget([
        { count: summary.overdueTodos.length, to: summary.overdueTodos[0] && todoDetailPath(summary.overdueTodos[0]) },
        { count: summary.overdueEntities.length, to: summary.overdueEntities[0] && entityDetailPath(summary.overdueEntities[0]) },
      ]),
    },
    {
      label: t("webapp.home.reviewNeeded"),
      value: summary.reviewNeededCount,
      tone: "warning",
      to: singleTarget([{ count: summary.reviewNeededEntities.length, to: summary.reviewNeededEntities[0] && entityDetailPath(summary.reviewNeededEntities[0]) }]),
    },
    {
      label: t("webapp.home.blocked"),
      value: summary.blockedCount,
      tone: "danger",
      to: singleTarget([{ count: summary.blockedEntities.length, to: summary.blockedEntities[0] && entityDetailPath(summary.blockedEntities[0]) }]),
    },
    { label: t("webapp.home.activeProjects"), value: summary.activeProjectCount, to: "/projects" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <Link key={card.label} to={card.to}>
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <CardDescription>{card.label}</CardDescription>
              <CardTitle
                className={
                  card.tone === "danger" && card.value > 0
                    ? "text-destructive"
                    : card.tone === "warning" && card.value > 0
                      ? "text-amber-500"
                      : undefined
                }
              >
                {card.value}
              </CardTitle>
            </CardHeader>
            <CardContent />
          </Card>
        </Link>
      ))}
    </div>
  );
}
