import type { Entity } from "../domain/entity";
import { calcProjectProgress, calcTicketProgress } from "../domain/progress";
import type { IndexStore } from "../infra/IndexStore";
import type { ProgressRecalculator } from "../infra/types";
import type { VaultRepository } from "../infra/VaultRepository";

/**
 * 進捗自動計算(design.md §4.1)。infra/types.tsのProgressRecalculatorに適合する。
 */
export class ProgressService implements ProgressRecalculator {
	constructor(
		private repo: VaultRepository,
		private store: IndexStore
	) {}

	/** 変更ファイルの祖先(Ticket→親Project、あるいはProject自身)のみ再計算する */
	async recalcAncestors(path: string): Promise<void> {
		const entity = this.store.get(path);
		if (!entity) return;

		if (entity.type === "ticket") {
			await this.recalcTicket(entity);
			if (entity.project) {
				const project = this.store.get(entity.project);
				if (project) await this.recalcProject(project);
			}
		} else if (entity.type === "project") {
			await this.recalcProject(entity);
		}
	}

	/** 全Ticket→全Projectの順で再計算する(起動時fullScan後に使用) */
	async recalcAll(): Promise<void> {
		for (const ticket of this.store.listByType("ticket")) {
			await this.recalcTicket(ticket);
		}
		for (const project of this.store.listByType("project")) {
			await this.recalcProject(project);
		}
	}

	private async recalcTicket(ticket: Entity): Promise<void> {
		const progress = calcTicketProgress(this.store.getTodos(ticket.path));
		await this.writeBack(ticket, progress);
	}

	private async recalcProject(project: Entity): Promise<void> {
		const childTickets = this.store.getChildren(project.path).filter((e) => e.type === "ticket");
		const ticketProgresses = childTickets.map((t) => t.progress ?? 0);
		const directTodos = this.store.getTodos(project.path);
		const progress = calcProjectProgress(ticketProgresses, directTodos);
		await this.writeBack(project, progress);
	}

	/** 値が同一なら書き込みをスキップする(無限ループ・無駄なGit差分の防止) */
	private async writeBack(entity: Entity, progress: number): Promise<void> {
		if (entity.progress === progress) return;
		await this.repo.updateFrontmatter(entity.path, (fm) => {
			fm.progress = progress;
		});
		// entityはIndexStore内の実体そのものへの参照のため、直接更新するとStoreにも反映される。
		// 書き戻しで発火するchangedイベントはSelfWriteGuardで抑制されるため、ここで同期しないと表示が古くなる。
		entity.progress = progress;
	}
}
