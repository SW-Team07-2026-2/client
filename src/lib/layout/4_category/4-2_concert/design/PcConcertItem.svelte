<script lang="ts">
	import {
		resolveConcertPosterUrl,
		type CatalogConcert
	} from '#lib/common/catalog/concerts';
	import FdLine from '#lib/common/design/fluid/FdLine.svelte';
	import {
		DETAIL_GLOW_COLOR_OPTIONS,
		extractImageAverageColor,
		getCachedImageAverageColor,
		markImageCorsBlocked,
		resolveImageCrossOrigin,
		type ImageAverageColorOptions
	} from '#lib/common/design/fluid/imageColor';
	import type { ConcertSelectPayload } from '../logic/concertCategory.svelte';

	interface Props {
		concert: CatalogConcert;
		interactive?: boolean;
		onSelect?: (payload: ConcertSelectPayload) => void;
	}

	/** 아티스트·앨범 FdImage 물결 색상 추출과 동일한 채도·화이트 혼합 계수 */
	const WAVE_COLOR_OPTIONS: ImageAverageColorOptions = {
		whiteMix: 0.45,
		saturationBoost: 1.45
	};

	let { concert, interactive = true, onSelect }: Props = $props();

	let imgError = $state(false);
	let imgLoaded = $state(false);
	let useCorsFallback = $state(false);
	let imgEl = $state<HTMLImageElement | null>(null);
	let hovered = $state(false);
	let focused = $state(false);
	let waveColor = $state('var(--white)');

	const posterUrl = $derived(resolveConcertPosterUrl(concert));
	const imgCrossOrigin = $derived<'anonymous' | undefined>(
		!posterUrl || useCorsFallback ? undefined : resolveImageCrossOrigin(posterUrl)
	);
	const imgRenderKey = $derived(`${posterUrl}|${imgCrossOrigin ?? 'nocors'}`);
	const isClosed = $derived(concert.status === '매진' || concert.status === '판매종료');
	const isOnSale = $derived(concert.status === '예매중' || concert.status === '판매중');
	const isActive = $derived(interactive && (hovered || focused));

	const sideWaveSetting = $derived({
		color: waveColor,
		waveColor,
		layers: 2,
		layerGap: 6,
		waveAmp: 4.5,
		waveLength: 62,
		spin: 1.15
	});

	function syncExtractedWaveColor() {
		if (!posterUrl || useCorsFallback) {
			waveColor = 'var(--white)';
			return;
		}
		const cached = getCachedImageAverageColor(posterUrl, WAVE_COLOR_OPTIONS);
		if (cached) {
			waveColor = cached;
			return;
		}
		if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
			const extracted = extractImageAverageColor(imgEl, posterUrl, WAVE_COLOR_OPTIONS);
			waveColor = extracted ?? 'var(--white)';
		}
	}

	$effect(() => {
		void posterUrl;
		useCorsFallback = false;
		imgError = false;
		const cached = posterUrl
			? getCachedImageAverageColor(posterUrl, WAVE_COLOR_OPTIONS)
			: null;
		waveColor = cached ?? 'var(--white)';
		imgLoaded = Boolean(imgEl && imgEl.complete && imgEl.naturalWidth > 0);
		if (imgLoaded && !cached) {
			syncExtractedWaveColor();
		}
	});

	$effect(() => {
		if (!interactive) {
			hovered = false;
			focused = false;
		}
	});

	function handleImgLoad() {
		imgLoaded = true;
		syncExtractedWaveColor();
	}

	function handleImgError() {
		if (imgCrossOrigin === 'anonymous' && posterUrl) {
			markImageCorsBlocked(posterUrl);
			useCorsFallback = true;
			imgError = false;
			imgLoaded = false;
			waveColor = 'var(--white)';
			return;
		}
		imgError = true;
	}

	function formatPrice(price?: number | null): string {
		if (typeof price !== 'number' || !Number.isFinite(price)) return '';
		if (price === 0) return '무료';
		return `${Math.round(price).toLocaleString('ko-KR')}원`;
	}

	function handleSelect() {
		if (!interactive) return;
		if (imgEl && posterUrl) {
			extractImageAverageColor(imgEl, posterUrl, DETAIL_GLOW_COLOR_OPTIONS);
		}
		onSelect?.({ concert });
	}
</script>

<!-- PC 전용 공연 포스터 카드 (3:4 비율 · hover 시 포스터 좌우 뒤쪽 추출색 FdLine 물결 · 예매 상태 배지 · 일시/장소, 순수 렌더링) -->
<article
	class="pc-concert-card"
	class:is-closed={isClosed}
	class:is-active={isActive}
	onpointerenter={(e) => {
		if (e.pointerType === 'mouse') {
			hovered = true;
			syncExtractedWaveColor();
		}
	}}
	onpointerleave={() => {
		hovered = false;
	}}
	onpointercancel={() => {
		hovered = false;
	}}
	onfocusin={(e) => {
		if ((e.target as HTMLElement | null)?.matches?.(':focus-visible')) {
			focused = true;
			syncExtractedWaveColor();
		}
	}}
	onfocusout={(e) => {
		const nextTarget = e.relatedTarget as Node | null;
		if (!nextTarget || !e.currentTarget.contains(nextTarget)) {
			focused = false;
		}
	}}
