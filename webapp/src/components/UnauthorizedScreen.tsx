import { t } from "@i18n/ja";

// design-browser-ui.md §6.1: 401時は自動リトライせず全画面の案内を出す(古いタブの誤動作防止)。
export function UnauthorizedScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-xl font-semibold">{t("webapp.unauthorized.title")}</h1>
      <p className="text-muted-foreground">{t("webapp.unauthorized.body")}</p>
    </div>
  );
}
