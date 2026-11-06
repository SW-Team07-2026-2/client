<script lang="ts">
	import type { Snippet } from 'svelte';
	import LandingView from '../LandingView.svelte';

	let { children }: { children: Snippet } = $props();
</script>

<!-- `/` 와 `/signup` 이 같은 레이아웃을 공유하므로 이동해도 배경(바이닐/로고)이 다시 마운트되지 않음 -->
<LandingView>
	{@render children()}
</LandingView>

