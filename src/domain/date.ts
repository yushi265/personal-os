import type { ReviewCycle } from "./entity";
import { dueInDaysLabel, dueOverdueLabel, dueTodayLabel } from "../i18n/ja";

/** 端末ローカル日付を YYYY-MM-DD で返す(TZ問題回避のためDate→ISOは使わない) */
export function today(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** review_cycle を加算した日付を返す */
export function addCycle(date: string, cycle: ReviewCycle): string {
	const [y, m, d] = date.split("-").map(Number);
	const base = new Date(y, m - 1, d);
	switch (cycle) {
		case "daily":
			base.setDate(base.getDate() + 1);
			break;
		case "weekly":
			base.setDate(base.getDate() + 7);
			break;
		case "monthly":
			base.setMonth(base.getMonth() + 1);
			break;
		case "quarterly":
			base.setMonth(base.getMonth() + 3);
			break;
		case "yearly":
			base.setFullYear(base.getFullYear() + 1);
			break;
	}
	return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
}

/** 日数(負数可)を加算した日付を返す。addCycleはReviewCycle単位専用のため、日数加算にはこちらを使う */
export function addDays(date: string, n: number): string {
	const [y, m, d] = date.split("-").map(Number);
	const base = new Date(y, m - 1, d);
	base.setDate(base.getDate() + n);
	return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;
}

/** タイムスタンプ付きメモ用: "YYYY-MM-DD HH:mm" を端末ローカル時刻で返す(today()の時刻拡張) */
export function nowStamp(): string {
	const d = new Date();
	return `${today()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "YYYY-MM-DD" 2つの日数差(a - b)。TZ問題回避のためDate(y,m-1,d)のローカル日付同士で比較する */
function diffInDays(a: string, b: string): number {
	const [ay, am, ad] = a.split("-").map(Number);
	const [by, bm, bd] = b.split("-").map(Number);
	const da = new Date(ay, am - 1, ad).getTime();
	const db = new Date(by, bm - 1, bd).getTime();
	return Math.round((da - db) / 86_400_000);
}

export type DueTone = "overdue" | "today" | "soon" | "normal";

export interface DueDescription {
	label: string;
	tone: DueTone;
}

/** 期限日の相対表示(§due列/詳細ヘッダ/Dashboard/TodoList/Preview共通)。soon=3日以内(当日を含まない) */
export function describeDue(due: string, today: string): DueDescription {
	const diff = diffInDays(due, today);
	if (diff < 0) return { label: dueOverdueLabel(-diff), tone: "overdue" };
	if (diff === 0) return { label: dueTodayLabel(), tone: "today" };
	if (diff <= 3) return { label: dueInDaysLabel(diff), tone: "soon" };
	return { label: dueInDaysLabel(diff), tone: "normal" };
}
