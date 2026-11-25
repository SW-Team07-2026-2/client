<script lang="ts">
	import { scrollReveal } from '#lib/common/logic';
	import FdLine from '#lib/common/design/fluid/FdLine.svelte';
	import {
		extractImageAverageColor,
		getCachedImageAverageColor,
		markImageCorsBlocked,
		resolveImageCrossOrigin
	} from '#lib/common/design/fluid/imageColor';
	import { formatAlbumPriceRange } from '#lib/common/catalog/albums';
	import type { AlbumCardGroup, AlbumSelectPayload } from '../logic/albumCategory.svelte';
	import AlbumMediaBack from '../part/AlbumMediaBack.svelte';

	const FALLBACK_WAVE_COLOR = 'var(--white-3)';
	const WAVE_COLOR_OPTIONS = { whiteMix: 0.45, saturationBoost: 1.45 } as const;

	interface Props {
		group: AlbumCardGroup;
		interactive?: boolean;
		onSelect?: (payload: AlbumSelectPayload) => void;
	}

	let { group, interactive = true, onSelect }: Props = $props();

	let hovered = $state(false);
	let focused = $state(false);
	let useCorsFallback = $state(false);
	let extractedColor = $state<string>(FALLBACK_WAVE_COLOR);
	let coverImgEl = $state<HTMLImageElement | null>(null);

	const coverUrl = $derived(group.frontCoverUrl);
	const isSoldOut = $derived(group.isSoldOut);
	const isActive = $derived(interactive && (hovered || focused));
	const imgCrossOrigin = $derived<'anonymous' | undefined>(
		useCorsFallback ? undefined : resolveImageCrossOrigin(coverUrl)
	);
	const imgRenderKey = $derived(`${coverUrl}|${imgCrossOrigin ?? 'nocors'}`);

	$effect(() => {
		const url = coverUrl;
		useCorsFallback = false;
		const cached = getCachedImageAverageColor(url, WAVE_COLOR_OPTIONS);
		if (cached) {
			extractedColor = cached;
		} else {
			extractedColor = FALLBACK_WAVE_COLOR;
		}
	});

	// 브라우저 캐시로 이미 완료된 이미지는 onload가 누락될 수 있으므로 마운트 직후에도 추출 시도
	$effect(() => {
		const img = coverImgEl;
		const url = coverUrl;
		if (!img || !url || !img.complete || img.naturalWidth === 0) return;
		const avg = extractImageAverageColor(img, url, WAVE_COLOR_OPTIONS);
		if (avg) {
			extractedColor = avg;
		}
	});

	const backWaveSetting = $derived({
		color: extractedColor,
		layers: 2,
		layerGap: 7,
		waveAmp: 5,
		waveLength: 64,
		spin: 1.15
	});

	function handleCoverLoad(e: Event) {
		const img = e.currentTarget as HTMLImageElement | null;
		if (!img) return;
		const avg = extractImageAverageColor(img, coverUrl, WAVE_COLOR_OPTIONS);
		extractedColor = avg ?? FALLBACK_WAVE_COLOR;
	}

	function handleCoverError() {
		if (imgCrossOrigin === 'anonymous') {
			markImageCorsBlocked(coverUrl);
			useCorsFallback = true;
		}
		extractedColor = FALLBACK_WAVE_COLOR;
	}

	$effect(() => {
		if (!interactive) {
			hovered = false;
			focused = false;
		}
	});

	function handleSelect() {
		onSelect?.({ group });
	}
</script>

