import { describe, expect, it } from "vitest";
import { TokenStore } from "../../src/server/TokenStore";
import { DEFAULT_SETTINGS, type POSSettings } from "../../src/settings/settings";

function makeSettings(): POSSettings {
	return { ...DEFAULT_SETTINGS, server: { ...DEFAULT_SETTINGS.server } };
}

describe("TokenStore", () => {
	it("ensureToken generates and saves a token when none exists yet", async () => {
		const settings = makeSettings();
		let saveCount = 0;
		const store = new TokenStore(settings, async () => {
			saveCount += 1;
		});

		const token = await store.ensureToken();

		expect(token).not.toBe("");
		expect(settings.server.token).toBe(token);
		expect(saveCount).toBe(1);
	});

	it("ensureToken is a no-op when a token already exists", async () => {
		const settings = makeSettings();
		settings.server.token = "existing-token";
		let saveCount = 0;
		const store = new TokenStore(settings, async () => {
			saveCount += 1;
		});

		const token = await store.ensureToken();

		expect(token).toBe("existing-token");
		expect(saveCount).toBe(0);
	});

	it("regenerate produces a different token each time and persists it", async () => {
		const settings = makeSettings();
		const store = new TokenStore(settings, async () => undefined);

		const first = await store.regenerate();
		const second = await store.regenerate();

		expect(first).not.toBe(second);
		expect(settings.server.token).toBe(second);
		expect(store.get()).toBe(second);
	});
});
