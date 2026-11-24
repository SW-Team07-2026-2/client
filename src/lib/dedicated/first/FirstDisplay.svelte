<script lang="ts">
	import { onMount, untrack, type Snippet } from 'svelte';
	import { getRootSplashContext } from '#lib/dedicated/loading';
	import { FirstDisplayController } from './logic/firstDisplay.svelte';
	import FirstDisplayView from './design/FirstDisplayView.svelte';

	interface Props {
		children?: Snippet;
	}

	let { children }: Props = $props();

	const ctrl = new FirstDisplayController();
	const rootSplash = getRootSplashContext();
	const shouldRunSplash = rootSplash?.initialSplash ?? false;

	let titleWrapEl = $state<HTMLDivElement | undefined>(undefined);
	const showSplash = $derived(rootSplash?.active ?? false);
	const titleRevealed = $derived(rootSplash?.revealed ?? true);

	$effect(() => {
		if (!rootSplash) return;
		const el = titleWrapEl;
		rootSplash.setTargetEl(el, 'fd-title');
		return () => {
			rootSplash.clearTargetEl(el);
		};
	});

	$effect(() => {
		const enabled = !children && !showSplash && ctrl.isLoggedIn && ctrl.isVerified;
		return untrack(() => ctrl.scheduleArtistWarmup(enabled));
	});

	onMount(() => {
		document.documentElement.classList.add('no-scrollbar-gutter');
		const detach = ctrl.attachLifecycle(() => Boolean(children));
		return () => {
			document.documentElement.classList.remove('no-scrollbar-gutter');
			detach();
		};
	});
</script>

<FirstDisplayView
	skipIntro={shouldRunSplash}
	{titleRevealed}
	isLoggedIn={ctrl.isLoggedIn}
	nickname={ctrl.nickname}
	isLoading={ctrl.isLoading}
	bind:titleWrapEl
	onContinue={ctrl.continueToArtist}
	onKakaoLogin={ctrl.startKakaoLogin}
	{children}
/>
