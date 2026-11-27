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
		getCachedImageAverageColor,
		markImageCorsBlocked,
		resolveImageCrossOrigin
	} from '#lib/common/design/fluid/imageColor';
	import FdButton from '#lib/common/design/fluid/FdButton.svelte';
	import { FluidSetting } from '#lib/common/type/fluid';
	import CheckIcon from '#lib/common/design/icon/CheckIcon.svelte';
	import ShoppingBagIcon from '#lib/common/design/icon/ShoppingBagIcon.svelte';
	import type { GoodsSelectPayload } from '../logic/goodsCategory.svelte';

	interface Props {
		goods: CatalogGoods;
		interactive?: boolean;
		cartLoading?: boolean;
		cartCompleted?: boolean;
		onSelect?: (payload: GoodsSelectPayload) => void;
		onQuickAddToCart?: (goods: CatalogGoods) => void;
	}

	let {
		goods,
		interactive = true,
		cartLoading = false,
		cartCompleted = false,
		onSelect,
		onQuickAddToCart
	}: Props = $props();

	let pressed = $state(false);
	let useCorsFallback = $state(false);
	let imgEl = $state<HTMLImageElement | null>(null);
	let cardTint = $state('');

	const imageUrl = $derived(resolveGoodsImageUrl(goods));
	const imgCrossOrigin = $derived<'anonymous' | undefined>(
		!imageUrl || useCorsFallback ? undefined : resolveImageCrossOrigin(imageUrl)
	);
	const imgRenderKey = $derived(`${imageUrl}|${imgCrossOrigin ?? 'nocors'}`);
	const priceText = $derived(formatGoodsPrice(goods.price));
	const isSoldOut = $derived(goods.badge === '품절');

	const cartBtnSetting = $derived.by(() => {
		if (cartLoading) {
			return new FluidSetting({
				radius: 999,
				inset: 6,
				color: 'var(--white-3)',
				hoverColor: 'var(--white-3)',
				pressColor: 'var(--white-3)',
				textColor: 'var(--bg)',
				waveColor: 'var(--muted)',
				hoverWaveColor: 'var(--muted)',
				borderWidth: 0,
				layers: 2,
				layerGap: 3.4,
				waveAmp: 2.2,
				waveLength: 52,
				spin: 3.6,
				bulge: 0,
				reach: 0,
				clickReactive: false,
				pauseWhenIdle: false
			});
		}

		return new FluidSetting({
			radius: 10,
			inset: 6,
			color: isSoldOut ? 'var(--surface-3)' : cartCompleted ? 'var(--white-2)' : 'var(--white)',
			hoverColor: isSoldOut ? 'var(--surface-3)' : 'var(--white)',
			pressColor: 'var(--white-3)',
			textColor: isSoldOut ? 'var(--muted)' : 'var(--bg)',
			waveColor: 'var(--muted)',
			borderWidth: 0,
			layers: 0,
			layerGap: 0,
			waveAmp: 0,
			bulge: 0,
			reach: 0,
			clickReactive: !isSoldOut && !cartCompleted,
			pauseWhenIdle: true
		});
	});

	function syncCardTint() {
		if (!imageUrl || useCorsFallback) {
			cardTint = '';
			return;
		}
		const cached = getCachedImageAverageColor(imageUrl, DETAIL_GLOW_COLOR_OPTIONS);
		if (cached) {
			cardTint = cached;
			return;
		}
		if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
			cardTint = extractImageAverageColor(imgEl, imageUrl, DETAIL_GLOW_COLOR_OPTIONS) ?? '';
		}
	}

	$effect(() => {
		void imageUrl;
		useCorsFallback = false;
		cardTint = imageUrl
			? (getCachedImageAverageColor(imageUrl, DETAIL_GLOW_COLOR_OPTIONS) ?? '')
			: '';
	});

	function handleImgLoad() {
		syncCardTint();
	}

	function handleImgError() {
		if (imgCrossOrigin === 'anonymous' && imageUrl) {
			markImageCorsBlocked(imageUrl);
			useCorsFallback = true;
			cardTint = '';
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

	function handleQuickCart(e: MouseEvent) {
		e.stopPropagation();
		if (isSoldOut || cartLoading || cartCompleted) return;
		onQuickAddToCart?.(goods);
	}
</script>

<!-- 모바일 전용 굿즈 카드 아이템 (라운드 통합 카드 · 이미지 하단 자연스러운 그라디언트 전환 · 정보 · 풀폭 담기 버튼, 순수 렌더링) -->
<article
	use:scrollReveal
	class="mb-goods-item mb-scroll-reveal"
	class:is-pressed={interactive && pressed}
	class:is-sold-out={isSoldOut}
	style:--card-tint={cardTint || undefined}
>
	<div class="goods-card">
		<button
			type="button"
			class="goods-card-main"
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
							onload={handleImgLoad}
							onerror={handleImgError}
						/>
					{/key}
				{:else}
					<div class="goods-img-fallback" aria-hidden="true"></div>
				{/if}

				<div class="goods-media-fade" aria-hidden="true"></div>

				{#if isSoldOut}
					<span class="goods-soldout-pill">품절</span>
				{/if}
			</div>

			<div class="goods-info">
				<h3 class="goods-name">{goods.name}</h3>

				{#if priceText}
					<p class="goods-price">{priceText}</p>
				{/if}

				{#if goods.artistName || goods.category}
					<div class="goods-tag-row">
						{#if goods.artistName}
							<span class="goods-tag">{goods.artistName}</span>
						{/if}
						{#if goods.category}
							<span class="goods-tag">{goods.category}</span>
						{/if}
					</div>
				{/if}
			</div>
		</button>

		<div class="goods-action-wrap">
			<div
				class="goods-cart-slot"
				class:is-loading={cartLoading}
				class:is-completed={cartCompleted}
				class:is-soldout={isSoldOut}
			>
				<FdButton
					class="mb-goods-cart-fd-btn"
					setting={cartBtnSetting}
					fullWidth
					disabled={isSoldOut}
					aria-busy={cartLoading || undefined}
					aria-label={isSoldOut
						? '품절'
						: cartLoading
							? '장바구니에 담는 중'
							: cartCompleted
								? `${goods.name} 장바구니에 담김`
								: `${goods.name} 장바구니에 담기`}
					onclick={handleQuickCart}
				>
					<span class="cart-btn-content" class:is-hidden={cartLoading}>
						{#if isSoldOut}
							<span>품절</span>
						{:else if cartCompleted}
							<CheckIcon size={15} strokeWidth={2.4} animating={true} />
							<span>담김</span>
						{:else}
							<ShoppingBagIcon size={15} />
							<span>담기</span>
						{/if}
					</span>
				</FdButton>
			</div>
		</div>
	</div>
</article>

<style>
	.mb-goods-item {
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
		--card-bg: color-mix(in srgb, var(--card-tint, var(--surface-2)) 22%, var(--surface));
	}

	.goods-card {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		border-radius: 18px;
		overflow: hidden;
		background: var(--card-bg);
		border: var(--thin-border);
		transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.mb-goods-item.is-pressed .goods-card {
		transform: scale(0.975);
	}

	.goods-card-main {
		flex: 1;
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
		aspect-ratio: 1 / 1;
		overflow: hidden;
		background: var(--surface);
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

	/* 이미지 하단이 카드 배경색과 경계 없이 자연스럽게 이어지도록 페이드 */
	.goods-media-fade {
		position: absolute;
		left: 0;
		right: 0;
		bottom: -1px;
		height: 36%;
		background: linear-gradient(
			to bottom,
			transparent 0%,
			color-mix(in srgb, var(--card-bg) 52%, transparent) 55%,
			var(--card-bg) 100%
		);
		pointer-events: none;
	}

	.mb-goods-item.is-sold-out .goods-img {
		opacity: 0.52;
	}

	.goods-soldout-pill {
		position: absolute;
		top: 0.55rem;
		left: 0.55rem;
		z-index: 2;
		padding: 0.2rem 0.54rem;
		border-radius: 7px;
		background: color-mix(in srgb, var(--bg) 78%, transparent);
		color: var(--white-2);
		font-size: 0.7rem;
		font-weight: var(--fw-bold);
		line-height: 1.25;
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
		pointer-events: none;
	}

	.goods-info {
		flex: 1;
		padding: 0.25rem 0.72rem 0.55rem;
		display: flex;
		flex-direction: column;
		gap: 0.26rem;
		min-width: 0;
	}

	.goods-name {
		margin: 0;
		font-size: 0.86rem;
		font-weight: var(--fw-semibold);
		line-height: 1.34;
		letter-spacing: -0.02em;
		color: var(--white);
		display: -webkit-box;
		line-clamp: 2;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		word-break: keep-all;
	}

	.goods-price {
		margin: 0;
		font-size: 1rem;
		font-weight: var(--fw-extrabold);
		letter-spacing: -0.02em;
		color: var(--white);
		font-variant-numeric: tabular-nums;
	}

	.goods-tag-row {
		margin-top: 0.2rem;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.28rem;
	}

	.goods-tag {
		max-width: 100%;
		padding: 0.16rem 0.42rem;
		border-radius: 6px;
		background: color-mix(in srgb, var(--bg) 40%, transparent);
		color: var(--white-3);
		font-size: 0.68rem;
		font-weight: var(--fw-medium);
		line-height: 1.25;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.mb-goods-item.is-sold-out .goods-price {
		color: var(--muted);
		text-decoration: line-through;
	}

	.goods-action-wrap {
		padding: 0 0.72rem 0.72rem;
		display: flex;
		justify-content: center;
	}

	.goods-cart-slot {
		width: 100%;
		min-width: 0;
		transition:
			width 0.32s cubic-bezier(0.22, 1.15, 0.36, 1),
			transform 0.32s cubic-bezier(0.22, 1.15, 0.36, 1);
	}

	/* 로딩 중에는 원형에 가까운 부드러운 캡슐(38×36)로 중앙 수렴 */
	.goods-cart-slot.is-loading {
		width: 38px;
		transform: scale(0.82);
	}

	.goods-cart-slot :global(.fd-wrap) {
		margin: -6px;
		width: calc(100% + 12px);
		min-width: 0;
	}

	.goods-cart-slot :global(.fd-btn.mb-goods-cart-fd-btn) {
		position: relative;
		width: 100%;
		min-width: 0;
		height: 36px;
		padding: 0;
		font-size: 0.82rem;
		font-weight: var(--fw-bold);
		letter-spacing: -0.01em;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.goods-cart-slot.is-loading :global(.fd-btn.mb-goods-cart-fd-btn),
	.goods-cart-slot.is-completed :global(.fd-btn.mb-goods-cart-fd-btn),
	.goods-cart-slot.is-soldout :global(.fd-btn.mb-goods-cart-fd-btn) {
		cursor: default;
	}

	.cart-btn-content {
		position: absolute;
		inset: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.34rem;
		white-space: nowrap;
		transition: opacity 0.14s ease;
	}

	.cart-btn-content.is-hidden {
		opacity: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.goods-card,
		.goods-cart-slot,
		.cart-btn-content {
			transition: none;
		}
	}
</style>
