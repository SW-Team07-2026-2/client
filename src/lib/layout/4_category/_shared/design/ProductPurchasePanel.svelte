<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';
	import FdButton from '#lib/common/design/fluid/FdButton.svelte';
	import { createPrimaryCtaSetting } from '#lib/common/design/fluid/ctaPreset';
	import SlidingPrice from '#lib/common/design/SlidingPrice.svelte';
	import SpringNumberStepper from '#lib/common/design/SpringNumberStepper.svelte';
	import { LoadingSpinner } from '#lib/dedicated/loading';
	import GoToCartButton from './GoToCartButton.svelte';
	import SpringDropdown, { type SpringDropdownOption } from './SpringDropdown.svelte';

	interface Props {
		/** 선택적 1차 드롭다운 (예: 앨범의 '음반 형태') — 항목이 2개 이상일 때만 표시 */
		primaryLabel?: string;
		primaryOptions?: readonly SpringDropdownOption[];
		primaryValue?: number | string | null;
		onSelectPrimary?: (value: number | string) => void;

		/** 2차(기본) 옵션 드롭다운 (예: 바이닐 컬러, 굿즈 사이즈) */
		optionLabel?: string;
		options: readonly SpringDropdownOption[];
		optionValue: number | string | null;
		optionsLoading?: boolean;
		onSelectOption: (value: number | string) => void;

		/** 수량 스테퍼 */
		qty: number;
		minQty?: number;
		maxQty: number;
		onStepQty: (delta: number) => void;

		/** 합계 금액 · 장바구니 상태 */
		totalPrice: number | null;
		soldOut: boolean;
		cartSubmitting: boolean;
		canSubmitCart: boolean;
		inCart?: boolean;
		onAddToCart: () => void;
		onGoToCart?: () => void;

		/** 2행 좌측 보조 액션 슬롯 (예: 앨범 보유음반 버튼, 굿즈 공식 스토어 링크) */
		leadingAction?: Snippet;
	}

	let {
		primaryLabel = '형태',
		primaryOptions = [],
		primaryValue = null,
		onSelectPrimary,
		optionLabel = '옵션',
		options,
		optionValue,
		optionsLoading = false,
		onSelectOption,
		qty,
		minQty = 1,
		maxQty,
		onStepQty,
		totalPrice,
		soldOut,
		cartSubmitting,
		canSubmitCart,
		inCart = false,
		onAddToCart,
		onGoToCart,
		leadingAction
	}: Props = $props();

	let cartBtnWidth = $state(200);

	const hasPrimary = $derived(primaryOptions.length > 1 && Boolean(onSelectPrimary));

	const cartBtnSetting = $derived(
		createPrimaryCtaSetting(cartBtnWidth, soldOut || !canSubmitCart)
	);

	const cartBtnLabel = $derived(
		cartSubmitting ? '담는 중...' : soldOut ? '품절된 상품입니다' : '장바구니 담기'
	);
</script>

<!-- 상품 상세 공용 구매 패널: 1행(형태·옵션·수량) + 2행(보조액션·장바구니 담기·슬라이딩 가격, 순수 렌더링) -->
<div class="product-purchase-panel">
	<div class="selector-grid" class:has-primary={hasPrimary}>
		{#if hasPrimary}
			<div class="selector-group">
				<span class="selector-label">{primaryLabel}</span>
				<SpringDropdown
					label="{primaryLabel} 선택"
					options={primaryOptions}
					value={primaryValue}
					onSelect={(val) => onSelectPrimary?.(val)}
				/>
			</div>
		{/if}

		<div class="selector-group">
			<span class="selector-label">{optionLabel}</span>
			{#if optionsLoading && options.length === 0}
				<div class="options-loading" in:fade={{ duration: 140 }}>
					<LoadingSpinner size={16} />
				</div>
			{:else}
				<SpringDropdown
					label="{optionLabel} 선택"
					{options}
					value={optionValue}
					disabled={optionsLoading || options.length === 0}
					onSelect={onSelectOption}
				/>
			{/if}
		</div>

		<div class="selector-group is-qty">
			<span class="selector-label">수량</span>
			<SpringNumberStepper
				value={qty}
				min={minQty}
				max={maxQty}
				disabled={soldOut}
				onStep={onStepQty}
			/>
		</div>
	</div>

	<div class="action-buttons">
		{#if leadingAction}
			{@render leadingAction()}
		{/if}

		<div class="primary-cart-wrap" bind:clientWidth={cartBtnWidth}>
			<FdButton
				setting={cartBtnSetting}
				fullWidth
				disabled={soldOut || cartSubmitting || !canSubmitCart}
				class="product-primary-cart-fd-btn"
				onclick={onAddToCart}
			>
				<span class="btn-label-stage">
					{#key cartBtnLabel}
						<span
							class="btn-label-slide"
							in:fly={{ y: 12, duration: 220, easing: cubicOut }}
							out:fly={{ y: -12, duration: 150, easing: cubicOut }}
						>
							{cartBtnLabel}
						</span>
					{/key}
				</span>
			</FdButton>
		</div>

		{#if inCart && onGoToCart}
			<div
				class="go-cart-slot"
				in:fly={{ x: -8, duration: 220, easing: cubicOut }}
				out:fade={{ duration: 140 }}
			>
				<GoToCartButton onclick={onGoToCart} />
			</div>
		{/if}

		<div class="price-summary">
			<SlidingPrice value={totalPrice} {soldOut} />
		</div>
	</div>
</div>

<style>
	.product-purchase-panel {
		width: 100%;
		margin-top: 1.75rem;
		padding-top: 1.5rem;
		border-top: var(--thin-border);
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.selector-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.75rem;
		align-items: end;
	}

	.selector-grid.has-primary {
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
	}

	.selector-group {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		min-width: 0;
	}

	.selector-group.is-qty {
		flex-shrink: 0;
	}

	.selector-label {
		font-size: 0.78rem;
		font-weight: var(--fw-semibold);
		color: var(--muted);
		letter-spacing: 0.02em;
	}

	.options-loading {
		height: 48px;
		padding: 0 16px;
		border-radius: 14px;
		border: none;
		background: var(--surface);
		display: flex;
		align-items: center;
	}

	.action-buttons {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.65rem;
		padding-top: 0.25rem;
	}

	.primary-cart-wrap {
		flex: 1 1 150px;
		min-width: 140px;
	}

	.primary-cart-wrap :global(.fd-wrap) {
		margin: -6px;
		width: calc(100% + 12px);
	}

	.primary-cart-wrap :global(.fd-btn.product-primary-cart-fd-btn) {
		width: 100%;
		height: 46px;
		padding: 0 1.25rem;
		font-size: 0.94rem;
		font-weight: var(--fw-bold);
	}

	.go-cart-slot {
		display: inline-flex;
		flex-shrink: 0;
	}

	.btn-label-stage {
		position: relative;
		display: inline-grid;
		align-items: center;
		justify-items: center;
		overflow: hidden;
		line-height: 1.3;
	}

	.btn-label-slide {
		grid-area: 1 / 1;
		white-space: nowrap;
	}

	.price-summary {
		margin-left: auto;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		flex-shrink: 0;
		padding-left: 0.35rem;
	}

	@container product-detail (max-width: 740px) {
		.selector-grid.has-primary {
			grid-template-columns: minmax(0, 1fr) auto;
		}

		.selector-grid.has-primary > .selector-group:first-child {
			grid-column: 1 / -1;
		}
	}
</style>
