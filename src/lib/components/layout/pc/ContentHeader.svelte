<script lang="ts">
	import { onDestroy, onMount, untrack, type Snippet } from 'svelte';
	import { FluidSetting, prefersReducedMotion } from '#lib/fluid';
	import { isMobile } from '#lib/stores';
	import FdDiv from '../../ui/FdDiv.svelte';
	import DynamicText from '../../ui/DynamicText.svelte';
	import FdSegmentedControl, { type SegmentOption } from '../../ui/FdSegmentedControl.svelte';
	import RefreshCcwIcon from '../../ui/RefreshCcwIcon.svelte';
	import FdContentSearchInput from '../../feature/FdContentSearchInput.svelte';
	import ContentFilterSection from '../../feature/filter/ContentFilterSection.svelte';
	import {
		DIRECTIONAL_BLUR_MOTION,
		resolveSlideDirection,
		type SlideDirection
	} from '#lib/utils/directionalBlur';
	import {
		clearSavedCategoryFilter,
		countActiveFilters,
		createDefaultFilterState,
		restoreCategoryFilterState,
		saveCategoryFilter,
		type ContentFilterState
	} from '#lib/config/filter';

	interface Props {
		/** 현재 카테고리 명칭 (예: 'Artist', 'Concert', 'Album', 'Merchandise' 또는 한글 명칭) */
		title: string;
		/** 카테고리 부설명 (subtitle 우선, 하위호환 description 지원) */
		subtitle?: string;
		/** 카테고리 영문 또는 서브 라벨 */
		englishTitle?: string;
		/** 카테고리 부설명 (하위호환 별칭) */
		description?: string;
		/** 카테고리 뱃지/태그 텍스트 (옵션) */
		badge?: string;
		/** 피드 탭 선택 값 ('recommend' | 'popular' | 'all' | 'follow') */
		feedMode?: string;
		/** 피드 탭 변경 콜백 */
		onFeedChange?: (value: string, item: SegmentOption, index: number) => void;
		/** 검색창 입력 값 (양방향 바인딩) */
		searchQuery?: string;
		/** 검색창 플레이스홀더 */
		searchPlaceholder?: string;
		/** 검색어 입력 변경 콜백 */
		onSearchChange?: (value: string) => void;
		/** 검색창 Enter 입력 콜백 */
		onSearchSubmit?: (value: string | number) => void;
		/** 필터 열림 상태 (양방향 바인딩) */
		filterOpen?: boolean;
		/** 필터 토글 버튼 클릭 콜백 */
		onFilterToggle?: (open: boolean) => void;
		/** 선택된 장르 필터 목록 (양방향 바인딩) */
		selectedGenres?: string[];
		/** 통합 필터 상태 (양방향 바인딩) */
		filterState?: ContentFilterState;
		/** 장르 필터 다중 선택 허용 여부 (기본값: true) */
		filterMultiple?: boolean;
		/** 장르 필터 변경 콜백 */
		onGenreChange?: (genres: string[]) => void;
		/** 통합 필터 변경 콜백 */
		onFilterChange?: (state: ContentFilterState) => void;
		/** 필터 영역 스니펫 (추후 제작될 필터 컴포넌트들을 전달) */
		filters?: Snippet;
		/** 우측 상단 액션 영역 (검색, 정렬 셀렉트 등 옵션) */
		actions?: Snippet;
		/** 새로고침 버튼 클릭 콜백 */
		onRefresh?: () => void;
		/** 하단 추가 커스텀 컨텐츠 */
		children?: Snippet;
		/** 추가 클래스 */
		class?: string;
	}

	let {
		title,
		subtitle = '',
		englishTitle = '',
		description = '',
		badge: _badge = '',
		feedMode = $bindable('recommend'),
		onFeedChange,
		searchQuery = $bindable(''),
		searchPlaceholder,
		onSearchChange,
		onSearchSubmit,
		filterOpen = $bindable(false),
		onFilterToggle,
		selectedGenres = $bindable<string[]>([]),
		filterState = $bindable<ContentFilterState>(createDefaultFilterState()),
		filterMultiple = true,
		onGenreChange,
		onFilterChange,
		filters,
		actions,
		onRefresh,
		children,
		class: className = ''
	}: Props = $props();

	const BASE_CATEGORY_WORDS = ['Artist', 'Concert', 'Album', 'Merchandise'] as const;

	// 한글/영문 카테고리 타이틀을 표준 영문 타이틀 및 인덱스로 매핑
	function resolveCategoryWord(rawTitle: string, rawEnglishTitle: string): string {
		const norm = `${rawTitle} ${rawEnglishTitle}`.toLowerCase();
		if (rawTitle === '아티스트' || norm.includes('artist')) return 'Artist';
		if (rawTitle === '공연' || norm.includes('concert')) return 'Concert';
		if (
			rawTitle === '음반 & LP' ||
			norm.includes('album') ||
			norm.includes('lp') ||
			norm.includes('vinyl')
		) {
			return 'Album';
		}
		if (rawTitle === '굿즈' || norm.includes('goods') || norm.includes('merch'))
			return 'Merchandise';
		return rawTitle || 'Artist';
	}

	let targetWord = $derived(resolveCategoryWord(title, englishTitle));

	let morphWords = $derived(
		BASE_CATEGORY_WORDS.includes(targetWord as (typeof BASE_CATEGORY_WORDS)[number])
			? [...BASE_CATEGORY_WORDS]
			: [...BASE_CATEGORY_WORDS, targetWord]
	);

	let targetIndex = $derived(Math.max(0, morphWords.indexOf(targetWord)));

	const CATEGORY_SEARCH_TEXT: Record<string, { label: string; placeholder: string }> = {
		Artist: { label: '아티스트 검색', placeholder: '아티스트를 검색하세요...' },
		Concert: { label: '공연 검색', placeholder: '공연을 검색하세요...' },
		Album: { label: '앨범 검색', placeholder: '앨범을 검색하세요...' },
		Merchandise: { label: '굿즈 검색', placeholder: '굿즈를 검색하세요...' }
	};

	function resolveCategorySearch(word: string, rawTitle: string) {
		const matched = CATEGORY_SEARCH_TEXT[word];
		if (matched) return matched;
		if (rawTitle.toLowerCase().includes('my')) {
			return { label: '내 활동 검색', placeholder: '내 활동에서 검색하세요...' };
		}
		return { label: '검색', placeholder: '검색어를 입력하세요...' };
	}

	let resolvedSubtitle = $derived(subtitle || description);
	let resolvedSearchMeta = $derived(resolveCategorySearch(targetWord, title));
	let resolvedSearchLabel = $derived(resolvedSearchMeta.label);
	let resolvedSearchPlaceholder = $derived(searchPlaceholder || resolvedSearchMeta.placeholder);

	let searchOpen = $state(false);
	const isSearchFeedMode = $derived(searchOpen || searchQuery.trim().length > 0);
	let lastStandardFeedMode = $state<'recommend' | 'popular'>('recommend');

	$effect.pre(() => {
		if (isSearchFeedMode) {
			if (feedMode === 'recommend' || feedMode === 'popular') {
				lastStandardFeedMode = feedMode;
				feedMode = 'all';
			}
		} else {
			if (feedMode === 'recommend' || feedMode === 'popular') {
				lastStandardFeedMode = feedMode;
			} else if (feedMode === 'all') {
				feedMode = lastStandardFeedMode;
			}
		}
	});

	// 카테고리 순서(Artist -> Concert -> Album -> Merchandise)에 따른 부설명 전환 컨트롤러
	// 1: 오른쪽 카테고리(예: 아티스트 -> 공연), -1: 왼쪽 카테고리(예: 굿즈 -> 공연)
	interface SubtitleItem {
		uid: number;
		text: string;
		phase: 'idle' | 'entering' | 'exiting';
		dir: SlideDirection;
	}

	let subtitleItems = $state<SubtitleItem[]>([]);
	let nextSubtitleUid = 1;
	let lastSubtitleCategoryIndex: number | null = null;
	let subtitleCleanupTimer: ReturnType<typeof setTimeout> | undefined;

	function animateSubtitle(node: HTMLElement, params: { phase: SubtitleItem['phase']; dir: SlideDirection }) {
		let currentPhase = params.phase;

		function play(next: { phase: SubtitleItem['phase']; dir: SlideDirection }) {
			if (prefersReducedMotion()) return;
			const { enterDuration, exitDuration, easeCss } = DIRECTIONAL_BLUR_MOTION;
			if (next.phase === 'entering') {
				node.getAnimations().forEach((a) => a.cancel());
				node.animate(
					[
						{ transform: `translate3d(${next.dir * 100}%, 0, 0)` },
						{ transform: 'translate3d(0, 0, 0)' }
					],
					{ duration: enterDuration, easing: easeCss, fill: 'backwards' }
				);
			} else if (next.phase === 'exiting') {
				const computed = getComputedStyle(node).transform;
				const startTransform = computed && computed !== 'none' ? computed : 'translate3d(0, 0, 0)';
				node.getAnimations().forEach((a) => a.cancel());
				node.animate(
					[
						{ transform: startTransform },
						{ transform: `translate3d(${-next.dir * 100}%, 0, 0)` }
					],
					{ duration: exitDuration, easing: easeCss, fill: 'forwards' }
				);
			}
		}

		if (currentPhase !== 'idle') {
			play(params);
		}

		return {
			update(next: { phase: SubtitleItem['phase']; dir: SlideDirection }) {
				if (next.phase !== currentPhase) {
					currentPhase = next.phase;
					if (next.phase === 'exiting') {
						play(next);
					}
				}
			}
		};
	}

	$effect.pre(() => {
		const text = resolvedSubtitle;
		const idx = targetIndex;

		untrack(() => {
			if (!text) {
				clearTimeout(subtitleCleanupTimer);
				subtitleItems = [];
				lastSubtitleCategoryIndex = idx;
				return;
			}

			if (lastSubtitleCategoryIndex === null || prefersReducedMotion()) {
				clearTimeout(subtitleCleanupTimer);
				lastSubtitleCategoryIndex = idx;
				subtitleItems = [
					{
						uid: nextSubtitleUid++,
						text,
						phase: 'idle',
						dir: 1
					}
				];
				return;
			}

			const currentActive = subtitleItems.find((item) => item.phase !== 'exiting');
			if (currentActive && currentActive.text === text && idx === lastSubtitleCategoryIndex) {
				return;
			}

			const dir = resolveSlideDirection(lastSubtitleCategoryIndex, idx);
			lastSubtitleCategoryIndex = idx;

			const updated: SubtitleItem[] = subtitleItems
				.filter((item) => item.phase !== 'exiting')
				.map((item) => ({
					...item,
					phase: 'exiting' as const,
					dir
				}));

			const enterItem: SubtitleItem = {
				uid: nextSubtitleUid++,
				text,
				phase: 'entering',
				dir
			};
			updated.push(enterItem);
			subtitleItems = updated;

			clearTimeout(subtitleCleanupTimer);
			subtitleCleanupTimer = setTimeout(() => {
				subtitleItems = subtitleItems
					.filter((item) => item.phase !== 'exiting')
					.map((item) => (item.phase === 'entering' ? { ...item, phase: 'idle' as const } : item));
			}, Math.max(DIRECTIONAL_BLUR_MOTION.enterDuration, DIRECTIONAL_BLUR_MOTION.exitDuration));
		});
	});

	onDestroy(() => {
		clearTimeout(subtitleCleanupTimer);
	});

	$effect(() => {
		const genres = selectedGenres;
		untrack(() => {
			if (
				genres.length !== filterState.genres.length ||
				genres.some((g, i) => g !== filterState.genres[i])
			) {
				filterState = { ...filterState, genres: [...genres] };
			}
		});
	});

	const hasActiveFilters = $derived(countActiveFilters(filterState) > 0);

	// 필터 버튼: 뒷배경(--bg) + 보더(--line), 호버 시엔 색만 변하고 활성 필터가 1개 이상이면 보더 색 물결 활성화
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

	let refreshHovered = $state(false);
	let refreshIconRef: ReturnType<typeof RefreshCcwIcon> | undefined = $state();
	let filterSectionRef: ReturnType<typeof ContentFilterSection> | undefined = $state();

	// 필터 드로어가 닫혀 있을 때는 수십 개의 캔버스(FdDiv) 마운트/해제를 지연해 카테고리 전환 렉 제거
	let filterMounted = $state(untrack(() => filterOpen));
	let filterUnmountTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		const isOpen = filterOpen;
		clearTimeout(filterUnmountTimer);
		if (isOpen) {
			filterMounted = true;
		} else if (filterMounted) {
			filterUnmountTimer = setTimeout(() => {
				filterMounted = false;
			}, 380);
		}
	});

	// 필터 드로어가 언마운트된 상태에서도 카테고리 전환 시 마운트 전에 필터 상태 기억/복원 유지
	let prevHeaderCategory = untrack(() => targetWord);
	$effect.pre(() => {
		const nextCategory = targetWord;
		if (nextCategory !== prevHeaderCategory) {
			const leavingCategory = prevHeaderCategory;
			prevHeaderCategory = nextCategory;
			untrack(() => {
				if (filterMounted) return;
				saveCategoryFilter(leavingCategory, filterState);
				const restored = restoreCategoryFilterState(nextCategory, filterState);
				if (restored) {
					filterState = restored.nextState;
					if (restored.genresChanged) {
						selectedGenres = [...restored.nextState.genres];
						onGenreChange?.([...restored.nextState.genres]);
					}
					onFilterChange?.(restored.nextState);
				}
			});
		}
	});

	// 필터 알약 가로 확장 스프링 (필터 활성 시 오른쪽으로 부드럽게 늘어나 '초기화' 버튼 노출)
	const FILTER_ICON_WIDTH = 38;
	let resetSlotEl = $state<HTMLDivElement | null>(null);
	let resetSlotWidth = $state(58);
	let filterPillWidth = $state(FILTER_ICON_WIDTH);
	let pillTargetWidth = FILTER_ICON_WIDTH;
	let pillVelocity = 0;
	let pillRafId = 0;
	let pillLastTime = 0;
	let pillWidthInitialized = false;

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
		if (!animate || !pillWidthInitialized || prefersReducedMotion()) {
			if (pillRafId) {
				cancelAnimationFrame(pillRafId);
				pillRafId = 0;
			}
			filterPillWidth = nextTarget;
			pillVelocity = 0;
			pillWidthInitialized = true;
			return;
		}
		if (pillRafId) return;
		pillLastTime = performance.now();
		pillRafId = requestAnimationFrame(tickFilterPill);
	}

	$effect(() => {
		const active = hasActiveFilters;
		const extra = resetSlotWidth;
		const target = active ? FILTER_ICON_WIDTH + extra : FILTER_ICON_WIDTH;
		untrack(() => {
			syncFilterPillTarget(target, pillWidthInitialized);
		});
	});

	onMount(() => {
		if (resetSlotEl) {
			const w = resetSlotEl.offsetWidth;
			if (w > 0) resetSlotWidth = w;
		}
		syncFilterPillTarget(
			hasActiveFilters ? FILTER_ICON_WIDTH + resetSlotWidth : FILTER_ICON_WIDTH,
			false
		);

		if (!resetSlotEl) return;
		const ro = new ResizeObserver(() => {
			if (!resetSlotEl) return;
			const w = resetSlotEl.offsetWidth;
			if (w > 0 && Math.abs(w - resetSlotWidth) > 0.5) {
				resetSlotWidth = w;
			}
		});
		ro.observe(resetSlotEl);
		return () => ro.disconnect();
	});

	onDestroy(() => {
		clearTimeout(filterUnmountTimer);
		if (pillRafId) {
			cancelAnimationFrame(pillRafId);
			pillRafId = 0;
		}
	});

	function handleFilterToggle() {
		filterOpen = !filterOpen;
		onFilterToggle?.(filterOpen);
	}

	function handleResetAllFilters(e: MouseEvent) {
		e.stopPropagation();
		if (filterSectionRef) {
			filterSectionRef.resetAll();
		} else {
			const next = {
				...createDefaultFilterState(),
				sort: feedMode === 'follow' ? filterState.sort : ''
			};
			clearSavedCategoryFilter(targetWord);
			filterState = next;
			selectedGenres = [];
			onGenreChange?.([]);
			onFilterChange?.(next);
		}
	}

	function handleRefreshClick() {
		refreshIconRef?.rotate();
		onRefresh?.();
	}
