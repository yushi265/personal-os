import type { TFile } from "obsidian";
import type { Entity, ReviewCycle } from "../domain/entity";
import { today } from "../domain/date";
import type { ActivityLogger } from "../infra/types";
import type { IndexStore } from "../infra/IndexStore";
import type { VaultRepository } from "../infra/VaultRepository";

export type ReviewDecision = "continue" | "pause" | "complete";

export interface ReviewInput {
	targetPath: string;
	cycle: ReviewCycle;
	progress: string;
	blocker: string;
	nextAction: string;
	decision: ReviewDecision;
}

function buildReviewBody(input: ReviewInput, targetTitle: string): string {
	const fm = [
		"---",
		"type: review",
		`target: "[[${targetTitle}]]"`,
		`cycle: ${input.cycle}`,
		`reviewed_at: ${today()}`,
		`decision: ${input.decision}`,
		"---",
	].join("\n");
	return `${fm}\n\n## Progress\n${input.progress}\n\n## Blocker\n${input.blocker}\n\n## Next Action\n${input.nextAction}\n`;
}

/**
 * Review機能(design.md §6.3/detail-design.md §4.4)。
 * ①Reviews/へレビューノート生成 → ②対象のlast_reviewed更新 → ③decision別status更新 → ④ActivityLog記録
 */
export class ReviewService {
	constructor(
		private repo: VaultRepository,
		private store: IndexStore,
		private activityLog?: ActivityLogger
	) {}

	async submitReview(input: ReviewInput): Promise<TFile> {
		const target = this.store.get(input.targetPath);
		if (!target) throw new Error(`Entity not found: ${input.targetPath}`);

		const reviewsFolder = this.repo.getEntityFolder("review");
		const path = this.uniqueReviewPath(reviewsFolder, target.title);
		const file = await this.repo.createNoteAt(path, buildReviewBody(input, target.title));

		await this.repo.updateFrontmatter(input.targetPath, (fm) => {
			fm.last_reviewed = today();
		});

		await this.applyDecision(input.targetPath, target, input.decision);

		if (this.activityLog) {
			await this.activityLog.log("review", `${target.title}: ${input.decision}`);
		}

		return file;
	}

	/** {title}-{today}.md。同日重複時は -2 -3 ... サフィックス */
	private uniqueReviewPath(folder: string, title: string): string {
		const base = `${title}-${today()}`;
		let path = `${folder}/${base}.md`;
		let suffix = 2;
		while (this.repo.getFile(path)) {
			path = `${folder}/${base}-${suffix}.md`;
			suffix++;
		}
		return path;
	}

	/** continue=変更なし / pause=waiting(goalはpaused) / complete=done */
	private async applyDecision(path: string, target: Entity, decision: ReviewDecision): Promise<void> {
		if (decision === "continue") return;

		const nextStatus = decision === "complete" ? "done" : target.type === "goal" ? "paused" : "waiting";
		await this.repo.updateFrontmatter(path, (fm) => {
			fm.status = nextStatus;
		});
	}
}
