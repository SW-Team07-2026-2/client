<script lang="ts">
	import { prefersReducedMotion } from '#lib/common/type/spring';

	export type SquareArrowOutUpRightIconAnimation = 'default' | 'default-loop';

	interface Props {
		/** 아이콘 크기 (px) */
		size?: number;
		/** 선 두께 */
		strokeWidth?: number;
		/** 재생할 애니메이션 변형 ('default' | 'default-loop') */
		animation?: SquareArrowOutUpRightIconAnimation;
		/** 외부 호버/활성 상태 제어 */
		hovered?: boolean;
		/** 마우스 호버 시 애니메이션 자동 재생 여부 */
		animateOnHover?: boolean;
		/** 클릭 시 애니메이션 자동 재생 여부 */
		animateOnClick?: boolean;
		/** 추가 CSS 클래스 */
		class?: string;
	}

	let {
		size = 24,
		strokeWidth = 2,
		animation = 'default',
		hovered = false,
		animateOnHover = false,
		animateOnClick = false,
		class: klass = ''
	}: Props = $props();

	let selfHovered = $state(false);
	let playKey = $state(0);

	const isActive = $derived(hovered || (animateOnHover && selfHovered));

	/** 루프 모션 수동 재생 */
	export function play() {
		if (prefersReducedMotion()) return;
		playKey += 1;
	}

	let prevHovered = false;
	$effect(() => {
		if (hovered && !prevHovered && animation === 'default-loop') {
			play();
		}
		prevHovered = hovered;
	});

	function handlePointerEnter() {
		selfHovered = true;
		if (animateOnHover && animation === 'default-loop') play();
	}

	function handlePointerLeave() {
		selfHovered = false;
	}

	function handlePointerDown() {
		if (animateOnClick) play();
	}
</script>

<!-- 외부 이동 화살표 아이콘 (@animate-ui SquareArrowOutUpRight default / default-loop 보존) -->
<span
	class="square-arrow-out-wrap {klass}"
	aria-hidden="true"
	onpointerenter={handlePointerEnter}
	onpointerleave={handlePointerLeave}
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
			class="square-arrow-out-svg"
		>
			<g
				class="arrow-group"
				class:is-default-active={animation === 'default' && isActive}
				class:is-default-loop={playKey > 0 && animation === 'default-loop'}
			>
				<path d="m21 3-9 9" />
				<path d="M15 3h6v6" />
			</g>
			<path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" />
		</svg>
	{/key}
</span>

<style>
	.square-arrow-out-wrap {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.square-arrow-out-svg {
		display: block;
		overflow: visible;
	}

	.arrow-group {
		transform: translate(0, 0);
		transition: transform 0.4s ease-in-out;
	}

	.arrow-group.is-default-active {
		transform: translate(2px, -2px);
	}

	.arrow-group.is-default-loop {
		animation: square-arrow-out-loop 0.8s ease-in-out both;
	}

	@keyframes square-arrow-out-loop {
		0%,
		100% {
			transform: translate(0, 0);
		}
		50% {
			transform: translate(2px, -2px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.arrow-group {
			transition: none;
			animation: none;
		}
	}
</style>
