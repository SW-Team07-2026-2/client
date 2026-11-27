<script lang="ts">
	import ProductDetailSkeleton from '../../_shared/design/ProductDetailSkeleton.svelte';
</script>

<!-- 공연 상세 전용 스켈레톤 (3:4 포스터 · 멀티 라인업 칩 · 공연 메타 표 · 예매 CTA · 공연 소개, 순수 렌더링) -->
<ProductDetailSkeleton
	aspectRatio="3 / 4"
	visualWidth="clamp(260px, 32cqi, 370px)"
	visualRadius={24}
	showArtistLink={false}
	metaRowCount={5}
>
	{#snippet artistSlot()}
		<div class="skeleton-lineup-row">
			<span class="skeleton-chip skeleton-shimmer"></span>
			<span class="skeleton-chip is-wide skeleton-shimmer"></span>
		</div>
	{/snippet}

	{#snippet action()}
		<div class="skeleton-booking-bar">
			<div class="skeleton-booking-cta skeleton-shimmer"></div>
			<div class="skeleton-booking-price skeleton-shimmer"></div>
		</div>
	{/snippet}

	{#snippet below()}
		<div class="skeleton-below-section">
			<div class="skeleton-section-title skeleton-shimmer"></div>
			<div class="skeleton-para-line skeleton-shimmer"></div>
			<div class="skeleton-para-line is-mid skeleton-shimmer"></div>
			<div class="skeleton-para-line is-short skeleton-shimmer"></div>
		</div>
	{/snippet}
</ProductDetailSkeleton>

<style>
	.skeleton-lineup-row {
		margin-top: 0.85rem;
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.skeleton-chip {
		width: 78px;
		height: 32px;
		border-radius: 999px;
	}

	.skeleton-chip.is-wide {
		width: 102px;
	}

	.skeleton-booking-bar {
		width: 100%;
		margin-top: 1.75rem;
		padding-top: 1.5rem;
		border-top: var(--thin-border);
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}

	.skeleton-booking-cta {
		flex: 1 1 180px;
		height: 48px;
		border-radius: 14px;
	}

	.skeleton-booking-price {
		width: 96px;
		height: 1.65rem;
		border-radius: 8px;
		flex-shrink: 0;
	}

	.skeleton-below-section {
		margin-top: 3rem;
		padding-top: 2rem;
		border-top: var(--thin-border);
		display: flex;
		flex-direction: column;
		gap: 0.72rem;
	}

	.skeleton-section-title {
		width: 96px;
		height: 1.2rem;
		border-radius: 8px;
		margin-bottom: 0.25rem;
	}

	.skeleton-para-line {
		width: 100%;
		height: 0.94rem;
		border-radius: 999px;
	}

	.skeleton-para-line.is-mid {
		width: 84%;
	}

	.skeleton-para-line.is-short {
		width: 62%;
	}
</style>
