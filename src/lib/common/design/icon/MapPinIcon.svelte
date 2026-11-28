<script lang="ts">
	import { prefersReducedMotion } from '#lib/common/type/spring';

	export type MapPinIconAnimation = 'default' | 'wiggle' | 'rotate';

	interface Props {
		/** 아이콘 크기 (px) */
		size?: number;
		/** 선 두께 */
		strokeWidth?: number;
		/** 재생할 애니메이션 변형 ('default' | 'wiggle' | 'rotate') */
		animation?: MapPinIconAnimation;
		/** 외부 호버/활성 상태 트리거 (false -> true 전환 시 1회 재생) */
		hovered?: boolean;
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
		hovered = false,
		animateOnHover = false,
		animateOnClick = false,
		class: klass = ''
	}: Props = $props();

	let playKey = $state(0);

	/** 맵 핀 애니메이션 수동 재생 */
	export function play() {
		if (prefersReducedMotion()) return;
		playKey += 1;
	}

	let prevHovered = false;
	$effect(() => {
		if (hovered && !prevHovered) {
			play();
		}
		prevHovered = hovered;
	});

	function handlePointerEnter() {
		if (animateOnHover) play();
	}

	function handlePointerDown() {
		if (animateOnClick) play();
	}
</script>

<!-- 지도 핀 아이콘 (@animate-ui MapPin default / wiggle / rotate 보존) -->
<span
	class="map-pin-wrap {klass}"
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
			class="map-pin-svg"
		>
			<g
				class="map-pin-group"
				class:is-default={playKey > 0 && animation === 'default'}
				class:is-wiggle={playKey > 0 && animation === 'wiggle'}
				class:is-rotate={playKey > 0 && animation === 'rotate'}
			>
				<circle cx="12" cy="10" r="3" />
				<path
					d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"
				/>
			</g>
		</svg>
	{/key}
</span>

<style>
	.map-pin-wrap {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.map-pin-svg {
		display: block;
		overflow: visible;
	}

	.map-pin-group {
		transform-box: fill-box;
		transform-origin: center bottom;
	}

	.map-pin-group.is-default {
		animation: map-pin-default 1s ease-in-out both;
	}

	.map-pin-group.is-wiggle {
		animation: map-pin-wiggle 1s ease-in-out both;
	}

	.map-pin-group.is-rotate {
		transform-origin: center center;
		animation: map-pin-rotate 0.7s ease-in-out both;
	}

	@keyframes map-pin-default {
		0% {
			transform: translateY(0) scale(1) rotate(0deg);
		}
		33.333% {
			transform: translateY(-6px) scale(0.75) rotate(30deg);
		}
		66.667% {
			transform: translateY(0) scale(1) rotate(-15deg);
		}
		100% {
			transform: translateY(0) scale(1) rotate(0deg);
		}
	}

	@keyframes map-pin-wiggle {
		0% {
			transform: rotate(0deg);
		}
		33.333% {
			transform: rotate(12deg);
		}
		66.667% {
			transform: rotate(-10deg);
		}
		100% {
			transform: rotate(0deg);
		}
	}

	@keyframes map-pin-rotate {
		0% {
			transform: perspective(600px) rotate3d(0, 1, 0, 0deg);
		}
		100% {
			transform: perspective(600px) rotate3d(0, 1, 0, 360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.map-pin-group.is-default,
		.map-pin-group.is-wiggle,
		.map-pin-group.is-rotate {
			animation: none;
		}
	}
</style>
