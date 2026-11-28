<script lang="ts">
	import { page } from '$app/state';
	import { BookingPage } from '#lib/dedicated/booking';

	const concertId = $derived.by(() => {
		const raw = Number(page.params.id);
		return Number.isInteger(raw) && raw > 0 ? raw : 0;
	});
</script>

<svelte:head>
	<title>INDIG - 공연 예매</title>
</svelte:head>

{#if concertId > 0}
	<BookingPage {concertId} />
{/if}
