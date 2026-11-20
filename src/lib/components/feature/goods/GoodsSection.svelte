<script lang="ts">
	import { untrack } from 'svelte';
	import { auth } from '#lib/auth/auth.svelte';
	import {
		CATALOG_DEFAULT_PAGE_SIZE,
		fetchCatalogPage,
		isCatalogAuthError,
		resolveCatalogErrorMessage,
		type CatalogFeedMode
	} from '#lib/config/catalogFeed';
	import {
		mapGoodsItem,
		type CatalogGoods,
		type GoodsItemDto
	} from '#lib/config/goods';
	import { countActiveFilters, type ContentFilterState } from '#lib/config/filter';
	import {
		buildCatalogRequestKey,
		catalogFeed,
		isCatalogCategoryReady,
		toast
	} from '#lib/stores';
	import CatalogSectionShell from '../shared/CatalogSectionShell.svelte';
	import GoodsCard from './GoodsCard.svelte';

	interface Props {
		initialGoods?: CatalogGoods[];
		initialWishlistedIds?: number[];
		feedMode?: CatalogFeedMode;
		query?: string;
		category?: string;
		filterState?: Partial<ContentFilterState>;
		pageSize?: number;
		onGoodsClick?: (goods: CatalogGoods) => void;
		onWishlistChange?: (goods: CatalogGoods, wishlisted: boolean) => void;
		class?: string;
	}

	let {
		initialGoods,
		initialWishlistedIds,
		feedMode,
		query,
		category,
		filterState,
		pageSize = CATALOG_DEFAULT_PAGE_SIZE,
		onGoodsClick,
		onWishlistChange,
		class: klass = ''
	}: Props = $props();

	let goodsList = $state<CatalogGoods[]>(
		untrack(() => (initialGoods && initialGoods.length > 0 ? [...initialGoods] : []))
	);
	let wishlistedIds = $state<Set<number>>(untrack(() => new Set(initialWishlistedIds ?? [])));

	let currentPage = $state(0);
	let hasNext = $state(false);
	let isLoading = $state(untrack(() => !initialGoods || initialGoods.length === 0));
	let isLoadingMore = $state(false);
	let errorMessage = $state<string | null>(null);
	let isAuthError = $state(false);
	let loadMoreErrorMessage = $state<string | null>(null);
	let latestRequestSeq = 0;

	const isUsingStore = $derived(
		feedMode === undefined &&
			query === undefined &&
			category === undefined &&
			filterState === undefined
	);
	const canSync = $derived(isCatalogCategoryReady('goods', isUsingStore));
	const activeFeedMode = $derived<CatalogFeedMode>(feedMode ?? catalogFeed.resolvedFeedMode);
	const activeQuery = $derived(query ?? catalogFeed.debouncedQuery);
	const activeFilterState = $derived<Partial<ContentFilterState>>(
		filterState ??
			(category?.trim()
				? { ...catalogFeed.filterState, forms: [category.trim()] }
				: catalogFeed.filterState)
	);
	const activeRefreshTick = $derived(isUsingStore ? catalogFeed.refreshTick : 0);

	const requestKey = $derived(
		buildCatalogRequestKey('goods', {
			feedMode: activeFeedMode,
			query: activeQuery,
			filterState: activeFilterState,
			refreshTick: activeRefreshTick,
			authKey: `${auth.isLoggedIn}:${auth.isVerified}`
		})
	);

	async function loadPage(page: number, append = false) {
		const seq = ++latestRequestSeq;

		if (activeFeedMode === 'follow' && auth.isVerified && !auth.isLoggedIn) {
			goodsList = [];
			currentPage = 0;
			hasNext = false;
			isLoading = false;
			isLoadingMore = false;
			isAuthError = true;
			errorMessage = '팔로우한 아티스트의 굿즈를 보려면 로그인이 필요합니다.';
			loadMoreErrorMessage = null;
			return;
		}

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
			const res = await fetchCatalogPage<CatalogGoods, GoodsItemDto>({
				category: 'goods',
				feedMode: activeFeedMode,
				page,
				pageSize,
				query: activeQuery,
				filterState: activeFilterState,
				mapItem: mapGoodsItem
			});
			if (seq !== latestRequestSeq) return;

			goodsList = append ? [...goodsList, ...res.items] : res.items;
			currentPage = res.page;
			hasNext = res.hasNext;
			if (res.degraded) {
				if (append) {
					loadMoreErrorMessage = '일시적으로 추가 굿즈를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
				} else if (res.items.length === 0) {
					errorMessage = '굿즈 목록을 일시적으로 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
				}
			}
		} catch (err) {
			if (seq !== latestRequestSeq) return;
			const msg = resolveCatalogErrorMessage(err, '굿즈');
			if (append) {
				loadMoreErrorMessage = msg;
			} else {
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

	function handleWishlistToggle(goods: CatalogGoods, nextWishlisted: boolean) {
		if (!auth.isLoggedIn) {
			toast.info('로그인 후 굿즈를 찜할 수 있습니다.');
		}
		const updated = new Set(wishlistedIds);
		if (nextWishlisted) updated.add(goods.id);
		else updated.delete(goods.id);
		wishlistedIds = updated;
		onWishlistChange?.(goods, nextWishlisted);
	}

	function handleGoodsSelect(goods: CatalogGoods) {
		if (onGoodsClick) {
			onGoodsClick(goods);
		} else {
			toast.info(`${goods.artistName} — ${goods.name}`);
		}
	}

	let hasLoadedInitial = untrack(() => Boolean(initialGoods && initialGoods.length > 0));
	let lastLoadedKey = untrack(() => (hasLoadedInitial ? requestKey : ''));

	$effect(() => {
		if (!canSync) return;
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
				? '조건에 맞는 팔로우 굿즈가 없습니다'
				: '팔로우한 아티스트의 굿즈가 없습니다'
			: activeQuery.trim()
				? `'${activeQuery.trim()}'에 대한 굿즈가 없습니다`
				: hasFilters
					? '선택한 조건에 맞는 굿즈가 없습니다'
					: '등록된 굿즈가 없습니다'
	);

	const emptyDesc = $derived(
		activeQuery.trim() || hasFilters
			? '검색어 또는 필터 조건을 다시 확인해 보세요.'
			: activeFeedMode === 'follow'
				? '관심 아티스트를 팔로우하면 공식 굿즈를 모아볼 수 있습니다.'
				: '새로운 공식 굿즈가 등록되면 이곳에서 만나보실 수 있습니다.'
	);

	const errorTitle = $derived(
		isAuthError ? '로그인이 필요합니다' : '굿즈 목록을 불러올 수 없습니다'
	);
</script>

<CatalogSectionShell
	class={klass}
	ariaLabel="굿즈 목록"
	{isLoading}
	isEmpty={goodsList.length === 0}
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
	skeletonRadius="20px"
	onRetry={() => loadPage(0, false)}
	onLoadMore={() => {
		if (hasNext && !isLoadingMore) loadPage(currentPage + 1, true);
	}}
>
	{#each goodsList as goods (goods.id)}
		<GoodsCard
			{goods}
			wishlisted={wishlistedIds.has(goods.id)}
			onWishlistToggle={handleWishlistToggle}
			onclick={handleGoodsSelect}
		/>
	{/each}
</CatalogSectionShell>
