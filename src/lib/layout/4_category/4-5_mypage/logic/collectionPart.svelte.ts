import { goto } from '$app/navigation';
import { api } from '#lib/auth/auth.svelte';
import {
	mapPhysicalItem,
	resolveAlbumCoverUrl,
	resolveAlbumMediaKind,
	type CatalogAlbum
} from '#lib/common/catalog/albums';
import type {
	AlbumCardGroup,
	AlbumFormatPrice,
	AlbumSelectPayload
} from '../../4-3_album/logic/albumCategory.svelte';
import { albumDetailState, type AlbumMediaItem } from '../../4-3_album/logic/albumDetailState.svelte';

export interface CollectionItemDto {
	id: number;
	physicalAlbumId: number;
	optionId: number;
	source: 'MANUAL' | 'PURCHASE' | string;
	acquiredAt: string | null;
}

interface CollectionCursorResponse {
	items?: CollectionItemDto[] | null;
	nextCursor?: string | null;
	hasNext?: boolean;
}

interface ProductOptionDto {
	id: number;
	name?: string | null;
	price?: number | null;
	qty?: number | null;
	soldOut?: boolean | null;
}

interface ProductDetailDto {
	id: number;
	productType?: string | null;
	name?: string | null;
	thumbnailUrl?: string | null;
	artistId?: number | null;
	artistName?: string | null;
	albumId?: number | null;
	albumTitle?: string | null;
	format?: string | null;
	releasedAt?: string | null;
	options?: ProductOptionDto[] | null;
}

interface ProductListResponse {
	items?: ProductDetailDto[] | null;
}

const FORMAT_ORDER: Record<string, number> = {
	LP: 0,
	CD: 1,
	카세트: 2
};

function productToCatalogAlbum(product: ProductDetailDto, optionId: number): CatalogAlbum {
	const options = Array.isArray(product.options) ? product.options : [];
	const matchedOpt = options.find((opt) => opt.id === optionId);
	const numericPrices = options
		.map((opt) => opt.price)
		.filter((p): p is number => typeof p === 'number' && Number.isFinite(p));
	const minPrice =
		typeof matchedOpt?.price === 'number' && Number.isFinite(matchedOpt.price)
			? matchedOpt.price
			: numericPrices.length > 0
				? Math.min(...numericPrices)
				: null;

	return mapPhysicalItem({
		id: product.id,
		albumId: product.albumId ?? null,
		albumTitle: product.albumTitle ?? null,
		artistId: product.artistId ?? null,
		artistName: product.artistName ?? null,
		format: product.format ?? null,
		name: product.name ?? null,
		releasedAt: product.releasedAt ?? null,
		thumbnailUrl: product.thumbnailUrl ?? null,
		minPrice,
		soldOut: false
	});
}

function toMediaItem(album: CatalogAlbum): AlbumMediaItem {
	return {
		id: album.id,
		kind: resolveAlbumMediaKind(album),
		formatLabel: album.format || album.rawFormat || '',
		imageUrl: album.mediaImageUrl?.trim() ?? '',
		price: album.price ?? null,
		soldOut: false,
		label: album.title || album.format || undefined
	};
}

/**
 * 마이페이지 > 보유 음반 파트 컨트롤러
 * - GET /api/members/collections (커서 페이징)
 * - GET /api/catalog/products?ids=... (보유 상품 상세 일괄 조회)
 * - 4-3_album과 동일한 AlbumCardGroup 구조로 변환해 PcAlbumItem · MbAlbumItem을 그대로 재사용합니다.
 */
export class CollectionPartController {
	collections = $state<CollectionItemDto[]>([]);
	productsById = $state<Record<number, ProductDetailDto>>({});
	isLoading = $state(false);
	isLoadingMore = $state(false);
	errorMessage = $state<string | null>(null);
	nextCursor = $state<string | null>(null);
	hasNext = $state(false);

	private loaded = false;
	private syncedRevision = -1;

	get totalCount(): number {
		return this.collections.length;
	}

