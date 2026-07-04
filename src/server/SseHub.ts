import type { POSEventBus } from "../infra/EventBus";

const KEEPALIVE_INTERVAL_MS = 30_000;

/**
 * SSE購読者の管理(design-browser-ui.md §4.7)。
 * eventBusの"index-updated"(変更パス配列。fullScanのみpayloadなし=undefined)と
 * "capability-changed"をそのまま接続中のクライアントへ転送する。
 * HttpServer.stop()から`closeAll()`が呼ばれ、サーバー停止時に全接続を明示的に切断する
 * (Node の server.close() は既存keep-alive接続を自動では切らないため、切断バナー表示(要件§受け入れ8)には
 * この明示close が必要)。
 */
export class SseHub {
	private clients = new Map<import("http").ServerResponse, ReturnType<typeof setInterval>>();

	constructor(eventBus: POSEventBus) {
		eventBus.onEvent("index-updated", (paths) => this.broadcast("index-updated", paths ?? null));
		eventBus.onEvent("capability-changed", (capability) => this.broadcast("capability-changed", capability ?? null));
	}

	subscribe(res: import("http").ServerResponse): void {
		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		});
		res.write(": connected\n\n"); // コメント行でコネクション確立を即座に確定させる

		const keepalive = setInterval(() => {
			res.write(": keepalive\n\n"); // プロキシ/タイムアウト対策の定期コメント行
		}, KEEPALIVE_INTERVAL_MS);
		keepalive.unref?.(); // このタイマーだけでNode/テストプロセスの終了をブロックしないようにする

		this.clients.set(res, keepalive);
		res.on("close", () => this.removeClient(res));
	}

	/** サーバー停止時に全SSE接続を明示的に終了する */
	closeAll(): void {
		for (const res of this.clients.keys()) {
			this.removeClient(res);
			res.end();
		}
	}

	private removeClient(res: import("http").ServerResponse): void {
		const keepalive = this.clients.get(res);
		if (keepalive !== undefined) clearInterval(keepalive);
		this.clients.delete(res);
	}

	private broadcast(event: string, payload: unknown): void {
		const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
		for (const res of this.clients.keys()) res.write(data);
	}
}
