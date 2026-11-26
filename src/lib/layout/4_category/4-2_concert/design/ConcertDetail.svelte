<script lang="ts">
	import { Accordion, AccordionItem } from '#lib/common/design/accordion';
	import DetailTopNav from '#lib/common/design/DetailTopNav.svelte';
	import MarkdownViewer from '#lib/common/design/MarkdownViewer.svelte';
	import FdButton from '#lib/common/design/fluid/FdButton.svelte';
	import FdImage from '#lib/common/design/fluid/FdImage.svelte';
	import { createPrimaryCtaSetting } from '#lib/common/design/fluid/ctaPreset';
	import SlidingPrice from '#lib/common/design/SlidingPrice.svelte';
	import { LoadingSpinner } from '#lib/dedicated/loading';
	import DetailAmbientGlow from '../../_shared/design/DetailAmbientGlow.svelte';
	import type {
		ConcertLineupArtist,
		ConcertVenueDetail
	} from '../logic/concertDetail.svelte';

	interface Props {
		isLoading: boolean;
		errorMessage: string | null;
		title: string;
		typeLabel: string;
		genreLabel: string;
		saleStatusLabel: string;
		isOnSale: boolean;
		isClosed: boolean;
		startsAtText: string;
		endsAtText: string;
		bookingOpenAtText: string;
		price: number | null;
		queueEnabled: boolean;
		maxSeatsPerUser: number | null;
		ctaLabel: string;
		artists: readonly ConcertLineupArtist[];
		venue: ConcertVenueDetail | null;
		description: string;
		requirements: string;
		terms: string;
		posterUrl: string;
		imageUrls: readonly string[];
		accentColor: string;
		mobile: boolean;
		backLabel?: string;
		onClose: () => void;
		onGoToArtist: (artistId: number) => void;
		onStartBooking: () => void;
		onShareLink: () => void;
	}

	let {
		isLoading,
		errorMessage,
		title,
		typeLabel,
		genreLabel,
		saleStatusLabel,
		isOnSale,
		isClosed,
		startsAtText,
		endsAtText,
		bookingOpenAtText,
		price,
		queueEnabled,
		maxSeatsPerUser,
		ctaLabel,
		artists,
		venue,
		description,
		requirements,
		terms,
		posterUrl,
		imageUrls,
		accentColor,
		mobile,
		backLabel = '목록으로',
		onClose,
		onGoToArtist,
		onStartBooking,
		onShareLink
	}: Props = $props();

	const HERO_RADIUS = 24;
	const HERO_WAVES_PER_EDGE = 2.5;

	let extractedWaveColor = $state('');
	let heroMediaWidth = $state(320);
	let ctaBtnWidth = $state(240);

	const glowColor = $derived(
		extractedWaveColor &&
			extractedWaveColor !== 'var(--muted-wave)' &&
			extractedWaveColor !== 'var(--white)'
			? extractedWaveColor
			: accentColor
	);

	const heroImageSetting = $derived.by(() => {
		const w = Math.max(160, heroMediaWidth);
		const h = (w * 4) / 3;
		const perimeter = 2 * (w + h) - 1.717 * HERO_RADIUS;
		const waveLength = Math.round(perimeter / (HERO_WAVES_PER_EDGE * 4));
		return {
			radius: HERO_RADIUS,
			waveLength,
			pauseWhenIdle: false
		};
	});

	const ctaSetting = $derived(createPrimaryCtaSetting(ctaBtnWidth, !isOnSale));
</script>

