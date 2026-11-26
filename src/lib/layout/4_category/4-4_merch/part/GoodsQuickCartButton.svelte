<script lang="ts">
	interface Props {
		/** 버튼 노출 여부 (카드 호버/포커스 시 true) */
		visible: boolean;
		/** 장바구니 요청 진행 중 여부 */
		loading?: boolean;
		/** 비활성화 여부 */
		disabled?: boolean;
		/** 접근성 라벨 */
		ariaLabel?: string;
		/** 클릭 콜백 */
		onclick?: () => void;
	}

	let {
		visible,
		loading = false,
		disabled = false,
		ariaLabel = '장바구니에 바로 담기',
		onclick
	}: Props = $props();

	function handleClick(e: MouseEvent) {
		e.stopPropagation();
		if (loading || disabled) return;
		onclick?.();
	}
</script>

<!-- PC 굿즈 카드 하단 유체 물결 위로 떠오르는 원형 빠른 장바구니 담기 버튼 (순수 렌더링) -->
<button
	type="button"
	class="goods-quick-cart-btn"
	class:is-visible={visible}
	class:is-loading={loading}
	disabled={disabled || loading}
	tabindex={visible ? 0 : -1}
	aria-label={ariaLabel}
	title={ariaLabel}
	onclick={handleClick}
>
	{#if loading}
		<span class="cart-spinner" aria-hidden="true"></span>
	{:else}
		<svg
			width="17"
			height="17"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.1"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
			<path d="M3 6h18" />
			<path d="M16 10a4 4 0 0 1-8 0" />
		</svg>
	{/if}
</button>

<style>
	.goods-quick-cart-btn {
		width: 38px;
		height: 38px;
		padding: 0;
		border: none;
		border-radius: 999px;
		background: var(--white-2);
		color: var(--bg);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		opacity: 0;
		pointer-events: none;
		transform: translate3d(0, 14px, 0) scale(0.86);
		will-change: transform, opacity;
		transition:
			transform 0.34s cubic-bezier(0.22, 1.15, 0.36, 1),
			opacity 0.22s ease,
			background-color 0.16s ease;
	}

	.goods-quick-cart-btn.is-visible {
		opacity: 1;
		pointer-events: auto;
		transform: translate3d(0, 0, 0) scale(1);
	}

	.goods-quick-cart-btn.is-visible:hover:not(:disabled) {
		background: var(--white);
		transform: translate3d(0, -1px, 0) scale(1.07);
	}

	.goods-quick-cart-btn.is-visible:active:not(:disabled) {
		transform: translate3d(0, 0, 0) scale(0.95);
	}

	.goods-quick-cart-btn:focus-visible {
		outline: 2px solid var(--white);
		outline-offset: 2px;
	}

	.goods-quick-cart-btn:disabled {
		cursor: default;
	}

	.cart-spinner {
		width: 15px;
		height: 15px;
		border-radius: 999px;
		border: 2px solid color-mix(in srgb, var(--bg) 24%, transparent);
		border-top-color: var(--bg);
		animation: goods-cart-spin 0.7s linear infinite;
	}

	@keyframes goods-cart-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.goods-quick-cart-btn {
			transition: none;
		}
		.cart-spinner {
			animation: none;
		}
	}
</style>
