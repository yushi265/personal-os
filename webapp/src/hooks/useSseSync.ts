import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { connectSse } from "@/api/sse";

/**
 * SSE接続をマウント中維持し、切断状態を返す(design-browser-ui.md §9 P5行、接続状態バナー用)。
 * 初期値はtrue(接続試行中を切断扱いにして一瞬バナーが出るのを避けるため。design判断)。
 */
export function useSseSync(): { connected: boolean } {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    const connection = connectSse(queryClient, setConnected);
    return () => connection.close();
  }, [queryClient]);

  return { connected };
}
