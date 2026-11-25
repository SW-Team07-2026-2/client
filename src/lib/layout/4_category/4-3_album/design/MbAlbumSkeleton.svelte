<script lang="ts">
	interface Props {
		index?: number;
	}

	let { index = 0 }: Props = $props();
</script>

<!-- 모바일 전용 가로 풀폭 앨범 스켈레톤 (MbAlbumItem과 동일한 좌측 커버·우측 상/하단 구조, 순수 렌더링) -->
<article
	class="mb-album-skeleton"
	style:--skeleton-delay="{(index % 6) * 65}ms"
	aria-hidden="true"
>
	<div class="skeleton-thumb skeleton-shimmer"></div>

	<div class="skeleton-body">
		<div class="skeleton-head">
			<div class="skeleton-title skeleton-shimmer"></div>
			<div class="skeleton-artist skeleton-shimmer"></div>
		</div>

		<div class="skeleton-meta-list">
			<div class="skeleton-meta-row">
				<div class="skeleton-badge skeleton-shimmer"></div>
				<div class="skeleton-price skeleton-shimmer"></div>
			</div>
		</div>
	</div>
</article>

<style>
	.mb-album-skeleton {
		width: 100%;
		padding: 0.72rem 0.25rem;
		border-bottom: var(--thin-border);
		display: flex;
		align-items: stretch;
		gap: 0.9rem;
		box-sizing: border-box;
		pointer-events: none;
		user-select: none;
	}

	.skeleton-thumb {
		width: 92px;
		height: 92px;
		flex-shrink: 0;
		border-radius: 10px;
	}

	.skeleton-body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 0.45rem;
		padding: 0.1rem 0;
	}

	.skeleton-head {
		display: flex;
		flex-direction: column;
		gap: 0.34rem;
	}

	.skeleton-title {
		width: 68%;
		height: 0.96rem;
		border-radius: 999px;
	}

	.skeleton-artist {
		width: 38%;
		height: 0.78rem;
		border-radius: 999px;
	}

	.skeleton-meta-list {
		display: flex;
		flex-direction: column;
		gap: 0.24rem;
	}

	.skeleton-meta-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.skeleton-badge {
		width: 2.1rem;
		height: 1.1rem;
		border-radius: 999px;
	}

	.skeleton-price {
		width: 4.2rem;
		height: 0.84rem;
		border-radius: 999px;
	}
</style>
