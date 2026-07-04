import { t } from "@i18n/ja";

// SSE接続状態インジケータ(design P6-D15)。緑パルス=接続中、赤=切断(ConnectionBannerと役割が重複するため
// 切断時はバナーに情報を譲り、ここは視覚上の補助表示に留める)。
export function ConnectionDot({ connected }: { connected: boolean }) {
  return (
    <span className="flex items-center gap-1.5" title={connected ? t("webapp.sse.connected") : t("webapp.sse.disconnected")}>
      <span className="relative flex h-2 w-2">
        {connected && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-destructive"}`} />
      </span>
    </span>
  );
}
