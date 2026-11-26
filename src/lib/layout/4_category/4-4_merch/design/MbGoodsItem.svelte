<script lang="ts">
	import { scrollReveal } from '#lib/common/logic';
	import {
		formatGoodsPrice,
		resolveGoodsImageUrl,
		type CatalogGoods
	} from '#lib/common/catalog/goods';
	import {
		DETAIL_GLOW_COLOR_OPTIONS,
		extractImageAverageColor,
		markImageCorsBlocked,
		resolveImageCrossOrigin
	} from '#lib/common/design/fluid/imageColor';
	import type { GoodsSelectPayload } from '../logic/goodsCategory.svelte';

	interface Props {
		goods: CatalogGoods;
		interactive?: boolean;
		onSelect?: (payload: GoodsSelectPayload) => void;
	}

	let { goods, interactive = true, onSelect }: Props = $props();

	let pressed = $state(false);
	let useCorsFallback = $state(false);
	let imgEl = $state<HTMLImageElement | null>(null);

	const imageUrl = $derived(resolveGoodsImageUrl(goods));
	const imgCrossOrigin = $derived<'anonymous' | undefined>(
		!imageUrl || useCorsFallback ? undefined : resolveImageCrossOrigin(imageUrl)
	);
	const imgRenderKey = $derived(`${imageUrl}|${imgCrossOrigin ?? 'nocors'}`);
	const priceText = $derived(formatGoodsPrice(goods.price));
	const isSoldOut = $derived(goods.badge === '품절');

	$effect(() => {
		void imageUrl;
		useCorsFallback = false;
	});

	function handleImgError() {
		if (imgCrossOrigin === 'anonymous' && imageUrl) {
			markImageCorsBlocked(imageUrl);
			useCorsFallback = true;
		}
	}

	$effect(() => {
		if (!interactive) {
			pressed = false;
		}
	});

	function handleSelect() {
		if (imgEl && imageUrl) {
			extractImageAverageColor(imgEl, imageUrl, DETAIL_GLOW_COLOR_OPTIONS);
		}
		onSelect?.({ goods });
	}
</script>

<!-- 모바일 전용 굿즈 카드 아이템 (4:5 룩북 카드 + 공용 스크롤 진입/이탈 모션, 순수 렌더링) -->
<article
	use:scrollReveal
	class="mb-goods-item mb-scroll-reveal"
	class:is-pressed={interactive && pressed}
	class:is-sold-out={isSoldOut}
>
	<button
		type="button"
		class="goods-card-btn"
		aria-label={`${goods.name} - ${goods.artistName}`}
		onpointerdown={() => {
			pressed = true;
		}}
		onpointerup={() => {
			pressed = false;
		}}
		onpointercancel={() => {
			pressed = false;
		}}
		onpointerleave={() => {
			pressed = false;
		}}
		onclick={handleSelect}
	>
		<div class="goods-media-frame">
			{#if imageUrl}
				{#key imgRenderKey}
					<img
						bind:this={imgEl}
						class="goods-img"
						src={imageUrl}
						alt={goods.name}
						crossorigin={imgCrossOrigin}
						loading="eager"
						decoding="auto"
						onerror={handleImgError}
					/>
				{/key}
			{:else}
				<div class="goods-img-fallback" aria-hidden="true"></div>
			{/if}

			{#if isSoldOut}
				<span class="goods-soldout-pill">품절</span>
			{/if}
		</div>

		<div class="goods-info">
			{#if goods.artistName}
				<span class="goods-artist">{goods.artistName}</span>
			{/if}
			<h3 class="goods-name">{goods.name}</h3>
			{#if goods.category || priceText}
				<div class="goods-meta-row">
					{#if goods.category}
						<span class="goods-category-pill">{goods.category}</span>
					{/if}
					{#if priceText}
						<span class="goods-price">{priceText}</span>
					{/if}
				</div>
			{/if}
		</div>
	</button>
</article>

<style>
	.mb-goods-item {
		width: 100%;
		box-sizing: border-box;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
	}

	.goods-card-btn {
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

	.goods-media-frame {
		position: relative;
		width: 100%;
		aspect-ratio: 4 / 5;
		border-radius: 12px;
		overflow: hidden;
		background: var(--surface);
		transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.mb-goods-item.is-pressed .goods-media-frame {
		transform: scale(0.975);
	}

	.goods-img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		pointer-events: none;
	}

	.goods-img-fallback {
		width: 100%;
		height: 100%;
		background: linear-gradient(155deg, var(--surface-2), var(--surface-dim));
	}

	.mb-goods-item.is-sold-out .goods-img {
		opacity: 0.56;
	}

	.goods-soldout-pill {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		z-index: 2;
		padding: 0.14rem 0.48rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--bg) 78%, transparent);
		color: var(--muted);
		font-size: 0.66rem;
		font-weight: var(--fw-semibold);
		line-height: 1.25;
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
		pointer-events: none;
	}

	.goods-info {
		margin-top: 0.55rem;
		display: flex;
		flex-direction: column;
		gap: 0.16rem;
		min-width: 0;
	}

	.goods-artist {
		font-size: 0.72rem;
		font-weight: var(--fw-medium);
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.goods-name {
		margin: 0;
		font-size: 0.86rem;
		font-weight: var(--fw-semibold);
		line-height: 1.32;
		letter-spacing: -0.02em;
		color: var(--fg);
		display: -webkit-box;
		line-clamp: 2;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		word-break: keep-all;
	}

	.goods-meta-row {
		margin-top: 0.14rem;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.goods-category-pill {
		padding: 0.1rem 0.42rem;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--white-3);
		font-size: 0.68rem;
		font-weight: var(--fw-medium);
		line-height: 1.2;
	}

	.goods-price {
		font-size: 0.84rem;
		font-weight: var(--fw-bold);
		color: var(--white-2);
	}

	.mb-goods-item.is-sold-out .goods-meta-row {
		opacity: 0.52;
	}

	.mb-goods-item.is-sold-out .goods-category-pill,
	.mb-goods-item.is-sold-out .goods-price {
		color: var(--muted);
		text-decoration: line-through;
	}

	@media (prefers-reduced-motion: reduce) {
		.goods-media-frame {
			transition: none;
		}
	}
</style>
