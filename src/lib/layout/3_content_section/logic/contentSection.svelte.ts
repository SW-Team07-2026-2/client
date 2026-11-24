import { getContext, setContext } from 'svelte';
import {
	ALBUM_FORM_OPTIONS,
	ARTIST_GENDER_OPTIONS,
	ARTIST_TYPE_OPTIONS,
	CONCERT_REGION_OPTIONS,
	CONCERT_STATUS_OPTIONS,
	CONCERT_TYPE_OPTIONS,
	DEFAULT_FOLLOW_SORT,
	FOLLOW_SORT_OPTIONS,
	GENRES,
	GOODS_FORM_OPTIONS,
	cloneContentFilterState,
	countActiveFilters,
	createEmptyFilterSlice,
	type ContentFilterState,
	type FilterOption
} from '#lib/common/type/filterOptions';
import {
	clearSavedCategoryFilter,
	getSavedCategorySlice,
	getSavedFollowSort,
	saveCategoryFilter,
	saveFollowSort
} from './contentFilterStorage';
import { catalogFeed } from '#lib/common/logic';
import type { SegmentOption } from '#lib/common/design/fluid/FdSegmentedControl.svelte';
import type { MainSectionKey } from '../../2_main_section/logic/sectionRegistry';

export type FilterableCategoryKey = Exclude<MainSectionKey, 'mypage'>;

export const SEARCH_QUERY_MAX_LENGTH = 50;

export const FEED_SEGMENT_ITEMS: SegmentOption[] = [
	{ value: 'recommend', label: '추천' },
	{ value: 'popular', label: '인기' },
	{ value: 'follow', label: '팔로우' }
];

export const FEED_MERGE_OPTION: SegmentOption = {
	value: 'all',
	label: '전체'
};

export const FILTER_STORAGE_KEY_MAP: Record<
	FilterableCategoryKey,
	'Artist' | 'Concert' | 'Album' | 'Merchandise'
> = {
	artist: 'Artist',
	concert: 'Concert',
	album: 'Album',
	goods: 'Merchandise'
};

export const CATEGORY_FILTER_OPTIONS = {
	genres: GENRES as readonly FilterOption[],
	artistGenders: ARTIST_GENDER_OPTIONS,
	artistTypes: ARTIST_TYPE_OPTIONS,
	concertRegions: CONCERT_REGION_OPTIONS,
	concertStatuses: CONCERT_STATUS_OPTIONS,
	concertTypes: CONCERT_TYPE_OPTIONS,
	albumForms: ALBUM_FORM_OPTIONS,
	goodsForms: GOODS_FORM_OPTIONS,
	followSorts: FOLLOW_SORT_OPTIONS
} as const;

export function isFilterableCategory(key: MainSectionKey | null): key is FilterableCategoryKey {
	return key === 'artist' || key === 'concert' || key === 'album' || key === 'goods';
}

function loadInitialFilter(key: FilterableCategoryKey, sort: string): ContentFilterState {
	return {
		...getSavedCategorySlice(FILTER_STORAGE_KEY_MAP[key]),
		sort
	};
}

/**
 * 3_content_section 통합 로직 컨트롤러
 * - PC/모바일 공통으로 검색어, 피드 탭, 카테고리별 필터 상태 + localStorage 영속화,
 *   필터 열림/닫힘, 새로고침 트리거를 관리합니다.
 * - design/ 컴포넌트들은 이 컨트롤러가 내려주는 순수 데이터와 콜백만 받아 렌더링합니다.
 */
export class ContentSectionController {
	searchQuery = $state('');
	feedMode = $state<string>(catalogFeed.feedMode);
	filterOpen = $state(false);
	refreshTick = $state(0);

	private filters = $state<Record<FilterableCategoryKey, ContentFilterState>>({
		artist: loadInitialFilter('artist', catalogFeed.filterState.sort),
		concert: loadInitialFilter('concert', catalogFeed.filterState.sort),
		album: loadInitialFilter('album', catalogFeed.filterState.sort),
		goods: loadInitialFilter('goods', catalogFeed.filterState.sort)
	});

	get isSearchActive(): boolean {
		return this.searchQuery.trim().length > 0;
	}

	get isFollowMode(): boolean {
		return this.feedMode === 'follow';
	}

