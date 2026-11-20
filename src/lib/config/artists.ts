import { getGenreLabel } from '#lib/config/genre';

export interface ArtistAlbumSummary {
	id: string | number;
	title: string;
	year?: number | null;
	type?: string | null;
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

export interface CatalogArtist {
	id: number;
	name: string;
	genre?: string | null;
	genres?: string[];
	debutYear?: number | null;
	profileUrl?: string | null;
	bio?: string | null;
	tags?: string[];
	monthlyListeners?: string | null;
	albums?: ArtistAlbumSummary[];
	concerts?: ArtistConcertSummary[];
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

export function resolveArtistImageUrl(artist: Pick<CatalogArtist, 'profileUrl'>): string {
	return artist.profileUrl?.trim() ?? '';
}
