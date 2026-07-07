import { t } from "@i18n/ja";

// SSE接続状態インジケータ(design P6-D15、design-refs/geist-final.dc.html §サイドバー フッタ)。
// 7px accentドット+11px muted文字。切断時のみConnectionBannerと役割が重複するため赤ドット+文言で補足する。
export function ConnectionDot({ connected, showLabel = false }: { connected: boolean; showLabel?: boolean }) {
  return (
    <span
      role="status"
      className="flex min-w-0 items-center gap-1.5"
      title={connected ? t("webapp.sse.connected") : t("webapp.sse.disconnected")}
    >
      <span className="relative flex h-[7px] w-[7px] shrink-0">
        {connected && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />}
        <span className={`relative inline-flex h-[7px] w-[7px] rounded-full ${connected ? "bg-brand" : "bg-destructive"}`} />
      </span>
      {showLabel ? (
        <span className="truncate text-[11px] text-muted-foreground">
          {connected ? t("webapp.sse.connected") : t("webapp.sse.disconnected")}
        </span>
      ) : (
        // 折りたたみ時はドット色のみになるため、SR向けに状態テキストを残す(WCAG 1.4.1)
        <span className="sr-only">{connected ? t("webapp.sse.connected") : t("webapp.sse.disconnected")}</span>
      )}
    </span>
  );
}
