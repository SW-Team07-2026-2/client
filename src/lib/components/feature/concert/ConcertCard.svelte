<script module lang="ts">
	export type { CatalogConcert } from '#lib/config/concerts';
</script>

<script lang="ts">
	import FdButton from '#lib/components/ui/FdButton.svelte';
	import type { FluidSetting } from '#lib/fluid/setting';
	import { buildCatalogActionSetting, formatKrwPrice } from '#lib/config/catalogFeed';
	import { resolveConcertPosterUrl, type CatalogConcert } from '#lib/config/concerts';
	import CatalogCardFrame from '../shared/CatalogCardFrame.svelte';

	interface Props {
		concert: CatalogConcert;
		bookmarked?: boolean;
		setting?: FluidSetting | Partial<FluidSetting>;
		onBookmarkToggle?: (concert: CatalogConcert, nextBookmarked: boolean) => void;
		onclick?: (concert: CatalogConcert) => void;
		class?: string;
	}

	let {
		concert,
		bookmarked = $bindable(false),
		setting,
		onBookmarkToggle,
		onclick,
		class: klass = ''
	}: Props = $props();

	let extractedWaveColor = $state('var(--muted-wave)');

	const resolvedPosterSrc = $derived(resolveConcertPosterUrl(concert));
	const actionBtnSetting = $derived(buildCatalogActionSetting(bookmarked, extractedWaveColor));
	const priceText = $derived(formatKrwPrice(concert.price));

	function handleBookmarkClick(e: MouseEvent) {
		e.stopPropagation();
		const next = !bookmarked;
		if (onBookmarkToggle) {
			onBookmarkToggle(concert, next);
		} else {
			bookmarked = next;
		}
	}
</script>

<CatalogCardFrame
	class={klass}
	src={resolvedPosterSrc}
	alt={concert.title}
	ariaLabel={`${concert.title} - ${concert.artistName} 공연`}
	aspectRatio="3 / 4"
	radius={20}
	hoverRadius={28}
	{setting}
	bind:extractedWaveColor
	onSelect={() => onclick?.(concert)}
>
	{#snippet badge()}
		{#if concert.status}
			<span
				class="concert-status-badge"
				class:is-urgent={concert.status === '매진임박'}
				class:is-soldout={concert.status === '매진' || concert.status === '판매종료'}
			>
				{concert.status}
			</span>
		{/if}
	{/snippet}

	{#snippet footer()}
		<span class="concert-title">{concert.title}</span>
		<span class="concert-artist">{concert.artistName} · {concert.venue}</span>
		<span class="concert-meta">
			{concert.dateText}{priceText ? ` · ${priceText}` : ''}
		</span>
	{/snippet}

	{#snippet action({ isActive })}
		<FdButton
			class="catalog-hover-btn"
			setting={actionBtnSetting}
			tabindex={isActive ? 0 : -1}
			onclick={handleBookmarkClick}
		>
			{bookmarked ? '관심 공연 해제' : '관심 공연'}
		</FdButton>
	{/snippet}
</CatalogCardFrame>

<style>
	.concert-status-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.24rem 0.62rem;
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

	/* 슬라이드 전환 중에는 카드 배지의 실시간 backdrop-filter 합성을 잠시 멈춰 고주사율(60/120fps) 유지 */
	:global(.route-stage.is-sliding) .concert-status-badge {
		backdrop-filter: none;
		-webkit-backdrop-filter: none;
	}

	:global(.route-stage.is-sliding) .concert-status-badge:not(.is-urgent):not(.is-soldout) {
		background: var(--surface-dim);
	}

	.concert-status-badge.is-urgent {
		background: var(--toast-error-bg);
		color: var(--toast-error-fg);
		border-color: transparent;
	}

	.concert-status-badge.is-soldout {
		background: var(--surface-3);
		color: var(--muted);
	}

	.concert-title {
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

	.concert-artist {
		display: block;
		width: 100%;
		font-size: 0.84rem;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.concert-meta {
		display: block;
		width: 100%;
		font-size: 0.78rem;
		color: var(--muted);
		opacity: 0.85;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	:global(.catalog-hover-btn) {
		padding: 0.32rem 0.9rem !important;
		font-size: 0.78rem !important;
		font-weight: 700 !important;
		letter-spacing: -0.01em;
		white-space: nowrap;
	}
</style>
