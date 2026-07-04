import type { Entity, EntityType } from "../../domain/entity";
import { today } from "../../domain/date";
import type PersonalOSPlugin from "../../main";

export interface TimelineRow {
	path: string;
	title: string;
	type: EntityType;
	status: string;
	start?: string;
	due?: string;
	leftPct: number;
	widthPct: number;
	isPoint: boolean;
}

export interface TimelineMonthMarker {
	pct: number;
	label: string;
}

export interface TimelineData {
	rangeStart: string;
	rangeEnd: string;
	rows: TimelineRow[];
	/** 今日の縦線位置(%)。range外なら非表示(null) */
	todayPct: number | null;
	monthMarkers: TimelineMonthMarker[];
}

export const EMPTY_TIMELINE_DATA: TimelineData = {
	rangeStart: today(),
	rangeEnd: today(),
	rows: [],
	todayPct: null,
	monthMarkers: [],
};

function dateToDays(date: string): number {
	const [y, m, d] = date.split("-").map(Number);
	return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** rangeStart〜rangeEndに含まれる月初(1日)の一覧を、グリッド線の位置(%)+ラベル付きで返す */
function buildMonthMarkers(rangeStart: string, rangeEnd: string, startDays: number, totalDays: number): TimelineMonthMarker[] {
	const [startYear, startMonth] = rangeStart.split("-").map(Number);
	const [endYear, endMonth] = rangeEnd.split("-").map(Number);
	const markers: TimelineMonthMarker[] = [];
	let year = startYear;
	let month = startMonth;
	let prevYear: number | undefined;
	while (year < endYear || (year === endYear && month <= endMonth)) {
		const first = `${year}-${String(month).padStart(2, "0")}-01`;
		if (first >= rangeStart && first <= rangeEnd) {
			const pct = ((dateToDays(first) - startDays) / totalDays) * 100;
			markers.push({ pct, label: prevYear !== year ? `${year}年${month}月` : `${month}月` });
			prevYear = year;
		}
		month++;
		if (month > 12) {
			month = 1;
			year++;
		}
	}
	return markers;
}

/** start/dueを持つEntityから簡易タイムライン行を構築する(design.md §18/requirements.md §18の純粋関数部分) */
export function buildTimelineRows(entities: Entity[]): TimelineData {
	const withDates = entities.filter((e) => e.start || e.due);
	if (withDates.length === 0) {
		const t = today();
		return { rangeStart: t, rangeEnd: t, rows: [], todayPct: null, monthMarkers: [] };
	}

	const allDates = withDates.flatMap((e) => [e.start, e.due].filter((d): d is string => !!d));
	const rangeStart = allDates.reduce((a, b) => (a < b ? a : b));
	const rangeEnd = allDates.reduce((a, b) => (a > b ? a : b));
	const startDays = dateToDays(rangeStart);
	const endDays = dateToDays(rangeEnd);
	const totalDays = Math.max(1, endDays - startDays);

	const rows: TimelineRow[] = withDates.map((e) => {
		const isPoint = !e.start && !!e.due;
		const s = e.start ?? (e.due as string);
		const en = e.due ?? (e.start as string);
		const leftPct = ((dateToDays(s) - startDays) / totalDays) * 100;
		const widthPct = isPoint ? 0 : Math.max(0.5, ((dateToDays(en) - dateToDays(s)) / totalDays) * 100);
		return { path: e.path, title: e.title, type: e.type, status: e.status, start: e.start, due: e.due, leftPct, widthPct, isPoint };
	});

	const monthMarkers = buildMonthMarkers(rangeStart, rangeEnd, startDays, totalDays);
	const todayRawPct = ((dateToDays(today()) - startDays) / totalDays) * 100;
	const todayPct = todayRawPct >= 0 && todayRawPct <= 100 ? todayRawPct : null;

	return { rangeStart, rangeEnd, rows, todayPct, monthMarkers };
}

export function buildTimelineData(plugin: PersonalOSPlugin): TimelineData {
	const entities = [...plugin.store.listByType("project"), ...plugin.store.listByType("ticket")];
	return buildTimelineRows(entities);
}
