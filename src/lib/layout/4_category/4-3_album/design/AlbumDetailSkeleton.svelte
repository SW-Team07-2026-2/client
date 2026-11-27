<script lang="ts">
	import ProductDetailSkeleton from '../../_shared/design/ProductDetailSkeleton.svelte';

	const TRACK_INDICES = [0, 1, 2, 3, 4] as const;
</script>

<!-- 앨범 상세 전용 스켈레톤 (1:1 커버 · 메타 표 · 2단 옵션 구매 패널 · 수록곡 트랙리스트, 순수 렌더링) -->
<ProductDetailSkeleton aspectRatio="1 / 1" visualRadius={26} showArtistLink={true} metaRowCount={3}>
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
				<div class="skeleton-field is-qty">
					<span class="skeleton-field-label skeleton-shimmer"></span>
					<span class="skeleton-field-box skeleton-shimmer"></span>
				</div>
			</div>

			<div class="skeleton-cta-row">
				<div class="skeleton-leading-btn skeleton-shimmer"></div>
				<div class="skeleton-cart-btn skeleton-shimmer"></div>
				<div class="skeleton-price skeleton-shimmer"></div>
			</div>
		</div>
	{/snippet}

	{#snippet below()}
		<div class="skeleton-tracks">
			<div class="skeleton-section-title skeleton-shimmer"></div>
			{#each TRACK_INDICES as idx (idx)}
				<div class="skeleton-track-row">
					<span class="skeleton-track-no skeleton-shimmer"></span>
					<span
						class="skeleton-track-name skeleton-shimmer"
						style:width="{52 + ((idx * 13) % 30)}%"
					></span>
				</div>
			{/each}
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
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 108px;
		gap: 0.75rem;
	}

	.skeleton-field {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.skeleton-field-label {
		width: 46px;
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
		gap: 0.7rem;
	}

	.skeleton-leading-btn {
		width: 48px;
		height: 48px;
		border-radius: 14px;
		flex-shrink: 0;
	}

	.skeleton-cart-btn {
		flex: 1 1 160px;
		height: 48px;
		border-radius: 14px;
	}

	.skeleton-price {
		width: 88px;
		height: 1.6rem;
		border-radius: 8px;
		flex-shrink: 0;
	}

	.skeleton-tracks {
		margin-top: 3rem;
		padding-top: 2rem;
		border-top: var(--thin-border);
		display: flex;
		flex-direction: column;
	}

	.skeleton-section-title {
		width: 72px;
		height: 1.2rem;
		border-radius: 8px;
		margin-bottom: 1rem;
	}

	.skeleton-track-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.9rem 0.4rem;
		border-bottom: var(--thin-border);
	}

	.skeleton-track-row:last-child {
		border-bottom: none;
	}

	.skeleton-track-no {
		width: 22px;
		height: 0.85rem;
		border-radius: 999px;
		flex-shrink: 0;
	}

	.skeleton-track-name {
		height: 0.95rem;
		border-radius: 999px;
	}

	@container product-detail (max-width: 520px) {
		.skeleton-selectors {
			grid-template-columns: minmax(0, 1fr) 104px;
		}
	}
</style>
