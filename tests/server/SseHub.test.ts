import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { SseHub } from "../../src/server/SseHub";
import { POSEventBus } from "../../src/infra/EventBus";

/** http.ServerResponseの最小モック(writeHead/write/end/onのみ使う) */
function makeRes() {
	const emitter = new EventEmitter();
	return Object.assign(emitter, {
		writeHead: vi.fn(),
		write: vi.fn(),
		end: vi.fn(),
	});
}

describe("SseHub", () => {
	it("writes SSE headers and a connected comment on subscribe", () => {
		const hub = new SseHub(new POSEventBus());
		const res = makeRes();

		hub.subscribe(res as unknown as import("http").ServerResponse);

		expect(res.writeHead).toHaveBeenCalledWith(
			200,
			expect.objectContaining({ "Content-Type": "text/event-stream" })
		);
		expect(res.write).toHaveBeenCalledWith(": connected\n\n");
	});

	it("broadcasts index-updated with the changed paths to all subscribers", () => {
		const eventBus = new POSEventBus();
		const hub = new SseHub(eventBus);
		const res1 = makeRes();
		const res2 = makeRes();
		hub.subscribe(res1 as unknown as import("http").ServerResponse);
		hub.subscribe(res2 as unknown as import("http").ServerResponse);

		eventBus.emitEvent("index-updated", ["a.md", "b.md"]);

		const expected = 'event: index-updated\ndata: ["a.md","b.md"]\n\n';
		expect(res1.write).toHaveBeenCalledWith(expected);
		expect(res2.write).toHaveBeenCalledWith(expected);
	});

	it("broadcasts index-updated as null when fullScan fires without a payload", () => {
		const eventBus = new POSEventBus();
		const hub = new SseHub(eventBus);
		const res = makeRes();
		hub.subscribe(res as unknown as import("http").ServerResponse);

		eventBus.emitEvent("index-updated");

		expect(res.write).toHaveBeenCalledWith("event: index-updated\ndata: null\n\n");
	});

	it("forwards capability-changed events", () => {
		const eventBus = new POSEventBus();
		const hub = new SseHub(eventBus);
		const res = makeRes();
		hub.subscribe(res as unknown as import("http").ServerResponse);

		eventBus.emitEvent("capability-changed", { todoFeatures: false });

		expect(res.write).toHaveBeenCalledWith('event: capability-changed\ndata: {"todoFeatures":false}\n\n');
	});

	it("stops broadcasting to a client after it disconnects (res 'close' event)", () => {
		const eventBus = new POSEventBus();
		const hub = new SseHub(eventBus);
		const res = makeRes();
		hub.subscribe(res as unknown as import("http").ServerResponse);

		res.emit("close");
		res.write.mockClear();
		eventBus.emitEvent("index-updated", ["a.md"]);

		expect(res.write).not.toHaveBeenCalled();
	});

	it("closeAll() ends every connected client and stops further broadcasts", () => {
		const eventBus = new POSEventBus();
		const hub = new SseHub(eventBus);
		const res1 = makeRes();
		const res2 = makeRes();
		hub.subscribe(res1 as unknown as import("http").ServerResponse);
		hub.subscribe(res2 as unknown as import("http").ServerResponse);

		hub.closeAll();

		expect(res1.end).toHaveBeenCalled();
		expect(res2.end).toHaveBeenCalled();

		res1.write.mockClear();
		eventBus.emitEvent("index-updated", ["a.md"]);
		expect(res1.write).not.toHaveBeenCalled();
	});
});
