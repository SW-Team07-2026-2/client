<script lang="ts">
	import ArtistSection from '#lib/components/feature/artist/ArtistSection.svelte';
	import { isMobile } from '#lib/stores';
</script>

<svelte:head>
	<title>INDIG - 아티스트</title>
</svelte:head>

<main class="artist-container" class:is-mobile={isMobile.current}>
	<ArtistSection />
</main>

<style>
	.artist-container {
		width: 100%;
		max-width: var(--content-max-width);
		margin: 0 auto;
		min-height: calc(100dvh - 60px);
		padding: 1.25rem var(--content-padding-x) 3.5rem;
		box-sizing: border-box;
		color: var(--fg);
	}

	.artist-container.is-mobile {
		padding: 0.75rem var(--content-padding-x-mobile) 2.5rem;
	}

	@media (max-width: 768px) {
		.artist-container {
			padding: 0.75rem var(--content-padding-x-mobile) 2.5rem;
		}
	}
</style>
