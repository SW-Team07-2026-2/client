<script lang="ts">
	import { onDestroy } from 'svelte';

	interface Props {
		/** 아이콘 크기 (px) */
		size?: number;
		/** 선 두께 */
		strokeWidth?: number;
		/** 호버 시 자동 울림 여부 */
		animateOnHover?: boolean;
		/** 외부 제어 호버 상태 */
		hovered?: boolean;
		/** 추가 CSS 클래스 */
		class?: string;
	}

	let {
		size = 22,
		strokeWidth = 2,
		animateOnHover = false,
		hovered = false,
		class: className = ''
	}: Props = $props();

	let svgEl: SVGSVGElement | undefined = $state(undefined);
	let clapperEl: SVGPathElement | undefined = $state(undefined);
	let activeAnims: Animation[] = [];

	function prefersReducedMotion(): boolean {
		return (
			typeof window !== 'undefined' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		);
	}

	function cancelActiveAnimations() {
		for (const anim of activeAnims) {
			anim.cancel();
		}
		activeAnims = [];
	}

	/** 종 흔들림 및 추 좌우 진동(@animate-ui default) 애니메이션 실행 */
	export function ring() {
		if (!svgEl || !clapperEl || prefersReducedMotion()) return;
		cancelActiveAnimations();

		const bellAnim = svgEl.animate(
			[
				{ transform: 'rotate(0deg)' },
				{ transform: 'rotate(20deg)' },
				{ transform: 'rotate(-10deg)' },
				{ transform: 'rotate(10deg)' },
				{ transform: 'rotate(-5deg)' },
				{ transform: 'rotate(3deg)' },
				{ transform: 'rotate(0deg)' }
			],
			{
				duration: 900,
				easing: 'ease-in-out'
			}
		);

		const clapperAnim = clapperEl.animate(
			[
				{ transform: 'translateX(0px)' },
				{ transform: 'translateX(-6px)' },
				{ transform: 'translateX(5px)' },
				{ transform: 'translateX(-5px)' },
				{ transform: 'translateX(4px)' },
				{ transform: 'translateX(-3px)' },
				{ transform: 'translateX(2px)' },
				{ transform: 'translateX(0px)' }
			],
			{
				duration: 1100,
				easing: 'ease-in-out'
			}
		);

		activeAnims = [bellAnim, clapperAnim];
		void Promise.allSettled([bellAnim.finished, clapperAnim.finished]).then(() => {
			if (activeAnims[0] === bellAnim) {
				activeAnims = [];
			}
		});
	}

	$effect(() => {
		if (animateOnHover && hovered) {
			ring();
		}
	});

	onDestroy(() => {
		cancelActiveAnimations();
	});
</script>

<svg
	bind:this={svgEl}
	xmlns="http://www.w3.org/2000/svg"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={strokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
	class="bell-icon {className}"
	aria-hidden="true"
>
	<path bind:this={clapperEl} class="bell-clapper" d="M10.268 21a2 2 0 0 0 3.464 0" />
	<path
		d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"
	/>
</svg>

<style>
	.bell-icon {
		display: block;
		overflow: visible;
		transform-origin: top center;
		will-change: transform;
	}

	.bell-clapper {
		will-change: transform;
	}
</style>
