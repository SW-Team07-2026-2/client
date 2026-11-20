import type { CatalogCategoryKey, CatalogFeedMode } from '#lib/config/catalogFeed';
import {
	createDefaultFilterState,
	DEFAULT_FOLLOW_SORT,
	DEFAULT_PRICE_MAX,
	DEFAULT_PRICE_MIN,
	type ContentFilterState
} from '#lib/config/filter';

const SEARCH_DEBOUNCE_MS = 250;

class CatalogFeedStore {
	feedMode = $state<string>('recommend');
	searchQuery = $state('');
	debouncedQuery = $state('');
	filterState = $state<ContentFilterState>(createDefaultFilterState());
	activeCategory = $state<CatalogCategoryKey | null>(null);
	headerCategory = $state<CatalogCategoryKey | null>(null);
	refreshTick = $state(0);

	private debounceTimer: ReturnType<typeof setTimeout> | undefined;

	get resolvedFeedMode(): CatalogFeedMode {
		const mode = this.feedMode;
		if (mode === 'follow' || mode === 'all' || mode === 'popular' || mode === 'recommend') {
			return mode;
		}
		return 'recommend';
	}

	syncSearchQuery(value: string): void {
		clearTimeout(this.debounceTimer);
		const trimmed = value.trim();
		if (!trimmed) {
			if (this.debouncedQuery !== '') {
				this.debouncedQuery = '';
			}
			return;
		}
		if (trimmed === this.debouncedQuery.trim()) return;
		this.debounceTimer = setTimeout(() => {
			this.debouncedQuery = value;
		}, SEARCH_DEBOUNCE_MS);
	}

	commitSearch(value?: string | number): void {
		clearTimeout(this.debounceTimer);
		if (typeof value === 'string') {
			this.searchQuery = value;
		}
		this.debouncedQuery = this.searchQuery;
	}

	triggerRefresh(): void {
		this.refreshTick += 1;
	}

	clearPendingDebounce(): void {
		clearTimeout(this.debounceTimer);
		this.debounceTimer = undefined;
	}
}

export const catalogFeed = new CatalogFeedStore();

function normalizePriceRangeKey(range: [number, number] | null | undefined): string {
	if (!range) return '';
	const min = Math.max(DEFAULT_PRICE_MIN, Math.round(range[0]));
	const max = Math.min(DEFAULT_PRICE_MAX, Math.round(range[1]));
	if (min <= DEFAULT_PRICE_MIN && max >= DEFAULT_PRICE_MAX) return '';
	return `${min}:${max}`;
}

export function isCatalogCategoryReady(
	category: CatalogCategoryKey,
	isUsingStore: boolean
): boolean {
	if (!isUsingStore) return true;
	return (
		catalogFeed.activeCategory === category &&
		(catalogFeed.headerCategory === null || catalogFeed.headerCategory === category)
	);
}

export function buildCatalogRequestKey(
	category: CatalogCategoryKey,
	opts: {
		feedMode: CatalogFeedMode;
		query: string;
		genre?: string;
		filterState?: Partial<ContentFilterState>;
		refreshTick?: number;
		authKey?: string;
	}
): string {
	const isFollow = opts.feedMode === 'follow';
	const fs = opts.filterState;
	const q = opts.query.trim();
	const sort = isFollow ? fs?.sort?.trim() || DEFAULT_FOLLOW_SORT : '';
	const refresh = opts.refreshTick ?? 0;
	const authKey = isFollow ? (opts.authKey ?? '') : '';

	const genres =
		fs?.genres && fs.genres.length > 0
			? fs.genres.join(',')
			: opts.genre?.trim() ?? '';

	if (category === 'artist') {
		return JSON.stringify([category, isFollow, q, genres, sort, refresh, authKey]);
	}
	if (category === 'concert') {
		return JSON.stringify([
			category,
			isFollow,
			q,
			(fs?.statuses ?? []).join(','),
			(fs?.concertTypes ?? []).join(','),
			(fs?.regions ?? []).join(','),
			genres,
			sort,
			refresh,
			authKey
		]);
	}
	return JSON.stringify([
		category,
		isFollow,
		q,
		(fs?.forms ?? []).join(','),
		normalizePriceRangeKey(fs?.priceRange),
		sort,
		refresh,
		authKey
	]);
}
