import { FluidSetting } from '#lib/fluid/setting';

export interface FilterOption {
	value: string;
	label: string;
	/** 도 단위(테두리 강조) 칩 여부 */
	isProvince?: boolean;
	/** 옵션 그룹 키 (그룹 변경 지점에 세로 구분선 표시) */
	group?: string;
}

export const DEFAULT_PRICE_MIN = 0;
export const DEFAULT_PRICE_MAX = 150000;
export const DEFAULT_PRICE_STEP = 5000;

export interface ContentFilterState {
	genres: string[];
	artistGenders: string[];
	artistTypes: string[];
	regions: string[];
	statuses: string[];
	concertTypes: string[];
	forms: string[];
	priceRange: [number, number] | null;
	excludeSoldOut: boolean;
	sort: string;
}

export const DEFAULT_FOLLOW_SORT = 'RECENT_FOLLOW';

export function createDefaultFilterState(): ContentFilterState {
	return {
		genres: [],
		artistGenders: [],
		artistTypes: [],
		regions: [],
		statuses: [],
		concertTypes: [],
		forms: [],
		priceRange: null,
		excludeSoldOut: false,
		sort: ''
	};
}

export function countActiveFilters(state: Partial<ContentFilterState>): number {
	return (
		(state.genres?.length ?? 0) +
		(state.artistGenders?.length ?? 0) +
		(state.artistTypes?.length ?? 0) +
		(state.regions?.length ?? 0) +
		(state.statuses?.length ?? 0) +
		(state.concertTypes?.length ?? 0) +
		(state.forms?.length ?? 0) +
		(state.priceRange !== undefined && state.priceRange !== null ? 1 : 0) +
		(state.excludeSoldOut ? 1 : 0)
	);
}

export type CategoryFilterSlice = Omit<ContentFilterState, 'sort'>;

const categoryFilterMemory = new Map<string, CategoryFilterSlice>();

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

export function createEmptyFilterSlice(): CategoryFilterSlice {
	return {
		genres: [],
		artistGenders: [],
		artistTypes: [],
		regions: [],
		statuses: [],
		concertTypes: [],
		forms: [],
		priceRange: null,
		excludeSoldOut: false
	};
}

