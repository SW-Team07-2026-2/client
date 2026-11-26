/**
 * 카탈로그 필터 옵션·도메인 Enum 코드/라벨·필터 상태 타입 모음
 */

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
export const DEFAULT_FOLLOW_SORT = 'RECENT_FOLLOW';

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

export type CategoryFilterSlice = Omit<ContentFilterState, 'sort'>;

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

export function createDefaultFilterState(): ContentFilterState {
	return {
		...createEmptyFilterSlice(),
		sort: ''
	};
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

/**
 * 백엔드 공식 Genre Enum (catalog · concert 공통 · 23개)
 * - API 파라미터 전송 시 `value`(Enum 코드), 화면 표시 시 `label`(한국어) 사용
 */
export const GENRES = [
	{ value: 'INDIE_ROCK', label: '인디 록' },
	{ value: 'ALTERNATIVE', label: '얼터너티브' },
	{ value: 'GARAGE', label: '개러지' },
	{ value: 'PUNK', label: '펑크' },
	{ value: 'HARDCORE', label: '하드코어' },
	{ value: 'EMO', label: '이모' },
	{ value: 'METAL', label: '메탈' },
	{ value: 'POST_ROCK', label: '포스트 록' },
	{ value: 'SHOEGAZE', label: '슈게이즈' },
	{ value: 'PSYCHEDELIC', label: '사이키델릭' },
	{ value: 'INDIE_POP', label: '인디 팝' },
	{ value: 'DREAM_POP', label: '드림 팝' },
	{ value: 'SYNTH_POP', label: '신스 팝' },
	{ value: 'CITY_POP', label: '시티 팝' },
	{ value: 'FOLK', label: '포크' },
	{ value: 'ELECTRONIC', label: '일렉트로닉' },
	{ value: 'RNB_SOUL', label: 'R&B/소울' },
	{ value: 'HIPHOP', label: '힙합' },
	{ value: 'JAZZ', label: '재즈' },
	{ value: 'BLUES', label: '블루스' },
	{ value: 'FUNK', label: '펑크(Funk)' },
	{ value: 'SKA_REGGAE', label: '스카/레게' },
	{ value: 'ETC', label: '기타' }
] as const;

export type GenreCode = (typeof GENRES)[number]['value'];
export type GenreLabel = (typeof GENRES)[number]['label'];
export type GenreOption = (typeof GENRES)[number];

/** API Enum 값 -> 한국어 라벨 조회 맵 */
export const GENRE_LABELS: Record<GenreCode, GenreLabel> = Object.fromEntries(
	GENRES.map((item) => [item.value, item.label])
) as Record<GenreCode, GenreLabel>;

/** 유효한 Genre Enum 코드인지 확인하는 타입 가드 */
export function isGenreCode(value: string): value is GenreCode {
	return Object.prototype.hasOwnProperty.call(GENRE_LABELS, value);
}

/** Genre Enum 값을 한국어 라벨로 변환 (목록 외 값이면 원본 반환) */
export function getGenreLabel(code: string): string {
	return isGenreCode(code) ? GENRE_LABELS[code] : code;
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

/** 아티스트 구성 필터 (솔로 / 팀 — 백엔드 composition Enum: SOLO | GROUP) */
export const ARTIST_TYPE_OPTIONS: readonly FilterOption[] = [
	{ value: 'SOLO', label: '솔로' },
	{ value: 'GROUP', label: '팀' }
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

/** 공연 진행 현황 필터 (판매전 / 판매중 / 판매종료) */
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

/** 굿즈 종류 필터 (TSHIRT, OUTER, KEYRING, PICK, MUFFLER, SCARF, BAG, HAT, ETC) */
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
