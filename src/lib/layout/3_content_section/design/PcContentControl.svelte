<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import FdDiv from '#lib/common/design/fluid/FdDiv.svelte';
	import FdSegmentedControl, {
		type SegmentOption
	} from '#lib/common/design/fluid/FdSegmentedControl.svelte';
	import RefreshCcwIcon from '#lib/common/design/icon/RefreshCcwIcon.svelte';
	import FdContentSearchInput from '../part/control_part/FdContentSearchInput.svelte';
	import { FluidSetting } from '#lib/common/type/fluid';
	import { prefersReducedMotion } from '#lib/common/type/spring';
	import {
		FEED_MERGE_OPTION,
		FEED_SEGMENT_ITEMS,
		SEARCH_QUERY_MAX_LENGTH
	} from '../logic/contentSection.svelte';

	interface Props {
		/** 검색어 */
		searchQuery: string;
		/** 검색창 라벨/플레이스홀더 */
		searchLabel?: string;
		searchPlaceholder?: string;
		/** 필터 열림 상태 */
		filterOpen: boolean;
		/** 활성 필터 존재 여부 */
		hasActiveFilters: boolean;
		/** 피드 탭 값 ('recommend' | 'popular' | 'follow' | 'all') */
		feedMode: string;
		/** 검색어 변경 콜백 */
		onSearchChange?: (val: string) => void;
		/** 검색 Enter 콜백 */
		onSearchSubmit?: (val: string | number) => void;
		/** 필터 토글 콜백 */
		onFilterToggle?: () => void;
		/** 필터 전체 초기화 콜백 */
		onFilterReset?: () => void;
		/** 피드 탭 변경 콜백 */
		onFeedChange?: (value: string, item: SegmentOption, index: number) => void;
		/** 새로고침 콜백 */
		onRefresh?: () => void;
	}

	let {
		searchQuery,
		searchLabel = '검색',
		searchPlaceholder = '검색어를 입력하세요...',
		filterOpen,
		hasActiveFilters,
		feedMode,
		onSearchChange,
		onSearchSubmit,
		onFilterToggle,
		onFilterReset,
		onFeedChange,
		onRefresh
	}: Props = $props();

	let searchOpen = $state(false);
	let refreshHovered = $state(false);
	let refreshIconRef = $state<{ rotate?: () => void } | undefined>(undefined);

	// 필터 알약 가로 확장 스프링 (필터 활성 시 원형 38px -> 초기화 버튼 포함 알약으로 부드럽게 확장/축소)
	const FILTER_ICON_WIDTH = 38;
	let resetSlotEl = $state<HTMLDivElement | null>(null);
	let resetSlotWidth = $state(58);
	let filterPillWidth = $state(FILTER_ICON_WIDTH);
	let pillTargetWidth = FILTER_ICON_WIDTH;
	let pillVelocity = 0;
	let pillRafId = 0;
	let pillLastTime = 0;
	let pillInitialized = false;

	function tickFilterPill(now: number) {
		pillRafId = 0;
		const dt = Math.min((now - pillLastTime) / 1000, 1 / 30) || 1 / 60;
		pillLastTime = now;

		const sub = 4;
		const subDt = dt / sub;
		let w = filterPillWidth;
		for (let i = 0; i < sub; i++) {
			const accel = -300 * (w - pillTargetWidth) - 26 * pillVelocity;
			pillVelocity += accel * subDt;
			w += pillVelocity * subDt;
		}

		if (Math.abs(w - pillTargetWidth) < 0.08 && Math.abs(pillVelocity) < 0.35) {
			filterPillWidth = pillTargetWidth;
			pillVelocity = 0;
			return;
		}

		filterPillWidth = Math.max(FILTER_ICON_WIDTH, w);
		pillRafId = requestAnimationFrame(tickFilterPill);
	}

	function syncFilterPillTarget(nextTarget: number, animate = true) {
		pillTargetWidth = nextTarget;
		if (!animate || !pillInitialized || prefersReducedMotion()) {
			if (pillRafId) {
				cancelAnimationFrame(pillRafId);
				pillRafId = 0;
			}
			pillVelocity = 0;
			filterPillWidth = nextTarget;
			return;
		}
		if (!pillRafId) {
			pillLastTime = performance.now();
			pillRafId = requestAnimationFrame(tickFilterPill);
		}
	}

	onMount(() => {
		const measure = () => {
			if (!resetSlotEl) return;
			const measured = Math.ceil(resetSlotEl.getBoundingClientRect().width);
			if (measured > 0) resetSlotWidth = measured;
		};
		measure();
		const target = hasActiveFilters ? FILTER_ICON_WIDTH + resetSlotWidth : FILTER_ICON_WIDTH;
		syncFilterPillTarget(target, false);
		pillInitialized = true;

		const ro =
			typeof ResizeObserver !== 'undefined' && resetSlotEl ? new ResizeObserver(measure) : null;
		if (resetSlotEl) ro?.observe(resetSlotEl);

		return () => {
			ro?.disconnect();
		};
	});

	$effect(() => {
		const active = hasActiveFilters;
		const slotW = resetSlotWidth;
		const target = active ? FILTER_ICON_WIDTH + slotW : FILTER_ICON_WIDTH;
		untrack(() => {
			syncFilterPillTarget(target, pillInitialized);
		});
	});

	onDestroy(() => {
		if (pillRafId) {
			cancelAnimationFrame(pillRafId);
			pillRafId = 0;
		}
	});

	const isSearchFeedMode = $derived(searchOpen || searchQuery.trim().length > 0);
	let lastStandardFeedMode = $state<'recommend' | 'popular'>('recommend');

	$effect.pre(() => {
		const searching = isSearchFeedMode;
		const currentMode = feedMode;
		untrack(() => {
			if (searching) {
				if (currentMode === 'recommend' || currentMode === 'popular') {
					lastStandardFeedMode = currentMode;
					onFeedChange?.(FEED_MERGE_OPTION.value, FEED_MERGE_OPTION, 0);
				}
			} else {
				if (currentMode === 'recommend' || currentMode === 'popular') {
					lastStandardFeedMode = currentMode;
				} else if (currentMode === 'all') {
					const restoreIdx = FEED_SEGMENT_ITEMS.findIndex(
						(item) => item.value === lastStandardFeedMode
					);
					const restoreItem = FEED_SEGMENT_ITEMS[restoreIdx] ?? FEED_SEGMENT_ITEMS[0];
					onFeedChange?.(restoreItem.value, restoreItem, Math.max(0, restoreIdx));
				}
			}
		});
	});

	const filterBtnSetting = $derived(
		new FluidSetting({
			radius: 999,
			reach: 32,
			bulge: 6,
			bulgeWidth: 18,
			layers: 2,
			layerGap: hasActiveFilters ? 2 : 0,
			waveAmp: hasActiveFilters ? 2.4 : 0,
			waveLength: 60,
			spin: 1.15,
			inset: 12,
			staticFrontWave: true,
			hoverReactive: true,
			bulgeReactive: true,
			clickReactive: true,
			pressDeform: { x: 0.8, y: -1.2 },
			pauseWhenIdle: !hasActiveFilters,
			color: 'var(--bg)',
			hoverColor: 'var(--surface-dim)',
			pressColor: 'var(--surface-3)',
			waveColor: 'var(--line-wave)',
			hoverWaveColor: 'var(--muted-wave)',
			borderWidth: 1,
			borderColor: 'var(--line)',
			hoverBorderColor: 'var(--muted)',
			pressBorderColor: 'var(--muted)',
			textColor: hasActiveFilters || filterOpen ? 'var(--fg)' : 'var(--muted)'
		})
	);

	function handleRefreshClick() {
		refreshIconRef?.rotate?.();
		onRefresh?.();
	}
