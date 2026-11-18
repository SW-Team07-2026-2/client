export type ConcertTicketStatus = '예매중' | '매진임박' | '매진' | '오픈예정';

export interface CatalogConcert {
	id: number;
	title: string;
	artistName: string;
	genre?: string | null;
	dateText: string;
	venue: string;
	price?: number | null;
	status?: ConcertTicketStatus;
	posterUrl?: string | null;
}

export const MOCK_CATALOG_CONCERTS: CatalogConcert[] = [
	{
		id: 101,
		title: 'SYNTHETIC HORIZON 2026',
		artistName: '실리카겔',
		genre: '인디/사이키델릭',
		dateText: '2026.12.05 (토) 19:00',
		venue: '올림픽공원 올림픽홀',
		price: 110000,
		status: '매진임박',
		posterUrl: 'https://picsum.photos/seed/concert_101/480/640'
	},
	{
		id: 102,
		title: 'The Present: Winter Reverie',
		artistName: '데이식스',
		genre: '밴드',
		dateText: '2026.12.12 (토) 18:00',
		venue: 'KSPO DOME',
		price: 132000,
		status: '예매중',
		posterUrl: 'https://picsum.photos/seed/concert_102/480/640'
	},
	{
		id: 103,
		title: '판타스틱 올드패션드 연말 콘서트',
		artistName: '잔나비',
		genre: '인디 밴드',
		dateText: '2026.12.19 (토) 19:00',
		venue: '잠실실내체육관',
		price: 121000,
		status: '예매중',
		posterUrl: 'https://picsum.photos/seed/concert_103/480/640'
	},
	{
		id: 104,
		title: 'LUCY FIRST CHAPTER: 개화',
		artistName: '루시',
		genre: '밴드',
		dateText: '2026.12.26 (토) 18:00',
		venue: '예스24 라이브홀',
		price: 99000,
		status: '매진임박',
		posterUrl: 'https://picsum.photos/seed/concert_104/480/640'
	},
	{
		id: 105,
		title: 'flaws and all: Live in Seoul',
		artistName: '웨이브투어스',
		genre: '인디/재즈팝',
		dateText: '2027.01.09 (토) 19:00',
		venue: '블루스퀘어 마스터카드홀',
		price: 99000,
		status: '예매중',
		posterUrl: 'https://picsum.photos/seed/concert_105/480/640'
	},
	{
		id: 106,
		title: '불구경 2026',
		artistName: '쏜애플',
		genre: '록 밴드',
		dateText: '2026.12.18 (금) 20:00',
		venue: 'LG아트센터 서울',
		price: 110000,
		status: '매진',
		posterUrl: 'https://picsum.photos/seed/concert_106/480/640'
	},
	{
		id: 107,
		title: 'HYUKOH: THROUGH LOVE ENCORE',
		artistName: '혁오',
		genre: '인디 밴드',
		dateText: '2027.01.16 (토) 19:00',
		venue: '무신사 개러지',
		price: 88000,
		status: '오픈예정',
		posterUrl: 'https://picsum.photos/seed/concert_107/480/640'
	},
	{
		id: 108,
		title: 'HIGHLIGHT IN THE DARK',
		artistName: '터치드',
		genre: '밴드',
		dateText: '2026.12.27 (일) 18:00',
		venue: '명화라이브홀',
		price: 95000,
		status: '예매중',
		posterUrl: 'https://picsum.photos/seed/concert_108/480/640'
	},
	{
		id: 109,
		title: 'Lacuna Night: Dreaming',
		artistName: '라쿠나',
		genre: '밴드',
		dateText: '2027.01.23 (토) 19:00',
		venue: '롤링홀',
		price: 77000,
		status: '예매중',
		posterUrl: 'https://picsum.photos/seed/concert_109/480/640'
	},
	{
		id: 110,
		title: '밤의 정원 단독 공연',
		artistName: '너드커넥션',
		genre: '밴드',
		dateText: '2027.01.30 (토) 18:30',
		venue: 'KT&G 상상마당 홍대',
		price: 88000,
		status: '예매중',
		posterUrl: 'https://picsum.photos/seed/concert_110/480/640'
	},
	{
		id: 111,
		title: 'NELL’S SEASON: CHRISTMAS IN NELL’S ROOM',
		artistName: '넬',
		genre: '모던 록',
		dateText: '2026.12.24 (목) 20:00',
		venue: '잠실학생체육관',
		price: 132000,
		status: '매진임박',
		posterUrl: 'https://picsum.photos/seed/concert_111/480/640'
	},
	{
		id: 112,
		title: '자우림 단독 콘서트: 영원한 청춘',
		artistName: '자우림',
		genre: '록 밴드',
		dateText: '2026.12.31 (목) 21:00',
		venue: '코엑스 Hall D',
		price: 121000,
		status: '예매중',
		posterUrl: 'https://picsum.photos/seed/concert_112/480/640'
	},
	{
		id: 113,
		title: '10CM Winter Acoustic Night',
		artistName: '10CM',
		genre: '인디/어쿠스틱',
		dateText: '2027.02.06 (토) 18:00',
		venue: '연세대학교 백주년기념관',
		price: 99000,
		status: '예매중',
		posterUrl: 'https://picsum.photos/seed/concert_113/480/640'
	},
	{
		id: 114,
		title: '나란히 마주 앉아',
		artistName: '카더가든',
		genre: '인디/보컬',
		dateText: '2027.02.13 (토) 19:00',
		venue: '노들섬 라이브하우스',
		price: 88000,
		status: '오픈예정',
		posterUrl: 'https://picsum.photos/seed/concert_114/480/640'
	},
	{
		id: 115,
		title: '파도, 불꽃 그리고 새소년',
		artistName: '새소년',
		genre: '인디 록',
		dateText: '2027.02.20 (토) 19:00',
		venue: '예스24 원더로크홀',
		price: 92000,
		status: '예매중',
		posterUrl: 'https://picsum.photos/seed/concert_115/480/640'
	},
	{
		id: 116,
		title: 'THE BLACK SKIRTS: TEEN TROUBLES',
		artistName: '검정치마',
		genre: '인디 록',
		dateText: '2027.02.27 (토) 19:00',
		venue: '올림픽공원 SK핸드볼경기장',
		price: 110000,
		status: '매진임박',
		posterUrl: 'https://picsum.photos/seed/concert_116/480/640'
	}
];

export function resolveConcertPosterUrl(concert: Pick<CatalogConcert, 'id' | 'posterUrl'>): string {
	return concert.posterUrl && concert.posterUrl.trim().length > 0
		? concert.posterUrl
		: `https://picsum.photos/seed/concert_${concert.id}/480/640`;
}
