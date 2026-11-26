<script lang="ts">
	import { scrollReveal } from '#lib/common/logic';
	import FdLine from '#lib/common/design/fluid/FdLine.svelte';
	import {
		DETAIL_GLOW_COLOR_OPTIONS,
		extractImageAverageColor
	} from '#lib/common/design/fluid/imageColor';
	import {
		formatGoodsPrice,
		resolveGoodsImageUrl,
		type CatalogGoods
	} from '#lib/common/catalog/goods';
	import type { GoodsSelectPayload } from '../logic/goodsCategory.svelte';
	import GoodsQuickCartButton from '../part/GoodsQuickCartButton.svelte';

	interface Props {
		goods: CatalogGoods;
		interactive?: boolean;
		cartLoading?: boolean;
		onSelect?: (payload: GoodsSelectPayload) => void;
		onQuickAddToCart?: (goods: CatalogGoods) => void;
	}

	let {
		goods,
		interactive = true,
		cartLoading = false,
		onSelect,
		onQuickAddToCart
	}: Props = $props();

	let hovered = $state(false);
	let focused = $state(false);
	let imgEl = $state<HTMLImageElement | null>(null);

	const imageUrl = $derived(resolveGoodsImageUrl(goods));
	const priceText = $derived(formatGoodsPrice(goods.price));
	const isSoldOut = $derived(goods.badge === '품절');
	const isActive = $derived(interactive && (hovered || focused));
	const showQuickCart = $derived((isActive || cartLoading) && !isSoldOut);

	const bottomWaveSetting = {
		color: 'var(--muted)',
		layers: 2,
		layerGap: 18,
		waveAmp: 6,
		waveLength: 68,
		spin: 1.05
	};

	$effect(() => {
		if (!interactive) {
			hovered = false;
			focused = false;
		}
	});

	function handleSelect() {
		if (imgEl && imageUrl) {
			extractImageAverageColor(imgEl, imageUrl, DETAIL_GLOW_COLOR_OPTIONS);
		}
		onSelect?.({ goods });
	}

	function handleQuickCart() {
		onQuickAddToCart?.(goods);
	}
</script>