<!-- 공연 상세 뷰 (앰비언트 글로우 · 3:4 FdImage 포스터 · 라인업 · 공연/공연장 정보 · 예매 CTA, 순수 렌더링) -->
<div class="concert-detail" class:is-mobile={mobile}>
	<DetailAmbientGlow color={glowColor} height={mobile ? 380 : 540} />

	<div class="detail-container">
		<DetailTopNav {mobile} {backLabel} onBack={onClose} onShare={onShareLink} shareLabel="공연 링크 공유" />

		{#if isLoading && !title}
			<div class="detail-state-box" role="status" aria-live="polite">
				<LoadingSpinner size={24} />
			</div>
		{:else if errorMessage && !title}
			<div class="detail-state-box" role="alert">
				<p class="detail-error-text">{errorMessage}</p>
			</div>
		{:else}
			<header class="concert-hero">
				<div
					class="concert-hero-poster"
					class:is-closed={isClosed}
					bind:clientWidth={heroMediaWidth}
				>
					{#if posterUrl}
						<FdImage
							class="concert-poster-fd"
							src={posterUrl}
							alt={title}
							loading="eager"
							decoding="async"
							objectPosition="50% 50%"
							radius={HERO_RADIUS}
							setting={heroImageSetting}
							active={true}
							disableWave={false}
							bind:extractedWaveColor
							fullWidth
						/>
					{:else}
						<div class="poster-fallback" aria-hidden="true"></div>
					{/if}
				</div>

				<div class="concert-hero-info">
					<div class="concert-eyebrow">
						{#if saleStatusLabel}
							<span class="eyebrow-pill" class:is-onsale={isOnSale} class:is-closed={isClosed}>
								{saleStatusLabel}
							</span>
						{/if}
						{#if typeLabel}
							<span class="eyebrow-pill">{typeLabel}</span>
						{/if}
						{#if genreLabel}
							<span class="eyebrow-text">{genreLabel}</span>
						{/if}
					</div>

					<h1 class="concert-title">{title}</h1>

					{#if artists.length > 0}
						<div class="lineup-row" aria-label="출연 아티스트">
							{#each artists as artist (artist.id)}
								<button
									type="button"
									class="artist-chip-btn"
									onclick={() => onGoToArtist(artist.id)}
								>
									<span>{artist.name}</span>
									<svg
										width="13"
										height="13"
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
							{/each}
						</div>
					{/if}

					<dl class="concert-info-list">
						{#if startsAtText}
							<div class="info-row">
								<dt>공연 일시</dt>
								<dd>
									{startsAtText}{#if endsAtText} ~ {endsAtText}{/if}
								</dd>
							</div>
						{/if}

						{#if venue?.name}
							<div class="info-row">
								<dt>공연장</dt>
								<dd>
									<span>{venue.name}</span>
									{#if venue.region}
										<span class="info-sub">({venue.region})</span>
									{/if}
									{#if venue.address}
										<p class="info-address">{venue.address}</p>
									{/if}
								</dd>
							</div>
						{/if}

						{#if bookingOpenAtText}
							<div class="info-row">
								<dt>예매 오픈</dt>
								<dd>{bookingOpenAtText}</dd>
							</div>
						{/if}

						{#if maxSeatsPerUser !== null}
							<div class="info-row">
								<dt>예매 제한</dt>
								<dd>
									1인 최대 {maxSeatsPerUser}매
									{#if queueEnabled}
										<span class="info-sub">· 대기열 운영</span>
									{/if}
								</dd>
							</div>
						{/if}
					</dl>

					<div class="booking-bar">
						<div class="booking-cta-wrap" bind:clientWidth={ctaBtnWidth}>
							<FdButton
								setting={ctaSetting}
								fullWidth
								disabled={!isOnSale}
								class="concert-booking-fd-btn"
								onclick={onStartBooking}
							>
								{ctaLabel}
							</FdButton>
						</div>

						{#if price !== null}
							<div class="booking-price">
								<SlidingPrice value={price} soldOut={isClosed} soldOutText="판매 종료" />
							</div>
						{/if}
					</div>
				</div>
			</header>

			{#if description}
				<section class="detail-section" aria-label="공연 소개">
					<h2 class="section-title">공연 소개</h2>
					<MarkdownViewer content={description} class="concert-md" />
				</section>
			{/if}

			{#if imageUrls.length > 0}
				<section class="detail-section" aria-label="공연 상세 이미지">
					<h2 class="section-title">상세 이미지</h2>
					<div class="gallery-grid">
						{#each imageUrls as url, idx (url + idx)}
							<img class="gallery-img" src={url} alt={`${title} 상세 이미지 ${idx + 1}`} loading="lazy" />
						{/each}
					</div>
				</section>
			{/if}

			{#if requirements || terms}
				<section class="detail-section" aria-label="관람 안내 및 유의사항">
					<h2 class="section-title">관람 안내 · 유의사항</h2>
					<Accordion multiple={true}>
						{#if requirements}
							<AccordionItem value="requirements" title="입장 · 준비 사항">
								<MarkdownViewer content={requirements} class="concert-md" />
							</AccordionItem>
						{/if}
						{#if terms}
							<AccordionItem value="terms" title="예매 · 취소 약관">
								<MarkdownViewer content={terms} class="concert-md" />
							</AccordionItem>
						{/if}
					</Accordion>
				</section>
			{/if}
		{/if}
	</div>
</div>

<style>
	.concert-detail {
		position: relative;
		width: 100%;
		min-height: calc(100dvh - var(--pc-header-height, 70px));
		background: var(--bg);
		color: var(--fg);
		overflow: clip;
		box-sizing: border-box;
		container-type: inline-size;
		container-name: concert-detail;
	}

	.concert-detail.is-mobile {
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

	.concert-detail.is-mobile .detail-container {
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

	.concert-hero {
		display: flex;
		align-items: flex-start;
		gap: clamp(2rem, 4cqi, 3.75rem);
	}

	.concert-hero-poster {
		flex-shrink: 0;
		width: clamp(260px, 32cqi, 370px);
		aspect-ratio: 3 / 4;
	}

	.concert-hero-poster :global(.fd-image-wrap.concert-poster-fd) {
		width: 100%;
		height: 100%;
	}

	.concert-hero-poster.is-closed :global(.fd-image-wrap.concert-poster-fd) {
		opacity: 0.62;
	}

	.poster-fallback {
		width: 100%;
		height: 100%;
		border-radius: 24px;
		background: linear-gradient(155deg, var(--surface-2), var(--surface-dim));
	}

	.concert-hero-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}

	.concert-eyebrow {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-bottom: 0.6rem;
	}

	.eyebrow-pill {
		padding: 0.16rem 0.6rem;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--white-2);
		font-size: 0.75rem;
		font-weight: var(--fw-semibold);
	}

	.eyebrow-pill.is-onsale {
		background: var(--white-2);
		color: var(--bg);
	}

	.eyebrow-pill.is-closed {
		background: var(--surface);
		color: var(--muted);
	}

	.eyebrow-text {
		font-size: 0.82rem;
		color: var(--muted);
	}

	.concert-title {
		margin: 0;
		font-size: clamp(1.7rem, 3cqi, 2.5rem);
		font-weight: var(--fw-extrabold);
		letter-spacing: -0.03em;
		line-height: 1.2;
		color: var(--white);
		word-break: keep-all;
	}

	.lineup-row {
		margin-top: 0.85rem;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.artist-chip-btn {
		height: 32px;
		padding: 0 0.7rem 0 0.8rem;
		border: none;
		border-radius: 999px;
		background: var(--surface);
		color: var(--fg);
		font: inherit;
		font-size: 0.84rem;
		font-weight: var(--fw-semibold);
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		cursor: pointer;
		transition:
			background-color 0.16s ease,
			color 0.16s ease;
	}

	.artist-chip-btn:hover {
		background: var(--surface-2);
		color: var(--white);
	}

	.concert-info-list {
		width: 100%;
		margin: 1.5rem 0 0;
		padding: 1.25rem 0 0;
		border-top: var(--thin-border);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.info-row {
		display: grid;
		grid-template-columns: 86px minmax(0, 1fr);
		gap: 0.75rem;
		font-size: 0.9rem;
		line-height: 1.45;
	}

	.info-row dt {
		color: var(--muted);
		font-weight: var(--fw-medium);
	}

	.info-row dd {
		margin: 0;
		color: var(--fg);
		font-weight: var(--fw-medium);
	}

	.info-sub {
		margin-left: 0.35rem;
		font-size: 0.82rem;
		color: var(--muted);
	}

	.info-address {
		margin: 0.2rem 0 0;
		font-size: 0.82rem;
		color: var(--muted);
	}

	.booking-bar {
		width: 100%;
		margin-top: 1.75rem;
		padding-top: 1.5rem;
		border-top: var(--thin-border);
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.85rem;
	}

	.booking-cta-wrap {
		flex: 1 1 180px;
		min-width: 160px;
	}

	.booking-cta-wrap :global(.fd-wrap) {
		margin: -6px;
		width: calc(100% + 12px);
	}

	.booking-cta-wrap :global(.fd-btn.concert-booking-fd-btn) {
		width: 100%;
		height: 48px;
		padding: 0 1.25rem;
		font-size: 0.95rem;
		font-weight: var(--fw-bold);
	}

	.booking-price {
		margin-left: auto;
		flex-shrink: 0;
	}

	.detail-section {
		margin-top: 3rem;
		padding-top: 2rem;
		border-top: var(--thin-border);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.section-title {
		margin: 0;
		font-size: 1.12rem;
		font-weight: var(--fw-bold);
		color: var(--white);
		letter-spacing: -0.02em;
	}

	.concert-detail :global(.concert-md) {
		color: var(--fg);
		font-size: 0.94rem;
		line-height: 1.72;
		word-break: keep-all;
	}

	.gallery-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 0.9rem;
	}

	.gallery-img {
		width: 100%;
		border-radius: 16px;
		object-fit: cover;
		display: block;
		background: var(--surface);
	}

	@container concert-detail (max-width: 740px) {
		.concert-hero {
			flex-direction: column;
			align-items: stretch;
			gap: 1.5rem;
		}

		.concert-hero-poster {
			width: min(100%, 280px);
			margin: 0 auto;
		}
	}
</style>
