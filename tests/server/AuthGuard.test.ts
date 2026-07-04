import { describe, expect, it } from "vitest";
import { AuthGuard } from "../../src/server/AuthGuard";
import type { ApiRequestInfo } from "../../src/server/types";

function makeRequest(overrides: Partial<ApiRequestInfo> = {}): ApiRequestInfo {
	return {
		path: "/api/meta",
		query: {},
		headers: {},
		...overrides,
	};
}

describe("AuthGuard", () => {
	const token = "secret-token";
	const port = 27141;

	function makeGuard(): AuthGuard {
		return new AuthGuard(
			() => token,
			() => port
		);
	}

	it("accepts a matching Bearer token", () => {
		const guard = makeGuard();
		const result = guard.check(makeRequest({ headers: { authorization: `Bearer ${token}` } }));
		expect(result).toEqual({ ok: true });
	});

	it("rejects a missing Authorization header with 401 / E101", () => {
		const guard = makeGuard();
		const result = guard.check(makeRequest());
		expect(result).toEqual({ ok: false, status: 401, code: "E101" });
	});

	it("rejects a mismatched token with 401 / E101", () => {
		const guard = makeGuard();
		const result = guard.check(makeRequest({ headers: { authorization: "Bearer wrong-token" } }));
		expect(result).toEqual({ ok: false, status: 401, code: "E101" });
	});

	it("accepts a matching Origin", () => {
		const guard = makeGuard();
		const result = guard.check(
			makeRequest({
				headers: { authorization: `Bearer ${token}`, origin: `http://127.0.0.1:${port}` },
			})
		);
		expect(result).toEqual({ ok: true });
	});

	it("rejects a mismatched Origin with 403 / E104, even with a valid token", () => {
		const guard = makeGuard();
		const result = guard.check(
			makeRequest({
				headers: { authorization: `Bearer ${token}`, origin: "http://evil.example.com" },
			})
		);
		expect(result).toEqual({ ok: false, status: 403, code: "E104" });
	});

	it("allows a request with no Origin header at all", () => {
		const guard = makeGuard();
		const result = guard.check(makeRequest({ headers: { authorization: `Bearer ${token}` } }));
		expect(result.ok).toBe(true);
	});

	it("allows /api/events with the token in the query string instead of a header", () => {
		const guard = makeGuard();
		const result = guard.check(makeRequest({ path: "/api/events", query: { token } }));
		expect(result).toEqual({ ok: true });
	});

	it("rejects /api/events with a wrong query-string token", () => {
		const guard = makeGuard();
		const result = guard.check(makeRequest({ path: "/api/events", query: { token: "wrong" } }));
		expect(result).toEqual({ ok: false, status: 401, code: "E101" });
	});

	it("does not allow a query-string token on non-exempt endpoints", () => {
		const guard = makeGuard();
		const result = guard.check(makeRequest({ path: "/api/meta", query: { token } }));
		expect(result).toEqual({ ok: false, status: 401, code: "E101" });
	});
});