</script>

<!-- PC 콘텐츠 옵션 바: 검색 · 필터 토글/초기화 · 새로고침 · 피드 탭 (각 PcContentSection 내부 소유, 순수 렌더링) -->
<div class="pc-content-control" role="region" aria-label="콘텐츠 옵션 바">
	<div class="control-left">
		<div class="search-slot">
			<FdContentSearchInput
				value={searchQuery}
				bind:open={searchOpen}
				label={searchLabel}
				placeholder={searchPlaceholder}
				maxlength={SEARCH_QUERY_MAX_LENGTH}
				oninput={(val) => onSearchChange?.(val)}
				onenter={(val) => onSearchSubmit?.(val)}
				aria-label={searchLabel}
			/>
		</div>

		<div class="filter-toggle-slot">
			<FdDiv setting={filterBtnSetting} class="filter-pill-wrap" bodyClass="filter-pill-body">
				<div class="filter-pill-row" style:width="{filterPillWidth.toFixed(2)}px">
					<button
						type="button"
						class="filter-toggle-btn"
						class:is-open={filterOpen}
						class:has-filter={hasActiveFilters}
						aria-expanded={filterOpen}
						aria-label={filterOpen ? '필터 닫기' : '필터 열기'}
						onclick={() => onFilterToggle?.()}
					>
						<svg
							class="filter-toggle-icon"
							class:is-open={filterOpen}
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							aria-hidden="true"
						>
							<path
								class="bar bar-top"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.5"
								d="M4.5 7h15"
							/>
							<path
								class="bar bar-mid"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.5"
								d="M7 12h10"
							/>
							<path
								class="bar bar-bot"
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.5"
								d="M4.5 17h15"
							/>
						</svg>
					</button>

					<div
						bind:this={resetSlotEl}
						class="filter-reset-slot"
						class:is-visible={hasActiveFilters}
						aria-hidden={!hasActiveFilters}
					>
						<span class="filter-reset-divider" aria-hidden="true"></span>
						<button
							type="button"
							class="filter-reset-pill-btn"
							tabindex={hasActiveFilters ? 0 : -1}
							onclick={(e) => {
								e.stopPropagation();
								onFilterReset?.();
							}}
						>
							초기화
						</button>
					</div>
				</div>
			</FdDiv>
		</div>
	</div>

	<div class="control-right">
		<button
			type="button"
			class="refresh-icon-btn"
			aria-label="새로고침"
			onpointerenter={() => (refreshHovered = true)}
			onpointerleave={() => (refreshHovered = false)}
			onclick={handleRefreshClick}
		>
			<RefreshCcwIcon
				bind:this={refreshIconRef}
				size={18}
				strokeWidth={1.85}
				hovered={refreshHovered}
			/>
		</button>

		<FdSegmentedControl
			class="content-segment-control"
			data-keep-search-open="true"
			items={FEED_SEGMENT_ITEMS}
			merge={{
				active: isSearchFeedMode,
				targetValues: ['recommend', 'popular'],
				mergedOption: FEED_MERGE_OPTION
			}}
			value={feedMode}
			persistKey="main-page-header-feed-mode"
			pauseWhenIdle={false}
			rubberDock={true}
			reach={32}
			bulge={6}
			bulgeWidth={18}
			bulgeReactive={true}
			layerGap={2.3}
			color="var(--white-2)"
			waveColor="var(--white-3)"
			style="--fd-seg-active-color: var(--bg);"
			onpointerdown={(e) => {
				if (searchOpen) e.preventDefault();
			}}
			onchange={(val, item, idx) => onFeedChange?.(val, item, idx)}
		/>
	</div>