	/** 보유 음반 목록을 albumId 단위 AlbumCardGroup으로 통합 */
	get groupedAlbums(): AlbumCardGroup[] {
		const groups = new Map<string, CatalogAlbum[]>();

		for (const col of this.collections) {
			const product = this.productsById[col.physicalAlbumId];
			if (!product) continue;

			const catalogAlbum = productToCatalogAlbum(product, col.optionId);
			const key =
				typeof catalogAlbum.albumId === 'number' && Number.isFinite(catalogAlbum.albumId)
					? `album:${catalogAlbum.albumId}`
					: `item:${catalogAlbum.id}`;
			const list = groups.get(key);
			if (list) {
				list.push(catalogAlbum);
			} else {
				groups.set(key, [catalogAlbum]);
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

			const mediaById = new Map<number, AlbumMediaItem>();
			for (const item of items) {
				const fromOwned = toMediaItem(item);
				const fromMeta = meta?.mediaItems.find((m) => m.id === item.id);
				mediaById.set(
					item.id,
					fromMeta
						? { ...fromMeta, ...fromOwned, imageUrl: fromMeta.imageUrl || fromOwned.imageUrl }
						: fromOwned
				);
			}

			const mediaItems = Array.from(mediaById.values()).slice(0, 4);

			const formatMap = new Map<string, { minPrice: number | null; maxPrice: number | null }>();
			for (const m of mediaItems) {
				const fmt = m.formatLabel || '음반';
				const prev = formatMap.get(fmt);
				const hasPrice = typeof m.price === 'number' && Number.isFinite(m.price);
				if (!prev) {
					formatMap.set(fmt, {
						minPrice: hasPrice ? (m.price as number) : null,
						maxPrice: hasPrice ? (m.price as number) : null
					});
				} else {
					formatMap.set(fmt, {
						minPrice:
							hasPrice && (prev.minPrice === null || (m.price as number) < prev.minPrice)
								? (m.price as number)
								: prev.minPrice,
						maxPrice:
							hasPrice && (prev.maxPrice === null || (m.price as number) > prev.maxPrice)
								? (m.price as number)
								: prev.maxPrice
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
					soldOut: false
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
				isSoldOut: false,
				primaryItem: primary
			});
		}

		return result;
	}

	private async fetchMissingProducts(ids: number[]): Promise<void> {
		const missing = Array.from(
			new Set(ids.filter((id) => Number.isFinite(id) && !this.productsById[id]))
		);
		if (missing.length === 0) return;

		const nextMap: Record<number, ProductDetailDto> = { ...this.productsById };
		const albumIdsToHydrate: Array<number | null | undefined> = [];

		// /api/catalog/products?ids= 최대 50개 단위 일괄 조회
		for (let i = 0; i < missing.length; i += 50) {
			const chunk = missing.slice(i, i + 50);
			const res = await api<ProductListResponse>(
				`/api/catalog/products?ids=${chunk.join(',')}`
			);
			const items = Array.isArray(res?.items) ? res.items : [];
			for (const prod of items) {
				if (typeof prod?.id === 'number') {
					nextMap[prod.id] = prod;
					albumIdsToHydrate.push(prod.albumId);
				}
			}
		}

		this.productsById = nextMap;
		if (albumIdsToHydrate.length > 0) {
			albumDetailState.ensureAlbumCovers(albumIdsToHydrate);
		}
	}

	/** 최초 1회, 강제 새로고침, 또는 앨범 상세에서 보유 음반이 변경된 경우 최신 목록 로드 */
	load = async (force = false): Promise<void> => {
		if (this.isLoading) return;
		const rev = albumDetailState.collectionRevision;
		if (this.loaded && !force && this.syncedRevision === rev) return;

		this.isLoading = true;
		this.errorMessage = null;
		try {
			const res = await api<CollectionCursorResponse>('/api/members/collections?size=20');
			const items = Array.isArray(res?.items) ? res.items : [];
			await this.fetchMissingProducts(items.map((it) => it.physicalAlbumId));
			this.collections = items;
			this.nextCursor = res?.nextCursor ?? null;
			this.hasNext = Boolean(res?.hasNext && this.nextCursor);
			this.loaded = true;
			this.syncedRevision = rev;
		} catch (err) {
			console.error('Failed to load collections:', err);
			this.errorMessage = '보유 음반 목록을 불러오지 못했습니다.';
		} finally {
			this.isLoading = false;
		}
	};

	/** 다음 페이지 커서 추가 로드 */
	loadMore = async (): Promise<void> => {
		if (this.isLoading || this.isLoadingMore || !this.hasNext || !this.nextCursor) return;

		this.isLoadingMore = true;
		try {
			const qs = new URLSearchParams({ cursor: this.nextCursor, size: '20' });
			const res = await api<CollectionCursorResponse>(`/api/members/collections?${qs.toString()}`);
			const nextItems = Array.isArray(res?.items) ? res.items : [];
			await this.fetchMissingProducts(nextItems.map((it) => it.physicalAlbumId));

			const seen = new Set(this.collections.map((it) => it.id));
			this.collections = [...this.collections, ...nextItems.filter((it) => !seen.has(it.id))];
			this.nextCursor = res?.nextCursor ?? null;
			this.hasNext = Boolean(res?.hasNext && this.nextCursor);
		} catch (err) {
			console.error('Failed to load more collections:', err);
		} finally {
			this.isLoadingMore = false;
		}
	};

	/** 앨범 카드 클릭 시 캐시 저장 후 앨범 상세 라우트로 이동 */
	selectAlbum = (payload: AlbumSelectPayload): void => {
		const { group } = payload;
		albumDetailState.cacheAlbum({
			...group.primaryItem,
			title: group.title,
			coverUrl: group.frontCoverUrl || group.primaryItem.coverUrl
		});
		void goto(`/album/${group.routeId}`, { reset: false });
	};

	/** 빈 상태에서 음반 카테고리로 이동 */
	browseAlbums = (): void => {
		void goto('/album', { reset: false });
	};
}
