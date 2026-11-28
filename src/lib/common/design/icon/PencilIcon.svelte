<script lang="ts">
	import { prefersReducedMotion } from '#lib/common/type/spring';

	export type PencilIconAnimation = 'default';

	interface Props {
		/** 아이콘 크기 (px) */
		size?: number;
		/** 선 두께 */
		strokeWidth?: number;
		/** 재생할 애니메이션 변형 */
		animation?: PencilIconAnimation;
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

	/** 연필 필기 모션 수동 재생 */
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

<!-- 연필 아이콘 (@animate-ui Pencil 필기 진동 모션 보존) -->
<span
	class="pencil-icon-wrap {klass}"
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
			class="pencil-icon-svg"
		>
			<g class="pencil-group" class:is-animating={playKey > 0 && animation === 'default'}>
				<path
					d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"
				/>
				<path d="m15 5 4 4" />
			</g>
		</svg>
	{/key}
</span>

<style>
	.pencil-icon-wrap {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.pencil-icon-svg {
		display: block;
		overflow: visible;
	}

	.pencil-group.is-animating {
		animation: pencil-write 0.8s ease-in-out both;
	}

	@keyframes pencil-write {
		0% {
			transform: translate(0, 0);
		}
		20% {
			transform: translate(-1px, 1px);
		}
		40% {
			transform: translate(0.5px, -0.5px);
		}
		60% {
			transform: translate(-1px, 1px);
		}
		80% {
			transform: translate(0.5px, -0.5px);
		}
		100% {
			transform: translate(0, 0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pencil-group.is-animating {
			animation: none;
		}
	}
</style>