	isFilterOpen(key: MainSectionKey | null): boolean {
		if (!isFilterableCategory(key)) return false;
		return this.filterOpen;
	}

	getFilterState(key: MainSectionKey | null): ContentFilterState {
		if (!isFilterableCategory(key)) {
			return { ...createEmptyFilterSlice(), sort: '' };
		}
		return this.filters[key];
	}

	getActiveFilterCount(key: MainSectionKey | null): number {
		if (!isFilterableCategory(key)) return 0;
		return countActiveFilters(this.filters[key]);
	}

	hasActiveFilters(key: MainSectionKey | null): boolean {
		return this.getActiveFilterCount(key) > 0;
	}

	toggleFilter = (key: MainSectionKey | null): void => {
		if (!isFilterableCategory(key)) return;
		this.filterOpen = !this.filterOpen;
	};

	setFilterOpen = (key: MainSectionKey | null, open: boolean): void => {
		if (!isFilterableCategory(key)) return;
		this.filterOpen = open;
	};

	setSearchQuery = (next: string): void => {
		const clamped = next.slice(0, SEARCH_QUERY_MAX_LENGTH);
		this.searchQuery = clamped;
		catalogFeed.searchQuery = clamped;
		catalogFeed.syncSearchQuery(clamped);
	};

	submitSearch = (value: string | number): void => {
		const text = String(value ?? '').slice(0, SEARCH_QUERY_MAX_LENGTH);
		this.searchQuery = text;
		catalogFeed.searchQuery = text;
		catalogFeed.debouncedQuery = text.trim();
	};

	setFeedMode = (nextMode: string): void => {
		this.feedMode = nextMode;
		catalogFeed.feedMode = nextMode;

		const nextSort =
			nextMode === 'follow'
				? catalogFeed.filterState.sort || getSavedFollowSort() || DEFAULT_FOLLOW_SORT
				: '';

		for (const key of ['artist', 'concert', 'album', 'goods'] as const) {
			if (this.filters[key].sort !== nextSort) {
				this.filters[key] = { ...this.filters[key], sort: nextSort };
			}
		}
		catalogFeed.filterState = { ...catalogFeed.filterState, sort: nextSort };
	};

	updateCategoryFilter = (key: MainSectionKey | null, next: ContentFilterState): void => {
		if (!isFilterableCategory(key)) return;
		const cloned = cloneContentFilterState(next);
		this.filters[key] = cloned;
		saveCategoryFilter(FILTER_STORAGE_KEY_MAP[key], cloned);
		if (cloned.sort) {
			saveFollowSort(cloned.sort);
			for (const other of ['artist', 'concert', 'album', 'goods'] as const) {
				if (other !== key && this.filters[other].sort !== cloned.sort) {
					this.filters[other] = { ...this.filters[other], sort: cloned.sort };
				}
			}
		}
		catalogFeed.filterState = cloneContentFilterState(cloned);
	};

	resetCategoryFilter = (key: MainSectionKey | null): void => {
		if (!isFilterableCategory(key)) return;
		clearSavedCategoryFilter(FILTER_STORAGE_KEY_MAP[key]);
		const keepSort = this.isFollowMode ? this.filters[key].sort || DEFAULT_FOLLOW_SORT : '';
		const resetState: ContentFilterState = {
			...createEmptyFilterSlice(),
			sort: keepSort
		};
		this.filters[key] = resetState;
		catalogFeed.filterState = cloneContentFilterState(resetState);
	};

	syncActiveCategoryToFeed = (key: MainSectionKey | null): void => {
		if (!isFilterableCategory(key)) return;
		catalogFeed.activeCategory = key;
		catalogFeed.headerCategory = key;
		catalogFeed.filterState = cloneContentFilterState(this.filters[key]);
	};

	triggerRefresh = (): void => {
		this.refreshTick += 1;
		catalogFeed.triggerRefresh();
	};
}

const CONTENT_SECTION_CTX_KEY = Symbol('indig.contentSection');

export function setContentSectionContext(ctrl: ContentSectionController): void {
	setContext(CONTENT_SECTION_CTX_KEY, ctrl);
}

export function getContentSectionContext(): ContentSectionController | undefined {
	return getContext<ContentSectionController | undefined>(CONTENT_SECTION_CTX_KEY);
}
