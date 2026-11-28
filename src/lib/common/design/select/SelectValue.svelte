<script lang="ts">
	import type { Snippet } from 'svelte';
	import { useSelectContext } from './context';

	interface Props {
		placeholder?: string;
		class?: string;
		children?: Snippet;
	}

	let { placeholder = '', class: klass = '', children }: Props = $props();

	const ctx = useSelectContext();
	const resolvedLabel = $derived(ctx.getLabel(ctx.value));
</script>

<span
	data-slot="select-value"
	data-placeholder={!resolvedLabel && !children ? '' : undefined}
	class="aui-select-value {klass}"
>
	{#if children}
		{@render children()}
	{:else if resolvedLabel}
		{resolvedLabel}
	{:else}
		{placeholder}
	{/if}
</span>

<style>
	.aui-select-value {
		flex: 1;
		min-width: 0;
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		text-align: left;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.aui-select-value[data-placeholder] {
		color: var(--muted);
	}
</style>
