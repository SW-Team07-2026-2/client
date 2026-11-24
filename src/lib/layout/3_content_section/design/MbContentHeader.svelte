<script lang="ts">
	import SearchIcon from '#lib/common/design/icon/SearchIcon.svelte';
	import { SEARCH_QUERY_MAX_LENGTH } from '../logic/contentSection.svelte';

	interface Props {
		searchQuery: string;
		searchPlaceholder?: string;
		filterOpen: boolean;
		activeFilterCount: number;
		onSearchChange?: (val: string) => void;
		onSearchSubmit?: (val: string) => void;
		onFilterToggle?: () => void;
	}

	let {
		searchQuery,
		searchPlaceholder = '검색어를 입력하세요...',
		filterOpen,
		activeFilterCount,
		onSearchChange,
		onSearchSubmit,
		onFilterToggle
	}: Props = $props();
</script>

<!-- 모바일 콘텐츠 옵션 바: 검색창 + 필터판 여닫기 버튼 (순수 렌더링) -->
<div class="mb-content-header" role="region" aria-label="모바일 검색 및 필터">
	<form
		class="mb-search-box"
		onsubmit={(e) => {
			e.preventDefault();
			onSearchSubmit?.(searchQuery);
		}}
	>
		<span class="mb-search-icon" aria-hidden="true">
			<SearchIcon size={17} strokeWidth={2} />
		</span>
		<input
			type="search"
			class="mb-search-input"
			value={searchQuery}
			maxlength={SEARCH_QUERY_MAX_LENGTH}
			placeholder={searchPlaceholder}
			aria-label={searchPlaceholder}
			oninput={(e) => onSearchChange?.(e.currentTarget.value)}
		/>
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

	<button
		type="button"
		class="mb-filter-btn"
		class:is-open={filterOpen}
		class:has-active={activeFilterCount > 0}
		aria-expanded={filterOpen}
		aria-label="필터 열기"
		onclick={() => onFilterToggle?.()}
	>
		<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4.5 7h15" />
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M7 12h10" />
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9.5 17h5" />
		</svg>
		{#if activeFilterCount > 0}
			<span class="mb-filter-badge">{activeFilterCount}</span>
		{/if}
	</button>
</div>

<style>
	.mb-content-header {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		width: 100%;
		margin-bottom: 1rem;
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
	}

	.mb-search-icon {
		color: var(--muted);
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
	}

	.mb-search-input {
		flex: 1 1 0%;
		min-width: 0;
		width: 100%;
		border: none;
		outline: none;
		background: transparent;
		color: var(--fg);
		font: inherit;
		font-size: 0.9rem;
		padding: 0;
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

	.mb-filter-btn {
		position: relative;
		width: 42px;
		height: 42px;
		padding: 0;
		border-radius: 999px;
		background: var(--surface);
		border: var(--thin-border);
		color: var(--fg);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		flex-shrink: 0;
		transition: transform 0.15s ease, border-color 0.18s ease;
		-webkit-tap-highlight-color: transparent;
	}

	.mb-filter-btn:active {
		transform: scale(0.94);
	}

	.mb-filter-btn.has-active,
	.mb-filter-btn.is-open {
		border-color: var(--muted);
		color: var(--white);
	}

	.mb-filter-badge {
		position: absolute;
		top: -3px;
		right: -3px;
		min-width: 17px;
		height: 17px;
		padding: 0 4px;
		border-radius: 999px;
		background: var(--white);
		color: var(--bg);
		font-size: 0.68rem;
		font-weight: 700;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
	}
</style>
