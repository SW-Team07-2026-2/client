<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		class?: string;
		children: Snippet;
	}

	let { class: klass = '', children }: Props = $props();
</script>

<div role="group" data-slot="select-group" class="aui-select-group {klass}">
	{@render children()}
</div>

<style>
	.aui-select-group {
		padding: 0.3rem;
		display: flex;
		flex-direction: column;
		gap: 0.12rem;
	}
</style>
