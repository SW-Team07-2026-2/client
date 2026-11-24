<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import type { ContentFilterState } from '#lib/common/type/filterOptions';
	import { prefersReducedMotion } from '#lib/common/type/spring';
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
		open: boolean;
		isFollowMode: boolean;
		filterState: ContentFilterState;
		onChange?: (next: ContentFilterState) => void;
	}

	let { category, open, isFollowMode, filterState, onChange }: Props = $props();

	// 팔로우 정렬 파트 우측 확장/축소 애니메이션 + 닫힘 완료 후 언마운트(유휴 캔버스 절약)
	let sortMounted = $state(untrack(() => isFollowMode));
	let sortExpanded = $state(untrack(() => isFollowMode));
	let sortRafId = 0;
	let sortUnmountTimer: ReturnType<typeof setTimeout> | undefined;

	function clearSortTimers() {
		if (sortRafId) {
			cancelAnimationFrame(sortRafId);
			sortRafId = 0;
		}
		clearTimeout(sortUnmountTimer);
		sortUnmountTimer = undefined;
	}

	$effect(() => {
		const follow = isFollowMode;
		untrack(() => {
			clearSortTimers();
			if (prefersReducedMotion()) {
				sortMounted = follow;
				sortExpanded = follow;
				return;
			}
			if (follow) {
				if (!sortMounted) {
					sortMounted = true;
					sortRafId = requestAnimationFrame(() => {
						sortRafId = 0;
						sortExpanded = true;
					});
				} else {
					sortExpanded = true;
				}
			} else {
				sortExpanded = false;
				if (sortMounted) {
					sortUnmountTimer = setTimeout(() => {
						sortUnmountTimer = undefined;
						if (!isFollowMode) sortMounted = false;
					}, 360);
				}
			}
		});
	});

	onDestroy(() => {
		clearSortTimers();
	});

	function patch(partial: Partial<ContentFilterState>) {
		onChange?.({ ...filterState, ...partial });
	}
</script>

