<script lang="ts">
	import type { Snippet } from 'svelte';
	import FdButton from '#lib/components/ui/FdButton.svelte';
	import { FluidSetting } from '#lib/fluid/setting';

	interface Props {
		ariaLabel: string;
		isLoading: boolean;
		isEmpty: boolean;
		errorMessage: string | null;
		errorTitle: string;
		emptyTitle: string;
		emptyDesc: string;
		loadMoreErrorMessage?: string | null;
		isLoadingMore?: boolean;
		hasNext?: boolean;
		skeletonCount?: number;
		minCardWidth?: number;
		mobileMinCardWidth?: number;
		skeletonAspect?: string;
		skeletonRadius?: string;
		onRetry?: () => void;
		onLoadMore?: () => void;
		children?: Snippet;
		class?: string;
	}

	let {
		ariaLabel,
		isLoading,
		isEmpty,
		errorMessage,
		errorTitle,
		emptyTitle,
		emptyDesc,
		loadMoreErrorMessage = null,
		isLoadingMore = false,
		hasNext = false,
		skeletonCount = 12,
		minCardWidth = 196,
		mobileMinCardWidth = 148,
		skeletonAspect = '1 / 1',
		skeletonRadius = '22px',
		onRetry,
		onLoadMore,
		children,
		class: klass = ''
	}: Props = $props();

	let sentinelEl = $state<HTMLDivElement | null>(null);

	const retryBtnSetting = new FluidSetting({
		radius: 999,
		layers: 1,
		layerGap: 3,
		waveAmp: 2.2,
		waveLength: 56,
		spin: 1.2,
		color: 'var(--surface-3)',
		hoverColor: 'var(--surface-4)',
		pressColor: 'var(--surface-2)',
		waveColor: 'var(--line-wave)',
		textColor: 'var(--fg)'
	});

	$effect(() => {
		if (!sentinelEl || !hasNext || isLoadingMore || isLoading || !onLoadMore) return;
		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (entry?.isIntersecting && hasNext && !isLoadingMore && !isLoading) {
					onLoadMore();
				}
			},
			{ rootMargin: '240px' }
		);
		observer.observe(sentinelEl);
		return () => {
			observer.disconnect();
		};
	});
</script>

<section
	class="catalog-section {klass}"
	aria-label={ariaLabel}
	style:--catalog-card-min="{minCardWidth}px"
	style:--catalog-card-min-mobile="{mobileMinCardWidth}px"
	style:--catalog-skeleton-aspect={skeletonAspect}
	style:--catalog-skeleton-radius={skeletonRadius}
