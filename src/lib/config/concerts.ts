import { CONCERT_REGION_OPTIONS, CONCERT_STATUS_OPTIONS } from '#lib/config/filter';
import { getGenreLabel } from '#lib/config/genre';

export type ConcertTicketStatus =
	| '예매중'
	| '매진임박'
	| '매진'
	| '오픈예정'
	| '판매전'
	| '판매중'
	| '판매종료';

export interface ConcertArtistSummaryDto {
	id: number;
	name: string;
	genre?: string | null;
}

export interface ConcertVenueSummaryDto {
	id?: number | null;
	name?: string | null;
	region?: string | null;
}

export interface ConcertSummaryDto {
	id: number;
	title: string;
	type?: string | null;
	genre?: string | null;
	artists?: ConcertArtistSummaryDto[] | null;
	startsAt?: string | null;
	price?: number | null;
	saleStatus?: string | null;
	venue?: ConcertVenueSummaryDto | null;
	posterUrl?: string | null;
}

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
	type?: string | null;
	region?: string | null;
}

const CONCERT_STATUS_LABEL_MAP: Record<string, ConcertTicketStatus> = Object.fromEntries(
	CONCERT_STATUS_OPTIONS.map((opt) => [opt.value, opt.label as ConcertTicketStatus])
);

const CONCERT_REGION_LABEL_MAP: Record<string, string> = Object.fromEntries(
	CONCERT_REGION_OPTIONS.map((opt) => [opt.value, opt.label])
);

function formatConcertDateText(startsAt?: string | null): string {
	if (!startsAt) return '';
	const trimmed = startsAt.trim();
	if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
		return trimmed.slice(0, 10).replace(/-/g, '.');
	}
	const parsed = new Date(trimmed);
	if (Number.isNaN(parsed.getTime())) return trimmed;
	const y = parsed.getFullYear();
	const m = String(parsed.getMonth() + 1).padStart(2, '0');
	const d = String(parsed.getDate()).padStart(2, '0');
	return `${y}.${m}.${d}`;
}

export function mapConcertSummary(item: ConcertSummaryDto): CatalogConcert {
	const artistNames = Array.isArray(item.artists)
		? item.artists.map((a) => a?.name?.trim()).filter((n): n is string => Boolean(n))
		: [];
	const regionLabel = item.venue?.region
		? CONCERT_REGION_LABEL_MAP[item.venue.region] ?? item.venue.region
		: '';
	const venueName = item.venue?.name?.trim() || regionLabel;
	const rawStatus = item.saleStatus?.trim() ?? '';
	const mappedStatus = rawStatus
		? (CONCERT_STATUS_LABEL_MAP[rawStatus] ?? (rawStatus as ConcertTicketStatus))
		: undefined;

	return {
		id: item.id,
		title: item.title ?? '',
		artistName: artistNames.join(', '),
		genre: item.genre ? getGenreLabel(item.genre) : null,
		dateText: formatConcertDateText(item.startsAt),
		venue: venueName,
		price: typeof item.price === 'number' ? item.price : null,
		status: mappedStatus,
		posterUrl: item.posterUrl ?? null,
		type: item.type ?? null,
		region: item.venue?.region ?? null
	};
}

export function resolveConcertPosterUrl(concert: Pick<CatalogConcert, 'posterUrl'>): string {
	return concert.posterUrl?.trim() ?? '';
}
