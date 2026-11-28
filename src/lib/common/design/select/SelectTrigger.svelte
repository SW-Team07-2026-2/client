<script lang="ts">
	import type { Snippet } from 'svelte';
	import { useSelectContext } from './context';

	interface Props {
		size?: 'sm' | 'default';
		ariaLabel?: string;
		class?: string;
		children: Snippet;
	}

	let { size = 'default', ariaLabel, class: klass = '', children }: Props = $props();

	const ctx = useSelectContext();
	let btnEl = $state<HTMLButtonElement | null>(null);

	$effect(() => {
		ctx.setTriggerEl(btnEl);
		return () => ctx.setTriggerEl(null);
	});

	function handleKeyDown(e: KeyboardEvent) {
		if (ctx.open) return;
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			ctx.setOpen(true);
		}
	}
</script>

<button
	bind:this={btnEl}
	type="button"
	role="combobox"
	aria-haspopup="listbox"
	aria-expanded={ctx.open}
	aria-controls={ctx.listId}
	aria-label={ariaLabel}
	disabled={ctx.disabled}
	data-slot="select-trigger"
	data-size={size}
	data-state={ctx.open ? 'open' : 'closed'}
	class="aui-select-trigger {klass}"
	onclick={ctx.toggle}
	onkeydown={handleKeyDown}
>
	{@render children()}
	<svg
		class="aui-select-unfold"
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="m7 15 5 5 5-5" />
		<path d="m7 9 5-5 5 5" />
	</svg>
</button>

<style>
	.aui-select-trigger {
		width: 100%;
		height: 46px;
		padding: 0 0.85rem 0 1rem;
		border: none;
		border-radius: 14px;
		background: var(--surface);
		color: var(--white);
		font: inherit;
		font-size: 0.9rem;
		font-weight: var(--fw-semibold);
		display: inline-flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		white-space: nowrap;
		outline: none;
		cursor: pointer;
		user-select: none;
		box-sizing: border-box;
		-webkit-tap-highlight-color: transparent;
		transition:
			background-color 0.16s ease,
			box-shadow 0.16s ease;
	}

	.aui-select-trigger[data-size='sm'] {
		height: 36px;
		font-size: 0.84rem;
		border-radius: 10px;
	}

	.aui-select-trigger:hover:not(:disabled) {
		background: var(--surface-2);
	}

	.aui-select-trigger[data-state='open'],
	.aui-select-trigger:focus-visible {
		background: var(--surface-2);
	}

	.aui-select-trigger:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.aui-select-unfold {
		flex-shrink: 0;
		color: var(--muted);
		pointer-events: none;
		transition: color 0.16s ease;
	}

	.aui-select-trigger:hover:not(:disabled) .aui-select-unfold,
	.aui-select-trigger[data-state='open'] .aui-select-unfold {
		color: var(--white-2);
	}
</style>
