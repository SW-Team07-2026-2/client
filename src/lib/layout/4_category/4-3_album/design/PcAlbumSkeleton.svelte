<script lang="ts">
	interface Props {
		index?: number;
	}

	let { index = 0 }: Props = $props();
</script>

<!-- PC 전용 앨범 카드 스켈레톤 (PcAlbumItem과 동일한 1:1 커버·하단 메타 라인, 순수 렌더링) -->
<article
	class="pc-album-skeleton"
	style:--skeleton-delay="{(index % 5) * 70}ms"
	aria-hidden="true"
>
	<div class="skeleton-stage">
		<div class="skeleton-disc skeleton-shimmer"></div>
		<div class="skeleton-sleeve skeleton-shimmer"></div>
	</div>
	<div class="skeleton-meta">
		<div class="skeleton-badge skeleton-shimmer"></div>
		<div class="skeleton-price skeleton-shimmer"></div>
	</div>
</article>

<style>
	.pc-album-skeleton {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 204px;
		margin: 0 auto;
		box-sizing: border-box;
		pointer-events: none;
		user-select: none;
	}

	.skeleton-stage {
		position: relative;
		width: 100%;
		aspect-ratio: 1 / 1;
	}

	.skeleton-disc {
		position: absolute;
		top: 0;
		left: 9%;
		width: 82%;
		height: 82%;
		border-radius: 999px;
		transform: translate3d(0, -6%, 0);
		opacity: 0.45;
	}

	.skeleton-sleeve {
		position: relative;
		z-index: 2;
		width: 100%;
		height: 100%;
		border-radius: 12px;
	}

	.skeleton-meta {
		margin-top: 0.62rem;
		display: flex;
		align-items: center;
		gap: 0.42rem;
	}

	.skeleton-badge {
		width: 2.2rem;
		height: 1.15rem;
		border-radius: 999px;
	}

	.skeleton-price {
		width: 3.8rem;
		height: 0.86rem;
		border-radius: 999px;
	}
</style>
