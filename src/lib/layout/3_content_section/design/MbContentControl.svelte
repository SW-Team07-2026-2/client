<script lang="ts">
	import { onMount } from 'svelte';
	import RefreshCcwIcon from '#lib/common/design/icon/RefreshCcwIcon.svelte';
	import { FEED_SEGMENT_ITEMS } from '../logic/contentSection.svelte';

	interface Props {
		/** 표시 여부 (마이페이지 등 옵션 불필요 시 false) */
		visible: boolean;
		/** 현재 피드 모드 ('recommend' | 'popular' | 'follow' | 'all') */
		feedMode: string;
		/** 피드 모드 변경 콜백 */
		onFeedChange?: (nextMode: string) => void;
		/** 새로고침 콜백 */
		onRefresh?: () => void;
	}

	let { visible, feedMode, onFeedChange, onRefresh }: Props = $props();

	let isScrolling = $state(false);
	let menuOpen = $state(false);
	let refreshIconRef = $state<{ rotate?: () => void } | undefined>(undefined);
	let scrollStopTimer: ReturnType<typeof setTimeout> | undefined;

	const currentFeedLabel = $derived(
		FEED_SEGMENT_ITEMS.find((item) => item.value === feedMode)?.label ?? '전체'
	);

	// 스크롤 진행 중엔 오른쪽 화면 밖으로 슬라이드해 가리고, 정지 시 복귀
	onMount(() => {
		if (typeof window === 'undefined') return;
		const handleScroll = () => {
			isScrolling = true;
			menuOpen = false;
			clearTimeout(scrollStopTimer);
			scrollStopTimer = setTimeout(() => {
				isScrolling = false;
			}, 220);
		};
		window.addEventListener('scroll', handleScroll, { passive: true });
		return () => {
			clearTimeout(scrollStopTimer);
			window.removeEventListener('scroll', handleScroll);
		};
	});

	function handleSelectFeed(val: string) {
		onFeedChange?.(val);
		menuOpen = false;
	}

	function handleRefresh() {
		refreshIconRef?.rotate?.();
		onRefresh?.();
	}
</script>

<!-- 모바일 콘텐츠 옵션 플로팅바 (우측 하단 · 스크롤 중 오른쪽 화면 밖으로 숨김, 순수 렌더링) -->
{#if visible}
	<div
		class="mb-floating-control"
		class:is-scroll-hidden={isScrolling}
		aria-hidden={isScrolling || undefined}
	>
		{#if menuOpen}
			<div class="mb-floating-menu" role="menu">
				{#each FEED_SEGMENT_ITEMS as item (item.value)}
					<button
						type="button"
						class="mb-floating-menu-item"
						class:is-active={feedMode === item.value}
						role="menuitemradio"
						aria-checked={feedMode === item.value}
						onclick={() => handleSelectFeed(item.value)}
					>
						{item.label}
					</button>
				{/each}
			</div>
		{/if}

		<div class="mb-floating-pill">
			<button
				type="button"
				class="mb-floating-feed-btn"
				aria-expanded={menuOpen}
				onclick={() => (menuOpen = !menuOpen)}
			>
				{currentFeedLabel}
			</button>
			<span class="mb-floating-divider" aria-hidden="true"></span>
			<button
				type="button"
				class="mb-floating-refresh-btn"
				aria-label="새로고침"
				onclick={handleRefresh}
			>
				<RefreshCcwIcon bind:this={refreshIconRef} size={16} strokeWidth={2} />
			</button>
		</div>
	</div>
{/if}

<style>
	.mb-floating-control {
		position: fixed;
		right: var(--content-padding-x-mobile);
		bottom: calc(var(--mobile-bottom-bar-height, 72px) + 18px + env(safe-area-inset-bottom, 0px));
		z-index: 48;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.45rem;
		transform: translate3d(0, 0, 0);
		will-change: transform;
		transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.mb-floating-control.is-scroll-hidden {
		transform: translate3d(calc(100% + 28px), 0, 0);
		pointer-events: none;
	}

	.mb-floating-menu {
		padding: 0.3rem;
		border-radius: 16px;
		background: var(--glass-bg);
		backdrop-filter: var(--glass-filter);
		-webkit-backdrop-filter: var(--glass-filter);
		border: var(--thin-border);
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 92px;
	}

	.mb-floating-menu-item {
		height: 34px;
		padding: 0 0.85rem;
		border: none;
		border-radius: 12px;
		background: transparent;
		color: var(--muted);
		font-size: 0.84rem;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
	}

	.mb-floating-menu-item.is-active {
		background: var(--white);
		color: var(--bg);
		font-weight: 600;
	}

	.mb-floating-pill {
		height: 40px;
		padding: 0 0.35rem;
		border-radius: 999px;
		background: var(--glass-bg);
		backdrop-filter: var(--glass-filter);
		-webkit-backdrop-filter: var(--glass-filter);
		border: var(--thin-border);
		box-shadow: 0 8px 24px color-mix(in srgb, var(--bg) 55%, transparent);
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
	}

	.mb-floating-feed-btn {
		height: 32px;
		padding: 0 0.7rem;
		border: none;
		border-radius: 999px;
		background: transparent;
		color: var(--white);
		font-size: 0.82rem;
		font-weight: 600;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.mb-floating-divider {
		width: 1px;
		height: 14px;
		background: var(--line);
	}

	.mb-floating-refresh-btn {
		width: 32px;
		height: 32px;
		padding: 0;
		border: none;
		border-radius: 999px;
		background: transparent;
		color: var(--fg);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.mb-floating-refresh-btn:active {
		transform: scale(0.92);
	}
</style>
