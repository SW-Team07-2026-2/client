<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getTabsContext } from './context';

	interface Props {
		value: string;
		disabled?: boolean;
		class?: string;
		children: Snippet;
	}

	let { value, disabled = false, class: klass = '', children }: Props = $props();

	const ctx = getTabsContext();

	const active = $derived(ctx?.value === value);

	$effect(() => {
		if (!ctx) return;
		const key = value;
		ctx.register(key);
		return () => ctx.unregister(key);
	});

	function handleClick() {
		if (disabled || !ctx) return;
		ctx.select(value);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!ctx || disabled) return;
		const isHorizontal = ctx.orientation === 'horizontal';
		const prevKey = isHorizontal ? 'ArrowLeft' : 'ArrowUp';
		const nextKey = isHorizontal ? 'ArrowRight' : 'ArrowDown';

		if (e.key !== prevKey && e.key !== nextKey && e.key !== 'Home' && e.key !== 'End') return;
		e.preventDefault();

		const list = ctx.getOrderedValues();
		if (list.length === 0) return;
		const currentIdx = list.indexOf(value);
		if (currentIdx === -1) return;

		let nextIdx = currentIdx;
		if (e.key === prevKey) nextIdx = (currentIdx - 1 + list.length) % list.length;
		else if (e.key === nextKey) nextIdx = (currentIdx + 1) % list.length;
		else if (e.key === 'Home') nextIdx = 0;
		else if (e.key === 'End') nextIdx = list.length - 1;

		const nextVal = list[nextIdx];
		if (nextVal) ctx.select(nextVal);
	}
</script>

<button
	type="button"
	role="tab"
	data-slot="tabs-trigger"
	data-active={active ? 'true' : undefined}
	aria-selected={active}
	tabindex={active ? 0 : -1}
	{disabled}
	class="ui-tabs-trigger {klass}"
	onclick={handleClick}
	onkeydown={handleKeydown}
>
	{@render children()}
</button>

<style>
	.ui-tabs-trigger {
		position: relative;
		z-index: 1;
		height: 30px;
		padding: 0 0.75rem;
		border: 1px solid transparent;
		border-radius: 7px;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 0.82rem;
		font-weight: var(--fw-medium);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		gap: 0.38rem;
		white-space: nowrap;
		cursor: pointer;
		outline: none;
		transition: color 0.18s ease;
		-webkit-tap-highlight-color: transparent;
	}

	.ui-tabs-trigger:hover:not(:disabled) {
		color: var(--white-2);
	}

	.ui-tabs-trigger[data-active='true'] {
		color: var(--white);
		font-weight: var(--fw-semibold);
	}

	.ui-tabs-trigger:focus-visible {
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--white) 28%, transparent);
	}

	.ui-tabs-trigger:disabled {
		opacity: 0.45;
		pointer-events: none;
	}
</style>
