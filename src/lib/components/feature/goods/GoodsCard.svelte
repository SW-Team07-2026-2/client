<script module lang="ts">
	export type { CatalogGoods } from '#lib/config/goods';
</script>

<script lang="ts">
	import FdButton from '#lib/components/ui/FdButton.svelte';
	import type { FluidSetting } from '#lib/fluid/setting';
	import { buildCatalogActionSetting, formatKrwPrice } from '#lib/config/catalogFeed';
	import { resolveGoodsImageUrl, type CatalogGoods } from '#lib/config/goods';
	import CatalogCardFrame from '../shared/CatalogCardFrame.svelte';

	interface Props {
		goods: CatalogGoods;
		wishlisted?: boolean;
		setting?: FluidSetting | Partial<FluidSetting>;
		onWishlistToggle?: (goods: CatalogGoods, nextWishlisted: boolean) => void;
		onclick?: (goods: CatalogGoods) => void;
		class?: string;
	}

	let {
		goods,
		wishlisted = $bindable(false),
		setting,
		onWishlistToggle,
		onclick,
		class: klass = ''
	}: Props = $props();

	let extractedWaveColor = $state('var(--muted-wave)');

	const resolvedImageSrc = $derived(resolveGoodsImageUrl(goods));
	const actionBtnSetting = $derived(buildCatalogActionSetting(wishlisted, extractedWaveColor));
	const priceText = $derived(formatKrwPrice(goods.price));

	function handleWishlistClick(e: MouseEvent) {
		e.stopPropagation();
		const next = !wishlisted;
		if (onWishlistToggle) {
			onWishlistToggle(goods, next);
		} else {
			wishlisted = next;
		}
	}
</script>

<CatalogCardFrame
	class={klass}
	src={resolvedImageSrc}
	alt={goods.name}
	ariaLabel={`${goods.name} - ${goods.artistName} 굿즈`}
	aspectRatio="1 / 1"
	radius={20}
	hoverRadius={28}
	{setting}
	bind:extractedWaveColor
	onSelect={() => onclick?.(goods)}
>
	{#snippet badge()}
		{#if goods.badge}
			<span
				class="goods-status-badge"
				class:is-urgent={goods.badge === '품절임박'}
				class:is-soldout={goods.badge === '품절'}
			>
				{goods.badge}
			</span>
		{/if}
	{/snippet}

	{#snippet footer()}
		<span class="goods-name">{goods.name}</span>
		<span class="goods-artist">
			{goods.artistName}{goods.category ? ` · ${goods.category}` : ''}
		</span>
		{#if priceText}
			<span class="goods-price">{priceText}</span>
		{/if}
	{/snippet}

	{#snippet action({ isActive })}
		<FdButton
			class="catalog-hover-btn"
			setting={actionBtnSetting}
			tabindex={isActive ? 0 : -1}
			onclick={handleWishlistClick}
		>
			{wishlisted ? '찜 해제' : '찜하기'}
		</FdButton>
	{/snippet}
</CatalogCardFrame>

<style>
	.goods-status-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.22rem 0.58rem;
		border-radius: 999px;
		background: var(--glass-bg);
		backdrop-filter: var(--glass-filter);
		-webkit-backdrop-filter: var(--glass-filter);
		border: var(--thin-border);
		color: var(--white);
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	:global(.route-stage.is-sliding) .goods-status-badge {
		backdrop-filter: none;
		-webkit-backdrop-filter: none;
	}

	:global(.route-stage.is-sliding) .goods-status-badge:not(.is-urgent):not(.is-soldout) {
		background: var(--surface-dim);
	}

	.goods-status-badge.is-urgent {
		background: var(--toast-error-bg);
		color: var(--toast-error-fg);
		border-color: transparent;
	}

	.goods-status-badge.is-soldout {
		background: var(--surface-3);
		color: var(--muted);
	}

	.goods-name {
		display: block;
		width: 100%;
		font-size: 0.98rem;
		font-weight: 600;
		letter-spacing: -0.02em;
		line-height: 1.35;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.goods-artist {
		display: block;
		width: 100%;
		font-size: 0.84rem;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.goods-price {
		display: block;
		width: 100%;
		font-size: 0.84rem;
		font-weight: 600;
		color: var(--fg);
	}

	:global(.catalog-hover-btn) {
		padding: 0.32rem 0.9rem !important;
		font-size: 0.78rem !important;
		font-weight: 700 !important;
		letter-spacing: -0.01em;
		white-space: nowrap;
	}
</style>
