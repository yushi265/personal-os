import { Modal, Notice, Setting, type App } from "obsidian";
import type { Entity, ReviewCycle } from "../../domain/entity";
import type { ReviewDecision, ReviewService } from "../../services/ReviewService";
import { t, type MessageKey } from "../../i18n/ja";
import { addModalButtonRow, bindModEnterSubmit } from "./modalHelpers";

const DECISIONS: { value: ReviewDecision; labelKey: MessageKey; descKey: MessageKey }[] = [
	{ value: "continue", labelKey: "modal.review.decision.continue", descKey: "modal.review.decision.continue.desc" },
	{ value: "pause", labelKey: "modal.review.decision.pause", descKey: "modal.review.decision.pause.desc" },
	{ value: "complete", labelKey: "modal.review.decision.complete", descKey: "modal.review.decision.complete.desc" },
];

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
		bindModEnterSubmit(contentEl, () => void this.submit());
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

		new Setting(contentEl).setName(t("modal.review.decision"));
		const decisionGroup = contentEl.createDiv({ cls: "pos-manage-chip-group pos-modal-decision-group" });
		decisionGroup.setAttr("role", "group");
		decisionGroup.setAttr("aria-label", t("modal.review.decision"));
		const descEl = contentEl.createEl("p", { cls: "pos-modal-decision-desc" });

		const renderDecision = (): void => {
			decisionGroup.empty();
			for (const d of DECISIONS) {
				const btn = decisionGroup.createEl("button", {
					type: "button",
					cls: "pos-manage-chip",
					text: t(d.labelKey),
				});
				btn.toggleClass("pos-manage-chip-active", this.decision === d.value);
				btn.onclick = () => {
					this.decision = d.value;
					renderDecision();
				};
			}
			descEl.setText(t(DECISIONS.find((d) => d.value === this.decision)?.descKey ?? "modal.review.decision.continue.desc"));
		};
		renderDecision();

		addModalButtonRow(contentEl, {
			submitLabel: t("modal.review.submit"),
			onSubmit: () => void this.submit(),
			onCancel: () => this.close(),
		});
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
