<script lang="ts">
	import ProductDetailSkeleton from '../../_shared/design/ProductDetailSkeleton.svelte';
</script>

<!-- 굿즈 상세 전용 스켈레톤 (4:5 이미지 · 메타 표 · 단일 옵션 구매 패널 · 상세 정보, 순수 렌더링) -->
<ProductDetailSkeleton aspectRatio="4 / 5" visualRadius={24} showArtistLink={true} metaRowCount={2}>
	{#snippet action()}
		<div class="skeleton-purchase">
			<div class="skeleton-selectors">
				<div class="skeleton-field">
					<span class="skeleton-field-label skeleton-shimmer"></span>
					<span class="skeleton-field-box skeleton-shimmer"></span>
				</div>
				<div class="skeleton-field">
					<span class="skeleton-field-label skeleton-shimmer"></span>
					<span class="skeleton-field-box skeleton-shimmer"></span>
				</div>
			</div>

			<div class="skeleton-cta-row">
				<div class="skeleton-cart-btn skeleton-shimmer"></div>
				<div class="skeleton-price skeleton-shimmer"></div>
			</div>
		</div>
	{/snippet}

	{#snippet below()}
		<div class="skeleton-detail-info">
			<div class="skeleton-section-title skeleton-shimmer"></div>
			<div class="skeleton-para-line skeleton-shimmer"></div>
			<div class="skeleton-para-line is-mid skeleton-shimmer"></div>
			<div class="skeleton-para-line is-short skeleton-shimmer"></div>
		</div>
	{/snippet}
</ProductDetailSkeleton>

<style>
	.skeleton-purchase {
		width: 100%;
		margin-top: 1.75rem;
		padding-top: 1.5rem;
		border-top: var(--thin-border);
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.skeleton-selectors {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 108px;
		gap: 0.75rem;
	}

	.skeleton-field {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.skeleton-field-label {
		width: 42px;
		height: 0.78rem;
		border-radius: 999px;
	}

	.skeleton-field-box {
		width: 100%;
		height: 48px;
		border-radius: 14px;
	}

	.skeleton-cta-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.skeleton-cart-btn {
		flex: 1 1 180px;
		height: 48px;
		border-radius: 14px;
	}

	.skeleton-price {
		width: 88px;
		height: 1.6rem;
		border-radius: 8px;
		flex-shrink: 0;
	}

	.skeleton-detail-info {
		margin-top: 2.75rem;
		padding-top: 2rem;
		border-top: var(--thin-border);
		display: flex;
		flex-direction: column;
		gap: 0.72rem;
	}

	.skeleton-section-title {
		width: 84px;
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
		width: 82%;
	}

	.skeleton-para-line.is-short {
		width: 58%;
	}
</style>