</div>

<style>
	.pc-content-control {
		width: 100%;
		max-width: var(--content-max-width);
		margin: 0 auto;
		padding: 0.5rem var(--content-padding-x) 0.75rem;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.control-left {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
		flex: 1 1 auto;
	}

	.control-right {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex-shrink: 0;
	}

	.search-slot,
	.filter-toggle-slot {
		display: inline-flex;
		align-items: center;
	}

	:global(.fd-wrap.filter-pill-wrap .fd-body.filter-pill-body) {
		padding: 0;
		display: inline-flex;
		align-items: center;
		overflow: hidden;
		border-radius: 999px;
	}

	.filter-pill-row {
		display: inline-flex;
		align-items: center;
		height: 38px;
		overflow: hidden;
		border-radius: 999px;
		will-change: width;
	}

	.filter-toggle-btn {
		width: 38px;
		height: 38px;
		padding: 0;
		flex-shrink: 0;
		border: none;
		border-radius: 999px;
		background: transparent;
		color: inherit;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	.filter-toggle-icon {
		display: block;
		width: 20px;
		height: 20px;
		overflow: visible;
	}

	.filter-toggle-icon .bar {
		transition:
			transform 0.36s cubic-bezier(0.22, 1, 0.36, 1),
			stroke-dasharray 0.34s cubic-bezier(0.22, 1, 0.36, 1),
			stroke-dashoffset 0.34s cubic-bezier(0.22, 1, 0.36, 1),
			opacity 0.22s ease;
	}

	.filter-toggle-icon .bar-top {
		transform-origin: 12px 7px;
	}

	.filter-toggle-icon .bar-mid {
		transform-origin: 12px 12px;
		stroke-dasharray: 10 20;
		stroke-dashoffset: 0;
		opacity: 1;
	}

	.filter-toggle-icon .bar-bot {
		transform-origin: 12px 17px;
		stroke-dasharray: 4 20;
		stroke-dashoffset: -5.5;
	}

	.filter-toggle-icon.is-open .bar-top {
		transform: translateY(5px) rotate(45deg);
	}

	.filter-toggle-icon.is-open .bar-mid {
		stroke-dasharray: 0 20;
		stroke-dashoffset: -5;
		opacity: 0;
	}

	.filter-toggle-icon.is-open .bar-bot {
		stroke-dasharray: 15 20;
		stroke-dashoffset: 0;
		transform: translateY(-5px) rotate(-45deg);
	}

	.filter-reset-slot {
		display: inline-flex;
		align-items: center;
		height: 38px;
		flex-shrink: 0;
		white-space: nowrap;
		opacity: 0;
		transform: translateX(-6px);
		pointer-events: none;
		transition:
			opacity 0.22s ease,
			transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.filter-reset-slot.is-visible {
		opacity: 1;
		transform: translateX(0);
		pointer-events: auto;
	}

	.filter-reset-divider {
		width: 1px;
		height: 14px;
		background: var(--line);
		flex-shrink: 0;
	}

	.filter-reset-pill-btn {
		height: 38px;
		padding: 0 13px 0 10px;
		border: none;
		background: transparent;
		color: var(--muted);
		font-size: 0.78rem;
		font-weight: var(--fw-semibold);
		letter-spacing: -0.01em;
		cursor: pointer;
		white-space: nowrap;
		transition: color 0.18s ease;
	}

	.filter-reset-pill-btn:hover {
		color: var(--fg);
	}

	.refresh-icon-btn {
		width: 36px;
		height: 36px;
		padding: 0;
		border: none;
		border-radius: 999px;
		background: transparent;
		color: var(--muted);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition:
			color 0.18s ease,
			background-color 0.18s ease;
	}

	.refresh-icon-btn:hover {
		color: var(--white);
		background: var(--surface);
	}
</style>
