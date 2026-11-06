<script lang="ts">
	// 마이페이지 (My Page)
	import { goto } from '$app/navigation';
	import { auth } from '#lib/auth';

	async function handleLogout() {
		await auth.logout();
		await goto('/', { replaceState: true });
	}
</script>

<svelte:head>
	<title>INDIG - 마이페이지</title>
</svelte:head>

<main class="page-container">
	<h1>마이페이지 (My Page)</h1>
	{#if auth.user}
		<p class="user-greeting">{auth.user.nickname ?? '회원'}님의 개인 설정 및 보관함입니다.</p>
		<button type="button" class="logout-btn" onclick={handleLogout}>로그아웃</button>
	{/if}
</main>

<style>
	.page-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: calc(100dvh - 60px);
		padding: 2rem;
		text-align: center;
		color: #ffffff;
	}

	.user-greeting {
		color: #a1a1aa;
		font-size: 1rem;
		margin-top: 0.5rem;
	}

	.logout-btn {
		margin-top: 1.5rem;
		padding: 0.55rem 1.25rem;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.16);
		background: rgba(255, 255, 255, 0.06);
		color: #e4e4e7;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition:
			background 0.18s ease,
			border-color 0.18s ease;
	}

	.logout-btn:hover {
		background: rgba(255, 255, 255, 0.12);
		border-color: rgba(255, 255, 255, 0.28);
	}
</style>

