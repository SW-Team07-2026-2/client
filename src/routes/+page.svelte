<script lang="ts">
	import type { Snippet } from 'svelte';
	import { FirstDisplay } from '#lib/dedicated/first';

	let { children }: { children?: Snippet } = $props();
</script>

<svelte:head>
	<title>INDIG</title>
</svelte:head>

<FirstDisplay {children} />
