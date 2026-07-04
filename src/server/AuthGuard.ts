import type { ApiRequestInfo, AuthResult } from "./types";

/** クエリ文字列トークンを例外的に許可するエンドポイント(EventSourceがヘッダを送れないため。design-browser-ui.md §6.1) */
const QUERY_TOKEN_EXEMPT_PATHS = new Set(["/api/events"]);

/**
 * 全APIリクエストのトークン検証(Authorization: Bearer)とOrigin検証を行う(design-browser-ui.md §6.1)。
 * HttpServerから実リクエストごとに呼ばれる想定だが、実HTTPサーバーを起動せずテストできるよう
 * プレーンオブジェクト(ApiRequestInfo)を受け取る形にしている。
 */
export class AuthGuard {
	constructor(
		private getToken: () => string,
		private getPort: () => number
	) {}

	check(request: ApiRequestInfo): AuthResult {
		const originResult = this.checkOrigin(request);
		if (!originResult.ok) return originResult;
		return this.checkToken(request);
	}

	private checkToken(request: ApiRequestInfo): AuthResult {
		const expected = this.getToken();
		const bearer = this.extractBearer(request.headers.authorization);
		if (bearer && bearer === expected) return { ok: true };

		if (QUERY_TOKEN_EXEMPT_PATHS.has(request.path)) {
			const queryToken = request.query.token;
			if (queryToken && queryToken === expected) return { ok: true };
		}

		return { ok: false, status: 401, code: "E101" };
	}

	private checkOrigin(request: ApiRequestInfo): AuthResult {
		const origin = request.headers.origin;
		if (!origin) return { ok: true }; // Originなし(直接ナビゲーション・curl等)は許可

		const expected = `http://127.0.0.1:${this.getPort()}`;
		if (origin === expected) return { ok: true };

		return { ok: false, status: 403, code: "E104" };
	}

	private extractBearer(authorization: string | undefined): string | undefined {
		if (!authorization) return undefined;
		const match = /^Bearer (.+)$/.exec(authorization);
		return match?.[1];
	}
}
