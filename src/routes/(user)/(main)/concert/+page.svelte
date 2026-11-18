<script lang="ts">
	import ConcertSection from '#lib/components/feature/concert/ConcertSection.svelte';
	import { isMobile } from '#lib/stores';
</script>

<svelte:head>
	<title>INDIG - 공연</title>
</svelte:head>

<main class="concert-container" class:is-mobile={isMobile.current}>
	<ConcertSection />
</main>

<style>
	.concert-container {
		width: 100%;
		max-width: var(--content-max-width);
		margin: 0 auto;
		min-height: calc(100dvh - 60px);
		padding: 1.25rem var(--content-padding-x) 3.5rem;
		box-sizing: border-box;
		color: var(--fg);
	}

	.concert-container.is-mobile {
		padding: 0.75rem var(--content-padding-x-mobile) 2.5rem;
	}

	@media (max-width: 768px) {
		.concert-container {
			padding: 0.75rem var(--content-padding-x-mobile) 2.5rem;
		}
	}
</style>
