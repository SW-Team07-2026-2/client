<script lang="ts">
	interface Props {
		size?: number;
		strokeWidth?: number;
		/** 외부 호버/선택 상태 트리거 (FilterChipPart 등 기존 호환용) */
		hovered?: boolean;
		/** 애니메이션 직접 트리거 */
		animating?: boolean;
		class?: string;
	}

	let {
		size = 18,
		strokeWidth = 2.2,
		hovered = false,
		animating = false,
		class: className = ''
	}: Props = $props();

	const isAnimating = $derived(animating || hovered);
</script>

<!-- 체크 SVG 아이콘 (pathLength 0→1 그리기 + scale 1→1.1→1 애니메이션) -->
<svg
	class="check-icon-svg {className}"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={strokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	<path
		class="check-path"
		class:is-animating={isAnimating}
		pathLength="1"
		d="m4 12 5 5L20 6"
	/>
</svg>

<style>
	.check-icon-svg {
		display: block;
		flex-shrink: 0;
		overflow: visible;
	}

	.check-path {
		transform-box: fill-box;
		transform-origin: center;
		stroke-dasharray: 1;
		stroke-dashoffset: 0;
		opacity: 1;
		transform: scale(1);
	}

	.check-path.is-animating {
		animation: check-draw-pop 0.6s ease-in-out forwards;
	}

	@keyframes check-draw-pop {
		0% {
			stroke-dashoffset: 1;
			opacity: 0;
			transform: scale(1);
		}
		50% {
			opacity: 1;
			transform: scale(1.1);
		}
		100% {
			stroke-dashoffset: 0;
			opacity: 1;
			transform: scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.check-path.is-animating {
			animation: none;
		}
	}
</style>
