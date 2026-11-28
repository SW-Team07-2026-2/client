<script lang="ts">
	import { prefersReducedMotion } from '#lib/common/type/spring';

	export type UserRoundIconAnimation = 'default';

	interface Props {
		/** 아이콘 크기 (px) */
		size?: number;
		/** 선 두께 */
		strokeWidth?: number;
		/** 재생할 애니메이션 변형 */
		animation?: UserRoundIconAnimation;
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

	/** 사용자 아이콘 바운스 모션 재생 (@animate-ui UserRound default) */
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

<!-- 사용자 원형 아이콘 (@animate-ui UserRound 애니메이션 보존) -->
<span
	class="user-round-wrap {klass}"
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
			class="user-round-svg"
		>
			<path
				class="user-body"
				class:is-animating={playKey > 0 && animation === 'default'}
				d="M20 21a8 8 0 0 0-16 0"
			/>
			<circle
				class="user-head"
				class:is-animating={playKey > 0 && animation === 'default'}
				cx="12"
				cy="8"
				r="5"
			/>
		</svg>
	{/key}
</span>

<style>
	.user-round-wrap {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.user-round-svg {
		display: block;
		overflow: visible;
	}

	.user-body.is-animating {
		animation: user-round-body 0.6s ease-in-out both;
	}

	.user-head.is-animating {
		animation: user-round-head 0.6s ease-in-out both;
	}

	@keyframes user-round-body {
		0% {
			transform: translateY(0);
		}
		33.333% {
			transform: translateY(4px);
		}
		66.667% {
			transform: translateY(-2px);
		}
		100% {
			transform: translateY(0);
		}
	}

	@keyframes user-round-head {
		0% {
			transform: translateY(0);
		}
		33.333% {
			transform: translateY(1px);
		}
		66.667% {
			transform: translateY(-2px);
		}
		100% {
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.user-body.is-animating,
		.user-head.is-animating {
			animation: none;
		}
	}
</style>
