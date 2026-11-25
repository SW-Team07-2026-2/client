import { goto } from '$app/navigation';
import {
	mapPhysicalItem,
	resolveAlbumCoverUrl,
	resolveAlbumMediaKind,
	type CatalogAlbum,
	type PhysicalItemDto
} from '#lib/common/catalog/albums';
import { countActiveFilters } from '#lib/common/type/filterOptions';
import { catalogFeed, isCatalogCategoryReady } from '#lib/common/logic';
import { CatalogFeedController } from '../../_shared/logic/catalogFeedController.svelte';
import { albumDetailState, type AlbumMediaItem } from './albumDetailState.svelte';

export interface AlbumFormatPrice {
	format: string;
	minPrice: number | null;
	maxPrice?: number | null;
	soldOut: boolean;
}

export interface AlbumCardGroup {
	key: string;
	/** 상세 라우트 이동용 대표 ID (albumId 우선, 없으면 첫 상품 ID) */
	routeId: number;
	albumId: number | null;
	title: string;
	artistName: string;
	frontCoverUrl: string;
	mediaItems: AlbumMediaItem[];
	formatPrices: AlbumFormatPrice[];
	isSoldOut: boolean;
	primaryItem: CatalogAlbum;
}

export interface AlbumSelectPayload {
	group: AlbumCardGroup;
}

const FORMAT_ORDER: Record<string, number> = {
	LP: 0,
	CD: 1,
	카세트: 2
};

function toMediaItem(album: CatalogAlbum): AlbumMediaItem {
	return {
		id: album.id,
		kind: resolveAlbumMediaKind(album),
		formatLabel: album.format || album.rawFormat || '',
		imageUrl: album.mediaImageUrl?.trim() ?? '',
		price: album.price ?? null,
		soldOut: album.stockStatus === '품절',
		label: album.title || album.format || undefined
	};
}

/**
 * 4-3_album 카테고리 전용 컨트롤러
 * - 피지컬 음반 목록을 albumId 기준으로 앨범 카드 1개씩 묶고,
 *   소속 LP·CD·카세트 전체를 부채꼴 미디어 + 포맷 뱃지 목록 + 최저가로 통합 제공합니다.
 */
export class AlbumCategoryController {
	readonly feed: CatalogFeedController<CatalogAlbum, PhysicalItemDto>;

	constructor() {
		this.feed = new CatalogFeedController<CatalogAlbum, PhysicalItemDto>({
			category: 'album',
			entityLabel: '앨범',
			mapItem: mapPhysicalItem,
			onPageLoaded: (res) => {
				albumDetailState.cacheAlbums(this.feed.items);
				albumDetailState.ensureAlbumCovers(res.items.map((item) => item.albumId));
			}
		});
	}

