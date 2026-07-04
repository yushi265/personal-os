import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StaticServer } from "../../src/server/StaticServer";

/** http.ServerResponseの最小モック。end()呼び出しをPromiseで待てるようにする */
function makeRes() {
	let resolveDone: () => void;
	const done = new Promise<void>((resolve) => (resolveDone = resolve));
	const calls: { writeHead?: [number, Record<string, string>]; body?: string | Buffer } = {};
	const res = {
		writeHead: (status: number, headers: Record<string, string>) => {
			calls.writeHead = [status, headers];
		},
		end: (body?: string | Buffer) => {
			calls.body = body;
			resolveDone();
		},
	};
	return { res: res as unknown as import("http").ServerResponse, calls, done };
}

describe("StaticServer", () => {
	let distDir: string;

	beforeEach(() => {
		distDir = mkdtempSync(join(tmpdir(), "pos-webapp-dist-"));
		writeFileSync(join(distDir, "index.html"), "<html>index</html>");
		mkdirSync(join(distDir, "assets"));
		writeFileSync(join(distDir, "assets", "app.js"), "console.log(1)");
	});

	afterEach(() => {
		rmSync(distDir, { recursive: true, force: true });
	});

	it("serves index.html for /", async () => {
		const server = new StaticServer();
		const { res, calls, done } = makeRes();
		server.serve("/", res, distDir);
		await done;
		expect(calls.writeHead?.[0]).toBe(200);
		expect(calls.writeHead?.[1]["Content-Type"]).toContain("text/html");
		expect(calls.body?.toString()).toContain("index");
	});

	it("serves a nested asset with the correct content type", async () => {
		const server = new StaticServer();
		const { res, calls, done } = makeRes();
		server.serve("/assets/app.js", res, distDir);
		await done;
		expect(calls.writeHead?.[0]).toBe(200);
		expect(calls.writeHead?.[1]["Content-Type"]).toContain("text/javascript");
		expect(calls.body?.toString()).toContain("console.log");
	});

	it("falls back to index.html (SPA routing) for an unknown in-tree path", async () => {
		const server = new StaticServer();
		const { res, calls, done } = makeRes();
		server.serve("/projects/PersonalOS%2FProjects%2Ffoo.md", res, distDir);
		await done;
		expect(calls.writeHead?.[0]).toBe(200);
		expect(calls.body?.toString()).toContain("index");
	});

	it("rejects a path traversal attempt with 403 without touching the filesystem", async () => {
		const server = new StaticServer();
		const { res, calls, done } = makeRes();
		server.serve("/../../../../etc/passwd", res, distDir);
		await done;
		expect(calls.writeHead?.[0]).toBe(403);
	});

	it("returns 503 when webapp-dist has not been built yet", async () => {
		const server = new StaticServer();
		const emptyDir = mkdtempSync(join(tmpdir(), "pos-webapp-dist-empty-"));
		try {
			const { res, calls, done } = makeRes();
			server.serve("/", res, emptyDir);
			await done;
			expect(calls.writeHead?.[0]).toBe(503);
		} finally {
			rmSync(emptyDir, { recursive: true, force: true });
		}
	});
});
