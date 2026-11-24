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
		mapConcertSummary,
		resolveConcertPosterUrl,
		type CatalogConcert,
		type ConcertSummaryDto
	} from '#lib/config/concerts';
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
	import ConcertCard from './ConcertCard.svelte';

	interface Props {
		initialConcerts?: CatalogConcert[];
		initialBookmarkedIds?: number[];
		feedMode?: CatalogFeedMode;
		query?: string;
		genre?: string;
		filterState?: Partial<ContentFilterState>;
		pageSize?: number;
		onConcertClick?: (concert: CatalogConcert) => void;
		onBookmarkChange?: (concert: CatalogConcert, bookmarked: boolean) => void;
		active?: boolean;
		class?: string;
	}

	let {
		initialConcerts,
		initialBookmarkedIds,
		feedMode,
		query,
		genre,
		filterState,
		pageSize = CATALOG_DEFAULT_PAGE_SIZE,
		onConcertClick,
		onBookmarkChange,
		active = true,
		class: klass = ''
	}: Props = $props();

	let concerts = $state<CatalogConcert[]>(
		untrack(() => (initialConcerts && initialConcerts.length > 0 ? [...initialConcerts] : []))
	);
	let bookmarkedIds = $state<Set<number>>(untrack(() => new Set(initialBookmarkedIds ?? [])));

	let currentPage = $state(0);
	let hasNext = $state(false);
	let isLoading = $state(untrack(() => !initialConcerts || initialConcerts.length === 0));
	let isLoadingMore = $state(false);
	let errorMessage = $state<string | null>(null);
	let isAuthError = $state(false);
	let loadMoreErrorMessage = $state<string | null>(null);
	let latestRequestSeq = 0;
	let hasCompletedInitialLoad = untrack(() => Boolean(initialConcerts && initialConcerts.length > 0));

	const isUsingStore = $derived(
		feedMode === undefined &&
			query === undefined &&
			genre === undefined &&
			filterState === undefined
	);
	const canSync = $derived(active && isCatalogCategoryReady('concert', isUsingStore));

	let ownFilterState = $state<ContentFilterState>(
		untrack(() => ({
			...getSavedCategorySlice('Concert'),
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
		buildCatalogRequestKey('concert', {
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
			concerts = [];
			currentPage = 0;
			hasNext = false;
			isLoading = false;
			isLoadingMore = false;
			isAuthError = true;
			errorMessage = '팔로우한 아티스트의 공연을 보려면 로그인이 필요합니다.';
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
			const res = await fetchCatalogPageWithTransition<CatalogConcert, ConcertSummaryDto>(
				{
					category: 'concert',
					feedMode: activeFeedMode,
					page,
					pageSize,
					query: activeQuery,
					genre,
					filterState: activeFilterState,
					mapItem: mapConcertSummary
				},
				shouldStage
			);
			if (seq !== latestRequestSeq) return;

			hasCompletedInitialLoad = true;
			concerts = append ? [...concerts, ...res.items] : res.items;
			currentPage = res.page;
			hasNext = res.hasNext;
			if (!append && !canSync && !res.degraded && res.items.length > 0) {
				prewarmFdImages(res.items.map(resolveConcertPosterUrl), 8);
			}
			if (res.degraded) {
				if (append) {
					loadMoreErrorMessage = '일시적으로 추가 공연을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
				} else if (res.items.length === 0) {
					errorMessage = '공연 목록을 일시적으로 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
				}
			}
		} catch (err) {
			if (seq !== latestRequestSeq) return;
			hasCompletedInitialLoad = true;
			const msg = resolveCatalogErrorMessage(err, '공연');
			if (append) {
				loadMoreErrorMessage = msg;
			} else {
				concerts = [];
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

	function handleBookmarkToggle(concert: CatalogConcert, nextBookmarked: boolean) {
		if (!auth.isLoggedIn) {
			toast.info('로그인 후 관심 공연을 저장해 보세요.');
		}
		const updated = new Set(bookmarkedIds);
		if (nextBookmarked) updated.add(concert.id);
		else updated.delete(concert.id);
		bookmarkedIds = updated;
		onBookmarkChange?.(concert, nextBookmarked);
	}

	function handleConcertSelect(concert: CatalogConcert) {
		onConcertClick?.(concert);
	}

	let hasLoadedInitial = untrack(() => Boolean(initialConcerts && initialConcerts.length > 0));
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
		Boolean(genre?.trim()) ||
			countActiveFilters({
				genres: activeFilterState.genres ?? [],
				regions: activeFilterState.regions ?? [],
				statuses: activeFilterState.statuses ?? [],
				concertTypes: activeFilterState.concertTypes ?? [],
				forms: [],
				priceRange: null,
				sort: ''
			}) > 0
	);

	const emptyTitle = $derived(
		activeFeedMode === 'follow'
			? activeQuery.trim() || hasFilters
				? '조건에 맞는 팔로우 공연이 없습니다'
				: '팔로우한 아티스트의 공연이 없습니다'
			: activeQuery.trim()
				? `'${activeQuery.trim()}'에 대한 공연이 없습니다`
				: hasFilters
					? '선택한 조건에 맞는 공연이 없습니다'
					: '등록된 공연이 없습니다'
	);

	const emptyDesc = $derived(
		activeQuery.trim() || hasFilters
			? '검색어 또는 필터 조건을 다시 확인해 보세요.'
			: activeFeedMode === 'follow'
				? '관심 아티스트를 팔로우하면 예정된 공연을 모아볼 수 있습니다.'
				: '새로운 공연 일정이 등록되면 이곳에서 만나보실 수 있습니다.'
	);

	const errorTitle = $derived(
		isAuthError ? '로그인이 필요합니다' : '공연 목록을 불러올 수 없습니다'
	);
</script>

<CatalogSectionShell
	class={klass}
	ariaLabel="공연 목록"
	{active}
	{isLoading}
	isEmpty={concerts.length === 0}
	{errorMessage}
	{errorTitle}
	{emptyTitle}
	{emptyDesc}
	{loadMoreErrorMessage}
	{isLoadingMore}
	{hasNext}
	minCardWidth={210}
	mobileMinCardWidth={154}
	skeletonAspect="3 / 4"
	skeletonRadius="20px"
	onRetry={() => loadPage(0, false)}
	onLoadMore={() => {
		if (hasNext && !isLoadingMore) loadPage(currentPage + 1, true);
	}}
>
	{#each concerts as concert (concert.id)}
		<ConcertCard
			{concert}
			bookmarked={bookmarkedIds.has(concert.id)}
			onBookmarkToggle={handleBookmarkToggle}
			onclick={handleConcertSelect}
		/>
	{/each}
</CatalogSectionShell>
