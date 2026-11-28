<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import {
		createSpring,
		createSpringLoop,
		prefersReducedMotion
	} from '#lib/common/type/spring';

	export type PanelBottomCloseIconAnimation = 'default';

	interface Props {
		/** 아이콘 크기 (px) */
		size?: number;
		/** 선 두께 */
		strokeWidth?: number;
		/** 재생할 애니메이션 변형 ('default') */
		animation?: PanelBottomCloseIconAnimation;
		/** 외부 호버/활성 상태 제어 */
		hovered?: boolean;
		/** 마우스 호버 시 애니메이션 자동 재생 여부 */
		animateOnHover?: boolean;
		/** 추가 CSS 클래스 */
		class?: string;
	}

	let {
		size = 24,
		strokeWidth = 2,
		animation: _animation = 'default',
		hovered = false,
		animateOnHover = false,
		class: klass = ''
	}: Props = $props();

	let selfHovered = $state(false);
	let lineEl = $state<SVGLineElement | null>(null);
	let arrowEl = $state<SVGPathElement | null>(null);

	const isActive = $derived(hovered || (animateOnHover && selfHovered));

	// @animate-ui PanelBottomClose: spring (stiffness: 200, damping: 18), y: 0 -> 2
	const offsetY = createSpring(0, 200, 18);

	function renderSpring() {
		const y = offsetY.x;
		const tf = `translateY(${y.toFixed(3)}px)`;
		if (lineEl) lineEl.style.transform = tf;
		if (arrowEl) arrowEl.style.transform = tf;
	}

	const loop = createSpringLoop({
		springs: [offsetY],
		isSettled: () => Math.abs(offsetY.x - offsetY.t) < 0.005 && Math.abs(offsetY.v) < 0.02,
		onFrame: renderSpring
	});

	$effect(() => {
		const target = isActive ? 2 : 0;
		untrack(() => {
			offsetY.t = target;
			if (prefersReducedMotion()) {
				offsetY.x = target;
				offsetY.v = 0;
				renderSpring();
			} else {
				loop.wake();
			}
		});
	});

	onDestroy(() => {
		loop.stop();
	});
</script>

<!-- 하단 패널 닫기 아이콘 (@animate-ui PanelBottomClose spring 200/18 보존) -->
<span
	class="panel-bottom-close-wrap {klass}"
	aria-hidden="true"
	onpointerenter={() => (selfHovered = true)}
	onpointerleave={() => (selfHovered = false)}
>
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width={strokeWidth}
		stroke-linecap="round"
		stroke-linejoin="round"
		class="panel-bottom-close-svg"
	>
		<rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
		<line bind:this={lineEl} x1="3" y1="15" x2="21" y2="15" />
		<path bind:this={arrowEl} d="m15 8-3 3-3-3" />
	</svg>
</span>

<style>
	.panel-bottom-close-wrap {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.panel-bottom-close-svg {
		display: block;
		overflow: visible;
	}
</style>