<!-- PC 전용 앨범 카드 (FolderFloat 역사다리꼴 앞판 틸트 + Fan Cards 상단 부채꼴 미디어 펼침 · 스크롤 모션, 순수 렌더링) -->
<article
	use:scrollReveal={{ topMargin: 76, bottomMargin: 28 }}
	class="pc-album-item scroll-reveal"
	class:is-active={isActive}
	class:is-sold-out={isSoldOut}
	onpointerenter={(e) => {
		if (e.pointerType === 'mouse') hovered = true;
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
		class="album-card-btn"
		aria-label={`${group.title} - ${group.artistName}`}
		onclick={handleSelect}
	>
		<!-- 제자리 고정 1:1 앨범 슬리브: hover 시 앞판이 하단 축 기준으로 앞으로 기울며 역사다리꼴 형성 + 위쪽으로 실물 미디어 펼침 -->
		<div class="album-stage">
			<div class="album-folder">
				<!-- 1) 뒤판(포켓 내부 배경) -->
				<div class="album-backplate" aria-hidden="true"></div>

				<!-- 2) 내부 실물 상품(LP/CD/카세트 — 1개면 위로 상승, 여러 개면 부채꼴로 펼침) -->
				<AlbumMediaBack items={group.mediaItems} {coverUrl} open={isActive} {interactive} />

				<!-- 3~4) 앞판 래퍼: 윗모서리에 붙은 유체 물결(뒤) + 사각형 앨범 커버(앞)가 함께 3D 틸트 -->
				<div class="album-sleeve-shell">
					<div class="album-sleeve-wave" aria-hidden="true">
						<FdLine
							active={isActive}
							direction="up"
							thickness={0}
							baseHeight={20}
							setting={backWaveSetting}
						/>
					</div>

					<div class="album-sleeve">
						{#if coverUrl}
							{#key imgRenderKey}
								<img
									bind:this={coverImgEl}
									class="album-cover-img"
									src={coverUrl}
									alt={group.title}
									crossorigin={imgCrossOrigin}
									loading="lazy"
									decoding="async"
									onload={handleCoverLoad}
									onerror={handleCoverError}
								/>
							{/key}
						{:else}
							<div class="album-cover-fallback" aria-hidden="true"></div>
						{/if}
						<div class="album-sleeve-sheen" aria-hidden="true"></div>

						{#if isSoldOut}
							<div class="album-soldout-overlay">
								<span class="album-soldout-badge">품절</span>
							</div>
						{/if}

						<div class="album-overlay-info">
							<h3 class="album-title">{group.title}</h3>
							{#if group.artistName}
								<p class="album-artist">{group.artistName}</p>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="album-meta-list">
			{#each group.formatPrices as row (row.format)}
				{@const rowPrice = formatAlbumPriceRange(row.minPrice, row.maxPrice)}
				<div class="album-meta-row" class:is-row-soldout={row.soldOut}>
					<span class="album-format">{row.format}</span>
					{#if rowPrice}
						<span class="album-price">{rowPrice}</span>
					{/if}
				</div>
			{/each}
		</div>
	</button>
</article>

<style>
	.pc-album-item {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 204px;
		margin: 0 auto;
		box-sizing: border-box;
		user-select: none;
	}

	.pc-album-item.is-active {
		z-index: 20;
	}

	.album-card-btn {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		width: 100%;
		padding: 0;
		margin: 0;
		border: none;
		background: transparent;
		font: inherit;
		text-align: left;
		color: inherit;
		cursor: pointer;
		outline: none;
	}

	.album-card-btn:focus-visible .album-sleeve {
		outline: 2px solid color-mix(in srgb, var(--white) 80%, transparent);
		outline-offset: 4px;
	}

	.album-stage {
		position: relative;
		width: 100%;
	}

	.album-folder {
		position: relative;
		width: 100%;
		aspect-ratio: 1 / 1;
	}

	/* 앨범 재킷 뒤판 (앞판이 기울어 열릴 때 내부 포켓 깊이를 형성) */
	.album-backplate {
		position: absolute;
		inset: 0;
		z-index: 1;
		border-radius: 12px;
		background: linear-gradient(180deg, var(--surface-dim) 0%, var(--bg) 100%);
		border: var(--thin-border);
		box-shadow: inset 0 12px 24px rgba(0, 0, 0, 0.55);
		opacity: 0;
		transition: opacity 0.3s ease;
	}

	.pc-album-item.is-active .album-backplate {
		opacity: 1;
	}

	/* 앞판 래퍼: 윗모서리에 붙은 물결(z:1) + 앨범 커버(z:2)가 동일한 3D 역사다리꼴로 함께 기울어짐 */
	.album-sleeve-shell {
		position: relative;
		z-index: 6;
		width: 100%;
		height: 100%;
		overflow: visible;
		transform-origin: 50% 100%;
		transform: perspective(640px) translateZ(0px) rotateX(0deg);
		will-change: transform;
		transition: transform 0.36s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.pc-album-item.is-active .album-sleeve-shell {
		transform: perspective(640px) translateZ(-28px) rotateX(-50deg);
		transition: transform 0.46s cubic-bezier(0.22, 1.12, 0.36, 1);
	}

	/* 앨범 앞 커버 윗모서리 살짝 아래쪽에 기준선을 숨기고 위쪽으로 물결이 솟아오르게 배치 */
	.album-sleeve-wave {
		position: absolute;
		top: 8px;
		left: 4px;
		right: 4px;
		z-index: 1;
		pointer-events: none;
	}

	/* 전면 사각형 앨범 커버 */
	.album-sleeve {
		position: relative;
		z-index: 2;
		width: 100%;
		height: 100%;
		border-radius: 12px;
		overflow: hidden;
		background: var(--surface);
		border: var(--thin-border);
		box-shadow: 0 10px 24px rgba(0, 0, 0, 0.45);
		transition:
			box-shadow 0.36s cubic-bezier(0.22, 1, 0.36, 1),
			border-color 0.28s ease;
	}

	.pc-album-item.is-active .album-sleeve {
		box-shadow:
			0 22px 36px rgba(0, 0, 0, 0.65),
			inset 0 1px 0 color-mix(in srgb, var(--white) 32%, transparent);
		border-color: color-mix(in srgb, var(--white) 24%, transparent);
	}

	.album-cover-img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		pointer-events: none;
	}

	.album-cover-fallback {
		width: 100%;
		height: 100%;
		background: linear-gradient(145deg, var(--surface-2), var(--surface-dim));
	}

	.album-sleeve-sheen {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: linear-gradient(
			180deg,
			color-mix(in srgb, var(--white) 14%, transparent) 0%,
			transparent 38%,
			rgba(0, 0, 0, 0.22) 100%
		);
		opacity: 0.7;
		transition: opacity 0.32s ease;
	}

	.pc-album-item.is-active .album-sleeve-sheen {
		opacity: 1;
	}

	.album-overlay-info {
		position: absolute;
		right: 0.78rem;
		bottom: 0.72rem;
		left: 0.78rem;
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		text-align: left;
		gap: 0.14rem;
		pointer-events: none;
	}

	.pc-album-item.is-sold-out .album-cover-img {
		opacity: 0.62;
	}

	.album-title {
		margin: 0;
		max-width: 100%;
		font-size: 0.94rem;
		font-weight: var(--fw-bold);
		line-height: 1.28;
		letter-spacing: -0.02em;
		color: var(--white);
		text-shadow:
			0 1px 3px rgba(0, 0, 0, 0.75),
			0 2px 12px rgba(0, 0, 0, 0.55);
		display: -webkit-box;
		line-clamp: 2;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		word-break: keep-all;
	}

	.album-artist {
		margin: 0;
		max-width: 100%;
		font-size: 0.78rem;
		font-weight: var(--fw-medium);
		line-height: 1.25;
		color: color-mix(in srgb, var(--white) 86%, transparent);
		text-shadow:
			0 1px 3px rgba(0, 0, 0, 0.72),
			0 2px 10px rgba(0, 0, 0, 0.5);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.album-soldout-overlay {
		position: absolute;
		inset: 0;
		z-index: 3;
		display: grid;
		place-items: center;
		pointer-events: none;
	}

	.album-soldout-badge {
		padding: 0.34rem 0.9rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--bg) 76%, transparent);
		border: 1px solid color-mix(in srgb, var(--white) 24%, transparent);
		color: var(--white);
		font-size: 0.82rem;
		font-weight: var(--fw-bold);
		letter-spacing: 0.04em;
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
	}

	.album-meta-list {
		margin-top: 0.62rem;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.8rem;
		line-height: 1.25;
	}

	.album-meta-row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.album-meta-row.is-row-soldout {
		opacity: 0.55;
	}

	.album-meta-row.is-row-soldout .album-format,
	.album-meta-row.is-row-soldout .album-price {
		text-decoration: line-through;
	}

	.album-format {
		padding: 0.12rem 0.46rem;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--white-3);
		font-size: 0.72rem;
		font-weight: var(--fw-medium);
		letter-spacing: 0.01em;
	}

	.album-price {
		font-size: 0.84rem;
		font-weight: var(--fw-semibold);
		color: var(--fg);
		letter-spacing: -0.01em;
	}

	@media (prefers-reduced-motion: reduce) {
		.album-sleeve,
		.album-backplate,
		.album-sleeve-sheen,
		.album-title {
			transition: none;
		}
	}
</style>
