<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import DetailTopNav from '#lib/common/design/DetailTopNav.svelte';
	import FdButton from '#lib/common/design/fluid/FdButton.svelte';
	import { createPrimaryCtaSetting } from '#lib/common/design/fluid/ctaPreset';
	import SlidingNumber from '#lib/common/design/SlidingNumber.svelte';
	import SlidingPrice from '#lib/common/design/SlidingPrice.svelte';
	import type {
		CartLineItem,
		CheckoutItemSnapshot,
		ShippingAddress,
		ShippingFormInput
	} from '../logic/types';
	import CartListSection from './CartListSection.svelte';
	import CheckoutFormSection from './CheckoutFormSection.svelte';

	export type PayFlowStep = 'cart' | 'checkout';

	interface Props {
		step: PayFlowStep;
		slideDir: 1 | -1;
		mobile: boolean;

		// Cart props
		cartLoading: boolean;
		cartError: string | null;
		cartItems: readonly CartLineItem[];
		selectedMap: Record<number, boolean>;
		busyOptions: Record<number, boolean>;
		clearing: boolean;
		isAllSelected: boolean;
		selectedCount: number;
		selectedQtyTotal: number;
		selectedTotalPrice: number;
		canCheckout: boolean;
		getMaxQty: (item: CartLineItem) => number;
		onToggleSelectAll: () => void;
		onToggleSelect: (optionId: number) => void;
		onStepQty: (optionId: number, delta: number) => void;
		onRemoveItem: (optionId: number) => void;
		onClearCart: () => void;
		onOpenProduct: (item: CartLineItem) => void;
		onProceedToCheckout: () => void;
		onGoToCatalog: () => void;

		// Checkout props
		checkoutLoading: boolean;
		checkoutError: string | null;
		checkoutItems: readonly CheckoutItemSnapshot[];
		checkoutTotalPrice: number;
		checkoutTotalQty: number;
		addresses: readonly ShippingAddress[];
		selectedAddressId: number | 'manual';
		shipping: ShippingFormInput;
		saveAsNewAddress: boolean;
		validationError: string | null;
		widgetLoading: boolean;
		widgetError: string | null;
		submitting: boolean;
		canSubmitPayment: boolean;
		paymentMethodsId: string;
		agreementId: string;
		onSelectAddress: (id: number | 'manual') => void;
		onUpdateShipping: (field: keyof ShippingFormInput, value: string) => void;
		onToggleSaveAddress: (checked: boolean) => void;
		onSubmitPayment: () => void;
		onGoToCart: () => void;

		// Shared
		onBack: () => void;
	}

	let {
		step,
		slideDir,
		mobile,
		cartLoading,
		cartError,
		cartItems,
		selectedMap,
		busyOptions,
		clearing,
		isAllSelected,
		selectedCount,
		selectedQtyTotal,
		selectedTotalPrice,
		canCheckout,
		getMaxQty,
		onToggleSelectAll,
		onToggleSelect,
		onStepQty,
		onRemoveItem,
		onClearCart,
		onOpenProduct,
		onProceedToCheckout,
		onGoToCatalog,
		checkoutLoading,
		checkoutError,
		checkoutItems,
		checkoutTotalPrice,
		checkoutTotalQty,
		addresses,
		selectedAddressId,
		shipping,
		saveAsNewAddress,
		validationError,
		widgetLoading,
		widgetError,
		submitting,
		canSubmitPayment,
		paymentMethodsId,
		agreementId,
		onSelectAddress,
		onUpdateShipping,
		onToggleSaveAddress,
		onSubmitPayment,
		onGoToCart,
		onBack
	}: Props = $props();

	let ctaBtnWidth = $state(240);

	/** 좌우 수평 커튼 슬라이드 커스텀 트랜지션 (부드러운 cubicOut + 미세 페이드) */
	function slidePane(
		_node: Element,
		params: { direction: 1 | -1; kind: 'in' | 'out'; duration?: number }
	) {
		const duration = params.duration ?? 420;
		const sign = params.kind === 'in' ? params.direction : -params.direction;
		return {
			duration,
			easing: cubicOut,
			css: (t: number, u: number) => {
				const xPct = (sign * u * 100).toFixed(2);
				const opacity = Math.min(1, t * 1.35).toFixed(3);
				return `transform: translate3d(${xPct}%, 0, 0); opacity: ${opacity};`;
			}
		};
	}

	const showCartSkeleton = $derived(step === 'cart' && cartLoading && cartItems.length === 0);
	const showCartError = $derived(
		step === 'cart' && !cartLoading && Boolean(cartError) && cartItems.length === 0
	);
	const showCheckoutEmpty = $derived(
		step === 'checkout' && !checkoutLoading && !checkoutError && checkoutItems.length === 0
	);
	const showPersistentSummary = $derived(
		step === 'cart' || (step === 'checkout' && (checkoutLoading || checkoutItems.length > 0))
	);

	const activeSummaryPrice = $derived(
		step === 'cart' ? selectedTotalPrice : checkoutTotalPrice
	);
	const activeSummaryItemKinds = $derived(
		step === 'cart' ? selectedCount : checkoutItems.length
	);
	const activeSummaryItemQty = $derived(
		step === 'cart' ? selectedQtyTotal : checkoutTotalQty
	);
	const activeCanCta = $derived(step === 'cart' ? canCheckout : canSubmitPayment);

	const summaryHeading = $derived(step === 'cart' ? '주문 요약' : '최종 결제 금액');
	const summaryTotalLabel = $derived(step === 'cart' ? '결제 예정 금액' : '총 결제 금액');
	const summaryRowLabel = $derived(step === 'cart' ? '선택 상품' : '주문 상품');

	const pcCtaLabel = $derived(
		step === 'cart'
			? selectedCount > 0
				? `${selectedCount}개 상품 주문하기`
				: '상품을 선택해 주세요'
			: submitting
				? '결제창 여는 중...'
				: '결제하기'
	);

	const mobileCtaLabel = $derived(
		step === 'cart' ? '주문하기' : submitting ? '진행 중...' : '결제하기'
	);

	const ctaSetting = $derived(createPrimaryCtaSetting(ctaBtnWidth, !activeCanCta));

	function handlePrimaryCta() {
		if (step === 'cart') {
			onProceedToCheckout();
		} else {
			onSubmitPayment();
		}
	}
