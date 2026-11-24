import { getContext, setContext } from 'svelte';

const ROOT_SPLASH_CONTEXT_KEY = Symbol('indig-root-splash');

export type SplashTargetVariant = 'fd-title' | 'exact';

export interface RootSplashContext {
	readonly initialSplash: boolean;
	readonly active: boolean;
	readonly revealed: boolean;
	setTargetEl: (el: Element | undefined, variant?: SplashTargetVariant) => void;
	clearTargetEl: (el: Element | undefined) => void;
}

export function setRootSplashContext(context: RootSplashContext): void {
	setContext(ROOT_SPLASH_CONTEXT_KEY, context);
}

export function getRootSplashContext(): RootSplashContext | undefined {
	return getContext<RootSplashContext | undefined>(ROOT_SPLASH_CONTEXT_KEY);
}
