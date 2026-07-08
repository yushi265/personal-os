import * as React from "react";
import { t } from "@i18n/ja";
import { setToken } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// design-browser-ui.md §6.1: 401時は自動リトライせず全画面の案内を出す(古いタブの誤動作防止)。
// POS-2: 設定画面から開き直す経路に加え、トークンを直接貼り付けて復帰する経路を追加する。
export function UnauthorizedScreen() {
  const [token, setTokenValue] = React.useState("");

  function applyToken() {
    setToken(token.trim());
    window.location.reload();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-xl font-semibold">{t("webapp.unauthorized.title")}</h1>
      <p className="text-muted-foreground">{t("webapp.unauthorized.body")}</p>
      <div className="mt-4 flex w-full max-w-sm gap-2">
        <Input
          type="text"
          value={token}
          onChange={(e) => setTokenValue(e.target.value)}
          placeholder={t("webapp.unauthorized.tokenPlaceholder")}
          aria-label={t("webapp.unauthorized.tokenPlaceholder")}
        />
        <Button onClick={applyToken} disabled={!token.trim()}>
          {t("webapp.unauthorized.tokenApply")}
        </Button>
      </div>
    </div>
  );
}
