<script lang="ts">
	interface Props {
		index?: number;
	}

	let { index = 0 }: Props = $props();
</script>

<!-- PC 공연 카드 스켈레톤 (3:4 포스터 + 메타 라인, 순수 렌더링) -->
<div class="concert-skel" style:--skeleton-delay="{(index % 6) * 70}ms" aria-hidden="true">
	<div class="skel-poster skeleton-shimmer"></div>
	<div class="skel-meta">
		<span class="skel-line skeleton-shimmer" style="width: 82%; height: 16px;"></span>
		<span class="skel-line skeleton-shimmer" style="width: 56%; height: 13px;"></span>
		<span class="skel-line skeleton-shimmer" style="width: 44%; height: 13px;"></span>
	</div>
</div>

<style>
	.concert-skel {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	.skel-poster {
		width: 100%;
		aspect-ratio: 3 / 4;
		border-radius: 16px;
	}

	.skel-meta {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.skel-line {
		display: block;
		border-radius: 6px;
	}
</style>
