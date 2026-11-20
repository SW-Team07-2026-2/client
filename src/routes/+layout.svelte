<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';
	import { onNavigate } from '$app/navigation';
	import { FdToast } from '#lib/components';
	import { toast } from '#lib/stores';

	let { children }: LayoutProps = $props();

	// 로고 모핑이 필요한 진입/인트로 경로(/, /welcome) 간 전환 시에만 View Transition 활성화
	const LOGO_TRANSITION_PATHS = new Set(['/', '/welcome']);

	onNavigate((navigation) => {
		// SPA 내부 이동이 한 번이라도 발생하면 이후 '/' 진입 시 초기 스플래시를 다시 띄우지 않음
		(window as Window & { __indigRootSplashDone?: boolean }).__indigRootSplashDone = true;

		if (!document.startViewTransition) return;

		const fromPath = navigation.from?.url.pathname ?? '';
		const toPath = navigation.to?.url.pathname ?? '';
		if (fromPath === toPath) return;

		// 일반 메뉴 탭(/artist, /concert, /album, /goods 등) 간 이동 시에는 즉시 전환되도록 스킵
		if (!LOGO_TRANSITION_PATHS.has(fromPath) && !LOGO_TRANSITION_PATHS.has(toPath)) {
			return;
		}

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<FdToast
	bind:open={toast.open}
	type={toast.type}
	message={toast.message}
	duration={toast.duration}
	trigger={toast.triggerId}
/>
