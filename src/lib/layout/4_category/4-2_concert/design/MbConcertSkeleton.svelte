<script lang="ts">
	interface Props {
		index?: number;
	}

	let { index = 0 }: Props = $props();
</script>

<!-- 모바일 공연 카드 스켈레톤 (3:4 포스터 + 메타 라인, 순수 렌더링) -->
<div class="concert-skel" style:--skeleton-delay="{(index % 4) * 70}ms" aria-hidden="true">
	<div class="skel-poster skeleton-shimmer"></div>
	<div class="skel-meta">
		<span class="skel-line skeleton-shimmer" style="width: 84%; height: 15px;"></span>
		<span class="skel-line skeleton-shimmer" style="width: 58%; height: 12px;"></span>
	</div>
</div>

<style>
	.concert-skel {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.skel-poster {
		width: 100%;
		aspect-ratio: 3 / 4;
		border-radius: 14px;
	}

	.skel-meta {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.skel-line {
		display: block;
		border-radius: 6px;
	}
</style>
