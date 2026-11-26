<script lang="ts">
	import FdImage from '#lib/common/design/fluid/FdImage.svelte';
	import { LoadingSpinner } from '#lib/dedicated/loading';
	import { resolveArtistImageUrl, type CatalogArtist } from '#lib/common/catalog/artists';
	import DetailAmbientGlow from '../../_shared/design/DetailAmbientGlow.svelte';
	import DetailTopNav from '#lib/common/design/DetailTopNav.svelte';
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
		backLabel?: string;
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
		backLabel = '목록으로',
		onClose,
		onToggleFollow,
		onShareLink,
		onToggleMore,
		onAccentColorExtracted
	}: Props = $props();

	const HERO_RADIUS = 26;
	/** 정사각형 한 변당 유지할 물결 개수 (이미지 크기에 비례해 waveLength 자동 조절) */
	const HERO_WAVES_PER_EDGE = 2.5;

	let extractedWaveColor = $state('');
	let heroMediaWidth = $state(340);

	const imageSrc = $derived(artist ? resolveArtistImageUrl(artist) : '');
	const glowColor = $derived(
		extractedWaveColor &&
			extractedWaveColor !== 'var(--muted-wave)' &&
			extractedWaveColor !== 'var(--white)'
			? extractedWaveColor
			: accentColor
	);
	const heroImageSetting = $derived.by(() => {
		const w = Math.max(160, heroMediaWidth);
		const perimeter = 4 * w - 1.717 * HERO_RADIUS;
		const waveLength = Math.round(perimeter / (HERO_WAVES_PER_EDGE * 4));
		return {
			radius: HERO_RADIUS,
			waveLength,
			pauseWhenIdle: false
		};
	});

	$effect(() => {
		onAccentColorExtracted?.(glowColor);
	});
</script>

<!-- 아티스트 상세 뷰 (PC 반응형 3단계 레이아웃 · 모바일은 추후 별도 구성 예정으로 비워둠, 순수 렌더링) -->
{#if !mobile}
	<div class="pc-artist-detail">
		<!-- 공용 배경 은은한 블러 빛 효과 (이미지 추출 색상 · CORS 차단 시 하얀색 폴백) -->
		<DetailAmbientGlow color={glowColor} />

		<div class="detail-container">
			<DetailTopNav {mobile} {backLabel} onBack={onClose} />

			{#if isLoading && !artist}
				<div class="detail-state-box" role="status" aria-live="polite">
					<LoadingSpinner size={24} />
				</div>
			{:else if errorMessage && !artist}
				<div class="detail-state-box" role="alert">
					<p class="detail-error-text">{errorMessage}</p>
				</div>
			{:else if artist}
				<!-- 상단 히어로:
				     - 넓음(>=980px): 좌측 대형 이미지 · 우측 이름 + 액션 + 상세 정보 인라인 표시
				     - 중간(680~979px): 좌측 중형 이미지 · 우측 이름 + 액션(상세 보기 토글) · 아래 펼침 패널
				     - 좁음(<680px): 상단 이미지 · 하단 이름 + 액션(상세 보기 토글) · 아래 펼침 패널 -->
				<header class="artist-hero">
					<div class="artist-hero-media" bind:clientWidth={heroMediaWidth}>
						<FdImage
							class="artist-hero-image"
							src={imageSrc}
							alt={artist.name}
							loading="eager"
							decoding="async"
							objectPosition="50% 40%"
							radius={HERO_RADIUS}
							setting={heroImageSetting}
							active={true}
							disableWave={false}
							bind:extractedWaveColor
							fullWidth
						/>
					</div>

					<div class="artist-hero-right">
						<div class="artist-hero-head">
							<div class="artist-hero-identity">
								<h1 class="artist-hero-name">{artist.name}</h1>

								<div class="artist-hero-actions">
									<ArtistFollowButton
										{following}
										loading={followLoading}
										onToggle={onToggleFollow}
									/>
									<ArtistShareButton onShare={onShareLink} />
									<span class="more-toggle-slot">
										<ArtistMoreToggleButton open={moreOpen} onToggle={onToggleMore} />
									</span>
								</div>
							</div>

							<!-- 넓은 PC 화면에서만 이름 옆에 상세 정보를 바로 표시 -->
							<div class="inline-detail-slot">
								<ArtistMoreInfoPanel {artist} inline={true} />
							</div>
						</div>
					</div>
				</header>

				<!-- 중간·좁은 PC 화면에서 상세 보기 버튼 클릭 시 세로로 펼쳐지는 상세 정보 영역 -->
				<div class="collapsible-detail-slot">
					<ArtistMoreInfoPanel {artist} open={moreOpen} />
				</div>
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
		container-type: inline-size;
		container-name: pc-artist-detail;
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

	/* ── 1) 넓은 PC 기본 (>= 980px): 좌측 초대형 이미지 + 우측 이름 → 버튼 → 하단 상세 정보 인라인 ── */
	.artist-hero {
		display: flex;
		align-items: center;
		gap: clamp(2.25rem, 3.6cqi, 3.5rem);
	}

	.artist-hero-media {
		position: relative;
		width: clamp(340px, 34cqi, 440px);
		aspect-ratio: 1 / 1;
		flex-shrink: 0;
	}

	.artist-hero-media :global(.fd-image-wrap.artist-hero-image) {
		width: 100%;
		height: 100%;
	}

	.artist-hero-right {
		min-width: 0;
		flex: 1;
	}

	.artist-hero-head {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 1.5rem;
	}

	.artist-hero-identity {
		width: 100%;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 1.25rem;
	}

	.artist-hero-name {
		margin: 0;
		font-size: clamp(2.4rem, 3.8cqi, 3.5rem);
		font-weight: var(--fw-extrabold);
		letter-spacing: -0.03em;
		line-height: 1.1;
		color: var(--white);
		word-break: keep-all;
	}

	.artist-hero-actions {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.65rem;
	}

	.inline-detail-slot {
		width: 100%;
		min-width: 0;
	}

	.more-toggle-slot,
	.collapsible-detail-slot {
		display: none;
	}

	/* ── 2) 중간 PC (< 980px): 이미지 축소 + 상세 정보는 토글 버튼으로 여닫기 ── */
	@container pc-artist-detail (max-width: 979px) {
		.artist-hero {
			gap: 1.85rem;
		}

		.artist-hero-media {
			width: clamp(210px, 28cqi, 260px);
		}

		.artist-hero-head {
			display: flex;
			flex-direction: column;
			align-items: flex-start;
		}

		.inline-detail-slot {
			display: none;
		}

		.more-toggle-slot {
			display: inline-flex;
		}

		.collapsible-detail-slot {
			display: block;
		}
	}

	/* ── 3) 좁은 PC (< 680px): 이미지 상단 중앙 · 이름과 버튼 하단 중앙 배치 ── */
	@container pc-artist-detail (max-width: 679px) {
		.artist-hero {
			flex-direction: column;
			align-items: center;
			text-align: center;
			gap: 1.5rem;
		}

		.artist-hero-media {
			width: clamp(220px, 46cqi, 270px);
		}

		.artist-hero-right,
		.artist-hero-head,
		.artist-hero-identity {
			width: 100%;
			align-items: center;
		}

		.artist-hero-name {
			text-align: center;
		}

		.artist-hero-actions {
			justify-content: center;
		}
	}
</style>
