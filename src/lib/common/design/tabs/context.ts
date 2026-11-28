import { getContext, setContext } from 'svelte';

export type TabsOrientation = 'horizontal' | 'vertical';
export type TabsListVariant = 'default' | 'line';

export interface TabsContext {
	readonly value: string;
	readonly orientation: TabsOrientation;
	readonly direction: 1 | -1;
	register: (val: string) => void;
	unregister: (val: string) => void;
	select: (val: string) => void;
	getOrderedValues: () => readonly string[];
}

const TABS_CONTEXT_KEY = Symbol('indig-animate-ui-tabs');

export function setTabsContext(ctx: TabsContext): void {
	setContext(TABS_CONTEXT_KEY, ctx);
}

export function getTabsContext(): TabsContext | undefined {
	return getContext<TabsContext | undefined>(TABS_CONTEXT_KEY);
}
