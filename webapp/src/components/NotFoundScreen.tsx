import { Link } from "react-router-dom";
import { t } from "@i18n/ja";

// 404(E102)時の画面(design §9 P4行: 削除直後の詳細画面滞留対策)。
export function NotFoundScreen() {
  return (
    <div className="space-y-2 py-12 text-center">
      <h1 className="text-xl font-semibold">{t("webapp.notFound.title")}</h1>
      <p className="text-muted-foreground">{t("webapp.notFound.body")}</p>
      <Link to="/projects" className="text-primary underline underline-offset-4">
        {t("webapp.notFound.backLink")}
      </Link>
    </div>
  );
}
