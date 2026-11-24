<script lang="ts">
	import type { MainSectionDescriptor } from '../2_main_section/logic/sectionRegistry';
	import {
		getContentSectionContext,
		isFilterableCategory
	} from './logic/contentSection.svelte';
	import PcContentFilter from './design/PcContentFilter.svelte';

	interface Props {
		section: MainSectionDescriptor;
		active: boolean;
		detailId?: number | null;
	}

	let { section, active, detailId = null }: Props = $props();

	const contentCtrl = getContentSectionContext();
	const filterableKey = $derived(isFilterableCategory(section.key) ? section.key : null);
	const filterState = $derived(contentCtrl?.getFilterState(section.key));
	const filterOpen = $derived(contentCtrl?.isFilterOpen(section.key) ?? false);

	const placeholderCards = Array.from({ length: 12 }, (_, idx) => idx + 1);
</script>

<!-- PC 카테고리별 독립 섹션 (카탈로그 페이지는 상단 옵션바 높이만큼 여백 확보, 마이페이지는 여백 없음) -->
<div
	class="pc-content-section"
	class:has-pinned-control={section.supportsOptions}
	data-section-key={section.key}
	data-section-active={active ? 'true' : 'false'}
>
	{#if section.supportsOptions && filterableKey && contentCtrl && filterState}
		<PcContentFilter
			category={filterableKey}
			open={filterOpen}
			isFollowMode={contentCtrl.isFollowMode}
			{filterState}
			onChange={(next) => contentCtrl.updateCategoryFilter(filterableKey, next)}
		/>
	{/if}

	<main class="pc-content-grid-area">
		{#if detailId !== null}
			<div class="shell-detail-badge">상세 라우트 활성: #{detailId}</div>
		{/if}

		<!-- 4_category 단계에서 각 카테고리 전용 카드/뷰로 교체 예정 -->
		<div class="shell-grid-placeholder">
			{#each placeholderCards as card (card)}
				<div class="shell-card">
					<span class="shell-card-label">{section.label} #{card}</span>
				</div>
			{/each}
		</div>
	</main>
</div>

<style>
	.pc-content-section {
		width: 100%;
		color: var(--fg);
	}

	.pc-content-section.has-pinned-control {
		padding-top: var(--pc-pinned-control-height, 60px);
	}

	.pc-content-grid-area {
		width: 100%;
		max-width: var(--content-max-width);
		margin: 0 auto;
		padding: 0.75rem var(--content-padding-x) 4rem;
		box-sizing: border-box;
	}

	.shell-detail-badge {
		margin-bottom: 1.25rem;
		padding: 0.65rem 0.95rem;
		border-radius: 12px;
		background: var(--surface-2);
		border: var(--thin-border);
		font-size: 0.88rem;
		color: var(--white);
	}

	.shell-grid-placeholder {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
		gap: 1.25rem;
	}

	.shell-card {
		aspect-ratio: 1 / 1.15;
		border-radius: 18px;
		background: var(--surface);
		border: var(--thin-border);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--muted);
		font-size: 0.9rem;
	}
</style>
