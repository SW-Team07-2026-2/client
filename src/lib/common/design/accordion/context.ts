import { getContext, setContext } from 'svelte';

export interface AccordionContext {
	isOpen: (value: string) => boolean;
	toggle: (value: string) => void;
}

const ACCORDION_CONTEXT_KEY = Symbol('accordion-context');

export function setAccordionContext(ctx: AccordionContext): void {
	setContext(ACCORDION_CONTEXT_KEY, ctx);
}

export function getAccordionContext(): AccordionContext | undefined {
	return getContext<AccordionContext | undefined>(ACCORDION_CONTEXT_KEY);
}
