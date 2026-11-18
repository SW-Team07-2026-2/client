<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { auth } from '#lib/auth/auth.svelte';
	import { fetchCatalogPageWithFallback } from '#lib/config/catalogFeed';
	import { MOCK_CATALOG_GOODS, type CatalogGoods } from '#lib/config/goods';
	import { toast } from '#lib/stores';
	import CatalogSectionShell from '../shared/CatalogSectionShell.svelte';
	import GoodsCard from './GoodsCard.svelte';

	interface Props {
		initialGoods?: CatalogGoods[];
		initialWishlistedIds?: number[];
		query?: string;
		category?: string;
		pageSize?: number;
		onGoodsClick?: (goods: CatalogGoods) => void;
		onWishlistChange?: (goods: CatalogGoods, wishlisted: boolean) => void;
		class?: string;
	}

	let {
		initialGoods,
		initialWishlistedIds,
		query = '',
		category = '',
		pageSize = 12,
		onGoodsClick,
		onWishlistChange,
		class: klass = ''
	}: Props = $props();

	function filterMockGoods(q: string, c: string): CatalogGoods[] {
		const nq = q.trim().toLowerCase();
		const nc = c.trim().toLowerCase();
		return MOCK_CATALOG_GOODS.filter((item) => {
			const matchQ =
				!nq ||
				item.name.toLowerCase().includes(nq) ||
				item.artistName.toLowerCase().includes(nq) ||
				(item.category ?? '').toLowerCase().includes(nq);
			const matchC = !nc || (item.category ?? '').toLowerCase().includes(nc);
			return matchQ && matchC;
		});
	}

	let goodsList = $state<CatalogGoods[]>(
		untrack(() =>
			initialGoods && initialGoods.length > 0
				? [...initialGoods]
				: MOCK_CATALOG_GOODS.slice(0, 12)
		)
	);
	let wishlistedIds = $state<Set<number>>(
		untrack(
			() =>
				new Set(
					initialWishlistedIds && initialWishlistedIds.length > 0 ? initialWishlistedIds : [301]
				)
		)
	);

	let currentPage = $state(0);
	let hasNext = $state(false);
	let isLoading = $state(false);
	let isLoadingMore = $state(false);
	let errorMessage = $state<string | null>(null);
	let loadMoreErrorMessage = $state<string | null>(null);

	async function loadPage(page: number, append = false) {
		if (append) {
			isLoadingMore = true;
			loadMoreErrorMessage = null;
		} else {
			isLoading = true;
			errorMessage = null;
		}

		try {
			const res = await fetchCatalogPageWithFallback<CatalogGoods>({
				endpoint: '/api/catalog/goods',
				page,
				pageSize,
				query,
				genre: category,
				filterMock: () => filterMockGoods(query, category)
			});
			goodsList = append ? [...goodsList, ...res.items] : res.items;
			currentPage = res.page;
			hasNext = res.hasNext;
		} finally {
			isLoading = false;
			isLoadingMore = false;
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

	onMount(() => {
		if (!initialGoods || initialGoods.length === 0) {
			loadPage(0, false);
		}
	});

	let prevQuery = untrack(() => query);
	let prevCategory = untrack(() => category);
	$effect(() => {
		const q = query;
		const c = category;
		if (q !== prevQuery || c !== prevCategory) {
			prevQuery = q;
			prevCategory = c;
			untrack(() => loadPage(0, false));
		}
	});

	const emptyTitle = $derived(
		query.trim() && category.trim()
			? `'${query}' (${category}) 굿즈 검색 결과가 없습니다`
			: query.trim()
				? `'${query}'에 대한 굿즈가 없습니다`
				: category.trim()
					? `'${category}' 카테고리의 굿즈가 아직 없습니다`
					: '등록된 굿즈가 없습니다'
	);

	const emptyDesc = $derived(
		query.trim() || category.trim()
			? '검색어 또는 필터 조건을 다시 확인해 보세요.'
			: '새로운 공식 굿즈가 등록되면 이곳에서 만나보실 수 있습니다.'
	);
</script>

<CatalogSectionShell
	class={klass}
	ariaLabel="굿즈 목록"
	{isLoading}
	isEmpty={goodsList.length === 0}
	{errorMessage}
	errorTitle="굿즈 목록을 불러올 수 없습니다"
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
