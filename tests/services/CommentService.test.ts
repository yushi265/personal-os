import { describe, expect, it, vi } from "vitest";
import { CommentService } from "../../src/services/CommentService";
import type { Comment } from "../../src/domain/comment";
import type { VaultRepository } from "../../src/infra/VaultRepository";

/** processBody(path, fn) を、渡された currentBody に対して fn を同期実行する vault.process 相当のモックにする */
function makeRepo(currentBody: string, overrides: Partial<Record<string, unknown>> = {}) {
	let writtenBody: string | undefined;
	const repo = {
		readBody: vi.fn().mockResolvedValue(currentBody),
		processBody: vi.fn().mockImplementation((_path: string, fn: (body: string) => string) => {
			writtenBody = fn(currentBody);
			return Promise.resolve();
		}),
		...overrides,
	} as unknown as VaultRepository;
	return { repo, getWrittenBody: () => writtenBody };
}

describe("CommentService.list", () => {
	it("reads the body via the repo and parses the '## Memo' section", async () => {
		const { repo } = makeRepo("## Memo\n\n### 2026-07-04 10:00\nhello\n");
		const service = new CommentService(repo);

		const comments = await service.list("PersonalOS/Tickets/ticket-a.md");

		expect(repo.readBody).toHaveBeenCalledWith("PersonalOS/Tickets/ticket-a.md");
		expect(comments).toEqual([{ datetime: "2026-07-04 10:00", text: "hello" }]);
	});
});

describe("CommentService.add", () => {
	it("appends a trimmed comment with the current timestamp via processBody, storing it under '## Memo'", async () => {
		const { repo, getWrittenBody } = makeRepo("# Ticket\n");
		const service = new CommentService(repo);

		await service.add("PersonalOS/Tickets/ticket-a.md", "  bank replied  ");

		expect(repo.processBody).toHaveBeenCalledWith("PersonalOS/Tickets/ticket-a.md", expect.any(Function));
		expect(getWrittenBody()).toMatch(/^# Ticket\n\n## Memo\n\n### \d{4}-\d{2}-\d{2} \d{2}:\d{2}\nbank replied\n$/);
	});
});

describe("CommentService.update", () => {
	const EXPECTED: Comment = { datetime: "2026-07-04 10:00", text: "old text" };

	it("returns 'ok' and writes the updated body when exactly one comment matches", async () => {
		const { repo, getWrittenBody } = makeRepo("## Memo\n\n### 2026-07-04 10:00\nold text\n");
		const service = new CommentService(repo);

		const result = await service.update("a.md", EXPECTED, "  new text  ");

		expect(result).toBe("ok");
		expect(getWrittenBody()).toBe("## Memo\n\n### 2026-07-04 10:00\nnew text\n");
	});

	it("returns 'conflict' and leaves the body unchanged when the expected comment is not found", async () => {
		const body = "## Memo\n\n### 2026-07-04 10:00\nsomething else already written\n";
		const { repo, getWrittenBody } = makeRepo(body);
		const service = new CommentService(repo);

		const result = await service.update("a.md", EXPECTED, "new text");

		expect(result).toBe("conflict");
		expect(getWrittenBody()).toBe(body);
	});
});

describe("CommentService.remove", () => {
	const EXPECTED: Comment = { datetime: "2026-07-04 10:00", text: "only comment" };

	it("returns 'ok' and removes the matched comment, keeping the '## Memo' heading", async () => {
		const { repo, getWrittenBody } = makeRepo("## Memo\n\n### 2026-07-04 10:00\nonly comment\n");
		const service = new CommentService(repo);

		const result = await service.remove("a.md", EXPECTED);

		expect(result).toBe("ok");
		expect(getWrittenBody()).toBe("## Memo\n");
	});

	it("returns 'conflict' and leaves the body unchanged when two comments match (duplicate)", async () => {
		const body = "## Memo\n\n### 2026-07-04 10:00\nonly comment\n\n### 2026-07-04 10:00\nonly comment\n";
		const { repo, getWrittenBody } = makeRepo(body);
		const service = new CommentService(repo);

		const result = await service.remove("a.md", EXPECTED);

		expect(result).toBe("conflict");
		expect(getWrittenBody()).toBe(body);
	});
});
