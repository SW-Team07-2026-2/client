<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { api, auth } from '#lib/auth/auth.svelte';
	import FdButton from '#lib/common/design/fluid/FdButton.svelte';
	import FdImage from '#lib/common/design/fluid/FdImage.svelte';
	import AlbumCard, { type CatalogAlbum } from '#lib/components/feature/album/AlbumCard.svelte';
	import ConcertCard, {
		type CatalogConcert
	} from '#lib/components/feature/concert/ConcertCard.svelte';
	import GoodsCard, { type CatalogGoods } from '#lib/components/feature/goods/GoodsCard.svelte';
	import DetailOverlayFrame from '#lib/components/feature/shared/DetailOverlayFrame.svelte';
	import {
		mapArtistDetail,
		resolveArtistImageUrl,
		type ArtistDetailDto,
		type CatalogArtist
	} from '#lib/config/artists';
	import { mapConcertSummary, type ConcertSummaryDto } from '#lib/config/concerts';
	import { FluidSetting } from '#lib/common/type/fluid';
	import { artistDetailState, isMobile, toast } from '#lib/common/logic';

	interface Props {
		/** 조회할 아티스트 ID */
		artistId: number;
		/** PC 독립 오버레이 프레임 모드 여부 */
		overlayMode?: boolean;
		/** Keep-Alive 활성 상태 여부 */
		active?: boolean;
		/** 외부에서 미리 전달할 초기 아티스트 정보 */
		initialArtist?: CatalogArtist | null;
		/** 뒤로가기 콜백 (미지정 시 /artist 이동) */
		onBack?: () => void;
		/** 추가 클래스 */
		class?: string;
	}

	let {
		artistId,
		overlayMode = false,
		active = true,
		initialArtist = null,
		onBack,
		class: klass = ''
	}: Props = $props();

	const initialCached = untrack(() => artistDetailState.getCachedArtist(artistId));

	let artist = $state<CatalogArtist | null>(
		untrack(() => initialArtist ?? initialCached?.artist ?? null)
	);
	let concerts = $state<CatalogConcert[]>(untrack(() => initialArtist?.catalogConcerts ?? []));
	let isLoading = $state<boolean>(untrack(() => !artist && Number.isFinite(artistId)));
	let isLoadingSections = $state<boolean>(untrack(() => Number.isFinite(artistId)));
	let notFound = $state<boolean>(false);

	let waveColor = $state<string>(untrack(() => initialCached?.waveColor ?? 'var(--muted-wave)'));
	let following = $state<boolean>(
		untrack(() => artistDetailState.getFollowing(artistId) ?? false)
	);
	let followLoading = $state<boolean>(false);

	let wishlistedAlbumIds = $state<Set<number>>(new Set());
	let wishlistedGoodsIds = $state<Set<number>>(new Set());
	let bookmarkedConcertIds = $state<Set<number>>(new Set());

	let destroyed = false;
	let activeLoadSeq = 0;

	const mobile = $derived(isMobile.current);
	const resolvedImageSrc = $derived(artist ? resolveArtistImageUrl(artist) : '');
	const genreLabels = $derived.by(() => {
		if (!artist?.genre) return [];
		return artist.genre
			.split('·')
			.map((g) => g.trim())
			.filter(Boolean);
	});
	const artistMembers = $derived(artist?.members ?? []);
	const artistTags = $derived(artist?.tags ?? []);
	const physicalAlbums = $derived(artist?.physicalAlbums ?? []);
	const digitalAlbums = $derived(artist?.albums ?? []);
	const artistGoods = $derived(artist?.goods ?? []);
	const hasAnyCatalogItems = $derived(
		concerts.length > 0 ||
			physicalAlbums.length > 0 ||
			digitalAlbums.length > 0 ||
			artistGoods.length > 0
	);

	const heroImageSetting = $derived(
		new FluidSetting({
			radius: 999,
			inset: 14,
			layers: 2,
			layerGap: 3,
			waveAmp: 2.2,
			waveLength: 68,
			spin: 1.0,
			bulge: 5,
			reach: 32,
			pauseWhenIdle: !active,
			waveColor
		})
	);

	const followBtnSetting = $derived.by(() => {
		if (following) {
			return new FluidSetting({
				radius: 999,
				layers: 1,
				layerGap: 2,
				waveAmp: 1.8,
				bulge: 5,
				reach: 26,
				inset: 8,
				color: 'var(--surface-3)',
				hoverColor: 'var(--surface-4)',
				pressColor: 'var(--surface-2)',
				waveColor: 'var(--line-wave)',
				borderWidth: 1,
				borderColor: 'var(--line)',
				hoverBorderColor: 'var(--muted)',
				textColor: 'var(--fg)'
			});
		}
		return new FluidSetting({
			radius: 999,
			layers: 2,
			layerGap: 2.5,
			waveAmp: 2.4,
			bulge: 6,
			reach: 28,
			inset: 8,
			color: 'var(--white-2)',
			hoverColor: 'var(--white)',
			pressColor: 'var(--white-3)',
			waveColor,
			textColor: 'var(--bg)'
		});
	});

	const backBtnSetting = new FluidSetting({
		radius: 999,
		layers: 1,
		layerGap: 0,
		waveAmp: 0,
		bulge: 4,
		reach: 24,
		inset: 6,
		pauseWhenIdle: true,
		color: 'var(--surface-dim)',
		hoverColor: 'var(--surface-3)',
		pressColor: 'var(--surface-4)',
		borderWidth: 1,
		borderColor: 'var(--line)',
		hoverBorderColor: 'var(--muted)',
		textColor: 'var(--fg)'
	});

	async function loadArtistDetail(targetId: number) {
		const seq = ++activeLoadSeq;
		if (!Number.isFinite(targetId)) {
			isLoading = false;
			isLoadingSections = false;
			notFound = true;
			return;
		}

		notFound = false;
		isLoadingSections = true;
		if (!artist || artist.id !== targetId) {
			const cached = artistDetailState.getCachedArtist(targetId);
			if (cached) {
				artist = cached.artist;
				if (cached.waveColor) waveColor = cached.waveColor;
				isLoading = false;
			} else {
				artist = null;
				isLoading = true;
			}
		}

		const detailPromise = api<ArtistDetailDto>(`/api/catalog/artists/${targetId}`);
		const concertsPromise = api<{ items?: ConcertSummaryDto[] } | ConcertSummaryDto[]>(
			`/api/concerts?artistId=${targetId}&page=0&size=12`
		).catch(() => null);
		const followPromise = auth.isLoggedIn
			? api<{ following?: boolean }>(`/api/members/follows/${targetId}`).catch(() => null)
			: Promise.resolve(null);

		try {
			const [detailRes, concertRes, followRes] = await Promise.allSettled([
				detailPromise,
				concertsPromise,
				followPromise
			]);
			if (destroyed || seq !== activeLoadSeq) return;

			if (
				detailRes.status === 'fulfilled' &&
				detailRes.value &&
				typeof detailRes.value.id === 'number'
			) {
				const mapped = mapArtistDetail(detailRes.value);
				artist = { ...artist, ...mapped };
				artistDetailState.cacheArtist(artist, waveColor);
			} else if (!artist) {
				notFound = true;
			}

			if (concertRes.status === 'fulfilled' && concertRes.value) {
				const rawList = Array.isArray(concertRes.value)
					? concertRes.value
					: Array.isArray(concertRes.value.items)
						? concertRes.value.items
						: [];
				concerts = rawList.map(mapConcertSummary);
			}

			if (
				followRes.status === 'fulfilled' &&
				followRes.value &&
				typeof followRes.value.following === 'boolean'
			) {
				following = followRes.value.following;
				artistDetailState.setFollowing(targetId, followRes.value.following);
			}
		} finally {
			if (!destroyed && seq === activeLoadSeq) {
				isLoading = false;
				isLoadingSections = false;
			}
		}
	}

	function handleBack() {
		if (onBack) {
			onBack();
			return;
		}
		goto('/artist', { reset: false });
	}

	async function handleFollowToggle() {
		if (!artist || followLoading) return;
		if (!auth.isLoggedIn) {
			toast.info('로그인이 필요한 기능입니다. 로그인 후 아티스트를 팔로우해 보세요.');
			return;
		}

		const targetId = artist.id;
		const next = !following;
		following = next;
		artistDetailState.setFollowing(targetId, next);
		followLoading = true;

		try {
			if (next) {
				await api(`/api/members/follows/${targetId}`, { method: 'POST' });
			} else {
				await api(`/api/members/follows/${targetId}`, { method: 'DELETE' });
			}
		} catch {
			following = !next;
			artistDetailState.setFollowing(targetId, !next);
			toast.error('팔로우 상태를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.');
		} finally {
			followLoading = false;
		}
	}

	function toggleAlbumWishlist(album: CatalogAlbum, next: boolean) {
		if (!auth.isLoggedIn) {
			toast.info('로그인 후 위시리스트를 관리할 수 있습니다.');
		}
		const updated = new Set(wishlistedAlbumIds);
		if (next) updated.add(album.id);
		else updated.delete(album.id);
		wishlistedAlbumIds = updated;
	}

	function toggleGoodsWishlist(goods: CatalogGoods, next: boolean) {
		if (!auth.isLoggedIn) {
			toast.info('로그인 후 굿즈를 찜할 수 있습니다.');
		}
		const updated = new Set(wishlistedGoodsIds);
		if (next) updated.add(goods.id);
		else updated.delete(goods.id);
		wishlistedGoodsIds = updated;
	}

	function toggleConcertBookmark(concert: CatalogConcert, next: boolean) {
		if (!auth.isLoggedIn) {
			toast.info('로그인 후 관심 공연을 저장해 보세요.');
		}
		const updated = new Set(bookmarkedConcertIds);
		if (next) updated.add(concert.id);
		else updated.delete(concert.id);
		bookmarkedConcertIds = updated;
	}

	let lastLoadedArtistId: number | null = null;
	$effect(() => {
		const id = artistId;
		if (id === lastLoadedArtistId) return;
		lastLoadedArtistId = id;
		untrack(() => {
			concerts = [];
			const overrideFollow = artistDetailState.getFollowing(id);
			if (overrideFollow !== undefined) {
				following = overrideFollow;
			}
			void loadArtistDetail(id);
		});
	});

	onDestroy(() => {
		destroyed = true;
	});
