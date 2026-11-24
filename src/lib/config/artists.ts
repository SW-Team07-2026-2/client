import { getGenreLabel } from '#lib/common/type/filterOptions';
import { mapPhysicalItem, type CatalogAlbum, type PhysicalItemDto } from '#lib/config/albums';
import { mapGoodsItem, type CatalogGoods, type GoodsItemDto } from '#lib/config/goods';
import type { CatalogConcert } from '#lib/config/concerts';

export interface ArtistMemberSummary {
	name: string;
	role?: string | null;
}

export interface ArtistAlbumSummary {
	id: string | number;
	title: string;
	year?: number | null;
	type?: string | null;
	releasedAt?: string | null;
	genres?: string[];
	coverUrl?: string | null;
}

export interface ArtistConcertSummary {
	id: string | number;
	title: string;
	date: string;
	venue: string;
	status?: '예매중' | '매진임박' | '종료' | string;
}

export interface ArtistItemDto {
	id: number;
	name: string;
	genres?: string[] | null;
	genre?: string | null;
	debutYear?: number | null;
	profileUrl?: string | null;
}

export interface ArtistAlbumDto {
	id: number;
	artistId?: number | null;
	artistName?: string | null;
	title: string;
	type?: string | null;
	genres?: string[] | null;
	releasedAt?: string | null;
	thumbnailUrl?: string | null;
}

export interface ArtistDetailDto extends ArtistItemDto {
	label?: string | null;
	bio?: string | null;
	tags?: string[] | null;
	monthlyListeners?: string | null;
	members?: ArtistMemberSummary[] | null;
	albums?: ArtistAlbumDto[] | null;
	physicalAlbums?: PhysicalItemDto[] | null;
	lps?: PhysicalItemDto[] | null;
	goods?: GoodsItemDto[] | null;
}

export interface CatalogArtist {
	id: number;
	name: string;
	genre?: string | null;
	genres?: string[];
	label?: string | null;
	debutYear?: number | null;
	profileUrl?: string | null;
	bio?: string | null;
	tags?: string[];
	monthlyListeners?: string | null;
	members?: ArtistMemberSummary[];
	albums?: ArtistAlbumSummary[];
	physicalAlbums?: CatalogAlbum[];
	goods?: CatalogGoods[];
	concerts?: ArtistConcertSummary[];
	catalogConcerts?: CatalogConcert[];
}

function parseReleaseYear(releasedAt?: string | null): number | null {
	if (!releasedAt) return null;
	const match = releasedAt.trim().match(/^(\d{4})/);
	if (!match) return null;
	const year = Number.parseInt(match[1], 10);
	return Number.isFinite(year) ? year : null;
}

export function mapArtistItem(item: ArtistItemDto | CatalogArtist): CatalogArtist {
	const rawGenres = Array.isArray(item.genres)
		? item.genres.filter((g): g is string => typeof g === 'string' && g.trim().length > 0)
		: typeof item.genre === 'string' && item.genre.trim().length > 0
			? [item.genre.trim()]
			: [];
	const labels = rawGenres.map(getGenreLabel).filter(Boolean);

	return {
		...item,
		id: item.id,
		name: item.name ?? '',
		genres: rawGenres,
		genre: labels.length > 0 ? labels.join(' · ') : null,
		debutYear: item.debutYear ?? null,
		profileUrl: item.profileUrl ?? null
	};
}

export function mapArtistDetail(dto: ArtistDetailDto): CatalogArtist {
	const base = mapArtistItem(dto);

	const members: ArtistMemberSummary[] = Array.isArray(dto.members)
		? dto.members
				.filter((m): m is ArtistMemberSummary => Boolean(m && typeof m.name === 'string'))
				.map((m) => ({ name: m.name.trim(), role: m.role?.trim() || null }))
		: [];

	const albums: ArtistAlbumSummary[] = Array.isArray(dto.albums)
		? dto.albums.map((a) => ({
				id: a.id,
				title: a.title?.trim() ?? '',
				year: parseReleaseYear(a.releasedAt),
				type: a.type?.trim() || null,
				releasedAt: a.releasedAt ?? null,
				genres: Array.isArray(a.genres) ? a.genres.map(getGenreLabel).filter(Boolean) : [],
				coverUrl: a.thumbnailUrl ?? null
			}))
		: [];

	const rawPhysicals = Array.isArray(dto.physicalAlbums)
		? dto.physicalAlbums
		: Array.isArray(dto.lps)
			? dto.lps
			: [];
	const physicalAlbums: CatalogAlbum[] = rawPhysicals.map((p) =>
		mapPhysicalItem({ ...p, artistName: p.artistName ?? base.name })
	);

	const goods: CatalogGoods[] = Array.isArray(dto.goods)
		? dto.goods.map((g) => mapGoodsItem({ ...g, artistName: g.artistName ?? base.name }))
		: [];

	return {
		...base,
		label: dto.label?.trim() || null,
		bio: dto.bio?.trim() || null,
		tags: Array.isArray(dto.tags) ? dto.tags.filter(Boolean) : [],
		monthlyListeners: dto.monthlyListeners ?? null,
		members,
		albums,
		physicalAlbums,
		goods
	};
}

export function resolveArtistImageUrl(artist: Pick<CatalogArtist, 'profileUrl'>): string {
	return artist.profileUrl?.trim() ?? '';
}
