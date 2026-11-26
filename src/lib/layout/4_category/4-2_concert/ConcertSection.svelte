<script lang="ts">
	import { isMobile } from '#lib/common/logic';
	import type { MainSectionDescriptor } from '../../2_main_section/logic/sectionRegistry';
	import CatalogFeedView from '../_shared/design/CatalogFeedView.svelte';
	import { prefetchDetailApi, prefetchDetailImage } from '../_shared/logic/detailPrefetch';
	import { ConcertCategoryController } from './logic/concertCategory.svelte';
	import ConcertCalendarView from './design/ConcertCalendarView.svelte';
	import MbConcertItem from './design/MbConcertItem.svelte';
	import MbConcertSkeleton from './design/MbConcertSkeleton.svelte';
	import PcConcertItem from './design/PcConcertItem.svelte';
	import PcConcertSkeleton from './design/PcConcertSkeleton.svelte';

	interface Props {
		section: MainSectionDescriptor;
		active: boolean;
	}

	const PC_SKELETON_INDICES = Array.from({ length: 12 }, (_, i) => i);
	const MB_SKELETON_INDICES = Array.from({ length: 8 }, (_, i) => i);

	let { section, active }: Props = $props();

	const controller = new ConcertCategoryController();
	const mobile = $derived(isMobile.current);

	$effect(() => {
		controller.sync(active);
	});
</script>

<!-- 4-2_concert 목록 섹션: 목록 그리드(CatalogFeedView) <-> 월별 달력 뷰 전환 -->
<div class="concert-section" data-category="concert" data-active={active ? 'true' : 'false'}>
	<div class="concert-mode-bar" role="tablist" aria-label="공연 보기 방식">
		<button
			type="button"
			role="tab"
			class="concert-mode-btn"
			class:is-active={controller.viewMode === 'grid'}
			aria-selected={controller.viewMode === 'grid'}
			onclick={() => controller.setViewMode('grid')}
		>
			목록 보기
		</button>
		<button
			type="button"
			role="tab"
			class="concert-mode-btn"
			class:is-active={controller.viewMode === 'calendar'}
			aria-selected={controller.viewMode === 'calendar'}
			onclick={() => controller.setViewMode('calendar')}
		>
			달력 보기
		</button>
	</div>

	{#if controller.viewMode === 'grid'}
		<CatalogFeedView
			category="concert"
			label={section.label}
			{active}
			feed={controller.feed}
			emptyTitle={controller.emptyTitle}
			emptyDescription={controller.emptyDescription}
		>
			{#snippet content({ interactive })}
				<div class="concert-grid" class:is-mobile={mobile} class:is-pc={!mobile}>
					{#each controller.feed.items as concert (concert.id)}
						<div
							class="feed-card-slot"
							role="presentation"
							onpointerenter={(e) => {
								if (e.pointerType !== 'mouse') return;
								prefetchDetailApi(`/api/concerts/${concert.id}`);
								prefetchDetailImage(concert.posterUrl);
							}}
							ontouchstart={() => {
								prefetchDetailApi(`/api/concerts/${concert.id}`);
								prefetchDetailImage(concert.posterUrl);
							}}
						>
							{#if mobile}
								<MbConcertItem {concert} {interactive} onSelect={controller.selectConcert} />
							{:else}
								<PcConcertItem {concert} {interactive} onSelect={controller.selectConcert} />
							{/if}
						</div>
					{/each}
				</div>
			{/snippet}

			{#snippet skeleton()}
				<div class="concert-grid" class:is-mobile={mobile} class:is-pc={!mobile}>
					{#if mobile}
						{#each MB_SKELETON_INDICES as idx (idx)}
							<MbConcertSkeleton index={idx} />
						{/each}
					{:else}
						{#each PC_SKELETON_INDICES as idx (idx)}
							<PcConcertSkeleton index={idx} />
						{/each}
					{/if}
				</div>
			{/snippet}
		</CatalogFeedView>
	{:else}
		<ConcertCalendarView
			month={controller.calendarMonth}
			days={controller.calendarDays}
			loading={controller.calendarLoading}
			errorMessage={controller.calendarError}
			selectedDate={controller.selectedCalendarDate}
			onStepMonth={controller.stepCalendarMonth}
			onSelectDate={controller.selectCalendarDate}
			onSelectConcert={controller.selectConcert}
		/>
	{/if}
</div>

<style>
	.concert-section {
		width: 100%;
	}

	.concert-mode-bar {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.24rem;
		margin-bottom: 1.15rem;
		border-radius: 999px;
		background: var(--surface);
	}

	.concert-mode-btn {
		height: 32px;
		padding: 0 0.9rem;
		border: none;
		border-radius: 999px;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 0.82rem;
		font-weight: var(--fw-medium);
		cursor: pointer;
		transition:
			background-color 0.18s ease,
			color 0.18s ease;
	}

	.concert-mode-btn.is-active {
		background: var(--white-2);
		color: var(--bg);
		font-weight: var(--fw-semibold);
	}

	.concert-grid {
		display: grid;
		width: 100%;
		align-items: start;
	}

	.concert-grid.is-pc {
		grid-template-columns: repeat(auto-fill, minmax(var(--pc-catalog-card-min-width, 180px), 1fr));
		column-gap: var(--pc-catalog-column-gap, 1.85rem);
		row-gap: 2.35rem;
	}

	.concert-grid.is-mobile {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		column-gap: 0.85rem;
		row-gap: 1.65rem;
	}

	.feed-card-slot {
		min-width: 0;
	}
</style>
