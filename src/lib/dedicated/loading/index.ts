export { default as LoadingSplash } from './LoadingSplash.svelte';
export { default as LoadingSplashView } from './design/LoadingSplashView.svelte';
export { BlockOrbitSpinner as LoadingSpinner } from '#lib/common/design/icon/spinner';
export { LoadingSplashController, type SplashPhase } from './logic/loadingSplash.svelte';
export {
	getRootSplashContext,
	setRootSplashContext,
	type RootSplashContext,
	type SplashTargetVariant
} from './logic/rootSplash';
