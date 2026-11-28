<script lang="ts">
	import { prefersReducedMotion } from '#lib/common/type/spring';

	export type TicketIconAnimation = 'default';

	interface Props {
		/** 아이콘 크기 (px) */
		size?: number;
		/** 선 두께 */
		strokeWidth?: number;
		/** 재생할 애니메이션 변형 */
		animation?: TicketIconAnimation;
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

	/** 티켓 틸트·리프트 모션 재생 */
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

<!-- 공연 티켓 아이콘 (공연 예매 내역용 · 호버 시 틸트 리프트) -->
<span
	class="ticket-icon-wrap {klass}"
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
			class="ticket-icon-svg"
		>
			<g class="ticket-group" class:is-animating={playKey > 0 && animation === 'default'}>
				<path
					d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"
				/>
				<path d="M13 5v2" />
				<path d="M13 17v2" />
				<path d="M13 11v2" />
			</g>
		</svg>
	{/key}
</span>

<style>
	.ticket-icon-wrap {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.ticket-icon-svg {
		display: block;
		overflow: visible;
	}

	.ticket-group {
		transform-box: fill-box;
		transform-origin: center center;
	}

	.ticket-group.is-animating {
		animation: ticket-tilt 0.65s ease-in-out both;
	}

	@keyframes ticket-tilt {
		0% {
			transform: translateY(0) rotate(0deg);
		}
		35% {
			transform: translateY(-1.6px) rotate(-10deg);
		}
		70% {
			transform: translateY(-0.4px) rotate(5deg);
		}
		100% {
			transform: translateY(0) rotate(0deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.ticket-group.is-animating {
			animation: none;
		}
	}
</style>
