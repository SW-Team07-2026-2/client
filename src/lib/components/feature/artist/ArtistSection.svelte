<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import ArtistCard, { type CatalogArtist } from './ArtistCard.svelte';
	import FdButton from '#lib/components/ui/FdButton.svelte';
	import { api, auth } from '#lib/auth/auth.svelte';
	import { MOCK_CATALOG_ARTISTS } from '#lib/config/artists';
	import { artistTransition } from '#lib/stores';
	import { FluidSetting } from '#lib/fluid/setting';

	interface PageResult<T> {
		items: T[];
		page: number;
		size: number;
		hasNext: boolean;
	}

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
		/** 외부에서 직접 주입할 초기 아티스트 목록 (미지정 시 C2 API 자동 조회) */
		initialArtists?: CatalogArtist[];
		/** 외부에서 초기 팔로우 ID 목록 주입 시 사용 */
		initialFollowedIds?: number[];
		/** 검색어 필터 (?q=) */
		query?: string;
		/** 장르 필터 (?genre=) */
		genre?: string;
		/** 페이지당 조회 개수 (명세 기본 20, 최대 50) */
		pageSize?: number;
		/** 아티스트 카드 클릭 시 호출되는 콜백 */
		onArtistClick?: (artist: CatalogArtist) => void;
		/** 팔로우 상태 변경 시 호출되는 콜백 */
		onFollowChange?: (artist: CatalogArtist, following: boolean) => void;
		/** 추가 클래스 */
		class?: string;
	}

	let {
		initialArtists,
		initialFollowedIds,
		query = '',
		genre = '',
		pageSize = 12,
		onArtistClick,
		onFollowChange,
		class: klass = ''
	}: Props = $props();

	const MOCK_ARTISTS: CatalogArtist[] = MOCK_CATALOG_ARTISTS;

	function getFilteredMockArtists(q: string, g: string): CatalogArtist[] {
		const nq = q.trim().toLowerCase();
		const ng = g.trim().toLowerCase();
		return MOCK_ARTISTS.filter((item) => {
			const matchQ = !nq || item.name.toLowerCase().includes(nq);
			const matchG = !ng || (item.genre ?? '').toLowerCase().includes(ng);
			return matchQ && matchG;
		});
	}

	const initialRestoredSnapshot = untrack(() => {
		const snap = artistTransition.getFeedSnapshot();
		if (snap && snap.query === query && snap.genre === genre && snap.artists.length > 0) {
			return snap;
		}
		return null;
	});

	let artists = $state<CatalogArtist[]>(
		untrack(() => {
			if (initialArtists && initialArtists.length > 0) return [...initialArtists];
			if (initialRestoredSnapshot) return [...initialRestoredSnapshot.artists];
			return MOCK_ARTISTS.slice(0, 12);
		})
	);
	let followedIds = $state<Set<number>>(
		untrack(() => {
			const base = new Set(
				initialFollowedIds && initialFollowedIds.length > 0 ? initialFollowedIds : [1, 3]
			);
			for (const item of artists) {
				const override = artistTransition.getFollowing(item.id);
				if (override === true) base.add(item.id);
				else if (override === false) base.delete(item.id);
			}
			return base;
		})
	);
	let pendingFollowIds = $state<Set<number>>(new Set());

	let currentPage = $state(untrack(() => initialRestoredSnapshot?.currentPage ?? 0));
	let hasNext = $state(untrack(() => initialRestoredSnapshot?.hasNext ?? false));
	let isLoading = $state(false);
	let isLoadingMore = $state(false);
	let errorMessage = $state<string | null>(null);
	let loadMoreErrorMessage = $state<string | null>(null);
	let sentinelEl = $state<HTMLDivElement | null>(null);

	const retryBtnSetting = new FluidSetting({
		radius: 999,
		layers: 1,
		layerGap: 3,
		waveAmp: 2.2,
		waveLength: 56,
		spin: 1.2,
		color: 'rgba(255, 255, 255, 0.12)',
		hoverColor: 'rgba(255, 255, 255, 0.22)',
		pressColor: 'rgba(255, 255, 255, 0.3)',
		waveColor: 'rgba(255, 255, 255, 0.45)',
		textColor: '#ffffff'
	});

	function resolveErrorMessage(err: unknown): string {
		if (!err) return '아티스트 목록을 불러오는 중 문제가 발생했습니다.';
		if (typeof err === 'string') return err;
		const anyErr = err as { status?: number; code?: string; message?: string };
		if (anyErr.status === 503 || anyErr.code === 'SERVICE_UNAVAILABLE') {
			return '아티스트 서비스가 일시적으로 원활하지 않습니다. 잠시 후 다시 시도해 주세요.';
		}
		if (anyErr.status === 400 || anyErr.code === 'INVALID_REQUEST') {
			return '잘못된 요청입니다. 검색 조건을 확인해 주세요.';
		}
		if (anyErr.status === 404) {
			return '요청하신 아티스트 정보를 찾을 수 없습니다.';
		}
		const msg = anyErr.message ?? '';
		if (
			msg.includes('fetch') ||
			msg.includes('network') ||
			msg.includes('Failed to fetch') ||
			msg.includes('NetworkError')
		) {
			return '서버와 연결할 수 없습니다. 네트워크 연결 또는 API 서버 상태를 확인해 주세요.';
		}
		return msg || '아티스트 목록을 불러오는 중 오류가 발생했습니다.';
	}

	/**
	 * C2 GET /api/catalog/artists 실제 데이터 조회
	 * (백엔드 미실행 또는 데이터 부재 시 20개 임시 데이터와 picsum 랜덤 이미지로 자동 폴백)
	 */
	async function fetchArtistsPage(page: number, append = false) {
		if (append) {
			isLoadingMore = true;
			loadMoreErrorMessage = null;
		} else {
			isLoading = true;
			errorMessage = null;
		}

		try {
			const params = new URLSearchParams();
			params.set('page', String(page));
			params.set('size', String(Math.min(50, Math.max(1, pageSize))));
			if (query.trim()) params.set('q', query.trim());
			if (genre.trim()) params.set('genre', genre.trim());

			const res = await api<PageResult<CatalogArtist>>(
				`/api/catalog/artists?${params.toString()}`
			);

			const fetchedItems = Array.isArray(res?.items) ? res.items : [];

			if (fetchedItems.length > 0) {
				if (append) {
					artists = [...artists, ...fetchedItems];
				} else {
					artists = fetchedItems;
				}
				artistTransition.cacheArtists(artists);
				currentPage = typeof res?.page === 'number' ? res.page : page;
				hasNext = Boolean(res?.hasNext);
				errorMessage = null;
				loadMoreErrorMessage = null;
			} else {
				// 백엔드 응답이 빈 배열인 경우 20개 임시 데이터 활용
				const filtered = getFilteredMockArtists(query, genre);
				const start = page * pageSize;
				const slice = filtered.slice(start, start + pageSize);
				artists = append ? [...artists, ...slice] : slice;
				artistTransition.cacheArtists(artists);
				currentPage = page;
				hasNext = start + pageSize < filtered.length;
				errorMessage = null;
				loadMoreErrorMessage = null;
			}
		} catch (err) {
			// 백엔드 서버 미실행/에러 시에도 정상적인 UI 테스트를 위해 20개 임시 데이터(랜덤 이미지) 제공
			const filtered = getFilteredMockArtists(query, genre);
			const start = page * pageSize;
			const slice = filtered.slice(start, start + pageSize);
			artists = append ? [...artists, ...slice] : slice;
			artistTransition.cacheArtists(artists);
			currentPage = page;
			hasNext = start + pageSize < filtered.length;
			errorMessage = null;
			loadMoreErrorMessage = null;
		} finally {
			isLoading = false;
			isLoadingMore = false;
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
		artistTransition.setFollowing(artist.id, nextFollowing);
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
			artistTransition.setFollowing(artist.id, !nextFollowing);
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

	function handleArtistCardClick(artist: CatalogArtist) {
		artistTransition.saveFeedSnapshot({
			artists,
			currentPage,
			hasNext,
			query,
			genre
		});
		if (onArtistClick) {
			onArtistClick(artist);
		} else {
			goto(`/artist/${artist.id}`);
		}
	}

	onMount(() => {
		artistTransition.cacheArtists(artists);
		if (!initialArtists || initialArtists.length === 0) {
			if (!initialRestoredSnapshot) {
				fetchArtistsPage(0, false);
			}
		}
		if (!initialFollowedIds && auth.isLoggedIn) {
			syncMyFollows();
		}
	});

	// 검색어나 장르 조건이 변경되면 0페이지부터 다시 조회
	let prevQuery = untrack(() => query);
	let prevGenre = untrack(() => genre);
	$effect(() => {
		const q = query;
		const g = genre;
		if (q !== prevQuery || g !== prevGenre) {
			prevQuery = q;
			prevGenre = g;
			untrack(() => {
				fetchArtistsPage(0, false);
			});
		}
	});

	// 로그인 상태 변경 시 팔로우 목록 동기화
	$effect(() => {
		if (auth.isLoggedIn && !initialFollowedIds) {
			syncMyFollows();
		} else if (!auth.isLoggedIn && !initialFollowedIds) {
			followedIds = new Set();
		}
	});

	// 무한 스크롤: 화면 가장 아래(sentinelEl) 도달 시 다음 페이지 자동 로드
	$effect(() => {
		if (!sentinelEl || !hasNext || isLoadingMore || isLoading) return;
		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (entry?.isIntersecting && hasNext && !isLoadingMore && !isLoading) {
					handleLoadMore();
				}
			},
			{ rootMargin: '240px' }
		);
		observer.observe(sentinelEl);
		return () => {
			observer.disconnect();
		};
	});
