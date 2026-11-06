<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { SignupModal } from '#lib/components';
	import { auth, isSignupFlowActive } from '#lib/auth';

	// 카카오 로그인을 거쳐 온 신규 가입자에게만 약관 모달 표시
	let allowed = $state(false);

	onMount(async () => {
		auth.captureXsrfFromUrl();
		// 이미 가입된 로그인 상태면 첫 페이지(/)로 이동
		if (await auth.checkAuth(false)) {
			await goto('/', { replaceState: true });
			return;
		}
		if (!isSignupFlowActive()) {
			await goto('/', { replaceState: true });
			return;
		}
		allowed = true;
	});
</script>

<svelte:head>
	<title>INDIG - 회원가입 약관 동의</title>
</svelte:head>

{#if allowed}
	<SignupModal />
{/if}
