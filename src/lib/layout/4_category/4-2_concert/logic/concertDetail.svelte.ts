import { api, auth } from '#lib/auth/auth.svelte';
import {
	type CatalogConcert,
	type ConcertArtistSummaryDto
} from '#lib/common/catalog/concerts';
import {
	DETAIL_GLOW_COLOR_OPTIONS,
	getCachedImageAverageColor,
	loadImageAverageColor
} from '#lib/common/design/fluid/imageColor';
import { toast } from '#lib/common/logic';
import { navigateDetailToDetail } from '#lib/common/logic/detailNavigation';
import {
	CONCERT_REGION_OPTIONS,
	CONCERT_STATUS_OPTIONS,
	CONCERT_TYPE_OPTIONS,
	getGenreLabel
} from '#lib/common/type/filterOptions';
import { shareCurrentPage } from '../../_shared/logic/shareLink';
import { fetchDetailWithPrefetch } from '../../_shared/logic/detailPrefetch';
import { concertDetailState } from './concertDetailState.svelte';

export interface ConcertVenueDetail {
	id: number | null;
	name: string;
	region: string;
	address: string;
	capacity: number | null;
}

export interface ConcertLineupArtist {
	id: number;
	name: string;
	genre: string;
}

interface ConcertDetailDto {
	id: number;
	title: string;
	type?: string | null;
	genre?: string | null;
	artists?: ConcertArtistSummaryDto[] | null;
	startsAt?: string | null;
	endsAt?: string | null;
	price?: number | null;
	saleStatus?: string | null;
	bookingOpenAt?: string | null;
	queueEnabled?: boolean | null;
	maxSeatsPerUser?: number | null;
	venue?: {
		id?: number | null;
		name?: string | null;
		region?: string | null;
		address?: string | null;
		capacity?: number | null;
	} | null;
	description?: string | null;
	terms?: string | null;
	requirements?: string | null;
	posterUrl?: string | null;
	imageUrls?: string[] | null;
}

