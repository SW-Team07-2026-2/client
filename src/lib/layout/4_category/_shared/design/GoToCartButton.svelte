<script lang="ts">
	import FdButton from '#lib/common/design/fluid/FdButton.svelte';
	import { FluidSetting } from '#lib/common/type/fluid';

	interface Props {
		/** 비활성화 여부 */
		disabled?: boolean;
		/** 클릭 콜백 (장바구니 이동) */
		onclick?: () => void;
	}

	let { disabled = false, onclick }: Props = $props();

	const BUTTON_SETTING = new FluidSetting({
		radius: 14,
		inset: 6,
		reach: 28,
		bulge: 4,
		bulgeWidth: 16,
		layers: 2,
		layerGap: 2.2,
		waveAmp: 2.4,
		waveLength: 52,
		spin: 1.2,
		pauseWhenIdle: true,
		color: 'var(--surface)',
		hoverColor: 'var(--surface-2)',
		pressColor: 'var(--surface-3)',
		waveColor: 'var(--surface-3)',
		hoverWaveColor: 'var(--surface-3)',
		textColor: 'var(--fg)',
		borderWidth: 0
	});

	let animating = $state(false);
	let animTimer: ReturnType<typeof setTimeout> | undefined;

	function triggerAnim() {
		clearTimeout(animTimer);
		animating = false;
		if (typeof requestAnimationFrame === 'function') {
			requestAnimationFrame(() => {
				animating = true;
				animTimer = setTimeout(() => {
					animating = false;
				}, 620);
			});
		}
	}

	function handlePointerEnter(e: PointerEvent) {
		if (e.pointerType === 'touch' || disabled) return;
		triggerAnim();
	}

	function handleClick() {
		if (disabled) return;
		triggerAnim();
		onclick?.();
	}
</script>

<!-- 장바구니 이동 ShoppingBag 아이콘 전용 FdButton (호버 시 가방 세로 탄성 + 손잡이 들림 + 유체 물결, 순수 렌더링) -->
<div class="go-cart-btn-wrap" role="presentation" onpointerenter={handlePointerEnter}>
	<FdButton
		setting={BUTTON_SETTING}
		{disabled}
		class="product-go-cart-fd-btn"
		aria-label="장바구니로 이동"
		title="장바구니로 이동"
		onclick={handleClick}
	>
		<svg
			class="shopping-bag-svg"
			width="20"
			height="20"
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
	</FdButton>
</div>

<style>
	.go-cart-btn-wrap {
		display: inline-flex;
		flex-shrink: 0;
	}

	.go-cart-btn-wrap :global(.fd-wrap) {
		margin: -6px;
	}

	.go-cart-btn-wrap :global(.fd-btn.product-go-cart-fd-btn) {
		width: 46px;
		height: 46px;
		padding: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.shopping-bag-svg {
		display: block;
		overflow: visible;
	}

	/* 가방 본체 하단 기준(50% 100%) 탄성 애니메이션: scaleY [1 -> 1.03 -> 0.97 -> 1] (0.6s ease-in-out) */
	.bag-group {
		transform-box: fill-box;
		transform-origin: 50% 100%;
		transform: scaleY(1);
	}

	.bag-group.is-animating {
		animation: shopping-bag-bounce 0.6s ease-in-out;
	}

	/* 손잡이 들림 애니메이션: y [0 -> -1.2px -> 0] (0.6s ease-in-out) */
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
