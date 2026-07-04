import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useHomeSummary } from "@/hooks/useHomeSummary";
import { t } from "@i18n/ja";

interface SummaryCardDef {
  label: string;
  value: number;
  tone?: "default" | "danger" | "warning";
}

// ホーム画面(design-browser-ui.md §6.2、§9 P3行)。カードクリックで/projectsへ遷移する(詳細ジャンプはP4)。
export function Home() {
  const summary = useHomeSummary();

  if (summary.isLoading) return <p className="text-muted-foreground">{t("webapp.loading")}</p>;
  if (summary.isError) return <p className="text-destructive">{t("webapp.loadError")}</p>;

  const cards: SummaryCardDef[] = [
    { label: t("webapp.home.todayTodo"), value: summary.todayTodoCount },
    { label: t("webapp.home.overdue"), value: summary.overdueTodoCount + summary.overdueEntityCount, tone: "danger" },
    { label: t("webapp.home.reviewNeeded"), value: summary.reviewNeededCount, tone: "warning" },
    { label: t("webapp.home.blocked"), value: summary.blockedCount, tone: "danger" },
    { label: t("webapp.home.activeProjects"), value: summary.activeProjectCount },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <Link key={card.label} to="/projects">
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
