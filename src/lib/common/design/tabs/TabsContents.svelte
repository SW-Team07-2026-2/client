<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		class?: string;
		children: Snippet;
	}

	let { class: klass = '', children }: Props = $props();
</script>

<!-- Animate UI Tabs 패널 뷰포트 (전환 시 이전/다음 패널이 겹치며 부드럽게 슬라이드·페이드) -->
<div data-slot="tabs-contents" class="ui-tabs-contents {klass}">
	{@render children()}
</div>

<style>
	.ui-tabs-contents {
		position: relative;
		display: grid;
		align-items: start;
		width: 100%;
		overflow-x: clip;
	}
</style>
