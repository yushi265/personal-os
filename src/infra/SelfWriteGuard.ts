/**
 * 自己書き込み抑制(progress書き戻し等による無限ループ防止)。
 * obsidianに依存しない純粋なクラスなので単体テスト可能。
 */
export class SelfWriteGuard {
	private suppressed = new Map<string, number>(); // path → 期限(epoch ms)
	private static readonly TTL_MS = 500;

	markWrite(path: string): void {
		this.suppressed.set(path, Date.now() + SelfWriteGuard.TTL_MS);
	}

	isSuppressed(path: string): boolean {
		const until = this.suppressed.get(path);
		if (until === undefined) return false;
		if (Date.now() > until) {
			this.suppressed.delete(path);
			return false;
		}
		return true;
	}
}
