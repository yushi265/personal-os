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
};
