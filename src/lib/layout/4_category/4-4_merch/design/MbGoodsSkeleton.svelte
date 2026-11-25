<script lang="ts">
	interface Props {
		index?: number;
	}

	let { index = 0 }: Props = $props();
</script>

<!-- 모바일 전용 굿즈 카드 스켈레톤 (MbGoodsItem과 동일한 4:5 프레임·정보 영역, 순수 렌더링) -->
<article
	class="mb-goods-skeleton"
	style:--skeleton-delay="{(index % 4) * 70}ms"
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
	.mb-goods-skeleton {
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
		border-radius: 12px;
	}

	.skeleton-info {
		margin-top: 0.55rem;
		display: flex;
		flex-direction: column;
		gap: 0.28rem;
	}

	.skeleton-artist {
		width: 40%;
		height: 0.7rem;
		border-radius: 999px;
	}

	.skeleton-name {
		width: 84%;
		height: 0.86rem;
		border-radius: 999px;
	}

	.skeleton-price {
		margin-top: 0.08rem;
		width: 48%;
		height: 0.84rem;
		border-radius: 999px;
	}
</style>
