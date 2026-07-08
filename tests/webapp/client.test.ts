import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	ApiError,
	apiClient,
	setToken,
	setUnauthorizedHandler,
	setServerUnreachableHandler,
} from "../../webapp/src/api/client";

/** Storageの最小スタブ(Mapベース)。globalThis.localStorageを差し替える。 */
function createLocalStorageStub(): Storage {
	const store = new Map<string, string>();
	return {
		getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
		setItem: (key: string, value: string) => {
			store.set(key, value);
		},
		removeItem: (key: string) => {
			store.delete(key);
		},
		clear: () => {
			store.clear();
		},
		key: (index: number) => Array.from(store.keys())[index] ?? null,
		get length() {
			return store.size;
		},
	} as Storage;
}

/** fetchのResponse最小スタブ。json()はclient.ts/ApiError.fromが呼ぶ分のみ用意する。 */
function fakeResponse(status: number, body?: unknown): Response {
	return {
		status,
		ok: status >= 200 && status < 300,
		statusText: "",
		json: async () => body,
	} as Response;
}

describe("client.ts", () => {
	let originalFetch: typeof globalThis.fetch;
	let originalLocalStorage: Storage;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		originalLocalStorage = globalThis.localStorage;
		globalThis.localStorage = createLocalStorageStub();
		// テスト間でハンドラ登録が漏れないよう、各テストでnull相当に再登録する
		setUnauthorizedHandler(() => {});
		setServerUnreachableHandler(() => {});
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		globalThis.localStorage = originalLocalStorage;
	});

	it("[代表値] fetchがTypeErrorをthrow → unreachableハンドラが1回発火し、ApiErrorがthrowされstatus===0", async () => {
		globalThis.fetch = vi.fn(async () => {
			throw new TypeError("Failed to fetch");
		}) as unknown as typeof globalThis.fetch;
		const onUnreachable = vi.fn();
		setServerUnreachableHandler(onUnreachable);

		await expect(apiClient.get("/api/ping")).rejects.toBeInstanceOf(ApiError);
		expect(onUnreachable).toHaveBeenCalledTimes(1);

		try {
			await apiClient.get("/api/ping");
			throw new Error("unreachable: should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(ApiError);
			expect((e as ApiError).status).toBe(0);
		}
	});

	it("[同値分割] fetchがTypeError以外(Error)をthrow → unreachableハンドラは発火せず、その例外がそのまま伝播", async () => {
		const originalError = new Error("network down");
		globalThis.fetch = vi.fn(async () => {
			throw originalError;
		}) as unknown as typeof globalThis.fetch;
		const onUnreachable = vi.fn();
		setServerUnreachableHandler(onUnreachable);

		await expect(apiClient.get("/api/ping")).rejects.toBe(originalError);
		expect(onUnreachable).not.toHaveBeenCalled();
	});

	it("[同値分割] 200+JSONボディ → パース結果を返し、ハンドラ類は発火しない", async () => {
		globalThis.fetch = vi.fn(async () => fakeResponse(200, { ok: true })) as unknown as typeof globalThis.fetch;
		const onUnreachable = vi.fn();
		const onUnauthorized = vi.fn();
		setServerUnreachableHandler(onUnreachable);
		setUnauthorizedHandler(onUnauthorized);

		const result = await apiClient.get<{ ok: boolean }>("/api/ping");

		expect(result).toEqual({ ok: true });
		expect(onUnreachable).not.toHaveBeenCalled();
		expect(onUnauthorized).not.toHaveBeenCalled();
	});

	it("[同値分割] 401 → localStorageからpos.tokenが消え、unauthorizedハンドラが発火し、ApiError(401)がthrowされる(既存挙動の回帰固定)", async () => {
		setToken("secret-token");
		globalThis.fetch = vi.fn(async () => fakeResponse(401)) as unknown as typeof globalThis.fetch;
		const onUnauthorized = vi.fn();
		setUnauthorizedHandler(onUnauthorized);

		await expect(apiClient.get("/api/ping")).rejects.toMatchObject({ status: 401 });
		expect(onUnauthorized).toHaveBeenCalledTimes(1);
		expect(globalThis.localStorage.getItem("pos.token")).toBeNull();
	});

	it("[同値分割] 500+{error,code}ボディ → ApiErrorのmessage/codeにボディ値が入る", async () => {
		globalThis.fetch = vi.fn(async () =>
			fakeResponse(500, { error: "internal failure", code: "E999" })
		) as unknown as typeof globalThis.fetch;

		try {
			await apiClient.get("/api/ping");
			throw new Error("unreachable: should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(ApiError);
			expect((e as ApiError).message).toBe("internal failure");
			expect((e as ApiError).code).toBe("E999");
		}
	});

	it("[境界値] 204 → undefinedを返す", async () => {
		globalThis.fetch = vi.fn(async () => fakeResponse(204)) as unknown as typeof globalThis.fetch;

		const result = await apiClient.get("/api/ping");

		expect(result).toBeUndefined();
	});

	it("[同値分割] トークン保存済み → リクエストヘッダにAuthorization: Bearer <token>が付く", async () => {
		setToken("secret-token");
		const fetchSpy = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => fakeResponse(200, {}));
		globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

		await apiClient.get("/api/ping");

		const init = fetchSpy.mock.calls[0][1] as RequestInit;
		expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
	});

	it("[同値分割] トークン未保存 → リクエストヘッダにAuthorizationが付かない", async () => {
		const fetchSpy = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => fakeResponse(200, {}));
		globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

		await apiClient.get("/api/ping");

		const init = fetchSpy.mock.calls[0][1] as RequestInit;
		expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
	});
});
