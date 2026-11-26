import { api } from '#lib/auth/auth.svelte';
import {
	DEFAULT_FOLLOW_SORT,
	DEFAULT_PRICE_MAX,
	DEFAULT_PRICE_MIN,
	type ContentFilterState
} from '#lib/common/type/filterOptions';
import { prefersReducedMotion } from '#lib/common/type/spring';
import { FluidSetting } from '#lib/common/type/fluid';

export type CatalogCategoryKey = 'artist' | 'concert' | 'album' | 'goods';
export type CatalogFeedMode = 'recommend' | 'popular' | 'all' | 'follow';

export const CATALOG_TRANSITION_TIMING = {
	contentExitMs: 160,
	skeletonEnterMs: 180,
	skeletonMinMs: 180,
	skeletonExitMs: 130,
	contentEnterMs: 280
} as const;

export interface CatalogPageResult<T> {
	items: T[];
	page: number;
	size: number;
	hasNext: boolean;
	degraded: boolean;
}

export const CATALOG_DEFAULT_PAGE_SIZE = 20;

export const CATALOG_ENDPOINTS: Record<
	CatalogCategoryKey,
	{ search: string; following: string }
> = {
	artist: {
		search: '/api/catalog/search/artists',
		following: '/api/catalog/following/artists'
	},
	concert: {
		search: '/api/concerts/search',
		following: '/api/concerts/following'
	},
	album: {
		search: '/api/catalog/search/physical-albums',
		following: '/api/catalog/following/physical-albums'
	},
	goods: {
		search: '/api/catalog/search/goods',
		following: '/api/catalog/following/goods'
	}
};

export function isCatalogAuthError(err: unknown): boolean {
	if (!err || typeof err !== 'object') return false;
	const anyErr = err as { status?: number; code?: string };
	return anyErr.status === 401 || anyErr.code === 'UNAUTHENTICATED';
}

export function resolveCatalogErrorMessage(err: unknown, entityLabel: string): string {
	if (!err) return `${entityLabel} 목록을 불러오는 중 문제가 발생했습니다.`;
	if (typeof err === 'string') return err;

	const anyErr = err as { status?: number; code?: string; message?: string };
	if (anyErr.status === 401 || anyErr.code === 'UNAUTHENTICATED') {
		return '로그인이 필요한 기능입니다. 로그인 후 이용해 주세요.';
	}
	if (
		anyErr.status === 503 ||
		anyErr.code === 'SERVICE_UNAVAILABLE' ||
		anyErr.code === 'FOLLOW_UNAVAILABLE'
	) {
		return `${entityLabel} 서비스가 일시적으로 원활하지 않습니다. 잠시 후 다시 시도해 주세요.`;
	}
	if (anyErr.status === 400 || anyErr.code === 'INVALID_REQUEST') {
		return '잘못된 요청입니다. 검색 조건을 확인해 주세요.';
	}
	if (anyErr.status === 404) {
		return `요청하신 ${entityLabel} 정보를 찾을 수 없습니다.`;
	}

	const msg = anyErr.message ?? '';
	if (
		msg.includes('fetch') ||
		msg.includes('network') ||
		msg.includes('Failed to fetch') ||
		msg.includes('NetworkError')
	) {
		return '서버와 연결할 수 없습니다. 네트워크 연결 또는 API 서버 상태를 확인해 주세요.';
	}
	return msg || `${entityLabel} 목록을 불러오는 중 오류가 발생했습니다.`;
}

export function formatKrwPrice(price?: number | null): string {
	if (typeof price !== 'number' || !Number.isFinite(price)) return '';
	return `${price.toLocaleString('ko-KR')}원`;
}

export function buildCatalogActionSetting(
	active: boolean,
	waveColor: string
): FluidSetting {
	const compactBase = {
		inset: 6,
		layers: 1,
		layerGap: 2,
		waveAmp: 1.8,
		bulge: 4,
		reach: 24
	};
	if (active) {
		return new FluidSetting({
			...compactBase,
			color: 'var(--surface-3)',
			hoverColor: 'var(--surface-4)',
			pressColor: 'var(--surface-2)',
			waveColor: 'var(--line-wave)',
			borderWidth: 1,
			borderColor: 'var(--line)',
			hoverBorderColor: 'var(--muted)',
			textColor: 'var(--white)'
		});
	}
	return new FluidSetting({
		...compactBase,
		color: 'var(--white)',
		hoverColor: 'var(--white-2)',
		pressColor: 'var(--white-3)',
		waveColor,
		textColor: 'var(--bg)'
	});
}

function appendCommaParam(params: URLSearchParams, key: string, values: string[]): void {
	const cleaned = values.map((v) => v.trim()).filter(Boolean);
	if (cleaned.length > 0) {
		params.set(key, cleaned.join(','));
	}
}

function appendPriceParams(params: URLSearchParams, priceRange: [number, number] | null): void {
	if (!priceRange) return;
	const [rawMin, rawMax] = priceRange;
	const min = Math.max(DEFAULT_PRICE_MIN, Math.round(rawMin));
	const max = Math.min(DEFAULT_PRICE_MAX, Math.round(rawMax));
	if (min <= DEFAULT_PRICE_MIN && max >= DEFAULT_PRICE_MAX) return;
	if (min > DEFAULT_PRICE_MIN) params.set('minPrice', String(min));
	if (max < DEFAULT_PRICE_MAX) params.set('maxPrice', String(max));
}

