<script lang="ts">
	import { prefersReducedMotion } from '#lib/common/type/spring';

	export type ArrowRightIconAnimation =
		| 'default'
		| 'default-loop'
		| 'pointing'
		| 'pointing-loop'
		| 'out';

	interface Props {
		/** 아이콘 크기 (px) */
		size?: number;
		/** 선 두께 */
		strokeWidth?: number;
		/** 재생할 애니메이션 변형 */
		animation?: ArrowRightIconAnimation;
		/** 외부 호버/활성 상태 제어 ('default', 'pointing' 상태 전환 및 loop/out 트리거) */
		hovered?: boolean;
		/** 마우스 호버 시 애니메이션 자동 재생 여부 */
		animateOnHover?: boolean;
		/** 클릭 시 애니메이션 자동 재생 여부 */
		animateOnClick?: boolean;
		/** 추가 CSS 클래스 */
		class?: string;
	}

	let {
		size = 22,
		strokeWidth = 2,
		animation = 'default',
		hovered = false,
		animateOnHover = false,
		animateOnClick = false,
		class: klass = ''
	}: Props = $props();

	let selfHovered = $state(false);
	let playKey = $state(0);

	const isStateful = $derived(animation === 'default' || animation === 'pointing');
	const isActive = $derived(hovered || (animateOnHover && selfHovered));

	/** 원샷/루프 모션 수동 재생 */
	export function play() {
		if (prefersReducedMotion()) return;
		playKey += 1;
	}

	let prevHovered = false;
	$effect(() => {
		if (hovered && !prevHovered && !isStateful) {
			play();
		}
		prevHovered = hovered;
	});

	function handlePointerEnter() {
		selfHovered = true;
		if (animateOnHover && !isStateful) play();
	}

	function handlePointerLeave() {
		selfHovered = false;
	}

	function handlePointerDown() {
		if (animateOnClick) play();
	}
</script>

<!-- 우측 화살표 아이콘 (@animate-ui ArrowRight 전 애니메이션 변형 보존) -->
<span
	class="arrow-right-wrap {klass}"
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
			class="arrow-right-svg"
			class:is-out-clip={animation === 'out'}
		>
			<g
				class="arrow-group"
				class:is-default-active={animation === 'default' && isActive}
				class:is-default-loop={playKey > 0 && animation === 'default-loop'}
				class:is-out={playKey > 0 && animation === 'out'}
			>
				<path
					class="arrow-path1"
					class:is-pointing-active={animation === 'pointing' && isActive}
					class:is-pointing-loop={playKey > 0 && animation === 'pointing-loop'}
					d="M5 12h14"
				/>
				<path
					class="arrow-path2"
					class:is-pointing-active={animation === 'pointing' && isActive}
					class:is-pointing-loop={playKey > 0 && animation === 'pointing-loop'}
					d="m12 5 7 7-7 7"
				/>
			</g>
		</svg>
	{/key}
</span>

<style>
	.arrow-right-wrap {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.arrow-right-svg {
		display: block;
		overflow: visible;
	}

	.arrow-right-svg.is-out-clip {
		overflow: hidden;
	}

	.arrow-group {
		transform-box: fill-box;
		transform: translateX(0);
		transition: transform 0.3s ease-in-out;
	}

	.arrow-group.is-default-active {
		transform: translateX(25%);
	}

	.arrow-group.is-default-loop {
		animation: arrow-right-default-loop 0.6s ease-in-out both;
	}

	.arrow-group.is-out {
		animation: arrow-right-out 0.6s ease-in-out both;
	}

	.arrow-path1 {
		d: path('M5 12h14');
		transition: d 0.3s ease-in-out;
	}

	.arrow-path1.is-pointing-active {
		d: path('M5 12h10');
	}

	.arrow-path1.is-pointing-loop {
		animation: arrow-right-pointing-path1 0.6s ease-in-out both;
	}

	.arrow-path2 {
		d: path('m12 5 7 7-7 7');
		transition: d 0.3s ease-in-out;
	}

	.arrow-path2.is-pointing-active {
		d: path('m8 5 7 7-7 7');
	}

	.arrow-path2.is-pointing-loop {
		animation: arrow-right-pointing-path2 0.6s ease-in-out both;
	}

	@keyframes arrow-right-default-loop {
		0%,
		100% {
			transform: translateX(0);
		}
		50% {
			transform: translateX(25%);
		}
	}

	@keyframes arrow-right-pointing-path1 {
		0%,
		100% {
			d: path('M5 12h14');
		}
		50% {
			d: path('M5 12h10');
		}
	}

	@keyframes arrow-right-pointing-path2 {
		0%,
		100% {
			d: path('m12 5 7 7-7 7');
		}
		50% {
			d: path('m8 5 7 7-7 7');
		}
	}

	@keyframes arrow-right-out {
		0% {
			transform: translateX(0);
		}
		49.99% {
			transform: translateX(150%);
		}
		50% {
			transform: translateX(-150%);
		}
		100% {
			transform: translateX(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.arrow-group,
		.arrow-path1,
		.arrow-path2 {
			transition: none;
			animation: none;
		}
	}
</style>
