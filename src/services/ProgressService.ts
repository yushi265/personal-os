import type { Entity } from "../domain/entity";
import { calcProjectProgress, calcTicketProgress } from "../domain/progress";
import type { IndexStore } from "../infra/IndexStore";
import type { SelfWriteGuard } from "../infra/SelfWriteGuard";
import type { ProgressRecalculator } from "../infra/types";
import type { VaultRepository } from "../infra/VaultRepository";

/**
 * 進捗自動計算(design.md §4.1)。infra/types.tsのProgressRecalculatorに適合する。
 * progress書き戻しはVaultRepository経由の他の書き込みと違い、自分自身のchangedイベントで
 * 再計算を誘発すると無限ループになるため、書き戻し直前にのみSelfWriteGuardでreindexを抑制する。
 */
export class ProgressService implements ProgressRecalculator {
	constructor(
		private repo: VaultRepository,
		private store: IndexStore,
		private selfWriteGuard: SelfWriteGuard
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
		// POS-3 AC-6: cancelledチケットは「やらないことにした仕事」のため集計対象から除外する
		const childTickets = this.store.getChildren(project.path).filter((e) => e.type === "ticket" && e.status !== "cancelled");
		const ticketProgresses = childTickets.map((t) => t.progress ?? 0);
		const directTodos = this.store.getTodos(project.path);
		const progress = calcProjectProgress(ticketProgresses, directTodos);
		await this.writeBack(project, progress);
	}

	/** 値が同一なら書き込みをスキップする(無限ループ・無駄なGit差分の防止) */
	private async writeBack(entity: Entity, progress: number): Promise<void> {
		if (entity.progress === progress) return;
		// 計算値が0でfm側にprogressキー自体がまだ無いなら、作成直後のデフォルト状態と等価なため書き込みをスキップする。
		// (通常はEntityService.createが初期progress: 0を書き込むためここには来ないが、
		// テンプレート等で別の生成経路が将来できても他プラグインとの書き込み競合を防ぐための多重防御)
		if (progress === 0 && entity.progress === undefined) {
			entity.progress = progress;
			return;
		}
		this.selfWriteGuard.markWrite(entity.path);
		await this.repo.updateFrontmatter(entity.path, (fm) => {
			fm.progress = progress;
		});
		// entityはIndexStore内の実体そのものへの参照のため、直接更新するとStoreにも反映される。
		// 書き戻しで発火するchangedイベントはSelfWriteGuardで抑制されるため、ここで同期しないと表示が古くなる。
		entity.progress = progress;
	}
}
