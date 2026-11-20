<script lang="ts">
	import type { Snippet } from 'svelte';
	import { isMobile as device } from '#lib/stores';
	import PcHeader from './pc/PcHeader.svelte';
	import ContentHeader from './pc/ContentHeader.svelte';
	import MobileHeader from './mobile/MobileHeader.svelte';
	import MobileBottomBar from './mobile/MobileBottomBar.svelte';
	import ContentBottomBar from './mobile/ContentBottomBar.svelte';
	import type { SegmentOption } from '../ui/FdSegmentedControl.svelte';
	import { createDefaultFilterState, type ContentFilterState } from '#lib/config/filter';

	interface Props {
		/** 본문 컨텐츠 */
		children: Snippet;
		/** PC 컨텐츠 헤더 타이틀 (지정 시 PC에서 ContentHeader 표시) */
		title?: string;
		/** PC 컨텐츠 헤더 영문 라벨 */
		englishTitle?: string;
		/** PC 컨텐츠 헤더 설명 */
		description?: string;
		/** PC 컨텐츠 헤더 뱃지 */
		badge?: string;
		/** PC 컨텐츠 헤더 피드 탭 값 */
		feedMode?: string;
		/** PC 컨텐츠 헤더 피드 탭 변경 콜백 */
		onFeedChange?: (value: string, item: SegmentOption, index: number) => void;
		/** PC 컨텐츠 헤더 검색어 (양방향 바인딩) */
		searchQuery?: string;
		/** PC 컨텐츠 헤더 검색창 플레이스홀더 */
		searchPlaceholder?: string;
		/** PC 컨텐츠 헤더 검색어 변경 콜백 */
		onSearchChange?: (value: string) => void;
		/** PC 컨텐츠 헤더 검색 Enter 콜백 */
		onSearchSubmit?: (value: string | number) => void;
		/** PC 컨텐츠 헤더 필터 열림 상태 */
		filterOpen?: boolean;
		/** PC 컨텐츠 헤더 필터 토글 콜백 */
		onFilterToggle?: (open: boolean) => void;
		/** 선택된 장르 필터 목록 */
		selectedGenres?: string[];
		/** 통합 필터 상태 */
		filterState?: ContentFilterState;
		/** 장르 필터 다중 선택 허용 여부 */
		filterMultiple?: boolean;
		/** 장르 필터 변경 콜백 */
		onGenreChange?: (genres: string[]) => void;
		/** 통합 필터 변경 콜백 */
		onFilterChange?: (state: ContentFilterState) => void;
		/** 전체 필터 초기화 콜백 */
		onFilterReset?: () => void;
		/** 새로고침 버튼 클릭 콜백 */
		onRefresh?: () => void;
		/** 커스텀 PC 컨텐츠 헤더 스니펫 (지정 시 기본 ContentHeader 대신 렌더링) */
		contentHeader?: Snippet;
		/** 스크롤 페이드 및 높이 측정용 컨텐츠 헤더 래퍼 엘리먼트 */
		headerEl?: HTMLDivElement;
		/** 컨텐츠 헤더 숨김 상태 */
		headerConcealed?: boolean;
		/** 컨텐츠 헤더 리빌 애니메이션 상태 */
		headerRevealing?: boolean;
		/** 컨텐츠 헤더 인라인 투명도 */
		headerOpacity?: number;
		/** 컨텐츠 헤더 인라인 transform */
		headerTransform?: string;
		/** 본문 외 추가 오버레이/플로팅 UI 슬롯 */
		overlay?: Snippet;
	}

	let {
		children,
		title,
		englishTitle,
		description,
		badge,
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
		onFilterReset,
		onRefresh,
		contentHeader,
		headerEl = $bindable(),
		headerConcealed = false,
		headerRevealing = false,
		headerOpacity = 1,
		headerTransform = '',
		overlay
	}: Props = $props();

	const isMobile = $derived(device.current);
</script>

<div class="main-layout">
	{#if isMobile}
		<!-- 모바일: 상단 헤더 + 본문 + 컨텐츠 바텀바 + 하단 네비게이션 바 -->
		<MobileHeader />

		<main class="page-content is-mobile">
			{@render children()}
		</main>

		<ContentBottomBar />
		<MobileBottomBar />
	{:else}
		<!-- PC: 상단 헤더 + 본문(컨텐츠 헤더 포함) -->
		<PcHeader />

		<main class="page-content">
			{#if contentHeader}
				<div
					bind:this={headerEl}
					class="page-header-stage"
					class:is-concealed={headerConcealed}
					class:is-revealing={headerRevealing}
					style:opacity={headerOpacity}
					style:transform={headerTransform}
				>
					{@render contentHeader()}
				</div>
			{:else if title}
				<div
					bind:this={headerEl}
					class="page-header-stage"
					class:is-concealed={headerConcealed}
					class:is-revealing={headerRevealing}
					style:opacity={headerOpacity}
					style:transform={headerTransform}
				>
					<ContentHeader
						{title}
						{englishTitle}
						{description}
						{badge}
						bind:feedMode
						{onFeedChange}
						bind:searchQuery
						{searchPlaceholder}
						{onSearchChange}
						{onSearchSubmit}
						bind:filterOpen
						{onFilterToggle}
						bind:selectedGenres
						bind:filterState
						{filterMultiple}
						{onGenreChange}
						{onFilterChange}
						{onFilterReset}
						{onRefresh}
					/>
				</div>
			{/if}

			{@render children()}
		</main>
	{/if}

	{#if overlay}
		{@render overlay()}
	{/if}
</div>

<style>
	.main-layout {
		min-height: 100dvh;
		width: 100%;
		max-width: 100%;
		display: flex;
		flex-direction: column;
		background-color: var(--bg, #070709);
		color: var(--fg, #f0f0f0);
		overflow-x: clip;
	}

	.page-content {
		flex: 1;
		width: 100%;
	}

	.page-content.is-mobile {
		padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px));
	}

	.page-header-stage {
		position: relative;
		z-index: 2;
		width: 100%;
		will-change: opacity, transform;
	}

	.page-header-stage.is-concealed {
		pointer-events: none;
		transition:
			opacity 0.14s ease-out,
			transform 0.14s ease-out;
	}

	.page-header-stage.is-revealing {
		transition:
			opacity 0.42s cubic-bezier(0.22, 1, 0.36, 1),
			transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
	}
</style>
