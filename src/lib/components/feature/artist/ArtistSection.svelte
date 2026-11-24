<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import ArtistCard from './ArtistCard.svelte';
	import CatalogSectionShell from '../shared/CatalogSectionShell.svelte';
	import { api, auth } from '#lib/auth/auth.svelte';
	import {
		mapArtistItem,
		resolveArtistImageUrl,
		type ArtistItemDto,
		type CatalogArtist
	} from '#lib/config/artists';
	import {
		CATALOG_DEFAULT_PAGE_SIZE,
		fetchCatalogPageWithTransition,
		isCatalogAuthError,
		resolveCatalogErrorMessage,
		type CatalogFeedMode
	} from '#lib/config/catalogFeed';
	import {
		cloneContentFilterState,
		countActiveFilters,
		type ContentFilterState
	} from '#lib/common/type/filterOptions';
	import { getSavedCategorySlice } from '#lib/common/logic/contentFilterStorage';
	import { prewarmFdImages } from '#lib/common/design/fluid/FdImage.svelte';
	import {
		artistDetailState,
		buildCatalogRequestKey,
		catalogFeed,
		isCatalogCategoryReady
	} from '#lib/common/logic';

	interface CursorPage<T> {
		items: T[];
		nextCursor: string | null;
		hasNext: boolean;
	}

	interface FollowItem {
		artistId: number;
		followedAt: string;
	}

	interface Props {
		/** 외부에서 직접 주입할 초기 아티스트 목록 (미지정 시 v2 API 자동 조회) */
		initialArtists?: CatalogArtist[];
		/** 외부에서 초기 팔로우 ID 목록 주입 시 사용 */
		initialFollowedIds?: number[];
		/** 피드 탭 ('recommend' | 'popular' | 'all' | 'follow') */
		feedMode?: CatalogFeedMode;
		/** 검색어 필터 (?q=) */
		query?: string;
		/** 장르 필터 (?genre=) */
		genre?: string;
		/** 통합 필터 상태 */
		filterState?: Partial<ContentFilterState>;
		/** 페이지당 조회 개수 (명세 기본 20, 최대 50) */
		pageSize?: number;
		/** 아티스트 카드 클릭 시 호출되는 콜백 */
		onArtistClick?: (artist: CatalogArtist) => void;
		/** 팔로우 상태 변경 시 호출되는 콜백 */
		onFollowChange?: (artist: CatalogArtist, following: boolean) => void;
		/** 활성화 여부 (Keep-Alive 비활성 패널 시 Observer/필터 반응 중단) */
		active?: boolean;
		/** 추가 클래스 */
		class?: string;
	}

	let {
		initialArtists,
		initialFollowedIds,
		feedMode,
		query,
		genre,
		filterState,
		pageSize = CATALOG_DEFAULT_PAGE_SIZE,
		onArtistClick,
		onFollowChange,
		active = true,
		class: klass = ''
	}: Props = $props();

	const isUsingStore = $derived(
		feedMode === undefined &&
			query === undefined &&
			genre === undefined &&
			filterState === undefined
	);
	const canSync = $derived(active && isCatalogCategoryReady('artist', isUsingStore));

	let ownFilterState = $state<ContentFilterState>(
		untrack(() => ({
			...getSavedCategorySlice('Artist'),
			sort: catalogFeed.filterState.sort
		}))
	);

	$effect.pre(() => {
		if (canSync && isUsingStore) {
			ownFilterState = cloneContentFilterState(catalogFeed.filterState);
		}
	});

	const activeFeedMode = $derived<CatalogFeedMode>(feedMode ?? catalogFeed.resolvedFeedMode);
	const activeQuery = $derived(query ?? catalogFeed.debouncedQuery);
	const activeFilterState = $derived<Partial<ContentFilterState>>(
		filterState ?? (canSync ? catalogFeed.filterState : ownFilterState)
	);
	const activeGenreList = $derived(
		activeFilterState.genres && activeFilterState.genres.length > 0
			? activeFilterState.genres
			: genre?.trim()
				? [genre.trim()]
				: []
	);
	const activeRefreshTick = $derived(isUsingStore ? catalogFeed.refreshTick : 0);

	const requestKey = $derived(
		buildCatalogRequestKey('artist', {
			feedMode: activeFeedMode,
			query: activeQuery,
			genre,
			filterState: activeFilterState,
			refreshTick: activeRefreshTick,
			authKey: `${auth.isLoggedIn}:${auth.isVerified}`
		})
	);

	const initialRestoredSnapshot = untrack(() => {
		const snap = catalogFeed.getArtistSnapshot();
		const activeKey = requestKey;
		const genreJoined = activeGenreList.join(',');
		if (
			snap &&
			snap.artists.length > 0 &&
			(snap.requestKey
				? snap.requestKey === activeKey
				: snap.query === activeQuery && snap.genre === genreJoined)
		) {
			return snap;
		}
		return null;
	});

	let artists = $state<CatalogArtist[]>(
		untrack(() => {
			if (initialArtists && initialArtists.length > 0) return [...initialArtists];
			if (initialRestoredSnapshot) return [...initialRestoredSnapshot.artists];
			return [];
		})
	);
	let followedIds = $state<Set<number>>(untrack(() => new Set(initialFollowedIds ?? [])));
	let pendingFollowIds = $state<Set<number>>(new Set());

	let currentPage = $state(untrack(() => initialRestoredSnapshot?.currentPage ?? 0));
	let hasNext = $state(untrack(() => initialRestoredSnapshot?.hasNext ?? false));
	let isLoading = $state(
		untrack(() => !(initialArtists && initialArtists.length > 0) && !initialRestoredSnapshot)
	);
	let isLoadingMore = $state(false);
	let errorMessage = $state<string | null>(null);
	let isAuthError = $state(false);
	let loadMoreErrorMessage = $state<string | null>(null);
	let latestRequestSeq = 0;
	let hasCompletedInitialLoad = untrack(
		() => Boolean(initialArtists && initialArtists.length > 0) || Boolean(initialRestoredSnapshot)
	);

	/**
	 * v2 검색(/api/catalog/search/artists) · 팔로우(/api/catalog/following/artists) 조회
	 */
	async function fetchArtistsPage(page: number, append = false) {
		const seq = ++latestRequestSeq;

		if (activeFeedMode === 'follow' && auth.isVerified && !auth.isLoggedIn) {
			artists = [];
			currentPage = 0;
			hasNext = false;
			isLoading = false;
			isLoadingMore = false;
			isAuthError = true;
			errorMessage = '팔로우한 아티스트 목록을 보려면 로그인이 필요합니다.';
			loadMoreErrorMessage = null;
			hasCompletedInitialLoad = true;
			return;
		}

		const shouldStage = !append && active && hasCompletedInitialLoad;

		if (append) {
			isLoadingMore = true;
			loadMoreErrorMessage = null;
		} else {
			isLoading = true;
			errorMessage = null;
			isAuthError = false;
			loadMoreErrorMessage = null;
		}

		try {
			const res = await fetchCatalogPageWithTransition<CatalogArtist, ArtistItemDto>(
				{
					category: 'artist',
					feedMode: activeFeedMode,
					page,
					pageSize,
					query: activeQuery,
					genre,
					filterState: activeFilterState,
					mapItem: mapArtistItem
				},
				shouldStage
			);
			if (seq !== latestRequestSeq) return;

			hasCompletedInitialLoad = true;
			artists = append ? [...artists, ...res.items] : res.items;
			artistDetailState.cacheArtists(artists);
			if (activeFeedMode === 'follow' && res.items.length > 0) {
				const synced = new Set(followedIds);
				for (const item of res.items) {
					synced.add(item.id);
				}
				followedIds = synced;
			}
			currentPage = res.page;
			hasNext = res.hasNext;
			if (!append && !canSync && !res.degraded && res.items.length > 0) {
				prewarmFdImages(res.items.map(resolveArtistImageUrl), 8);
			}
			if (res.degraded) {
				if (append) {
					loadMoreErrorMessage = '일시적으로 추가 아티스트를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
				} else if (res.items.length === 0) {
					errorMessage = '아티스트 목록을 일시적으로 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
				}
			}
		} catch (err) {
			if (seq !== latestRequestSeq) return;
			hasCompletedInitialLoad = true;
			const msg = resolveCatalogErrorMessage(err, '아티스트');
			if (append) {
				loadMoreErrorMessage = msg;
			} else {
				artists = [];
				isAuthError = isCatalogAuthError(err);
				errorMessage = msg;
			}
		} finally {
			if (seq === latestRequestSeq) {
				isLoading = false;
				isLoadingMore = false;
			}
		}
	}

	/**
	 * M6 GET /api/members/follows — 로그인 상태일 때 내 팔로우 목록 동기화
	 */
	async function syncMyFollows() {
		if (!auth.isLoggedIn) {
			followedIds = new Set();
			return;
		}

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

			followedIds = allFollowed;
		} catch (err) {
			console.warn('Failed to sync followed artists:', err);
		}
	}

	/**
	 * M4 POST /api/members/follows/{artistId} · M5 DELETE /api/members/follows/{artistId}
	 */
	async function handleFollowToggle(artist: CatalogArtist, nextFollowing: boolean) {
		if (pendingFollowIds.has(artist.id)) return;

		// 비로그인 상태일 경우 로그인 유도 안내
		if (!auth.isLoggedIn) {
			alert('로그인이 필요한 기능입니다. 로그인 후 아티스트를 팔로우해 보세요.');
			return;
		}

		const prevFollowed = new Set(followedIds);
		const updated = new Set(followedIds);
		if (nextFollowing) {
			updated.add(artist.id);
		} else {
			updated.delete(artist.id);
		}
		followedIds = updated;
		artistDetailState.setFollowing(artist.id, nextFollowing);
		onFollowChange?.(artist, nextFollowing);

		const nextPending = new Set(pendingFollowIds);
		nextPending.add(artist.id);
		pendingFollowIds = nextPending;

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
			// 서버 에러 시 원래 상태로 롤백
			followedIds = prevFollowed;
			artistDetailState.setFollowing(artist.id, !nextFollowing);
			onFollowChange?.(artist, !nextFollowing);
			alert('팔로우 상태를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.');
		} finally {
			const donePending = new Set(pendingFollowIds);
			donePending.delete(artist.id);
			pendingFollowIds = donePending;
		}
	}

	function handleLoadMore() {
		if (!hasNext || isLoadingMore) return;
		fetchArtistsPage(currentPage + 1, true);
	}

	function handleRetry() {
		fetchArtistsPage(0, false);
	}

	function handleArtistCardSelect(payload: {
		artist: CatalogArtist;
		originRect: { left: number; top: number; width: number; height: number } | null;
		waveColor: string;
		following: boolean;
	}) {
		artistDetailState.prepareEnter({
			artistId: payload.artist.id,
			artist: payload.artist,
			following: payload.following,
			waveColor: payload.waveColor,
			rect: payload.originRect
		});
		if (onArtistClick) {
			onArtistClick(payload.artist);
		} else {
			goto(`/artist/${payload.artist.id}`, { reset: false });
		}
	}

	onMount(() => {
		if (!initialFollowedIds && auth.isLoggedIn) {
			syncMyFollows();
		}
	});

	let hasLoadedInitial = untrack(
		() => Boolean(initialArtists && initialArtists.length > 0) || Boolean(initialRestoredSnapshot)
	);
	let lastLoadedKey = untrack(() => (hasLoadedInitial ? requestKey : ''));

	$effect(() => {
		if (!canSync && hasLoadedInitial) return;
		if (active && !canSync) return;
		const key = requestKey;

		if (hasLoadedInitial && key === lastLoadedKey) return;
		hasLoadedInitial = true;
		lastLoadedKey = key;
		untrack(() => {
			fetchArtistsPage(0, false);
		});
	});

	// 로그인 상태 변경 시 팔로우 목록 동기화
	$effect(() => {
		if (auth.isLoggedIn && !initialFollowedIds) {
			syncMyFollows();
		} else if (!auth.isLoggedIn && !initialFollowedIds) {
			followedIds = new Set();
		}
	});

	const hasFilters = $derived(
		countActiveFilters({
			genres: activeGenreList,
			regions: [],
			statuses: [],
			concertTypes: [],
			forms: [],
			priceRange: null,
			sort: ''
		}) > 0
	);

	const emptyTitle = $derived(
		activeFeedMode === 'follow'
			? activeQuery.trim() || hasFilters
				? '조건에 맞는 팔로우 아티스트가 없습니다'
				: '팔로우한 아티스트가 없습니다'
			: activeQuery.trim()
				? `'${activeQuery.trim()}'에 대한 아티스트가 없습니다`
				: hasFilters
					? '선택한 조건에 맞는 아티스트가 없습니다'
					: '등록된 아티스트가 없습니다'
	);

	const emptyDesc = $derived(
		activeQuery.trim() || hasFilters
			? '검색어 또는 필터 조건을 다시 확인해 보세요.'
			: activeFeedMode === 'follow'
				? '관심 있는 아티스트를 팔로우하면 이곳에서 모아볼 수 있습니다.'
				: '새로운 아티스트가 등록되면 이곳에서 만나보실 수 있습니다.'
	);

	const errorTitle = $derived(
		isAuthError ? '로그인이 필요합니다' : '아티스트 목록을 불러올 수 없습니다'
	);
</script>

<CatalogSectionShell
	class={klass}
	ariaLabel="아티스트 목록"
	{active}
	{isLoading}
	isEmpty={artists.length === 0}
	{errorMessage}
	{errorTitle}
	{emptyTitle}
	{emptyDesc}
	{loadMoreErrorMessage}
	{isLoadingMore}
	{hasNext}
	minCardWidth={176}
	mobileMinCardWidth={136}
	columnGap="1.8125rem"
	rowGap="2.6875rem"
	mobileColumnGap="1.375rem"
	mobileRowGap="2.25rem"
	skeletonAspect="1 / 1"
	skeletonRadius="999px"
	onRetry={handleRetry}
	onLoadMore={handleLoadMore}
>
	{#each artists as artist (artist.id)}
		<ArtistCard
			{artist}
			following={artistDetailState.getFollowing(artist.id) ?? followedIds.has(artist.id)}
			followLoading={pendingFollowIds.has(artist.id)}
			interactive={active}
			onFollowToggle={handleFollowToggle}
			onSelect={handleArtistCardSelect}
		/>
	{/each}
</CatalogSectionShell>
