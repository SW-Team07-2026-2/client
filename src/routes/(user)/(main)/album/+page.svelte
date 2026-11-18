<script lang="ts">
	import AlbumSection from '#lib/components/feature/album/AlbumSection.svelte';
	import { isMobile } from '#lib/stores';
</script>

<svelte:head>
	<title>INDIG - 음반∙LP</title>
</svelte:head>

<main class="album-container" class:is-mobile={isMobile.current}>
	<AlbumSection />
</main>

<style>
	.album-container {
		width: 100%;
		max-width: var(--content-max-width);
		margin: 0 auto;
		min-height: calc(100dvh - 60px);
		padding: 1.25rem var(--content-padding-x) 3.5rem;
		box-sizing: border-box;
		color: var(--fg);
	}

	.album-container.is-mobile {
		padding: 0.75rem var(--content-padding-x-mobile) 2.5rem;
	}

	@media (max-width: 768px) {
		.album-container {
			padding: 0.75rem var(--content-padding-x-mobile) 2.5rem;
		}
	}
</style>
