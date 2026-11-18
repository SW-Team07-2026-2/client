<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { toast } from '#lib/stores';

	onMount(() => {
		if (page.status === 404) {
			const missingPath = page.url.pathname;
			toast.error(`${missingPath} 페이지는 존재하지 않는 페이지 입니다.`);
			goto('/', { replaceState: true });
		}
	});
</script>

{#if page.status !== 404}
	<main class="error-page">
		<h1>{page.status}</h1>
		<p>{page.error?.message ?? '오류가 발생했습니다.'}</p>
		<button type="button" onclick={() => goto('/', { replaceState: true })}>홈으로 돌아가기</button>
	</main>
{/if}

<style>
	.error-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 100dvh;
		gap: 0.75rem;
		padding: 2rem;
		text-align: center;
		color: var(--fg);
	}

	h1 {
		margin: 0;
		font-size: 2.5rem;
		font-weight: 700;
		color: var(--white);
	}

	p {
		margin: 0;
		color: var(--muted);
		font-size: 0.95rem;
	}

	button {
		margin-top: 0.75rem;
		padding: 0.6rem 1.25rem;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--surface-2);
		color: var(--fg);
		font-size: 0.875rem;
		cursor: pointer;
	}
</style>
