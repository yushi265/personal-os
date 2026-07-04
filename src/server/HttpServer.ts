import { Platform } from "obsidian";
import type { AuthGuard } from "./AuthGuard";
import { ApiRouter } from "./ApiRouter";
import { StaticServer } from "./StaticServer";
import type { SseHub } from "./SseHub";
import type { ApiDeps, ApiRequestInfo } from "./types";

export const MAX_PORT_RETRIES = 20;
/** JSONボディの上限(design-browser-ui.md §5 実装時の追加判断: 想定外の巨大bodyでメモリを食い潰さないための防御) */
export const MAX_BODY_BYTES = 1024 * 1024;

export type { ApiDeps };

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
	private staticServer = new StaticServer();
	private sseHub: SseHub | null = null;

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
		this.sseHub = deps.sseHub;
		return port;
	}

	async stop(): Promise<void> {
		const server = this.server;
		this.server = null;
		this.port = -1;
		this.sseHub?.closeAll();
		this.sseHub = null;
		if (!server) return;
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}

	private async handleRequest(
		req: import("http").IncomingMessage,
		res: import("http").ServerResponse,
		authGuard: AuthGuard,
		deps: ApiDeps
	): Promise<void> {
		const url = new URL(req.url ?? "/", `http://127.0.0.1:${this.port}`);
		const query: Record<string, string> = {};
		url.searchParams.forEach((value, key) => (query[key] = value));

		// 静的アセット(webapp-dist/)は認証不要で配信する(design-browser-ui.md §3.4実装判断:
		// index.htmlが取れんとトークン処理自体ができんため)。API(/api/)のみ認証対象。
		if (!url.pathname.startsWith("/api/")) {
			this.staticServer.serve(url.pathname, res, deps.getWebappDistDir());
			return;
		}

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

		if ((req.method ?? "GET") === "GET" && url.pathname === "/api/events") {
			deps.sseHub.subscribe(res);
			return;
		}

		let body: unknown;
		try {
			body = await this.readJsonBody(req);
		} catch (e) {
			this.writeJson(res, 400, { error: e instanceof Error ? e.message : String(e) });
			return;
		}

		await this.route(req.method ?? "GET", url.pathname, query, body, deps, res);
	}

	/** ApiRouter.handle() への委譲(design-browser-ui.md §9 P2: P1の骨組みをここで差し替え) */
	private async route(
		method: string,
		pathname: string,
		query: Record<string, string>,
		body: unknown,
		deps: ApiDeps,
		res: import("http").ServerResponse
	): Promise<void> {
		const result = await ApiRouter.handle(method, pathname, query, body, deps);
		this.writeJson(res, result.status, result.body);
	}

	/**
	 * GET/HEAD以外はJSONボディを読む。Content-Typeが指定されていてapplication/json以外ならエラー、
	 * サイズ上限(MAX_BODY_BYTES)超過はソケットを破棄してエラーにする(design-browser-ui.md §5実装判断)。
	 * ボディが空の場合はundefinedを返す(DELETE等でボディなしの呼び出しを許容するため)。
	 */
	private readJsonBody(req: import("http").IncomingMessage): Promise<unknown> {
		return new Promise((resolve, reject) => {
			const method = req.method ?? "GET";
			if (method === "GET" || method === "HEAD") {
				resolve(undefined);
				return;
			}

			const contentType = req.headers["content-type"];
			const chunks: Buffer[] = [];
			let size = 0;

			req.on("data", (chunk: Buffer) => {
				size += chunk.length;
				if (size > MAX_BODY_BYTES) {
					req.destroy();
					reject(new Error("request body too large"));
					return;
				}
				chunks.push(chunk);
			});
			req.on("end", () => {
				if (chunks.length === 0) {
					resolve(undefined);
					return;
				}
				if (contentType && !contentType.includes("application/json")) {
					reject(new Error("unsupported content type"));
					return;
				}
				try {
					resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
				} catch {
					reject(new Error("invalid JSON body"));
				}
			});
			req.on("error", reject);
		});
	}

	private writeJson(res: import("http").ServerResponse, status: number, body: unknown): void {
		const payload = JSON.stringify(body);
		res.writeHead(status, { "Content-Type": "application/json" });
		res.end(payload);
	}
}
