import { describe, expect, it } from "vitest";
import { bindWithPortRetry } from "../../src/server/HttpServer";

function eaddrinuse(): NodeJS.ErrnoException {
	const err = new Error("address in use") as NodeJS.ErrnoException;
	err.code = "EADDRINUSE";
	return err;
}

describe("bindWithPortRetry", () => {
	it("returns the first port when the first attempt succeeds", async () => {
		const attempted: number[] = [];
		const port = await bindWithPortRetry(27141, async (p) => {
			attempted.push(p);
		});
		expect(port).toBe(27141);
		expect(attempted).toEqual([27141]);
	});

	it("advances port by 1 on each EADDRINUSE until an attempt succeeds", async () => {
		const attempted: number[] = [];
		const port = await bindWithPortRetry(27141, async (p) => {
			attempted.push(p);
			if (p < 27144) throw eaddrinuse();
		});
		expect(port).toBe(27144);
		expect(attempted).toEqual([27141, 27142, 27143, 27144]);
	});

	it("gives up after maxRetries and rethrows the last EADDRINUSE error", async () => {
		const attempted: number[] = [];
		await expect(
			bindWithPortRetry(
				27141,
				async (p) => {
					attempted.push(p);
					throw eaddrinuse();
				},
				3
			)
		).rejects.toMatchObject({ code: "EADDRINUSE" });
		// startPort + 3 retries = 4 attempts total (27141..27144)
		expect(attempted).toEqual([27141, 27142, 27143, 27144]);
	});

	it("rethrows immediately on a non-EADDRINUSE error without retrying", async () => {
		const attempted: number[] = [];
		const otherError = new Error("boom");
		await expect(
			bindWithPortRetry(27141, async (p) => {
				attempted.push(p);
				throw otherError;
			})
		).rejects.toBe(otherError);
		expect(attempted).toEqual([27141]);
	});
});
