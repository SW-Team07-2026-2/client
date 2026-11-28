<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		class?: string;
		children: Snippet;
	}

	let { class: klass = '', children }: Props = $props();
</script>

<div data-slot="select-label" class="aui-select-label {klass}">
	{@render children()}
</div>

<style>
	.aui-select-label {
		padding: 0.35rem 0.6rem 0.25rem;
		font-size: 0.72rem;
		font-weight: var(--fw-semibold);
		color: var(--muted);
		letter-spacing: -0.01em;
	}
</style>
