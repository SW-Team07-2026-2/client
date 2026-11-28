<script lang="ts">
	import { onDestroy } from 'svelte';
	import FdDiv from '#lib/common/design/fluid/FdDiv.svelte';
	import SearchIcon from '#lib/common/design/icon/SearchIcon.svelte';
	import { createLetterLimitMotion } from '#lib/common/logic/letterLimitMotion';
	import { FluidSetting } from '#lib/common/type/fluid';
	import { SEARCH_QUERY_MAX_LENGTH } from '../logic/contentSection.svelte';
	import MbFeedOptionButton from '../part/header_part/MbFeedOptionButton.svelte';

	interface Props {
		searchQuery: string;
		searchPlaceholder?: string;
		filterOpen: boolean;
		activeFilterCount: number;
		/** 현재 선택된 피드 모드 ('recommend' | 'popular' | 'follow' | 'all') */
		feedMode: string;
		/** AppShell MbHeader와 동기화되는 스크롤 숨김 상태 */
		hidden?: boolean;
		onSearchChange?: (val: string) => void;
		onSearchSubmit?: (val: string) => void;
		onFilterToggle?: () => void;
		onFeedChange?: (nextMode: string) => void;
	}

	let {
		searchQuery,
		searchPlaceholder = '검색어를 입력하세요...',
		filterOpen,
		activeFilterCount,
		feedMode,
		hidden = false,
		onSearchChange,
		onSearchSubmit,
		onFilterToggle,
		onFeedChange
	}: Props = $props();

	const hasActiveFilters = $derived(activeFilterCount > 0);
	const isHeaderHidden = $derived(hidden && !filterOpen);
	let searchIconRef = $state<ReturnType<typeof SearchIcon> | undefined>(undefined);
	let searchInputEl = $state<HTMLInputElement | undefined>(undefined);
	let searchMirrorEl = $state<HTMLDivElement | undefined>(undefined);
	let searchPileEl = $state<HTMLDivElement | undefined>(undefined);

	const letterMotion = createLetterLimitMotion({
		getInput: () => searchInputEl,
		getMirror: () => searchMirrorEl,
		getFillCircle: () => undefined,
		getMeterSvg: () => undefined,
		getCountEl: () => undefined,
		getSendWrap: () => undefined,
		getPileEl: () => searchPileEl
	});

	function portalToBody(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				node.remove();
			}
		};
	}

	onDestroy(() => {
		letterMotion.destroy();
	});

	function handleSearchInput(e: Event & { currentTarget: HTMLInputElement }) {
		const field = e.currentTarget;
		let v = field.value;
		if (v.length > SEARCH_QUERY_MAX_LENGTH) {
			const caret = field.selectionStart ?? SEARCH_QUERY_MAX_LENGTH;
			const extra = v.slice(SEARCH_QUERY_MAX_LENGTH);
			v = v.slice(0, SEARCH_QUERY_MAX_LENGTH);
			field.value = v;
			if (document.activeElement === field) {
				const pos = Math.min(caret, SEARCH_QUERY_MAX_LENGTH);
				field.setSelectionRange(pos, pos);
			}
			letterMotion.drop(extra, v);
		}
		onSearchChange?.(v);
	}

	const filterBtnSetting = $derived(
		new FluidSetting({
			radius: 999,
			reach: 28,
			bulge: 5,
			bulgeWidth: 16,
			layers: 2,
			layerGap: hasActiveFilters ? 2 : 0,
			waveAmp: hasActiveFilters ? 2.4 : 0,
			waveLength: 56,
			spin: 1.15,
			inset: 10,
			staticFrontWave: true,
			hoverReactive: true,
			bulgeReactive: true,
			clickReactive: true,
			pressDeform: { x: 0.8, y: -1.2 },
			pauseWhenIdle: !hasActiveFilters,
			color: 'var(--surface)',
			hoverColor: 'var(--surface-2)',
			pressColor: 'var(--surface-3)',
			waveColor: 'var(--line-wave)',
			hoverWaveColor: 'var(--muted-wave)',
			borderWidth: 1,
			borderColor: hasActiveFilters || filterOpen ? 'var(--muted)' : 'var(--line)',
			hoverBorderColor: 'var(--muted)',
			pressBorderColor: 'var(--muted)',
			textColor: hasActiveFilters || filterOpen ? 'var(--white)' : 'var(--fg)'
		})
	);
</script>

<!-- 모바일 콘텐츠 헤더: 필터 버튼(FdDiv 물결 + X 모핑) · 검색창 · 피드 옵션 버튼 (순수 렌더링) -->
<div bind:this={searchPileEl} use:portalToBody class="mb-search-ll-pile" aria-hidden="true"></div>

<div
	class="mb-content-header"
	class:is-hidden={isHeaderHidden}
	class:is-filter-open={filterOpen}
	aria-hidden={isHeaderHidden || undefined}
	inert={isHeaderHidden || undefined}
	role="region"
	aria-label="모바일 필터, 검색 및 옵션"
