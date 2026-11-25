<script lang="ts">
	interface Props {
		index?: number;
	}

	let { index = 0 }: Props = $props();
</script>

<!-- PC 전용 굿즈 카드 스켈레톤 (PcGoodsItem과 동일한 4:5 프레임·정보 영역, 순수 렌더링) -->
<article
	class="pc-goods-skeleton"
	style:--skeleton-delay="{(index % 5) * 70}ms"
	aria-hidden="true"
>
	<div class="skeleton-media skeleton-shimmer"></div>
	<div class="skeleton-info">
		<div class="skeleton-artist skeleton-shimmer"></div>
		<div class="skeleton-name skeleton-shimmer"></div>
		<div class="skeleton-price skeleton-shimmer"></div>
	</div>
</article>

<style>
	.pc-goods-skeleton {
		display: flex;
		flex-direction: column;
		width: 100%;
		box-sizing: border-box;
		pointer-events: none;
		user-select: none;
	}

	.skeleton-media {
		width: 100%;
		aspect-ratio: 4 / 5;
		border-radius: 14px;
	}

	.skeleton-info {
		margin-top: 0.72rem;
		padding: 0 0.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.34rem;
	}

	.skeleton-artist {
		width: 38%;
		height: 0.74rem;
		border-radius: 999px;
	}

	.skeleton-name {
		width: 82%;
		height: 0.94rem;
		border-radius: 999px;
	}

	.skeleton-price {
		margin-top: 0.1rem;
		width: 46%;
		height: 0.9rem;
		border-radius: 999px;
	}
</style>
