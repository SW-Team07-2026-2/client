<script lang="ts">
	import { prefersReducedMotion } from '#lib/common/type/spring';

	export type TruckIconAnimation = 'default';

	interface Props {
		/** 아이콘 크기 (px) */
		size?: number;
		/** 선 두께 */
		strokeWidth?: number;
		/** 재생할 애니메이션 변형 */
		animation?: TruckIconAnimation;
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

	/** 배송 트럭 주행·바운스 모션 재생 */
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

<!-- 배송 트럭 아이콘 (주문/배송 내역용 · 호버 시 주행 바운스) -->
<span
	class="truck-icon-wrap {klass}"
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
			class="truck-icon-svg"
		>
			<g class="truck-group" class:is-animating={playKey > 0 && animation === 'default'}>
				<g class="truck-body" class:is-animating={playKey > 0 && animation === 'default'}>
					<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
					<path d="M15 18H9" />
					<path
						d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"
					/>
				</g>
				<circle cx="17" cy="18" r="2" />
				<circle cx="7" cy="18" r="2" />
			</g>
		</svg>
	{/key}
</span>

<style>
	.truck-icon-wrap {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.truck-icon-svg {
		display: block;
		overflow: visible;
	}

	.truck-group.is-animating {
		animation: truck-drive 0.65s ease-in-out both;
	}

	.truck-body {
		transform-box: fill-box;
		transform-origin: center bottom;
	}

	.truck-body.is-animating {
		animation: truck-chassis-bounce 0.65s ease-in-out both;
	}

	@keyframes truck-drive {
		0% {
			transform: translateX(0);
		}
		40% {
			transform: translateX(2.5px);
		}
		75% {
			transform: translateX(-0.6px);
		}
		100% {
			transform: translateX(0);
		}
	}

	@keyframes truck-chassis-bounce {
		0%,
		100% {
			transform: translateY(0);
		}
		25% {
			transform: translateY(-1.2px);
		}
		55% {
			transform: translateY(0.5px);
		}
		80% {
			transform: translateY(-0.5px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.truck-group.is-animating,
		.truck-body.is-animating {
			animation: none;
		}
	}
</style>