export function resolveCatalogEndpoint(
	category: CatalogCategoryKey,
	feedMode: CatalogFeedMode = 'all'
): string {
	const target = CATALOG_ENDPOINTS[category];
	return feedMode === 'follow' ? target.following : target.search;
}

export function buildCatalogQueryParams(opts: {
	category: CatalogCategoryKey;
	feedMode?: CatalogFeedMode;
	page: number;
	pageSize?: number;
	query?: string;
	genre?: string;
	filterState?: Partial<ContentFilterState>;
}): URLSearchParams {
	const safeSize = Math.min(50, Math.max(1, opts.pageSize ?? CATALOG_DEFAULT_PAGE_SIZE));
	const params = new URLSearchParams();
	params.set('page', String(Math.max(0, opts.page)));
	params.set('size', String(safeSize));

	const trimmedQuery = opts.query?.trim() ?? '';
	if (trimmedQuery) {
		params.set('q', trimmedQuery);
	}

	const fs = opts.filterState;
	const genres =
		fs?.genres && fs.genres.length > 0
			? fs.genres
			: opts.genre?.trim()
				? [opts.genre.trim()]
				: [];

	if (opts.category === 'artist') {
		appendCommaParam(params, 'genre', genres);
		appendCommaParam(params, 'gender', fs?.artistGenders ?? []);
		appendCommaParam(params, 'composition', fs?.artistTypes ?? []);
	} else if (opts.category === 'concert') {
		appendCommaParam(params, 'saleStatus', fs?.statuses ?? []);
		appendCommaParam(params, 'type', fs?.concertTypes ?? []);
		appendCommaParam(params, 'region', fs?.regions ?? []);
		appendCommaParam(params, 'genre', genres);
	} else if (opts.category === 'album') {
		appendCommaParam(params, 'format', fs?.forms ?? []);
		appendPriceParams(params, fs?.priceRange ?? null);
		if (fs?.excludeSoldOut) {
			params.set('excludeSoldOut', 'true');
		}
	} else if (opts.category === 'goods') {
		appendCommaParam(params, 'category', fs?.forms ?? []);
		appendPriceParams(params, fs?.priceRange ?? null);
		if (fs?.excludeSoldOut) {
			params.set('excludeSoldOut', 'true');
		}
	}

	if (opts.feedMode === 'follow') {
		const sort = fs?.sort?.trim() || DEFAULT_FOLLOW_SORT;
		params.set('sort', sort);
	}

	return params;
}

export async function fetchCatalogPage<T, R = T>(opts: {
	endpoint?: string;
	category?: CatalogCategoryKey;
	feedMode?: CatalogFeedMode;
	page: number;
	pageSize?: number;
	query?: string;
	genre?: string;
	filterState?: Partial<ContentFilterState>;
	mapItem?: (raw: R) => T;
}): Promise<CatalogPageResult<T>> {
	const safeSize = Math.min(50, Math.max(1, opts.pageSize ?? CATALOG_DEFAULT_PAGE_SIZE));
	const endpoint =
		opts.endpoint ??
		resolveCatalogEndpoint(opts.category ?? 'artist', opts.feedMode ?? 'all');

	const params = opts.category
		? buildCatalogQueryParams({
				category: opts.category,
				feedMode: opts.feedMode,
				page: opts.page,
				pageSize: safeSize,
				query: opts.query,
				genre: opts.genre,
				filterState: opts.filterState
			})
		: (() => {
				const p = new URLSearchParams();
				p.set('page', String(Math.max(0, opts.page)));
				p.set('size', String(safeSize));
				if (opts.query?.trim()) p.set('q', opts.query.trim());
				if (opts.genre?.trim()) p.set('genre', opts.genre.trim());
				return p;
			})();

	const res = await api<{
		items?: R[];
		page?: number;
		size?: number;
		hasNext?: boolean;
		degraded?: boolean;
	}>(`${endpoint}?${params.toString()}`);

	const rawItems = Array.isArray(res?.items) ? res.items : [];
	const items = opts.mapItem
		? rawItems.map((item) => opts.mapItem!(item))
		: (rawItems as unknown as T[]);
	const degraded = Boolean(res?.degraded);

	return {
		items,
		page: typeof res?.page === 'number' ? res.page : opts.page,
		size: typeof res?.size === 'number' ? res.size : safeSize,
		hasNext: degraded ? false : Boolean(res?.hasNext),
		degraded
	};
}

/**
 * 필터·검색 재조회 시 기존 콘텐츠가 부드럽게 퇴장하고 최소 로딩 스켈레톤이 노출되도록
 * API 요청과 전환 대기 시간을 병렬로 맞춥니다.
 */
export async function fetchCatalogPageWithTransition<T, R = T>(
	opts: Parameters<typeof fetchCatalogPage<T, R>>[0],
	shouldStageTransition: boolean
): Promise<CatalogPageResult<T>> {
	const minStageMs =
		shouldStageTransition && !prefersReducedMotion()
			? CATALOG_TRANSITION_TIMING.contentExitMs + CATALOG_TRANSITION_TIMING.skeletonMinMs
			: 0;

	if (minStageMs <= 0) {
		return fetchCatalogPage<T, R>(opts);
	}

	const waitStage = new Promise<void>((resolve) => {
		setTimeout(resolve, minStageMs);
	});

	try {
		const [res] = await Promise.all([fetchCatalogPage<T, R>(opts), waitStage]);
		return res;
	} catch (err) {
		await waitStage;
		throw err;
	}
}