	/**
	 * 같은 albumId를 가진 피지컬 상품들을 앨범 단위 카드 1개로 통합.
	 * - 제목: 실제 앨범명(meta.title -> albumTitle -> item.title)
	 * - 앞쪽 커버: 실제 앨범 커버(meta.coverUrl -> 상품 썸네일)
	 * - 뒤쪽 미디어: 해당 앨범의 모든 LP·CD·카세트(최대 4개)
	 * - 하단 메타: 보유 포맷 뱃지 전부 + 최저가
	 */
	get groupedAlbums(): AlbumCardGroup[] {
		const groups = new Map<string, CatalogAlbum[]>();

		for (const item of this.feed.items) {
			const key =
				typeof item.albumId === 'number' && Number.isFinite(item.albumId)
					? `album:${item.albumId}`
					: `item:${item.id}`;
			const list = groups.get(key);
			if (list) {
				list.push(item);
			} else {
				groups.set(key, [item]);
			}
		}

		const result: AlbumCardGroup[] = [];

		for (const [key, items] of groups) {
			const primary = items[0];
			const albumId =
				typeof primary.albumId === 'number' && Number.isFinite(primary.albumId)
					? primary.albumId
					: null;
			const meta = albumDetailState.getAlbumMeta(albumId);

			// 메타에서 받은 physicalAlbums[]와 목록에서 묶인 items를 id 기준으로 병합
			const mediaById = new Map<number, AlbumMediaItem>();
			if (meta && meta.mediaItems.length > 0) {
				for (const m of meta.mediaItems) {
					mediaById.set(m.id, m);
				}
			}
			for (const item of items) {
				const fromFeed = toMediaItem(item);
				const existing = mediaById.get(item.id);
				mediaById.set(item.id, existing ? { ...existing, ...fromFeed, imageUrl: existing.imageUrl || fromFeed.imageUrl } : fromFeed);
			}

			const mediaItems = Array.from(mediaById.values()).slice(0, 4);

			const formatMap = new Map<
				string,
				{ minPrice: number | null; maxPrice: number | null; soldOut: boolean }
			>();
			let allSoldOut = mediaItems.length > 0;

			for (const m of mediaItems) {
				const fmt = m.formatLabel || '음반';
				const prev = formatMap.get(fmt);
				const hasPrice = typeof m.price === 'number' && Number.isFinite(m.price);
				if (!m.soldOut) allSoldOut = false;

				if (!prev) {
					formatMap.set(fmt, {
						minPrice: hasPrice ? (m.price as number) : null,
						maxPrice: hasPrice ? (m.price as number) : null,
						soldOut: m.soldOut
					});
				} else {
					const nextMin =
						hasPrice && (prev.minPrice === null || (m.price as number) < prev.minPrice)
							? (m.price as number)
							: prev.minPrice;
					const nextMax =
						hasPrice && (prev.maxPrice === null || (m.price as number) > prev.maxPrice)
							? (m.price as number)
							: prev.maxPrice;
					formatMap.set(fmt, {
						minPrice: nextMin,
						maxPrice: nextMax,
						soldOut: prev.soldOut && m.soldOut
					});
				}
			}

			const sortedFormats = Array.from(formatMap.keys()).sort(
				(a, b) => (FORMAT_ORDER[a] ?? 99) - (FORMAT_ORDER[b] ?? 99)
			);
			const formatPrices: AlbumFormatPrice[] = sortedFormats.map((format) => {
				const entry = formatMap.get(format)!;
				return {
					format,
					minPrice: entry.minPrice,
					maxPrice: entry.maxPrice,
					soldOut: entry.soldOut
				};
			});

			const title = meta?.title || primary.albumTitle?.trim() || primary.title;
			const frontCoverUrl = meta?.coverUrl || resolveAlbumCoverUrl(primary);

			result.push({
				key,
				routeId: primary.id,
				albumId,
				title,
				artistName: primary.artistName,
				frontCoverUrl,
				mediaItems,
				formatPrices,
				isSoldOut: allSoldOut,
				primaryItem: primary
			});
		}

		return result;
	}

	get emptyTitle(): string {
		const mode = catalogFeed.resolvedFeedMode;
		const query = catalogFeed.debouncedQuery.trim();
		const hasFilters = this.hasActiveFilters;

		if (mode === 'follow') {
			return query || hasFilters
				? '조건에 맞는 팔로우 아티스트의 음반이 없습니다'
				: '팔로우한 아티스트의 음반이 없습니다';
		}
		if (query) return `'${query}'에 대한 음반이 없습니다`;
		if (hasFilters) return '선택한 조건에 맞는 음반이 없습니다';
		return '등록된 음반이 없습니다';
	}

	get emptyDescription(): string {
		const mode = catalogFeed.resolvedFeedMode;
		const query = catalogFeed.debouncedQuery.trim();

		if (query || this.hasActiveFilters) {
			return '검색어 또는 필터 조건을 다시 확인해 보세요.';
		}
		if (mode === 'follow') {
			return '관심 있는 아티스트를 팔로우하면 발매 음반을 이곳에서 모아볼 수 있습니다.';
		}
		return '새로운 음반 및 LP가 등록되면 이곳에서 만나보실 수 있습니다.';
	}

	private get hasActiveFilters(): boolean {
		return (
			countActiveFilters({
				genres: catalogFeed.filterState.genres,
				regions: [],
				statuses: [],
				concertTypes: [],
				forms: catalogFeed.filterState.forms,
				priceRange: catalogFeed.filterState.priceRange,
				excludeSoldOut: catalogFeed.filterState.excludeSoldOut,
				sort: ''
			}) > 0
		);
	}

	/** 상위 섹션 활성 상태 및 검색/필터/피드 파라미터 동기화 */
	sync = (active: boolean): void => {
		const canSync = active && isCatalogCategoryReady('album', true);
		this.feed.sync(canSync, {
			feedMode: catalogFeed.resolvedFeedMode,
			query: catalogFeed.debouncedQuery,
			filterState: catalogFeed.filterState,
			refreshTick: catalogFeed.refreshTick
		});
	};

	/** 앨범 카드 선택 시 캐시 저장 후 상세 라우트 이동 */
	selectAlbum = (payload: AlbumSelectPayload): void => {
		const { group } = payload;
		albumDetailState.cacheAlbum({
			...group.primaryItem,
			title: group.title,
			coverUrl: group.frontCoverUrl || group.primaryItem.coverUrl
		});
		void goto(`/album/${group.routeId}`, { reset: false });
	};
}
