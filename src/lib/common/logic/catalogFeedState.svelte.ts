import type { CatalogArtist } from '#lib/config/artists';
import type { CatalogCategoryKey, CatalogFeedMode } from '#lib/config/catalogFeed';

export interface ArtistFeedSnapshot {
	artists: CatalogArtist[];
	currentPage: number;
	hasNext: boolean;
	query: string;
	genre: string;
	requestKey?: string;
}
import {
	createDefaultFilterState,
	DEFAULT_FOLLOW_SORT,
	DEFAULT_PRICE_MAX,
	DEFAULT_PRICE_MIN,
	type ContentFilterState
} from '#lib/common/type/filterOptions';
import { getSavedFollowSort } from '#lib/layout/3_content_section/logic/contentFilterStorage';

const SEARCH_DEBOUNCE_MS = 250;
const FEED_MODE_STORAGE_KEY = 'main-page-header-feed-mode';

const CATEGORY_BASE_ROUTES: Record<CatalogCategoryKey, string> = {
	artist: '/artist',
	concert: '/concert',
	album: '/album',
	goods: '/goods'
};

function normalizePathname(pathname?: string | null): string {
	if (!pathname) return '/';
	return pathname.replace(/\/+$/, '') || '/';
}

export function resolveCatalogCategoryFromPath(
	pathname?: string | null
): CatalogCategoryKey | null {
	const normalized = normalizePathname(pathname);
	if (normalized === '/artist' || normalized.startsWith('/artist/')) return 'artist';
	if (normalized === '/concert' || normalized.startsWith('/concert/')) return 'concert';
	if (normalized === '/album' || normalized.startsWith('/album/')) return 'album';
	if (normalized === '/goods' || normalized.startsWith('/goods/')) return 'goods';
	return null;
}

function readInitialFeedMode(): string {
	if (typeof window === 'undefined') return 'recommend';
	try {
		const saved = window.localStorage.getItem(FEED_MODE_STORAGE_KEY);
		if (saved === 'recommend' || saved === 'popular' || saved === 'follow') {
			return saved;
		}
	} catch {
		// 스토리지 접근 불가 환경 무시
	}
	return 'recommend';
}

function createInitialFeedFilterState(initialMode: string): ContentFilterState {
	const base = createDefaultFilterState();
	if (initialMode === 'follow') {
		base.sort = getSavedFollowSort() || DEFAULT_FOLLOW_SORT;
	}
	return base;
}

class CatalogFeedStore {
	private readonly initialMode = readInitialFeedMode();
	feedMode = $state<string>(this.initialMode);
	searchQuery = $state('');
	debouncedQuery = $state('');
	filterState = $state<ContentFilterState>(createInitialFeedFilterState(this.initialMode));
	activeCategory = $state<CatalogCategoryKey | null>(null);
	headerCategory = $state<CatalogCategoryKey | null>(null);
	refreshTick = $state(0);
	private categoryRoutes = $state<Record<CatalogCategoryKey, string>>({
		artist: CATEGORY_BASE_ROUTES.artist,
		concert: CATEGORY_BASE_ROUTES.concert,
		album: CATEGORY_BASE_ROUTES.album,
		goods: CATEGORY_BASE_ROUTES.goods
	});

	private debounceTimer: ReturnType<typeof setTimeout> | undefined;
	private artistSnapshot: ArtistFeedSnapshot | null = null;

	rememberCategoryRoute(pathname?: string | null): void {
		const normalized = normalizePathname(pathname);
		const cat = resolveCatalogCategoryFromPath(normalized);
		if (!cat) return;
		if (this.categoryRoutes[cat] !== normalized) {
			this.categoryRoutes[cat] = normalized;
		}
	}

	getCategoryNavHref(baseRoute: string, currentPathname?: string | null): string {
		const normalizedBase = normalizePathname(baseRoute);
		const targetCat = resolveCatalogCategoryFromPath(normalizedBase);
		if (!targetCat) return normalizedBase;
		const currentCat = resolveCatalogCategoryFromPath(currentPathname);
		// 이미 같은 카테고리(예: 상세 페이지)에 있는 상태에서 해당 탭을 누르면 카테고리 목록으로 복귀
		if (currentCat === targetCat) {
			return normalizedBase;
		}
		return this.categoryRoutes[targetCat] || normalizedBase;
	}

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

	saveArtistSnapshot(snapshot: ArtistFeedSnapshot): void {
		this.artistSnapshot = {
			...snapshot,
			artists: [...snapshot.artists]
		};
	}

	getArtistSnapshot(): ArtistFeedSnapshot | null {
		return this.artistSnapshot;
	}

	clearArtistSnapshot(): void {
		this.artistSnapshot = null;
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
