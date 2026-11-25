<script lang="ts">
	import { onMount } from 'svelte';
	import { FEED_SEGMENT_ITEMS } from '../../logic/contentSection.svelte';

	interface Props {
		/** 현재 선택된 피드 모드 ('recommend' | 'popular' | 'follow' | 'all') */
		feedMode: string;
		/** 상위 헤더 숨김 여부 (숨겨질 때 열려 있던 메뉴 자동 닫힘) */
		hidden?: boolean;
		/** 피드 모드 선택 콜백 */
		onSelect?: (nextMode: string) => void;
	}

	let { feedMode, hidden = false, onSelect }: Props = $props();

	let open = $state(false);
	let rootEl = $state<HTMLDivElement | null>(null);

	const currentLabel = $derived(
		FEED_SEGMENT_ITEMS.find((item) => item.value === feedMode)?.label ?? '전체'
	);

	$effect(() => {
		if (hidden && open) {
			open = false;
		}
	});

	onMount(() => {
		if (typeof document === 'undefined') return;
		const handleOutsidePointerDown = (e: PointerEvent) => {
			if (!open) return;
			if (!rootEl?.contains(e.target as Node)) {
				open = false;
			}
		};
		const handleKeyDown = (e: KeyboardEvent) => {
			if (open && e.key === 'Escape') {
				open = false;
			}
		};
		document.addEventListener('pointerdown', handleOutsidePointerDown);
		window.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('pointerdown', handleOutsidePointerDown);
			window.removeEventListener('keydown', handleKeyDown);
		};
	});

	function handlePick(val: string) {
		onSelect?.(val);
		open = false;
	}
</script>

<!-- 모바일 콘텐츠 헤더 우측 피드 옵션 버튼 + 드롭다운 (순수 렌더링) -->
<div bind:this={rootEl} class="mb-feed-option-wrap">
	<button
		type="button"
		class="mb-feed-option-btn"
		class:is-open={open}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-label="피드 정렬 옵션 ({currentLabel})"
		onclick={() => (open = !open)}
	>
		<span class="mb-feed-option-label">{currentLabel}</span>
		<svg
			class="mb-feed-option-chevron"
			class:is-open={open}
			width="13"
			height="13"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="m6 9 6 6 6-6" />
		</svg>
	</button>

	{#if open}
		<div class="mb-feed-option-menu" role="menu">
			{#each FEED_SEGMENT_ITEMS as item (item.value)}
				<button
					type="button"
					class="mb-feed-option-item"
					class:is-active={feedMode === item.value}
					role="menuitemradio"
					aria-checked={feedMode === item.value}
					onclick={() => handlePick(item.value)}
				>
					{item.label}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.mb-feed-option-wrap {
		position: relative;
		flex-shrink: 0;
	}

	.mb-feed-option-btn {
		height: 42px;
		padding: 0 0.72rem 0 0.85rem;
		border-radius: 999px;
		background: var(--surface);
		border: var(--thin-border);
		color: var(--fg);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.28rem;
		font: inherit;
		font-size: 0.82rem;
		font-weight: 600;
		white-space: nowrap;
		cursor: pointer;
		box-sizing: border-box;
		transition:
			transform 0.15s ease,
			border-color 0.18s ease,
			color 0.18s ease;
		-webkit-tap-highlight-color: transparent;
	}

	.mb-feed-option-btn:active {
		transform: scale(0.95);
	}

	.mb-feed-option-btn.is-open {
		color: var(--white);
	}

	.mb-feed-option-label {
		line-height: 1;
	}

	.mb-feed-option-chevron {
		color: var(--muted);
		transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.mb-feed-option-chevron.is-open {
		transform: rotate(180deg);
		color: var(--white);
	}

	.mb-feed-option-menu {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		z-index: 60;
		min-width: 96px;
		padding: 0.3rem;
		border-radius: 16px;
		background: var(--glass-bg);
		-webkit-backdrop-filter: var(--glass-filter);
		backdrop-filter: var(--glass-filter);
		border: var(--thin-border);
		box-shadow: 0 10px 28px color-mix(in srgb, var(--bg) 55%, transparent);
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.mb-feed-option-item {
		height: 34px;
		padding: 0 0.85rem;
		border: none;
		border-radius: 12px;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 0.84rem;
		font-weight: 500;
		text-align: left;
		white-space: nowrap;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.mb-feed-option-item.is-active {
		background: var(--white);
		color: var(--bg);
		font-weight: 600;
	}
</style>
