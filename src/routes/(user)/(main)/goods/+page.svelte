<script lang="ts">
	import GoodsSection from '#lib/components/feature/goods/GoodsSection.svelte';
	import { isMobile } from '#lib/stores';
</script>

<svelte:head>
	<title>INDIG - 굿즈</title>
</svelte:head>

<main class="goods-container" class:is-mobile={isMobile.current}>
	<GoodsSection />
</main>

<style>
	.goods-container {
		width: 100%;
		max-width: var(--content-max-width);
		margin: 0 auto;
		min-height: calc(100dvh - 60px);
		padding: 1.25rem var(--content-padding-x) 3.5rem;
		box-sizing: border-box;
		color: var(--fg);
	}

	.goods-container.is-mobile {
		padding: 0.75rem var(--content-padding-x-mobile) 2.5rem;
	}

	@media (max-width: 768px) {
		.goods-container {
			padding: 0.75rem var(--content-padding-x-mobile) 2.5rem;
		}
	}
</style>
