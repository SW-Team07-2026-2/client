<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api, auth } from '#lib/auth/auth.svelte';
	import FdButton from '#lib/components/ui/FdButton.svelte';
	import {
		buildArtistDetailExtra,
		resolveArtistImageUrl,
		type CatalogArtist
	} from '#lib/config/artists';
	import { FluidSetting } from '#lib/fluid/setting';
	import { artistTransition, isMobile, toast } from '#lib/stores';

	const artistId = $derived(Number(page.params.id));

	const initialCached = untrack(() =>
		Number.isFinite(artistId) ? artistTransition.getCachedArtist(artistId) : null
	);

	let artist = $state<CatalogArtist | null>(initialCached?.artist ?? null);
	let waveColor = $state<string>(initialCached?.waveColor ?? 'var(--muted)');
	let following = $state<boolean>(
		untrack(() => {
			if (!Number.isFinite(artistId)) return false;
			const override = artistTransition.getFollowing(artistId);
			if (override !== undefined) return override;
			return artistId === 1 || artistId === 3;
		})
	);
	let followLoading = $state(false);

	// 라우트 파라미터 변경 시 동기적으로 캐시 재조회
	$effect(() => {
		const id = artistId;
		if (!Number.isFinite(id)) {
			artist = null;
			return;
		}
		const cached = artistTransition.getCachedArtist(id);
		if (cached) {
			artist = cached.artist;
			if (cached.waveColor) waveColor = cached.waveColor;
		}
		const override = artistTransition.getFollowing(id);
		if (override !== undefined) {
			following = override;
		}
	});

	const resolvedImageSrc = $derived(artist ? resolveArtistImageUrl(artist) : '');
	const detailExtra = $derived(artist ? buildArtistDetailExtra(artist) : null);
	const isVtTarget = $derived(artist !== null && artistTransition.vtArtistId === artist.id);

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
			waveAmp: 2.2,
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

	function handleBack() {
		if (
			artistTransition.canUseHistoryBack &&
			typeof window !== 'undefined' &&
			window.history.length > 1
		) {
			window.history.back();
			return;
		}
		goto('/artist');
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
		artistTransition.setFollowing(targetId, next);
		followLoading = true;

		try {
			if (next) {
				await api(`/api/members/follows/${targetId}`, { method: 'POST' });
			} else {
				await api(`/api/members/follows/${targetId}`, { method: 'DELETE' });
			}
		} catch {
			following = !next;
			artistTransition.setFollowing(targetId, !next);
			toast.error('팔로우 상태를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.');
		} finally {
			followLoading = false;
		}
	}

	onMount(async () => {
		if (!Number.isFinite(artistId)) return;
		try {
			const res = await api<CatalogArtist>(`/api/catalog/artists/${artistId}`);
			if (res && typeof res.id === 'number') {
				artist = res;
				artistTransition.cacheArtist(res);
			}
		} catch {
			// 백엔드 미응답 시 캐시/목업 아티스트 데이터 유지
		}
	});
</script>

<svelte:head>
	<title>{artist ? `INDIG - ${artist.name}` : 'INDIG - 아티스트 상세'}</title>
</svelte:head>

<div
	class="artist-detail-page"
	class:is-mobile={isMobile.current}
	style:--artist-accent={waveColor}
