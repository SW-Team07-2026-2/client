import { getContext, setContext } from 'svelte';

export type SelectCheckAnimation = 'draw' | 'pop';

export interface SelectOptionMeta {
	value: string;
	label: string;
	disabled?: boolean;
}

export interface SelectContextValue {
	readonly open: boolean;
	readonly value: string | null;
	readonly highlightedValue: string | null;
	readonly disabled: boolean;
	readonly checkAnimation: SelectCheckAnimation;
	readonly listId: string;
	getTriggerEl: () => HTMLButtonElement | null;
	setTriggerEl: (el: HTMLButtonElement | null) => void;
	registerItem: (meta: SelectOptionMeta) => void;
	unregisterItem: (value: string) => void;
	getLabel: (value: string | null) => string | null;
	select: (value: string) => void;
	setOpen: (next: boolean) => void;
	toggle: () => void;
	setHighlighted: (value: string | null) => void;
	moveHighlight: (delta: 1 | -1) => void;
	highlightEdge: (edge: 'first' | 'last') => void;
}

const SELECT_CONTEXT_KEY = Symbol('indig:select');

export function setSelectContext(ctx: SelectContextValue): void {
	setContext(SELECT_CONTEXT_KEY, ctx);
}

export function useSelectContext(): SelectContextValue {
	const ctx = getContext<SelectContextValue | undefined>(SELECT_CONTEXT_KEY);
	if (!ctx) {
		throw new Error('Select 하위 컴포넌트는 <Select> 내부에서만 사용할 수 있습니다.');
	}
	return ctx;
}
