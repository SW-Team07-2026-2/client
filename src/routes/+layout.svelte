<script lang="ts">
	import '#lib/config/layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';
	import { onNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import ToastViewport from '#lib/common/design/toast/ToastViewport.svelte';
	import { isMobile, useAnalytics } from '#lib/common/logic';
	import {
		LoadingSplash,
		setRootSplashContext,
		type SplashTargetVariant
	} from '#lib/dedicated/loading';

	let { children }: LayoutProps = $props();

	type SplashWindow = Window & { __indigRootSplashDone?: boolean };
	const initialSplash =
		page.url.pathname === '/' &&
		(typeof window === 'undefined' ? true : !(window as SplashWindow).__indigRootSplashDone);

	let showSplash = $state(initialSplash);
	let titleRevealed = $state(!initialSplash);
	let splashTargetEl = $state<Element | undefined>(undefined);
	let splashTargetVariant = $state<SplashTargetVariant>('fd-title');

	function handleSplashReveal() {
		titleRevealed = true;
	}

	function handleSplashDone() {
		if (typeof window !== 'undefined') {
			(window as SplashWindow).__indigRootSplashDone = true;
		}
		showSplash = false;
	}

	setRootSplashContext({
		get initialSplash() {
			return initialSplash;
		},
		get active() {
			return showSplash;
		},
		get revealed() {
			return titleRevealed;
		},
		setTargetEl(el, variant = 'fd-title') {
			splashTargetEl = el;
			splashTargetVariant = variant;
		},
		clearTargetEl(el) {
			if (!el || splashTargetEl === el) {
				splashTargetEl = undefined;
			}
		}
	});

	$effect(() => {
		if (typeof document === 'undefined') return;
		document.documentElement.classList.toggle('is-pc', !isMobile.current);
	});

	// GA4 user_id(회원 번호) · 상세 조회 · 머문 시간 — 운영 주소에서만 (#lib/common/logic/useAnalytics)
	useAnalytics();

	// 로고 모핑이 필요한 진입/인트로 경로(/, /welcome) 간 전환 시에만 View Transition 활성화
	const LOGO_TRANSITION_PATHS = new Set(['/', '/welcome']);

	onNavigate((navigation) => {
		// SPA 내부 이동이 한 번이라도 발생하면 이후 '/' 진입 시 초기 스플래시를 다시 띄우지 않음
		(window as SplashWindow).__indigRootSplashDone = true;

		// 초기 스플래시가 화면을 덮고 있는 동안의 백그라운드 선행 이동은 즉시 전환
		if (showSplash) return;

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

{#if showSplash}
	<LoadingSplash
		targetEl={splashTargetEl}
		targetGlyphRatio={splashTargetVariant === 'exact' ? 1 : undefined}
		onreveal={handleSplashReveal}
		ondone={handleSplashDone}
	/>
{/if}

<ToastViewport swipeDirection={['down', 'left']} progressBar={true} />