</script>

{#if !isMobile.current}
	<header class="main-page-header {className}">
		<div class="header-inner">
			<!-- 중앙 타이틀 & 설명 영역 (DynamicText 모핑 적용) -->
			<div class="title-meta">
				<h1 class="category-heading">
					<DynamicText mode="morph" text={targetWord} />
				</h1>

				{#if subtitleItems.length > 0}
					<div class="subtitle-wrap">
						{#each subtitleItems as item (item.uid)}
							<p
								class="category-subtitle"
								use:animateSubtitle={{ phase: item.phase, dir: item.dir }}
								aria-hidden={item.phase === 'exiting' || undefined}
								style:pointer-events={item.phase === 'exiting' ? 'none' : undefined}
							>
								{item.text}
							</p>
						{/each}
					</div>
				{/if}
			</div>

			<!-- 하단 가로 컨트롤/필터 바 + 펼쳐지는 필터 패널 -->
			<div class="controls-wrap">
				<div class="filter-section" role="region" aria-label="{title} 필터">
					<div class="filter-scroll-container">
						<div class="filter-left">
							<div class="search-slot">
								<FdContentSearchInput
									bind:value={searchQuery}
									bind:open={searchOpen}
									label={resolvedSearchLabel}
									placeholder={resolvedSearchPlaceholder}
									oninput={(val) => onSearchChange?.(val)}
									onenter={(val) => onSearchSubmit?.(val)}
									aria-label="{title} 검색"
								/>
							</div>

							<div class="filter-toggle-slot">
								<FdDiv
									setting={filterBtnSetting}
									class="filter-pill-wrap"
									bodyClass="filter-pill-body"
								>
									<div class="filter-pill-stage" style:width="{filterPillWidth.toFixed(2)}px">
										<button
											type="button"
											class="filter-toggle-btn"
											class:is-open={filterOpen}
											class:has-filter={hasActiveFilters}
											aria-expanded={filterOpen}
											aria-label={filterOpen ? '필터 닫기' : '필터 열기'}
											onclick={handleFilterToggle}
										>
											<svg
												class="filter-toggle-icon"
												class:is-open={filterOpen}
												xmlns="http://www.w3.org/2000/svg"
												width="20"
												height="20"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												aria-hidden="true"
											>
												<path
													class="bar bar-top"
													fill="none"
													stroke="currentColor"
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="1.5"
													d="M4.5 7h15"
												/>
												<path
													class="bar bar-mid"
													fill="none"
													stroke="currentColor"
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="1.5"
													d="M7 12h10"
												/>
												<path
													class="bar bar-bot"
													fill="none"
													stroke="currentColor"
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
												onclick={handleResetAllFilters}
											>
												초기화
											</button>
										</div>
									</div>
								</FdDiv>
							</div>

							{#if filters}
								{@render filters()}
							{/if}
						</div>

						<div class="filter-right">
							{#if actions}
								{@render actions()}
							{/if}

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
								items={[
									{ value: 'recommend', label: '추천' },
									{ value: 'popular', label: '인기' },
									{ value: 'follow', label: '팔로우' }
								]}
								merge={{
									active: isSearchFeedMode,
									targetValues: ['recommend', 'popular'],
									mergedOption: { value: 'all', label: '전체' }
								}}
								bind:value={feedMode}
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
								onchange={onFeedChange}
							/>
						</div>
					</div>
				</div>

				<!-- 필터 토글 시 펼쳐지는 필터 패널 (CSS Grid 0fr <-> 1fr + 사전 마운트로 끊김 없는 전환) -->
				<div
					class="filter-drawer-panel"
					class:is-open={filterOpen}
					aria-hidden={!filterOpen}
					inert={!filterOpen || undefined}
				>
					<div class="filter-drawer-inner">
						<div class="filter-drawer-content">
							{#if filterMounted}
								<ContentFilterSection
									bind:this={filterSectionRef}
									category={targetWord}
									{feedMode}
									bind:filterState
									multiple={filterMultiple}
									onGenreChange={(nextGenres) => {
										selectedGenres = nextGenres;
										onGenreChange?.(nextGenres);
									}}
									onchange={(nextState) => onFilterChange?.(nextState)}
								/>
							{/if}
						</div>
					</div>
				</div>
			</div>

			<!-- 하단 추가 컨텐츠 슬롯 -->
			{#if children}
				<div class="extra-content">
					{@render children()}
				</div>
			{/if}
		</div>
	</header>
{/if}

<style>
	.main-page-header {
		width: 100%;
		background: var(--bg);
		box-sizing: border-box;
	}

	.header-inner {
		max-width: var(--content-max-width);
		margin: 0 auto;
		padding: 1.25rem var(--content-header-padding-x) 0.5rem var(--content-header-padding-x);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		box-sizing: border-box;
	}

	.title-meta {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		width: 100%;
		min-width: 0;
	}

	.category-heading {
		margin: 0;
		width: 100%;
		display: flex;
		justify-content: center;
		font-size: clamp(4.01875rem, 4.37vw, 4.88125rem);
		font-weight: var(--fw-bold);
		line-height: 1;
		letter-spacing: -0.02em;
		color: #fafafa;
	}

	.subtitle-wrap {
		position: relative;
		overflow-x: clip;
		overflow-y: visible;
		min-height: 1.5rem;
		width: 100%;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		place-items: center;
	}

	.category-subtitle {
		grid-area: 1 / 1;
		width: 100%;
		margin: 0;
		font-size: 1.1625rem;
		font-weight: var(--fw-medium);
		color: var(--muted);
		text-align: center;
		line-height: 1;

		will-change: transform;
	}

	/* 가로 컨트롤/필터 영역 */
	.controls-wrap {
		width: 100%;
		display: flex;
		flex-direction: column;
	}

	.filter-section {
		width: 100%;
	}

	.filter-scroll-container {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.75rem;
		overflow: visible;
		padding: 0;
	}

	.filter-left {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.35rem;
		flex: 1 1 240px;
		min-width: 0;
	}

	.filter-toggle-slot {
		display: inline-flex;
		align-items: center;
		margin-left: -12px;
		margin-right: 0;
		flex-shrink: 0;
	}

	:global(.fd-wrap.filter-pill-wrap .fd-body.filter-pill-body) {
		padding: 0;
		display: inline-flex;
		align-items: center;
		overflow: hidden;
		border-radius: 999px;
	}

	.filter-pill-stage {
		display: inline-flex;
		align-items: center;
		height: 38px;
		overflow: hidden;
		border-radius: 999px;
		will-change: width;
	}

	.filter-toggle-btn {
		appearance: none;
		border: none;
		background: transparent;
		margin: 0;
		padding: 0;
		width: 38px;
		height: 38px;
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--muted);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		transition: color 0.2s ease;
	}

	:global(.fd-wrap.filter-pill-wrap:hover) .filter-toggle-btn,
	.filter-toggle-btn.is-open,
	.filter-toggle-btn.has-filter {
		color: var(--fg);
	}

	.filter-toggle-btn:focus-visible,
	.filter-reset-pill-btn:focus-visible {
		outline: 2px solid var(--line);
		outline-offset: -2px;
		border-radius: 999px;
	}

	.filter-reset-slot {
		display: inline-flex;
		align-items: center;
		height: 38px;
		flex-shrink: 0;
		white-space: nowrap;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.2s ease;
	}

	.filter-reset-slot.is-visible {
		opacity: 1;
		pointer-events: auto;
	}

	.filter-reset-divider {
		width: 1px;
		height: 14px;
		background: var(--line);
		flex-shrink: 0;
	}

	.filter-reset-pill-btn {
		appearance: none;
		border: none;
		background: transparent;
		margin: 0;
		padding: 0 13px 0 10px;
		height: 38px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font: inherit;
		font-size: 0.78rem;
		font-weight: var(--fw-semibold);
		letter-spacing: -0.01em;
		color: var(--muted);
		cursor: pointer;
		white-space: nowrap;
		-webkit-tap-highlight-color: transparent;
		transition: color 0.18s ease;
	}

	.filter-reset-pill-btn:hover {
		color: var(--fg);
	}

	.filter-drawer-panel {
		display: grid;
		grid-template-rows: 0fr;
		opacity: 0;
		width: 100%;
		transition:
			grid-template-rows 0.36s cubic-bezier(0.22, 1, 0.36, 1),
			opacity 0.26s ease;
	}

	.filter-drawer-panel.is-open {
		grid-template-rows: 1fr;
		opacity: 1;
	}

	.filter-drawer-inner {
		min-height: 0;
		overflow: hidden;
	}

	.filter-drawer-content {
		padding: 0.75rem 12px 0.35rem 8px;
		box-sizing: border-box;
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

	.filter-right {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-left: auto;
		flex-shrink: 0;
	}

	.refresh-icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		margin: 0 -8px 0 0;
		background: transparent;
		border: none;
		border-radius: 999px;
		color: var(--muted);
		cursor: pointer;
		flex-shrink: 0;
		-webkit-tap-highlight-color: transparent;
		transition:
			color 0.2s ease,
			transform 0.14s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.refresh-icon-btn:hover {
		color: var(--fg);
	}

	.refresh-icon-btn:active {
		transform: scale(0.9);
	}

	.refresh-icon-btn:focus-visible {
		outline: 2px solid var(--line);
		outline-offset: 2px;
	}

	.search-slot {
		flex: 0 1 auto;
		max-width: 100%;
		min-width: 0;
		margin-left: -4px;
	}

	:global(.fd-seg-control.content-segment-control) {
		margin-left: 12px;
		margin-right: 24px;
	}

	.extra-content {
		width: 100%;
	}
</style>
