import { Events, type EventRef } from "obsidian";

export type POSEvent =
	| "index-updated" // IndexStore変更(payload: 変更パス[])
	| "settings-updated"
	| "capability-changed"; // 依存プラグイン状態変化

export class POSEventBus extends Events {
	emitEvent(name: POSEvent, payload?: unknown): void {
		this.trigger(name, payload);
	}
	onEvent(name: POSEvent, cb: (payload?: unknown) => void): EventRef {
		return this.on(name, cb);
	}
}
