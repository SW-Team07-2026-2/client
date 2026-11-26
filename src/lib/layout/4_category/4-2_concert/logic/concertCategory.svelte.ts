import { goto } from '$app/navigation';
import { api } from '#lib/auth/auth.svelte';
import {
	mapConcertSummary,
	type CatalogConcert,
	type ConcertSummaryDto
} from '#lib/common/catalog/concerts';
import { countActiveFilters } from '#lib/common/type/filterOptions';
import { catalogFeed, isCatalogCategoryReady } from '#lib/common/logic';
import { CatalogFeedController } from '../../_shared/logic/catalogFeedController.svelte';
import { concertDetailState } from './concertDetailState.svelte';

export type ConcertViewMode = 'grid' | 'calendar';

export interface ConcertSelectPayload {
	concert: CatalogConcert;
}

export interface ConcertCalendarDay {
	date: string;
	concerts: CatalogConcert[];
}

interface ConcertCalendarDayDto {
	date: string;
	concerts?: ConcertSummaryDto[] | null;
}

interface ConcertCalendarResponseDto {
	month?: string;
	days?: ConcertCalendarDayDto[] | null;
}

function getCurrentMonthKey(): string {
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, '0');
	return `${y}-${m}`;
}

function shiftMonthKey(monthKey: string, delta: number): string {
	const [yStr, mStr] = monthKey.split('-');
	const y = Number(yStr);
	const m = Number(mStr);
	if (!Number.isFinite(y) || !Number.isFinite(m)) return getCurrentMonthKey();
	const d = new Date(y, m - 1 + delta, 1);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 4-2_concert(공연) 카테고리 전용 컨트롤러
 * - 공연 목록 피드(CatalogFeedController) + 월별 달력 조회(`GET /api/concerts/calendar`) + 상세 이동 전담
 */
export class ConcertCategoryController {
	readonly feed: CatalogFeedController<CatalogConcert, ConcertSummaryDto>;

	viewMode = $state<ConcertViewMode>('grid');
	calendarMonth = $state<string>(getCurrentMonthKey());
	calendarDays = $state<ConcertCalendarDay[]>([]);
	calendarLoading = $state(false);
	calendarError = $state<string | null>(null);
	selectedCalendarDate = $state<string | null>(null);

	private calendarCache = new Map<string, ConcertCalendarDay[]>();
	private calendarLoadToken = 0;

	constructor() {
		this.feed = new CatalogFeedController<CatalogConcert, ConcertSummaryDto>({
			category: 'concert',
			entityLabel: '공연',
			mapItem: mapConcertSummary,
			onPageLoaded: () => {
				concertDetailState.cacheConcertList(this.feed.items);
			}
		});
	}

	get emptyTitle(): string {
		const mode = catalogFeed.resolvedFeedMode;
		const query = catalogFeed.debouncedQuery.trim();
		const hasFilters = this.hasActiveFilters;

		if (mode === 'follow') {
			return query || hasFilters
				? '조건에 맞는 팔로우 아티스트의 공연이 없습니다'
				: '팔로우한 아티스트의 예정된 공연이 없습니다';
		}
		if (query) return `'${query}'에 대한 공연이 없습니다`;
		if (hasFilters) return '선택한 조건에 맞는 공연이 없습니다';
		return '등록된 공연이 없습니다';
	}

	get emptyDescription(): string {
		const mode = catalogFeed.resolvedFeedMode;
		const query = catalogFeed.debouncedQuery.trim();

		if (query || this.hasActiveFilters) {
			return '검색어 또는 지역·장르·예매 상태 필터를 다시 확인해 보세요.';
		}
		if (mode === 'follow') {
			return '관심 있는 아티스트를 팔로우하면 공연 일정을 이곳에서 모아볼 수 있습니다.';
		}
		return '새로운 인디 공연 일정이 등록되면 이곳에서 확인하실 수 있습니다.';
	}

	private get hasActiveFilters(): boolean {
		return (
			countActiveFilters({
				genres: catalogFeed.filterState.genres,
				regions: catalogFeed.filterState.regions,
				statuses: catalogFeed.filterState.statuses,
				concertTypes: catalogFeed.filterState.concertTypes,
				forms: [],
				priceRange: null,
				excludeSoldOut: false,
				sort: ''
			}) > 0
		);
	}

	/** 상위 섹션 활성 상태 및 검색/필터/피드 파라미터 동기화 */
	sync = (active: boolean): void => {
		const canSync = active && isCatalogCategoryReady('concert', true);
		this.feed.sync(canSync, {
			feedMode: catalogFeed.resolvedFeedMode,
			query: catalogFeed.debouncedQuery,
			filterState: catalogFeed.filterState,
			refreshTick: catalogFeed.refreshTick
		});

		if (canSync && this.viewMode === 'calendar') {
			void this.loadCalendarMonth(this.calendarMonth);
		}
	};

	setViewMode = (mode: ConcertViewMode): void => {
		if (this.viewMode === mode) return;
		this.viewMode = mode;
		if (mode === 'calendar') {
			void this.loadCalendarMonth(this.calendarMonth);
		}
	};

	stepCalendarMonth = (delta: number): void => {
		const next = shiftMonthKey(this.calendarMonth, delta);
		this.calendarMonth = next;
		this.selectedCalendarDate = null;
		void this.loadCalendarMonth(next);
	};

	selectCalendarDate = (date: string | null): void => {
		this.selectedCalendarDate = this.selectedCalendarDate === date ? null : date;
	};

	selectConcert = (payload: ConcertSelectPayload): void => {
		concertDetailState.cacheConcert(payload.concert);
		void goto(`/concert/${payload.concert.id}`, { reset: false });
	};

	private async loadCalendarMonth(month: string): Promise<void> {
		const cached = this.calendarCache.get(month);
		if (cached) {
			this.calendarDays = cached;
			this.calendarError = null;
			return;
		}

		const token = ++this.calendarLoadToken;
		this.calendarLoading = true;
		this.calendarError = null;

		try {
			const res = await api<ConcertCalendarResponseDto>(
				`/api/concerts/calendar?month=${encodeURIComponent(month)}`
			);
			if (token !== this.calendarLoadToken) return;

			const days: ConcertCalendarDay[] = Array.isArray(res?.days)
				? res.days.map((d) => {
						const mapped = Array.isArray(d.concerts) ? d.concerts.map(mapConcertSummary) : [];
						concertDetailState.cacheConcertList(mapped);
						return { date: d.date, concerts: mapped };
					})
				: [];

			this.calendarCache.set(month, days);
			this.calendarDays = days;
		} catch (err) {
			if (token !== this.calendarLoadToken) return;
			console.error('Failed to load concert calendar:', err);
			this.calendarError = '공연 일정을 불러오지 못했습니다.';
			this.calendarDays = [];
		} finally {
			if (token === this.calendarLoadToken) {
				this.calendarLoading = false;
			}
		}
	}
}
