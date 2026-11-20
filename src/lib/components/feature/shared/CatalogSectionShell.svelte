<script lang="ts">
	import { onDestroy, untrack, type Snippet } from 'svelte';
	import { CATALOG_TRANSITION_TIMING } from '#lib/config/catalogFeed';
	import { prefersReducedMotion } from '#lib/fluid/spring';

	type ViewKind = 'skeleton' | 'error' | 'empty' | 'content';

	interface Props {
		ariaLabel: string;
		isLoading: boolean;
		isEmpty: boolean;
		errorMessage: string | null;
		errorTitle: string;
		emptyTitle: string;
		emptyDesc?: string;
		loadMoreErrorMessage?: string | null;
		isLoadingMore?: boolean;
		hasNext?: boolean;
		skeletonCount?: number;
		minCardWidth?: number;
		mobileMinCardWidth?: number;
		columnGap?: string;
		rowGap?: string;
		mobileColumnGap?: string;
		mobileRowGap?: string;
		skeletonAspect?: string;
		skeletonRadius?: string;
		onRetry?: () => void;
		onLoadMore?: () => void;
		active?: boolean;
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
		emptyDesc: _emptyDesc = '',
		loadMoreErrorMessage = null,
		isLoadingMore = false,
		hasNext = false,
		skeletonCount = 12,
		minCardWidth = 196,
		mobileMinCardWidth = 148,
		columnGap = '1.5rem',
		rowGap = '2.5rem',
		mobileColumnGap = '1.125rem',
		mobileRowGap = '2rem',
		skeletonAspect = '1 / 1',
		skeletonRadius = '22px',
		onRetry: _onRetry,
		onLoadMore,
		active = true,
		children,
		class: klass = ''
	}: Props = $props();

	let sentinelEl = $state<HTMLDivElement | null>(null);

	const targetKind = $derived<ViewKind>(
		isLoading
			? 'skeleton'
			: errorMessage && isEmpty
				? 'error'
				: isEmpty
					? 'empty'
					: 'content'
	);

	let renderedKind = $state<ViewKind>(untrack(() => targetKind));
	let motionState = $state<'idle' | 'entering' | 'exiting'>('idle');
	let transitionTimer: ReturnType<typeof setTimeout> | undefined;
	let settleTimer: ReturnType<typeof setTimeout> | undefined;

	function clearPhaseTimers() {
		clearTimeout(transitionTimer);
		clearTimeout(settleTimer);
	}

	function resolveExitMs(kind: ViewKind): number {
		return kind === 'skeleton'
			? CATALOG_TRANSITION_TIMING.skeletonExitMs
			: CATALOG_TRANSITION_TIMING.contentExitMs;
	}

	function resolveEnterMs(kind: ViewKind): number {
		return kind === 'skeleton'
			? CATALOG_TRANSITION_TIMING.skeletonEnterMs
			: CATALOG_TRANSITION_TIMING.contentEnterMs;
	}

	$effect(() => {
		const nextKind = targetKind;
		const isActive = active;

		untrack(() => {
			if (!isActive || prefersReducedMotion()) {
				clearPhaseTimers();
				renderedKind = nextKind;
				motionState = 'idle';
				return;
			}

			if (nextKind === renderedKind) {
				if (motionState === 'exiting') {
					clearPhaseTimers();
					motionState = 'entering';
					settleTimer = setTimeout(() => {
						motionState = 'idle';
					}, resolveEnterMs(nextKind));
				}
				return;
			}

			clearPhaseTimers();
			const exitMs = resolveExitMs(renderedKind);
			motionState = 'exiting';

			transitionTimer = setTimeout(() => {
				renderedKind = targetKind;
				motionState = 'entering';
				settleTimer = setTimeout(() => {
					motionState = 'idle';
				}, resolveEnterMs(targetKind));
			}, exitMs);
		});
	});

	onDestroy(() => {
		clearPhaseTimers();
	});

	$effect(() => {
		if (!active || renderedKind !== 'content' || !sentinelEl || !hasNext || isLoadingMore || isLoading || !onLoadMore) return;
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
	style:--catalog-col-gap={columnGap}
	style:--catalog-row-gap={rowGap}
	style:--catalog-col-gap-mobile={mobileColumnGap}
	style:--catalog-row-gap-mobile={mobileRowGap}
	style:--catalog-skeleton-aspect={skeletonAspect}
	style:--catalog-skeleton-radius={skeletonRadius}
	style:--catalog-exit-ms="{CATALOG_TRANSITION_TIMING.contentExitMs}ms"
	style:--catalog-skeleton-enter-ms="{CATALOG_TRANSITION_TIMING.skeletonEnterMs}ms"
	style:--catalog-skeleton-exit-ms="{CATALOG_TRANSITION_TIMING.skeletonExitMs}ms"
	style:--catalog-enter-ms="{CATALOG_TRANSITION_TIMING.contentEnterMs}ms"
>
	<div
		class="catalog-stage-panel"
		class:is-skeleton={renderedKind === 'skeleton'}
		class:is-entering={motionState === 'entering'}
		class:is-exiting={motionState === 'exiting'}
	>
		{#if renderedKind === 'skeleton'}
			<div class="catalog-grid" aria-busy="true" aria-live="polite">
				{#each Array(skeletonCount) as _, idx (idx)}
					<div class="catalog-skeleton">
						<div class="skeleton-thumb"></div>
						<div class="skeleton-line"></div>
						<div class="skeleton-line is-short"></div>
					</div>
				{/each}
			</div>
		{:else if renderedKind === 'error'}
			<div class="catalog-state-message" role="alert">
				<p class="state-main-text is-error">{errorTitle}</p>
			</div>
		{:else if renderedKind === 'empty'}
			<div class="catalog-state-message">
				<p class="state-main-text">{emptyTitle}</p>
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
	</div>
</section>

<style>
	.catalog-section {
		width: 100%;
		box-sizing: border-box;
	}

	.catalog-stage-panel {
		width: 100%;
	}

	.catalog-stage-panel.is-entering {
		animation: catalog-view-in var(--catalog-enter-ms, 280ms) cubic-bezier(0.22, 1, 0.36, 1) both;
		will-change: opacity, transform;
	}

	.catalog-stage-panel.is-skeleton.is-entering {
		animation: catalog-skeleton-in var(--catalog-skeleton-enter-ms, 180ms) cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.catalog-stage-panel.is-exiting {
		pointer-events: none;
		animation: catalog-view-out var(--catalog-exit-ms, 160ms) cubic-bezier(0.4, 0, 1, 1) forwards;
		will-change: opacity, transform;
	}

	.catalog-stage-panel.is-skeleton.is-exiting {
		animation: catalog-skeleton-out var(--catalog-skeleton-exit-ms, 130ms) cubic-bezier(0.4, 0, 1, 1) forwards;
	}

	@keyframes catalog-view-in {
		from {
			opacity: 0;
			transform: translate3d(0, 12px, 0) scale(0.988);
		}
		to {
			opacity: 1;
			transform: translate3d(0, 0, 0) scale(1);
		}
	}

	@keyframes catalog-view-out {
		from {
			opacity: 1;
			transform: translate3d(0, 0, 0) scale(1);
		}
		to {
			opacity: 0;
			transform: translate3d(0, -6px, 0) scale(0.992);
		}
	}

	@keyframes catalog-skeleton-in {
		from {
			opacity: 0;
			transform: translate3d(0, 6px, 0);
		}
		to {
			opacity: 1;
			transform: translate3d(0, 0, 0);
		}
	}

	@keyframes catalog-skeleton-out {
		from {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.catalog-stage-panel.is-entering,
		.catalog-stage-panel.is-exiting {
			animation: none;
			will-change: auto;
		}
	}

	.catalog-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(var(--catalog-card-min, 196px), 1fr));
		column-gap: var(--catalog-col-gap, 1.5rem);
		row-gap: var(--catalog-row-gap, 2.5rem);
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

	.catalog-state-message {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 6.5rem 1.5rem;
		text-align: center;
		box-sizing: border-box;
	}

	.state-main-text {
		margin: 0;
		font-size: 1rem;
		font-weight: var(--fw-medium);
		letter-spacing: -0.02em;
		line-height: 1.5;
		color: var(--muted);
		word-break: keep-all;
	}

	.state-main-text.is-error {
		color: var(--fg);
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
			column-gap: var(--catalog-col-gap-mobile, 1.125rem);
			row-gap: var(--catalog-row-gap-mobile, 2rem);
		}

		.catalog-state-message {
			padding: 4.5rem 1rem;
		}

		.state-main-text {
			font-size: 0.94rem;
		}
	}
</style>