const STATUS_LABELS: Record<string, string> = Object.fromEntries(
	CONCERT_STATUS_OPTIONS.map((o) => [o.value, o.label])
);
const REGION_LABELS: Record<string, string> = Object.fromEntries(
	CONCERT_REGION_OPTIONS.map((o) => [o.value, o.label])
);
const TYPE_LABELS: Record<string, string> = Object.fromEntries(
	CONCERT_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

function formatDateTime(raw?: string | null): string {
	if (!raw) return '';
	const trimmed = raw.trim();
	const parsed = new Date(trimmed);
	if (Number.isNaN(parsed.getTime())) return trimmed.replace('T', ' ').slice(0, 16);
	const y = parsed.getFullYear();
	const m = String(parsed.getMonth() + 1).padStart(2, '0');
	const d = String(parsed.getDate()).padStart(2, '0');
	const days = ['일', '월', '화', '수', '목', '금', '토'];
	const dow = days[parsed.getDay()];
	const hh = String(parsed.getHours()).padStart(2, '0');
	const mm = String(parsed.getMinutes()).padStart(2, '0');
	return `${y}.${m}.${d} (${dow}) ${hh}:${mm}`;
}

/**
 * 4-2_concert 상세 페이지 전용 컨트롤러
 * - 캐시 즉시 복원 + `GET /api/concerts/{id}` 상세 조회
 * - 라인업 아티스트 이동, 평균색 앰비언트 글로우, 링크 공유, 예매 시작 액션 전담
 */
export class ConcertDetailController {
	isLoading = $state(false);
	errorMessage = $state<string | null>(null);

	title = $state('');
	typeLabel = $state('');
	genreLabel = $state('');
	saleStatus = $state<string>('');
	saleStatusLabel = $state('');
	startsAtText = $state('');
	endsAtText = $state('');
	bookingOpenAtText = $state('');
	price = $state<number | null>(null);
	queueEnabled = $state(false);
	maxSeatsPerUser = $state<number | null>(null);

	artists = $state<ConcertLineupArtist[]>([]);
	venue = $state<ConcertVenueDetail | null>(null);
	description = $state('');
	requirements = $state('');
	terms = $state('');
	posterUrl = $state('');
	imageUrls = $state<string[]>([]);
	accentColor = $state<string>('');

	private currentId: number | null = null;
	private loadToken = 0;

	get isOnSale(): boolean {
		const s = this.saleStatus.toUpperCase();
		return s === 'ON_SALE' || s === '예매중' || s === '판매중';
	}

	get isScheduled(): boolean {
		const s = this.saleStatus.toUpperCase();
		return s === 'SCHEDULED' || s === '오픈예정' || s === '판매전';
	}

	get isClosed(): boolean {
		const s = this.saleStatus.toUpperCase();
		return s === 'CLOSED' || s === '매진' || s === '판매종료';
	}

	get ctaLabel(): string {
		if (this.isOnSale) return this.queueEnabled ? '대기열 입장 · 예매하기' : '좌석 선택 · 예매하기';
		if (this.isScheduled) return '예매 오픈 예정';
		if (this.isClosed) return '판매가 종료된 공연입니다';
		return '예매하기';
	}

	load = (concertId: number): void => {
		if (this.currentId === concertId && this.title) return;
		this.currentId = concertId;
		this.errorMessage = null;
		this.artists = [];
		this.venue = null;
		this.description = '';
		this.requirements = '';
		this.terms = '';
		this.imageUrls = [];
		this.endsAtText = '';
		this.bookingOpenAtText = '';
		this.maxSeatsPerUser = null;
		this.queueEnabled = false;
		this.accentColor = '';

		const cached: CatalogConcert | null = concertDetailState.getCachedConcert(concertId);
		if (cached) {
			this.title = cached.title;
			this.genreLabel = cached.genre ?? '';
			this.typeLabel = cached.type ? (TYPE_LABELS[cached.type] ?? cached.type) : '';
			this.saleStatus = cached.status ?? '';
			this.saleStatusLabel = cached.status ?? '';
			this.startsAtText = cached.dateText;
			this.price = cached.price ?? null;
			this.posterUrl = cached.posterUrl?.trim() ?? '';
			if (this.posterUrl) {
				this.accentColor =
					getCachedImageAverageColor(this.posterUrl, DETAIL_GLOW_COLOR_OPTIONS) ?? '';
			}
			if (cached.venue) {
				this.venue = {
					id: null,
					name: cached.venue,
					region: cached.region ? (REGION_LABELS[cached.region] ?? cached.region) : '',
					address: '',
					capacity: null
				};
			}
		} else {
			this.title = '';
			this.genreLabel = '';
			this.typeLabel = '';
			this.saleStatus = '';
			this.saleStatusLabel = '';
			this.startsAtText = '';
			this.price = null;
			this.posterUrl = '';
		}

		const token = ++this.loadToken;
		if (this.posterUrl && !this.accentColor) {
			void this.resolveAccentGlow(this.posterUrl, token);
		}
		void this.fetchDetail(concertId, token);
	};

	goToArtist = (artistId: number): void => {
		navigateDetailToDetail(`/artist/${artistId}`);
	};

	startBooking = (): void => {
		if (!this.isOnSale) return;
		if (!auth.isLoggedIn) {
			toast.info('로그인 후 공연을 예매할 수 있습니다.');
			return;
		}
		toast.info('좌석 선택 · 예매 플로우는 곧 연결됩니다.');
	};

	shareLink = async (): Promise<void> => {
		const title = this.title.trim();
		await shareCurrentPage({
			title: title ? `${title} · INDIG` : 'INDIG 공연',
			text: title ? `${title} 공연 정보를 확인해 보세요.` : undefined,
			fallbackSuccessMessage: '공연 링크가 복사되었습니다.'
		});
	};

	private async fetchDetail(concertId: number, token: number): Promise<void> {
		if (!this.title) {
			this.isLoading = true;
		}

		try {
			const dto = await fetchDetailWithPrefetch<ConcertDetailDto>(`/api/concerts/${concertId}`);
			if (token !== this.loadToken || !dto) return;

			this.title = dto.title?.trim() || this.title;
			const rawType = dto.type?.trim().toUpperCase() ?? '';
			this.typeLabel = rawType ? (TYPE_LABELS[rawType] ?? rawType) : this.typeLabel;
			this.genreLabel = dto.genre ? getGenreLabel(dto.genre) : this.genreLabel;

			const rawStatus = dto.saleStatus?.trim().toUpperCase() ?? '';
			this.saleStatus = rawStatus;
			this.saleStatusLabel = rawStatus ? (STATUS_LABELS[rawStatus] ?? rawStatus) : '';

			this.startsAtText = formatDateTime(dto.startsAt) || this.startsAtText;
			this.endsAtText = formatDateTime(dto.endsAt);
			this.bookingOpenAtText = formatDateTime(dto.bookingOpenAt);
			this.price = typeof dto.price === 'number' ? dto.price : this.price;
			this.queueEnabled = Boolean(dto.queueEnabled);
			this.maxSeatsPerUser =
				typeof dto.maxSeatsPerUser === 'number' ? dto.maxSeatsPerUser : null;

			this.artists = Array.isArray(dto.artists)
				? dto.artists
						.filter((a) => typeof a?.id === 'number' && Boolean(a?.name?.trim()))
						.map((a) => ({
							id: a.id,
							name: a.name.trim(),
							genre: a.genre ? getGenreLabel(a.genre) : ''
						}))
				: [];

			if (dto.venue) {
				const rawRegion = dto.venue.region?.trim() ?? '';
				this.venue = {
					id: typeof dto.venue.id === 'number' ? dto.venue.id : null,
					name: dto.venue.name?.trim() || '',
					region: rawRegion ? (REGION_LABELS[rawRegion] ?? rawRegion) : '',
					address: dto.venue.address?.trim() || '',
					capacity: typeof dto.venue.capacity === 'number' ? dto.venue.capacity : null
				};
			}

			this.description = dto.description?.trim() ?? '';
			this.requirements = dto.requirements?.trim() ?? '';
			this.terms = dto.terms?.trim() ?? '';
			this.posterUrl = dto.posterUrl?.trim() || this.posterUrl;
			this.imageUrls = Array.isArray(dto.imageUrls)
				? dto.imageUrls.map((u) => u?.trim()).filter((u): u is string => Boolean(u))
				: [];

			if (this.posterUrl) {
				void this.resolveAccentGlow(this.posterUrl, token);
			}
		} catch (err) {
			if (token !== this.loadToken) return;
			console.error('Failed to fetch concert detail:', err);
			if (!this.title) {
				this.errorMessage = '공연 정보를 불러오지 못했습니다.';
			}
		} finally {
			if (token === this.loadToken) {
				this.isLoading = false;
			}
		}
	}

	private async resolveAccentGlow(url: string, token: number): Promise<void> {
		const color = await loadImageAverageColor(url);
		if (token !== this.loadToken || !color) return;
		this.accentColor = color;
	}
}
