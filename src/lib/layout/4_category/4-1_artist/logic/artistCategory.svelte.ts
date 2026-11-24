import { goto } from '$app/navigation';
import { api, auth } from '#lib/auth/auth.svelte';
import {
	mapArtistItem,
	resolveArtistImageUrl,
	type ArtistItemDto,
	type CatalogArtist
} from '#lib/config/artists';
import { countActiveFilters } from '#lib/common/type/filterOptions';
import {
	artistDetailState,
	catalogFeed,
	detailOverlay,
	isCatalogCategoryReady
} from '#lib/common/logic';
import { toast } from '#lib/common/logic/toast.svelte';
import { prewarmFdImages } from '#lib/common/design/fluid/FdImage.svelte';
import {
	CatalogFeedController,
	type CatalogSnapshotSeed
} from '../../_shared/logic/catalogFeedController.svelte';

interface CursorPage<T> {
	items: T[];
	nextCursor: string | null;
	hasNext: boolean;
}

interface FollowItem {
	artistId: number;
	followedAt: string;
}

export interface ArtistOriginRect {
	left: number;
	top: number;
	width: number;
	height: number;
}

export interface ArtistSelectPayload {
	artist: CatalogArtist;
	originRect: ArtistOriginRect | null;
	waveColor: string;
	following: boolean;
}

/**
 * 4-1_artist 카테고리 전용 컨트롤러
 * - 아티스트 목록 페이지네이션(CatalogFeedController), 스플래시 프리페치 복원,
 *   팔로우 상태 동기화 및 토글, 상세 진입 전환 상태(artistDetailState)를 전담합니다.
 */
export class ArtistCategoryController {
	readonly feed: CatalogFeedController<CatalogArtist, ArtistItemDto>;
	followedIds = $state<Set<number>>(new Set());
	pendingFollowIds = $state<Set<number>>(new Set());

	private lastSyncedAuthKey = '';

	constructor() {
		this.feed = new CatalogFeedController<CatalogArtist, ArtistItemDto>({
			category: 'artist',
			entityLabel: '아티스트',
			mapItem: mapArtistItem,
			consumeInitialSnapshot: (requestKey) => this.consumeSnapshot(requestKey),
			onPageLoaded: (res, isFirstPage) => {
				artistDetailState.cacheArtists(this.feed.items);

				// 팔로우 탭 응답으로 받은 아티스트는 팔로우 상태에 즉시 반영
				if (catalogFeed.resolvedFeedMode === 'follow' && res.items.length > 0) {
					const synced = new Set(this.followedIds);
					for (const item of res.items) {
						synced.add(item.id);
					}
					this.followedIds = synced;
				}

				if (isFirstPage && !res.degraded && res.items.length > 0) {
					prewarmFdImages(res.items.map(resolveArtistImageUrl), 8);
				}
			}
		});
	}

	get emptyTitle(): string {
		const mode = catalogFeed.resolvedFeedMode;
		const query = catalogFeed.debouncedQuery.trim();
		const hasFilters = this.hasActiveFilters;

		if (mode === 'follow') {
			return query || hasFilters
				? '조건에 맞는 팔로우 아티스트가 없습니다'
				: '팔로우한 아티스트가 없습니다';
		}
		if (query) return `'${query}'에 대한 아티스트가 없습니다`;
		if (hasFilters) return '선택한 조건에 맞는 아티스트가 없습니다';
		return '등록된 아티스트가 없습니다';
	}

	get emptyDescription(): string {
		const mode = catalogFeed.resolvedFeedMode;
		const query = catalogFeed.debouncedQuery.trim();

		if (query || this.hasActiveFilters) {
			return '검색어 또는 필터 조건을 다시 확인해 보세요.';
		}
		if (mode === 'follow') {
			return '관심 있는 아티스트를 팔로우하면 이곳에서 모아볼 수 있습니다.';
		}
		return '새로운 아티스트가 등록되면 이곳에서 만나보실 수 있습니다.';
	}

	private get hasActiveFilters(): boolean {
		return countActiveFilters({
			genres: catalogFeed.filterState.genres,
			regions: [],
			statuses: [],
			concertTypes: [],
			forms: [],
			priceRange: null,
			sort: ''
		}) > 0;
	}

	/** 상위 섹션 활성 상태 및 검색/필터/피드 파라미터 동기화 */
	sync = (active: boolean): void => {
		const canSync = active && isCatalogCategoryReady('artist', true);
		this.feed.sync(canSync, {
			feedMode: catalogFeed.resolvedFeedMode,
			query: catalogFeed.debouncedQuery,
			filterState: catalogFeed.filterState,
			refreshTick: catalogFeed.refreshTick
		});
	};

