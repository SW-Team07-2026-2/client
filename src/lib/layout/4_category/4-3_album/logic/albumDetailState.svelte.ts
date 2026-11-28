import { api } from '#lib/auth/auth.svelte';
import {
	mapPhysicalItem,
	resolveAlbumMediaKind,
	type CatalogAlbum,
	type PhysicalItemDto
} from '#lib/common/catalog/albums';

export interface AlbumMediaItem {
	id: number;
	kind: 'lp' | 'cd' | 'cassette';
	formatLabel: string;
	imageUrl: string;
	price: number | null;
	soldOut: boolean;
	label?: string;
}

export interface AlbumMetaCacheEntry {
	title: string | null;
	type: string | null;
	coverUrl: string | null;
	mediaItems: AlbumMediaItem[];
}

interface AlbumDetailResponseDto {
	id: number;
	title?: string | null;
	type?: string | null;
	thumbnailUrl?: string | null;
	physicalAlbums?: PhysicalItemDto[] | null;
}

const COVER_FETCH_CONCURRENCY = 4;
const MAX_FAN_MEDIA_ITEMS = 4;

/**
 * 앨범 목록 <-> 상세 간 앨범 데이터 캐시 및
 * albumId별 실제 앨범 메타(제목·커버) + 소속 피지컬 상품(LP/CD/카세트) 조회 캐시 스토어.
 */
class AlbumDetailStateStore {
	private cache = new Map<number, CatalogAlbum>();
	private albumMetaCache = $state<Record<number, AlbumMetaCacheEntry>>({});
	private inFlightAlbumIds = new Set<number>();
	private visitedAlbumDetail = false;

	/**
	 * 페이지 새로고침 전 세션 동안 앨범 상세 페이지 최초 진입 여부 1회 소비.
	 * 한 번이라도 앨범 상세에 들어간 뒤에는 이후 다른 앨범 상세 진입 시 항상 false 반환.
	 */
	consumeFirstDetailVisit(): boolean {
		if (this.visitedAlbumDetail) return false;
		this.visitedAlbumDetail = true;
		return true;
	}

	cacheAlbum(album: CatalogAlbum): void {
		const prev = this.cache.get(album.id);
		this.cache.set(album.id, { ...prev, ...album });
	}

	cacheAlbums(albums: CatalogAlbum[]): void {
		for (const album of albums) {
			this.cacheAlbum(album);
		}
	}

	getCachedAlbum(albumId: number): CatalogAlbum | null {
		return this.cache.get(albumId) ?? null;
	}

	/** GET /api/catalog/albums/{albumId}에서 조회해 둔 앨범 메타(커버·제목·피지컬 목록) 반환 */
	getAlbumMeta(albumId?: number | null): AlbumMetaCacheEntry | null {
		if (typeof albumId !== 'number' || !Number.isFinite(albumId)) return null;
		return this.albumMetaCache[albumId] ?? null;
	}

	/**
	 * 목록에 등장한 고유 albumId들의 실제 앨범 커버와 소속 피지컬 상품 목록을
	 * 중복 없이 백그라운드 조회해 캐싱합니다.
	 */
	ensureAlbumCovers(albumIds: readonly (number | null | undefined)[]): void {
		const queue: number[] = [];
		const seen = new Set<number>();

		for (const rawId of albumIds) {
			if (typeof rawId !== 'number' || !Number.isFinite(rawId)) continue;
			if (seen.has(rawId)) continue;
			if (Object.prototype.hasOwnProperty.call(this.albumMetaCache, rawId)) continue;
			if (this.inFlightAlbumIds.has(rawId)) continue;
			seen.add(rawId);
			queue.push(rawId);
		}

		if (queue.length === 0) return;

		let cursor = 0;
		const workerCount = Math.min(COVER_FETCH_CONCURRENCY, queue.length);

		const runWorker = async () => {
			while (cursor < queue.length) {
				const albumId = queue[cursor++];
				this.inFlightAlbumIds.add(albumId);
				try {
					const dto = await api<AlbumDetailResponseDto>(`/api/catalog/albums/${albumId}`);
					const coverUrl = dto?.thumbnailUrl?.trim() || null;
					const title = dto?.title?.trim() || null;
					const type = dto?.type?.trim() || null;
					const physicals = Array.isArray(dto?.physicalAlbums) ? dto.physicalAlbums : [];
					const mediaItems: AlbumMediaItem[] = physicals
						.slice(0, MAX_FAN_MEDIA_ITEMS)
						.map((p) => {
							const mapped = mapPhysicalItem(p);
							return {
								id: mapped.id,
								kind: resolveAlbumMediaKind(mapped),
								formatLabel: mapped.format || p.format?.trim() || '',
								imageUrl: mapped.mediaImageUrl?.trim() ?? '',
								price: mapped.price ?? null,
								soldOut: mapped.stockStatus === '품절',
								label: mapped.title || mapped.format || undefined
							};
						});

					this.albumMetaCache = {
						...this.albumMetaCache,
						[albumId]: { title, type, coverUrl, mediaItems }
					};
				} catch {
					this.albumMetaCache = {
						...this.albumMetaCache,
						[albumId]: { title: null, type: null, coverUrl: null, mediaItems: [] }
					};
				} finally {
					this.inFlightAlbumIds.delete(albumId);
				}
			}
		};

		for (let i = 0; i < workerCount; i++) {
			void runWorker();
		}
	}

	/** 보유 음반(콜렉션) 등록·해제 시 증가하는 전역 리비전 (마이페이지 즉시 동기화용) */
	collectionRevision = $state(0);

	notifyCollectionChanged(): void {
		this.collectionRevision += 1;
	}
}

export const albumDetailState = new AlbumDetailStateStore();
