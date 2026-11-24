import {
	DEFAULT_PRICE_MAX,
	DEFAULT_PRICE_MIN,
	FOLLOW_SORT_OPTIONS,
	countActiveFilters,
	createEmptyFilterSlice,
	type CategoryFilterSlice,
	type ContentFilterState
} from '#lib/common/type/filterOptions';

const FILTER_STORAGE_KEY = 'indig:catalog-filters:v1';
const FOLLOW_SORT_STORAGE_KEY = 'indig:catalog-follow-sort:v1';

const categoryFilterMemory = new Map<string, CategoryFilterSlice>();
let memoryHydrated = false;

function getFilterStorage(): Storage | null {
	if (typeof window === 'undefined') return null;
	try {
		return window.localStorage;
	} catch {
		return null;
	}
}

function sanitizeStringArray(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	return raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function sanitizePriceRange(raw: unknown): [number, number] | null {
	if (!Array.isArray(raw) || raw.length !== 2) return null;
	const min = Number(raw[0]);
	const max = Number(raw[1]);
	if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
	const clampedMin = Math.max(DEFAULT_PRICE_MIN, Math.min(DEFAULT_PRICE_MAX, Math.round(min)));
	const clampedMax = Math.max(clampedMin, Math.min(DEFAULT_PRICE_MAX, Math.round(max)));
	if (clampedMin <= DEFAULT_PRICE_MIN && clampedMax >= DEFAULT_PRICE_MAX) return null;
	return [clampedMin, clampedMax];
}

function sanitizeSlice(raw: unknown): CategoryFilterSlice {
	if (!raw || typeof raw !== 'object') return createEmptyFilterSlice();
	const obj = raw as Record<string, unknown>;
	return {
		genres: sanitizeStringArray(obj.genres),
		artistGenders: sanitizeStringArray(obj.artistGenders),
		artistTypes: sanitizeStringArray(obj.artistTypes),
		regions: sanitizeStringArray(obj.regions),
		statuses: sanitizeStringArray(obj.statuses),
		concertTypes: sanitizeStringArray(obj.concertTypes),
		forms: sanitizeStringArray(obj.forms),
		priceRange: sanitizePriceRange(obj.priceRange),
		excludeSoldOut: Boolean(obj.excludeSoldOut)
	};
}

function cloneSlice(source: CategoryFilterSlice): CategoryFilterSlice {
	return {
		genres: [...source.genres],
		artistGenders: [...(source.artistGenders ?? [])],
		artistTypes: [...(source.artistTypes ?? [])],
		regions: [...source.regions],
		statuses: [...source.statuses],
		concertTypes: [...source.concertTypes],
		forms: [...source.forms],
		priceRange: source.priceRange ? [source.priceRange[0], source.priceRange[1]] : null,
		excludeSoldOut: Boolean(source.excludeSoldOut)
	};
}

function hydrateCategoryFilterMemory(): void {
	if (memoryHydrated) return;
	const store = getFilterStorage();
	if (!store) return;
	memoryHydrated = true;

	try {
		const raw = store.getItem(FILTER_STORAGE_KEY);
		if (!raw) return;
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;

		for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
			categoryFilterMemory.set(key, sanitizeSlice(value));
		}
	} catch {
		// 손상된 스토리지 데이터는 무시하고 기본값 사용
	}
}

function persistCategoryFilterMemory(): void {
	const store = getFilterStorage();
	if (!store) return;

	try {
		const payload: Record<string, CategoryFilterSlice> = {};
		for (const [key, slice] of categoryFilterMemory.entries()) {
			if (countActiveFilters(slice) > 0) {
				payload[key] = cloneSlice(slice);
			}
		}
		if (Object.keys(payload).length === 0) {
			store.removeItem(FILTER_STORAGE_KEY);
		} else {
			store.setItem(FILTER_STORAGE_KEY, JSON.stringify(payload));
		}
	} catch {
		// 스토리지 용량/권한 오류 무시
	}
}

export function getSavedCategorySlice(category: string): CategoryFilterSlice {
	hydrateCategoryFilterMemory();
	const saved = categoryFilterMemory.get(category);
	return saved ? cloneSlice(saved) : createEmptyFilterSlice();
}

export function saveCategoryFilter(
	category: string,
	state: CategoryFilterSlice | ContentFilterState
): void {
	hydrateCategoryFilterMemory();
	categoryFilterMemory.set(category, cloneSlice(state));
	persistCategoryFilterMemory();
}

export function clearSavedCategoryFilter(category: string): void {
	hydrateCategoryFilterMemory();
	categoryFilterMemory.set(category, createEmptyFilterSlice());
	persistCategoryFilterMemory();
}

export function getSavedFollowSort(): string {
	const store = getFilterStorage();
	if (!store) return '';
	try {
		const saved = store.getItem(FOLLOW_SORT_STORAGE_KEY)?.trim() ?? '';
		return FOLLOW_SORT_OPTIONS.some((opt) => opt.value === saved) ? saved : '';
	} catch {
		return '';
	}
}

export function saveFollowSort(sort: string): void {
	const store = getFilterStorage();
	if (!store) return;
	try {
		const trimmed = sort.trim();
		if (trimmed && FOLLOW_SORT_OPTIONS.some((opt) => opt.value === trimmed)) {
			store.setItem(FOLLOW_SORT_STORAGE_KEY, trimmed);
		} else {
			store.removeItem(FOLLOW_SORT_STORAGE_KEY);
		}
	} catch {
		// 스토리지 용량/권한 오류 무시
	}
}
