/**
 * Domain-adjacent(Obsidian非依存)のナビゲーション状態設計(design-drilldown-nav.md §2)。
 * 管理Viewの画面スタック(ManageScreen[])に対する純粋関数群。Manage.svelte / ManageView.ts から呼ばれる。
 */
import type { EntityType } from "../../domain/entity";
import type { IndexStore } from "../../infra/IndexStore";
import { DEFAULT_ENTITY_SORT, EMPTY_MANAGE_FILTER, type ManageFilter, type ManageSort } from "./manageData";

export type ManageScreen =
	| { kind: "project-list" }
	| {
			kind: "project-detail";
			path: string;
			// ページ内設定(§2.3): このフレーム固有、他のproject-detailフレームとは共有しない
			ticketFilter: ManageFilter;
			ticketSort: ManageSort;
			todoScope: "direct" | "all";
			showDoneTodos: boolean;
	  }
	| { kind: "ticket-detail"; path: string; showDoneTodos: boolean };

export function makeProjectDetailScreen(path: string): ManageScreen {
	return {
		kind: "project-detail",
		path,
		ticketFilter: { ...EMPTY_MANAGE_FILTER },
		ticketSort: { ...DEFAULT_ENTITY_SORT },
		todoScope: "direct",
		showDoneTodos: false,
	};
}

export function makeTicketDetailScreen(path: string): ManageScreen {
	return { kind: "ticket-detail", path, showDoneTodos: false };
}

/** 末尾に新しい画面を積む(常に新規状態で積む。同一pathの既存フレームがあっても再利用しない、§2.5参照) */
export function pushScreen(stack: ManageScreen[], screen: ManageScreen): ManageScreen[] {
	return [...stack, screen];
}

/** パンくずの index 番目までを残す(0 = project-list のみ)。index が範囲外なら変化なし */
export function popTo(stack: ManageScreen[], index: number): ManageScreen[] {
	if (index < 0 || index >= stack.length) return stack;
	return stack.slice(0, index + 1);
}

/** 「← 戻る」= 一つ上の階層へ */
export function popOne(stack: ManageScreen[]): ManageScreen[] {
	return popTo(stack, stack.length - 2);
}

export function screenPath(screen: ManageScreen): string | undefined {
	return screen.kind === "project-list" ? undefined : screen.path;
}

export function expectedTypeOf(screen: ManageScreen): EntityType | undefined {
	if (screen.kind === "project-detail") return "project";
	if (screen.kind === "ticket-detail") return "ticket";
	return undefined;
}

/**
 * rename追従+消滅検証。stack[0](project-list)は対象外(§2.4)。
 * 1. renamesに一致するold pathを持つフレームは、型が一致する限りpathを書き換える(Title変更・昇格移動どちらもここで追従)
 * 2. 残ったフレームのうち、store.get(path)が存在しない/status==="archived"/expectedTypeOfと型不一致 のものが
 *    現れた最初のindexで打ち切る(それ以降は消す)
 * 戻り値: 新しいstackと、打ち切りが発生した場合のみtruncated: true(Notice文言生成用)
 */
export function reconcileStack(
	stack: ManageScreen[],
	store: IndexStore,
	renames: Array<[string, string]>
): { stack: ManageScreen[]; truncated: boolean } {
	const next = stack.map((screen) => {
		if (screen.kind === "project-list") return screen;
		const hit = renames.find(([oldPath]) => oldPath === screen.path);
		if (!hit) return screen;
		const [, newPath] = hit;
		const entity = store.get(newPath);
		if (entity && entity.type === expectedTypeOf(screen)) return { ...screen, path: newPath };
		return screen; // 型不一致(例: 昇格でticket→project)は書き換えず、次の検証ステップで消滅扱いにする
	});

	for (let i = 1; i < next.length; i++) {
		const screen = next[i];
		const entity = store.get(screenPath(screen)!);
		const valid = !!entity && entity.status !== "archived" && entity.type === expectedTypeOf(screen);
		if (!valid) return { stack: next.slice(0, i), truncated: true };
	}
	return { stack: next, truncated: false };
}