</script>

<!-- 장바구니 <-> 주문·결제 통합 뷰: 우측 요약 카드(모바일 하단 바) 고정 유지 + 좌측 본문만 부드럽게 좌우 슬라이드 -->
<div class="pay-page" class:is-mobile={mobile}>
	<div class="pay-container">
		<DetailTopNav {mobile} backLabel="이전" returnToPage={false} {onBack} />

		<header class="pay-header">
			<div class="pay-title-stage">
				{#key step}
					<div
						class="pay-title-row"
						in:fly={{ x: slideDir * 24, duration: 320, easing: cubicOut }}
						out:fly={{ x: -slideDir * 24, duration: 220, easing: cubicOut }}
					>
						<h1 class="pay-title">{step === 'cart' ? '장바구니' : '주문 · 결제'}</h1>
					</div>
				{/key}
			</div>
		</header>

		{#if showCartError}
			<div class="pay-state-box" role="alert">
				<p class="pay-state-text">{cartError}</p>
			</div>
		{:else if showCheckoutEmpty}
			<div class="pay-state-box">
				<p class="pay-state-text">결제할 상품이 없습니다.</p>
				<button type="button" class="empty-browse-btn" onclick={onGoToCart}>
					장바구니로 이동
				</button>
			</div>
		{:else}
			<div class="pay-flow-layout">
				<!-- 좌측 메인 콘텐츠 영역: 장바구니 <-> 주문·결제 전환 시 여기만 좌우 슬라이드 -->
				<div class="pay-slide-stage">
					{#key step}
						<div
							class="pay-slide-pane"
							in:slidePane={{ direction: slideDir, kind: 'in', duration: 420 }}
							out:slidePane={{ direction: slideDir, kind: 'out', duration: 360 }}
						>
							{#if step === 'cart'}
								<CartListSection
									loading={cartLoading}
									items={cartItems}
									{selectedMap}
									{busyOptions}
									{clearing}
									{isAllSelected}
									{selectedCount}
									{getMaxQty}
									{onToggleSelectAll}
									{onToggleSelect}
									{onStepQty}
									{onRemoveItem}
									{onClearCart}
									{onOpenProduct}
									{onGoToCatalog}
								/>
							{:else}
								<CheckoutFormSection
									loading={checkoutLoading}
									errorMessage={checkoutError}
									items={checkoutItems}
									totalQty={checkoutTotalQty}
									{addresses}
									{selectedAddressId}
									{shipping}
									{saveAsNewAddress}
									{validationError}
									{widgetLoading}
									{widgetError}
									{paymentMethodsId}
									{agreementId}
									{onSelectAddress}
									{onUpdateShipping}
									{onToggleSaveAddress}
								/>
							{/if}
						</div>
					{/key}
				</div>

				<!-- PC 우측 Sticky 요약 카드: 장바구니 <-> 결제하기 전환 중 그대로 고정 유지 -->
				{#if !mobile && showPersistentSummary}
					<aside class="pay-summary-col" aria-label={summaryHeading}>
						<div class="summary-card">
							{#if showCartSkeleton}
								<span class="skel-bar skeleton-shimmer" style="width: 84px; height: 20px;"></span>
								<div class="summary-rows">
									<div class="summary-row">
										<span class="skel-bar skeleton-shimmer" style="width: 64px; height: 15px;"></span>
										<span class="skel-bar skeleton-shimmer" style="width: 72px; height: 15px;"></span>
									</div>
									<div class="summary-row">
										<span class="skel-bar skeleton-shimmer" style="width: 48px; height: 15px;"></span>
										<span class="skel-bar skeleton-shimmer" style="width: 36px; height: 15px;"></span>
									</div>
								</div>
								<div class="summary-total">
									<span class="skel-bar skeleton-shimmer" style="width: 96px; height: 16px;"></span>
									<span class="skel-bar skeleton-shimmer" style="width: 104px; height: 24px;"></span>
								</div>
								<span class="skel-cta skeleton-shimmer"></span>
							{:else}
								<div class="summary-heading-stage">
									{#key summaryHeading}
										<h2
											class="summary-title"
											in:fly={{ y: 8, duration: 220, easing: cubicOut }}
											out:fly={{ y: -8, duration: 150, easing: cubicOut }}
										>
											{summaryHeading}
										</h2>
									{/key}
								</div>

								<dl class="summary-rows">
									<div class="summary-row">
										<dt>{summaryRowLabel}</dt>
										<dd class="summary-count-dd">
											<SlidingNumber
												value={activeSummaryItemKinds}
												thousandSeparator=""
												suffix="종"
												inheritSuffixStyle
											/>
											<span>·</span>
											<SlidingNumber
												value={activeSummaryItemQty}
												thousandSeparator=""
												suffix="개"
												inheritSuffixStyle
											/>
										</dd>
									</div>
									<div class="summary-row">
										<dt>배송비</dt>
										<dd>무료</dd>
									</div>
								</dl>

								<div class="summary-total">
									<span class="summary-total-label">{summaryTotalLabel}</span>
									<SlidingPrice value={activeSummaryPrice} />
								</div>

								<div class="summary-cta-wrap" bind:clientWidth={ctaBtnWidth}>
									<FdButton
										setting={ctaSetting}
										fullWidth
										disabled={!activeCanCta}
										class="pay-cta-fd-btn"
										onclick={handlePrimaryCta}
									>
										<span class="btn-label-stage">
											{#key pcCtaLabel}
												<span
													class="btn-label-slide"
													in:fly={{ y: 12, duration: 220, easing: cubicOut }}
													out:fly={{ y: -12, duration: 150, easing: cubicOut }}
												>
													{pcCtaLabel}
												</span>
											{/key}
										</span>
									</FdButton>
								</div>
							{/if}
						</div>
					</aside>
				{/if}
			</div>
		{/if}
	</div>

	<!-- 모바일 하단 고정 바: 장바구니 <-> 결제하기 전환 중 그대로 고정 유지 -->
	{#if mobile && showPersistentSummary}
		<div class="mobile-bottom-cta">
			{#if showCartSkeleton}
				<div class="mobile-cta-price" aria-hidden="true">
					<span class="skel-bar skeleton-shimmer" style="width: 44px; height: 12px;"></span>
					<span class="skel-bar skeleton-shimmer" style="width: 96px; height: 22px;"></span>
				</div>
				<div class="mobile-cta-btn-wrap" aria-hidden="true">
					<span class="skel-cta skeleton-shimmer"></span>
				</div>
			{:else}
				<div class="mobile-cta-price">
					<span class="mobile-cta-meta">
						{#if step === 'cart'}
							총 <SlidingNumber
								value={activeSummaryItemQty}
								thousandSeparator=""
								suffix="개"
								inheritSuffixStyle
							/>
						{:else}
							총 결제 금액
						{/if}
					</span>
					<SlidingPrice value={activeSummaryPrice} />
				</div>
				<div class="mobile-cta-btn-wrap" bind:clientWidth={ctaBtnWidth}>
					<FdButton
						setting={ctaSetting}
						fullWidth
						disabled={!activeCanCta}
						class="pay-cta-fd-btn"
						onclick={handlePrimaryCta}
					>
						<span class="btn-label-stage">
							{#key mobileCtaLabel}
								<span
									class="btn-label-slide"
									in:fly={{ y: 12, duration: 220, easing: cubicOut }}
									out:fly={{ y: -12, duration: 150, easing: cubicOut }}
								>
									{mobileCtaLabel}
								</span>
							{/key}
						</span>
					</FdButton>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.pay-page {
		width: 100%;
		min-height: calc(100dvh - var(--pc-header-height, 70px));
		background: var(--bg);
		color: var(--fg);
		box-sizing: border-box;
		container-type: inline-size;
		container-name: pay-flow;
	}

	.pay-page.is-mobile {
		min-height: 100dvh;
		padding-bottom: calc(92px + env(safe-area-inset-bottom, 0px));
	}

	.pay-container {
		width: 100%;
		max-width: var(--content-max-width);
		margin: 0 auto;
		padding: 1.5rem var(--content-padding-x) 4.5rem;
		box-sizing: border-box;
	}

	.pay-page.is-mobile .pay-container {
		padding: calc(var(--mb-detail-top-offset, 60px) + 0.75rem) var(--content-padding-x-mobile) 2.5rem;
	}

	.pay-header {
		margin-bottom: 1.5rem;
	}

	.pay-title-stage {
		display: grid;
		overflow: hidden;
	}

	.pay-title-row {
		grid-area: 1 / 1;
		display: flex;
		align-items: baseline;
		gap: 0.55rem;
	}

	.pay-title {
		margin: 0;
		font-size: clamp(1.5rem, 2.6cqi, 2.05rem);
		font-weight: var(--fw-extrabold);
		letter-spacing: -0.03em;
		color: var(--white);
	}

	.pay-state-box {
		min-height: 300px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		gap: 0.75rem;
	}

	.pay-state-text {
		margin: 0;
		color: var(--muted);
		font-size: 0.94rem;
	}

	.empty-browse-btn {
		margin-top: 0.5rem;
		height: 42px;
		padding: 0 1.25rem;
		border: none;
		border-radius: 12px;
		background: var(--surface);
		color: var(--white-2);
		font: inherit;
		font-size: 0.88rem;
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition: background-color 0.16s ease;
	}

	.empty-browse-btn:hover {
		background: var(--surface-2);
	}

	.pay-flow-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 340px;
		gap: clamp(1.5rem, 3.2cqi, 2.75rem);
		align-items: start;
	}

	.pay-slide-stage {
		display: grid;
		align-items: start;
		overflow: hidden;
		min-width: 0;
	}

	.pay-slide-pane {
		grid-area: 1 / 1;
		min-width: 0;
		will-change: transform, opacity;
	}

	.pay-summary-col {
		position: sticky;
		top: calc(var(--pc-header-height, 70px) + 1.5rem);
	}

	.summary-card {
		padding: 1.5rem;
		border-radius: 20px;
		background: var(--surface);
		display: flex;
		flex-direction: column;
		gap: 1.15rem;
	}

	.summary-heading-stage {
		display: grid;
		overflow: hidden;
	}

	.summary-title {
		grid-area: 1 / 1;
		margin: 0;
		font-size: 1.05rem;
		font-weight: var(--fw-bold);
		color: var(--white);
	}

	.summary-rows {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding-bottom: 1rem;
		border-bottom: var(--thin-border);
	}

	.summary-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.88rem;
	}

	.summary-row dt {
		color: var(--muted);
	}

	.summary-row dd {
		margin: 0;
		color: var(--fg);
		font-weight: var(--fw-medium);
	}

	.summary-count-dd {
		display: inline-flex;
		align-items: baseline;
		gap: 0.3rem;
	}

	.summary-total {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.summary-total-label {
		font-size: 0.9rem;
		font-weight: var(--fw-semibold);
		color: var(--white-2);
	}

	.summary-cta-wrap :global(.fd-wrap),
	.mobile-cta-btn-wrap :global(.fd-wrap) {
		margin: -6px;
		width: calc(100% + 12px);
	}

	.summary-cta-wrap :global(.fd-btn.pay-cta-fd-btn),
	.mobile-cta-btn-wrap :global(.fd-btn.pay-cta-fd-btn) {
		width: 100%;
		height: 48px;
		padding: 0 1.25rem;
		font-size: 0.95rem;
		font-weight: var(--fw-bold);
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

	.mobile-bottom-cta {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 40;
		padding: 0.75rem var(--content-padding-x-mobile)
			calc(0.85rem + env(safe-area-inset-bottom, 0px));
		background: color-mix(in srgb, var(--bg) 86%, transparent);
		-webkit-backdrop-filter: blur(18px);
		backdrop-filter: blur(18px);
		border-top: var(--thin-border);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.mobile-cta-price {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		flex-shrink: 0;
	}

	.mobile-cta-meta {
		font-size: 0.74rem;
		color: var(--muted);
		font-weight: var(--fw-medium);
	}

	.mobile-cta-btn-wrap {
		flex: 1;
		max-width: 220px;
	}

	.skel-bar {
		display: block;
		border-radius: 6px;
	}

	.skel-cta {
		display: block;
		width: 100%;
		height: 48px;
		border-radius: 14px;
	}

	@container pay-flow (max-width: 820px) {
		.pay-flow-layout {
			grid-template-columns: minmax(0, 1fr);
		}

		.pay-summary-col {
			position: static;
		}
	}
</style>
