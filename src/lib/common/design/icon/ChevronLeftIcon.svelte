<script lang="ts">
	import { prefersReducedMotion } from '#lib/common/type/spring';

	export type ChevronLeftIconAnimation = 'default' | 'default-loop';

	interface Props {
		/** 아이콘 크기 (px) */
		size?: number;
		/** 선 두께 */
		strokeWidth?: number;
		/** 재생할 애니메이션 변형 ('default' | 'default-loop') */
		animation?: ChevronLeftIconAnimation;
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

<!-- 좌측 꺾쇠 아이콘 (@animate-ui ChevronLeft default / default-loop 보존) -->
<span
	class="chevron-left-wrap {klass}"
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
			class="chevron-left-svg"
		>
			<path
				class="chevron-path"
				class:is-default-active={animation === 'default' && isActive}
				class:is-default-loop={playKey > 0 && animation === 'default-loop'}
				d="m15 18-6-6 6-6"
			/>
		</svg>
	{/key}
</span>

<style>
	.chevron-left-wrap {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.chevron-left-svg {
		display: block;
		overflow: visible;
	}

	.chevron-path {
		transform: translateX(0);
		transition: transform 0.3s ease-in-out;
	}

	.chevron-path.is-default-active {
		transform: translateX(-4px);
	}

	.chevron-path.is-default-loop {
		animation: chevron-left-loop 0.6s ease-in-out both;
	}

	@keyframes chevron-left-loop {
		0%,
		100% {
			transform: translateX(0);
		}
		50% {
			transform: translateX(-4px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.chevron-path {
			transition: none;
			animation: none;
		}
	}
</style>