>
	{#if isLoading && isEmpty}
		<div class="catalog-grid" aria-busy="true" aria-live="polite">
			{#each Array(skeletonCount) as _, idx (idx)}
				<div class="catalog-skeleton">
					<div class="skeleton-thumb"></div>
					<div class="skeleton-line"></div>
					<div class="skeleton-line is-short"></div>
				</div>
			{/each}
		</div>
	{:else if errorMessage && isEmpty}
		<div class="catalog-state-box" role="alert">
			<div class="state-icon is-error" aria-hidden="true">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
					<circle cx="12" cy="12" r="10" />
					<line x1="12" y1="8" x2="12" y2="12" />
					<line x1="12" y1="16" x2="12.01" y2="16" />
				</svg>
			</div>
			<h3 class="state-title">{errorTitle}</h3>
			<p class="state-desc">{errorMessage}</p>
			{#if onRetry}
				<div class="state-action">
					<FdButton setting={retryBtnSetting} onclick={onRetry}>다시 시도</FdButton>
				</div>
			{/if}
		</div>
	{:else if isEmpty}
		<div class="catalog-state-box">
			<div class="state-icon is-empty" aria-hidden="true">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
					<circle cx="12" cy="12" r="9" />
					<path d="M9 10h.01M15 10h.01M9.5 15.5a3.5 3.5 0 0 0 5 0" />
				</svg>
			</div>
			<h3 class="state-title">{emptyTitle}</h3>
			<p class="state-desc">{emptyDesc}</p>
			{#if onRetry}
				<div class="state-action">
					<FdButton setting={retryBtnSetting} onclick={onRetry}>새로고침</FdButton>
				</div>
			{/if}
		</div>
	{:else}
		<div class="catalog-grid">
			{@render children?.()}
		</div>

		{#if loadMoreErrorMessage}
			<div class="load-more-error" role="alert">
				<span>{loadMoreErrorMessage}</span>
				{#if onLoadMore}
					<button type="button" class="inline-retry-btn" onclick={onLoadMore}>다시 시도</button>
				{/if}
			</div>
		{/if}

		{#if isLoadingMore}
			<div class="catalog-loading-more" role="status" aria-label="추가 목록을 불러오는 중입니다">
				<span class="loading-dot"></span>
				<span class="loading-dot"></span>
				<span class="loading-dot"></span>
			</div>
		{/if}

		{#if hasNext}
			<div bind:this={sentinelEl} class="catalog-sentinel" aria-hidden="true"></div>
		{/if}
	{/if}
</section>

<style>
	.catalog-section {
		width: 100%;
		box-sizing: border-box;
	}

	.catalog-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(var(--catalog-card-min, 196px), 1fr));
		column-gap: 1.5rem;
		row-gap: 2.5rem;
		align-items: start;
		width: 100%;
	}

	.catalog-skeleton {
		display: flex;
		flex-direction: column;
		width: 100%;
		padding: 14px 14px 0;
		box-sizing: border-box;
	}

	.skeleton-thumb {
		width: 100%;
		aspect-ratio: var(--catalog-skeleton-aspect, 1 / 1);
		border-radius: var(--catalog-skeleton-radius, 22px);
		background: var(--surface);
		animation: catalog-pulse 1.6s ease-in-out infinite;
	}

	.skeleton-line {
		width: 72%;
		height: 0.95rem;
		margin-top: 0.85rem;
		border-radius: 999px;
		background: var(--surface);
		animation: catalog-pulse 1.6s ease-in-out infinite;
	}

	.skeleton-line.is-short {
		width: 48%;
		height: 0.8rem;
		margin-top: 0.45rem;
	}

	@keyframes catalog-pulse {
		0%,
		100% {
			opacity: 0.45;
		}
		50% {
			opacity: 0.9;
		}
	}

	.catalog-state-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 5rem 1.5rem;
		text-align: center;
		background: var(--surface-dim);
		border: var(--thin-border);
		border-radius: 1.25rem;
		max-width: 580px;
		margin: 2.5rem auto;
		box-sizing: border-box;
	}

	.state-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3.5rem;
		height: 3.5rem;
		border-radius: 999px;
		margin-bottom: 1.25rem;
	}

	.state-icon svg {
		width: 2rem;
		height: 2rem;
	}

	.state-icon.is-error {
		background: var(--toast-error-bg);
		color: var(--toast-error-fg);
	}

	.state-icon.is-empty {
		background: var(--surface);
		color: var(--muted);
	}

	.state-title {
		margin: 0;
		font-size: 1.15rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--fg);
	}

	.state-desc {
		margin: 0.5rem 0 1.5rem;
		font-size: 0.92rem;
		line-height: 1.5;
		color: var(--muted);
		word-break: keep-all;
	}

	.state-action {
		display: flex;
		justify-content: center;
	}

	.load-more-error {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		margin-top: 2rem;
		font-size: 0.88rem;
		color: var(--toast-error-fg);
	}

	.inline-retry-btn {
		appearance: none;
		border: none;
		background: transparent;
		color: var(--toast-error-wave);
		font-weight: 600;
		text-decoration: underline;
		cursor: pointer;
		padding: 0;
		font-size: 0.88rem;
	}

	.catalog-loading-more {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 3rem 0 1.5rem;
	}

	.loading-dot {
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: var(--muted);
		animation: catalog-dot-pulse 1.2s ease-in-out infinite;
	}

	.loading-dot:nth-child(2) {
		animation-delay: 0.2s;
	}

	.loading-dot:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes catalog-dot-pulse {
		0%,
		100% {
			transform: scale(0.8);
			opacity: 0.3;
		}
		50% {
			transform: scale(1.3);
			opacity: 1;
		}
	}

	.catalog-sentinel {
		width: 100%;
		height: 1px;
		pointer-events: none;
		visibility: hidden;
	}

	@media (max-width: 640px) {
		.catalog-grid {
			grid-template-columns: repeat(auto-fill, minmax(var(--catalog-card-min-mobile, 148px), 1fr));
			column-gap: 1.125rem;
			row-gap: 2rem;
		}

		.catalog-state-box {
			padding: 3.5rem 1.25rem;
			margin: 1.5rem auto;
		}
	}
</style>
