<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import {
		setSelectContext,
		type SelectCheckAnimation,
		type SelectOptionMeta
	} from './context';

	interface Props {
		/** 현재 선택된 값 */
		value?: string | null;
		/** 값 변경 콜백 */
		onValueChange?: (value: string) => void;
		/** 미리 등록할 옵션 목록 (미전달 시 SelectItem에서 자동 등록) */
		items?: readonly SelectOptionMeta[];
		/** 체크 아이콘 모션 스타일 ('draw' | 'pop') */
		checkAnimation?: SelectCheckAnimation;
		/** 비활성화 여부 */
		disabled?: boolean;
		/** 추가 CSS 클래스 */
		class?: string;
		children: Snippet;
	}

	let {
		value = $bindable<string | null>(null),
		onValueChange,
		items = [],
		checkAnimation = 'draw',
		disabled = false,
		class: klass = '',
		children
	}: Props = $props();

	const rawUid = $props.id();
	const listId = `select-list-${rawUid.replace(/[^a-zA-Z0-9_-]/g, '')}`;

	let rootEl = $state<HTMLDivElement | null>(null);
	let triggerEl = $state<HTMLButtonElement | null>(null);
	let open = $state(false);
	let highlightedValue = $state<string | null>(null);
	let registeredItems = $state<SelectOptionMeta[]>([]);

	const mergedItems = $derived.by(() => {
		if (registeredItems.length > 0) return registeredItems;
		return [...items];
	});

	function getEnabledItems(): SelectOptionMeta[] {
		return mergedItems.filter((item) => !item.disabled);
	}

	function setOpen(next: boolean) {
		if (disabled && next) return;
		open = next;
		if (next) {
			const enabled = getEnabledItems();
			const cur = enabled.find((item) => item.value === value);
			highlightedValue = cur?.value ?? enabled[0]?.value ?? null;
		} else {
			highlightedValue = null;
		}
	}

	function toggle() {
		setOpen(!open);
	}

	function select(nextValue: string) {
		if (disabled) return;
		value = nextValue;
		onValueChange?.(nextValue);
		setOpen(false);
		triggerEl?.focus();
	}

	function moveHighlight(delta: 1 | -1) {
		const enabled = getEnabledItems();
		if (enabled.length === 0) return;
		const idx = enabled.findIndex((item) => item.value === highlightedValue);
		if (idx < 0) {
			highlightedValue = delta > 0 ? enabled[0].value : enabled[enabled.length - 1].value;
			return;
		}
		const nextIdx = (idx + delta + enabled.length) % enabled.length;
		highlightedValue = enabled[nextIdx].value;
	}

	function highlightEdge(edge: 'first' | 'last') {
		const enabled = getEnabledItems();
		if (enabled.length === 0) return;
		highlightedValue = edge === 'first' ? enabled[0].value : enabled[enabled.length - 1].value;
	}

	setSelectContext({
		get open() {
			return open;
		},
		get value() {
			return value;
		},
		get highlightedValue() {
			return highlightedValue;
		},
		get disabled() {
			return disabled;
		},
		get checkAnimation() {
			return checkAnimation;
		},
		listId,
		getTriggerEl: () => triggerEl,
		setTriggerEl: (el) => {
			triggerEl = el;
		},
		registerItem: (meta) => {
			untrack(() => {
				const idx = registeredItems.findIndex((item) => item.value === meta.value);
				if (idx >= 0) {
					const prev = registeredItems[idx];
					if (prev.label !== meta.label || prev.disabled !== meta.disabled) {
						registeredItems = registeredItems.map((item, i) => (i === idx ? meta : item));
					}
				} else {
					registeredItems = [...registeredItems, meta];
				}
			});
		},
		unregisterItem: (val) => {
			untrack(() => {
				if (registeredItems.some((item) => item.value === val)) {
					registeredItems = registeredItems.filter((item) => item.value !== val);
				}
			});
		},
		getLabel: (val) => {
			if (val === null || val === undefined) return null;
			const fromItems = items.find((item) => item.value === val);
			if (fromItems) return fromItems.label;
			const fromReg = registeredItems.find((item) => item.value === val);
			return fromReg?.label ?? null;
		},
		select,
		setOpen,
		toggle,
		setHighlighted: (val) => {
			highlightedValue = val;
		},
		moveHighlight,
		highlightEdge
	});

	$effect(() => {
		if (!open) return;

		const onPointerDown = (e: PointerEvent) => {
			const target = e.target as Node | null;
			if (!target) return;
			if (rootEl?.contains(target)) return;
			setOpen(false);
		};

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				setOpen(false);
				triggerEl?.focus();
			} else if (e.key === 'ArrowDown') {
				e.preventDefault();
				moveHighlight(1);
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				moveHighlight(-1);
			} else if (e.key === 'Home') {
				e.preventDefault();
				highlightEdge('first');
			} else if (e.key === 'End') {
				e.preventDefault();
				highlightEdge('last');
			} else if (e.key === 'Enter' || e.key === ' ') {
				if (highlightedValue !== null) {
					e.preventDefault();
					select(highlightedValue);
				}
			} else if (e.key === 'Tab') {
				setOpen(false);
			}
		};

		window.addEventListener('pointerdown', onPointerDown, true);
		window.addEventListener('keydown', onKeyDown);
		return () => {
			window.removeEventListener('pointerdown', onPointerDown, true);
			window.removeEventListener('keydown', onKeyDown);
		};
	});
</script>

<!-- Animate UI 스펙 기반 공용 Select 루트 컨테이너 -->
<div bind:this={rootEl} class="aui-select-root {klass}" data-slot="select">
	{@render children()}
</div>

<style>
	.aui-select-root {
		position: relative;
		display: inline-block;
		width: 100%;
	}
</style>
