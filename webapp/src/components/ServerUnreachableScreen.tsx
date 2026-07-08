import { t } from "@i18n/ja";
import { Button } from "@/components/ui/button";

// design-pwa.md: サーバー到達不可(fetchのTypeError)時の全画面案内。unauthorizedより優先表示される
// (到達不可は401判定より前段の障害のため)。再試行はSWがシェルをprecache済みのためリロードで安全。
export function ServerUnreachableScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-xl font-semibold">{t("webapp.unreachable.title")}</h1>
      <p className="text-muted-foreground">{t("webapp.unreachable.body")}</p>
      <Button className="mt-4" onClick={() => window.location.reload()}>
        {t("webapp.unreachable.retry")}
      </Button>
    </div>
  );
}
