<script lang="ts">
	import { onDestroy, untrack, type Snippet } from 'svelte';
	import { FluidSetting } from '#lib/fluid/setting';
	import { isMobile } from '#lib/stores';
	import FdButton from '../../ui/FdButton.svelte';
	import FdTextMorph from '../../ui/FdTextMorph.svelte';
	import FdSegmentedControl, { type SegmentOption } from '../../ui/FdSegmentedControl.svelte';
	import RefreshCcwIcon from '../../ui/RefreshCcwIcon.svelte';
	import FdContentSearchInput from '../../feature/FdContentSearchInput.svelte';
	import ContentFilterArea from '../../feature/ContentFilterArea.svelte';

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
		/** 피드 탭 선택 값 ('recommend' | 'follow') */
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
		/** 장르 필터 다중 선택 허용 여부 (기본값: true) */
		filterMultiple?: boolean;
		/** 장르 필터 변경 콜백 */
		onGenreChange?: (genres: string[]) => void;
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
		filterMultiple = true,
		onGenreChange,
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

	let morphRef: ReturnType<typeof FdTextMorph> | undefined = $state();
	let prevIndex: number | null = null;

	$effect(() => {
		const idx = targetIndex;
		const ref = morphRef;
		if (!ref) {
			prevIndex = null;
			return;
		}

		if (prevIndex === null) {
			prevIndex = idx;
			return;
		}

		if (idx !== prevIndex) {
			prevIndex = idx;
			ref.goTo(idx);
		}
	});

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

	// 카테고리 순서(Artist -> Concert -> Album -> Merchandise)에 따른 부설명 전환 컨트롤러
	// 1: 오른쪽 카테고리(예: 아티스트 -> 공연), -1: 왼쪽 카테고리(예: 굿즈 -> 공연)
	interface SubtitleItem {
		uid: number;
		text: string;
		phase: 'idle' | 'entering' | 'exiting';
		x: number;
		opacity: number;
		blur: number;
		fromX: number;
		toX: number;
		fromOpacity: number;
		toOpacity: number;
		fromBlur: number;
		toBlur: number;
		startTime: number;
		duration: number;
	}

	let subtitleItems = $state<SubtitleItem[]>([]);
	let nextSubtitleUid = 1;
	let lastSubtitleCategoryIndex: number | null = null;
	let subtitleRafId = 0;

	function prefersReducedMotion(): boolean {
		return (
			typeof window !== 'undefined' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		);
	}

	function easeOutCubic(t: number): number {
		const inv = 1 - t;
		return 1 - inv * inv * inv;
	}

	function stopSubtitleLoop() {
		if (subtitleRafId) {
			cancelAnimationFrame(subtitleRafId);
			subtitleRafId = 0;
		}
	}

	function tickSubtitles(now: number) {
		subtitleRafId = 0;
		let hasAnimating = false;
		let hasFinishedExit = false;

		for (const item of subtitleItems) {
			if (item.phase === 'idle') continue;

			const raw = item.duration > 0 ? Math.min(1, Math.max(0, (now - item.startTime) / item.duration)) : 1;
			const eased = easeOutCubic(raw);

			item.x = item.fromX + (item.toX - item.fromX) * eased;
			item.opacity = item.fromOpacity + (item.toOpacity - item.fromOpacity) * eased;
			item.blur = item.fromBlur + (item.toBlur - item.fromBlur) * eased;

			if (raw >= 1) {
				item.x = item.toX;
				item.opacity = item.toOpacity;
				item.blur = item.toBlur;
				if (item.phase === 'entering') {
					item.phase = 'idle';
				} else {
					hasFinishedExit = true;
				}
			} else {
				hasAnimating = true;
			}
		}

		if (hasFinishedExit) {
			subtitleItems = subtitleItems.filter(
				(item) => !(item.phase === 'exiting' && item.opacity <= 0.001)
			);
		}

		if (hasAnimating) {
			subtitleRafId = requestAnimationFrame(tickSubtitles);
		}
	}

	function startSubtitleLoop() {
		if (typeof window === 'undefined' || subtitleRafId) return;
		subtitleRafId = requestAnimationFrame(tickSubtitles);
	}

	$effect.pre(() => {
		const text = resolvedSubtitle;
		const idx = targetIndex;

		untrack(() => {
			if (!text) {
				stopSubtitleLoop();
				subtitleItems = [];
				lastSubtitleCategoryIndex = idx;
				return;
			}

			if (lastSubtitleCategoryIndex === null || prefersReducedMotion()) {
				stopSubtitleLoop();
				lastSubtitleCategoryIndex = idx;
				subtitleItems = [
					{
						uid: nextSubtitleUid++,
						text,
						phase: 'idle',
						x: 0,
						opacity: 1,
						blur: 0,
						fromX: 0,
						toX: 0,
						fromOpacity: 1,
						toOpacity: 1,
						fromBlur: 0,
						toBlur: 0,
						startTime: 0,
						duration: 0
					}
				];
				return;
			}

			const currentActive = subtitleItems.find((item) => item.phase !== 'exiting');
			if (currentActive && currentActive.text === text && idx === lastSubtitleCategoryIndex) {
				return;
			}

			const dir: 1 | -1 = idx >= lastSubtitleCategoryIndex ? 1 : -1;
			lastSubtitleCategoryIndex = idx;
			const now = performance.now();

			// 기존 활성 텍스트는 현재 프레임의 실제 위치·투명도·블러에서 자연스럽게 반대 방향으로 퇴장
			const updated = subtitleItems.map((item) => {
				if (item.phase === 'exiting') return item;
				return {
					...item,
					phase: 'exiting' as const,
					fromX: item.x,
					toX: -dir * 38,
					fromOpacity: item.opacity,
					toOpacity: 0,
					fromBlur: item.blur,
					toBlur: 6,
					startTime: now,
					duration: 320
				};
			});

			updated.push({
				uid: nextSubtitleUid++,
				text,
				phase: 'entering',
				x: dir * 38,
				opacity: 0,
				blur: 6,
				fromX: dir * 38,
				toX: 0,
				fromOpacity: 0,
				toOpacity: 1,
				fromBlur: 6,
				toBlur: 0,
				startTime: now,
				duration: 420
			});

			subtitleItems = updated;
			startSubtitleLoop();
		});
	});

	onDestroy(() => {
		stopSubtitleLoop();
	});

	const hasSelectedGenres = $derived(selectedGenres.length > 0);

	// 필터 버튼: 뒷배경(--bg) + 보더(--line), 호버 시엔 색만 변하고 장르 1개 이상 선택 시 보더 색 물결 활성화
	const filterBtnSetting = $derived(
		new FluidSetting({
			radius: 999,
			reach: 32,
			bulge: 6,
			bulgeWidth: 18,
			layers: 2,
			layerGap: hasSelectedGenres ? 2.8 : 0,
			waveAmp: hasSelectedGenres ? 2.4 : 0,
			waveLength: 60,
			spin: 1.15,
			inset: 12,
			staticFrontWave: true,
			hoverReactive: true,
			bulgeReactive: true,
			clickReactive: true,
			pressDeform: { x: 0.8, y: -1.2 },
			pauseWhenIdle: !hasSelectedGenres,
			color: 'var(--bg)',
			hoverColor: 'var(--surface-dim)',
			pressColor: 'var(--surface-3)',
			waveColor: 'var(--line-wave)',
			hoverWaveColor: 'var(--muted-wave)',
			borderWidth: 1,
			borderColor: 'var(--line)',
			hoverBorderColor: 'var(--muted)',
			pressBorderColor: 'var(--muted)',
			textColor: hasSelectedGenres || filterOpen ? 'var(--fg)' : 'var(--muted)'
		})
	);

	let refreshHovered = $state(false);
	let refreshIconRef: ReturnType<typeof RefreshCcwIcon> | undefined = $state();

	function handleFilterToggle() {
		filterOpen = !filterOpen;
		onFilterToggle?.(filterOpen);
	}

	function handleRefreshClick() {
		refreshIconRef?.rotate();
		onRefresh?.();
	}
