<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** 좌측 비주얼 종횡비 (예: '1 / 1', '3 / 4', '4 / 5') */
		aspectRatio?: string;
		/** 좌측 비주얼 슬롯 커스텀 너비 (ProductDetailLayout의 visualWidth와 동일) */
		visualWidth?: string;
		/** 좌측 비주얼 모서리 반경 (px) */
		visualRadius?: number;
		/** 제목 아래 아티스트 링크 스켈레톤 표시 여부 */
		showArtistLink?: boolean;
		/** 공용 메타 표 행 개수 */
		metaRowCount?: number;
		/** 좁은 화면(<=740px)에서 제목 스켈레톤 중앙 정렬 여부 */
		centerTitleOnNarrow?: boolean;
		/** true면 action 슬롯을 메타 표 위(제목 바로 아래)에 배치 */
		actionBeforeMeta?: boolean;
		/** 커스텀 아티스트 영역 스켈레톤 (예: 공연 멀티 라인업 칩) */
		artistSlot?: Snippet;
		/** 우측 액션/구매 패널 스켈레톤 */
		action?: Snippet;
		/** 히어로 하단 확장 섹션 스켈레톤 (예: 트랙리스트, 상세 설명) */
		below?: Snippet;
	}

	let {
		aspectRatio = '1 / 1',
		visualWidth,
		visualRadius = 26,
		showArtistLink = true,
		metaRowCount = 3,
		centerTitleOnNarrow = false,
		actionBeforeMeta = false,
		artistSlot,
		action,
		below
	}: Props = $props();

	const META_VALUE_WIDTHS = ['58%', '42%', '68%', '76%', '52%'] as const;
	const metaIndices = $derived(Array.from({ length: Math.max(0, metaRowCount) }, (_, i) => i));
</script>

<!-- 상세 페이지 공용 베이스 스켈레톤 (ProductDetailLayout과 1:1 그리드/간격 동기화, 순수 렌더링) -->
<div class="detail-skeleton" role="status" aria-busy="true" aria-label="상세 정보 불러오는 중">
	<div class="detail-skeleton-hero">
		<div
			class="skeleton-visual-slot"
			style:--hero-visual-width={visualWidth || undefined}
		>
			<div
				class="skeleton-visual-box skeleton-shimmer"
				style:aspect-ratio={aspectRatio}
				style:border-radius="{visualRadius}px"
			></div>
		</div>

		<div class="skeleton-info-col" class:is-center-title-narrow={centerTitleOnNarrow}>
			<div class="skeleton-title skeleton-shimmer"></div>

			{#if artistSlot}
				{@render artistSlot()}
			{:else if showArtistLink}
				<div class="skeleton-artist-link skeleton-shimmer"></div>
			{/if}

			{#if actionBeforeMeta && action}
				{@render action()}
			{/if}

			{#if metaIndices.length > 0}
				<div class="skeleton-meta-list">
					{#each metaIndices as idx (idx)}
						<div class="skeleton-meta-row">
							<span class="skeleton-meta-label skeleton-shimmer"></span>
							<span
								class="skeleton-meta-value skeleton-shimmer"
								style:width={META_VALUE_WIDTHS[idx % META_VALUE_WIDTHS.length]}
							></span>
						</div>
					{/each}
				</div>
			{/if}

			{#if !actionBeforeMeta && action}
				{@render action()}
			{/if}
		</div>
	</div>

	{#if below}
		{@render below()}
	{/if}
</div>

<style>
	.detail-skeleton {
		width: 100%;
		pointer-events: none;
		user-select: none;
	}

	.detail-skeleton-hero {
		display: flex;
		align-items: flex-start;
		gap: clamp(2rem, 4cqi, 3.75rem);
	}

	.skeleton-visual-slot {
		flex-shrink: 0;
		width: var(--hero-visual-width, clamp(280px, 34cqi, 400px));
	}

	.skeleton-visual-box {
		width: 100%;
	}

	.skeleton-info-col {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}

	.skeleton-title {
		width: min(72%, 340px);
		height: clamp(2rem, 3.2cqi, 2.75rem);
		border-radius: 10px;
	}

	.skeleton-artist-link {
		margin-top: 0.7rem;
		width: 112px;
		height: 1.15rem;
		border-radius: 999px;
	}

	.skeleton-meta-list {
		width: 100%;
		margin-top: 1.5rem;
		padding-top: 1.25rem;
		border-top: var(--thin-border);
		display: flex;
		flex-direction: column;
		gap: 0.78rem;
	}

	.skeleton-meta-row {
		display: grid;
		grid-template-columns: 78px minmax(0, 1fr);
		align-items: center;
		gap: 0.75rem;
	}

	.skeleton-meta-label {
		width: 48px;
		height: 0.92rem;
		border-radius: 999px;
	}

	.skeleton-meta-value {
		height: 0.96rem;
		border-radius: 999px;
	}

	@container product-detail (max-width: 740px) {
		.detail-skeleton-hero {
			flex-direction: column;
			align-items: stretch;
			gap: 1.5rem;
		}

		.skeleton-visual-slot {
			width: min(100%, 300px);
			margin: 0 auto;
		}

		.skeleton-info-col.is-center-title-narrow .skeleton-title {
			margin-inline: auto;
		}
	}
</style>
