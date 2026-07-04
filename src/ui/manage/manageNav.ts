/**
 * Domain-adjacent(Obsidian非依存)のナビゲーション状態設計(design-drilldown-nav.md §2)。
 * 管理Viewの画面スタック(ManageScreen[])に対する純粋関数群。Manage.svelte / ManageView.ts から呼ばれる。
 */
import type { EntityType } from "../../domain/entity";
import type { IndexStore } from "../../infra/IndexStore";
import type { SavedView } from "../../settings/settings";
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

export type NavigateAction = "project-detail" | "ticket-detail" | "open-note";

/**
 * Dashboard等からの行クリック時の遷移先を決定する純粋関数(design-drilldown-nav.md §4.1)。
 * project/ticketは対応する詳細画面へ、それ以外(goal/review/resource/inbox、またはundefined=store未登録)
 * または修飾クリック時はノートを開く。
 */
export function resolveNavigateAction(entityType: EntityType | undefined, modifierClick: boolean): NavigateAction {
	if (!modifierClick && entityType === "project") return "project-detail";
	if (!modifierClick && entityType === "ticket") return "ticket-detail";
	return "open-note";
}

/**
 * SavedViewのpicker絞り込み(design-drilldown-nav.md §5.2)。
 * ドリルダウン化で保存対象がプロジェクト一覧画面のフィルタ+ソートのみになったため、旧タブ式で
 * `tab: "ticket"`/`tab: "todo"`として保存されたSavedViewはpickerから除外する(データは破棄しない、
 * 誤った絞り込み結果を返すよりサイレントに隠す方が安全という判断)。`tab`未設定(旧旧形式)は表示対象。
 */
export function isManageSavedViewVisible(view: SavedView): boolean {
	return view.viewMode === "manage" && (view.tab === "project" || view.tab === undefined);
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
