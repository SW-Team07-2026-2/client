import {
	mapPhysicalItem,
	resolveAlbumMediaKind,
	type CatalogAlbum,
	type PhysicalItemDto
} from '#lib/common/catalog/albums';
import { getGenreLabel } from '#lib/common/type/filterOptions';

export interface ProductOptionItem {
	id: number;
	name: string;
	vinylColor?: string | null;
	price: number;
	qty: number;
	soldOut: boolean;
}

export interface ProductDetailDto {
	id: number;
	productType?: string;
	name: string;
	thumbnailUrl?: string | null;
	artistId?: number | null;
	artistName?: string | null;
	albumId?: number | null;
	albumTitle?: string | null;
	format?: string | null;
	releasedAt?: string | null;
	description?: string | null;
	detailImageUrls?: string[] | null;
	options?: ProductOptionItem[] | null;
}

export interface AlbumTrackItem {
	id: number;
	trackNo: number;
	title: string;
	genres: string[];
	moods: string[];
	styles: string[];
}

export interface AlbumTrackDto {
	id: number;
	trackNo?: number | null;
	title: string;
	genres?: string[] | null;
	moods?: string[] | null;
	styles?: string[] | null;
}

export interface AlbumDetailFullDto {
	id: number;
	artistId?: number | null;
	artistName?: string | null;
	title: string;
	type?: string | null;
	genres?: string[] | null;
	releasedAt?: string | null;
	thumbnailUrl?: string | null;
	description?: string | null;
	tracks?: AlbumTrackDto[] | null;
	physicalAlbums?: PhysicalItemDto[] | null;
}

export interface AlbumPhysicalEdition {
	id: number;
	name: string;
	format: string;
	kind: 'lp' | 'cd' | 'cassette';
	thumbnailUrl: string;
	minPrice: number | null;
	soldOut: boolean;
	releasedAt: string | null;
}

export interface CollectionItemDto {
	id: number;
	physicalAlbumId: number;
	optionId: number;
}

export interface CursorPage<T> {
	items: T[];
	nextCursor: string | null;
	hasNext: boolean;
}

const ALBUM_TYPE_LABELS: Record<string, string> = {
	ALBUM: '정규 앨범',
	EP: 'EP',
	SINGLE: '싱글'
};

const FORMAT_ORDER: Record<string, number> = {
	LP: 0,
	CD: 1,
	카세트: 2
};

export function resolveAlbumTypeLabel(type?: string | null): string {
	if (!type) return '';
	return ALBUM_TYPE_LABELS[type.toUpperCase()] ?? type;
}

export function mapPhysicalEdition(
	mapped: CatalogAlbum,
	releasedAt: string | null
): AlbumPhysicalEdition {
	return {
		id: mapped.id,
		name: mapped.title,
		format: mapped.format || mapped.rawFormat || '음반',
		kind: resolveAlbumMediaKind(mapped),
		thumbnailUrl: mapped.mediaImageUrl?.trim() ?? '',
		minPrice: mapped.price ?? null,
		soldOut: mapped.stockStatus === '품절',
		releasedAt
	};
}

export function mapProductFallbackEdition(
	product: ProductDetailDto,
	opts: readonly ProductOptionItem[],
	firstAvail: ProductOptionItem | null
): AlbumPhysicalEdition {
	const mapped = mapPhysicalItem({
		id: product.id,
		albumId: product.albumId,
		albumTitle: product.albumTitle,
		artistId: product.artistId,
		artistName: product.artistName,
		format: product.format,
		name: product.name,
		releasedAt: product.releasedAt,
		thumbnailUrl: product.thumbnailUrl,
		minPrice: firstAvail?.price ?? opts[0]?.price ?? null,
		soldOut: opts.length > 0 ? opts.every((o) => o.soldOut) : false
	});
	return mapPhysicalEdition(mapped, product.releasedAt ?? null);
}

export function mapAlbumTracks(tracks?: readonly AlbumTrackDto[] | null): AlbumTrackItem[] {
	if (!Array.isArray(tracks)) return [];
	return [...tracks]
		.sort((a, b) => (a.trackNo ?? 0) - (b.trackNo ?? 0))
		.map((t, idx) => ({
			id: t.id,
			trackNo: t.trackNo ?? idx + 1,
			title: t.title,
			genres: Array.isArray(t.genres) ? t.genres.map((g: string) => getGenreLabel(g)) : [],
			moods: Array.isArray(t.moods) ? t.moods : [],
			styles: Array.isArray(t.styles) ? t.styles : []
		}));
}

export function mapPhysicalEditionsSorted(
	physicalAlbums: readonly PhysicalItemDto[]
): AlbumPhysicalEdition[] {
	return physicalAlbums
		.map((p) => mapPhysicalEdition(mapPhysicalItem(p), p.releasedAt ?? null))
		.sort((a, b) => (FORMAT_ORDER[a.format] ?? 99) - (FORMAT_ORDER[b.format] ?? 99));
}
