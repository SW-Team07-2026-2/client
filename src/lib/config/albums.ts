export type AlbumFormat = 'LP' | '한정판 LP' | 'CD' | '카세트';
export type AlbumStockStatus = '판매중' | '한정수량' | '품절';

export interface CatalogAlbum {
	id: number;
	title: string;
	artistName: string;
	genre?: string | null;
	releaseYear?: number | null;
	format?: AlbumFormat;
	price?: number | null;
	stockStatus?: AlbumStockStatus;
	coverUrl?: string | null;
}

export const MOCK_CATALOG_ALBUMS: CatalogAlbum[] = [
	{
		id: 201,
		title: 'POWER ANDRE 99',
		artistName: '실리카겔',
		genre: '인디/사이키델릭',
		releaseYear: 2023,
		format: '한정판 LP',
		price: 68000,
		stockStatus: '한정수량',
		coverUrl: 'https://picsum.photos/seed/album_201/480/480'
	},
	{
		id: 202,
		title: 'Fourever',
		artistName: '데이식스',
		genre: '밴드',
		releaseYear: 2024,
		format: 'LP',
		price: 54000,
		stockStatus: '판매중',
		coverUrl: 'https://picsum.photos/seed/album_202/480/480'
	},
	{
		id: 203,
		title: '전설 (Legend)',
		artistName: '잔나비',
		genre: '인디 밴드',
		releaseYear: 2019,
		format: '한정판 LP',
		price: 72000,
		stockStatus: '한정수량',
		coverUrl: 'https://picsum.photos/seed/album_203/480/480'
	},
	{
		id: 204,
		title: '열 (Fever)',
		artistName: '루시',
		genre: '밴드',
		releaseYear: 2023,
		format: 'CD',
		price: 21000,
		stockStatus: '판매중',
		coverUrl: 'https://picsum.photos/seed/album_204/480/480'
	},
	{
		id: 205,
		title: '0.1 flaws and all.',
		artistName: '웨이브투어스',
		genre: '인디/재즈팝',
		releaseYear: 2023,
		format: 'LP',
		price: 58000,
		stockStatus: '한정수량',
		coverUrl: 'https://picsum.photos/seed/album_205/480/480'
	},
	{
		id: 206,
		title: '계몽 (Enlightenment)',
		artistName: '쏜애플',
		genre: '록 밴드',
		releaseYear: 2019,
		format: '한정판 LP',
		price: 65000,
		stockStatus: '품절',
		coverUrl: 'https://picsum.photos/seed/album_206/480/480'
	},
	{
		id: 207,
		title: '23',
		artistName: '혁오',
		genre: '인디 밴드',
		releaseYear: 2017,
		format: 'LP',
		price: 56000,
		stockStatus: '판매중',
		coverUrl: 'https://picsum.photos/seed/album_207/480/480'
	},
	{
		id: 208,
		title: 'Yellow Supernova Remnant',
		artistName: '터치드',
		genre: '밴드',
		releaseYear: 2023,
		format: 'CD',
		price: 22000,
		stockStatus: '판매중',
		coverUrl: 'https://picsum.photos/seed/album_208/480/480'
	},
	{
		id: 209,
		title: 'John Doe',
		artistName: '라쿠나',
		genre: '밴드',
		releaseYear: 2022,
		format: 'CD',
		price: 19500,
		stockStatus: '판매중',
		coverUrl: 'https://picsum.photos/seed/album_209/480/480'
	},
	{
		id: 210,
		title: 'New Century Masterpiece Cinema',
		artistName: '너드커넥션',
		genre: '밴드',
		releaseYear: 2021,
		format: 'LP',
		price: 52000,
		stockStatus: '판매중',
		coverUrl: 'https://picsum.photos/seed/album_210/480/480'
	},
	{
		id: 211,
		title: 'Healing Process',
		artistName: '넬',
		genre: '모던 록',
		releaseYear: 2006,
		format: '한정판 LP',
		price: 78000,
		stockStatus: '한정수량',
		coverUrl: 'https://picsum.photos/seed/album_211/480/480'
	},
	{
		id: 212,
		title: '25, 21 (Remastered)',
		artistName: '자우림',
		genre: '록 밴드',
		releaseYear: 2023,
		format: 'LP',
		price: 59000,
		stockStatus: '판매중',
		coverUrl: 'https://picsum.photos/seed/album_212/480/480'
	},
	{
		id: 213,
		title: '4.0',
		artistName: '10CM',
		genre: '인디/어쿠스틱',
		releaseYear: 2017,
		format: '카세트',
		price: 24000,
		stockStatus: '판매중',
		coverUrl: 'https://picsum.photos/seed/album_213/480/480'
	},
	{
		id: 214,
		title: 'C',
		artistName: '카더가든',
		genre: '인디/보컬',
		releaseYear: 2019,
		format: 'LP',
		price: 51000,
		stockStatus: '판매중',
		coverUrl: 'https://picsum.photos/seed/album_214/480/480'
	},
	{
		id: 215,
		title: '비적응 (Nonadaptation)',
		artistName: '새소년',
		genre: '인디 록',
		releaseYear: 2020,
		format: '한정판 LP',
		price: 62000,
		stockStatus: '한정수량',
		coverUrl: 'https://picsum.photos/seed/album_215/480/480'
	},
	{
		id: 216,
		title: 'TEAM BABY',
		artistName: '검정치마',
		genre: '인디 록',
		releaseYear: 2017,
		format: 'LP',
		price: 64000,
		stockStatus: '판매중',
		coverUrl: 'https://picsum.photos/seed/album_216/480/480'
	}
];

export function resolveAlbumCoverUrl(album: Pick<CatalogAlbum, 'id' | 'coverUrl'>): string {
	return album.coverUrl && album.coverUrl.trim().length > 0
		? album.coverUrl
		: `https://picsum.photos/seed/album_${album.id}/480/480`;
}
