<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { auth } from '#lib/auth';

	// G1 소셜 로그인 실패 시 백엔드가 /login 으로 리다이렉트하므로
	// 세션을 정리하고 메인 로그인 화면(/)으로 이동
	onMount(() => {
		auth.clearAuth();
		goto('/', { replaceState: true });
	});
</script>