>
	<button
		type="button"
		class="concert-trigger"
		tabindex={interactive ? 0 : -1}
		aria-label={`${concert.title} 공연 상세 보기`}
		onclick={handleSelect}
	>
		<div class="poster-stage">
			<!-- 포스터 좌/우 뒤쪽 안으로 3px 들어간 추출색 유체 물결 -->
			<div class="poster-side-wave is-left" aria-hidden="true">
				<FdLine
					active={isActive}
					direction="left"
					thickness={0}
					baseHeight={8}
					setting={sideWaveSetting}
				/>
			</div>
			<div class="poster-side-wave is-right" aria-hidden="true">
				<FdLine
					active={isActive}
					direction="right"
					thickness={0}
					baseHeight={8}
					setting={sideWaveSetting}
				/>
			</div>

			<div class="poster-frame">
				{#if posterUrl && !imgError}
					{#key imgRenderKey}
						<img
							bind:this={imgEl}
							class="poster-img"
							class:is-loaded={imgLoaded}
							src={posterUrl}
							alt={concert.title}
							crossorigin={imgCrossOrigin}
							loading="eager"
							decoding="auto"
							onload={handleImgLoad}
							onerror={handleImgError}
						/>
					{/key}
				{:else}
					<div class="poster-fallback" aria-hidden="true">
						<span>{concert.title.slice(0, 1) || 'C'}</span>
					</div>
				{/if}

				{#if concert.status}
					<span
						class="status-badge"
						class:is-onsale={isOnSale}
						class:is-closed={isClosed}
					>
						{concert.status}
					</span>
				{/if}

				{#if concert.dateText}
					<span class="date-chip">{concert.dateText}</span>
				{/if}
			</div>
		</div>

		<div class="concert-meta">
			<h3 class="concert-title">{concert.title}</h3>
			{#if concert.artistName}
				<p class="concert-artist">{concert.artistName}</p>
			{/if}
			<div class="concert-sub-row">
				{#if concert.venue}
					<span class="concert-venue">{concert.venue}</span>
				{/if}
				{#if formatPrice(concert.price)}
					<span class="concert-price">{formatPrice(concert.price)}</span>
				{/if}
			</div>
		</div>
	</button>
</article>

<style>
	.pc-concert-card {
		width: 100%;
		min-width: 0;
	}

	.concert-trigger {
		width: 100%;
		padding: 0;
		border: none;
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
		cursor: pointer;
	}

	.poster-stage {
		position: relative;
		width: 100%;
	}

	.poster-side-wave {
		position: absolute;
		top: 12px;
		bottom: 12px;
		z-index: 1;
		pointer-events: none;
	}

	.poster-side-wave.is-left {
		left: 3px;
	}

	.poster-side-wave.is-right {
		right: 3px;
	}

	.poster-frame {
		position: relative;
		z-index: 2;
		width: 100%;
		aspect-ratio: 3 / 4;
		border-radius: 16px;
		overflow: hidden;
		background: var(--surface);
	}

	.poster-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		opacity: 0;
		transition: opacity 0.28s ease;
	}

	.poster-img.is-loaded {
		opacity: 1;
	}

	.pc-concert-card.is-closed .poster-img {
		opacity: 0.58;
	}

	.poster-fallback {
		width: 100%;
		height: 100%;
		background: linear-gradient(155deg, var(--surface-2), var(--surface-dim));
		display: grid;
		place-items: center;
		font-size: 2rem;
		font-weight: var(--fw-extrabold);
		color: var(--muted);
	}

	.status-badge {
		position: absolute;
		top: 0.65rem;
		left: 0.65rem;
		padding: 0.22rem 0.58rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--bg) 74%, transparent);
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
		color: var(--white-2);
		font-size: 0.72rem;
		font-weight: var(--fw-bold);
		letter-spacing: 0.01em;
	}

	.status-badge.is-onsale {
		background: var(--white-2);
		color: var(--bg);
	}

	.status-badge.is-closed {
		color: var(--muted);
	}

	.date-chip {
		position: absolute;
		left: 0.65rem;
		bottom: 0.65rem;
		padding: 0.2rem 0.55rem;
		border-radius: 8px;
		background: color-mix(in srgb, var(--bg) 76%, transparent);
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
		color: var(--white);
		font-size: 0.73rem;
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
	}

	.concert-meta {
		display: flex;
		flex-direction: column;
		gap: 0.24rem;
		min-width: 0;
	}

	.concert-title {
		margin: 0;
		font-size: 0.96rem;
		font-weight: var(--fw-bold);
		color: var(--white);
		line-height: 1.32;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		word-break: keep-all;
	}

	.concert-artist {
		margin: 0;
		font-size: 0.82rem;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.concert-sub-row {
		margin-top: 0.12rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		font-size: 0.8rem;
	}

	.concert-venue {
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		min-width: 0;
	}

	.concert-price {
		flex-shrink: 0;
		color: var(--white-2);
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
	}
</style>
