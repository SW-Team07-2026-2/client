<script module lang="ts">
	export type { CatalogAlbum } from '#lib/config/albums';
</script>

<script lang="ts">
	import FdButton from '#lib/components/ui/FdButton.svelte';
	import type { FluidSetting } from '#lib/fluid/setting';
	import { buildCatalogActionSetting, formatKrwPrice } from '#lib/config/catalogFeed';
	import { resolveAlbumCoverUrl, type CatalogAlbum } from '#lib/config/albums';
	import CatalogCardFrame from '../shared/CatalogCardFrame.svelte';

	interface Props {
		album: CatalogAlbum;
		wishlisted?: boolean;
		setting?: FluidSetting | Partial<FluidSetting>;
		onWishlistToggle?: (album: CatalogAlbum, nextWishlisted: boolean) => void;
		onclick?: (album: CatalogAlbum) => void;
		class?: string;
	}

	let {
		album,
		wishlisted = $bindable(false),
		setting,
		onWishlistToggle,
		onclick,
		class: klass = ''
	}: Props = $props();

	let extractedWaveColor = $state('var(--muted-wave)');

	const resolvedCoverSrc = $derived(resolveAlbumCoverUrl(album));
	const actionBtnSetting = $derived(buildCatalogActionSetting(wishlisted, extractedWaveColor));
	const priceText = $derived(formatKrwPrice(album.price));

	function handleWishlistClick(e: MouseEvent) {
		e.stopPropagation();
		const next = !wishlisted;
		if (onWishlistToggle) {
			onWishlistToggle(album, next);
		} else {
			wishlisted = next;
		}
	}
</script>

<CatalogCardFrame
	class={klass}
	src={resolvedCoverSrc}
	alt={album.title}
	ariaLabel={`${album.title} - ${album.artistName} 음반`}
	aspectRatio="1 / 1"
	radius={18}
	hoverRadius={26}
	{setting}
	bind:extractedWaveColor
	onSelect={() => onclick?.(album)}
>
	{#snippet badge()}
		{#if album.format}
			<span class="album-format-badge" class:is-soldout={album.stockStatus === '품절'}>
				{album.stockStatus === '품절' ? `${album.format} · 품절` : album.format}
			</span>
		{/if}
	{/snippet}

	{#snippet footer()}
		<span class="album-title">{album.title}</span>
		<span class="album-artist">
			{album.artistName}{album.releaseYear ? ` · ${album.releaseYear}` : ''}
		</span>
		{#if priceText}
			<span class="album-price">{priceText}</span>
		{/if}
	{/snippet}

	{#snippet action({ isActive })}
		<FdButton
			class="catalog-hover-btn"
			setting={actionBtnSetting}
			tabindex={isActive ? 0 : -1}
			onclick={handleWishlistClick}
		>
			{wishlisted ? '위시리스트 취소' : '위시리스트 담기'}
		</FdButton>
	{/snippet}
</CatalogCardFrame>

<style>
	.album-format-badge {
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

	.album-format-badge.is-soldout {
		background: var(--surface-3);
		color: var(--muted);
	}

	.album-title {
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

	.album-artist {
		display: block;
		width: 100%;
		font-size: 0.84rem;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.album-price {
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
