const CONTENT_TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
};

/**
 * webapp-dist/ をファイルシステムから配信する(design-browser-ui.md §3.4・§4.1)。
 * `/api/`以外の未知パスはSPAフォールバックとして index.html を返す(React Routerのクライアントサイドルーティング用)。
 * `node:fs`/`node:path`はHttpServer同様モバイルバンドルで安全なようdynamic requireにする(§4.2と同じ理由)。
 */
export class StaticServer {
	serve(pathname: string, res: import("http").ServerResponse, distDir: string): void {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const fs = require("fs") as typeof import("fs");
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const path = require("path") as typeof import("path");

		const resolvedDist = path.resolve(distDir);
		const relative = decodeURIComponent(pathname === "/" ? "index.html" : pathname.replace(/^\/+/, ""));
		const requested = path.resolve(resolvedDist, relative);

		// パストラバーサル防御: 正規化後にdistDir配下でなければ即403(ファイルシステムに触れない)
		if (requested !== resolvedDist && !requested.startsWith(resolvedDist + path.sep)) {
			res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
			res.end("Forbidden");
			return;
		}

		fs.readFile(requested, (err, data) => {
			if (err) {
				this.serveIndex(res, resolvedDist, fs, path);
				return;
			}
			const ext = path.extname(requested);
			res.writeHead(200, { "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream" });
			res.end(data);
		});
	}

	private serveIndex(
		res: import("http").ServerResponse,
		distDir: string,
		fs: typeof import("fs"),
		path: typeof import("path")
	): void {
		fs.readFile(path.join(distDir, "index.html"), (err, data) => {
			if (err) {
				res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
				res.end("Personal OS: webapp-dist not found. Run `npm run build` first.");
				return;
			}
			res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
			res.end(data);
		});
	}
}
