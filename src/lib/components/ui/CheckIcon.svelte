<script lang="ts">
	import { untrack } from 'svelte';
	import { prefersReducedMotion } from '#lib/fluid/spring';

	interface Props {
		/** 아이콘 크기 (px) */
		size?: number;
		/** 선 두께 */
		strokeWidth?: number;
		/** 외부 제어 호버/활성 상태 (true로 전환될 때 체크 모션 재생) */
		hovered?: boolean;
		/** 마우스 호버 시 애니메이션 자동 재생 여부 */
		animateOnHover?: boolean;
		/** 클릭 시 애니메이션 자동 재생 여부 */
		animateOnClick?: boolean;
		/** 마운트 시 애니메이션 자동 재생 여부 */
		animateOnMount?: boolean;
		/** 추가 CSS 클래스 */
		class?: string;
	}

	let {
		size = 18,
		strokeWidth = 2,
		hovered = false,
		animateOnHover = false,
		animateOnClick = false,
		animateOnMount = false,
		class: klass = ''
	}: Props = $props();

	let playKey = $state(untrack(() => (animateOnMount && !prefersReducedMotion() ? 1 : 0)));
	let prevHovered = untrack(() => hovered);

	/** 체크 드로잉 모션 재생 (@animate-ui Check default 재현: 0.6s ease-in-out) */
	export function play() {
		if (prefersReducedMotion()) return;
		playKey += 1;
	}

	$effect(() => {
		const nextHovered = hovered;
		untrack(() => {
			if (nextHovered && !prevHovered) {
				play();
			}
			prevHovered = nextHovered;
		});
	});

	function handlePointerEnter() {
		if (animateOnHover) play();
	}

	function handlePointerDown() {
		if (animateOnClick) play();
	}
</script>

<span
	class="check-icon-wrap {klass}"
	aria-hidden="true"
	onpointerenter={handlePointerEnter}
	onpointerdown={handlePointerDown}
>
	{#key playKey}
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
			class="check-icon-svg"
		>
			<path
				d="m4 12 5 5L20 6"
				pathLength="1"
				class="check-icon-path"
				class:is-animating={playKey > 0}
			/>
		</svg>
	{/key}
</span>

<style>
	.check-icon-wrap {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.check-icon-svg {
		display: block;
		overflow: visible;
	}

	.check-icon-path {
		transform-box: fill-box;
		transform-origin: center;
		will-change: transform, opacity, stroke-dashoffset;
	}

	.check-icon-path.is-animating {
		stroke-dasharray: 1;
		animation: check-icon-draw 0.6s ease-in-out both;
	}

	@keyframes check-icon-draw {
		0% {
			stroke-dashoffset: 1;
			opacity: 0;
			transform: scale(1);
		}

		50% {
			transform: scale(1.1);
		}

		100% {
			stroke-dashoffset: 0;
			opacity: 1;
			transform: scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.check-icon-path.is-animating {
			animation: none;
			stroke-dasharray: none;
			stroke-dashoffset: 0;
		}
	}
</style>
