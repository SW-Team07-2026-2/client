<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { auth } from '#lib/auth/auth.svelte';
	import { fetchCatalogPageWithFallback } from '#lib/config/catalogFeed';
	import { MOCK_CATALOG_ALBUMS, type CatalogAlbum } from '#lib/config/albums';
	import { toast } from '#lib/stores';
	import CatalogSectionShell from '../shared/CatalogSectionShell.svelte';
	import AlbumCard from './AlbumCard.svelte';

	interface Props {
		initialAlbums?: CatalogAlbum[];
		initialWishlistedIds?: number[];
		query?: string;
		genre?: string;
		pageSize?: number;
		onAlbumClick?: (album: CatalogAlbum) => void;
		onWishlistChange?: (album: CatalogAlbum, wishlisted: boolean) => void;
		class?: string;
	}

	let {
		initialAlbums,
		initialWishlistedIds,
		query = '',
		genre = '',
		pageSize = 12,
		onAlbumClick,
		onWishlistChange,
		class: klass = ''
	}: Props = $props();

	function filterMockAlbums(q: string, g: string): CatalogAlbum[] {
		const nq = q.trim().toLowerCase();
		const ng = g.trim().toLowerCase();
		return MOCK_CATALOG_ALBUMS.filter((item) => {
			const matchQ =
				!nq ||
				item.title.toLowerCase().includes(nq) ||
				item.artistName.toLowerCase().includes(nq) ||
				(item.format ?? '').toLowerCase().includes(nq);
			const matchG = !ng || (item.genre ?? '').toLowerCase().includes(ng);
			return matchQ && matchG;
		});
	}

	let albums = $state<CatalogAlbum[]>(
		untrack(() =>
			initialAlbums && initialAlbums.length > 0
				? [...initialAlbums]
				: MOCK_CATALOG_ALBUMS.slice(0, 12)
		)
	);
	let wishlistedIds = $state<Set<number>>(
		untrack(
			() =>
				new Set(
					initialWishlistedIds && initialWishlistedIds.length > 0 ? initialWishlistedIds : [201]
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
			const res = await fetchCatalogPageWithFallback<CatalogAlbum>({
				endpoint: '/api/catalog/albums',
				page,
				pageSize,
				query,
				genre,
				filterMock: () => filterMockAlbums(query, genre)
			});
			albums = append ? [...albums, ...res.items] : res.items;
			currentPage = res.page;
			hasNext = res.hasNext;
		} finally {
			isLoading = false;
			isLoadingMore = false;
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
		if (onAlbumClick) {
			onAlbumClick(album);
		} else {
			toast.info(`${album.artistName} — ${album.title}`);
		}
	}

	onMount(() => {
		if (!initialAlbums || initialAlbums.length === 0) {
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
			? `'${query}' (${genre}) 음반 검색 결과가 없습니다`
			: query.trim()
				? `'${query}'에 대한 음반이 없습니다`
				: genre.trim()
					? `'${genre}' 장르의 음반이 아직 없습니다`
					: '등록된 음반이 없습니다'
	);

	const emptyDesc = $derived(
		query.trim() || genre.trim()
			? '검색어 또는 필터 조건을 다시 확인해 보세요.'
			: '새로운 음반 및 LP가 등록되면 이곳에서 만나보실 수 있습니다.'
	);
</script>

<CatalogSectionShell
	class={klass}
	ariaLabel="음반 및 LP 목록"
	{isLoading}
	isEmpty={albums.length === 0}
	{errorMessage}
	errorTitle="음반 목록을 불러올 수 없습니다"
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
