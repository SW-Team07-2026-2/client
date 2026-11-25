<script lang="ts">
	interface Props {
		index?: number;
	}

	let { index = 0 }: Props = $props();
</script>

<!-- 모바일 전용 아티스트 카드 스켈레톤 (MbArtistItem과 동일한 1:1 프레임·inset 14px·푸터 높이, 순수 렌더링) -->
<article
	class="mb-artist-skeleton"
	style:--skeleton-delay="{(index % 4) * 70}ms"
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
	.mb-artist-skeleton {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		padding: 0;
		box-sizing: border-box;
		pointer-events: none;
		user-select: none;
	}

	/* MbArtistItem .artist-stage 및 FdImage(computedInset = 14px)와 픽셀 단위 동일 구조 */
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
		margin-top: -0.2rem;
		height: calc(0.94rem * 1.35);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.skeleton-name {
		width: 58%;
		height: 0.84rem;
		border-radius: 999px;
	}
</style>
