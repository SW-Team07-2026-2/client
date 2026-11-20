<script lang="ts">
	import { onDestroy, onMount, tick, untrack, type Snippet } from 'svelte';
	import {
		ALBUM_FORM_OPTIONS,
		ARTIST_GENDER_OPTIONS,
		ARTIST_TYPE_OPTIONS,
		CONCERT_REGION_OPTIONS,
		CONCERT_STATUS_OPTIONS,
		CONCERT_TYPE_OPTIONS,
		DEFAULT_FOLLOW_SORT,
		FOLLOW_SORT_OPTIONS,
		GOODS_FORM_OPTIONS,
		clearSavedCategoryFilter,
		countActiveFilters,
		createDefaultFilterState,
		createEmptyFilterSlice,
		getSavedCategorySlice,
		getSavedFollowSort,
		saveCategoryFilter,
		saveFollowSort,
		type CategoryFilterSlice,
		type ContentFilterState,
		type FilterOption
	} from '#lib/config/filter';
	import { GENRES } from '#lib/config/genre';
	import { createSpring, createSpringLoop, prefersReducedMotion } from '#lib/fluid';
	import { isMobile } from '#lib/stores';
	import {
		DIRECTIONAL_BLUR_MOTION,
		resolveSlideDirection,
		type SlideDirection
	} from '#lib/utils/directionalBlur';
	import FilterChipPart from './FilterChipPart.svelte';
	import FilterTogglePart from './FilterTogglePart.svelte';
	import PriceRangePart from './PriceRangePart.svelte';
	import SortPart from './SortPart.svelte';

	const BASE_CATEGORIES = ['Artist', 'Concert', 'Album', 'Merchandise'] as const;
	type PaneCategory = (typeof BASE_CATEGORIES)[number];

	function toPaneKey(cat: string): PaneCategory {
		return cat === 'Concert' || cat === 'Album' || cat === 'Merchandise' ? cat : 'Artist';
	}

	function extractSlice(state: ContentFilterState): CategoryFilterSlice {
		return {
			genres: [...state.genres],
			artistGenders: [...(state.artistGenders ?? [])],
			artistTypes: [...(state.artistTypes ?? [])],
			regions: [...state.regions],
			statuses: [...state.statuses],
			concertTypes: [...state.concertTypes],
			forms: [...state.forms],
			priceRange: state.priceRange ? [state.priceRange[0], state.priceRange[1]] : null,
			excludeSoldOut: Boolean(state.excludeSoldOut)
		};
	}

	interface Props {
		/** 현재 카테고리 ('Artist' | 'Concert' | 'Album' | 'Merchandise' 등) */
		category?: string;
		/** 현재 피드 세그먼트 ('recommend' | 'popular' | 'follow') */
		feedMode?: string;
		/** 통합 필터 상태 (양방향 바인딩) */
		filterState?: ContentFilterState;
		/** 장르 필터 다중 선택 허용 여부 */
		multiple?: boolean;
		/** 장르 목록 커스터마이즈 */
		genreItems?: readonly FilterOption[];
		/** 필터 변경 통합 콜백 */
		onchange?: (state: ContentFilterState) => void;
		/** 장르 변경 호환 콜백 */
		onGenreChange?: (genres: string[]) => void;
		/** 전체 필터 초기화 콜백 */
		onreset?: () => void;
		/** 추가 커스텀 필터 파트 슬롯 */
		extraParts?: Snippet;
		/** Keep-Alive 각 카테고리 페이지 내부에 독립 배치할 때 true (자체 카테고리만 마운트하며 전환 높이 애니메이션·타 카테고리 프리워밍 생략) */
		isolatedCategory?: boolean;
		/** 현재 활성화된 패널 여부 (비활성 백그라운드 패널은 height 스프링 없이 즉시 상태 반영) */
		active?: boolean;
		/** 추가 클래스 */
		class?: string;
	}

	let {
		category = 'Artist',
		feedMode = 'recommend',
		filterState = $bindable<ContentFilterState>(createDefaultFilterState()),
		multiple = true,
		genreItems = GENRES,
		onchange,
		onGenreChange,
		onreset,
		extraParts,
		isolatedCategory = false,
		active = true,
		class: klass = ''
	}: Props = $props();

	const mobile = $derived(isMobile.current);
	const isFollowMode = $derived(feedMode === 'follow');
	const activePaneKey = $derived(toPaneKey(category));

	// 카테고리별 독립 상태(각 패널이 자기 상태만 바라보므로 전환 시 가격 슬라이더가 이전 값에서 튀지 않음)
	const initCat = untrack(() => category);
	const initKey = toPaneKey(initCat);
	const initSaved = getSavedCategorySlice(initCat);
	const initSlice = untrack(() =>
		countActiveFilters({ ...initSaved, sort: '' }) === 0 && countActiveFilters(filterState) > 0
			? extractSlice(filterState)
			: initSaved
	);

	let paneStates = $state<Record<PaneCategory, CategoryFilterSlice>>({
		Artist: initKey === 'Artist' ? initSlice : getSavedCategorySlice('Artist'),
		Concert: initKey === 'Concert' ? initSlice : getSavedCategorySlice('Concert'),
		Album: initKey === 'Album' ? initSlice : getSavedCategorySlice('Album'),
		Merchandise: initKey === 'Merchandise' ? initSlice : getSavedCategorySlice('Merchandise')
	});

	// 현재 카테고리만 즉시 마운트하고, 나머지 카테고리는 드로어 오픈 후 유휴 시간에 순차 프리워밍해 보관
	let mountedPanes = $state<Record<PaneCategory, boolean>>({
		Artist: initKey === 'Artist',
		Concert: initKey === 'Concert',
		Album: initKey === 'Album',
		Merchandise: initKey === 'Merchandise'
	});
	let readyPanes = $state<Record<PaneCategory, boolean>>({
		Artist: initKey === 'Artist',
		Concert: initKey === 'Concert',
		Album: initKey === 'Album',
		Merchandise: initKey === 'Merchandise'
	});

	// 비팔로우 모드에서는 SortPart 캔버스/루프를 언마운트해 유휴 리소스 절약
	let sortMounted = $state(untrack(() => feedMode === 'follow'));
	let sortVisualOpen = $state(untrack(() => feedMode === 'follow'));
	let sortOpenRaf = 0;
	let sortFallbackTimer: ReturnType<typeof setTimeout> | undefined;
	let prewarmTimer: ReturnType<typeof setTimeout> | undefined;
	let exitTimer: ReturnType<typeof setTimeout> | undefined;
	let prewarmRafA = 0;
	let prewarmRafB = 0;
	let destroyed = false;

	let navDir = $state<SlideDirection>(1);
	let leavingKey = $state<PaneCategory | null>(null);
	let hasSwitched = $state(false);

	let shellEl = $state<HTMLDivElement | null>(null);
	let measureEl = $state<HTMLDivElement | null>(null);
	let topLayoutEl = $state<HTMLDivElement | null>(null);
	let sortShellEl = $state<HTMLDivElement | null>(null);

	// 단일 임계 감쇠 스프링(오버슈트 없음)으로 영역·상단 행 높이를 동시에 제어
	const topSpring = createSpring(0, 340, 37);
	const totalSpring = createSpring(0, 340, 37);
	let heightAnimating = $state(false);

	function isHorizontalTopLayout(): boolean {
		return typeof window !== 'undefined' && !mobile && window.innerWidth > 960;
	}

	function applySpringHeights() {
		if (topLayoutEl && isHorizontalTopLayout() && topSpring.x > 0) {
			topLayoutEl.style.height = `${topSpring.x.toFixed(2)}px`;
		}
		if (shellEl && totalSpring.x > 0) {
			shellEl.style.height = `${totalSpring.x.toFixed(2)}px`;
		}
	}

	const heightLoop = createSpringLoop({
		springs: [topSpring, totalSpring],
		isSettled: () =>
			Math.abs(topSpring.x - topSpring.t) < 0.2 &&
			Math.abs(topSpring.v) < 0.8 &&
			Math.abs(totalSpring.x - totalSpring.t) < 0.2 &&
			Math.abs(totalSpring.v) < 0.8,
		onFrame: () => applySpringHeights(),
		onSnap: () => {
			heightAnimating = false;
			const shouldUnmountSort = !isFollowMode && sortMounted;
			if (shouldUnmountSort) {
				sortMounted = false;
			}
			// SortPart가 DOM에서 완전히 제거된 다음 auto 높이로 복원해 깜빡임 차단
			void tick().then(() => {
				if (destroyed || heightAnimating) return;
				if (topLayoutEl) topLayoutEl.style.height = '';
				if (shellEl) shellEl.style.height = '';
			});
		}
	});

	function measureTargetHeights(): { topH: number; totalH: number } | null {
		if (!shellEl || !measureEl || !topLayoutEl) return null;

		const horizontal = isHorizontalTopLayout();
		let prevDisplay = '';
		let prevWidth = '';
		let prevMarginLeft = '';

		if (sortShellEl && horizontal) {
			prevDisplay = sortShellEl.style.display;
			prevWidth = sortShellEl.style.width;
			prevMarginLeft = sortShellEl.style.marginLeft;
			sortShellEl.style.transition = 'none';
			if (isFollowMode) {
				sortShellEl.style.display = '';
				sortShellEl.style.width = '248px';
				sortShellEl.style.marginLeft = '0.75rem';
			} else {
				sortShellEl.style.display = 'none';
			}
		}

		topLayoutEl.style.height = 'auto';
		shellEl.style.height = 'auto';
		const topH = topLayoutEl.offsetHeight;
		const totalH = measureEl.offsetHeight;

		if (sortShellEl && horizontal) {
			sortShellEl.style.display = prevDisplay;
			sortShellEl.style.width = prevWidth;
			sortShellEl.style.marginLeft = prevMarginLeft;
			void sortShellEl.offsetWidth;
			sortShellEl.style.transition = '';
		}

		return { topH, totalH };
	}

	function animateHeightsFrom(fromTopH: number, fromTotalH: number) {
		if (destroyed) return;
		if (prefersReducedMotion() || !active) {
			heightLoop.stop();
			heightAnimating = false;
			if (topLayoutEl) topLayoutEl.style.height = '';
			if (shellEl) shellEl.style.height = '';
			sortVisualOpen = isFollowMode;
			if (!isFollowMode) sortMounted = false;
			return;
		}

		const targets = measureTargetHeights();
		if (!targets || targets.totalH <= 0) {
			if (topLayoutEl) topLayoutEl.style.height = '';
			if (shellEl) shellEl.style.height = '';
			return;
		}

		const startTop = heightAnimating ? topSpring.x : fromTopH || targets.topH;
		const startTotal = heightAnimating ? totalSpring.x : fromTotalH || targets.totalH;

		topSpring.x = startTop;
		totalSpring.x = startTotal;
		if (!heightAnimating) {
			topSpring.v = 0;
			totalSpring.v = 0;
		}
		topSpring.t = targets.topH;
		totalSpring.t = targets.totalH;

		const changed =
			(isHorizontalTopLayout() && Math.abs(topSpring.x - topSpring.t) > 0.5) ||
			Math.abs(totalSpring.x - totalSpring.t) > 0.5;

		if (changed) {
			clearTimeout(sortFallbackTimer);
			heightAnimating = true;
			applySpringHeights();
			heightLoop.wake();
		} else {
			if (topLayoutEl) topLayoutEl.style.height = '';
			if (shellEl) shellEl.style.height = '';
			if (!isFollowMode && sortMounted) {
				clearTimeout(sortFallbackTimer);
				sortFallbackTimer = setTimeout(() => {
					if (!destroyed && !isFollowMode && !heightAnimating) {
						sortMounted = false;
					}
				}, 380);
			}
		}
	}

	let prevFollowLayout: boolean | null = null;
	$effect.pre(() => {
		const follow = isFollowMode;
		const firstRun = prevFollowLayout === null;
		const changed = !firstRun && prevFollowLayout !== follow;
		prevFollowLayout = follow;

		clearTimeout(sortFallbackTimer);
		cancelAnimationFrame(sortOpenRaf);

		if (firstRun || !active) {
			heightLoop.stop();
			heightAnimating = false;
			if (topLayoutEl) topLayoutEl.style.height = '';
			if (shellEl) shellEl.style.height = '';
			sortMounted = follow;
			sortVisualOpen = follow;
			return;
		}
		if (!changed) return;

		const fromTopH = heightAnimating ? topSpring.x : (topLayoutEl?.offsetHeight ?? 0);
		const fromTotalH = heightAnimating ? totalSpring.x : (shellEl?.offsetHeight ?? 0);

		if (follow) {
			sortMounted = true;
			void tick().then(() => {
				if (destroyed) return;
				if (isHorizontalTopLayout()) {
					animateHeightsFrom(fromTopH, fromTotalH);
				}
				sortOpenRaf = requestAnimationFrame(() => {
					if (destroyed) return;
					sortVisualOpen = true;
				});
			});
		} else {
			if (isHorizontalTopLayout()) {
				void tick().then(() => {
					if (destroyed) return;
					animateHeightsFrom(fromTopH, fromTotalH);
					sortOpenRaf = requestAnimationFrame(() => {
						if (destroyed) return;
						sortVisualOpen = false;
					});
				});
			} else {
				sortVisualOpen = false;
				if (sortMounted) {
					sortFallbackTimer = setTimeout(() => {
						if (!destroyed && !isFollowMode) sortMounted = false;
					}, 360);
				}
			}
		}
	});

	function prewarmNextCategory() {
		if (destroyed) return;
		const nextCat = BASE_CATEGORIES.find((c) => !mountedPanes[c]);
		if (!nextCat) return;

		mountedPanes[nextCat] = true;
		// 2 프레임 대기해 오프스크린에서 FdDiv 캔버스 레이아웃을 한 번만 완료한 뒤 display:none 으로 전환
		prewarmRafA = requestAnimationFrame(() => {
			if (destroyed) return;
			prewarmRafB = requestAnimationFrame(() => {
				if (destroyed) return;
				readyPanes[nextCat] = true;
				prewarmTimer = setTimeout(prewarmNextCategory, 50);
			});
		});
	}

	onMount(() => {
		saveCategoryFilter(category, paneStates[activePaneKey]);
		if (!isolatedCategory) {
			prewarmTimer = setTimeout(prewarmNextCategory, 360);
		}
	});

	onDestroy(() => {
		destroyed = true;
		heightLoop.stop();
		clearTimeout(sortFallbackTimer);
		clearTimeout(prewarmTimer);
		clearTimeout(exitTimer);
		cancelAnimationFrame(sortOpenRaf);
		cancelAnimationFrame(prewarmRafA);
		cancelAnimationFrame(prewarmRafB);
	});

	// 카테고리 전환 시 패널만 교체하고 해당 카테고리의 독립 상태를 부모 filterState로 반영
	let prevCategory = untrack(() => category);
	$effect.pre(() => {
		const nextCategory = category;
		if (nextCategory === prevCategory) return;
		const leavingCategory = prevCategory;
		prevCategory = nextCategory;
		untrack(() => {
			const fromTopH = heightAnimating ? topSpring.x : (topLayoutEl?.offsetHeight ?? 0);
			const fromTotalH = heightAnimating ? totalSpring.x : (shellEl?.offsetHeight ?? 0);

			void tick().then(() => animateHeightsFrom(fromTopH, fromTotalH));

			const leavingPane = toPaneKey(leavingCategory);
			const nextKey = toPaneKey(nextCategory);
			saveCategoryFilter(leavingCategory, paneStates[leavingPane]);

			navDir = resolveSlideDirection(
				BASE_CATEGORIES.indexOf(leavingPane),
				BASE_CATEGORIES.indexOf(nextKey)
			);
			hasSwitched = true;
			if (leavingPane !== nextKey) {
				leavingKey = leavingPane;
				clearTimeout(exitTimer);
				exitTimer = setTimeout(() => {
					leavingKey = null;
				}, DIRECTIONAL_BLUR_MOTION.exitDuration);
			}

			mountedPanes[nextKey] = true;
			readyPanes[nextKey] = true;

			const nextSlice =
				nextCategory === nextKey ? paneStates[nextKey] : getSavedCategorySlice(nextCategory);
			if (nextCategory !== nextKey) {
				paneStates[nextKey] = nextSlice;
			}

			const genresChanged =
				nextSlice.genres.length !== filterState.genres.length ||
				nextSlice.genres.some((g, i) => g !== filterState.genres[i]);
			const nextState: ContentFilterState = { ...nextSlice, sort: filterState.sort };
			filterState = nextState;
			if (genresChanged) onGenreChange?.([...nextSlice.genres]);
			onchange?.(nextState);
		});
	});

	// 세그먼트 '팔로우' 진입 시 기본 정렬 적용, 일반 세그먼트 복귀 시 초기화
	let prevFollow: boolean | null = null;
	$effect(() => {
		const nextFollow = isFollowMode;
		if (nextFollow === prevFollow) return;
		prevFollow = nextFollow;
		untrack(() => {
			const targetSort = nextFollow
				? filterState.sort || getSavedFollowSort() || DEFAULT_FOLLOW_SORT
				: '';
			if (filterState.sort !== targetSort) {
				filterState = { ...filterState, sort: targetSort };
				onchange?.({ ...filterState });
			}
		});
	});

	function updatePaneField<K extends keyof CategoryFilterSlice>(
		cat: PaneCategory,
		key: K,
		next: CategoryFilterSlice[K]
	) {
		const updatedSlice = { ...paneStates[cat], [key]: next };
		paneStates[cat] = updatedSlice;

		const targetCategory = cat === activePaneKey ? category : cat;
		saveCategoryFilter(targetCategory, updatedSlice);

		if (cat === activePaneKey) {
			const nextState: ContentFilterState = { ...updatedSlice, sort: filterState.sort };
			filterState = nextState;
			if (key === 'genres') onGenreChange?.([...(next as string[])]);
			onchange?.(nextState);
		}
	}

	function updateSort(nextSort: string) {
		saveFollowSort(nextSort);
		const nextState: ContentFilterState = { ...filterState, sort: nextSort };
		filterState = nextState;
		onchange?.(nextState);
	}

	function paneClass(cat: PaneCategory): string {
		if (cat === activePaneKey) return hasSwitched ? 'is-active is-switching' : 'is-active';
		if (cat === leavingKey) return 'is-exiting';
		return readyPanes[cat] ? 'is-hidden' : 'is-prewarming';
	}

	export function resetAll() {
		const empty = createEmptyFilterSlice();
		paneStates[activePaneKey] = empty;
		clearSavedCategoryFilter(category);
		const next: ContentFilterState = { ...empty, sort: filterState.sort };
		filterState = next;
		onGenreChange?.([]);
		onchange?.(next);
		onreset?.();
	}