</script>

{#if !isMobile.current}
	<header class="main-page-header {className}">
		<div class="header-inner">
			<!-- 중앙 타이틀 & 설명 영역 (FdTextMorph 모핑 적용) -->
			<div class="title-meta">
				<h1 class="category-heading">
					<FdTextMorph
						bind:this={morphRef}
						words={morphWords}
						initialIndex={targetIndex}
						morph="liquid"
						color="#FAFAFA"
						morphColor="#fafafa"
						tint={0.3}
						align="center"
						duration={1.1}
						stagger={0.25}
						staggerFrom="random"
						travel={0.5}
						goo={0.1}
						swell={0.02}
						softness={0.8}
						scale={0.04}
						trigger="manual"
					/>
				</h1>

				{#if subtitleItems.length > 0}
					<div class="subtitle-wrap">
						{#each subtitleItems as item (item.uid)}
							<p
								class="category-subtitle"
								aria-hidden={item.phase === 'exiting' || undefined}
								style:pointer-events={item.phase === 'exiting' ? 'none' : undefined}
								style:opacity={item.opacity}
								style:filter={item.blur > 0.05 ? `blur(${item.blur.toFixed(2)}px)` : 'none'}
								style:transform="translate3d({item.x.toFixed(2)}px, 0, 0)"
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
							<div class="filter-toggle-slot">
								<FdButton
									class="filter-toggle-btn {filterOpen ? 'is-open' : ''} {hasSelectedGenres
										? 'has-filter'
										: ''}"
									setting={filterBtnSetting}
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
								</FdButton>
							</div>

							<div class="search-slot">
								<FdContentSearchInput
									bind:value={searchQuery}
									label={resolvedSearchLabel}
									placeholder={resolvedSearchPlaceholder}
									oninput={(val) => onSearchChange?.(val)}
									onenter={(val) => onSearchSubmit?.(val)}
									aria-label="{title} 검색"
								/>
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
								items={[
									{ value: 'recommend', label: '추천' },
									{ value: 'popular', label: '인기' },
									{ value: 'follow', label: '팔로우' }
								]}
								bind:value={feedMode}
								persistKey="main-page-header-feed-mode"
								pauseWhenIdle={false}
								rubberDock={true}
								color="var(--white-2)"
								waveColor="var(--white-3)"
								style="--fd-seg-active-color: var(--bg);"
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
							<ContentFilterArea
								bind:selected={selectedGenres}
								multiple={filterMultiple}
								onchange={onGenreChange}
							/>
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
		gap: 1.1rem;
		box-sizing: border-box;
	}

	.title-meta {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.4rem;
		width: 100%;
		min-width: 0;
	}

	.category-heading {
		margin: 0;
		width: 100%;
		display: flex;
		justify-content: center;
		font-size: clamp(2.625rem, 3.8vw, 3.375rem);
		font-weight: 800;
		line-height: 1.22;
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
		margin: 0.15rem 0 0 0;
		font-size: 0.96875rem;
		font-weight: 400;
		line-height: 1.5;
		color: var(--muted);
		text-align: center;
		will-change: transform, opacity, filter;
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
		margin-left: -4px;
		margin-right: -10px;
		flex-shrink: 0;
	}

	:global(.fd-wrap .fd-body .fd-btn.filter-toggle-btn) {
		width: 38px;
		height: 38px;
		padding: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--muted);
		transition: color 0.2s ease;
	}

	:global(.fd-wrap:hover .fd-body .fd-btn.filter-toggle-btn),
	:global(.fd-wrap .fd-body .fd-btn.filter-toggle-btn.is-open),
	:global(.fd-wrap .fd-body .fd-btn.filter-toggle-btn.has-filter) {
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

	:global(.fd-wrap .fd-body .fd-btn.filter-toggle-btn:focus-visible) {
		outline: 2px solid var(--line);
		outline-offset: 2px;
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
		flex: 1 1 240px;
		max-width: 340px;
		min-width: 180px;
	}

	:global(.fd-seg-control.content-segment-control) {
		margin-left: 12px;
		margin-right: 24px;
	}

	.extra-content {
		width: 100%;
	}
</style>