function stringArraysEqual(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

function slicesEqual(a: CategoryFilterSlice, b: CategoryFilterSlice): boolean {
	return (
		stringArraysEqual(a.genres, b.genres) &&
		stringArraysEqual(a.artistGenders ?? [], b.artistGenders ?? []) &&
		stringArraysEqual(a.artistTypes ?? [], b.artistTypes ?? []) &&
		stringArraysEqual(a.regions, b.regions) &&
		stringArraysEqual(a.statuses, b.statuses) &&
		stringArraysEqual(a.concertTypes, b.concertTypes) &&
		stringArraysEqual(a.forms, b.forms) &&
		((a.priceRange === null && b.priceRange === null) ||
			(a.priceRange !== null &&
				b.priceRange !== null &&
				a.priceRange[0] === b.priceRange[0] &&
				a.priceRange[1] === b.priceRange[1])) &&
		Boolean(a.excludeSoldOut) === Boolean(b.excludeSoldOut)
	);
}

export function getSavedCategorySlice(category: string): CategoryFilterSlice {
	const saved = categoryFilterMemory.get(category);
	return saved ? cloneSlice(saved) : createEmptyFilterSlice();
}

export function cloneContentFilterState(
	state: Partial<ContentFilterState> = {}
): ContentFilterState {
	return {
		genres: state.genres ? [...state.genres] : [],
		artistGenders: state.artistGenders ? [...state.artistGenders] : [],
		artistTypes: state.artistTypes ? [...state.artistTypes] : [],
		regions: state.regions ? [...state.regions] : [],
		statuses: state.statuses ? [...state.statuses] : [],
		concertTypes: state.concertTypes ? [...state.concertTypes] : [],
		forms: state.forms ? [...state.forms] : [],
		priceRange: state.priceRange ? [state.priceRange[0], state.priceRange[1]] : null,
		excludeSoldOut: Boolean(state.excludeSoldOut),
		sort: state.sort ?? ''
	};
}

export function saveCategoryFilter(
	category: string,
	state: CategoryFilterSlice | ContentFilterState
): void {
	categoryFilterMemory.set(category, cloneSlice(state));
}

export function clearSavedCategoryFilter(category: string): void {
	categoryFilterMemory.set(category, createEmptyFilterSlice());
}

/**
 * 저장된 카테고리 필터를 현재 상태와 비교해 변경이 필요한 경우에만 다음 상태를 반환합니다.
 * 팔로우 정렬(`sort`)은 카테고리 전환 시에도 통합 유지됩니다.
 */
export function restoreCategoryFilterState(
	targetCategory: string,
	currentState: ContentFilterState,
	initIfMissing = false
): { nextState: ContentFilterState; genresChanged: boolean } | null {
	const saved = categoryFilterMemory.get(targetCategory);
	if (!saved && initIfMissing) {
		saveCategoryFilter(targetCategory, currentState);
		return null;
	}
	const restored = saved ? cloneSlice(saved) : cloneSlice(createDefaultFilterState());
	if (slicesEqual(currentState, restored)) return null;

	return {
		nextState: { ...restored, sort: currentState.sort },
		genresChanged: !stringArraysEqual(currentState.genres, restored.genres)
	};
}

/** 세그먼트 '팔로우' 선택 시 정렬 기준 (기본값: 최근 팔로우순) */
export const FOLLOW_SORT_OPTIONS: readonly FilterOption[] = [
	{ value: 'RECENT_FOLLOW', label: '최근 팔로우순' },
	{ value: 'FOLLOWERS', label: '팔로워순' },
	{ value: 'UPDATED', label: '업데이트순' }
];

/** 아티스트 성별 필터 (남자 / 여자 / 혼성) */
export const ARTIST_GENDER_OPTIONS: readonly FilterOption[] = [
	{ value: 'MALE', label: '남자' },
	{ value: 'FEMALE', label: '여자' },
	{ value: 'MIXED', label: '혼성' }
];

/** 아티스트 구성 필터 (솔로 / 팀) */
export const ARTIST_TYPE_OPTIONS: readonly FilterOption[] = [
	{ value: 'SOLO', label: '솔로' },
	{ value: 'TEAM', label: '팀' }
];

/** 공연 지역 필터 (권역별 그룹핑: 도 단위 우선 배치 + 소속 광역/특별시) */
export const CONCERT_REGION_OPTIONS: readonly FilterOption[] = [
	{ value: 'GYEONGGI', label: '경기', isProvince: true, group: 'capital' },
	{ value: 'SEOUL', label: '서울', group: 'capital' },
	{ value: 'INCHEON', label: '인천', group: 'capital' },
	{ value: 'GANGWON', label: '강원', isProvince: true, group: 'gangwon' },
	{ value: 'CHUNGBUK', label: '충북', isProvince: true, group: 'chungcheong' },
	{ value: 'CHUNGNAM', label: '충남', isProvince: true, group: 'chungcheong' },
	{ value: 'DAEJEON', label: '대전', group: 'chungcheong' },
	{ value: 'SEJONG', label: '세종', group: 'chungcheong' },
	{ value: 'JEONBUK', label: '전북', isProvince: true, group: 'jeolla' },
	{ value: 'JEONNAM', label: '전남', isProvince: true, group: 'jeolla' },
	{ value: 'GWANGJU', label: '광주', group: 'jeolla' },
	{ value: 'GYEONGBUK', label: '경북', isProvince: true, group: 'gyeongsang' },
	{ value: 'GYEONGNAM', label: '경남', isProvince: true, group: 'gyeongsang' },
	{ value: 'BUSAN', label: '부산', group: 'gyeongsang' },
	{ value: 'DAEGU', label: '대구', group: 'gyeongsang' },
	{ value: 'ULSAN', label: '울산', group: 'gyeongsang' },
	{ value: 'JEJU', label: '제주', isProvince: true, group: 'jeju' }
];

/** 공연 진행 현황 필터 (판매전 / 판매중 / 판매끝) */
export const CONCERT_STATUS_OPTIONS: readonly FilterOption[] = [
	{ value: 'SCHEDULED', label: '판매전' },
	{ value: 'ON_SALE', label: '판매중' },
	{ value: 'CLOSED', label: '판매종료' }
];

/** 공연 유형 필터 (단독 / 페스티벌) */
export const CONCERT_TYPE_OPTIONS: readonly FilterOption[] = [
	{ value: 'SOLO', label: '단독' },
	{ value: 'FESTIVAL', label: '페스티벌' }
];

/** 앨범 형태 필터 (LP / CD / 카세트) */
export const ALBUM_FORM_OPTIONS: readonly FilterOption[] = [
	{ value: 'LP', label: 'LP' },
	{ value: 'CD', label: 'CD' },
	{ value: 'CASSETTE', label: '카세트' }
];

/** 굿즈 형태 필터 (TSHIRT, OUTER, KEYRING, PICK, MUFFLER, SCARF, BAG, HAT, ETC) */
export const GOODS_FORM_OPTIONS: readonly FilterOption[] = [
	{ value: 'TSHIRT', label: '티셔츠' },
	{ value: 'OUTER', label: '아우터' },
	{ value: 'KEYRING', label: '키링' },
	{ value: 'PICK', label: '피크' },
	{ value: 'MUFFLER', label: '머플러' },
	{ value: 'SCARF', label: '스카프' },
	{ value: 'BAG', label: '가방' },
	{ value: 'HAT', label: '모자' },
	{ value: 'ETC', label: '기타' }
];

/** 필터 칩(FdCheckButton) 공통 유체 스타일 설정 */
export const FILTER_CHIP_BASE_SETTING = new FluidSetting({
	radius: 999,
	reach: 28,
	bulge: 5,
	bulgeWidth: 18,
	layers: 2,
	layerGap: 2.2,
	waveAmp: 2.2,
	waveLength: 60,
	spin: 1.0,
	inset: 7
});

export const FILTER_CHIP_ACTIVE_SETTING = {
	layerGap: 2.5,
	waveAmp: 2.6,
	waveLength: 60,
	spin: 1.35
} as const;

export const FILTER_CHIP_STYLE_PROPS = {
	class: 'content-filter-chip',
	setting: FILTER_CHIP_BASE_SETTING,
	activeSetting: FILTER_CHIP_ACTIVE_SETTING,
	color: 'var(--surface-3)',
	hoverColor: 'var(--surface-4)',
	pressColor: 'var(--line)',
	waveColor: 'var(--surface-4)',
	textColor: 'var(--muted)',
	borderWidth: 0,
	activeColor: 'var(--white-2)',
	activeHoverColor: 'var(--white)',
	activePressColor: 'var(--white-3)',
	activeWaveColor: 'var(--white-3)',
	activeTextColor: 'var(--bg)',
	activeBorderWidth: 0
} as const;

/** 도 단위 필터 칩 스타일 (외곽 테두리 강조) */
export const FILTER_PROVINCE_CHIP_STYLE_PROPS = {
	...FILTER_CHIP_STYLE_PROPS,
	class: 'content-filter-chip is-province',
	color: 'var(--surface-dim)',
	hoverColor: 'var(--surface-3)',
	pressColor: 'var(--surface-4)',
	waveColor: 'var(--line-wave)',
	textColor: 'var(--fg)',
	borderWidth: 1,
	borderColor: 'var(--line)',
	hoverBorderColor: 'var(--muted)',
	pressBorderColor: 'var(--muted)',
	activeBorderWidth: 1,
	activeBorderColor: 'var(--white-2)',
	activeHoverBorderColor: 'var(--white)',
	activePressBorderColor: 'var(--white-3)'
} as const;
