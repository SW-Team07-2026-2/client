<script lang="ts">
	import type { Snippet } from 'svelte';
	import { useSelectContext } from './context';

	interface Props {
		value: string;
		/** SelectValue에 표시할 텍스트 (미지정 시 value 사용) */
		label?: string;
		disabled?: boolean;
		class?: string;
		children: Snippet;
	}

	let { value, label, disabled = false, class: klass = '', children }: Props = $props();

	const ctx = useSelectContext();

	const isSelected = $derived(ctx.value === value);
	const isHighlighted = $derived(ctx.highlightedValue === value);

	$effect(() => {
		ctx.registerItem({ value, label: label ?? value, disabled });
		return () => ctx.unregisterItem(value);
	});

	function handleSelect() {
		if (disabled) return;
		ctx.select(value);
	}
</script>

<button
	type="button"
	role="option"
	aria-selected={isSelected}
	{disabled}
	data-slot="select-item"
	data-selected={isSelected ? '' : undefined}
	data-highlighted={isHighlighted ? '' : undefined}
	class="aui-select-item {klass}"
	onclick={handleSelect}
	onpointerenter={() => {
		if (!disabled) ctx.setHighlighted(value);
	}}
>
	<span class="aui-select-item-text">
		{@render children()}
	</span>

	{#if isSelected}
		<span
			class="aui-select-indicator"
			class:is-draw={ctx.checkAnimation === 'draw'}
			class:is-pop={ctx.checkAnimation === 'pop'}
			aria-hidden="true"
		>
			<svg
				width="15"
				height="15"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.4"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path class="indicator-check" pathLength="1" d="m4.5 12.75 5 5 10-11" />
			</svg>
		</span>
	{/if}
</button>

<style>
	.aui-select-item {
		position: relative;
		width: 100%;
		min-height: 40px;
		padding: 0.5rem 2.1rem 0.5rem 0.75rem;
		border: none;
		border-radius: 11px;
		background: transparent;
		color: var(--fg);
		font: inherit;
		font-size: 0.88rem;
		display: flex;
		align-items: center;
		text-align: left;
		cursor: pointer;
		outline: none;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
		transition:
			background-color 0.14s ease,
			color 0.14s ease;
	}

	.aui-select-item[data-highlighted],
	.aui-select-item:hover:not(:disabled),
	.aui-select-item:focus-visible {
		background: color-mix(in srgb, var(--white) 9%, transparent);
		color: var(--white);
	}

	.aui-select-item[data-selected] {
		color: var(--white);
		font-weight: var(--fw-semibold);
	}

	.aui-select-item:disabled {
		opacity: 0.45;
		pointer-events: none;
	}

	.aui-select-item-text {
		flex: 1;
		min-width: 0;
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.aui-select-indicator {
		position: absolute;
		right: 0.6rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--white);
		pointer-events: none;
	}

	.aui-select-indicator.is-draw .indicator-check {
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		animation: aui-select-check-draw 260ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
	}

	.aui-select-indicator.is-pop {
		animation: aui-select-check-pop 240ms cubic-bezier(0.22, 1.35, 0.36, 1) forwards;
	}

	@keyframes aui-select-check-draw {
		to {
			stroke-dashoffset: 0;
		}
	}

	@keyframes aui-select-check-pop {
		from {
			opacity: 0;
			transform: scale(0.5);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.aui-select-indicator.is-draw .indicator-check,
		.aui-select-indicator.is-pop {
			animation: none;
			stroke-dashoffset: 0;
		}
	}
</style>
