<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { auth } from '#lib/auth/auth.svelte';
	import { fetchCatalogPageWithFallback } from '#lib/config/catalogFeed';
	import { MOCK_CATALOG_CONCERTS, type CatalogConcert } from '#lib/config/concerts';
	import { toast } from '#lib/stores';
	import CatalogSectionShell from '../shared/CatalogSectionShell.svelte';
	import ConcertCard from './ConcertCard.svelte';

	interface Props {
		initialConcerts?: CatalogConcert[];
		initialBookmarkedIds?: number[];
		query?: string;
		genre?: string;
		pageSize?: number;
		onConcertClick?: (concert: CatalogConcert) => void;
		onBookmarkChange?: (concert: CatalogConcert, bookmarked: boolean) => void;
		class?: string;
	}

	let {
		initialConcerts,
		initialBookmarkedIds,
		query = '',
		genre = '',
		pageSize = 12,
		onConcertClick,
		onBookmarkChange,
		class: klass = ''
	}: Props = $props();

	function filterMockConcerts(q: string, g: string): CatalogConcert[] {
		const nq = q.trim().toLowerCase();
		const ng = g.trim().toLowerCase();
		return MOCK_CATALOG_CONCERTS.filter((item) => {
			const matchQ =
				!nq ||
				item.title.toLowerCase().includes(nq) ||
				item.artistName.toLowerCase().includes(nq) ||
				item.venue.toLowerCase().includes(nq);
			const matchG = !ng || (item.genre ?? '').toLowerCase().includes(ng);
			return matchQ && matchG;
		});
	}

	let concerts = $state<CatalogConcert[]>(
		untrack(() =>
			initialConcerts && initialConcerts.length > 0
				? [...initialConcerts]
				: MOCK_CATALOG_CONCERTS.slice(0, 12)
		)
	);
	let bookmarkedIds = $state<Set<number>>(
		untrack(
			() =>
				new Set(
					initialBookmarkedIds && initialBookmarkedIds.length > 0 ? initialBookmarkedIds : [101]
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
			const res = await fetchCatalogPageWithFallback<CatalogConcert>({
				endpoint: '/api/catalog/concerts',
				page,
				pageSize,
				query,
				genre,
				filterMock: () => filterMockConcerts(query, genre)
			});
			concerts = append ? [...concerts, ...res.items] : res.items;
			currentPage = res.page;
			hasNext = res.hasNext;
		} finally {
			isLoading = false;
			isLoadingMore = false;
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
		if (onConcertClick) {
			onConcertClick(concert);
		} else {
			toast.info(`${concert.artistName} — ${concert.title}`);
		}
	}

	onMount(() => {
		if (!initialConcerts || initialConcerts.length === 0) {
			loadPage(0, false);
		}
	});

	let prevQuery = untrack(() => query);
	let prevGenre = untrack(() => genre);
	$effect(() => {
		const q = query;
		const g = genre;
		if (q !== prevQuery || g !== prevGenre) {
			prevQuery = q;
			prevGenre = g;
			untrack(() => loadPage(0, false));
		}
	});

	const emptyTitle = $derived(
		query.trim() && genre.trim()
			? `'${query}' (${genre}) 공연 검색 결과가 없습니다`
			: query.trim()
				? `'${query}'에 대한 공연이 없습니다`
				: genre.trim()
					? `'${genre}' 장르의 예정된 공연이 없습니다`
					: '등록된 공연이 없습니다'
	);

	const emptyDesc = $derived(
		query.trim() || genre.trim()
			? '검색어 또는 필터 조건을 다시 확인해 보세요.'
			: '새로운 공연 일정이 등록되면 이곳에서 만나보실 수 있습니다.'
	);
</script>

<CatalogSectionShell
	class={klass}
	ariaLabel="공연 목록"
	{isLoading}
	isEmpty={concerts.length === 0}
	{errorMessage}
	errorTitle="공연 목록을 불러올 수 없습니다"
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
