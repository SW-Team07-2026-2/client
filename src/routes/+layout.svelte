<script lang="ts">
	import { flushSync, tick } from 'svelte';
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';
	import { onNavigate } from '$app/navigation';
	import { FdToast } from '#lib/components';
	import { artistTransition, toast } from '#lib/stores';

	let { children }: LayoutProps = $props();

	// 로고 모핑이 필요한 진입/인트로 경로(/, /welcome) 간 전환 시에만 View Transition 활성화
	const LOGO_TRANSITION_PATHS = new Set(['/', '/welcome']);

	function matchArtistDetailId(pathname: string): number | null {
		const m = /^\/artist\/(\d+)\/?$/.exec(pathname);
		return m ? Number(m[1]) : null;
	}

	onNavigate((navigation) => {
		// SPA 내부 이동이 한 번이라도 발생하면 이후 '/' 진입 시 초기 스플래시를 다시 띄우지 않음
		(window as Window & { __indigRootSplashDone?: boolean }).__indigRootSplashDone = true;

		if (!document.startViewTransition) return;

		const fromPath = navigation.from?.url.pathname ?? '';
		const toPath = navigation.to?.url.pathname ?? '';
		if (fromPath === toPath) return;

		const toArtistId = matchArtistDetailId(toPath);
		const fromArtistId = matchArtistDetailId(fromPath);
		const isArtistEnter = fromPath === '/artist' && toArtistId !== null;
		const isArtistLeave = fromArtistId !== null && toPath === '/artist';

		if (isArtistEnter && toArtistId !== null) {
			artistTransition.syncOriginFromDom(toArtistId);
			artistTransition.beginTransition('entering', toArtistId);
			flushSync();

			return new Promise((resolve) => {
				const transition = document.startViewTransition(async () => {
					resolve();
					await navigation.complete;
					await tick();
				});
				transition.finished.finally(() => {
					artistTransition.clearTransition();
				});
			});
		}

		if (isArtistLeave && fromArtistId !== null) {
			artistTransition.beginTransition('leaving', fromArtistId);
			flushSync();

			return new Promise((resolve) => {
				const transition = document.startViewTransition(async () => {
					resolve();
					await navigation.complete;
					await tick();
					// 복귀 시 스크롤 복원이 끝난 뒤 실제 카드 위치로 축소 원점 재계산
					artistTransition.syncOriginFromDom(fromArtistId);
				});
				transition.finished.finally(() => {
					artistTransition.clearTransition();
				});
			});
		}

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
