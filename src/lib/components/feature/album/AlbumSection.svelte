<script lang="ts">
	import { untrack } from 'svelte';
	import { auth } from '#lib/auth/auth.svelte';
	import {
		CATALOG_DEFAULT_PAGE_SIZE,
		fetchCatalogPageWithTransition,
		isCatalogAuthError,
		resolveCatalogErrorMessage,
		type CatalogFeedMode
	} from '#lib/config/catalogFeed';
	import {
		mapPhysicalItem,
		resolveAlbumCoverUrl,
		type CatalogAlbum,
		type PhysicalItemDto
	} from '#lib/config/albums';
	import {
		cloneContentFilterState,
		countActiveFilters,
		type ContentFilterState
	} from '#lib/common/type/filterOptions';
	import { getSavedCategorySlice } from '#lib/layout/3_content_section/logic/contentFilterStorage';
	import { prewarmFdImages } from '#lib/common/design/fluid/FdImage.svelte';
	import {
		buildCatalogRequestKey,
		catalogFeed,
		isCatalogCategoryReady,
		toast
	} from '#lib/common/logic';
	import CatalogSectionShell from '../shared/CatalogSectionShell.svelte';
	import AlbumCard from './AlbumCard.svelte';

	interface Props {
		initialAlbums?: CatalogAlbum[];
		initialWishlistedIds?: number[];
		feedMode?: CatalogFeedMode;
		query?: string;
		genre?: string;
		filterState?: Partial<ContentFilterState>;
		pageSize?: number;
		onAlbumClick?: (album: CatalogAlbum) => void;
		onWishlistChange?: (album: CatalogAlbum, wishlisted: boolean) => void;
		active?: boolean;
		class?: string;
	}

	let {
		initialAlbums,
		initialWishlistedIds,
		feedMode,
		query,
		genre,
		filterState,
		pageSize = CATALOG_DEFAULT_PAGE_SIZE,
		onAlbumClick,
		onWishlistChange,
		active = true,
		class: klass = ''
	}: Props = $props();

	let albums = $state<CatalogAlbum[]>(
		untrack(() => (initialAlbums && initialAlbums.length > 0 ? [...initialAlbums] : []))
	);
	let wishlistedIds = $state<Set<number>>(untrack(() => new Set(initialWishlistedIds ?? [])));

	let currentPage = $state(0);
	let hasNext = $state(false);
	let isLoading = $state(untrack(() => !initialAlbums || initialAlbums.length === 0));
	let isLoadingMore = $state(false);
	let errorMessage = $state<string | null>(null);
	let isAuthError = $state(false);
	let loadMoreErrorMessage = $state<string | null>(null);
	let latestRequestSeq = 0;
	let hasCompletedInitialLoad = untrack(() => Boolean(initialAlbums && initialAlbums.length > 0));

	const isUsingStore = $derived(
		feedMode === undefined &&
			query === undefined &&
			genre === undefined &&
			filterState === undefined
	);
	const canSync = $derived(active && isCatalogCategoryReady('album', isUsingStore));

	let ownFilterState = $state<ContentFilterState>(
		untrack(() => ({
			...getSavedCategorySlice('Album'),
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
	const activeRefreshTick = $derived(isUsingStore ? catalogFeed.refreshTick : 0);

	const requestKey = $derived(
		buildCatalogRequestKey('album', {
			feedMode: activeFeedMode,
			query: activeQuery,
			genre,
			filterState: activeFilterState,
			refreshTick: activeRefreshTick,
			authKey: `${auth.isLoggedIn}:${auth.isVerified}`
		})
	);

	async function loadPage(page: number, append = false) {
		const seq = ++latestRequestSeq;

		if (activeFeedMode === 'follow' && auth.isVerified && !auth.isLoggedIn) {
			albums = [];
			currentPage = 0;
			hasNext = false;
			isLoading = false;
			isLoadingMore = false;
			isAuthError = true;
			errorMessage = '팔로우한 아티스트의 음반을 보려면 로그인이 필요합니다.';
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
			const res = await fetchCatalogPageWithTransition<CatalogAlbum, PhysicalItemDto>(
				{
					category: 'album',
					feedMode: activeFeedMode,
					page,
					pageSize,
					query: activeQuery,
					genre,
					filterState: activeFilterState,
					mapItem: mapPhysicalItem
				},
				shouldStage
			);
			if (seq !== latestRequestSeq) return;

			hasCompletedInitialLoad = true;
			albums = append ? [...albums, ...res.items] : res.items;
			currentPage = res.page;
			hasNext = res.hasNext;
			if (!append && !canSync && !res.degraded && res.items.length > 0) {
				prewarmFdImages(res.items.map(resolveAlbumCoverUrl), 8);
			}
			if (res.degraded) {
				if (append) {
					loadMoreErrorMessage = '일시적으로 추가 음반을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
				} else if (res.items.length === 0) {
					errorMessage = '음반 목록을 일시적으로 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
				}
			}
		} catch (err) {
			if (seq !== latestRequestSeq) return;
			hasCompletedInitialLoad = true;
			const msg = resolveCatalogErrorMessage(err, '음반');
			if (append) {
				loadMoreErrorMessage = msg;
			} else {
				albums = [];
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

	function handleWishlistToggle(album: CatalogAlbum, nextWishlisted: boolean) {
		if (!auth.isLoggedIn) {
			toast.info('로그인 후 위시리스트를 관리할 수 있습니다.');
		}
		const updated = new Set(wishlistedIds);
		if (nextWishlisted) updated.add(album.id);
		else updated.delete(album.id);
		wishlistedIds = updated;
		onWishlistChange?.(album, nextWishlisted);
	}

	function handleAlbumSelect(album: CatalogAlbum) {
		onAlbumClick?.(album);
	}

	let hasLoadedInitial = untrack(() => Boolean(initialAlbums && initialAlbums.length > 0));
	let lastLoadedKey = untrack(() => (hasLoadedInitial ? requestKey : ''));

	$effect(() => {
		if (!canSync && hasLoadedInitial) return;
		if (active && !canSync) return;
		const key = requestKey;

		if (hasLoadedInitial && key === lastLoadedKey) return;
		hasLoadedInitial = true;
		lastLoadedKey = key;
		untrack(() => {
			loadPage(0, false);
		});
	});

	const hasFilters = $derived(
		countActiveFilters({
			genres: [],
			regions: [],
			statuses: [],
			concertTypes: [],
			forms: activeFilterState.forms ?? [],
			priceRange: activeFilterState.priceRange ?? null,
			sort: ''
		}) > 0
	);

	const emptyTitle = $derived(
		activeFeedMode === 'follow'
			? activeQuery.trim() || hasFilters
				? '조건에 맞는 팔로우 음반이 없습니다'
				: '팔로우한 아티스트의 음반이 없습니다'
			: activeQuery.trim()
				? `'${activeQuery.trim()}'에 대한 음반이 없습니다`
				: hasFilters
					? '선택한 조건에 맞는 음반이 없습니다'
					: '등록된 음반이 없습니다'
	);

	const emptyDesc = $derived(
		activeQuery.trim() || hasFilters
			? '검색어 또는 필터 조건을 다시 확인해 보세요.'
			: activeFeedMode === 'follow'
				? '관심 아티스트를 팔로우하면 음반 및 LP를 모아볼 수 있습니다.'
				: '새로운 음반 및 LP가 등록되면 이곳에서 만나보실 수 있습니다.'
	);

	const errorTitle = $derived(
		isAuthError ? '로그인이 필요합니다' : '음반 목록을 불러올 수 없습니다'
	);
</script>

<CatalogSectionShell
	class={klass}
	ariaLabel="음반 및 LP 목록"
	{active}
	{isLoading}
	isEmpty={albums.length === 0}
	{errorMessage}
	{errorTitle}
	{emptyTitle}
	{emptyDesc}
	{loadMoreErrorMessage}
	{isLoadingMore}
	{hasNext}
	minCardWidth={196}
	mobileMinCardWidth={148}
	skeletonAspect="1 / 1"
	skeletonRadius="18px"
	onRetry={() => loadPage(0, false)}
	onLoadMore={() => {
		if (hasNext && !isLoadingMore) loadPage(currentPage + 1, true);
	}}
>
	{#each albums as album (album.id)}
		<AlbumCard
			{album}
			wishlisted={wishlistedIds.has(album.id)}
			onWishlistToggle={handleWishlistToggle}
			onclick={handleAlbumSelect}
		/>
	{/each}
</CatalogSectionShell>