{#snippet followSortRail()}
	<div
		class="sort-rail"
		class:is-open={sortExpanded}
		aria-hidden={!sortExpanded || undefined}
		inert={!sortExpanded || undefined}
	>
		<div class="sort-rail-inner">
			{#if sortMounted}
				<SortPart
					items={CATEGORY_FILTER_OPTIONS.followSorts}
					value={filterState.sort}
					paused={!open || !sortExpanded}
					onchange={(sort) => patch({ sort })}
				/>
			{/if}
		</div>
	</div>
{/snippet}

<!-- PC 콘텐츠 필터 드로어: 카테고리별 맞춤형 그리드 + 우측 팔로우 정렬 확장 애니메이션 -->
<div
	class="pc-filter-drawer"
	class:is-open={open}
	aria-hidden={!open || undefined}
	inert={!open || undefined}
>
	<div class="pc-filter-drawer-inner">
		<section class="pc-filter-panel" aria-label="필터 옵션">
			{#if category === 'artist'}
				<!-- 아티스트: 좌(상: 성별 50% | 형태 50%, 하: 장르 100%) / 우(팔로우 정렬) -->
				<div class="split-with-sort" class:has-sort={sortExpanded}>
					<div class="col-stack">
						<div class="row-equal">
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
						</div>
						<FilterChipPart
							title="장르"
							items={CATEGORY_FILTER_OPTIONS.genres}
							selected={filterState.genres}
							onchange={(genres) => patch({ genres })}
						/>
					</div>

					{@render followSortRail()}
				</div>
			{:else if category === 'concert'}
				<!-- 공연: 상[좌(상: 예매상태 | 공연유형, 하: 지역) / 우(팔로우 정렬 작게)] + 하(장르 100%) -->
				<div class="col-stack">
					<div class="split-with-sort is-compact-sort" class:has-sort={sortExpanded}>
						<div class="col-stack">
							<div class="row-equal">
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
							</div>
							<FilterChipPart
								title="지역"
								items={CATEGORY_FILTER_OPTIONS.concertRegions}
								selected={filterState.regions}
								onchange={(regions) => patch({ regions })}
							/>
						</div>

						{@render followSortRail()}
					</div>

					<FilterChipPart
						title="장르"
						items={CATEGORY_FILTER_OPTIONS.genres}
						selected={filterState.genres}
						onchange={(genres) => patch({ genres })}
					/>
				</div>
			{:else if category === 'album'}
				<!-- 앨범: 좌(상: 형태 < 가격대, 하: 품절 제외) / 우(팔로우 정렬) -->
				<div class="split-with-sort" class:has-sort={sortExpanded}>
					<div class="col-stack">
						<div class="row-album-top">
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
						</div>
						<FilterTogglePart
							title="품절 제외"
							description="판매중인 앨범만 보기"
							checked={filterState.excludeSoldOut}
							onchange={(excludeSoldOut) => patch({ excludeSoldOut })}
						/>
					</div>

					{@render followSortRail()}
				</div>
			{:else}
				<!-- 굿즈: 좌(상: 종류 50% | 가격대 50%, 하: 품절 제외) / 우(팔로우 정렬) -->
				<div class="split-with-sort" class:has-sort={sortExpanded}>
					<div class="col-stack">
						<div class="row-equal">
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
						</div>
						<FilterTogglePart
							title="품절 제외"
							description="판매중인 굿즈만 보기"
							checked={filterState.excludeSoldOut}
							onchange={(excludeSoldOut) => patch({ excludeSoldOut })}
						/>
					</div>

					{@render followSortRail()}
				</div>
			{/if}
		</section>
	</div>
</div>

<style>
	.pc-filter-drawer {
		display: grid;
		grid-template-rows: 0fr;
		opacity: 0;
		transition:
			grid-template-rows 0.34s cubic-bezier(0.22, 1, 0.36, 1),
			opacity 0.24s ease;
		width: 100%;
		max-width: var(--content-max-width);
		margin: 0 auto;
		padding: 0 var(--content-padding-x);
		box-sizing: border-box;
	}

	.pc-filter-drawer.is-open {
		grid-template-rows: 1fr;
		opacity: 1;
	}

	.pc-filter-drawer-inner {
		overflow: hidden;
		min-height: 0;
	}

	.pc-filter-panel {
		container-type: inline-size;
		container-name: pc-filter;
		margin-bottom: 1.25rem;
		padding: 0.25rem 0 0;
	}

	/* 공통 세로 스택 및 가로 분할 행 */
	.col-stack {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		min-width: 0;
	}

	.row-equal {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.85rem;
		align-items: stretch;
		min-width: 0;
	}

	.row-album-top {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1.55fr);
		gap: 0.85rem;
		align-items: stretch;
		min-width: 0;
	}

	/* 좌측 메인 영역 + 우측 팔로우 정렬 확장 레일 */
	.split-with-sort {
		--sort-col-width: 214px;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 0px;
		column-gap: 0;
		align-items: stretch;
		min-width: 0;
		transition:
			grid-template-columns 0.34s cubic-bezier(0.22, 1, 0.36, 1),
			column-gap 0.34s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.split-with-sort.is-compact-sort {
		--sort-col-width: 196px;
	}

	.split-with-sort.has-sort {
		grid-template-columns: minmax(0, 1fr) var(--sort-col-width);
		column-gap: 0.85rem;
	}

	.sort-rail {
		overflow: hidden;
		min-width: 0;
		min-height: 0;
		display: flex;
		align-items: stretch;
	}

	.sort-rail-inner {
		width: var(--sort-col-width);
		flex-shrink: 0;
		display: flex;
		align-items: stretch;
		opacity: 0;
		transform: translateX(14px);
		transition:
			opacity 0.24s ease,
			transform 0.34s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.sort-rail.is-open .sort-rail-inner {
		opacity: 1;
		transform: translateX(0);
	}

	/* 중간 폭(<= 859px): 좌측 2단 행은 유지하되 팔로우 정렬만 하단으로 내려 부드럽게 펼침 */
	@container pc-filter (max-width: 859px) {
		.split-with-sort,
		.split-with-sort.is-compact-sort {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto 0fr;
			column-gap: 0;
			row-gap: 0;
			transition:
				grid-template-rows 0.34s cubic-bezier(0.22, 1, 0.36, 1),
				row-gap 0.34s cubic-bezier(0.22, 1, 0.36, 1);
		}

		.split-with-sort.has-sort,
		.split-with-sort.is-compact-sort.has-sort {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto 1fr;
			column-gap: 0;
			row-gap: 0.85rem;
		}

		.sort-rail-inner {
			width: 100%;
			transform: translateY(-6px);
		}

		.sort-rail.is-open .sort-rail-inner {
			transform: translateY(0);
		}
	}

	/* 좁은 폭(<= 639px): 모든 2단 분할 행을 1단 스택으로 전환해 칩/가격 슬라이더 가독성 유지 */
	@container pc-filter (max-width: 639px) {
		.row-equal,
		.row-album-top {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
