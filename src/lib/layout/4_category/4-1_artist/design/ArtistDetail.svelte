<script lang="ts">
	import FdImage from '#lib/common/design/fluid/FdImage.svelte';
	import { LoadingSpinner } from '#lib/dedicated/loading';
	import { resolveArtistImageUrl, type CatalogArtist } from '#lib/config/artists';
	import ArtistFollowButton from '../part/detail_part/ArtistFollowButton.svelte';
	import ArtistShareButton from '../part/detail_part/ArtistShareButton.svelte';
	import ArtistMoreToggleButton from '../part/detail_part/ArtistMoreToggleButton.svelte';
	import ArtistMoreInfoPanel from '../part/detail_part/ArtistMoreInfoPanel.svelte';

	interface Props {
		artist: CatalogArtist | null;
		isLoading: boolean;
		errorMessage: string | null;
		following: boolean;
		followLoading: boolean;
		moreOpen: boolean;
		accentColor: string;
		mobile: boolean;
		onClose: () => void;
		onToggleFollow: () => void;
		onShareLink: () => void;
		onToggleMore: () => void;
		onAccentColorExtracted?: (color: string) => void;
	}

	let {
		artist,
		isLoading,
		errorMessage,
		following,
		followLoading,
		moreOpen,
		accentColor,
		mobile,
		onClose,
		onToggleFollow,
		onShareLink,
		onToggleMore,
		onAccentColorExtracted
	}: Props = $props();

	let extractedWaveColor = $state('var(--white)');

	const imageSrc = $derived(artist ? resolveArtistImageUrl(artist) : '');
	const glowColor = $derived(
		extractedWaveColor && extractedWaveColor !== 'var(--muted-wave)'
			? extractedWaveColor
			: accentColor || 'var(--white)'
	);

	$effect(() => {
		onAccentColorExtracted?.(glowColor);
	});
</script>

<!-- 아티스트 상세 뷰 (PC 우선 구현 · 모바일은 추후 별도 구성 예정으로 비워둠, 순수 렌더링) -->
{#if !mobile}
	<div class="pc-artist-detail" style:--artist-glow-color={glowColor}>
		<!-- 배경 은은한 블러 빛 효과 (이미지 추출 색상 · CORS 차단 시 하얀색 폴백) -->
		<div class="ambient-glow-layer" aria-hidden="true">
			<div class="ambient-glow-orb is-primary"></div>
			<div class="ambient-glow-orb is-secondary"></div>
		</div>

		<div class="detail-container">
			<div class="detail-top-nav">
				<button type="button" class="detail-back-btn" onclick={onClose}>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="m15 18-6-6 6-6" />
					</svg>
					<span>목록으로</span>
				</button>
			</div>

			{#if isLoading && !artist}
				<div class="detail-state-box" role="status" aria-live="polite">
					<LoadingSpinner size={24} />
				</div>
			{:else if errorMessage && !artist}
				<div class="detail-state-box" role="alert">
					<p class="detail-error-text">{errorMessage}</p>
				</div>
			{:else if artist}
				<!-- 상단 히어로: 좌측 아티스트 이미지 · 우측 이름 및 액션 버튼 -->
				<header class="artist-hero">
					<div class="artist-hero-media">
						<FdImage
							class="artist-hero-image"
							src={imageSrc}
							alt={artist.name}
							loading="eager"
							decoding="async"
							objectPosition="50% 40%"
							disableWave={false}
							bind:extractedWaveColor
							fullWidth
						/>
					</div>

					<div class="artist-hero-info">
						<h1 class="artist-hero-name">{artist.name}</h1>

						<div class="artist-hero-actions">
							<ArtistFollowButton
								{following}
								loading={followLoading}
								onToggle={onToggleFollow}
							/>
							<ArtistShareButton onShare={onShareLink} />
							<ArtistMoreToggleButton open={moreOpen} onToggle={onToggleMore} />
						</div>
					</div>
				</header>

				<!-- 상세 보기 버튼 클릭 시 히어로와 하단 영역 사이에서 세로로 펼쳐지는 상세 정보 영역 -->
				<ArtistMoreInfoPanel {artist} open={moreOpen} />
			{/if}
		</div>
	</div>
{/if}

<style>
	.pc-artist-detail {
		position: relative;
		width: 100%;
		min-height: calc(100dvh - var(--pc-header-height, 70px));
		background: var(--bg);
		color: var(--fg);
		overflow: clip;
		box-sizing: border-box;
	}

	.ambient-glow-layer {
		position: absolute;
		inset: 0 0 auto 0;
		height: 460px;
		pointer-events: none;
		overflow: hidden;
		z-index: 0;
	}

	.ambient-glow-orb {
		position: absolute;
		border-radius: 999px;
		background: var(--artist-glow-color, var(--white));
		filter: blur(110px);
		transition: background-color 0.5s ease;
	}

	.ambient-glow-orb.is-primary {
		top: -120px;
		left: 12%;
		width: 420px;
		height: 320px;
		opacity: 0.2;
	}

	.ambient-glow-orb.is-secondary {
		top: -80px;
		right: 16%;
		width: 340px;
		height: 260px;
		opacity: 0.12;
	}

	.detail-container {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: var(--content-max-width);
		margin: 0 auto;
		padding: 1.5rem var(--content-padding-x) 4rem;
		box-sizing: border-box;
	}

	.detail-top-nav {
		margin-bottom: 1.75rem;
	}

	.detail-back-btn {
		height: 34px;
		padding: 0 0.85rem 0 0.65rem;
		border-radius: 999px;
		border: var(--thin-border);
		background: color-mix(in srgb, var(--surface) 75%, transparent);
		color: var(--muted);
		font: inherit;
		font-size: 0.84rem;
		font-weight: var(--fw-medium);
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		cursor: pointer;
		transition:
			color 0.16s ease,
			background-color 0.16s ease;
	}

	.detail-back-btn:hover {
		color: var(--white);
		background: var(--surface-2);
	}

	.detail-state-box {
		min-height: 260px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.detail-error-text {
		margin: 0;
		font-size: 0.94rem;
		color: var(--muted);
	}

	.artist-hero {
		display: flex;
		align-items: center;
		gap: 2.4rem;
	}

	.artist-hero-media {
		position: relative;
		width: 210px;
		height: 210px;
		flex-shrink: 0;
	}

	.artist-hero-media :global(.fd-image-wrap.artist-hero-image) {
		width: 100%;
		height: 100%;
	}

	.artist-hero-info {
		min-width: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 1.2rem;
	}

	.artist-hero-name {
		margin: 0;
		font-size: clamp(2.2rem, 3.8vw, 3.25rem);
		font-weight: var(--fw-extrabold);
		letter-spacing: -0.03em;
		line-height: 1.12;
		color: var(--white);
		word-break: keep-all;
	}

	.artist-hero-actions {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.65rem;
	}
</style>
