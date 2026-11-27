<script lang="ts">
	import ProductDetailSkeleton from '../../_shared/design/ProductDetailSkeleton.svelte';

	interface Props {
		mobile: boolean;
	}

	let { mobile }: Props = $props();
</script>

<!-- 아티스트 상세 전용 스켈레톤 (1:1 프로필 · 모바일 이름 아래 중앙 팔로우 · 메타 표, 순수 렌더링) -->
<ProductDetailSkeleton
	aspectRatio="1 / 1"
	visualRadius={26}
	showArtistLink={false}
	metaRowCount={4}
	centerTitleOnNarrow={mobile}
	actionBeforeMeta={mobile}
>
	{#snippet action()}
		<div
			class="artist-skeleton-action"
			class:is-above-meta={mobile}
			class:has-top-divider={!mobile}
		>
			<div class="skeleton-follow-pill skeleton-shimmer"></div>
		</div>
	{/snippet}
</ProductDetailSkeleton>

<style>
	.artist-skeleton-action {
		width: 100%;
		margin-top: 1.4rem;
		display: flex;
		align-items: center;
	}

	.artist-skeleton-action.is-above-meta {
		margin-top: 1rem;
	}

	.artist-skeleton-action.has-top-divider {
		margin-top: 1.75rem;
		padding-top: 1.5rem;
		border-top: var(--thin-border);
	}

	.skeleton-follow-pill {
		width: 126px;
		height: 38px;
		border-radius: 999px;
	}

	@container product-detail (max-width: 740px) {
		.artist-skeleton-action.is-above-meta {
			justify-content: center;
		}
	}
</style>
