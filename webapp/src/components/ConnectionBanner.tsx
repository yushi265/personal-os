import { t } from "@i18n/ja";

// design-browser-ui.md §9 P5行: SSE切断時に画面上部へ表示し、再接続成功(EventSource標準)で自動的に消える。
export function ConnectionBanner() {
  return (
    <div role="alert" className="sticky top-0 z-20 bg-destructive px-4 py-1.5 text-center text-sm text-destructive-foreground">
      {t("webapp.sse.disconnected")}
    </div>
  );
}
