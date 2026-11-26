<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		CATALOG_TRANSITION_TIMING,
		type CatalogCategoryKey
	} from '#lib/common/catalog/catalogFeed';
	import type { CatalogViewStage } from '../logic/catalogFeedController.svelte';
	import CatalogFeedStatus from './CatalogFeedStatus.svelte';

	export interface CatalogFeedViewModel {
		readonly stage: CatalogViewStage;
		readonly contentRevision: number;
		readonly showContent: boolean;
		readonly showSkeleton: boolean;
		readonly isLoadingMore: boolean;
		readonly isEmpty: boolean;
		readonly hasNext: boolean;
		readonly errorMessage: string | null;
		readonly retry: () => void;
		readonly loadMore: () => void;
	}

	interface Props {
		category: CatalogCategoryKey;
		label: string;
		active: boolean;
		feed: CatalogFeedViewModel;
		emptyTitle?: string;
		emptyDescription?: string;
		content: Snippet<[{ interactive: boolean }]>;
		skeleton?: Snippet;
	}

	let {
		category,
		label,
		active,
		feed,
		emptyTitle,
		emptyDescription,
		content,
		skeleton
	}: Props = $props();

	const stage = $derived(feed.stage);
</script>

<!-- 4_category 공용 피드 뷰: 기존 아이템 퇴장 -> 스켈레톤 -> 새 아이템 등장 + 오류/빈상태/무한스크롤 통합 -->
<section
	class="catalog-feed-section"
	style:--content-exit-ms="{CATALOG_TRANSITION_TIMING.contentExitMs}ms"
	style:--skeleton-enter-ms="{CATALOG_TRANSITION_TIMING.skeletonEnterMs}ms"
	style:--skeleton-exit-ms="{CATALOG_TRANSITION_TIMING.skeletonExitMs}ms"
	style:--content-enter-ms="{CATALOG_TRANSITION_TIMING.contentEnterMs}ms"
	data-category={category}
	data-active={active ? 'true' : 'false'}
	aria-label={label}
>
	{#if feed.showContent}
		{#key feed.contentRevision}
			<div
				class="catalog-feed-stage catalog-feed-content"
				class:is-exiting={stage === 'exiting-content'}
			>
				{@render content({ interactive: active && stage === 'content' })}
			</div>
		{/key}
	{/if}

	{#snippet skeletonSlot()}
		{#if skeleton}
			<div
				class="catalog-feed-stage catalog-feed-skeleton"
				class:is-exiting={stage === 'exiting-skeleton'}
				role="status"
				aria-live="polite"
				aria-label="{label} 목록 불러오는 중"
			>
				{@render skeleton()}
			</div>
		{/if}
	{/snippet}

	<CatalogFeedStatus
		isLoading={feed.showSkeleton}
		isLoadingMore={feed.isLoadingMore}
		isEmpty={feed.isEmpty}
		hasNext={feed.hasNext && stage === 'content'}
		errorMessage={stage === 'content' ? feed.errorMessage : null}
		{emptyTitle}
		{emptyDescription}
		loading={skeleton ? skeletonSlot : undefined}
		onRetry={feed.retry}
		onLoadMore={feed.loadMore}
	/>
</section>

<style>
	.catalog-feed-section {
		width: 100%;
	}

	.catalog-feed-stage {
		width: 100%;
	}

	.catalog-feed-content {
		animation: catalog-feed-enter var(--content-enter-ms, 280ms) cubic-bezier(0.22, 1, 0.36, 1)
			backwards;
	}

	.catalog-feed-content.is-exiting {
		pointer-events: none;
		will-change: opacity, transform;
		animation: catalog-feed-exit var(--content-exit-ms, 160ms) cubic-bezier(0.4, 0, 1, 1) forwards;
	}

	.catalog-feed-skeleton {
		animation: catalog-skeleton-enter var(--skeleton-enter-ms, 180ms)
			cubic-bezier(0.22, 1, 0.36, 1) backwards;
	}

	.catalog-feed-skeleton.is-exiting {
		will-change: opacity;
		animation: catalog-skeleton-exit var(--skeleton-exit-ms, 130ms) cubic-bezier(0.4, 0, 1, 1)
			forwards;
	}

	@keyframes catalog-feed-enter {
		from {
			opacity: 0;
			transform: translate3d(0, 8px, 0);
		}
		to {
			opacity: 1;
			transform: translate3d(0, 0, 0);
		}
	}

	@keyframes catalog-feed-exit {
		from {
			opacity: 1;
			transform: translate3d(0, 0, 0);
		}
		to {
			opacity: 0;
			transform: translate3d(0, 6px, 0);
		}
	}

	@keyframes catalog-skeleton-enter {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes catalog-skeleton-exit {
		from {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.catalog-feed-content,
		.catalog-feed-content.is-exiting,
		.catalog-feed-skeleton,
		.catalog-feed-skeleton.is-exiting {
			animation: none;
		}
	}
</style>