</script>

{#snippet genrePartFor(cat: PaneCategory)}
	<FilterChipPart
		title="장르"
		class="genre-part"
		items={genreItems}
		selected={paneStates[cat].genres}
		{multiple}
		onchange={(next) => updatePaneField(cat, 'genres', next)}
	/>
{/snippet}

<div
	class="content-filter-section {klass}"
	class:is-mobile={mobile}
	style:--dir-blur-dir={navDir}
	role="region"
	aria-label="{category} 상세 필터"
>
	<div bind:this={shellEl} class="filter-height-shell" class:is-height-animating={heightAnimating}>
		<div bind:this={measureEl} class="filter-measure-inner">
			<!-- 팔로우 정렬은 카테고리 전환 시에도 파괴/재마운트 없이 우측 상단에 유지 -->
			<div
				bind:this={topLayoutEl}
				class="filter-top-layout"
				class:has-follow-sort={sortVisualOpen}
			>
				<div class="primary-parts-stage">
					{#if mountedPanes.Artist}
						{@const isActive = activePaneKey === 'Artist'}
						<div
							class="filter-parts-grid primary-row category-parts-pane {paneClass('Artist')}"
							aria-hidden={!isActive || undefined}
							inert={!isActive || undefined}
						>
							<div class="filter-grid-cell span-6">
								<FilterChipPart
									title="성별"
									class="artist-gender-part"
									items={ARTIST_GENDER_OPTIONS}
									selected={paneStates.Artist.artistGenders}
									onchange={(next) => updatePaneField('Artist', 'artistGenders', next)}
								/>
							</div>
							<div class="filter-grid-cell span-6">
								<FilterChipPart
									title="구성"
									class="artist-type-part"
									items={ARTIST_TYPE_OPTIONS}
									selected={paneStates.Artist.artistTypes}
									onchange={(next) => updatePaneField('Artist', 'artistTypes', next)}
								/>
							</div>
						</div>
					{/if}

					{#if mountedPanes.Concert}
						{@const isActive = activePaneKey === 'Concert'}
						<div
							class="filter-parts-grid primary-row category-parts-pane {paneClass('Concert')}"
							aria-hidden={!isActive || undefined}
							inert={!isActive || undefined}
						>
							<div class="filter-grid-cell span-6">
								<FilterChipPart
									title="진행 현황"
									class="status-part"
									items={CONCERT_STATUS_OPTIONS}
									selected={paneStates.Concert.statuses}
									onchange={(next) => updatePaneField('Concert', 'statuses', next)}
								/>
							</div>
							<div class="filter-grid-cell span-6">
								<FilterChipPart
									title="유형"
									class="type-part"
									items={CONCERT_TYPE_OPTIONS}
									selected={paneStates.Concert.concertTypes}
									onchange={(next) => updatePaneField('Concert', 'concertTypes', next)}
								/>
							</div>
						</div>
					{/if}

					{#if mountedPanes.Album}
						{@const isActive = activePaneKey === 'Album'}
						<div
							class="filter-parts-grid primary-row has-bottom-toggle category-parts-pane {paneClass('Album')}"
							aria-hidden={!isActive || undefined}
							inert={!isActive || undefined}
						>
							<div class="filter-grid-cell span-5">
								<FilterChipPart
									title="형태"
									class="form-part"
									items={ALBUM_FORM_OPTIONS}
									selected={paneStates.Album.forms}
									onchange={(next) => updatePaneField('Album', 'forms', next)}
								/>
							</div>
							<div class="filter-grid-cell span-7">
								<PriceRangePart
									value={paneStates.Album.priceRange}
									onchange={(next) => updatePaneField('Album', 'priceRange', next)}
								/>
							</div>
							<div class="filter-grid-cell span-12">
								<FilterTogglePart
									title="품절 제외"
									description="현재 구매 가능한 음반만 표시합니다"
									checked={paneStates.Album.excludeSoldOut}
									paused={!active}
									onchange={(next) => updatePaneField('Album', 'excludeSoldOut', next)}
								/>
							</div>
						</div>
					{/if}

					{#if mountedPanes.Merchandise}
						{@const isActive = activePaneKey === 'Merchandise'}
						<div
							class="filter-parts-grid primary-row has-bottom-toggle category-parts-pane {paneClass('Merchandise')}"
							aria-hidden={!isActive || undefined}
							inert={!isActive || undefined}
						>
							<div class="filter-grid-cell span-7">
								<FilterChipPart
									title="형태"
									class="form-part"
									items={GOODS_FORM_OPTIONS}
									selected={paneStates.Merchandise.forms}
									onchange={(next) => updatePaneField('Merchandise', 'forms', next)}
								/>
							</div>
							<div class="filter-grid-cell span-5">
								<PriceRangePart
									value={paneStates.Merchandise.priceRange}
									onchange={(next) => updatePaneField('Merchandise', 'priceRange', next)}
								/>
							</div>
							<div class="filter-grid-cell span-12">
								<FilterTogglePart
									title="품절 제외"
									description="현재 구매 가능한 굿즈만 표시합니다"
									checked={paneStates.Merchandise.excludeSoldOut}
									paused={!active}
									onchange={(next) => updatePaneField('Merchandise', 'excludeSoldOut', next)}
								/>
							</div>
						</div>
					{/if}
				</div>

				<div
					bind:this={sortShellEl}
					class="follow-sort-shell"
					class:is-open={sortVisualOpen}
					aria-hidden={!isFollowMode}
					inert={!isFollowMode || undefined}
				>
					{#if sortMounted}
						<div class="follow-sort-inner">
							<SortPart
								items={FOLLOW_SORT_OPTIONS}
								value={filterState.sort || DEFAULT_FOLLOW_SORT}
								paused={!isFollowMode}
								onchange={updateSort}
							/>
						</div>
					{/if}
				</div>
			</div>

			{#if mountedPanes.Artist || mountedPanes.Concert}
				{@const hasSecondary = activePaneKey === 'Artist' || activePaneKey === 'Concert'}
				<div class="secondary-parts-stage" class:is-active={hasSecondary}>
					{#if mountedPanes.Artist}
						{@const artistActive = activePaneKey === 'Artist'}
						<div
							class="filter-parts-grid secondary-row category-parts-pane {paneClass('Artist')}"
							aria-hidden={!artistActive || undefined}
							inert={!artistActive || undefined}
						>
							<div class="filter-grid-cell span-12">
								{@render genrePartFor('Artist')}
							</div>
						</div>
					{/if}

					{#if mountedPanes.Concert}
						{@const concertActive = activePaneKey === 'Concert'}
						<div
							class="filter-parts-grid secondary-row category-parts-pane {paneClass('Concert')}"
							aria-hidden={!concertActive || undefined}
							inert={!concertActive || undefined}
						>
							<div class="filter-grid-cell span-12">
								<FilterChipPart
									title="지역"
									class="region-part"
									items={CONCERT_REGION_OPTIONS}
									selected={paneStates.Concert.regions}
									onchange={(next) => updatePaneField('Concert', 'regions', next)}
								/>
							</div>
							<div class="filter-grid-cell span-12">
								{@render genrePartFor('Concert')}
							</div>
						</div>
					{/if}
				</div>
			{/if}

			{#if extraParts}
				<div class="filter-parts-grid extra-row">
					<div class="filter-grid-cell span-12">
						{@render extraParts()}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.content-filter-section {
		width: 100%;
		--dir-blur-distance: 100vw;
	}

	.filter-height-shell {
		overflow: visible;
	}

	.filter-height-shell.is-height-animating {
		overflow-x: visible;
		overflow-y: clip;
	}

	.filter-measure-inner {
		display: flex;
		flex-direction: column;
		width: 100%;
	}

	.filter-top-layout {
		display: flex;
		align-items: stretch;
		gap: 0;
		width: 100%;
	}

	.primary-parts-stage {
		position: relative;
		z-index: 1;
		flex: 1 1 0%;
		min-width: 0;
		overflow: visible;
		display: flex;
		flex-direction: column;
	}

	.secondary-parts-stage {
		position: relative;
		width: 100%;
		overflow: visible;
		margin-top: 0;
	}

	.secondary-parts-stage.is-active {
		margin-top: 0.75rem;
	}

	.extra-row {
		margin-top: 0.75rem;
	}

	.category-parts-pane.is-active {
		display: grid;
		position: relative;
		z-index: 1;
	}

	.primary-parts-stage > .category-parts-pane.is-active {
		flex: 1 1 auto;
		height: 100%;
		grid-auto-rows: minmax(0, 1fr);
	}

	.primary-parts-stage > .category-parts-pane.is-active.has-bottom-toggle {
		grid-auto-rows: auto;
		grid-template-rows: minmax(0, 1fr) auto;
	}

	.category-parts-pane.is-active.is-switching {
		animation: fd-dir-blur-enter var(--dir-blur-enter-duration) var(--dir-blur-ease) both;
	}

	.category-parts-pane.is-exiting {
		display: grid;
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		pointer-events: none;
		z-index: 0;
		animation: fd-dir-blur-exit var(--dir-blur-exit-duration) var(--dir-blur-ease) both;
	}

	.secondary-row.is-exiting {
		top: 0.75rem;
	}

	.category-parts-pane.is-prewarming {
		display: grid;
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		visibility: hidden;
		opacity: 0;
		pointer-events: none;
		z-index: -1;
	}

	.category-parts-pane.is-hidden {
		display: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.category-parts-pane.is-active.is-switching,
		.category-parts-pane.is-exiting {
			animation: none;
		}
	}

	.follow-sort-shell {
		position: relative;
		z-index: 2;
		flex: 0 0 auto;
		display: flex;
		width: 0;
		margin-left: 0;
		opacity: 0;
		overflow: hidden;
		transform: translateX(14px) scale(0.97);
		transform-origin: right top;
		pointer-events: none;
		transition:
			width 0.36s cubic-bezier(0.22, 1, 0.36, 1),
			margin-left 0.36s cubic-bezier(0.22, 1, 0.36, 1),
			opacity 0.24s ease,
			transform 0.36s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.follow-sort-shell.is-open {
		width: 248px;
		margin-left: 0.75rem;
		opacity: 1;
		transform: translateX(0) scale(1);
		pointer-events: auto;
	}

	.follow-sort-inner {
		width: 248px;
		height: 100%;
		display: flex;
		overflow: hidden;
	}

	@media (prefers-reduced-motion: reduce) {
		.follow-sort-shell {
			transition: none;
		}
	}

	.filter-parts-grid {
		width: 100%;
		display: grid;
		grid-template-columns: repeat(12, minmax(0, 1fr));
		gap: 0.75rem;
		align-items: stretch;
	}

	.filter-grid-cell {
		min-width: 0;
		display: flex;
	}

	.filter-grid-cell.span-12 {
		grid-column: 1 / -1;
	}

	.filter-grid-cell.span-7 {
		grid-column: span 7;
	}

	.filter-grid-cell.span-6 {
		grid-column: span 6;
	}

	.filter-grid-cell.span-5 {
		grid-column: span 5;
	}

	.content-filter-section.is-mobile .filter-top-layout {
		flex-direction: column;
	}

	.content-filter-section.is-mobile .primary-parts-stage {
		flex: 0 0 auto;
		width: 100%;
	}

	.content-filter-section.is-mobile .follow-sort-shell {
		order: -1;
		display: grid;
		grid-template-rows: 0fr;
		width: 100%;
		margin-left: 0;
		margin-bottom: 0;
		transform: translateY(-6px) scale(0.98);
		transform-origin: top center;
		transition:
			grid-template-rows 0.32s cubic-bezier(0.22, 1, 0.36, 1),
			margin-bottom 0.32s cubic-bezier(0.22, 1, 0.36, 1),
			opacity 0.22s ease,
			transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.content-filter-section.is-mobile .follow-sort-shell.is-open {
		grid-template-rows: 1fr;
		width: 100%;
		margin-left: 0;
		margin-bottom: 0.6rem;
		transform: translateY(0) scale(1);
	}

	.content-filter-section.is-mobile .follow-sort-inner {
		width: 100%;
		min-height: 0;
		overflow: hidden;
	}

	.content-filter-section.is-mobile .filter-parts-grid {
		grid-template-columns: 1fr;
		gap: 0.6rem;
	}

	.content-filter-section.is-mobile .secondary-parts-stage.is-active,
	.content-filter-section.is-mobile .extra-row {
		margin-top: 0.6rem;
	}

	.content-filter-section.is-mobile .secondary-row.is-exiting {
		top: 0.6rem;
	}

	.content-filter-section.is-mobile .filter-grid-cell {
		grid-column: 1 / -1;
	}

	@media (max-width: 960px) {
		.filter-top-layout {
			flex-direction: column;
		}

		.primary-parts-stage {
			flex: 0 0 auto;
			width: 100%;
		}

		.follow-sort-shell {
			order: -1;
			display: grid;
			grid-template-rows: 0fr;
			width: 100%;
			margin-left: 0;
			margin-bottom: 0;
			transform: translateY(-6px) scale(0.98);
			transform-origin: top center;
			transition:
				grid-template-rows 0.32s cubic-bezier(0.22, 1, 0.36, 1),
				margin-bottom 0.32s cubic-bezier(0.22, 1, 0.36, 1),
				opacity 0.22s ease,
				transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
		}

		.follow-sort-shell.is-open {
			grid-template-rows: 1fr;
			width: 100%;
			margin-left: 0;
			margin-bottom: 0.75rem;
			transform: translateY(0) scale(1);
		}

		.follow-sort-inner {
			width: 100%;
			min-height: 0;
			overflow: hidden;
		}

		.filter-grid-cell.span-7,
		.filter-grid-cell.span-5 {
			grid-column: 1 / -1;
		}
	}

	@media (max-width: 640px) {
		.filter-parts-grid {
			grid-template-columns: 1fr;
			gap: 0.6rem;
		}

		.filter-grid-cell {
			grid-column: 1 / -1 !important;
		}
	}
</style>
