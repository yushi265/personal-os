import { describe, expect, it, vi } from "vitest";
import { ActivityLogService } from "../../src/services/ActivityLogService";
import type { VaultRepository } from "../../src/infra/VaultRepository";
import { DEFAULT_SETTINGS } from "../../src/settings/settings";

function makeRepo() {
	return {
		appendOrCreate: vi.fn().mockResolvedValue(undefined),
	} as unknown as VaultRepository;
}

describe("ActivityLogService", () => {
	it("appends to the current month's log file under root/logs", async () => {
		const repo = makeRepo();
		const service = new ActivityLogService(repo, DEFAULT_SETTINGS);

		await service.log("promote", "Todo「foo」→ Ticket「bar」");

		const now = new Date();
		const yyyyMM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
		expect(repo.appendOrCreate).toHaveBeenCalledTimes(1);
		const [path, line, initialContent] = (repo.appendOrCreate as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(path).toBe(`PersonalOS/Logs/${yyyyMM}.md`);
		expect(line).toMatch(/^- \d{4}-\d{2}-\d{2} \d{2}:\d{2} \[promote\] Todo「foo」→ Ticket「bar」\n$/);
		expect(initialContent).toBe("---\ntype: resource\n---\n# Activity Log\n");
	});

	it("formats each LogKind into the [kind] prefix", async () => {
		const repo = makeRepo();
		const service = new ActivityLogService(repo, DEFAULT_SETTINGS);

		await service.log("archive", "住宅購入 をアーカイブ");

		const [, line] = (repo.appendOrCreate as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(line).toContain("[archive] 住宅購入 をアーカイブ");
	});
});
