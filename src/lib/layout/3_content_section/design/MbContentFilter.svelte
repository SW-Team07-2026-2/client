<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import type { ContentFilterState } from '#lib/common/type/filterOptions';
	import FilterChipPart from '../part/filter_part/FilterChipPart.svelte';
	import FilterTogglePart from '../part/filter_part/FilterTogglePart.svelte';
	import PriceRangePart from '../part/filter_part/PriceRangePart.svelte';
	import SortPart from '../part/filter_part/SortPart.svelte';
	import {
		CATEGORY_FILTER_OPTIONS,
		type FilterableCategoryKey
	} from '../logic/contentSection.svelte';

	interface Props {
		category: FilterableCategoryKey;
		title: string;
		open: boolean;
		isFollowMode: boolean;
		hasActiveFilters: boolean;
		filterState: ContentFilterState;
		onChange?: (next: ContentFilterState) => void;
		onReset?: () => void;
		onClose?: () => void;
	}

	let {
		category,
		title,
		open,
		isFollowMode,
		hasActiveFilters,
		filterState,
		onChange,
		onReset,
		onClose
	}: Props = $props();

	function patch(partial: Partial<ContentFilterState>) {
		onChange?.({ ...filterState, ...partial });
	}
</script>

<!-- 모바일 제어센터형 대형 필터 오버레이 (순수 렌더링) -->
{#if open}
	<div
		class="mb-filter-backdrop"
		role="presentation"
		onclick={() => onClose?.()}
		transition:fade={{ duration: 200 }}
	></div>

	<div
		class="mb-filter-center"
		role="dialog"
		aria-modal="true"
		aria-label="{title} 필터"
		transition:scale={{ start: 0.94, duration: 240, easing: cubicOut }}
	>
		<header class="mb-filter-header">
			<h2 class="mb-filter-title">{title} 필터</h2>
			<div class="mb-filter-actions">
				{#if hasActiveFilters}
					<button type="button" class="mb-filter-reset-btn" onclick={() => onReset?.()}>
						초기화
					</button>
				{/if}
				<button
					type="button"
					class="mb-filter-close-btn"
					onclick={() => onClose?.()}
					aria-label="필터 닫기"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</header>

		<div class="mb-filter-body">
			{#if category === 'artist'}
				<FilterChipPart
					title="장르"
					items={CATEGORY_FILTER_OPTIONS.genres}
					selected={filterState.genres}
					onchange={(genres) => patch({ genres })}
				/>
				<FilterChipPart
					title="성별"
					items={CATEGORY_FILTER_OPTIONS.artistGenders}
					selected={filterState.artistGenders}
					onchange={(artistGenders) => patch({ artistGenders })}
				/>
				<FilterChipPart
					title="형태"
					items={CATEGORY_FILTER_OPTIONS.artistTypes}
					selected={filterState.artistTypes}
					onchange={(artistTypes) => patch({ artistTypes })}
				/>
			{:else if category === 'concert'}
				<FilterChipPart
					title="장르"
					items={CATEGORY_FILTER_OPTIONS.genres}
					selected={filterState.genres}
					onchange={(genres) => patch({ genres })}
				/>
				<FilterChipPart
					title="지역"
					items={CATEGORY_FILTER_OPTIONS.concertRegions}
					selected={filterState.regions}
					onchange={(regions) => patch({ regions })}
				/>
				<FilterChipPart
					title="예매 상태"
					items={CATEGORY_FILTER_OPTIONS.concertStatuses}
					selected={filterState.statuses}
					onchange={(statuses) => patch({ statuses })}
				/>
				<FilterChipPart
					title="공연 유형"
					items={CATEGORY_FILTER_OPTIONS.concertTypes}
					selected={filterState.concertTypes}
					onchange={(concertTypes) => patch({ concertTypes })}
				/>
			{:else if category === 'album'}
				<FilterChipPart
					title="형태"
					items={CATEGORY_FILTER_OPTIONS.albumForms}
					selected={filterState.forms}
					onchange={(forms) => patch({ forms })}
				/>
				<PriceRangePart
					value={filterState.priceRange}
					onchange={(priceRange) => patch({ priceRange })}
				/>
				<FilterTogglePart
					title="품절 제외"
					description="판매중인 앨범만 보기"
					checked={filterState.excludeSoldOut}
					onchange={(excludeSoldOut) => patch({ excludeSoldOut })}
				/>
			{:else}
				<FilterChipPart
					title="종류"
					items={CATEGORY_FILTER_OPTIONS.goodsForms}
					selected={filterState.forms}
					onchange={(forms) => patch({ forms })}
				/>
				<PriceRangePart
					value={filterState.priceRange}
					onchange={(priceRange) => patch({ priceRange })}
				/>
				<FilterTogglePart
					title="품절 제외"
					description="판매중인 굿즈만 보기"
					checked={filterState.excludeSoldOut}
					onchange={(excludeSoldOut) => patch({ excludeSoldOut })}
				/>
			{/if}

			{#if isFollowMode}
				<SortPart
					items={CATEGORY_FILTER_OPTIONS.followSorts}
					value={filterState.sort}
					onchange={(sort) => patch({ sort })}
				/>
			{/if}
		</div>

		<footer class="mb-filter-footer">
			<button type="button" class="mb-filter-apply-btn" onclick={() => onClose?.()}>
				적용하기
			</button>
		</footer>
	</div>
{/if}

<style>
	.mb-filter-backdrop {
		position: fixed;
		inset: 0;
		z-index: 64;
		background: color-mix(in srgb, var(--bg) 62%, transparent);
		-webkit-backdrop-filter: blur(12px);
		backdrop-filter: blur(12px);
	}

	.mb-filter-center {
		position: fixed;
		inset: calc(18px + env(safe-area-inset-top, 0px)) 14px
			calc(18px + env(safe-area-inset-bottom, 0px)) 14px;
		z-index: 65;
		border-radius: 26px;
		background: var(--glass-bg);
		-webkit-backdrop-filter: var(--glass-filter);
		backdrop-filter: var(--glass-filter);
		border: var(--thin-border);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		color: var(--fg);
	}

	.mb-filter-header {
		flex-shrink: 0;
		padding: 1rem 1.15rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: var(--thin-border);
	}

	.mb-filter-title {
		margin: 0;
		font-size: 1.02rem;
		font-weight: 700;
		color: var(--white);
	}

	.mb-filter-actions {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.mb-filter-reset-btn {
		padding: 0.35rem 0.7rem;
		border-radius: 999px;
		border: var(--thin-border);
		background: var(--surface);
		color: var(--fg);
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
	}

	.mb-filter-close-btn {
		width: 34px;
		height: 34px;
		padding: 0;
		border: none;
		border-radius: 999px;
		background: transparent;
		color: var(--white);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	.mb-filter-close-btn svg {
		width: 20px;
		height: 20px;
	}

	.mb-filter-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 1rem 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		overscroll-behavior: contain;
	}

	.mb-filter-footer {
		flex-shrink: 0;
		padding: 0.85rem 1.1rem;
		border-top: var(--thin-border);
	}

	.mb-filter-apply-btn {
		width: 100%;
		height: 44px;
		border: none;
		border-radius: 999px;
		background: var(--white);
		color: var(--bg);
		font-size: 0.92rem;
		font-weight: 600;
		cursor: pointer;
	}
</style>
