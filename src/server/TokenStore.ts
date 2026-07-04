import type { POSSettings } from "../settings/settings";

/**
 * ブラウザUIサーバーの認証トークンを settings.server.token 経由で読み書きする(design-browser-ui.md §4.1)。
 * 生成・保存のみを担い、HTTPリクエストの検証は AuthGuard が行う。
 */
export class TokenStore {
	constructor(
		private settings: POSSettings,
		private saveSettings: () => Promise<void>
	) {}

	get(): string {
		return this.settings.server.token;
	}

	/** トークン未生成なら生成して保存する。既にあれば何もしない。 */
	async ensureToken(): Promise<string> {
		if (this.settings.server.token) return this.settings.server.token;
		return this.regenerate();
	}

	/** 新しいトークンを生成・保存する(既存トークンは無効化される)。 */
	async regenerate(): Promise<string> {
		const token = crypto.randomUUID();
		this.settings.server.token = token;
		await this.saveSettings();
		return token;
	}
}
