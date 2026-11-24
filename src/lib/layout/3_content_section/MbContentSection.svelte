<script lang="ts">
	import type { MainSectionDescriptor } from '../2_main_section/logic/sectionRegistry';
	import {
		getContentSectionContext,
		isFilterableCategory
	} from './logic/contentSection.svelte';
	import MbContentHeader from './design/MbContentHeader.svelte';
	import MbContentControl from './design/MbContentControl.svelte';
	import MbContentFilter from './design/MbContentFilter.svelte';

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
	const activeFilterCount = $derived(contentCtrl?.getActiveFilterCount(section.key) ?? 0);
	const hasActiveFilters = $derived(activeFilterCount > 0);

	const placeholderCards = Array.from({ length: 12 }, (_, idx) => idx + 1);
</script>

<!-- 모바일 카테고리별 완전 독립 섹션 (상단 옵션바 + 제어센터형 필터 + 플로팅바 + 정렬 영역을 각자 독립 소유) -->
<div
	class="mb-content-section"
	data-section-key={section.key}
	data-section-active={active ? 'true' : 'false'}
>
	{#if section.supportsOptions && filterableKey && contentCtrl}
		<MbContentHeader
			searchQuery={contentCtrl.searchQuery}
			searchPlaceholder={section.searchPlaceholder}
			{filterOpen}
			{activeFilterCount}
			onSearchChange={contentCtrl.setSearchQuery}
			onSearchSubmit={contentCtrl.submitSearch}
			onFilterToggle={() => contentCtrl.toggleFilter(filterableKey)}
		/>
	{:else}
		<header class="mb-mypage-heading">
			<h1>{section.title}</h1>
			<p>{section.description}</p>
		</header>
	{/if}

	{#if detailId !== null}
		<div class="shell-detail-badge">상세 라우트 활성: #{detailId}</div>
	{/if}

	<!-- 4_category 단계에서 각 카테고리 전용 카드/뷰로 교체 예정 -->
	<div class="shell-grid-placeholder">
		{#each placeholderCards as card (card)}
			<div class="shell-card">
				<span>{section.label} #{card}</span>
			</div>
		{/each}
	</div>

	{#if section.supportsOptions && filterableKey && contentCtrl && filterState}
		<MbContentControl
			visible={active && detailId === null}
			feedMode={contentCtrl.feedMode}
			onFeedChange={(val) => contentCtrl.setFeedMode(val)}
			onRefresh={contentCtrl.triggerRefresh}
		/>

		<MbContentFilter
			category={filterableKey}
			title={section.label}
			open={active && filterOpen}
			isFollowMode={contentCtrl.isFollowMode}
			{hasActiveFilters}
			{filterState}
			onChange={(next) => contentCtrl.updateCategoryFilter(filterableKey, next)}
			onReset={() => contentCtrl.resetCategoryFilter(filterableKey)}
			onClose={() => contentCtrl.setFilterOpen(filterableKey, false)}
		/>
	{/if}
</div>

<style>
	.mb-content-section {
		width: 100%;
		padding: 0.9rem var(--content-padding-x-mobile) 2.5rem;
		box-sizing: border-box;
		color: var(--fg);
	}

	.mb-mypage-heading {
		margin-bottom: 1rem;
	}

	.mb-mypage-heading h1 {
		margin: 0;
		font-size: 1.45rem;
		font-weight: 700;
		color: var(--white);
	}

	.mb-mypage-heading p {
		margin: 0.3rem 0 0;
		font-size: 0.85rem;
		color: var(--muted);
	}

	.shell-detail-badge {
		margin-bottom: 1rem;
		padding: 0.6rem 0.85rem;
		border-radius: 12px;
		background: var(--surface-2);
		border: var(--thin-border);
		font-size: 0.84rem;
		color: var(--white);
	}

	.shell-grid-placeholder {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.9rem;
	}

	.shell-card {
		aspect-ratio: 1 / 1.15;
		border-radius: 16px;
		background: var(--surface);
		border: var(--thin-border);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--muted);
		font-size: 0.85rem;
	}
</style>
