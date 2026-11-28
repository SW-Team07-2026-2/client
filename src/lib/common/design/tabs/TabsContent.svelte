<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import type { TransitionConfig } from 'svelte/transition';
	import { getTabsContext } from './context';

	interface Props {
		/** 이 패널에 해당하는 탭 값 */
		value: string;
		/** 슬라이드 이동 거리(px) */
		slideDistance?: number;
		/** true 시 비활성 탭도 DOM을 언마운트하지 않고 Keep-Alive로 유지 */
		keepAlive?: boolean;
		/** 추가 CSS 클래스 */
		class?: string;
		children: Snippet;
	}

	let {
		value,
		slideDistance = 16,
		keepAlive = false,
		class: klass = '',
		children
	}: Props = $props();

	const ctx = getTabsContext();
	const isActive = $derived(ctx ? ctx.value === value : true);
	const enterOffsetX = $derived(
		ctx?.orientation === 'vertical' ? 0 : (ctx?.direction ?? 1) * slideDistance
	);
	const enterOffsetY = $derived(
		ctx?.orientation === 'vertical' ? (ctx?.direction ?? 1) * slideDistance : 0
	);

	function tabPanelIn(_node: Element): TransitionConfig {
		const dir = ctx?.direction ?? 1;
		const isVertical = ctx?.orientation === 'vertical';
		const dist = slideDistance;
		return {
			duration: 240,
			easing: cubicOut,
			css: (t, u) => {
				const offset = dir * dist * u;
				const translate = isVertical
					? `translate3d(0, ${offset}px, 0)`
					: `translate3d(${offset}px, 0, 0)`;
				return `opacity: ${t}; transform: ${translate}; filter: blur(${(u * 3).toFixed(2)}px);`;
			}
		};
	}

	function tabPanelOut(_node: Element): TransitionConfig {
		const dir = ctx?.direction ?? 1;
		const isVertical = ctx?.orientation === 'vertical';
		const dist = slideDistance;
		return {
			duration: 180,
			easing: cubicOut,
			css: (t, u) => {
				const offset = -dir * dist * u;
				const translate = isVertical
					? `translate3d(0, ${offset}px, 0)`
					: `translate3d(${offset}px, 0, 0)`;
				return `opacity: ${t}; transform: ${translate}; filter: blur(${(u * 3).toFixed(2)}px); pointer-events: none;`;
			}
		};
	}
</script>

{#if keepAlive}
	<div
		role="tabpanel"
		data-slot="tabs-content"
		class="ui-tabs-content is-keepalive {klass}"
		class:is-active={isActive}
		class:is-parked={!isActive}
		inert={!isActive ? true : undefined}
		aria-hidden={!isActive ? true : undefined}
		style:--tab-enter-x="{enterOffsetX}px"
		style:--tab-enter-y="{enterOffsetY}px"
	>
		{@render children()}
	</div>
{:else if isActive}
	<div
		role="tabpanel"
		data-slot="tabs-content"
		class="ui-tabs-content {klass}"
		in:tabPanelIn
		out:tabPanelOut
	>
		{@render children()}
	</div>
{/if}

<style>
	.ui-tabs-content {
		grid-area: 1 / 1;
		width: 100%;
		min-width: 0;
		outline: none;
		will-change: transform, opacity, filter;
	}

	.ui-tabs-content.is-keepalive.is-parked {
		display: none;
	}

	.ui-tabs-content.is-keepalive.is-active {
		animation: ui-tab-keepalive-enter 0.24s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	@keyframes ui-tab-keepalive-enter {
		0% {
			opacity: 0;
			transform: translate3d(var(--tab-enter-x, 0px), var(--tab-enter-y, 0px), 0);
			filter: blur(3px);
		}
		100% {
			opacity: 1;
			transform: translate3d(0, 0, 0);
			filter: blur(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.ui-tabs-content.is-keepalive.is-active {
			animation: none;
		}
	}
</style>