<!-- PC 전용 굿즈 카드 아이템 (4:5 룩북 프레임 · hover 줌 + 하단 내부 유체 물결 & 빠른 장바구니 버튼, 순수 렌더링) -->
<article
	use:scrollReveal={{ topMargin: 76, bottomMargin: 28 }}
	class="pc-goods-item scroll-reveal"
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
	<div class="goods-card-shell">
		<button
			type="button"
			class="goods-card-btn"
			aria-label={`${goods.name} - ${goods.artistName}`}
			onclick={handleSelect}
		>
			<div class="goods-media-frame">
				{#if imageUrl}
					<img
						bind:this={imgEl}
						class="goods-img"
						src={imageUrl}
						alt={goods.name}
						crossorigin="anonymous"
						loading="lazy"
						decoding="async"
					/>
				{:else}
					<div class="goods-img-fallback" aria-hidden="true"></div>
				{/if}

				{#if !isSoldOut}
					<div class="goods-bottom-wave" aria-hidden="true">
						<FdLine
							active={showQuickCart}
							direction="up"
							thickness={0}
							baseHeight={18}
							setting={bottomWaveSetting}
						/>
					</div>
				{/if}

				{#if isSoldOut}
					<div class="goods-soldout-overlay">
						<span class="goods-soldout-badge">품절</span>
					</div>
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

		{#if !isSoldOut && onQuickAddToCart}
			<div class="goods-quick-cart-slot">
				<GoodsQuickCartButton
					visible={showQuickCart}
					loading={cartLoading}
					ariaLabel={`${goods.name} 장바구니에 바로 담기`}
					onclick={handleQuickCart}
				/>
			</div>
		{/if}
	</div>
</article>

<style>
	.pc-goods-item {
		position: relative;
		width: 100%;
		box-sizing: border-box;
		user-select: none;
	}

	.goods-card-shell {
		position: relative;
		width: 100%;
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

	.goods-card-btn:focus-visible .goods-media-frame {
		outline: 2px solid color-mix(in srgb, var(--white) 80%, transparent);
		outline-offset: 4px;
	}

	.goods-media-frame {
		position: relative;
		width: 100%;
		aspect-ratio: 4 / 5;
		border-radius: 14px;
		overflow: hidden;
		background: var(--surface);
		border: var(--thin-border);
		box-shadow: 0 8px 22px rgba(0, 0, 0, 0.36);
		transition:
			box-shadow 0.34s cubic-bezier(0.22, 1, 0.36, 1),
			border-color 0.24s ease;
	}

	.pc-goods-item.is-active .goods-media-frame {
		box-shadow: 0 18px 34px rgba(0, 0, 0, 0.56);
		border-color: color-mix(in srgb, var(--white) 24%, transparent);
	}

	.goods-img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		pointer-events: none;
		transform: scale(1);
		transition: transform 0.48s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.pc-goods-item.is-active .goods-img {
		transform: scale(1.05);
	}

	.goods-img-fallback {
		width: 100%;
		height: 100%;
		background: linear-gradient(155deg, var(--surface-2), var(--surface-dim));
	}

	/* 이미지 하단 모서리 안쪽에서 위 방향으로 일렁이는 어두운 회색 그림자형 유체 물결 */
	.goods-bottom-wave {
		position: absolute;
		left: 0;
		right: 0;
		bottom: -2px;
		z-index: 2;
		opacity: 0.78;
		pointer-events: none;
	}

	/* 4:5 미디어 프레임 하단 중앙(물결 일렁이는 영역)에 배치되는 빠른 장바구니 버튼 슬롯 */
	.goods-quick-cart-slot {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		aspect-ratio: 4 / 5;
		z-index: 4;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding-bottom: 12px;
		box-sizing: border-box;
		pointer-events: none;
	}

	.pc-goods-item.is-sold-out .goods-img {
		opacity: 0.56;
	}

	.goods-soldout-overlay {
		position: absolute;
		inset: 0;
		z-index: 3;
		display: grid;
		place-items: center;
		pointer-events: none;
	}

	.goods-soldout-badge {
		padding: 0.32rem 0.88rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--bg) 76%, transparent);
		border: 1px solid color-mix(in srgb, var(--white) 24%, transparent);
		color: var(--white);
		font-size: 0.8rem;
		font-weight: var(--fw-bold);
		letter-spacing: 0.04em;
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
	}

	.goods-info {
		margin-top: 0.72rem;
		padding: 0 0.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.22rem;
		min-width: 0;
	}

	.goods-artist {
		font-size: 0.76rem;
		font-weight: var(--fw-medium);
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.goods-name {
		margin: 0;
		font-size: 0.94rem;
		font-weight: var(--fw-semibold);
		line-height: 1.35;
		letter-spacing: -0.02em;
		color: var(--fg);
		display: -webkit-box;
		line-clamp: 2;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		word-break: keep-all;
		transition: color 0.18s ease;
	}

	.pc-goods-item.is-active .goods-name {
		color: var(--white);
	}

	.goods-meta-row {
		margin-top: 0.16rem;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.42rem;
	}

	.goods-category-pill {
		padding: 0.12rem 0.46rem;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--white-3);
		font-size: 0.72rem;
		font-weight: var(--fw-medium);
		line-height: 1.25;
		letter-spacing: 0.01em;
	}

	.goods-price {
		font-size: 0.9rem;
		font-weight: var(--fw-bold);
		letter-spacing: -0.01em;
		color: var(--white-2);
	}

	.pc-goods-item.is-sold-out .goods-meta-row {
		opacity: 0.55;
	}

	.pc-goods-item.is-sold-out .goods-category-pill,
	.pc-goods-item.is-sold-out .goods-price {
		color: var(--muted);
		text-decoration: line-through;
	}

	@media (prefers-reduced-motion: reduce) {
		.goods-media-frame,
		.goods-img,
		.goods-name {
			transition: none;
		}
	}
</style>
