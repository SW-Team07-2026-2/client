<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { getMainSectionContext } from '../2_main_section/logic/context';
	import type { MainSectionDescriptor } from '../2_main_section/logic/sectionRegistry';
	import { CategoryDetailView, CategoryView } from '../4_category';
	import {
		getContentSectionContext,
		isFilterableCategory
	} from './logic/contentSection.svelte';
	import { syncDetailListFade } from './logic/detailTransition';
	import { DetailStageController } from './logic/detailStage.svelte';
	import MbContentFilter from './design/MbContentFilter.svelte';
	import MbDetailFrame from './design/MbDetailFrame.svelte';

	interface Props {
		section: MainSectionDescriptor;
		active: boolean;
		detailId?: number | null;
	}

	let { section, active, detailId = null }: Props = $props();

	const mainSectionCtx = getMainSectionContext();
	const contentCtrl = getContentSectionContext();
	const filterableKey = $derived(isFilterableCategory(section.key) ? section.key : null);
	const filterState = $derived(contentCtrl?.getFilterState(section.key));
	const filterOpen = $derived(contentCtrl?.isFilterOpen(section.key) ?? false);
	const hasActiveFilters = $derived(contentCtrl?.hasActiveFilters(section.key) ?? false);

	const initialCat = untrack(() => (isFilterableCategory(section.key) ? section.key : null));
	const detailCtrl = initialCat ? new DetailStageController(initialCat, true) : null;

	let listAreaEl = $state<HTMLDivElement | null>(null);
	let listFadeAnim: Animation | null = null;

	const isSliding = $derived(mainSectionCtx?.isSlidingOrSwiping() ?? false);
	const listScrollY = $derived(mainSectionCtx?.getSectionListScrollY(section.key) ?? 0);
	let detailShellReady = $state(false);

	onMount(() => {
		const timer = setTimeout(() => {
			detailShellReady = true;
		}, 250);
		return () => clearTimeout(timer);
	});

	$effect.pre(() => {
		detailCtrl?.sync(active, detailId, true, isSliding);
	});

	$effect(() => {
		if (!detailCtrl) return;
		listFadeAnim = syncDetailListFade(listAreaEl, detailCtrl.phase, listFadeAnim);
	});

	onDestroy(() => {
		listFadeAnim?.cancel();
		detailCtrl?.destroy();
	});
</script>

<!-- 모바일 콘텐츠 섹션: [목록 영역 + 제어센터 필터] <-> [상세 영역(MbDetailFrame)] 전환 전담 -->
<div
	class="mb-content-section"
	data-section-key={section.key}
	data-section-active={active ? 'true' : 'false'}
>
	<div
		bind:this={listAreaEl}
		class="mb-content-list-area"
		class:has-pinned-control={section.supportsOptions}
	>
		<CategoryView {section} {active} />
	</div>

	{#if section.supportsOptions && filterableKey && contentCtrl && filterState}
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

	{#if detailCtrl && filterableKey && (detailShellReady || (detailCtrl.isVisible && detailCtrl.renderId !== null))}
		{@const currentDetailId = detailCtrl.isVisible ? detailCtrl.renderId : null}
		<MbDetailFrame
			itemId={currentDetailId}
			phase={detailCtrl.phase}
			{active}
			sliding={isSliding}
			{listScrollY}
			savedScrollTop={currentDetailId !== null ? detailCtrl.getScrollTop(currentDetailId) : 0}
			onScrollChange={(top) => {
				if (currentDetailId !== null) detailCtrl.saveScrollTop(currentDetailId, top);
			}}
			onExpandFinish={detailCtrl.finishExpand}
			onCloseFinish={detailCtrl.finishClose}
			onClose={detailCtrl.close}
		>
			{#snippet children({ id, close, mobile })}
				<CategoryDetailView
					category={filterableKey}
					{id}
					onClose={close}
					backLabel={detailCtrl.backLabel}
					{mobile}
				/>
			{/snippet}
		</MbDetailFrame>
	{/if}
</div>

<style>
	.mb-content-section {
		width: 100%;
		color: var(--fg);
	}

	.mb-content-list-area {
		width: 100%;
		padding: 0.9rem var(--content-padding-x-mobile) 2.5rem;
		box-sizing: border-box;
		will-change: opacity;
	}

	.mb-content-list-area.has-pinned-control {
		padding-top: var(--pc-pinned-control-height, 72px);
	}
</style>
