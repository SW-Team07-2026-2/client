<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { useSelectContext } from './context';

	interface Props {
		side?: 'top' | 'bottom';
		sideOffset?: number;
		align?: 'start' | 'center' | 'end';
		class?: string;
		children: Snippet;
	}

	let {
		side = 'bottom',
		sideOffset = 6,
		align = 'start',
		class: klass = '',
		children
	}: Props = $props();

	const ctx = useSelectContext();
	let listEl = $state<HTMLDivElement | null>(null);
	let canScrollUp = $state(false);
	let canScrollDown = $state(false);

	function updateScrollArrows() {
		if (!listEl) {
			canScrollUp = false;
			canScrollDown = false;
			return;
		}
		canScrollUp = listEl.scrollTop > 2;
		canScrollDown = listEl.scrollTop + listEl.clientHeight < listEl.scrollHeight - 2;
	}

	$effect(() => {
		if (!ctx.open || !listEl) return;
		updateScrollArrows();
	});

	function popTransition(_node: Element) {
		const yFrom = side === 'top' ? 6 : -6;
		return {
			duration: 180,
			easing: cubicOut,
			css: (t: number, u: number) =>
				`opacity: ${t.toFixed(3)}; transform: translate3d(0, ${(u * yFrom).toFixed(2)}px, 0) scale(${(0.97 + t * 0.03).toFixed(4)});`
		};
	}
</script>

{#if ctx.open}
	<div
		id={ctx.listId}
		role="listbox"
		tabindex="-1"
		data-slot="select-content"
		data-side={side}
		data-align={align}
		class="aui-select-content {klass}"
		style:--select-side-offset="{sideOffset}px"
		transition:popTransition
	>
		{#if canScrollUp}
			<div class="aui-select-scroll-arrow is-top" aria-hidden="true">
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="m18 15-6-6-6 6" />
				</svg>
			</div>
		{/if}

		<div bind:this={listEl} class="aui-select-list" onscroll={updateScrollArrows}>
			{@render children()}
		</div>

		{#if canScrollDown}
			<div class="aui-select-scroll-arrow is-bottom" aria-hidden="true">
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="m6 9 6 6 6-6" />
				</svg>
			</div>
		{/if}
	</div>
{/if}

<style>
	.aui-select-content {
		position: absolute;
		z-index: 60;
		min-width: 100%;
		border-radius: 16px;
		border: none;
		background: var(--glass-bg);
		-webkit-backdrop-filter: var(--glass-filter);
		backdrop-filter: var(--glass-filter);
		box-shadow: 0 18px 40px rgba(0, 0, 0, 0.52);
		color: var(--fg);
		overflow: hidden;
	}

	.aui-select-content[data-side='bottom'] {
		top: calc(100% + var(--select-side-offset, 6px));
		transform-origin: top center;
	}

	.aui-select-content[data-side='top'] {
		bottom: calc(100% + var(--select-side-offset, 6px));
		transform-origin: bottom center;
	}

	.aui-select-content[data-align='start'] {
		left: 0;
	}

	.aui-select-content[data-align='end'] {
		right: 0;
	}

	.aui-select-content[data-align='center'] {
		left: 50%;
		translate: -50% 0;
	}

	.aui-select-list {
		max-height: min(280px, 42dvh);
		overflow-x: hidden;
		overflow-y: auto;
		overscroll-behavior: contain;
		color-scheme: dark;
		scrollbar-width: thin;
		scrollbar-color: var(--line) transparent;
	}

	.aui-select-scroll-arrow {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 20px;
		color: var(--muted);
		pointer-events: none;
	}
</style>