>
	<div class="mb-filter-slot">
		<FdDiv setting={filterBtnSetting} class="mb-filter-fd-wrap" bodyClass="mb-filter-fd-body">
			<button
				type="button"
				class="mb-filter-btn"
				class:is-open={filterOpen}
				class:has-active={hasActiveFilters}
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
						stroke-width="1.6"
						d="M4.5 7h15"
					/>
					<path
						class="bar bar-mid"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.6"
						d="M7 12h10"
					/>
					<path
						class="bar bar-bot"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.6"
						d="M4.5 17h15"
					/>
				</svg>
			</button>
		</FdDiv>
		{#if hasActiveFilters && !filterOpen}
			<span class="mb-filter-badge" aria-hidden="true">{activeFilterCount}</span>
		{/if}
	</div>

	<form
		class="mb-search-box"
		aria-hidden={filterOpen || undefined}
		inert={filterOpen || undefined}
		onpointerdown={(e) => {
			if (!(e.target as HTMLElement | null)?.closest?.('.mb-search-clear')) {
				searchIconRef?.play();
			}
		}}
		onsubmit={(e) => {
			e.preventDefault();
			searchIconRef?.play();
			onSearchSubmit?.(searchQuery);
		}}
	>
		<span class="mb-search-icon" aria-hidden="true">
			<SearchIcon bind:this={searchIconRef} size={17} strokeWidth={2} />
		</span>
		<div class="mb-search-input-wrap">
			<input
				bind:this={searchInputEl}
				type="search"
				class="mb-search-input"
				value={searchQuery}
				placeholder={searchPlaceholder}
				aria-label={searchPlaceholder}
				oninput={handleSearchInput}
			/>
			<div bind:this={searchMirrorEl} class="mb-search-mirror" aria-hidden="true"></div>
		</div>
		{#if searchQuery.length > 0}
			<button
				type="button"
				class="mb-search-clear"
				onclick={() => onSearchChange?.('')}
				aria-label="검색어 지우기"
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		{/if}
	</form>

	<div class="mb-feed-slot" aria-hidden={filterOpen || undefined} inert={filterOpen || undefined}>
		<MbFeedOptionButton {feedMode} hidden={isHeaderHidden} onSelect={(val) => onFeedChange?.(val)} />
	</div>
</div>

<style>
	.mb-content-header {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		width: 100%;
		padding: 0.55rem var(--content-padding-x-mobile) 0.7rem;
		box-sizing: border-box;
		background: transparent;
		pointer-events: auto;
		transform: translate3d(0, 0, 0);
		will-change: transform;
		transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.mb-content-header.is-hidden {
		transform: translate3d(0, calc(-100% - 60px), 0);
		pointer-events: none;
	}

	/* 필터가 열리면 필터 버튼만 클릭 가능하고, 나머지 헤더 영역은 뒤쪽 필터 상단(초기화 버튼 등)으로 통과 */
	.mb-content-header.is-filter-open {
		pointer-events: none;
	}

	.mb-filter-slot {
		position: relative;
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		pointer-events: auto;
	}

	.mb-filter-slot :global(.fd-wrap.mb-filter-fd-wrap) {
		margin: -10px;
	}

	.mb-filter-slot :global(.fd-body.mb-filter-fd-body) {
		padding: 0 !important;
	}

	.mb-filter-btn {
		appearance: none;
		border: none;
		background: transparent;
		width: 42px;
		height: 42px;
		padding: 0;
		border-radius: 999px;
		color: inherit;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
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

	.mb-filter-badge {
		position: absolute;
		top: -3px;
		right: -3px;
		z-index: 3;
		min-width: 17px;
		height: 17px;
		padding: 0 4px;
		border-radius: 999px;
		background: var(--white);
		color: var(--bg);
		font-size: 0.68rem;
		font-weight: var(--fw-bold);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		pointer-events: none;
	}

	.mb-search-box {
		flex: 1 1 0%;
		min-width: 0;
		height: 42px;
		padding: 0 0.75rem;
		border-radius: 999px;
		background: var(--surface);
		border: var(--thin-border);
		display: flex;
		align-items: center;
		gap: 0.45rem;
		box-sizing: border-box;
		transition: opacity 0.2s ease;
	}

	.mb-feed-slot {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		transition: opacity 0.2s ease;
	}

	.mb-content-header.is-filter-open .mb-search-box,
	.mb-content-header.is-filter-open .mb-feed-slot {
		opacity: 0;
		pointer-events: none;
	}

	.mb-search-icon {
		color: var(--muted);
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
	}

	.mb-search-ll-pile {
		position: fixed;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		z-index: 250;
	}

	.mb-search-ll-pile :global(.ll-falling-char) {
		position: absolute;
		left: 0;
		top: 0;
		width: 20px;
		height: 24px;
		margin: -12px 0 0 -10px;
		text-align: center;
		font-size: 0.9rem;
		font-weight: var(--fw-medium);
		line-height: 24px;
		color: var(--danger);
		will-change: transform, opacity;
	}

	.mb-search-input-wrap {
		position: relative;
		flex: 1 1 0%;
		min-width: 0;
		height: 100%;
		display: flex;
		align-items: center;
	}

	.mb-search-input {
		width: 100%;
		height: 100%;
		min-width: 0;
		border: none;
		outline: none;
		background: transparent;
		color: var(--fg);
		font: inherit;
		font-size: 0.9rem;
		padding: 0;
		-webkit-appearance: none;
		appearance: none;
	}

	.mb-search-input::-webkit-search-decoration,
	.mb-search-input::-webkit-search-cancel-button,
	.mb-search-input::-webkit-search-results-button,
	.mb-search-input::-webkit-search-results-decoration {
		-webkit-appearance: none;
		appearance: none;
		display: none;
	}

	.mb-search-mirror {
		position: absolute;
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		font: inherit;
		font-size: 0.9rem;
		white-space: pre;
		overflow: hidden;
		visibility: hidden;
		pointer-events: none;
	}

	.mb-search-input::placeholder {
		color: var(--muted);
	}

	.mb-search-clear {
		width: 22px;
		height: 22px;
		padding: 0;
		border: none;
		border-radius: 999px;
		background: var(--surface-3);
		color: var(--fg);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
	}

	.mb-search-clear svg {
		width: 12px;
		height: 12px;
	}

	@media (prefers-reduced-motion: reduce) {
		.mb-content-header,
		.filter-toggle-icon .bar,
		.mb-search-box,
		.mb-feed-slot {
			transition: none;
		}
	}
</style>
