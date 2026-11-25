<script lang="ts">
	interface Props {
		index?: number;
	}

	let { index = 0 }: Props = $props();
</script>

<!-- PC 전용 아티스트 카드 스켈레톤 (PcArtistItem과 동일한 1:1 프레임·inset 14px·푸터 높이, 순수 렌더링) -->
<article
	class="pc-artist-skeleton"
	style:--skeleton-delay="{(index % 6) * 70}ms"
	aria-hidden="true"
>
	<div class="skeleton-stage">
		<div class="skeleton-avatar skeleton-shimmer"></div>
	</div>
	<div class="skeleton-footer">
		<div class="skeleton-name skeleton-shimmer"></div>
	</div>
</article>

<style>
	.pc-artist-skeleton {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		padding: 0;
		box-sizing: border-box;
		pointer-events: none;
		user-select: none;
	}

	/* PcArtistItem .artist-stage 및 FdImage(computedInset = 14px)와 픽셀 단위 동일 구조 */
	.skeleton-stage {
		position: relative;
		width: 100%;
		aspect-ratio: 1 / 1;
	}

	.skeleton-avatar {
		position: absolute;
		inset: 14px;
		border-radius: 999px;
	}

	.skeleton-footer {
		position: relative;
		width: 100%;
		margin-top: -0.25rem;
		height: calc(1.02rem * 1.35);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.skeleton-name {
		width: 56%;
		height: 0.92rem;
		border-radius: 999px;
	}
</style>
