<script lang="ts">
	interface Props {
		size?: number;
		animating?: boolean;
		class?: string;
	}

	let { size = 18, animating = false, class: className = '' }: Props = $props();
</script>

<!-- 쇼핑백 SVG 아이콘 (animating 시 가방 본체 탄성 + 손잡이 들림 애니메이션) -->
<svg
	class="shopping-bag-svg {className}"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	<g class="bag-group" class:is-animating={animating}>
		<path
			d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z"
		/>
		<path d="M3.103 6.034h17.794" />
		<path class="bag-handle" class:is-animating={animating} d="M16 10a4 4 0 0 1-8 0" />
	</g>
</svg>

<style>
	.shopping-bag-svg {
		display: block;
		flex-shrink: 0;
		overflow: visible;
	}

	.bag-group {
		transform-box: fill-box;
		transform-origin: 50% 100%;
		transform: scaleY(1);
	}

	.bag-group.is-animating {
		animation: shopping-bag-bounce 0.6s ease-in-out;
	}

	.bag-handle {
		transform: translateY(0);
	}

	.bag-handle.is-animating {
		animation: shopping-bag-handle 0.6s ease-in-out;
	}

	@keyframes shopping-bag-bounce {
		0% {
			transform: scaleY(1);
		}
		33% {
			transform: scaleY(1.03);
		}
		67% {
			transform: scaleY(0.97);
		}
		100% {
			transform: scaleY(1);
		}
	}

	@keyframes shopping-bag-handle {
		0% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-1.2px);
		}
		100% {
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.bag-group.is-animating,
		.bag-handle.is-animating {
			animation: none;
		}
	}
</style>
