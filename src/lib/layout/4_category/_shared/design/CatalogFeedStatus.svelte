<script lang="ts">
	import type { Snippet } from 'svelte';
	import { BlockOrbitSpinner, PulseDotsSpinner } from '#lib/common/design/icon/spinner';

	interface Props {
		isLoading: boolean;
		isLoadingMore: boolean;
		isEmpty: boolean;
		hasNext: boolean;
		errorMessage: string | null;
		emptyTitle?: string;
		emptyDescription?: string;
		loading?: Snippet;
		onRetry?: () => void;
		onLoadMore?: () => void;
	}

	let {
		isLoading,
		isLoadingMore,
		isEmpty,
		hasNext,
		errorMessage,
		emptyTitle = '표시할 항목이 없습니다.',
		emptyDescription = '검색어나 필터 조건을 변경해 보세요.',
		loading,
		onRetry,
		onLoadMore
	}: Props = $props();

	function observeSentinel(node: HTMLDivElement) {
		if (typeof IntersectionObserver === 'undefined') return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					onLoadMore?.();
				}
			},
			{ rootMargin: '240px 0px' }
		);
		observer.observe(node);
		return {
			destroy() {
				observer.disconnect();
			}
		};
	}
</script>

<!-- 카탈로그 공용 피드 상태 뷰: 초기 로딩 · 오류 · 빈 상태 · 무한 스크롤 센티넬 (순수 렌더링) -->
{#if isLoading}
	{#if loading}
		{@render loading()}
	{:else}
		<div class="catalog-state-box" role="status" aria-live="polite">
			<BlockOrbitSpinner size={24} />
		</div>
	{/if}
{:else if errorMessage}
	<div class="catalog-state-box" role="alert">
		<p class="catalog-state-title">{errorMessage}</p>
		{#if onRetry}
			<button type="button" class="catalog-retry-btn" onclick={() => onRetry?.()}>
				다시 시도
			</button>
		{/if}
	</div>
{:else if isEmpty}
	<div class="catalog-state-box">
		<p class="catalog-state-title">{emptyTitle}</p>
		<p class="catalog-state-desc">{emptyDescription}</p>
	</div>
{/if}

{#if !isLoading && hasNext}
	<div use:observeSentinel class="catalog-load-more" aria-hidden={!isLoadingMore || undefined}>
		{#if isLoadingMore}
			<PulseDotsSpinner size={24} />
		{/if}
	</div>
{/if}

<style>
	.catalog-state-box {
		width: 100%;
		min-height: 220px;
		padding: 2.5rem 1rem;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.65rem;
		text-align: center;
		color: var(--muted);
	}

	.catalog-state-title {
		margin: 0;
		font-size: 0.96rem;
		font-weight: var(--fw-semibold);
		color: var(--fg);
	}

	.catalog-state-desc {
		margin: 0;
		font-size: 0.85rem;
		color: var(--muted);
	}

	.catalog-retry-btn {
		margin-top: 0.35rem;
		height: 36px;
		padding: 0 1rem;
		border-radius: 999px;
		border: var(--thin-border);
		background: var(--surface);
		color: var(--fg);
		font: inherit;
		font-size: 0.84rem;
		font-weight: var(--fw-medium);
		cursor: pointer;
		transition:
			background-color 0.18s ease,
			color 0.18s ease;
	}

	.catalog-retry-btn:hover {
		background: var(--surface-2);
		color: var(--white);
	}

	.catalog-load-more {
		width: 100%;
		min-height: 48px;
		margin-top: 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--muted);
	}
</style>
