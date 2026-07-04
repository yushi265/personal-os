/**
 * サーバー層のリクエスト情報をプレーンオブジェクトとして表現する(design-browser-ui.md §8)。
 * 実HTTPサーバーを起動せずに AuthGuard / ApiRouter をテストするための境界。
 */
export interface ApiRequestInfo {
	/** クエリ文字列を含まないパス(例: "/api/meta") */
	path: string;
	query: Record<string, string>;
	headers: {
		authorization?: string;
		origin?: string;
	};
}

export type AuthResult = { ok: true } | { ok: false; status: 401 | 403; code: "E101" | "E104" };
