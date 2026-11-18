export interface CatalogArtist {
	id: number;
	name: string;
	genre?: string | null;
	debutYear?: number | null;
	profileUrl?: string | null;
}

export interface ArtistAlbumSummary {
	id: string;
	title: string;
	year: number;
	type: '정규' | 'EP' | '싱글';
	coverUrl: string;
}

export interface ArtistConcertSummary {
	id: string;
	title: string;
	date: string;
	venue: string;
	status: '예매중' | '매진임박' | '종료';
}

export interface ArtistDetailExtra {
	bio: string;
	tags: string[];
	monthlyListeners: string;
	albums: ArtistAlbumSummary[];
	concerts: ArtistConcertSummary[];
}

export const MOCK_CATALOG_ARTISTS: CatalogArtist[] = [
	{
		id: 1,
		name: '실리카겔',
		genre: '인디/사이키델릭',
		debutYear: 2015,
		profileUrl: 'https://picsum.photos/seed/silicagel/400/400'
	},
	{
		id: 2,
		name: '데이식스',
		genre: '밴드',
		debutYear: 2015,
		profileUrl: 'https://picsum.photos/seed/day6/400/400'
	},
	{
		id: 3,
		name: '잔나비',
		genre: '인디 밴드',
		debutYear: 2014,
		profileUrl: 'https://picsum.photos/seed/jannabi/400/400'
	},
	{
		id: 4,
		name: '루시',
		genre: '밴드',
		debutYear: 2020,
		profileUrl: 'https://picsum.photos/seed/lucy/400/400'
	},
	{
		id: 5,
		name: '웨이브투어스',
		genre: '인디/재즈팝',
		debutYear: 2019,
		profileUrl: 'https://picsum.photos/seed/wavetoearth/400/400'
	},
	{
		id: 6,
		name: '쏜애플',
		genre: '록 밴드',
		debutYear: 2010,
		profileUrl: 'https://picsum.photos/seed/thornapple/400/400'
	},
	{
		id: 7,
		name: '혁오',
		genre: '인디 밴드',
		debutYear: 2014,
		profileUrl: 'https://picsum.photos/seed/hyukoh/400/400'
	},
	{
		id: 8,
		name: '터치드',
		genre: '밴드',
		debutYear: 2020,
		profileUrl: 'https://picsum.photos/seed/touched/400/400'
	},
	{
		id: 9,
		name: '라쿠나',
		genre: '밴드',
		debutYear: 2018,
		profileUrl: 'https://picsum.photos/seed/lacuna/400/400'
	},
	{
		id: 10,
		name: '너드커넥션',
		genre: '밴드',
		debutYear: 2018,
		profileUrl: 'https://picsum.photos/seed/nerdconnection/400/400'
	},
	{
		id: 11,
		name: 'QWER',
		genre: '밴드',
		debutYear: 2023,
		profileUrl: 'https://picsum.photos/seed/qwer/400/400'
	},
	{
		id: 12,
		name: '넬',
		genre: '모던 록',
		debutYear: 2001,
		profileUrl: 'https://picsum.photos/seed/nell/400/400'
	},
	{
		id: 13,
		name: '자우림',
		genre: '록 밴드',
		debutYear: 1997,
		profileUrl: 'https://picsum.photos/seed/jaurim/400/400'
	},
	{
		id: 14,
		name: '10CM',
		genre: '인디/어쿠스틱',
		debutYear: 2010,
		profileUrl: 'https://picsum.photos/seed/10cm/400/400'
	},
	{
		id: 15,
		name: '카더가든',
		genre: '인디/보컬',
		debutYear: 2013,
		profileUrl: 'https://picsum.photos/seed/carthegarden/400/400'
	},
	{
		id: 16,
		name: '새소년',
		genre: '인디 록',
		debutYear: 2017,
		profileUrl: 'https://picsum.photos/seed/sesoneon/400/400'
	},
	{
		id: 17,
		name: '검정치마',
		genre: '인디 록',
		debutYear: 2008,
		profileUrl: 'https://picsum.photos/seed/theblackskirts/400/400'
	},
	{
		id: 18,
		name: '선우정아',
		genre: '인디/재즈',
		debutYear: 2006,
		profileUrl: 'https://picsum.photos/seed/sunwoojunga/400/400'
	},
	{
		id: 19,
		name: '페퍼톤스',
		genre: '인디 록',
		debutYear: 2004,
		profileUrl: 'https://picsum.photos/seed/peppertones/400/400'
	},
	{
		id: 20,
		name: '글렌체크',
		genre: '일렉트로니카',
		debutYear: 2011,
		profileUrl: 'https://picsum.photos/seed/glencheck/400/400'
	}
];

export function resolveArtistImageUrl(artist: Pick<CatalogArtist, 'id' | 'profileUrl'>): string {
	return artist.profileUrl && artist.profileUrl.trim().length > 0
		? artist.profileUrl
		: `https://picsum.photos/seed/artist_${artist.id}/400/400`;
}

export function findMockArtistById(id: number): CatalogArtist | null {
	return MOCK_CATALOG_ARTISTS.find((item) => item.id === id) ?? null;
}

export function buildArtistDetailExtra(artist: CatalogArtist): ArtistDetailExtra {
	const genreLabel = artist.genre?.trim() || '인디 사운드';
	const debut = artist.debutYear ? `${artist.debutYear}년 데뷔 이후` : '데뷔 이후';
	const splitTags = genreLabel
		.split(/[\/,\s]+/)
		.map((t) => t.trim())
		.filter(Boolean);

	return {
		bio: `${artist.name}은(는) ${debut} 독보적인 ${genreLabel} 사운드와 밀도 높은 라이브 퍼포먼스로 인디 씬에서 꾸준한 사랑을 받고 있는 아티스트입니다. 섬세한 편곡과 강렬한 무대 에너지로 매 앨범 새로운 스펙트럼을 확장해 나가고 있습니다.`,
		tags: Array.from(new Set([...splitTags, '라이브 퍼포먼스', '인디 씬'])).slice(0, 4),
		monthlyListeners: `${((artist.id * 17) % 85 + 18).toLocaleString()}만+`,
		albums: [
			{
				id: `${artist.id}-a1`,
				title: `${artist.name} Live Session & Anthology`,
				year: Math.max(artist.debutYear ?? 2020, 2024),
				type: '정규',
				coverUrl: `https://picsum.photos/seed/album_${artist.id}_1/320/320`
			},
			{
				id: `${artist.id}-a2`,
				title: 'Midnight Echoes',
				year: Math.max(artist.debutYear ?? 2019, 2022),
				type: 'EP',
				coverUrl: `https://picsum.photos/seed/album_${artist.id}_2/320/320`
			},
			{
				id: `${artist.id}-a3`,
				title: 'Afterglow (Acoustic Ver.)',
				year: Math.max(artist.debutYear ?? 2018, 2021),
				type: '싱글',
				coverUrl: `https://picsum.photos/seed/album_${artist.id}_3/320/320`
			}
		],
		concerts: [
			{
				id: `${artist.id}-c1`,
				title: `${artist.name} 단독 콘서트 — SOUNDWAVE`,
				date: '2026.12.19 (토) 19:00',
				venue: '올림픽공원 올림픽홀',
				status: artist.id % 2 === 0 ? '매진임박' : '예매중'
			},
			{
				id: `${artist.id}-c2`,
				title: 'INDIG Winter Live Showcase',
				date: '2027.01.10 (일) 18:00',
				venue: '예스24 라이브홀',
				status: '예매중'
			}
		]
	};
}
