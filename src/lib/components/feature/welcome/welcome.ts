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
	/** 해당 아티스트 클릭 시 추가될 연관 아티스트 ID 목록 */
	relatedIds?: string[];
}

export interface CatalogArtistDto {
	id: number;
	name: string;
	genres?: string[];
	debutYear?: number;
	profileUrl?: string | null;
}

export interface CatalogArtistPageResult {
	items: ArtistItem[];
	page: number;
	hasNext: boolean;
	isMock: boolean;
}

export type { TermsItem, SignupAgreementInput, SignupResult };

/** 웰컴(회원가입 온보딩) URL 단계 */
export type WelcomeStep = 'terms' | 'artists';

/** 약관 항목별 동의 상태 맵 */
export type WelcomeAgreementsMap = Record<number, boolean>;

/**
 * UX 껍데기 및 API 실패/오프라인 대비 기본 약관 목업 데이터 (M24 규격 호환)
 */
export const DEFAULT_WELCOME_TERMS: TermsItem[] = [
	{
		termsId: 1,
		code: 'AGE14',
		version: '1.0',
		title: '만 14세 이상입니다',
		content: '본 서비스는 만 14세 이상부터 가입 및 이용이 가능합니다.',
		required: true
	},
	{
		termsId: 2,
		code: 'TOS',
		version: '1.0',
		title: 'INDIG 서비스 이용약관 동의',
		content:
			'제1조 (목적)\n본 약관은 INDIG가 제공하는 인디 밴드 아티스트 정보, 공연 예매, 음반·굿즈 구매 및 AI 큐레이션 서비스의 이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.\n\n제2조 (회원의 의무)\n회원은 관계 법령 및 본 약관의 규정을 준수하여야 합니다.',
		required: true
	},
	{
		termsId: 3,
		code: 'PRIVACY',
		version: '1.0',
		title: '개인정보 수집 및 이용 동의',
		content:
			'1. 수집 항목: 카카오 계정 식별자, 닉네임, 프로필 이미지, 이메일\n2. 수집 목적: 회원 식별, 맞춤형 인디 밴드 추천, 공연 예매 및 주문 처리\n3. 보유 기간: 회원 탈퇴 시까지 (관계 법령에 따라 보존할 필요가 있는 경우 해당 기간까지 보관)',
		required: true
	},
	{
		termsId: 4,
		code: 'MARKETING',
		version: '1.0',
		title: '공연·발매 소식 및 이벤트 알림 수신 동의',
		content:
			'관심 아티스트의 신규 공연 티켓 오픈, 한정판 바이닐(LP) 발매 및 프로모션 소식을 받아보실 수 있습니다. 동의하지 않으셔도 기본 서비스 이용에는 제한이 없습니다.',
		required: false
	}
];

