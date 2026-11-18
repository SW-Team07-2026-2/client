<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '#lib/auth';

	let { children }: { children: Snippet } = $props();
	// 현재 세션에서 서버 검증(isVerified)이 완료되었는지 확인.
	// 최초 진입 시에는 서버 검증이 완료될 때까지 자식을 마운트하지 않아 깜빡임 및 크래시를 방지함.
	let isCheckingAuth = $state(!auth.isVerified);

	onMount(() => {
		(async () => {
			const isAuthed = await auth.checkAuth();
			if (!isAuthed || !auth.isLoggedIn) {
				await goto('/', { replaceState: true });
				return;
			}
			isCheckingAuth = false;
		})();
	});

	// 사용 중 세션이 만료/초기화되어 로그아웃 상태로 전환되면 검은 빈 화면에 머무르지 않고 메인으로 이동
	$effect(() => {
		if (!isCheckingAuth && !auth.isLoggedIn) {
			goto('/', { replaceState: true });
		}
	});
</script>

{#if !isCheckingAuth && auth.isLoggedIn}
	{@render children()}
{/if}
