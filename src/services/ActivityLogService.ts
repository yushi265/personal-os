import { today } from "../domain/date";
import type { ActivityLogger, LogKind } from "../infra/types";
import type { VaultRepository } from "../infra/VaultRepository";
import type { POSSettings } from "../settings/settings";

const INITIAL_CONTENT = "---\ntype: resource\n---\n# Activity Log\n";

function hhmm(): string {
	const d = new Date();
	return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function yyyyMM(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Activity Log(design.md §6.3 / detail-design.md §4.6)。
 * 月次ローテーションで {root}/{logsFolder}/YYYY-MM.md へ追記する。
 */
export class ActivityLogService implements ActivityLogger {
	constructor(
		private repo: VaultRepository,
		private settings: POSSettings
	) {}

	async log(kind: LogKind, message: string): Promise<void> {
		const path = `${this.settings.rootDirectory}/${this.settings.folders.logs}/${yyyyMM()}.md`;
		const line = `- ${today()} ${hhmm()} [${kind}] ${message}\n`;
		await this.repo.appendOrCreate(path, line, INITIAL_CONTENT);
	}
}

export type { LogKind };
