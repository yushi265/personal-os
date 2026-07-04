import { describe, expect, it, vi } from "vitest";
import { NoteService } from "../../src/services/NoteService";
import type { VaultRepository } from "../../src/infra/VaultRepository";

function makeRepo(currentBody: string) {
	let writtenBody: string | undefined;
	const repo = {
		readBody: vi.fn().mockResolvedValue(currentBody),
		processBody: vi.fn().mockImplementation((_path: string, fn: (body: string) => string) => {
			writtenBody = fn(currentBody);
			return Promise.resolve();
		}),
	} as unknown as VaultRepository;
	return { repo, getWrittenBody: () => writtenBody };
}

describe("NoteService.get", () => {
	it("reads the body via the repo and parses the '## Note' section", async () => {
		const { repo } = makeRepo("## Note\nhello\n");
		const service = new NoteService(repo);

		const text = await service.get("PersonalOS/Tickets/ticket-a.md");

		expect(repo.readBody).toHaveBeenCalledWith("PersonalOS/Tickets/ticket-a.md");
		expect(text).toBe("hello");
	});
});

describe("NoteService.save", () => {
	it("overwrites the '## Note' section body via processBody", async () => {
		const { repo, getWrittenBody } = makeRepo("## Note\nold\n");
		const service = new NoteService(repo);

		await service.save("a.md", "new content");

		expect(repo.processBody).toHaveBeenCalledWith("a.md", expect.any(Function));
		expect(getWrittenBody()).toBe("## Note\nnew content\n");
	});

	it("removes the section heading when saving an empty string", async () => {
		const { repo, getWrittenBody } = makeRepo("# Ticket\n\n## Note\nold\n");
		const service = new NoteService(repo);

		await service.save("a.md", "");

		expect(getWrittenBody()).toBe("# Ticket\n");
	});
});
