import { describe, expect, it, vi } from "vitest";
import type { App, TFile } from "obsidian";
import { Indexer } from "../../src/infra/Indexer";
import { IndexStore } from "../../src/infra/IndexStore";
import { SelfWriteGuard } from "../../src/infra/SelfWriteGuard";
import { POSEventBus } from "../../src/infra/EventBus";
import type { VaultRepository } from "../../src/infra/VaultRepository";

interface FakeFile {
	path: string;
	basename: string;
	fm?: Record<string, unknown>;
}

/**
 * 同basenameの複数ファイルが存在する場合、getFirstLinkpathDestは常に「最初に見つかった」ファイルへ
 * 解決される想定でモックする(実機で観測されたバグ: ticket側に誤って解決される)。
 */
function makeApp(files: FakeFile[]): App {
	const vault = {
		getMarkdownFiles: () => files.map((f) => ({ path: f.path, basename: f.basename }) as TFile),
	};
	const metadataCache = {
		getFileCache: (file: TFile) => {
			const f = files.find((x) => x.path === file.path);
			return { frontmatter: f?.fm };
		},
		getFirstLinkpathDest: (link: string, _sourcePath: string) => {
			const match = files.find((f) => f.basename === link);
			return match ? ({ path: match.path } as TFile) : null;
		},
	};
	return { vault, metadataCache } as unknown as App;
}

function makeRepo(): VaultRepository {
	return { isUnderRoot: vi.fn().mockReturnValue(true) } as unknown as VaultRepository;
}

describe("Indexer.fullScan — type-aware link resolution on basename collision", () => {
	it("resolves a ticket's project field to the project entity, not a same-named ticket, even when the ambiguous link resolves to the wrong-type file first", async () => {
		const files: FakeFile[] = [
			{ path: "PersonalOS/Projects/てすと.md", basename: "てすと", fm: { type: "project", status: "backlog" } },
			{ path: "PersonalOS/Tickets/てすと.md", basename: "てすと", fm: { type: "ticket", status: "backlog" } },
			{
				path: "PersonalOS/Tickets/child.md",
				basename: "child",
				fm: { type: "ticket", status: "backlog", project: "[[てすと]]" },
			},
		];
		const app = makeApp(files);
		const store = new IndexStore();
		const eventBus = new POSEventBus();
		const indexer = new Indexer(app, makeRepo(), store, eventBus, new SelfWriteGuard());

		await indexer.fullScan();

		const child = store.get("PersonalOS/Tickets/child.md");
		expect(child?.project).toBe("PersonalOS/Projects/てすと.md");

		const projectChildren = store.getChildren("PersonalOS/Projects/てすと.md").map((e) => e.path);
		expect(projectChildren).toContain("PersonalOS/Tickets/child.md");

		const ticketChildren = store.getChildren("PersonalOS/Tickets/てすと.md");
		expect(ticketChildren).toHaveLength(0);
	});

	it("still resolves correctly regardless of file scan order (registration-order independence via two-pass scan)", async () => {
		// child.mdをProjects/てすと.mdより先に列挙しても結果は変わらないことを確認する
		const files: FakeFile[] = [
			{
				path: "PersonalOS/Tickets/child.md",
				basename: "child",
				fm: { type: "ticket", status: "backlog", project: "[[てすと]]" },
			},
			{ path: "PersonalOS/Tickets/てすと.md", basename: "てすと", fm: { type: "ticket", status: "backlog" } },
			{ path: "PersonalOS/Projects/てすと.md", basename: "てすと", fm: { type: "project", status: "backlog" } },
		];
		const app = makeApp(files);
		const store = new IndexStore();
		const eventBus = new POSEventBus();
		const indexer = new Indexer(app, makeRepo(), store, eventBus, new SelfWriteGuard());

		await indexer.fullScan();

		const child = store.get("PersonalOS/Tickets/child.md");
		expect(child?.project).toBe("PersonalOS/Projects/てすと.md");
	});
});
