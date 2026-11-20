<script lang="ts">
	import { prefersReducedMotion } from '#lib/fluid/spring';

	export type SearchIconAnimation = 'default' | 'find';

	interface Props {
		/** 아이콘 크기 (px) */
		size?: number;
		/** 선 두께 */
		strokeWidth?: number;
		/** 재생할 애니메이션 변형 ('default': 손잡이 회전 흔들림, 'find': 탐색 이동) */
		animation?: SearchIconAnimation;
		/** 마우스 호버 시 애니메이션 자동 재생 여부 */
		animateOnHover?: boolean;
		/** 클릭 시 애니메이션 자동 재생 여부 */
		animateOnClick?: boolean;
		/** 추가 CSS 클래스 */
		class?: string;
	}

	let {
		size = 18,
		strokeWidth = 2,
		animation = 'default',
		animateOnHover = false,
		animateOnClick = false,
		class: klass = ''
	}: Props = $props();

	let playKey = $state(0);

	/** 돋보기 모션 재생 (@animate-ui Search default / find 재현) */
	export function play() {
		if (prefersReducedMotion()) return;
		playKey += 1;
	}

	function handlePointerEnter() {
		if (animateOnHover) play();
	}

	function handlePointerDown() {
		if (animateOnClick) play();
	}
</script>

<span
	class="search-icon-wrap {klass}"
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
			class="search-icon-svg"
			class:is-animating-default={playKey > 0 && animation === 'default'}
			class:is-animating-find={playKey > 0 && animation === 'find'}
		>
			<path d="m21 21-4.34-4.34" />
			<circle cx="11" cy="11" r="8" />
		</svg>
	{/key}
</span>

<style>
	.search-icon-wrap {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.search-icon-svg {
		display: block;
		overflow: visible;
		transform-origin: bottom right;
		will-change: transform;
	}

	.search-icon-svg.is-animating-default {
		transform-origin: bottom right;
		animation: search-icon-default 0.8s ease-in-out both;
	}

	.search-icon-svg.is-animating-find {
		transform-origin: center;
		animation: search-icon-find 1s ease-in-out both;
	}

	@keyframes search-icon-default {
		0% {
			transform: rotate(0deg);
		}
		20% {
			transform: rotate(17deg);
		}
		40% {
			transform: rotate(-10deg);
		}
		60% {
			transform: rotate(5deg);
		}
		80% {
			transform: rotate(-1deg);
		}
		100% {
			transform: rotate(0deg);
		}
	}

	@keyframes search-icon-find {
		0% {
			transform: translate3d(0, 0, 0);
		}
		33.333% {
			transform: translate3d(-15%, 0, 0);
		}
		66.667% {
			transform: translate3d(0, -15%, 0);
		}
		100% {
			transform: translate3d(0, 0, 0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.search-icon-svg.is-animating-default,
		.search-icon-svg.is-animating-find {
			animation: none;
		}
	}
</style>
