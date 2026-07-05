/**
 * 長押し検出のSvelteアクション(design: モバイル一覧のRowMenuを⋮ボタンなしで開けるようにする)。
 * ManageRow.svelteのカード行から使う想定だが、要素非依存の実装にしてKanbanカード等への再利用も想定する。
 *
 * 検出方式: touchstartでタイマー開始→delay経過で発火(座標を渡す)。touchmoveで閾値を超えて動いたら
 * スクロール開始とみなしキャンセル。発火後はtouchendでpreventDefault()し、発火由来の合成clickイベント
 * (=カードタップ遷移)が飛ばないようにする(mouse-jsのcapture/stopPropagationハックより信頼できる)。
 */

const DEFAULT_DELAY_MS = 500;
const MOVE_CANCEL_THRESHOLD_PX = 10;

export interface LongPressOptions {
	/** 発火時に呼ばれる。座標はtouchstart地点(Menu.showAtPositionにそのまま渡せる) */
	onLongPress: (x: number, y: number) => void;
	/** falseの場合はリスナー自体を無効化する(デスクトップでは長押し検出そのものが不要) */
	enabled?: boolean;
	delayMs?: number;
}

/** タイマー管理部分だけを切り出した純粋なステートマシン(テスト用にDOM非依存)。 */
export class LongPressTimer {
	private timer: ReturnType<typeof setTimeout> | undefined;
	private startX = 0;
	private startY = 0;
	private firedFlag = false;

	constructor(private readonly options: { delayMs: number; onFire: (x: number, y: number) => void }) {}

	get fired(): boolean {
		return this.firedFlag;
	}

	start(x: number, y: number): void {
		this.clear();
		this.startX = x;
		this.startY = y;
		this.firedFlag = false;
		this.timer = setTimeout(() => {
			this.firedFlag = true;
			this.options.onFire(this.startX, this.startY);
		}, this.options.delayMs);
	}

	/** 閾値を超えて動いたらキャンセルする。true = キャンセルした */
	move(x: number, y: number): boolean {
		if (!this.timer) return false;
		if (Math.abs(x - this.startX) > MOVE_CANCEL_THRESHOLD_PX || Math.abs(y - this.startY) > MOVE_CANCEL_THRESHOLD_PX) {
			this.clear();
			return true;
		}
		return false;
	}

	/** 発火済みだったかどうかを返しつつリセットする(touchend/contextmenuでの判定用) */
	consumeFired(): boolean {
		const wasFired = this.firedFlag;
		this.firedFlag = false;
		return wasFired;
	}

	clear(): void {
		if (this.timer) clearTimeout(this.timer);
		this.timer = undefined;
	}
}

export function longpress(node: HTMLElement, options: LongPressOptions) {
	let opts = options;
	const state = new LongPressTimer({
		delayMs: opts.delayMs ?? DEFAULT_DELAY_MS,
		onFire: (x, y) => {
			navigator.vibrate?.(10);
			opts.onLongPress(x, y);
		},
	});

	function onTouchStart(e: TouchEvent): void {
		if (opts.enabled === false || e.touches.length !== 1) return;
		const touch = e.touches[0];
		state.start(touch.clientX, touch.clientY);
	}

	function onTouchMove(e: TouchEvent): void {
		const touch = e.touches[0];
		if (!touch) return;
		state.move(touch.clientX, touch.clientY);
	}

	function onTouchEnd(e: TouchEvent): void {
		// 発火済み(=メニューを開いた)なら合成clickの発火自体を止める。non-passiveでないとpreventDefaultは効かない
		if (state.consumeFired()) e.preventDefault();
		state.clear();
	}

	function onTouchCancel(): void {
		state.clear();
	}

	function onContextMenu(e: Event): void {
		// Androidのネイティブ長押しメニュー(テキスト選択・共有等)を抑止する
		if (opts.enabled !== false) e.preventDefault();
	}

	node.addEventListener("touchstart", onTouchStart, { passive: true });
	node.addEventListener("touchmove", onTouchMove, { passive: true });
	node.addEventListener("touchend", onTouchEnd, { passive: false });
	node.addEventListener("touchcancel", onTouchCancel);
	node.addEventListener("contextmenu", onContextMenu);

	return {
		update(newOptions: LongPressOptions): void {
			opts = newOptions;
		},
		destroy(): void {
			state.clear();
			node.removeEventListener("touchstart", onTouchStart);
			node.removeEventListener("touchmove", onTouchMove);
			node.removeEventListener("touchend", onTouchEnd);
			node.removeEventListener("touchcancel", onTouchCancel);
			node.removeEventListener("contextmenu", onContextMenu);
		},
	};
}
