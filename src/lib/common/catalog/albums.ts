import { ALBUM_FORM_OPTIONS } from '#lib/common/type/filterOptions';

export type AlbumFormat = 'LP' | '한정판 LP' | 'CD' | '카세트' | 'KIT' | 'USB' | string;
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
	price?: number | null;
	stockStatus?: AlbumStockStatus;
	coverUrl?: string | null;
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
	const rawFormat = item.format?.trim() ?? '';
	const formatLabel = rawFormat ? (ALBUM_FORMAT_LABEL_MAP[rawFormat] ?? rawFormat) : undefined;

	return {
		id: item.id,
		albumId: item.albumId ?? null,
		albumTitle: item.albumTitle ?? null,
		artistId: item.artistId ?? null,
		title: item.name?.trim() || item.albumTitle?.trim() || '',
		artistName: item.artistName?.trim() ?? '',
		releaseYear: parseReleaseYear(item.releasedAt),
		format: formatLabel,
		price: typeof item.minPrice === 'number' ? item.minPrice : null,
		stockStatus: item.soldOut ? '품절' : '판매중',
		coverUrl: item.thumbnailUrl ?? null
	};
}

export function resolveAlbumCoverUrl(album: Pick<CatalogAlbum, 'coverUrl'>): string {
	return album.coverUrl?.trim() ?? '';
}
