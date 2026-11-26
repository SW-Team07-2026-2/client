<script lang="ts">
	import type { Snippet } from 'svelte';
	import { LoadingSpinner } from '#lib/dedicated/loading';
	import DetailAmbientGlow from './DetailAmbientGlow.svelte';
	import DetailTopNav from '#lib/common/design/DetailTopNav.svelte';

	interface Props {
		mobile: boolean;
		backLabel?: string;
		shareLabel?: string;
		glowColor: string;
		isLoading: boolean;
		errorMessage: string | null;
		title: string;
		artistId?: number | null;
		artistName?: string;
		/** 좌측 비주얼 슬롯 커스텀 너비 (미지정 시 기본 clamp(280px, 34cqi, 400px)) */
		visualWidth?: string;
		onBack: () => void;
		onShare?: () => void;
		onGoToArtist?: () => void;
		/** 좌측 대표 이미지/미디어 영역 */
		visual: Snippet;
		/** 제목 상단 아이브로우 배지/메타 */
		eyebrow?: Snippet;
		/** 기본 단일 아티스트 링크 대신 커스텀 아티스트 영역(예: 공연 멀티 라인업 칩) */
		artistSlot?: Snippet;
		/** 우측 하단 구매/예매 패널 */
		purchase?: Snippet;
		/** 히어로 하단 확장 섹션 (예: 앨범 수록곡 트랙리스트, 공연 소개/유의사항) */
		below?: Snippet;
	}

	let {
		mobile,
		backLabel = '목록으로',
		shareLabel = '링크 공유',
		glowColor,
		isLoading,
		errorMessage,
		title,
		artistId = null,
		artistName = '',
		visualWidth,
		onBack,
		onShare,
		onGoToArtist,
		visual,
		eyebrow,
		artistSlot,
		purchase,
		below
	}: Props = $props();
</script>

<!-- 상품 상세 공용 레이아웃 (앰비언트 글로우 · 상단 네비 · 로딩/에러 · 좌/우 2단 히어로 · 하단 확장 슬롯, 순수 렌더링) -->
<div class="product-detail" class:is-mobile={mobile}>
	<DetailAmbientGlow color={glowColor} height={mobile ? 380 : 540} />

	<div class="detail-container">
		<DetailTopNav {mobile} {backLabel} {onBack} {onShare} {shareLabel} />

		{#if isLoading && !title}
			<div class="detail-state-box" role="status" aria-live="polite">
				<LoadingSpinner size={24} />
			</div>
		{:else if errorMessage && !title}
			<div class="detail-state-box" role="alert">
				<p class="detail-error-text">{errorMessage}</p>
			</div>
		{:else}
			<header class="product-hero">
				<div
					class="product-hero-visual-slot"
					style:--hero-visual-width={visualWidth || undefined}
				>
					{@render visual()}
				</div>

				<div class="product-hero-info">
					{#if eyebrow}
						<div class="product-eyebrow">
							{@render eyebrow()}
						</div>
					{/if}

					<h1 class="product-hero-title">{title}</h1>

					{#if artistSlot}
						{@render artistSlot()}
					{:else if artistName}
						{#if artistId !== null && onGoToArtist}
							<button type="button" class="artist-link-btn" onclick={onGoToArtist}>
								<span>{artistName}</span>
								<svg
									width="15"
									height="15"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								>
									<path d="m9 18 6-6-6-6" />
								</svg>
							</button>
						{:else}
							<p class="artist-plain-name">{artistName}</p>
						{/if}
					{/if}

					{#if purchase}
						{@render purchase()}
					{/if}
				</div>
			</header>

			{#if below}
				{@render below()}
			{/if}
		{/if}
	</div>
</div>

<style>
	.product-detail {
		position: relative;
		width: 100%;
		min-height: calc(100dvh - var(--pc-header-height, 70px));
		background: var(--bg);
		color: var(--fg);
		overflow: clip;
		box-sizing: border-box;
		container-type: inline-size;
		container-name: product-detail;
	}

	.product-detail.is-mobile {
		min-height: 100%;
	}

	.detail-container {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: var(--content-max-width);
		margin: 0 auto;
		padding: 1.5rem var(--content-padding-x) 4.5rem;
		box-sizing: border-box;
	}

	.product-detail.is-mobile .detail-container {
		padding: calc(var(--mb-detail-top-offset, 0px) + 1rem) var(--content-padding-x-mobile) 3.5rem;
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

	.product-hero {
		display: flex;
		align-items: flex-start;
		gap: clamp(2rem, 4cqi, 3.75rem);
	}

	.product-hero-visual-slot {
		flex-shrink: 0;
		width: var(--hero-visual-width, clamp(280px, 34cqi, 400px));
	}

	.product-hero-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}

	.product-eyebrow {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.6rem;
	}

	.product-hero-title {
		margin: 0;
		font-size: clamp(1.75rem, 3.1cqi, 2.6rem);
		font-weight: var(--fw-extrabold);
		letter-spacing: -0.03em;
		line-height: 1.18;
		color: var(--white);
		word-break: keep-all;
	}

	.artist-link-btn {
		margin-top: 0.55rem;
		padding: 0.2rem 0;
		border: none;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 1.02rem;
		font-weight: var(--fw-semibold);
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		cursor: pointer;
		transition: color 0.16s ease;
	}

	.artist-link-btn:hover {
		color: var(--white);
	}

	.artist-plain-name {
		margin: 0.55rem 0 0;
		font-size: 1.02rem;
		font-weight: var(--fw-semibold);
		color: var(--muted);
	}

	@container product-detail (max-width: 740px) {
		.product-hero {
			flex-direction: column;
			align-items: stretch;
			gap: 1.5rem;
		}

		.product-hero-visual-slot {
			width: min(100%, 300px);
			margin: 0 auto;
		}
	}
</style>