</script>

<section class="artist-section {klass}" aria-label="아티스트 목록">
	{#if isLoading && artists.length === 0}
		<!-- 로딩 스켈레톤 -->
		<div class="artist-grid" aria-busy="true" aria-live="polite">
			{#each Array(12) as _, idx (idx)}
				<div class="artist-skeleton">
					<div class="skeleton-circle"></div>
					<div class="skeleton-line"></div>
				</div>
			{/each}
		</div>
	{:else if errorMessage && artists.length === 0}
		<!-- 에러 발생 상태 -->
		<div class="artist-state-box error-box" role="alert">
			<div class="state-icon error-icon" aria-hidden="true">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
					<circle cx="12" cy="12" r="10" />
					<line x1="12" y1="8" x2="12" y2="12" />
					<line x1="12" y1="16" x2="12.01" y2="16" />
				</svg>
			</div>
			<h3 class="state-title">아티스트 목록을 불러올 수 없습니다</h3>
			<p class="state-desc">{errorMessage}</p>
			<div class="state-action">
				<FdButton setting={retryBtnSetting} onclick={handleRetry}>
					다시 시도
				</FdButton>
			</div>
		</div>
	{:else if artists.length === 0}
		<!-- 데이터 없음 (Empty State) -->
		<div class="artist-state-box empty-box">
			<div class="state-icon empty-icon" aria-hidden="true">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
					<circle cx="12" cy="12" r="9" />
					<path d="M9 10h.01M15 10h.01M9.5 15.5a3.5 3.5 0 0 0 5 0" />
				</svg>
			</div>
			<h3 class="state-title">
				{#if query.trim() && genre.trim()}
					'{query}' ({genre}) 검색 결과가 없습니다
				{:else if query.trim()}
					'{query}'에 대한 아티스트가 없습니다
				{:else if genre.trim()}
					'{genre}' 장르의 아티스트가 아직 없습니다
				{:else}
					등록된 아티스트가 없습니다
				{/if}
			</h3>
			<p class="state-desc">
				{#if query.trim() || genre.trim()}
					검색어 또는 필터 조건을 다시 확인해 보세요.
				{:else}
					새로운 아티스트가 등록되면 이곳에서 만나보실 수 있습니다.
				{/if}
			</p>
			<div class="state-action">
				<FdButton setting={retryBtnSetting} onclick={handleRetry}>
					새로고침
				</FdButton>
			</div>
		</div>
	{:else}
		<!-- 실제 아티스트 그리드 -->
		<div class="artist-grid">
			{#each artists as artist (artist.id)}
				<ArtistCard
					{artist}
					following={followedIds.has(artist.id)}
					followLoading={pendingFollowIds.has(artist.id)}
					onFollowToggle={handleFollowToggle}
					onclick={handleArtistCardClick}
				/>
			{/each}
		</div>

		<!-- 추가 페이지 로드 에러 발생 시 안내 및 재시도 -->
		{#if loadMoreErrorMessage}
			<div class="load-more-error" role="alert">
				<span>{loadMoreErrorMessage}</span>
				<button type="button" class="inline-retry-btn" onclick={handleLoadMore}>
					다시 시도
				</button>
			</div>
		{/if}

		<!-- 무한 스크롤 추가 로딩 표시 & 하단 감지 센티넬 -->
		{#if isLoadingMore}
			<div class="artist-loading-more" role="status" aria-label="추가 아티스트를 불러오는 중입니다">
				<span class="loading-dot"></span>
				<span class="loading-dot"></span>
				<span class="loading-dot"></span>
			</div>
		{/if}

		{#if hasNext}
			<div bind:this={sentinelEl} class="artist-sentinel" aria-hidden="true"></div>
		{/if}
	{/if}
</section>

<style>
	.artist-section {
		width: 100%;
		box-sizing: border-box;
	}

	/* 왼쪽 위부터 화면 크기에 맞춰 순서대로 정렬 배치
	   FdImage 내부 inset(14px)을 고려해 시각적 가로(14+29+14=57px)·세로(43+14=57px) 여백을 1.5배로 동일하게 맞춤 */
	.artist-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(176px, 1fr));
		column-gap: 1.8125rem;
		row-gap: 2.6875rem;
		align-items: start;
		justify-items: start;
		width: 100%;
	}

	.artist-skeleton {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		padding: 14px 14px 0;
		box-sizing: border-box;
	}

	.skeleton-circle {
		width: 100%;
		max-width: 176px;
		aspect-ratio: 1 / 1;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.06);
		animation: artist-pulse 1.6s ease-in-out infinite;
	}

	.skeleton-line {
		width: 5.5rem;
		height: 1rem;
		margin-top: 1rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.06);
		animation: artist-pulse 1.6s ease-in-out infinite;
	}

	@keyframes artist-pulse {
		0%,
		100% {
			opacity: 0.4;
		}
		50% {
			opacity: 0.85;
		}
	}

	/* 상태 표시 박스 (에러 및 빈 목록 공통) */
	.artist-state-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 5rem 1.5rem;
		text-align: center;
		background: rgba(27, 27, 27, 0.45);
		border: 1px solid var(--line, rgba(255, 255, 255, 0.08));
		border-radius: 1.25rem;
		max-width: 580px;
		margin: 2.5rem auto;
		box-sizing: border-box;
	}

	.state-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3.5rem;
		height: 3.5rem;
		border-radius: 999px;
		margin-bottom: 1.25rem;
	}

	.state-icon svg {
		width: 2rem;
		height: 2rem;
	}

	.error-icon {
		background: rgba(244, 63, 94, 0.12);
		color: #fb7185;
	}

	.empty-icon {
		background: rgba(255, 255, 255, 0.06);
		color: var(--muted, #acabad);
	}

	.state-title {
		margin: 0;
		font-size: 1.15rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--fg, #f0f0f0);
	}

	.state-desc {
		margin: 0.5rem 0 1.5rem;
		font-size: 0.92rem;
		line-height: 1.5;
		color: var(--muted, #acabad);
		word-break: keep-all;
	}

	.state-action {
		display: flex;
		justify-content: center;
	}

	.load-more-error {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		margin-top: 2rem;
		font-size: 0.88rem;
		color: #fb7185;
	}

	.inline-retry-btn {
		appearance: none;
		border: none;
		background: transparent;
		color: #f43f5e;
		font-weight: 600;
		text-decoration: underline;
		cursor: pointer;
		padding: 0;
		font-size: 0.88rem;
	}

	.inline-retry-btn:hover {
		color: #fda4af;
	}

	.artist-loading-more {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 3rem 0 1.5rem;
	}

	.loading-dot {
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.55);
		animation: dot-pulse 1.2s ease-in-out infinite;
	}

	.loading-dot:nth-child(2) {
		animation-delay: 0.2s;
	}

	.loading-dot:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes dot-pulse {
		0%,
		100% {
			transform: scale(0.8);
			opacity: 0.3;
		}
		50% {
			transform: scale(1.3);
			opacity: 1;
		}
	}

	.artist-sentinel {
		width: 100%;
		height: 1px;
		pointer-events: none;
		visibility: hidden;
	}

	@media (max-width: 640px) {
		.artist-grid {
			grid-template-columns: repeat(auto-fill, minmax(136px, 1fr));
			column-gap: 1.375rem;
			row-gap: 2.25rem;
		}

		.artist-state-box {
			padding: 3.5rem 1.25rem;
			margin: 1.5rem auto;
		}
	}
</style>
