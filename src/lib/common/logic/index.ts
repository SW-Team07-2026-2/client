export { bgm } from './bgmManager.svelte';
export { isMobile, BREAKPOINTS } from './isMobile.svelte';
export { toast } from './toast.svelte';
export {
	getRootSplashContext,
	setRootSplashContext,
	type RootSplashContext,
	type SplashTargetVariant
} from './rootSplash';
export {
	catalogFeed,
	buildCatalogRequestKey,
	isCatalogCategoryReady,
	resolveCatalogCategoryFromPath,
	type ArtistFeedSnapshot
} from './catalogFeedState.svelte';
export {
	artistDetailState,
	type ArtistExpandOrigin,
	type ExpandOriginRect
} from './artistDetailState.svelte';
export {
	detailOverlay,
	parseCatalogDetailRoute,
	isCatalogDetailPath,
	type CategoryDetailSlot,
	type DetailMorphSeed,
	type DetailPhase,
	type DetailRect
} from './detailOverlayState.svelte';
