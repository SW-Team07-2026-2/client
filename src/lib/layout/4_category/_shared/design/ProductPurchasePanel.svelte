<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';
	import FdButton from '#lib/common/design/fluid/FdButton.svelte';
	import { createPrimaryCtaSetting } from '#lib/common/design/fluid/ctaPreset';
	import ShoppingBagIcon from '#lib/common/design/icon/ShoppingBagIcon.svelte';
	import SlidingPrice from '#lib/common/design/SlidingPrice.svelte';
	import SpringNumberStepper from '#lib/common/design/SpringNumberStepper.svelte';
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

	/** 두 버튼('장바구니 담기' + '장바구니 이동')을 가로로 나란히 배치할 최소 폭 */
	const NARROW_CTA_BREAKPOINT = 280;

	let ctaGroupWidth = $state(0);
	let cartBtnWidth = $state(200);
	let bagAnimating = $state(false);
	let bagAnimTimer: ReturnType<typeof setTimeout> | undefined;

	const hasPrimary = $derived(primaryOptions.length > 1 && Boolean(onSelectPrimary));
	const isNarrowCta = $derived(ctaGroupWidth > 0 && ctaGroupWidth < NARROW_CTA_BREAKPOINT);
	const canGoToCart = $derived(inCart && Boolean(onGoToCart));
	/** 좁은 가로 폭에서 이미 담겨 있으면 '장바구니 이동'만 단독 표시 */
	const showGoCartOnly = $derived(isNarrowCta && canGoToCart && !soldOut);
	/** 충분한 가로 폭에서 이미 담겨 있으면 두 버튼을 나란히 표시 */
	const showBothCta = $derived(!isNarrowCta && canGoToCart && !soldOut);

	const cartBtnSetting = $derived(
		createPrimaryCtaSetting(cartBtnWidth, soldOut || !canSubmitCart)
	);

	const cartBtnLabel = $derived(
		cartSubmitting ? '담는 중...' : soldOut ? '품절된 상품입니다' : '장바구니 담기'
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

	function handleAddPointerEnter(e: PointerEvent) {
		if (e.pointerType === 'touch' || soldOut || !canSubmitCart) return;
		triggerBagAnim();
	}

	function handleAddClick() {
		if (soldOut || cartSubmitting || !canSubmitCart) return;
		triggerBagAnim();
		onAddToCart();
	}
</script>

<!-- 상품 상세 공용 구매 패널: 1행(형태·옵션·수량) + 2행(보조액션·장바구니 담기/이동·슬라이딩 가격, 순수 렌더링) -->
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
				<div
					class="options-skeleton skeleton-shimmer"
					role="status"
					aria-busy="true"
					aria-label="{optionLabel} 불러오는 중"
					in:fade={{ duration: 140 }}
				></div>
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

		<div class="cart-cta-group" class:is-split={showBothCta} bind:clientWidth={ctaGroupWidth}>
			{#if showGoCartOnly && onGoToCart}
				<div class="go-cart-slot is-solo" in:fade={{ duration: 160 }}>
					<GoToCartButton variant="primary" onclick={onGoToCart} />
				</div>
			{:else}
				<div
					class="primary-cart-wrap"
					role="presentation"
					bind:clientWidth={cartBtnWidth}
					onpointerenter={handleAddPointerEnter}
				>
					<FdButton
						setting={cartBtnSetting}
						fullWidth
						disabled={soldOut || cartSubmitting || !canSubmitCart}
						class="product-primary-cart-fd-btn"
						onclick={handleAddClick}
					>
						<span class="btn-label-stage">
							{#key cartBtnLabel}
								<span
									class="btn-label-slide"
									in:fly={{ y: 12, duration: 220, easing: cubicOut }}
									out:fly={{ y: -12, duration: 150, easing: cubicOut }}
								>
									{#if !soldOut}
										<ShoppingBagIcon size={18} animating={bagAnimating} />
									{/if}
									<span>{cartBtnLabel}</span>
								</span>
							{/key}
						</span>
					</FdButton>
				</div>

				{#if onGoToCart}
					<div
						class="go-cart-reveal"
						class:is-open={showBothCta}
						aria-hidden={!showBothCta || undefined}
						inert={!showBothCta || undefined}
					>
						<div class="go-cart-slot">
							<GoToCartButton variant="outlined" onclick={onGoToCart} />
						</div>
					</div>
				{/if}
			{/if}
		</div>

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

	.options-skeleton {
		width: 100%;
		height: 48px;
		border-radius: 14px;
	}

	.action-buttons {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.65rem;
		padding-top: 0.25rem;
	}

	.cart-cta-group {
		flex: 1 1 160px;
		min-width: 140px;
		display: flex;
		align-items: center;
	}

	.primary-cart-wrap {
		flex: 1 1 0%;
		min-width: 0;
	}

	.primary-cart-wrap :global(.fd-wrap) {
		margin: -6px;
		width: calc(100% + 12px);
	}

	.primary-cart-wrap :global(.fd-btn.product-primary-cart-fd-btn) {
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

	/* 병렬 배치 전환 시 '장바구니 담기'(+20px)와 '장바구니 이동'이 폭·위치·투명도를 함께 부드럽게 분할 */
	.go-cart-reveal {
		flex: 0 0 0%;
		min-width: 0;
		margin-left: 0;
		opacity: 0;
		transform: translate3d(10px, 0, 0) scale(0.94);
		pointer-events: none;
		overflow: hidden;
		transition:
			flex-basis 0.42s cubic-bezier(0.22, 1, 0.36, 1),
			margin-left 0.42s cubic-bezier(0.22, 1, 0.36, 1),
			opacity 0.26s ease,
			transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.go-cart-reveal.is-open {
		flex-basis: calc(50% - 10px - 0.3rem);
		margin-left: 0.6rem;
		opacity: 1;
		transform: translate3d(0, 0, 0) scale(1);
		pointer-events: auto;
		overflow: visible;
		transition:
			flex-basis 0.42s cubic-bezier(0.22, 1, 0.36, 1),
			margin-left 0.42s cubic-bezier(0.22, 1, 0.36, 1),
			opacity 0.28s ease 0.08s,
			transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.go-cart-slot {
		width: 100%;
		min-width: 0;
		display: flex;
	}

	@media (prefers-reduced-motion: reduce) {
		.go-cart-reveal,
		.go-cart-reveal.is-open {
			transition: none;
		}
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
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
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
