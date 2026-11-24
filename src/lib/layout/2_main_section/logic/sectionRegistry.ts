export type MainSectionKey = 'artist' | 'concert' | 'album' | 'goods' | 'mypage';

export interface MainSectionDescriptor {
	/** 섹션 고유 키 */
	key: MainSectionKey;
	/** 기본 경로 */
	href: `/${MainSectionKey}`;
	/** SvelteKit 라우트 ID (preloadCode 용) */
	routeId: `/(user)/${MainSectionKey}`;
	/** 네비게이션 라벨 */
	label: string;
	/** 브라우저 문서 타이틀 */
	documentTitle: string;
	/** PC 콘텐츠 헤더 타이틀 */
	title: string;
	/** PC 콘텐츠 헤더 영문 라벨 */
	englishTitle: string;
	/** PC 콘텐츠 헤더 부설명 */
	description: string;
	/** 검색창 플레이스홀더 (supportsOptions === true 일 때 사용) */
	searchPlaceholder?: string;
	/** 검색 · 필터 · 피드탭 옵션 영역 활성화 여부 (mypage는 false) */
	supportsOptions: boolean;
	/** 상세 페이지(하위 경로 /[id]) 지원 여부 */
	supportsDetail: boolean;
}

/**
 * 메인 레이아웃(2_main_section)의 모든 카테고리 섹션 단일 레지스트리.
 * 새 카테고리를 추가할 때 이 배열에 항목만 추가하면
 * Keep-Alive, 좌우 슬라이드 순서, 모바일 스와이프, 스크롤 기억/복원이 자동 연동됩니다.
 */
export const MAIN_SECTIONS: readonly MainSectionDescriptor[] = [
	{
		key: 'artist',
		href: '/artist',
		routeId: '/(user)/artist',
		label: '아티스트',
		documentTitle: 'INDIG - 아티스트',
		title: 'Artist',
		englishTitle: 'ARTIST',
		description: '인디 씬의 개성 넘치는 아티스트와 추천 피드를 만나보세요.',
		searchPlaceholder: '아티스트를 검색하세요...',
		supportsOptions: true,
		supportsDetail: true
	},
	{
		key: 'concert',
		href: '/concert',
		routeId: '/(user)/concert',
		label: '공연',
		documentTitle: 'INDIG - 공연',
		title: 'Concert',
		englishTitle: 'CONCERT',
		description: '라이브 공연과 페스티벌 일정 및 예매 정보를 확인하세요.',
		searchPlaceholder: '공연을 검색하세요...',
		supportsOptions: true,
		supportsDetail: true
	},
	{
		key: 'album',
		href: '/album',
		routeId: '/(user)/album',
		label: '음반∙LP',
		documentTitle: 'INDIG - 음반∙LP',
		title: 'Album',
		englishTitle: 'ALBUM & VINYL',
		description: '인디 음반 및 한정판 바이닐(LP) 발매와 재고 현황을 확인하세요.',
		searchPlaceholder: '앨범을 검색하세요...',
		supportsOptions: true,
		supportsDetail: true
	},
	{
		key: 'goods',
		href: '/goods',
		routeId: '/(user)/goods',
		label: '굿즈',
		documentTitle: 'INDIG - 굿즈',
		title: 'Merchandise',
		englishTitle: 'MERCHANDISE',
		description: '아티스트 공식 굿즈와 한정 머천다이즈를 둘러보세요.',
		searchPlaceholder: '굿즈를 검색하세요...',
		supportsOptions: true,
		supportsDetail: true
	},
	{
		key: 'mypage',
		href: '/mypage',
		routeId: '/(user)/mypage',
		label: '마이페이지',
		documentTitle: 'INDIG - 마이페이지',
		title: 'My Page',
		englishTitle: 'MY PAGE',
		description: '관심 아티스트, 위시리스트, 예매 내역 및 계정 설정을 관리하세요.',
		supportsOptions: false,
		supportsDetail: false
	}
] as const;

export const MAIN_SECTION_KEYS: readonly MainSectionKey[] = MAIN_SECTIONS.map((s) => s.key);

const SECTION_MAP: Record<MainSectionKey, MainSectionDescriptor> = Object.fromEntries(
	MAIN_SECTIONS.map((s) => [s.key, s])
) as Record<MainSectionKey, MainSectionDescriptor>;

export function getMainSection(key: MainSectionKey): MainSectionDescriptor {
	return SECTION_MAP[key];
}

export function resolveMainSectionKey(pathname?: string | null): MainSectionKey | null {
	if (!pathname) return null;
	const clean = pathname.replace(/\/+$/, '') || '/';
	for (const sec of MAIN_SECTIONS) {
		if (clean === sec.href || clean.startsWith(`${sec.href}/`)) {
			return sec.key;
		}
	}
	return null;
}

export function resolveMainSectionIndex(pathname?: string | null): number {
	const key = resolveMainSectionKey(pathname);
	return key ? MAIN_SECTION_KEYS.indexOf(key) : -1;
}

export function parseMainSectionDetailId(pathname?: string | null): number | null {
	if (!pathname) return null;
	const clean = pathname.replace(/\/+$/, '');
	const match = clean.match(/^\/(artist|concert|album|goods)\/(\d+)$/);
	if (!match) return null;
	const id = Number.parseInt(match[2], 10);
	return Number.isFinite(id) ? id : null;
}