>
	<!-- 아티스트 대표 색상 기반 은은한 배경 앰비언트 글로우 -->
	<div class="detail-ambient-backdrop" aria-hidden="true"></div>

	<div class="detail-inner">
		<div class="detail-top-bar">
			<button type="button" class="detail-back-link" onclick={handleBack}>
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

		{#if artist && detailExtra}
			<section class="detail-hero" aria-label="{artist.name} 프로필">
				<div class="hero-photo-col">
					<div class="hero-photo-glow" aria-hidden="true"></div>
					<div class="artist-hero-frame" class:is-vt-target={isVtTarget}>
						<img src={resolvedImageSrc} alt={artist.name} draggable="false" />
					</div>
				</div>

				<div class="hero-info-col">
					<div class="hero-meta-badges">
						{#if artist.genre}
							<span class="meta-pill">{artist.genre}</span>
						{/if}
						{#if artist.debutYear}
							<span class="meta-pill is-subtle">DEBUT {artist.debutYear}</span>
						{/if}
						<span class="meta-pill is-subtle">월간 리스너 {detailExtra.monthlyListeners}</span>
					</div>

					<h1 class="artist-detail-name">{artist.name}</h1>

					<p class="artist-detail-bio">{detailExtra.bio}</p>

					<div class="artist-tags">
						{#each detailExtra.tags as tag (tag)}
							<span class="tag-chip">#{tag}</span>
						{/each}
					</div>

					<div class="hero-actions">
						<FdButton
							class="detail-follow-btn"
							setting={followBtnSetting}
							disabled={followLoading}
							onclick={handleFollowToggle}
						>
							{following ? '팔로우 중' : '팔로우'}
						</FdButton>
					</div>
				</div>
			</section>

			<div class="detail-sections-grid">
				<section class="detail-card-panel" aria-label="대표 음반">
					<header class="panel-header">
						<h2 class="panel-title">대표 음반</h2>
						<span class="panel-count">{detailExtra.albums.length}</span>
					</header>

					<ul class="album-list">
						{#each detailExtra.albums as album (album.id)}
							<li class="album-row">
								<img class="album-thumb" src={album.coverUrl} alt={album.title} loading="lazy" />
								<div class="album-meta">
									<span class="album-title">{album.title}</span>
									<span class="album-sub">{album.year} · {album.type}</span>
								</div>
							</li>
						{/each}
					</ul>
				</section>

				<section class="detail-card-panel" aria-label="예정된 공연">
					<header class="panel-header">
						<h2 class="panel-title">예정된 공연</h2>
						<span class="panel-count">{detailExtra.concerts.length}</span>
					</header>

					<ul class="concert-list">
						{#each detailExtra.concerts as concert (concert.id)}
							<li class="concert-row">
								<div class="concert-info">
									<span class="concert-title">{concert.title}</span>
									<span class="concert-sub">{concert.date} · {concert.venue}</span>
								</div>
								<span class="concert-status" class:is-urgent={concert.status === '매진임박'}>
									{concert.status}
								</span>
							</li>
						{/each}
					</ul>
				</section>
			</div>
		{:else}
			<div class="artist-not-found">
				<h2>아티스트 정보를 찾을 수 없습니다</h2>
				<p>요청하신 아티스트가 존재하지 않거나 불러오지 못했습니다.</p>
				<FdButton setting={backBtnSetting} onclick={() => goto('/artist')}>
					목록으로 돌아가기
				</FdButton>
			</div>
		{/if}
	</div>
</div>

<style>
	.artist-detail-page {
		position: relative;
		width: 100%;
		min-height: calc(100dvh - var(--pc-header-height));
		background: var(--bg);
		color: var(--fg);
		overflow-x: clip;
	}

	.detail-ambient-backdrop {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background:
			radial-gradient(
				circle at 24% 18%,
				color-mix(in srgb, var(--artist-accent) 22%, transparent) 0%,
				transparent 56%
			),
			radial-gradient(
				circle at 78% 12%,
				color-mix(in srgb, var(--artist-accent) 10%, transparent) 0%,
				transparent 48%
			);
		opacity: 0.92;
	}

	.detail-inner {
		position: relative;
		z-index: 1;
		max-width: var(--content-max-width);
		margin: 0 auto;
		padding: 1.5rem var(--content-padding-x) 4.5rem;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 2.25rem;
	}

	.artist-detail-page.is-mobile .detail-inner {
		padding: 1rem var(--content-padding-x-mobile) 3.5rem;
		gap: 1.75rem;
	}

	.detail-top-bar {
		display: flex;
		align-items: center;
		justify-content: flex-start;
	}

	.detail-back-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.45rem 0.2rem;
		background: transparent;
		border: none;
		color: var(--muted);
		font-size: 0.92rem;
		font-weight: 500;
		cursor: pointer;
		transition:
			color 0.2s ease,
			transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.detail-back-link:hover {
		color: var(--fg);
		transform: translateX(-3px);
	}

	.detail-back-link:active {
		transform: translateX(-5px) scale(0.97);
	}

	.back-arrow {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}

	.detail-hero {
		display: grid;
		grid-template-columns: minmax(260px, 380px) minmax(0, 1fr);
		gap: clamp(1.75rem, 4vw, 3.5rem);
		align-items: center;
	}

	.artist-detail-page.is-mobile .detail-hero {
		grid-template-columns: 1fr;
		justify-items: center;
		text-align: center;
	}

	.hero-photo-col {
		position: relative;
		width: 100%;
		display: grid;
		place-items: center;
	}

	.hero-photo-glow {
		position: absolute;
		inset: 10%;
		border-radius: 36px;
		background: var(--artist-accent);
		opacity: 0.26;
		filter: blur(42px);
		pointer-events: none;
	}

	.artist-hero-frame {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 380px;
		aspect-ratio: 1 / 1;
		border-radius: 28px;
		overflow: hidden;
		background: var(--surface);
		border: 1px solid var(--line);
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
	}

	.artist-detail-page.is-mobile .artist-hero-frame {
		max-width: min(82vw, 310px);
	}

	.artist-hero-frame.is-vt-target {
		view-transition-name: artist-hero-photo;
	}

	.artist-hero-frame img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		user-select: none;
	}

	.hero-info-col {
		display: flex;
		flex-direction: column;
		gap: 1.05rem;
		min-width: 0;
	}

	.artist-detail-page.is-mobile .hero-info-col {
		align-items: center;
	}

	.hero-meta-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.artist-detail-page.is-mobile .hero-meta-badges {
		justify-content: center;
	}

	.meta-pill {
		display: inline-flex;
		align-items: center;
		padding: 0.34rem 0.8rem;
		border-radius: 999px;
		background: var(--surface-3);
		border: 1px solid var(--line);
		color: var(--fg);
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.meta-pill.is-subtle {
		background: var(--surface-dim);
		color: var(--muted);
		font-weight: 500;
	}

	.artist-detail-name {
		margin: 0;
		font-size: clamp(2.1rem, 4.2vw, 3.4rem);
		font-weight: 800;
		line-height: 1.12;
		letter-spacing: -0.03em;
		color: var(--white-2);
	}

	.artist-detail-bio {
		margin: 0;
		max-width: 60ch;
		font-size: 0.98rem;
		line-height: 1.7;
		color: var(--muted);
		word-break: keep-all;
	}

	.artist-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.artist-detail-page.is-mobile .artist-tags {
		justify-content: center;
	}

	.tag-chip {
		padding: 0.25rem 0.65rem;
		border-radius: 999px;
		background: var(--surface);
		color: var(--muted);
		font-size: 0.78rem;
	}

	.hero-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-top: 0.35rem;
	}

	:global(.detail-follow-btn) {
		padding: 0.62rem 1.45rem !important;
		font-size: 0.9rem !important;
		font-weight: 700 !important;
	}

	.detail-sections-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1.25rem;
	}

	.artist-detail-page.is-mobile .detail-sections-grid {
		grid-template-columns: 1fr;
	}

	.detail-card-panel {
		background: var(--surface-dim);
		border: var(--thin-border);
		border-radius: 24px;
		padding: 1.35rem 1.45rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.panel-title {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 700;
		color: var(--fg);
	}

	.panel-count {
		font-size: 0.82rem;
		color: var(--muted);
	}

	.album-list,
	.concert-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.album-row,
	.concert-row {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		padding: 0.65rem 0.75rem;
		border-radius: 14px;
		background: var(--surface);
		transition: background 0.18s ease;
	}

	.album-row:hover,
	.concert-row:hover {
		background: var(--surface-3);
	}

	.album-thumb {
		width: 48px;
		height: 48px;
		border-radius: 10px;
		object-fit: cover;
		flex-shrink: 0;
	}

	.album-meta,
	.concert-info {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
		flex: 1;
	}

	.album-title,
	.concert-title {
		font-size: 0.92rem;
		font-weight: 600;
		color: var(--fg);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.album-sub,
	.concert-sub {
		font-size: 0.8rem;
		color: var(--muted);
	}

	.concert-status {
		flex-shrink: 0;
		padding: 0.26rem 0.65rem;
		border-radius: 999px;
		background: var(--surface-3);
		color: var(--fg);
		font-size: 0.75rem;
		font-weight: 600;
	}

	.concert-status.is-urgent {
		background: color-mix(in srgb, var(--artist-accent) 28%, var(--surface-3));
		color: var(--white);
	}

	.artist-not-found {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.85rem;
		padding: 5rem 1rem;
		text-align: center;
	}

	.artist-not-found h2 {
		margin: 0;
		font-size: 1.35rem;
		color: var(--fg);
	}

	.artist-not-found p {
		margin: 0 0 0.5rem;
		font-size: 0.92rem;
		color: var(--muted);
	}

	@media (max-width: 768px) {
		.detail-hero {
			grid-template-columns: 1fr;
			justify-items: center;
			text-align: center;
		}

		.hero-info-col {
			align-items: center;
		}

		.hero-meta-badges,
		.artist-tags {
			justify-content: center;
		}

		.detail-sections-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
