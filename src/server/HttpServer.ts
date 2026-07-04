import { Platform } from "obsidian";
import type { AuthGuard } from "./AuthGuard";
import type { ApiRequestInfo } from "./types";

export const MAX_PORT_RETRIES = 20;

export interface ApiDeps {
	getVaultName: () => string;
	getCapability: () => { todoFeatures: boolean };
}

function isEaddrinuse(err: unknown): boolean {
	return typeof err === "object" && err !== null && (err as { code?: string }).code === "EADDRINUSE";
}

/**
 * `attempt(port)` を実行し、EADDRINUSEであれば port+1 で最大 maxRetries 回まで再試行する。
 * 実ソケットに依存しない純粋な形にすることで、実HTTPサーバーを起動せずテストできる(design-browser-ui.md §8)。
 * bindできたポート番号を返す。
 */
export async function bindWithPortRetry(
	startPort: number,
	attempt: (port: number) => Promise<void>,
	maxRetries: number = MAX_PORT_RETRIES
): Promise<number> {
	let port = startPort;
	for (let i = 0; i <= maxRetries; i++) {
		try {
			await attempt(port);
			return port;
		} catch (err) {
			if (isEaddrinuse(err) && i < maxRetries) {
				port += 1;
				continue;
			}
			throw err;
		}
	}
	// maxRetries >= 0 なのでここには到達しないが、型上の網羅性のために残す。
	throw new Error("bindWithPortRetry: unreachable");
}

/**
 * ローカルHTTPサーバーのライフサイクル(design-browser-ui.md §4)。
 * デスクトップ限定機能であり、`start()` の中でのみ `require("http")` する
 * (モバイルバンドルはこの行に到達しない。esbuildの `external` でNode組み込みは既に除外済み)。
 */
export class HttpServer {
	private server: import("http").Server | null = null;
	private port = -1;

	/** 現在bind中のポート(未起動なら -1) */
	get actualPort(): number {
		return this.port;
	}

	get isRunning(): boolean {
		return this.server !== null;
	}

	async start(desiredPort: number, authGuard: AuthGuard, deps: ApiDeps): Promise<number> {
		if (!Platform.isDesktopApp) return -1; // 呼び出し側で事前ガードされる想定だが二重防御(§4.2)
		if (this.server) await this.stop();

		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const http = require("http") as typeof import("http");

		const server = http.createServer((req, res) => this.handleRequest(req, res, authGuard, deps));

		const port = await bindWithPortRetry(
			desiredPort,
			(candidatePort) =>
				new Promise<void>((resolve, reject) => {
					const onError = (err: NodeJS.ErrnoException) => {
						server.off("listening", onListening);
						reject(err);
					};
					const onListening = () => {
						server.off("error", onError);
						resolve();
					};
					server.once("error", onError);
					server.once("listening", onListening);
					server.listen(candidatePort, "127.0.0.1");
				})
		);

		this.server = server;
		this.port = port;
		return port;
	}

	async stop(): Promise<void> {
		const server = this.server;
		this.server = null;
		this.port = -1;
		if (!server) return;
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}

	private handleRequest(
		req: import("http").IncomingMessage,
		res: import("http").ServerResponse,
		authGuard: AuthGuard,
		deps: ApiDeps
	): void {
		const url = new URL(req.url ?? "/", `http://127.0.0.1:${this.port}`);
		const query: Record<string, string> = {};
		url.searchParams.forEach((value, key) => (query[key] = value));

		const requestInfo: ApiRequestInfo = {
			path: url.pathname,
			query,
			headers: {
				authorization: req.headers.authorization,
				origin: req.headers.origin,
			},
		};

		const auth = authGuard.check(requestInfo);
		if (!auth.ok) {
			console.warn(`Personal OS server: auth rejected ${req.method} ${url.pathname} (${auth.code})`);
			this.writeJson(res, auth.status, { error: auth.code, code: auth.code });
			return;
		}

		this.route(req.method ?? "GET", url.pathname, deps, res);
	}

	/**
	 * P1時点のルーティング骨組み。P2で ApiRouter.ts に差し替える想定の差し込みポイント
	 * (design-browser-ui.md §9 P2行): このメソッドの中身を ApiRouter へ委譲するだけの薄い呼び出しに置き換える。
	 */
	private route(method: string, pathname: string, deps: ApiDeps, res: import("http").ServerResponse): void {
		if (method === "GET" && pathname === "/api/meta") {
			this.writeJson(res, 200, {
				vaultName: deps.getVaultName(),
				capability: deps.getCapability(),
				port: this.port,
			});
			return;
		}
		this.writeJson(res, 404, { error: "not found", code: "E102" });
	}

	private writeJson(res: import("http").ServerResponse, status: number, body: unknown): void {
		const payload = JSON.stringify(body);
		res.writeHead(status, { "Content-Type": "application/json" });
		res.end(payload);
	}
}
