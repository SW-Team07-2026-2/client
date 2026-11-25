<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { getMainSectionContext } from '../2_main_section/logic/context';
	import type { MainSectionDescriptor } from '../2_main_section/logic/sectionRegistry';
	import { CategoryDetailView, CategoryView } from '../4_category';
	import {
		getContentSectionContext,
		isFilterableCategory
	} from './logic/contentSection.svelte';
	import { syncDetailListFade } from './logic/detailTransition';
	import { DetailStageController } from './logic/detailStage.svelte';
	import PcContentFilter from './design/PcContentFilter.svelte';
	import PcDetailFrame from './design/PcDetailFrame.svelte';

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

	const initialCat = untrack(() => (isFilterableCategory(section.key) ? section.key : null));
	const detailCtrl = initialCat ? new DetailStageController(initialCat) : null;

	let listAreaEl = $state<HTMLDivElement | null>(null);
	let listFadeAnim: Animation | null = null;

	const isSliding = $derived(mainSectionCtx?.isSlidingOrSwiping() ?? false);
	const isDetailSettledOpen = $derived(detailCtrl?.phase === 'open');

	$effect.pre(() => {
		detailCtrl?.sync(active, detailId, false, isSliding);
	});

	$effect(() => {
		if (!detailCtrl) return;
		listFadeAnim = syncDetailListFade(listAreaEl, detailCtrl.phase, listFadeAnim);
	});

	$effect(() => {
		return detailCtrl?.attachKeydown(active);
	});

	onDestroy(() => {
		listFadeAnim?.cancel();
		detailCtrl?.destroy();
	});
</script>

<!-- PC 콘텐츠 섹션: [목록 영역(필터 + 여백 그리드)] <-> [상세 영역(PcDetailFrame)] 전환 전담 -->
<div
	class="pc-content-section"
	data-section-key={section.key}
	data-section-active={active ? 'true' : 'false'}
>
	<div
		bind:this={listAreaEl}
		class="pc-content-list-area"
		class:has-pinned-control={section.supportsOptions}
		class:is-hidden={isDetailSettledOpen}
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
			<CategoryView {section} {active} />
		</main>
	</div>

	{#if detailCtrl && filterableKey && detailCtrl.isVisible && detailCtrl.renderId !== null}
		<PcDetailFrame
			itemId={detailCtrl.renderId}
			phase={detailCtrl.phase}
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
		</PcDetailFrame>
	{/if}
</div>

<style>
	.pc-content-section {
		width: 100%;
		color: var(--fg);
	}

	.pc-content-list-area {
		width: 100%;
		will-change: opacity;
	}

	.pc-content-list-area.has-pinned-control {
		padding-top: var(--pc-pinned-control-height, 60px);
	}

	.pc-content-list-area.is-hidden {
		display: none;
	}

	.pc-content-grid-area {
		width: 100%;
		max-width: var(--content-max-width);
		margin: 0 auto;
		padding: 0.75rem var(--content-padding-x) 4rem;
		box-sizing: border-box;
	}
</style>
