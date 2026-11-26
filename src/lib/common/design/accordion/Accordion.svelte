<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import { setAccordionContext } from './context';

	interface Props {
		/** 동시에 여러 항목을 열 수 있는지 여부 (기본: true) */
		multiple?: boolean;
		/** 초기 열려 있을 항목 value 목록 (기본: [] = 모두 닫힘) */
		defaultValues?: readonly string[];
		children: Snippet;
	}

	let { multiple = true, defaultValues = [], children }: Props = $props();

	let openValues = $state<string[]>([...untrack(() => defaultValues)]);

	setAccordionContext({
		isOpen: (value: string) => openValues.includes(value),
		toggle: (value: string) => {
			if (openValues.includes(value)) {
				openValues = openValues.filter((v) => v !== value);
				return;
			}
			openValues = multiple ? [...openValues, value] : [value];
		}
	});
</script>

<!-- 공용 아코디언 컨테이너 (다중/단일 펼침 지원, 순수 렌더링) -->
<div class="accordion-root">
	{@render children()}
</div>

<style>
	.accordion-root {
		display: flex;
		flex-direction: column;
		width: 100%;
	}
</style>