</script>

<DetailOverlayFrame
	category="artist"
	itemId={artistId}
	{overlayMode}
	accentColor={waveColor}
	imageSrc={resolvedImageSrc}
	mediaShape="circle"
	class="artist-particular-frame {klass}"
>
	{#snippet children({ heroHiddenForProxy })}
		<div class="particular-top-bar">
			<button type="button" class="particular-back-link" onclick={handleBack}>
				<svg
					class="back-arrow"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M19 12H5" />
					<path d="m12 19-7-7 7-7" />
				</svg>
				<span>아티스트 목록</span>
			</button>
		</div>

		{#if artist}
			<section class="particular-hero" class:is-mobile={mobile} aria-label="{artist.name} 프로필">
				<div class="hero-photo-col" class:is-mobile={mobile}>
					<div class="hero-photo-glow" aria-hidden="true"></div>
					<div
						class="hero-avatar-stage"
						data-detail-hero-media
						class:is-hidden-for-expand={heroHiddenForProxy}
					>
						<FdImage
							class="particular-fd-image"
							src={resolvedImageSrc}
							alt={artist.name}
							loading="eager"
							decoding="async"
							objectPosition="50% 40%"
							setting={heroImageSetting}
							bind:extractedWaveColor={waveColor}
							fullWidth
						/>
					</div>
				</div>

				<div class="hero-info-col" class:is-mobile={mobile}>
					{#if genreLabels.length > 0 || artist.debutYear || artist.label || artist.monthlyListeners}
						<div class="hero-meta-badges" class:is-mobile={mobile}>
							{#each genreLabels as genre (genre)}
								<span class="meta-pill">{genre}</span>
							{/each}
							{#if artist.debutYear}
								<span class="meta-pill is-subtle">DEBUT {artist.debutYear}</span>
							{/if}
							{#if artist.label}
								<span class="meta-pill is-subtle">{artist.label}</span>
							{/if}
							{#if artist.monthlyListeners}
								<span class="meta-pill is-subtle">월간 리스너 {artist.monthlyListeners}</span>
							{/if}
						</div>
					{/if}

					<h1 class="artist-detail-name">{artist.name}</h1>

					{#if artist.bio}
						<p class="artist-detail-bio">{artist.bio}</p>
					{/if}

					{#if artistMembers.length > 0}
						<div class="artist-members" class:is-mobile={mobile} aria-label="멤버 구성">
							{#each artistMembers as member (`${member.name}-${member.role ?? ''}`)}
								<span class="member-chip">
									<span class="member-name">{member.name}</span>
									{#if member.role}
										<span class="member-role">{member.role}</span>
									{/if}
								</span>
							{/each}
						</div>
					{/if}

					{#if artistTags.length > 0}
						<div class="artist-tags" class:is-mobile={mobile}>
							{#each artistTags as tag (tag)}
								<span class="tag-chip">#{tag}</span>
							{/each}
						</div>
					{/if}

					<div class="hero-actions">
						<FdButton
							class="particular-follow-btn"
							setting={followBtnSetting}
							disabled={followLoading}
							aria-pressed={following}
							onclick={handleFollowToggle}
						>
							{following ? '팔로우 중' : '팔로우'}
						</FdButton>
					</div>
				</div>
			</section>

			{#if concerts.length > 0}
				<section class="particular-section" aria-label="예정 및 관련 공연">
					<header class="section-header">
						<h2 class="section-title">공연</h2>
						<span class="section-count">{concerts.length}</span>
					</header>
					<div class="particular-card-grid is-concert" class:is-mobile={mobile}>
						{#each concerts as concert (concert.id)}
							<ConcertCard
								{concert}
								bookmarked={bookmarkedConcertIds.has(concert.id)}
								onBookmarkToggle={toggleConcertBookmark}
								onclick={(c) => toast.info(`${c.artistName} — ${c.title}`)}
							/>
						{/each}
					</div>
				</section>
			{/if}

			{#if physicalAlbums.length > 0}
				<section class="particular-section" aria-label="음반 및 LP">
					<header class="section-header">
						<h2 class="section-title">음반 · LP</h2>
						<span class="section-count">{physicalAlbums.length}</span>
					</header>
					<div class="particular-card-grid" class:is-mobile={mobile}>
						{#each physicalAlbums as album (album.id)}
							<AlbumCard
								{album}
								wishlisted={wishlistedAlbumIds.has(album.id)}
								onWishlistToggle={toggleAlbumWishlist}
								onclick={(a) => toast.info(`${a.artistName} — ${a.title}`)}
							/>
						{/each}
					</div>
				</section>
			{/if}

			{#if digitalAlbums.length > 0}
				<section class="particular-section" aria-label="발매 디스코그래피">
					<header class="section-header">
						<h2 class="section-title">디스코그래피</h2>
						<span class="section-count">{digitalAlbums.length}</span>
					</header>
					<div class="discography-grid" class:is-mobile={mobile}>
						{#each digitalAlbums as album (album.id)}
							<article class="discography-card">
								<div class="discography-thumb">
									{#if album.coverUrl}
										<img src={album.coverUrl} alt={album.title} loading="lazy" />
									{:else}
										<div class="discography-placeholder" aria-hidden="true"></div>
									{/if}
									{#if album.type}
										<span class="discography-type">{album.type}</span>
									{/if}
								</div>
								<div class="discography-meta">
									<span class="discography-title">{album.title}</span>
									{#if album.year || album.genres?.length}
										<span class="discography-sub">
											{[album.year, album.genres?.slice(0, 2).join(', ')]
												.filter(Boolean)
												.join(' · ')}
										</span>
									{/if}
								</div>
							</article>
						{/each}
					</div>
				</section>
			{/if}

			{#if artistGoods.length > 0}
				<section class="particular-section" aria-label="공식 굿즈">
					<header class="section-header">
						<h2 class="section-title">공식 굿즈</h2>
						<span class="section-count">{artistGoods.length}</span>
					</header>
					<div class="particular-card-grid" class:is-mobile={mobile}>
						{#each artistGoods as goods (goods.id)}
							<GoodsCard
								{goods}
								wishlisted={wishlistedGoodsIds.has(goods.id)}
								onWishlistToggle={toggleGoodsWishlist}
								onclick={(g) => toast.info(`${g.artistName} — ${g.name}`)}
							/>
						{/each}
					</div>
				</section>
			{/if}

			{#if isLoadingSections && !hasAnyCatalogItems}
				<section class="particular-section" aria-busy="true" aria-label="아티스트 상세 정보 로딩 중">
					<div class="particular-skeleton-grid">
						{#each Array(4) as _, idx (idx)}
							<div class="particular-skeleton-card">
								<div class="skeleton-box"></div>
								<div class="skeleton-bar"></div>
								<div class="skeleton-bar is-short"></div>
							</div>
						{/each}
					</div>
				</section>
			{:else if !isLoadingSections && !hasAnyCatalogItems}
				<p class="particular-empty-note">등록된 음반·공연·굿즈 정보가 아직 없습니다.</p>
			{/if}
		{:else if isLoading}
			<div
				class="particular-hero-skeleton"
				class:is-mobile={mobile}
				aria-busy="true"
				aria-label="아티스트 정보 불러오는 중"
			>
				<div class="skeleton-avatar"></div>
				<div class="skeleton-info">
					<div class="skeleton-bar is-pill"></div>
					<div class="skeleton-bar is-title"></div>
					<div class="skeleton-bar is-btn"></div>
				</div>
			</div>
		{:else if notFound}
			<div class="artist-not-found">
				<h2>아티스트 정보를 찾을 수 없습니다</h2>
				<p>요청하신 아티스트가 존재하지 않거나 불러오지 못했습니다.</p>
				<FdButton setting={backBtnSetting} onclick={handleBack}>목록으로 돌아가기</FdButton>
			</div>
		{/if}
	{/snippet}
</DetailOverlayFrame>

<style>
	.particular-top-bar {
		display: flex;
		align-items: center;
		justify-content: flex-start;
	}

	.particular-back-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.45rem 0.2rem;
		background: transparent;
		border: none;
		color: var(--muted);
		font-size: 0.92rem;
		font-weight: var(--fw-medium);
		cursor: pointer;
		transition:
			color 0.2s ease,
			transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.particular-back-link:hover {
		color: var(--fg);
		transform: translateX(-3px);
	}

	.particular-back-link:active {
		transform: translateX(-5px) scale(0.97);
	}

	.back-arrow {
		width: 18px;
		height: 18px;
	}

	/* ── 히어로 프로필 영역 ── */
	.particular-hero {
		display: flex;
		align-items: center;
		gap: 2.5rem;
	}

	.particular-hero.is-mobile {
		flex-direction: column;
		text-align: center;
		gap: 1.4rem;
	}

	.hero-photo-col {
		position: relative;
		flex-shrink: 0;
		width: 236px;
		height: 236px;
		aspect-ratio: 1 / 1;
	}

	.hero-photo-col.is-mobile {
		width: 172px;
		height: 172px;
	}

	.hero-photo-glow {
		position: absolute;
		inset: -12%;
		border-radius: 999px;
		background: radial-gradient(
			circle,
			color-mix(in srgb, var(--detail-accent, var(--muted-wave)) 28%, transparent) 0%,
			transparent 68%
		);
		filter: blur(20px);
		pointer-events: none;
		animation: hero-glow-fade-in 0.95s cubic-bezier(0.22, 1, 0.36, 1) 0.16s both;
	}

	@keyframes hero-glow-fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hero-photo-glow {
			animation: none;
		}
	}

	.hero-avatar-stage {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		z-index: 1;
	}

	.hero-avatar-stage.is-hidden-for-expand {
		opacity: 0;
	}

	.hero-avatar-stage :global(.fd-image-wrap.particular-fd-image) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.hero-info-col {
		flex: 1 1 0%;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.9rem;
	}

	.hero-info-col.is-mobile {
		align-items: center;
	}

	.hero-meta-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.hero-meta-badges.is-mobile {
		justify-content: center;
	}

	.meta-pill {
		display: inline-flex;
		align-items: center;
		padding: 0.28rem 0.72rem;
		border-radius: 999px;
		background: var(--surface-3);
		border: var(--thin-border);
		color: var(--white);
		font-size: 0.78rem;
		font-weight: var(--fw-semibold);
		letter-spacing: -0.01em;
	}

	.meta-pill.is-subtle {
		background: var(--surface-dim);
		color: var(--muted);
		font-weight: var(--fw-medium);
	}

	.artist-detail-name {
		margin: 0;
		font-size: clamp(1.85rem, 3.8vw, 3rem);
		font-weight: var(--fw-extrabold);
		letter-spacing: -0.03em;
		line-height: 1.12;
		color: var(--white);
		word-break: keep-all;
	}

	.artist-detail-bio {
		margin: 0;
		max-width: 62ch;
		font-size: 0.96rem;
		line-height: 1.65;
		color: var(--fg);
		opacity: 0.88;
		word-break: keep-all;
	}

	.artist-members,
	.artist-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.artist-members.is-mobile,
	.artist-tags.is-mobile {
		justify-content: center;
	}

	.member-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.25rem 0.65rem;
		border-radius: 999px;
		background: var(--surface);
		border: var(--thin-border);
		font-size: 0.8rem;
	}

	.member-name {
		color: var(--fg);
		font-weight: var(--fw-medium);
	}

	.member-role {
		color: var(--muted);
	}

	.tag-chip {
		font-size: 0.82rem;
		color: var(--muted);
		font-weight: var(--fw-medium);
	}

	.hero-actions {
		margin-top: 0.35rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	:global(.particular-follow-btn) {
		padding: 0.48rem 1.4rem !important;
		font-size: 0.9rem !important;
		font-weight: var(--fw-bold) !important;
	}

	/* ── 섹션 공통 ── */
	.particular-section {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}

	.section-header {
		display: flex;
		align-items: baseline;
		gap: 0.55rem;
	}

	.section-title {
		margin: 0;
		font-size: 1.2rem;
		font-weight: var(--fw-bold);
		letter-spacing: -0.02em;
		color: var(--white);
	}

	.section-count {
		font-size: 0.86rem;
		font-weight: var(--fw-semibold);
		color: var(--muted);
	}

	.particular-card-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(196px, 1fr));
		column-gap: 1.5rem;
		row-gap: 2.25rem;
		align-items: start;
		width: 100%;
	}

	.particular-card-grid.is-concert {
		grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
	}

	.particular-card-grid.is-mobile {
		grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
		column-gap: 1.125rem;
		row-gap: 1.85rem;
	}

	.discography-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 1.25rem;
	}

	.discography-grid.is-mobile {
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 1rem;
	}

	.discography-card {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding: 0.75rem;
		border-radius: 18px;
		background: var(--surface-dim);
		border: var(--thin-border);
		box-sizing: border-box;
	}

	.discography-thumb {
		position: relative;
		width: 100%;
		aspect-ratio: 1 / 1;
		border-radius: 12px;
		overflow: hidden;
		background: var(--surface);
	}

	.discography-thumb img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.discography-placeholder {
		width: 100%;
		height: 100%;
		background: var(--surface-3);
	}

	.discography-type {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		padding: 0.18rem 0.5rem;
		border-radius: 999px;
		background: var(--glass-bg);
		backdrop-filter: var(--glass-filter);
		-webkit-backdrop-filter: var(--glass-filter);
		border: var(--thin-border);
		font-size: 0.68rem;
		font-weight: var(--fw-semibold);
		color: var(--white);
	}

	.discography-meta {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.discography-title {
		font-size: 0.94rem;
		font-weight: var(--fw-semibold);
		color: var(--fg);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.discography-sub {
		font-size: 0.8rem;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.particular-empty-note {
		margin: 1rem 0 0;
		font-size: 0.92rem;
		color: var(--muted);
	}

	/* ── 로딩 스켈레톤 / 미존재 상태 ── */
	.particular-hero-skeleton {
		display: flex;
		align-items: center;
		gap: 2.5rem;
		padding: 1rem 0;
	}

	.particular-hero-skeleton.is-mobile {
		flex-direction: column;
		gap: 1.25rem;
	}

	.skeleton-avatar {
		width: 208px;
		height: 208px;
		border-radius: 999px;
		background: var(--surface);
		animation: particular-pulse 1.5s ease-in-out infinite;
	}

	.skeleton-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		width: 100%;
		max-width: 360px;
	}

	.particular-skeleton-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(196px, 1fr));
		gap: 1.5rem;
	}

	.particular-skeleton-card {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.skeleton-box {
		width: 100%;
		aspect-ratio: 1 / 1;
		border-radius: 18px;
		background: var(--surface);
		animation: particular-pulse 1.5s ease-in-out infinite;
	}

	.skeleton-bar {
		height: 0.95rem;
		width: 70%;
		border-radius: 999px;
		background: var(--surface);
		animation: particular-pulse 1.5s ease-in-out infinite;
	}

	.skeleton-bar.is-short {
		width: 45%;
		height: 0.8rem;
	}

	.skeleton-bar.is-pill {
		width: 96px;
		height: 1.4rem;
	}

	.skeleton-bar.is-title {
		width: 240px;
		height: 2.4rem;
	}

	.skeleton-bar.is-btn {
		width: 112px;
		height: 2.35rem;
	}

	@keyframes particular-pulse {
		0%,
		100% {
			opacity: 0.45;
		}
		50% {
			opacity: 0.88;
		}
	}

	.artist-not-found {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 5.5rem 1.5rem;
		gap: 0.75rem;
	}

	.artist-not-found h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: var(--fw-bold);
		color: var(--fg);
	}

	.artist-not-found p {
		margin: 0 0 0.75rem;
		font-size: 0.92rem;
		color: var(--muted);
	}
</style>