	/** 로그인 상태 변경 시 내 팔로우 목록 동기화 */
	syncFollowsForAuth = (): void => {
		const authKey = `${auth.isLoggedIn}:${auth.user?.userId ?? ''}`;
		if (authKey === this.lastSyncedAuthKey) return;
		this.lastSyncedAuthKey = authKey;

		if (!auth.isLoggedIn) {
			this.followedIds = new Set();
			return;
		}
		void this.fetchMyFollows();
	};

	isFollowing = (artistId: number): boolean => {
		return artistDetailState.getFollowing(artistId) ?? this.followedIds.has(artistId);
	};

	isFollowPending = (artistId: number): boolean => {
		return this.pendingFollowIds.has(artistId);
	};

	/** M4 POST / M5 DELETE /api/members/follows/{artistId} */
	toggleFollow = async (artist: CatalogArtist, nextFollowing: boolean): Promise<void> => {
		if (this.pendingFollowIds.has(artist.id)) return;

		if (!auth.isLoggedIn) {
			toast.info('로그인 후 아티스트를 팔로우할 수 있습니다.');
			return;
		}

		const prevFollowed = new Set(this.followedIds);
		const updated = new Set(this.followedIds);
		if (nextFollowing) {
			updated.add(artist.id);
		} else {
			updated.delete(artist.id);
		}
		this.followedIds = updated;
		artistDetailState.setFollowing(artist.id, nextFollowing);

		const nextPending = new Set(this.pendingFollowIds);
		nextPending.add(artist.id);
		this.pendingFollowIds = nextPending;

		try {
			if (nextFollowing) {
				await api<{ artistId: number; following: boolean }>(
					`/api/members/follows/${artist.id}`,
					{ method: 'POST' }
				);
			} else {
				await api<void>(`/api/members/follows/${artist.id}`, {
					method: 'DELETE'
				});
			}
		} catch (err) {
			console.error('Follow toggle failed:', err);
			this.followedIds = prevFollowed;
			artistDetailState.setFollowing(artist.id, !nextFollowing);
			toast.error('팔로우 상태를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.');
		} finally {
			const donePending = new Set(this.pendingFollowIds);
			donePending.delete(artist.id);
			this.pendingFollowIds = donePending;
		}
	};

	/** 아티스트 카드 선택 시 상세 전환 정보 준비 후 라우트 이동 */
	selectArtist = (payload: ArtistSelectPayload): void => {
		detailOverlay.prepareOpen({
			category: 'artist',
			itemId: payload.artist.id,
			originRect: payload.originRect,
			shape: 'circle',
			accentColor: payload.waveColor
		});
		artistDetailState.prepareEnter({
			artistId: payload.artist.id,
			artist: payload.artist,
			following: payload.following,
			waveColor: payload.waveColor,
			rect: payload.originRect
		});
		void goto(`/artist/${payload.artist.id}`, { reset: false });
	};

	private consumeSnapshot(requestKey: string): CatalogSnapshotSeed<CatalogArtist> | null {
		const snap = catalogFeed.getArtistSnapshot();
		if (!snap || snap.artists.length === 0) return null;

		const genreJoined = catalogFeed.filterState.genres.join(',');
		const matches = snap.requestKey
			? snap.requestKey === requestKey
			: snap.query === catalogFeed.debouncedQuery && snap.genre === genreJoined;
		if (!matches) return null;

		artistDetailState.cacheArtists(snap.artists);
		return {
			items: snap.artists,
			page: snap.currentPage,
			hasNext: snap.hasNext,
			requestKey: snap.requestKey
		};
	}

	private async fetchMyFollows(): Promise<void> {
		try {
			const allFollowed = new Set<number>();
			let cursor: string | null = null;
			let guard = 0;

			do {
				const qs = new URLSearchParams({ size: '50' });
				if (cursor) qs.set('cursor', cursor);
				const page = await api<CursorPage<FollowItem>>(
					`/api/members/follows?${qs.toString()}`
				);
				if (!page || !Array.isArray(page.items)) break;
				for (const item of page.items) {
					if (typeof item.artistId === 'number') {
						allFollowed.add(item.artistId);
					}
				}
				cursor = page.hasNext ? page.nextCursor : null;
				guard++;
			} while (cursor && guard < 5);

			this.followedIds = allFollowed;
		} catch (err) {
			console.warn('Failed to sync followed artists:', err);
		}
	}
}
