import { ALBUM_FORM_OPTIONS } from '#lib/common/type/filterOptions';

export type AlbumFormat = 'LP' | '한정판 LP' | 'CD' | '카세트' | 'KIT' | 'USB' | string;
export type AlbumFormatCode = 'LP' | 'CD' | 'CASSETTE' | string;
export type AlbumStockStatus = '판매중' | '한정수량' | '품절';

export interface PhysicalItemDto {
	id: number;
	albumId?: number | null;
	albumTitle?: string | null;
	artistId?: number | null;
	artistName?: string | null;
	format?: string | null;
	name?: string | null;
	releasedAt?: string | null;
	thumbnailUrl?: string | null;
	mediaImageUrl?: string | null;
	minPrice?: number | null;
	soldOut?: boolean | null;
}

export interface CatalogAlbum {
	id: number;
	albumId?: number | null;
	albumTitle?: string | null;
	artistId?: number | null;
	title: string;
	artistName: string;
	genre?: string | null;
	releaseYear?: number | null;
	format?: AlbumFormat;
	rawFormat?: AlbumFormatCode;
	price?: number | null;
	stockStatus?: AlbumStockStatus;
	coverUrl?: string | null;
	mediaImageUrl?: string | null;
}

const ALBUM_FORMAT_LABEL_MAP: Record<string, string> = Object.fromEntries(
	ALBUM_FORM_OPTIONS.map((opt) => [opt.value, opt.label])
);

function parseReleaseYear(releasedAt?: string | null): number | null {
	if (!releasedAt) return null;
	const match = releasedAt.trim().match(/^(\d{4})/);
	if (!match) return null;
	const year = Number.parseInt(match[1], 10);
	return Number.isFinite(year) ? year : null;
}

export function mapPhysicalItem(item: PhysicalItemDto): CatalogAlbum {
	const rawFormat = item.format?.trim().toUpperCase() ?? '';
	const formatLabel = rawFormat ? (ALBUM_FORMAT_LABEL_MAP[rawFormat] ?? item.format?.trim()) : undefined;
	const productThumbnail = item.thumbnailUrl?.trim() || null;
	const explicitMedia = item.mediaImageUrl?.trim() || null;

	return {
		id: item.id,
		albumId: item.albumId ?? null,
		albumTitle: item.albumTitle ?? null,
		artistId: item.artistId ?? null,
		title: item.name?.trim() || item.albumTitle?.trim() || '',
		artistName: item.artistName?.trim() ?? '',
		releaseYear: parseReleaseYear(item.releasedAt),
		format: formatLabel,
		rawFormat: rawFormat || undefined,
		price: typeof item.minPrice === 'number' ? item.minPrice : null,
		stockStatus: item.soldOut ? '품절' : '판매중',
		coverUrl: productThumbnail,
		mediaImageUrl: explicitMedia ?? productThumbnail
	};
}

export function resolveAlbumCoverUrl(album: Pick<CatalogAlbum, 'coverUrl'>): string {
	return album.coverUrl?.trim() ?? '';
}

export function resolveAlbumMediaKind(
	album: Pick<CatalogAlbum, 'rawFormat' | 'format'>
): 'lp' | 'cd' | 'cassette' {
	const raw = (album.rawFormat || album.format || '').trim().toUpperCase();
	if (raw.includes('CASSETTE') || raw.includes('카세트') || raw.includes('TAPE')) {
		return 'cassette';
	}
	if (raw.includes('CD')) {
		return 'cd';
	}
	return 'lp';
}

export function formatAlbumPrice(price?: number | null): string {
	if (typeof price !== 'number' || !Number.isFinite(price)) return '';
	return `${price.toLocaleString('ko-KR')}원`;
}

export function formatAlbumPriceRange(
	minPrice?: number | null,
	maxPrice?: number | null
): string {
	if (typeof minPrice !== 'number' || !Number.isFinite(minPrice)) return '';
	if (typeof maxPrice === 'number' && Number.isFinite(maxPrice) && maxPrice > minPrice) {
		return `${minPrice.toLocaleString('ko-KR')}원 ~ ${maxPrice.toLocaleString('ko-KR')}원`;
	}
	return `${minPrice.toLocaleString('ko-KR')}원`;
}
