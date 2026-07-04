import type { ReviewCycle } from "./entity";

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
