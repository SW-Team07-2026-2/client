export { default as LoadingSplash } from './LoadingSplash.svelte';
export { default as LoadingSplashView } from './design/LoadingSplashView.svelte';
export { default as LoadingSpinner } from './design/LoadingSpinner.svelte';
export { LoadingSplashController, type SplashPhase } from './logic/loadingSplash.svelte';
export {
	getRootSplashContext,
	setRootSplashContext,
	type RootSplashContext,
	type SplashTargetVariant
} from './logic/rootSplash';
