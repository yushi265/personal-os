import { useParams } from "react-router-dom";
import { t } from "@i18n/ja";

// P4でチケット詳細を実装する。P3ではルート定義+プレースホルダのみ(design §9)。
export function TicketDetail() {
  const { path } = useParams();
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">{path ? decodeURIComponent(path) : ""}</h1>
      <p className="text-muted-foreground">{t("webapp.placeholder.comingSoon")}</p>
    </div>
  );
}
