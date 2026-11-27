<script lang="ts">
	import { fade } from 'svelte/transition';
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
		hasActiveFilters,
		filterState,
		onChange,
		onReset
	}: Props = $props();

	function patch(partial: Partial<ContentFilterState>) {
		onChange?.({ ...filterState, ...partial });
	}
</script>

<!-- 모바일 풀폭 블러 필터 오버레이 (MbHeader 바로 아래 · 좌우하 여백/border/radius 없음 · 상단 우측 초기화 버튼, 순수 렌더링) -->
{#if open}
	<div
		class="mb-filter-overlay"
		role="dialog"
		aria-modal="true"
		aria-label="{title} 필터"
		transition:fade={{ duration: 200 }}
	>
		<!-- 상단 바: 좌측은 MbContentHeader의 X 필터 버튼이 그대로 노출되고, 우측 같은 높이에 초기화 버튼 배치 -->
		<header class="mb-filter-top-bar">
			{#if hasActiveFilters}
				<button
					type="button"
					class="mb-filter-reset-btn"
					onclick={() => onReset?.()}
					transition:fade={{ duration: 150 }}
				>
					초기화
				</button>
			{/if}
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
					showAll={false}
					items={CATEGORY_FILTER_OPTIONS.concertStatuses}
					selected={filterState.statuses.filter((s) => s !== 'CLOSED')}
					onchange={(active) =>
						patch({
							statuses: filterState.statuses.includes('CLOSED')
								? [...active, 'CLOSED']
								: active
						})}
				>
					{#snippet footer()}
						<FilterTogglePart
							embedded
							title="종료된 공연 포함"
							description="판매종료된 지난 공연도 함께 보기"
							checked={filterState.statuses.includes('CLOSED')}
							onchange={(includeClosed) => {
								const active = filterState.statuses.filter((s) => s !== 'CLOSED');
								patch({ statuses: includeClosed ? [...active, 'CLOSED'] : active });
							}}
						/>
					{/snippet}
				</FilterChipPart>
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

			<SortPart
				title="팔로우 정렬"
				items={CATEGORY_FILTER_OPTIONS.followSorts}
				value={filterState.sort}
				onchange={(sort) => patch({ sort })}
			/>
		</div>
	</div>
{/if}

<style>
	.mb-filter-overlay {
		position: fixed;
		top: 60px;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 55;
		background: var(--glass-bg);
		-webkit-backdrop-filter: var(--glass-filter);
		backdrop-filter: var(--glass-filter);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		color: var(--fg);
	}

	/* MbContentHeader와 동일한 패딩·높이(42px)로 맞춰 초기화 버튼이 필터 X 버튼과 같은 줄에 정렬 */
	.mb-filter-top-bar {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		min-height: 42px;
		padding: 0.55rem var(--content-padding-x-mobile) 0.7rem;
		box-sizing: content-box;
	}

	.mb-filter-reset-btn {
		height: 36px;
		padding: 0 0.85rem;
		border-radius: 999px;
		border: none;
		background: var(--surface);
		color: var(--fg);
		font: inherit;
		font-size: 0.82rem;
		font-weight: var(--fw-semibold);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		transition:
			background-color 0.16s ease,
			color 0.16s ease,
			transform 0.14s ease;
	}

	.mb-filter-reset-btn:active {
		transform: scale(0.95);
		background: var(--surface-2);
		color: var(--white);
	}

	.mb-filter-body {
		flex: 1;
		min-height: 0;
		width: 100%;
		overflow-x: hidden;
		overflow-y: auto;
		padding: 0.25rem var(--content-padding-x-mobile)
			calc(1.5rem + env(safe-area-inset-bottom, 0px));
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		overscroll-behavior: contain;
	}
</style>
