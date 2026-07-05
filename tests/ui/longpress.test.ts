import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LongPressTimer } from "../../src/ui/longpress";

describe("LongPressTimer", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("fires onFire with the start coordinates after delayMs", () => {
		const onFire = vi.fn();
		const timer = new LongPressTimer({ delayMs: 500, onFire });

		timer.start(10, 20);
		expect(timer.fired).toBe(false);
		vi.advanceTimersByTime(500);

		expect(onFire).toHaveBeenCalledWith(10, 20);
		expect(timer.fired).toBe(true);
	});

	it("does not fire before delayMs elapses", () => {
		const onFire = vi.fn();
		const timer = new LongPressTimer({ delayMs: 500, onFire });

		timer.start(0, 0);
		vi.advanceTimersByTime(499);

		expect(onFire).not.toHaveBeenCalled();
	});

	it("cancels the pending fire when moved past the threshold (scroll)", () => {
		const onFire = vi.fn();
		const timer = new LongPressTimer({ delayMs: 500, onFire });

		timer.start(0, 0);
		const cancelled = timer.move(20, 0);
		vi.advanceTimersByTime(500);

		expect(cancelled).toBe(true);
		expect(onFire).not.toHaveBeenCalled();
	});

	it("does not cancel on small movement within the threshold", () => {
		const onFire = vi.fn();
		const timer = new LongPressTimer({ delayMs: 500, onFire });

		timer.start(0, 0);
		const cancelled = timer.move(5, 5);
		vi.advanceTimersByTime(500);

		expect(cancelled).toBe(false);
		expect(onFire).toHaveBeenCalledOnce();
	});

	it("clear() prevents a pending fire (touchend before delay)", () => {
		const onFire = vi.fn();
		const timer = new LongPressTimer({ delayMs: 500, onFire });

		timer.start(0, 0);
		timer.clear();
		vi.advanceTimersByTime(500);

		expect(onFire).not.toHaveBeenCalled();
	});

	it("consumeFired reports and resets the fired flag exactly once", () => {
		const onFire = vi.fn();
		const timer = new LongPressTimer({ delayMs: 500, onFire });

		timer.start(0, 0);
		vi.advanceTimersByTime(500);

		expect(timer.consumeFired()).toBe(true);
		expect(timer.consumeFired()).toBe(false);
	});

	it("restarting via start() resets the fired flag for a new press", () => {
		const onFire = vi.fn();
		const timer = new LongPressTimer({ delayMs: 500, onFire });

		timer.start(0, 0);
		vi.advanceTimersByTime(500);
		expect(timer.fired).toBe(true);

		timer.start(1, 1);
		expect(timer.fired).toBe(false);
	});
});
