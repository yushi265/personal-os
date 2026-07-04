import { Modal, Notice, Setting, type App } from "obsidian";
import type { Entity, ReviewCycle } from "../../domain/entity";
import type { ReviewDecision, ReviewService } from "../../services/ReviewService";
import { t } from "../../i18n/ja";

export interface ReviewModalOptions {
	reviewService: ReviewService;
	target: Entity;
	defaultCycle: ReviewCycle;
	onSubmitted?: () => void;
}

/** Review入力モーダル(detail-design.md §5.1 ReviewModal / §4.4) */
export class ReviewModal extends Modal {
	private progress = "";
	private blocker = "";
	private nextAction = "";
	private decision: ReviewDecision = "continue";

	constructor(
		app: App,
		private opts: ReviewModalOptions
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		this.setTitle(`${t("modal.review.title")}: ${this.opts.target.title}`);

		new Setting(contentEl)
			.setName(t("modal.review.progress"))
			.addTextArea((ta) =>
				ta.onChange((value) => {
					this.progress = value;
				})
			);

		new Setting(contentEl)
			.setName(t("modal.review.blocker"))
			.addTextArea((ta) =>
				ta.onChange((value) => {
					this.blocker = value;
				})
			);

		new Setting(contentEl)
			.setName(t("modal.review.nextAction"))
			.addTextArea((ta) =>
				ta.onChange((value) => {
					this.nextAction = value;
				})
			);

		new Setting(contentEl).setName(t("modal.review.decision")).addDropdown((dropdown) =>
			dropdown
				.addOptions({
					continue: t("modal.review.decision.continue"),
					pause: t("modal.review.decision.pause"),
					complete: t("modal.review.decision.complete"),
				})
				.setValue(this.decision)
				.onChange((value) => {
					this.decision = value as ReviewDecision;
				})
		);

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText(t("modal.review.submit"))
				.setCta()
				.onClick(() => void this.submit())
		);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async submit(): Promise<void> {
		try {
			const cycle = this.opts.target.reviewCycle ?? this.opts.defaultCycle;
			await this.opts.reviewService.submitReview({
				targetPath: this.opts.target.path,
				cycle,
				progress: this.progress,
				blocker: this.blocker,
				nextAction: this.nextAction,
				decision: this.decision,
			});
			new Notice(t("modal.review.submitted"));
			this.close();
			this.opts.onSubmitted?.();
		} catch {
			new Notice(t("promote.failed"));
		}
	}
}
