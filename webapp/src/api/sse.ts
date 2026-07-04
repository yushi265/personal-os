import type { QueryClient } from "@tanstack/react-query";
import type { Entity } from "@domain/entity";
import { getToken } from "@/api/client";

/**
 * SSE("/api/events")接続とキャッシュ無効化(design-browser-ui.md §4.7・§5.3)。
 * EventSourceはカスタムヘッダを送れないため、トークンはクエリ文字列で渡す(§6.1、AuthGuardが
 * /api/eventsに限りクエリトークンを許可済み)。ブラウザ標準の自動再接続をそのまま利用する。
 */

/** paths配列を見て該当queryだけを精密にinvalidateする(§5.3)。entityの型がキャッシュに無ければ["entities"]全体にフォールバックする */
function invalidateForPath(queryClient: QueryClient, path: string): void {
  queryClient.invalidateQueries({ queryKey: ["entity", path] }); // ["entity", path, "children"]も前方一致で含む
  queryClient.invalidateQueries({ queryKey: ["todos", path] }); // scope違いを前方一致で含む
  queryClient.invalidateQueries({ queryKey: ["memos", path] });
  queryClient.invalidateQueries({ queryKey: ["note", path] });

  const cached = queryClient.getQueryData<Entity>(["entity", path]);
  queryClient.invalidateQueries({ queryKey: cached ? ["entities", cached.type] : ["entities"] });
  queryClient.invalidateQueries({ queryKey: ["summary"] });
}

function handleIndexUpdated(queryClient: QueryClient, raw: string): void {
  const paths = JSON.parse(raw) as string[] | null;
  if (paths === null) {
    // fullScan(design-browser-ui.md §7-2補正: Indexer.fullScanのみpayloadなし=全体無効化)
    void queryClient.invalidateQueries();
    return;
  }
  for (const path of paths) invalidateForPath(queryClient, path);
}

export interface SseConnection {
  close: () => void;
}

/**
 * SSE接続を開始する。`onConnectedChange`は接続確立/切断のたびに呼ばれ、接続状態バナー表示に使う。
 * 返り値の`close()`はReactのuseEffectクリーンアップから呼ぶ。
 */
export function connectSse(queryClient: QueryClient, onConnectedChange: (connected: boolean) => void): SseConnection {
  const token = getToken();
  const url = token ? `/api/events?token=${encodeURIComponent(token)}` : "/api/events";
  const source = new EventSource(url);

  source.addEventListener("open", () => onConnectedChange(true));
  source.addEventListener("error", () => onConnectedChange(false));
  source.addEventListener("index-updated", (e) => handleIndexUpdated(queryClient, (e as MessageEvent).data));
  source.addEventListener("capability-changed", () => {
    void queryClient.invalidateQueries({ queryKey: ["meta"] });
  });

  return {
    close: () => source.close(),
  };
}
