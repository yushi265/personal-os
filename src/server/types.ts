import type { IndexStore } from "../infra/IndexStore";
import type { EntityService } from "../services/EntityService";
import type { EntityFieldService } from "../services/EntityFieldService";
import type { TodoService } from "../services/TodoService";
import type { MemoService } from "../services/MemoService";
import type { PromoteService } from "../services/PromoteService";

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

/**
 * ApiRouter.handle() が委譲先とする既存Service群+IndexStore参照(design-browser-ui.md §5.1)。
 * 実HTTPサーバーを介さずテストできるよう、main.tsが組み立てる実インスタンスとテストのモックの
 * どちらも同じ形で注入できるプレーンなインターフェースにする。
 */
export interface ApiDeps {
	getVaultName: () => string;
	getCapability: () => { todoFeatures: boolean };
	/** 実際にbindできたポート(/api/metaの応答用)。P1のHttpServer.actualPort相当 */
	getPort: () => number;
	store: IndexStore;
	entityService: EntityService;
	entityFieldService: EntityFieldService;
	todoService: TodoService;
	memoService: MemoService;
	promoteService: PromoteService;
}

/** ApiRouter.handle()の戻り値。HttpServerはこれをそのままJSONレスポンスへ変換する */
export interface ApiResult {
	status: number;
	body: unknown;
}
