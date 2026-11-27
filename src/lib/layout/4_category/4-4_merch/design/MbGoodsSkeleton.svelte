<script lang="ts">
	interface Props {
		index?: number;
	}

	let { index = 0 }: Props = $props();
</script>

<!-- 모바일 전용 굿즈 카드 스켈레톤 (MbGoodsItem 라운드 카드·정보·담기 버튼 구조, 순수 렌더링) -->
<article
	class="mb-goods-skeleton"
	style:--skeleton-delay="{(index % 4) * 70}ms"
	aria-hidden="true"
>
	<div class="skeleton-media skeleton-shimmer"></div>
	<div class="skeleton-info">
		<div class="skeleton-name skeleton-shimmer"></div>
		<div class="skeleton-price skeleton-shimmer"></div>
		<div class="skeleton-tags">
			<div class="skeleton-tag skeleton-shimmer"></div>
			<div class="skeleton-tag is-short skeleton-shimmer"></div>
		</div>
	</div>
	<div class="skeleton-btn-wrap">
		<div class="skeleton-btn skeleton-shimmer"></div>
	</div>
</article>

<style>
	.mb-goods-skeleton {
		display: flex;
		flex-direction: column;
		width: 100%;
		border-radius: 18px;
		overflow: hidden;
		background: var(--surface);
		border: var(--thin-border);
		box-sizing: border-box;
		pointer-events: none;
		user-select: none;
	}

	.skeleton-media {
		width: 100%;
		aspect-ratio: 1 / 1;
	}

	.skeleton-info {
		padding: 0.5rem 0.72rem 0.55rem;
		display: flex;
		flex-direction: column;
		gap: 0.34rem;
	}

	.skeleton-name {
		width: 86%;
		height: 0.88rem;
		border-radius: 999px;
	}

	.skeleton-price {
		width: 52%;
		height: 1rem;
		border-radius: 999px;
	}

	.skeleton-tags {
		margin-top: 0.14rem;
		display: flex;
		gap: 0.28rem;
	}

	.skeleton-tag {
		width: 3.2rem;
		height: 1.15rem;
		border-radius: 6px;
	}

	.skeleton-tag.is-short {
		width: 2.4rem;
	}

	.skeleton-btn-wrap {
		padding: 0 0.72rem 0.72rem;
	}

	.skeleton-btn {
		width: 100%;
		height: 36px;
		border-radius: 10px;
	}
</style>
