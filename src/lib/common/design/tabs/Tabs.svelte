<script lang="ts">
	import type { Snippet } from 'svelte';
	import { untrack } from 'svelte';
	import { setTabsContext, type TabsOrientation } from './context';

	interface Props {
		/** 제어 선택 값 */
		value?: string;
		/** 비제어 초기 선택 값 */
		defaultValue?: string;
		/** 탭 방향 (가로/세로 — 패널 전환 방향 결정) */
		orientation?: TabsOrientation;
		/** 명시적 탭 순서 (외부 사이드바 등과 결합해 패널 전환만 쓸 때 방향 계산용) */
		order?: readonly string[];
		/** 값 변경 콜백 */
		onValueChange?: (value: string) => void;
		/** 추가 CSS 클래스 */
		class?: string;
		children: Snippet;
	}

	let {
		value,
		defaultValue = '',
		orientation = 'horizontal',
		order,
		onValueChange,
		class: klass = '',
		children
	}: Props = $props();

	let internalValue = $state(untrack(() => value ?? defaultValue));
	let registeredValues: string[] = [];
	let direction = $state<1 | -1>(1);
	let lastTrackedValue = untrack(() => value ?? defaultValue);

	const activeValue = $derived(value !== undefined ? value : internalValue);

	function getOrderedValues(): readonly string[] {
		if (order && order.length > 0) return order;
		return registeredValues;
	}

	function computeDirection(prevVal: string, nextVal: string): 1 | -1 {
		const list = getOrderedValues();
		const prevIdx = list.indexOf(prevVal);
		const nextIdx = list.indexOf(nextVal);
		if (prevIdx !== -1 && nextIdx !== -1 && prevIdx !== nextIdx) {
			return nextIdx > prevIdx ? 1 : -1;
		}
		return 1;
	}

	$effect.pre(() => {
		const next = activeValue;
		if (next !== lastTrackedValue) {
			direction = computeDirection(lastTrackedValue, next);
			lastTrackedValue = next;
		}
	});

	function register(val: string) {
		if (!registeredValues.includes(val)) {
			registeredValues = [...registeredValues, val];
		}
	}

	function unregister(val: string) {
		if (registeredValues.includes(val)) {
			registeredValues = registeredValues.filter((v) => v !== val);
		}
	}

	function select(nextVal: string) {
		if (nextVal === activeValue) return;
		direction = computeDirection(activeValue, nextVal);
		lastTrackedValue = nextVal;
		if (value === undefined) {
			internalValue = nextVal;
		}
		onValueChange?.(nextVal);
	}

	setTabsContext({
		get value() {
			return activeValue;
		},
		get orientation() {
			return orientation;
		},
		get direction() {
			return direction;
		},
		register,
		unregister,
		select,
		getOrderedValues
	});
</script>

<!-- Animate UI Base UI Tabs 루트 (순수 UI 컴포넌트) -->
<div
	data-slot="tabs"
	data-orientation={orientation}
	class="ui-tabs {klass}"
>
	{@render children()}
</div>

<style>
	.ui-tabs {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 100%;
	}
</style>
