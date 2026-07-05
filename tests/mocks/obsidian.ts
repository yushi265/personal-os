/**
 * Minimal runtime mock of the `obsidian` package for Vitest.
 * The real `obsidian` package ships types only (no runtime implementation),
 * so tests that import from "obsidian" are redirected here via vitest.config.ts's
 * resolve.alias.
 */

export class Notice {
	message: string;
	constructor(message: string, _timeout?: number) {
		this.message = message;
	}
}

type EventCallback = (...args: unknown[]) => unknown;

export class Events {
	private listeners = new Map<string, Set<EventCallback>>();

	on(name: string, callback: EventCallback): { name: string; callback: EventCallback } {
		if (!this.listeners.has(name)) {
			this.listeners.set(name, new Set());
		}
		this.listeners.get(name)!.add(callback);
		return { name, callback };
	}

	off(name: string, callback: EventCallback): void {
		this.listeners.get(name)?.delete(callback);
	}

	trigger(name: string, ...args: unknown[]): void {
		this.listeners.get(name)?.forEach((callback) => callback(...args));
	}
}

export const Platform = {
	isMobile: false,
	isDesktopApp: true,
};

export interface MenuItemLike {
	setTitle(title: string): MenuItemLike;
	setChecked(checked: boolean): MenuItemLike;
	setIcon(icon: string): MenuItemLike;
	setDisabled(disabled: boolean): MenuItemLike;
	onClick(callback: () => void): MenuItemLike;
}

export type MenuEntry =
	| { type: "item"; title: string; disabled?: boolean; onClick?: () => void }
	| { type: "separator" };

/** buildRowMenu()等、Obsidian Menuを組み立てる純粋関数をテストするための最小mock */
export class Menu {
	items: MenuEntry[] = [];

	addItem(configure: (item: MenuItemLike) => void): this {
		const entry: { type: "item"; title: string; disabled?: boolean; onClick?: () => void } = {
			type: "item",
			title: "",
		};
		const item: MenuItemLike = {
			setTitle(title: string) {
				entry.title = title;
				return item;
			},
			setChecked(_checked: boolean) {
				return item;
			},
			setIcon(_icon: string) {
				return item;
			},
			setDisabled(disabled: boolean) {
				entry.disabled = disabled;
				return item;
			},
			onClick(callback: () => void) {
				entry.onClick = callback;
				return item;
			},
		};
		configure(item);
		this.items.push(entry);
		return this;
	}

	addSeparator(): this {
		this.items.push({ type: "separator" });
		return this;
	}

	showAtMouseEvent(_e: unknown): this {
		return this;
	}

	showAtPosition(_pos: unknown): this {
		return this;
	}
}
