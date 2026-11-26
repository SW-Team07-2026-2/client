<script lang="ts">
	import FdButton from '#lib/common/design/fluid/FdButton.svelte';
	import {
		createOutlinedCtaSetting,
		createPrimaryCtaSetting
	} from '#lib/common/design/fluid/ctaPreset';
	import ShoppingBagIcon from '#lib/common/design/icon/ShoppingBagIcon.svelte';

	interface Props {
		/**
		 * 'outlined': 장바구니 담기 옆에 함께 배치될 때 (border 테두리 FdButton · 텍스트만)
		 * 'primary': 좁은 화면에서 단독 표시될 때 (장바구니 담기와 동일한 메인 CTA 색상 FdButton + 아이콘)
		 */
		variant?: 'outlined' | 'primary';
		/** 비활성화 여부 */
		disabled?: boolean;
		/** 클릭 콜백 (장바구니 이동) */
		onclick?: () => void;
	}

	let { variant = 'outlined', disabled = false, onclick }: Props = $props();

	let btnWidth = $state(160);
	let bagAnimating = $state(false);
	let bagAnimTimer: ReturnType<typeof setTimeout> | undefined;

	const buttonSetting = $derived(
		variant === 'primary'
			? createPrimaryCtaSetting(btnWidth, disabled)
			: createOutlinedCtaSetting(btnWidth, disabled)
	);

	function triggerBagAnim() {
		clearTimeout(bagAnimTimer);
		bagAnimating = false;
		if (typeof requestAnimationFrame === 'function') {
			requestAnimationFrame(() => {
				bagAnimating = true;
				bagAnimTimer = setTimeout(() => {
					bagAnimating = false;
				}, 620);
			});
		}
	}

	function handlePointerEnter(e: PointerEvent) {
		if (variant !== 'primary' || e.pointerType === 'touch' || disabled) return;
		triggerBagAnim();
	}

	function handleClick() {
		if (disabled) return;
		if (variant === 'primary') {
			triggerBagAnim();
		}
		onclick?.();
	}
</script>

<!-- 장바구니 이동 FdButton: 병렬 배치 시 border 아웃라인 / 단독 배치 시 메인 CTA와 동일 스타일 + 아이콘 (순수 렌더링) -->
<div
	class="go-cart-btn-wrap"
	role="presentation"
	bind:clientWidth={btnWidth}
	onpointerenter={handlePointerEnter}
>
	<FdButton
		setting={buttonSetting}
		fullWidth
		{disabled}
		class="product-go-cart-fd-btn"
		onclick={handleClick}
	>
		<span class="go-cart-inner">
			{#if variant === 'primary'}
				<ShoppingBagIcon size={18} animating={bagAnimating} />
			{/if}
			<span class="go-cart-label">장바구니 이동</span>
		</span>
	</FdButton>
</div>

<style>
	.go-cart-btn-wrap {
		width: 100%;
		min-width: 0;
	}

	.go-cart-btn-wrap :global(.fd-wrap) {
		margin: -6px;
		width: calc(100% + 12px);
	}

	.go-cart-btn-wrap :global(.fd-btn.product-go-cart-fd-btn) {
		width: 100%;
		height: 46px;
		padding: 0 1rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.94rem;
		font-weight: var(--fw-bold);
		line-height: 1;
	}

	.go-cart-inner {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		white-space: nowrap;
	}

	.go-cart-label {
		white-space: nowrap;
	}
</style>
