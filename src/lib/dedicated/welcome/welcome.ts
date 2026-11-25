import {
	api,
	auth,
	fetchTermsList,
	type TermsItem,
	type SignupAgreementInput,
	type SignupResult
} from '#lib/auth';

export interface ArtistItem {
	id: string;
	name: string;
	image: string;
	genre?: string;
}

export interface CatalogArtistDto {
	id: number;
	name: string;
	genres?: string[];
	genre?: string | null;
	debutYear?: number;
	profileUrl?: string | null;
}

export interface CatalogArtistPageResult {
	items: ArtistItem[];
	page: number;
	hasNext: boolean;
}

export type { TermsItem, SignupAgreementInput, SignupResult };

/** 웰컴(회원가입 온보딩) URL 단계 */
export type WelcomeStep = 'terms' | 'artists';

/** 약관 항목별 동의 상태 맵 */
export type WelcomeAgreementsMap = Record<number, boolean>;

function mapCatalogDtoToArtistItem(dto: CatalogArtistDto): ArtistItem {
	const genreText =
		Array.isArray(dto.genres) && dto.genres.length > 0
			? dto.genres.join(', ')
			: dto.genre?.trim() || undefined;

	return {
		id: String(dto.id),
		name: dto.name,
		image: dto.profileUrl?.trim() ?? '',
		genre: genreText
	};
}

/**
 * v2 GET /api/catalog/artists 아티스트 목록 조회
 */
export async function loadCatalogArtists(options?: {
	page?: number;
	size?: number;
	q?: string;
}): Promise<CatalogArtistPageResult> {
	const page = options?.page ?? 0;
	const size = options?.size ?? 20;

	const params = new URLSearchParams({
		page: String(page),
		size: String(size)
	});
	if (options?.q && options.q.trim()) {
		params.set('q', options.q.trim());
	}

	const res = await api<{
		items: CatalogArtistDto[];
		page: number;
		size: number;
		hasNext: boolean;
	}>(`/api/catalog/artists?${params.toString()}`);

	const items = Array.isArray(res?.items) ? res.items : [];
	return {
		items: items.map(mapCatalogDtoToArtistItem),
		page: res?.page ?? page,
		hasNext: Boolean(res?.hasNext)
	};
}

/**
 * v2 GET /api/auth/signup — SIGNUP 쿠키 유효성 서버 검증
 */
export async function checkSignupSession(): Promise<'VALID' | 'EXPIRED' | 'UNKNOWN'> {
	try {
		const res = await fetch(`${auth.apiBaseUrl}/api/auth/signup`, {
			method: 'GET',
			credentials: 'include'
		});
		const body = await res.json().catch(() => null);
		auth.captureXsrfFromResponse(res, body);

		if (res.ok) return 'VALID';
		if (res.status === 401) return 'EXPIRED';
		return 'UNKNOWN';
	} catch {
		return 'UNKNOWN';
	}
}

/**
 * M24 GET /api/members/terms 약관 목록 조회
 * - 응답 헤더의 X-XSRF-TOKEN도 api() 래퍼가 자동 캡처
 */
export async function loadWelcomeTerms(): Promise<TermsItem[]> {
	const items = await fetchTermsList();
	return Array.isArray(items) ? items : [];
}

/**
 * 약관 체크 상태 맵을 G13 POST /api/auth/signup 요청 페이로드로 변환
 */
export function buildAgreementPayload(
	termsList: TermsItem[],
	agreements: WelcomeAgreementsMap
): SignupAgreementInput[] {
	return termsList.map((term) => ({
		termsId: term.termsId,
		agreed: Boolean(agreements[term.termsId])
	}));
}

/**
 * 선택된 아티스트 문자열 ID 배열을 G13 요청용 숫자 ID 배열로 변환
 */
export function parseArtistIds(selectedIds: string[]): number[] {
	return selectedIds
		.map((id) => Number(id))
		.filter((num) => Number.isInteger(num) && num > 0);
}

/**
 * G13 POST /api/auth/signup 최종 가입 완료 호출 래퍼
 */
export async function submitWelcomeSignup(
	selectedIds: string[],
	termsList: TermsItem[],
	agreements: WelcomeAgreementsMap
): Promise<SignupResult> {
	const artistIds = parseArtistIds(selectedIds);
	const agreementPayloads = buildAgreementPayload(termsList, agreements);
	return auth.signup(artistIds, agreementPayloads);
}
