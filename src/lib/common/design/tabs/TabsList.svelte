<script lang="ts">
	import type { Snippet } from 'svelte';
	import { untrack } from 'svelte';
	import { prefersReducedMotion } from '#lib/common/type/spring';
	import { getTabsContext, type TabsListVariant } from './context';

	interface Props {
		variant?: TabsListVariant;
		ariaLabel?: string;
		class?: string;
		children: Snippet;
	}

	let {
		variant = 'default',
		ariaLabel,
		class: klass = '',
		children
	}: Props = $props();

	const ctx = getTabsContext();

	let listEl = $state<HTMLDivElement | null>(null);
	let canScrollLeft = $state(false);
	let canScrollRight = $state(false);
	let indicator = $state<{
		left: number;
		top: number;
		width: number;
		height: number;
		ready: boolean;
		animate: boolean;
	}>({
		left: 0,
		top: 0,
		width: 0,
		height: 0,
		ready: false,
		animate: false
	});

	function updateScrollHints() {
		if (!listEl) return;
		const maxScroll = Math.max(0, listEl.scrollWidth - listEl.clientWidth);
		canScrollLeft = listEl.scrollLeft > 2;
		canScrollRight = maxScroll - listEl.scrollLeft > 2;
	}

	function measureIndicator(allowAnimate: boolean) {
		if (!listEl) return;
		updateScrollHints();
		const prev = untrack(() => indicator);
		const activeEl = listEl.querySelector<HTMLElement>(
			'[data-slot="tabs-trigger"][data-active="true"]'
		);
		if (!activeEl) {
			if (prev.ready) {
				indicator = { ...prev, ready: false };
			}
			return;
		}
		const listRect = listEl.getBoundingClientRect();
		const activeRect = activeEl.getBoundingClientRect();
		const left = Math.round((activeRect.left - listRect.left + listEl.scrollLeft) * 10) / 10;
		const top = Math.round((activeRect.top - listRect.top + listEl.scrollTop) * 10) / 10;
		const width = Math.round(activeRect.width * 10) / 10;
		const height = Math.round(activeRect.height * 10) / 10;
		const ready = width > 0 && height > 0;
		const animate = allowAnimate && prev.ready;

		if (allowAnimate && listEl.scrollWidth > listEl.clientWidth + 1) {
			const targetLeft = activeEl.offsetLeft - (listEl.clientWidth - activeEl.offsetWidth) / 2;
			listEl.scrollTo({
				left: Math.max(0, targetLeft),
				behavior: prefersReducedMotion() ? 'auto' : 'smooth'
			});
		}

		if (
			prev.left === left &&
			prev.top === top &&
			prev.width === width &&
			prev.height === height &&
			prev.ready === ready &&
			prev.animate === animate
		) {
			return;
		}

		indicator = { left, top, width, height, ready, animate };
	}

	function handlePointerDown(e: PointerEvent) {
		// 가로 스크롤 가능한 탭 바에서는 부모 스와이프 뒤로가기와 충돌 방지
		if (listEl && listEl.scrollWidth > listEl.clientWidth + 1) {
			e.stopPropagation();
		}
	}

	$effect(() => {
		// 활성 탭 변경 시 인디케이터 위치 재측정
		void ctx?.value;
		measureIndicator(true);
	});

	$effect(() => {
		if (!listEl || typeof ResizeObserver === 'undefined') return;
		const ro = new ResizeObserver(() => measureIndicator(false));
		ro.observe(listEl);
		return () => ro.disconnect();
	});
</script>

<div
	bind:this={listEl}
	role="tablist"
	tabindex="-1"
	aria-label={ariaLabel}
	aria-orientation={ctx?.orientation ?? 'horizontal'}
	data-slot="tabs-list"
	data-variant={variant}
	data-orientation={ctx?.orientation ?? 'horizontal'}
	class="ui-tabs-list {klass}"
	class:can-scroll-left={canScrollLeft}
	class:can-scroll-right={canScrollRight}
	onscroll={updateScrollHints}
	onpointerdown={handlePointerDown}
>
	{#if indicator.ready}
		<span
			class="ui-tabs-highlight"
			class:is-animated={indicator.animate}
			class:is-line={variant === 'line'}
			style:width="{indicator.width}px"
			style:height={variant === 'line' ? '2px' : `${indicator.height}px`}
			style:transform={variant === 'line'
				? `translate3d(${indicator.left}px, ${indicator.top + indicator.height + 2}px, 0)`
				: `translate3d(${indicator.left}px, ${indicator.top}px, 0)`}
			aria-hidden="true"
		></span>
	{/if}

	{@render children()}
</div>

<style>
	.ui-tabs-list {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: flex-start;
		width: fit-content;
		max-width: 100%;
		box-sizing: border-box;
		flex-wrap: nowrap;
		overflow-x: auto;
		overflow-y: hidden;
		overscroll-behavior-x: contain;
		scrollbar-width: none;
		-ms-overflow-style: none;
		-webkit-overflow-scrolling: touch;
		gap: 2px;
		padding: 3px;
		border-radius: 10px;
		background: var(--surface-dim);
		color: var(--muted);
	}

	.ui-tabs-list::-webkit-scrollbar {
		display: none;
	}

	.ui-tabs-list.can-scroll-right:not(.can-scroll-left) {
		-webkit-mask-image: linear-gradient(to right, #000 0%, #000 calc(100% - 26px), transparent 100%);
		mask-image: linear-gradient(to right, #000 0%, #000 calc(100% - 26px), transparent 100%);
	}

	.ui-tabs-list.can-scroll-left:not(.can-scroll-right) {
		-webkit-mask-image: linear-gradient(to right, transparent 0%, #000 26px, #000 100%);
		mask-image: linear-gradient(to right, transparent 0%, #000 26px, #000 100%);
	}

	.ui-tabs-list.can-scroll-left.can-scroll-right {
		-webkit-mask-image: linear-gradient(
			to right,
			transparent 0%,
			#000 26px,
			#000 calc(100% - 26px),
			transparent 100%
		);
		mask-image: linear-gradient(
			to right,
			transparent 0%,
			#000 26px,
			#000 calc(100% - 26px),
			transparent 100%
		);
	}

	.ui-tabs-list[data-variant='line'] {
		gap: 0.25rem;
		padding: 0 0 4px;
		border-radius: 0;
		background: transparent;
		border-bottom: var(--thin-border);
	}

	.ui-tabs-highlight {
		position: absolute;
		top: 0;
		left: 0;
		border-radius: 7px;
		background: var(--surface-1);
		box-shadow: 0 1px 4px color-mix(in srgb, var(--bg) 35%, transparent);
		pointer-events: none;
		z-index: 0;
		will-change: transform, width, height;
	}

	.ui-tabs-highlight.is-line {
		border-radius: 999px;
		background: var(--white);
		box-shadow: none;
	}

	.ui-tabs-highlight.is-animated {
		transition:
			transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
			width 0.28s cubic-bezier(0.22, 1, 0.36, 1),
			height 0.28s cubic-bezier(0.22, 1, 0.36, 1);
	}

	@media (prefers-reduced-motion: reduce) {
		.ui-tabs-highlight.is-animated {
			transition: none;
		}
	}
</style>