/* ───────── 임시(Mock) 아티스트 배경 아트워크 & 데이터 ───────── */
export function createArtistArtwork(
	bg1: string,
	bg2: string,
	accent: string,
	seed = 1
): string {
	const cx = 65 + ((seed * 29) % 70);
	const cy = 55 + ((seed * 43) % 60);
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 200 200">
		<defs>
			<linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
				<stop offset="0%" stop-color="${bg1}"/>
				<stop offset="100%" stop-color="${bg2}"/>
			</linearGradient>
			<radialGradient id="r" cx="${cx}%" cy="${cy}%" r="75%">
				<stop offset="0%" stop-color="${accent}" stop-opacity="0.58"/>
				<stop offset="100%" stop-color="${bg2}" stop-opacity="0"/>
			</radialGradient>
		</defs>
		<rect width="200" height="200" fill="url(#g)"/>
		<circle cx="100" cy="100" r="100" fill="url(#r)"/>
		<circle cx="100" cy="78" r="26" fill="rgba(255,255,255,0.15)"/>
		<path d="M46 176 C46 130 154 130 154 176" fill="rgba(255,255,255,0.12)"/>
	</svg>`;
	return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const RAW_MOCK_ARTIST_DB: Record<string, ArtistItem> = {
	illit: {
		id: 'illit',
		name: '아일릿',
		genre: 'K-POP',
		image: createArtistArtwork('#3b1f47', '#14131d', '#ff9ebb', 1),
		relatedIds: ['newjeans', 'aespa', 'rescene']
	},
	buzz: {
		id: 'buzz',
		name: '버즈',
		genre: '록 발라드',
		image: createArtistArtwork('#1e293b', '#0f131a', '#60a5fa', 2),
		relatedIds: ['izi', 'mc_the_max', 'yb']
	},
	day6: {
		id: 'day6',
		name: '데이식스',
		genre: '밴드',
		image: createArtistArtwork('#15352f', '#0d1715', '#34d399', 3),
		relatedIds: ['lucy', 'qwer', 'jannabi']
	},
	iu: {
		id: 'iu',
		name: '아이유',
		genre: '솔로/보컬',
		image: createArtistArtwork('#342048', '#14111d', '#c084fc', 4),
		relatedIds: ['taeyeon', 'akmu', 'bol4']
	},
	crush: {
		id: 'crush',
		name: '크러쉬',
		genre: 'R&B/소울',
		image: createArtistArtwork('#362819', '#14110e', '#fbbf24', 5),
		relatedIds: ['dean', 'zico', 'heize']
	},
	blackpink: {
		id: 'blackpink',
		name: '블랙핑크',
		genre: 'K-POP',
		image: createArtistArtwork('#42162b', '#140c11', '#f472b6', 6),
		relatedIds: ['babymonster', 'ive', 'le_sserafim']
	},
	silicagel: {
		id: 'silicagel',
		name: '실리카겔',
		genre: '인디/사이키델릭',
		image: createArtistArtwork('#182e3f', '#0c1117', '#38bdf8', 7),
		relatedIds: ['hyukoh', 'wave_to_earth', 'thornapple']
	},
	sung_si_kyung: {
		id: 'sung_si_kyung',
		name: '성시경',
		genre: '발라드',
		image: createArtistArtwork('#2e2927', '#121010', '#d6d3d1', 8),
		relatedIds: ['park_hyo_shin', 'kim_dong_ryul', 'paul_kim']
	},
	newjeans: {
		id: 'newjeans',
		name: '뉴진스',
		genre: 'K-POP',
		image: createArtistArtwork('#1d314d', '#0d1321', '#74c0fc', 9),
		relatedIds: ['ive', 'le_sserafim', 'kiss_of_life']
	},
	aespa: {
		id: 'aespa',
		name: '에스파',
		genre: 'K-POP',
		image: createArtistArtwork('#2f1f46', '#110d19', '#a78bfa', 10),
		relatedIds: ['ive', 'itzy', 'nmixx']
	},
	rescene: {
		id: 'rescene',
		name: '리센느',
		genre: 'K-POP',
		image: createArtistArtwork('#3d2233', '#140f13', '#f9a8d4', 11),
		relatedIds: ['fifty_fifty', 'triple_s', 'fromis_9']
	},
	ive: {
		id: 'ive',
		name: '아이브',
		genre: 'K-POP',
		image: createArtistArtwork('#421e32', '#140d12', '#fb7185', 12),
		relatedIds: ['le_sserafim', 'stayc', 'fromis_9']
	},
	le_sserafim: {
		id: 'le_sserafim',
		name: '르세라핌',
		genre: 'K-POP',
		image: createArtistArtwork('#252b3b', '#0e1015', '#93c5fd', 13),
		relatedIds: ['kiss_of_life', 'itzy', 'babymonster']
	},
	kiss_of_life: {
		id: 'kiss_of_life',
		name: '키스오브라이프',
		genre: 'K-POP',
		image: createArtistArtwork('#451624', '#170a0e', '#f43f5e', 14),
		relatedIds: ['babymonster', 'nmixx']
	},
	fifty_fifty: {
		id: 'fifty_fifty',
		name: '피프티피프티',
		genre: 'K-POP',
		image: createArtistArtwork('#3d2538', '#151014', '#f0abfc', 15),
		relatedIds: ['triple_s', 'stayc']
	},
	triple_s: {
		id: 'triple_s',
		name: '트리플에스',
		genre: 'K-POP',
		image: createArtistArtwork('#262b36', '#0d0f13', '#cbd5e1', 16),
		relatedIds: ['nmixx', 'fromis_9']
	},
	fromis_9: {
		id: 'fromis_9',
		name: '프로미스나인',
		genre: 'K-POP',
		image: createArtistArtwork('#40242c', '#140d10', '#fda4af', 17),
		relatedIds: ['stayc', 'qwer']
	},
	stayc: {
		id: 'stayc',
		name: '스테이씨',
		genre: 'K-POP',
		image: createArtistArtwork('#3b2142', '#120c14', '#e879f9', 18),
		relatedIds: ['itzy', 'nmixx']
	},
	itzy: {
		id: 'itzy',
		name: '있지',
		genre: 'K-POP',
		image: createArtistArtwork('#421e2b', '#140b0f', '#fb7185', 19),
		relatedIds: ['nmixx', 'babymonster']
	},
	nmixx: {
		id: 'nmixx',
		name: '엔믹스',
		genre: 'K-POP',
		image: createArtistArtwork('#1d3042', '#0d1218', '#67e8f9', 20),
		relatedIds: ['babymonster']
	},
	babymonster: {
		id: 'babymonster',
		name: '베이비몬스터',
		genre: 'K-POP',
		image: createArtistArtwork('#451620', '#14090c', '#f87171', 21),
		relatedIds: ['kiss_of_life', 'itzy']
	},
	izi: {
		id: 'izi',
		name: 'izi',
		genre: '록 발라드',
		image: createArtistArtwork('#282c3b', '#101218', '#94a3b8', 22),
		relatedIds: ['yarn', 'flower', 'mc_the_max']
	},
	mc_the_max: {
		id: 'mc_the_max',
		name: '엠씨더맥스',
		genre: '록 발라드',
		image: createArtistArtwork('#2b2b30', '#111113', '#a1a1aa', 23),
		relatedIds: ['sg_wannabe', 'park_hyo_shin', 'yb']
	},
	yb: {
		id: 'yb',
		name: 'YB',
		genre: '록 밴드',
		image: createArtistArtwork('#3b251a', '#140e0b', '#fb923c', 24),
		relatedIds: ['nell', 'jaurim']
	},
	yarn: {
		id: 'yarn',
		name: '얀',
		genre: '록 발라드',
		image: createArtistArtwork('#272b36', '#0e1014', '#cbd5e1', 25),
		relatedIds: ['flower']
	},
	flower: {
		id: 'flower',
		name: '플라워',
		genre: '록 발라드',
		image: createArtistArtwork('#36242b', '#130e10', '#fda4af', 26),
		relatedIds: ['yarn']
	},
	sg_wannabe: {
		id: 'sg_wannabe',
		name: 'SG워너비',
		genre: '발라드',
		image: createArtistArtwork('#362c20', '#120f0c', '#fcd34d', 27),
		relatedIds: ['davichi']
	},
	lucy: {
		id: 'lucy',
		name: '루시',
		genre: '밴드',
		image: createArtistArtwork('#1b3342', '#0b141a', '#60a5fa', 28),
		relatedIds: ['lacuna', 'touched', 'nerd_connection']
	},
	qwer: {
		id: 'qwer',
		name: 'QWER',
		genre: '밴드',
		image: createArtistArtwork('#3b203e', '#140c16', '#f472b6', 29),
		relatedIds: ['lucy', 'fromis_9', 'woodz']
	},
	jannabi: {
		id: 'jannabi',
		name: '잔나비',
		genre: '인디 밴드',
		image: createArtistArtwork('#3d2c1a', '#14100a', '#fbbf24', 30),
		relatedIds: ['hyukoh', '10cm', 'car_the_garden']
	},
	lacuna: {
		id: 'lacuna',
		name: '라쿠나',
		genre: '밴드',
		image: createArtistArtwork('#2c203f', '#100c17', '#c084fc', 31),
		relatedIds: ['thornapple', 'touched']
	},
	touched: {
		id: 'touched',
		name: '터치드',
		genre: '밴드',
		image: createArtistArtwork('#401d28', '#160b0f', '#fb7185', 32),
		relatedIds: ['nerd_connection', 'nell']
	},
	nerd_connection: {
		id: 'nerd_connection',
		name: '너드커넥션',
		genre: '밴드',
		image: createArtistArtwork('#21303b', '#0d1216', '#7dd3fc', 33),
		relatedIds: ['nell', 'thornapple']
	},
	taeyeon: {
		id: 'taeyeon',
		name: '태연',
		genre: '보컬/K-POP',
		image: createArtistArtwork('#332540', '#120e17', '#d8b4fe', 34),
		relatedIds: ['heize', 'davichi']
	},
	akmu: {
		id: 'akmu',
		name: '악뮤',
		genre: '듀오/포크팝',
		image: createArtistArtwork('#1f382d', '#0c1511', '#6ee7b7', 35),
		relatedIds: ['10cm', 'bol4', 'lee_mu_jin']
	},
	bol4: {
		id: 'bol4',
		name: '볼빨간사춘기',
		genre: '인디 팝',
		image: createArtistArtwork('#402630', '#160d10', '#f9a8d4', 36),
		relatedIds: ['10cm', 'paul_kim']
	},
	'10cm': {
		id: '10cm',
		name: '10CM',
		genre: '인디/어쿠스틱',
		image: createArtistArtwork('#382d20', '#14100c', '#fcd34d', 37),
		relatedIds: ['lee_mu_jin', 'car_the_garden']
	},
	dean: {
		id: 'dean',
		name: '딘',
		genre: 'R&B',
		image: createArtistArtwork('#22283b', '#0c0e14', '#818cf8', 38),
		relatedIds: ['colde', 'zico']
	},
	zico: {
		id: 'zico',
		name: '지코',
		genre: '힙합/랩',
		image: createArtistArtwork('#382d1a', '#14100a', '#facc15', 39),
		relatedIds: ['dean', 'heize']
	},
	heize: {
		id: 'heize',
		name: '헤이즈',
		genre: 'R&B/발라드',
		image: createArtistArtwork('#28283d', '#0f0f17', '#a5b4fc', 40),
		relatedIds: ['colde', 'paul_kim']
	},
	hyukoh: {
		id: 'hyukoh',
		name: '혁오',
		genre: '인디 밴드',
		image: createArtistArtwork('#332a27', '#120f0e', '#fdba74', 41),
		relatedIds: ['wave_to_earth', 'car_the_garden']
	},
	wave_to_earth: {
		id: 'wave_to_earth',
		name: '웨이브투어스',
		genre: '인디/재즈팝',
		image: createArtistArtwork('#1b323d', '#0b1418', '#38bdf8', 42),
		relatedIds: ['colde', 'hyukoh']
	},
	thornapple: {
		id: 'thornapple',
		name: '쏜애플',
		genre: '록 밴드',
		image: createArtistArtwork('#3d1c24', '#140a0c', '#f43f5e', 43),
		relatedIds: ['nell', 'jaurim']
	},
	nell: {
		id: 'nell',
		name: '넬',
		genre: '모던 록',
		image: createArtistArtwork('#232938', '#0d0f14', '#93c5fd', 44),
		relatedIds: ['jaurim', 'thornapple']
	},
	jaurim: {
		id: 'jaurim',
		name: '자우림',
		genre: '록 밴드',
		image: createArtistArtwork('#361f3b', '#130b14', '#e879f9', 45),
		relatedIds: ['nell']
	},
	park_hyo_shin: {
		id: 'park_hyo_shin',
		name: '박효신',
		genre: '발라드',
		image: createArtistArtwork('#2b2b30', '#101012', '#e4e4e7', 46),
		relatedIds: ['kim_dong_ryul', 'paul_kim']
	},
	kim_dong_ryul: {
		id: 'kim_dong_ryul',
		name: '김동률',
		genre: '발라드',
		image: createArtistArtwork('#302a22', '#12100d', '#fde68a', 47),
		relatedIds: ['park_hyo_shin']
	},
	paul_kim: {
		id: 'paul_kim',
		name: '폴킴',
		genre: '발라드/R&B',
		image: createArtistArtwork('#23302b', '#0d1210', '#86efac', 48),
		relatedIds: ['melomance', 'lee_mu_jin']
	},
	car_the_garden: {
		id: 'car_the_garden',
		name: '카더가든',
		genre: '인디/보컬',
		image: createArtistArtwork('#332721', '#120e0c', '#fdba74', 49),
		relatedIds: ['melomance', 'woodz']
	},
	woodz: {
		id: 'woodz',
		name: '우즈',
		genre: '록/올라운더',
		image: createArtistArtwork('#212c3f', '#0c1017', '#60a5fa', 50),
		relatedIds: ['colde', 'qwer']
	},
	colde: {
		id: 'colde',
		name: '콜드',
		genre: 'R&B/인디',
		image: createArtistArtwork('#262d38', '#0e1014', '#93c5fd', 51),
		relatedIds: ['wave_to_earth']
	},
	lee_mu_jin: {
		id: 'lee_mu_jin',
		name: '이무진',
		genre: '싱어송라이터',
		image: createArtistArtwork('#332d1f', '#12100b', '#fde047', 52),
		relatedIds: ['melomance']
	},
	melomance: {
		id: 'melomance',
		name: '멜로망스',
		genre: '발라드/인디',
		image: createArtistArtwork('#36262f', '#130e11', '#f9a8d4', 53),
		relatedIds: ['davichi']
	},
	davichi: {
		id: 'davichi',
		name: '다비치',
		genre: '발라드',
		image: createArtistArtwork('#302436', '#110d13', '#d8b4fe', 54),
		relatedIds: ['sg_wannabe']
	}
};

const RAW_KEYS = Object.keys(RAW_MOCK_ARTIST_DB);
const KEY_TO_NUM_ID = new Map<string, string>(RAW_KEYS.map((key, index) => [key, String(index + 1)]));

/**
 * 숫자 ID 기반으로 정규화된 목업 아티스트 DB (v2 G13 artistIds 숫자 규약 호환)
 */
export const MOCK_ARTIST_DB: Record<string, ArtistItem> = Object.fromEntries(
	RAW_KEYS.map((key) => {
		const raw = RAW_MOCK_ARTIST_DB[key];
		const numericId = KEY_TO_NUM_ID.get(key)!;
		return [
			numericId,
			{
				...raw,
				id: numericId,
				relatedIds: raw.relatedIds
					?.map((relKey) => KEY_TO_NUM_ID.get(relKey))
					.filter((v): v is string => Boolean(v))
			}
		];
	})
);

const DEFAULT_INITIAL_IDS = [
	'illit',
	'buzz',
	'day6',
	'iu',
	'crush',
	'blackpink',
	'silicagel',
	'sung_si_kyung'
].map((k) => KEY_TO_NUM_ID.get(k)!);

const EXTRA_POOL_IDS = [
	'akmu',
	'jannabi',
	'newjeans',
	'aespa',
	'lucy',
	'qwer',
	'taeyeon',
	'zico',
	'hyukoh',
	'park_hyo_shin',
	'10cm',
	'ive',
	'le_sserafim',
	'yb',
	'mc_the_max',
	'wave_to_earth',
	'dean',
	'heize',
	'nell',
	'paul_kim',
	'woodz',
	'thornapple',
	'car_the_garden',
	'kiss_of_life',
	'rescene',
	'izi',
	'melomance'
].map((k) => KEY_TO_NUM_ID.get(k)!);

const EXTRA_ARTIST_SEEDS: [string, string, string][] = [
	['백예린', '#2f243d', '#f472b6'],
	['빈지노', '#38281a', '#fb923c'],
	['윤하', '#1b2b40', '#60a5fa'],
	['검정치마', '#2b2b30', '#e4e4e7'],
	['선우정아', '#3b1f2a', '#fb7185'],
	['새소년', '#1e3038', '#38bdf8'],
	['오혁', '#33291e', '#facc15'],
	['권진아', '#302433', '#d8b4fe']
];

const FALLBACK_ARTWORK_PALETTES: [string, string, string][] = [
	['#182e3f', '#0c1117', '#38bdf8'],
	['#2f1f46', '#110d19', '#a78bfa'],
	['#15352f', '#0d1715', '#34d399'],
	['#3b1f47', '#14131d', '#ff9ebb'],
	['#362819', '#14110e', '#fbbf24'],
	['#3b1d28', '#140c10', '#fb7185']
];

/** 초기 웰컴 목업 아티스트 목록 반환 */
export function getInitialWelcomeArtists(): ArtistItem[] {
	return DEFAULT_INITIAL_IDS.map((id) => MOCK_ARTIST_DB[id]).filter(Boolean);
}

/** 특정 아티스트와 연관된 미표시 목업 아티스트 목록 반환 */
export function getRelatedMockArtists(artist: ArtistItem, existingIds: Set<string>): ArtistItem[] {
	const relIds = artist.relatedIds ?? MOCK_ARTIST_DB[artist.id]?.relatedIds ?? [];
	const results = relIds
		.map((id) => MOCK_ARTIST_DB[id])
		.filter((item): item is ArtistItem => Boolean(item) && !existingIds.has(item.id));

	if (results.length > 0) return results;

	for (const poolId of EXTRA_POOL_IDS) {
		if (!existingIds.has(poolId) && MOCK_ARTIST_DB[poolId]) {
			results.push(MOCK_ARTIST_DB[poolId]);
			existingIds.add(poolId);
			if (results.length >= 2) break;
		}
	}

	return results;
}

/** '더 추가하기' 클릭 시 미표시 목업 아티스트 최대 4개 반환 */
export function getMoreMockArtists(existingIds: Set<string>, limit = 4): ArtistItem[] {
	const more: ArtistItem[] = [];

	for (const id of Object.keys(MOCK_ARTIST_DB)) {
		if (!existingIds.has(id)) {
			more.push(MOCK_ARTIST_DB[id]);
			existingIds.add(id);
			if (more.length >= limit) return more;
		}
	}

	for (let idx = 0; idx < EXTRA_ARTIST_SEEDS.length; idx++) {
		const [name, c1, acc] = EXTRA_ARTIST_SEEDS[idx];
		const customId = String(1000 + idx + 1);
		if (!existingIds.has(customId)) {
			more.push({
				id: customId,
				name,
				image: createArtistArtwork(c1, '#101015', acc, 60 + idx)
			});
			existingIds.add(customId);
			if (more.length >= limit) break;
		}
	}

	return more;
}

function mapCatalogDtoToArtistItem(dto: CatalogArtistDto, index: number): ArtistItem {
	const [bg1, bg2, accent] =
		FALLBACK_ARTWORK_PALETTES[Math.abs(dto.id + index) % FALLBACK_ARTWORK_PALETTES.length];
	return {
		id: String(dto.id),
		name: dto.name,
		image:
			dto.profileUrl && dto.profileUrl.trim().length > 0
				? dto.profileUrl
				: createArtistArtwork(bg1, bg2, accent, dto.id || index + 1),
		genre: Array.isArray(dto.genres) && dto.genres.length > 0 ? dto.genres.join(', ') : undefined
	};
}

/**
 * v2 GET /api/catalog/artists 아티스트 목록 조회
 * - 0페이지가 비어 있거나 서버 연결 실패 시 숫자 ID 목업 데이터로 fallback
 */
export async function loadCatalogArtists(options?: {
	page?: number;
	size?: number;
	q?: string;
	useFallbackOnEmpty?: boolean;
}): Promise<CatalogArtistPageResult> {
	const page = options?.page ?? 0;
	const size = options?.size ?? 20;
	const useFallbackOnEmpty = options?.useFallbackOnEmpty ?? true;

	const params = new URLSearchParams({
		page: String(page),
		size: String(size)
	});
	if (options?.q && options.q.trim()) {
		params.set('q', options.q.trim());
	}

	try {
		const res = await api<{
			items: CatalogArtistDto[];
			page: number;
			size: number;
			hasNext: boolean;
		}>(`/api/catalog/artists?${params.toString()}`);

		const items = Array.isArray(res?.items) ? res.items : [];
		if (items.length === 0 && page === 0 && !options?.q && useFallbackOnEmpty) {
			return {
				items: getInitialWelcomeArtists(),
				page: 0,
				hasNext: true,
				isMock: true
			};
		}

		return {
			items: items.map(mapCatalogDtoToArtistItem),
			page: res?.page ?? page,
			hasNext: Boolean(res?.hasNext),
			isMock: false
		};
	} catch (err) {
		if (page === 0 && !options?.q && useFallbackOnEmpty) {
			console.warn('카탈로그 아티스트 API 조회 실패로 기본 목업 목록을 사용합니다:', err);
			return {
				items: getInitialWelcomeArtists(),
				page: 0,
				hasNext: true,
				isMock: true
			};
		}
		throw err;
	}
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
export async function loadWelcomeTerms(useFallback = true): Promise<TermsItem[]> {
	try {
		const items = await fetchTermsList();
		if (items && items.length > 0) {
			return items;
		}
		return useFallback ? DEFAULT_WELCOME_TERMS : [];
	} catch (err) {
		if (useFallback) {
			console.warn('약관 API 조회 실패로 기본 약관 데이터를 사용합니다:', err);
			return DEFAULT_WELCOME_TERMS;
		}
		throw err;
	}
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
