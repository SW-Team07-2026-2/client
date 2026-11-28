<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';
	import DetailTopNav from '#lib/common/design/DetailTopNav.svelte';
	import type {
		CartLineItem,
		CheckoutItemSnapshot,
		ShippingAddress,
		ShippingFormInput
	} from '../logic/types';
	import CartListSection from './CartListSection.svelte';
	import CheckoutFormSection from './CheckoutFormSection.svelte';
	import PayFlowBottomBar from './mobile/PayFlowBottomBar.svelte';
	import PayFlowSummaryCard from './pc/PayFlowSummaryCard.svelte';

	export type PayFlowStep = 'cart' | 'checkout';

	export interface PayFlowCartProps {
		loading: boolean;
		error: string | null;
		items: readonly CartLineItem[];
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
	}

	export interface PayFlowCheckoutProps {
		loading: boolean;
		error: string | null;
		items: readonly CheckoutItemSnapshot[];
		totalPrice: number;
		totalQty: number;
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
		onSearchAddress: () => Promise<boolean>;
		onSubmitPayment: () => void;
		onGoToCart: () => void;
	}

	interface Props {
		step: PayFlowStep;
		slideDir: 1 | -1;
		mobile: boolean;
		cart: PayFlowCartProps;
		checkout: PayFlowCheckoutProps;
		onBack: () => void;
	}

	let { step, slideDir, mobile, cart, checkout, onBack }: Props = $props();

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

	const showCartSkeleton = $derived(step === 'cart' && cart.loading && cart.items.length === 0);
	const showCartError = $derived(
		step === 'cart' && !cart.loading && Boolean(cart.error) && cart.items.length === 0
	);
	const showCheckoutEmpty = $derived(
		step === 'checkout' && !checkout.loading && !checkout.error && checkout.items.length === 0
	);
	const showPersistentSummary = $derived(
		step === 'cart' || (step === 'checkout' && (checkout.loading || checkout.items.length > 0))
	);

	const activeSummaryPrice = $derived(
		step === 'cart' ? cart.selectedTotalPrice : checkout.totalPrice
	);
	const activeSummaryItemKinds = $derived(
		step === 'cart' ? cart.selectedCount : checkout.items.length
	);
	const activeSummaryItemQty = $derived(
		step === 'cart' ? cart.selectedQtyTotal : checkout.totalQty
	);
	const activeCanCta = $derived(step === 'cart' ? cart.canCheckout : checkout.canSubmitPayment);

	const summaryHeading = $derived(step === 'cart' ? '주문 요약' : '최종 결제 금액');
	const summaryTotalLabel = $derived(step === 'cart' ? '결제 예정 금액' : '총 결제 금액');
	const summaryRowLabel = $derived(step === 'cart' ? '선택 상품' : '주문 상품');

	const pcCtaLabel = $derived(
		step === 'cart'
			? cart.selectedCount > 0
				? `${cart.selectedCount}개 상품 주문하기`
				: '상품을 선택해 주세요'
			: checkout.submitting
				? '결제창 여는 중...'
				: '결제하기'
	);

	const mobileCtaLabel = $derived(
		step === 'cart' ? '주문하기' : checkout.submitting ? '진행 중...' : '결제하기'
	);

	function handlePrimaryCta() {
		if (step === 'cart') {
			cart.onProceedToCheckout();
		} else {
			checkout.onSubmitPayment();
		}
	}
</script>

<!-- 장바구니 <-> 주문·결제 통합 뷰: 우측 요약 카드(PC) / 하단 바(Mobile) 고정 유지 + 좌측 본문만 좌우 슬라이드 -->
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
				<p class="pay-state-text">{cart.error}</p>
			</div>
		{:else if showCheckoutEmpty}
			<div class="pay-state-box">
				<p class="pay-state-text">결제할 상품이 없습니다.</p>
				<button type="button" class="empty-browse-btn" onclick={checkout.onGoToCart}>
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
									loading={cart.loading}
									items={cart.items}
									selectedMap={cart.selectedMap}
									busyOptions={cart.busyOptions}
									clearing={cart.clearing}
									isAllSelected={cart.isAllSelected}
									selectedCount={cart.selectedCount}
									getMaxQty={cart.getMaxQty}
									onToggleSelectAll={cart.onToggleSelectAll}
									onToggleSelect={cart.onToggleSelect}
									onStepQty={cart.onStepQty}
									onRemoveItem={cart.onRemoveItem}
									onClearCart={cart.onClearCart}
									onOpenProduct={cart.onOpenProduct}
									onGoToCatalog={cart.onGoToCatalog}
								/>
							{:else}
								<CheckoutFormSection
									{mobile}
									loading={checkout.loading}
									errorMessage={checkout.error}
									items={checkout.items}
									totalQty={checkout.totalQty}
									addresses={checkout.addresses}
									selectedAddressId={checkout.selectedAddressId}
									shipping={checkout.shipping}
									saveAsNewAddress={checkout.saveAsNewAddress}
									validationError={checkout.validationError}
									widgetLoading={checkout.widgetLoading}
									widgetError={checkout.widgetError}
									paymentMethodsId={checkout.paymentMethodsId}
									agreementId={checkout.agreementId}
									onSelectAddress={checkout.onSelectAddress}
									onUpdateShipping={checkout.onUpdateShipping}
									onToggleSaveAddress={checkout.onToggleSaveAddress}
									onSearchAddress={checkout.onSearchAddress}
								/>
							{/if}
						</div>
					{/key}
				</div>

				{#if !mobile && showPersistentSummary}
					<PayFlowSummaryCard
						showSkeleton={showCartSkeleton}
						heading={summaryHeading}
						rowLabel={summaryRowLabel}
						totalLabel={summaryTotalLabel}
						itemKinds={activeSummaryItemKinds}
						itemQty={activeSummaryItemQty}
						totalPrice={activeSummaryPrice}
						ctaLabel={pcCtaLabel}
						canCta={activeCanCta}
						onPrimaryCta={handlePrimaryCta}
					/>
				{/if}
			</div>
		{/if}
	</div>

	{#if mobile && showPersistentSummary}
		<PayFlowBottomBar
			{step}
			showSkeleton={showCartSkeleton}
			itemQty={activeSummaryItemQty}
			totalPrice={activeSummaryPrice}
			ctaLabel={mobileCtaLabel}
			canCta={activeCanCta}
			onPrimaryCta={handlePrimaryCta}
		/>
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
		padding: 0.75rem var(--content-padding-x-mobile) 2.5rem;
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
		background: var(--surface-dim);
		color: var(--white-2);
		font: inherit;
		font-size: 0.88rem;
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition: background-color 0.16s ease;
	}

	.empty-browse-btn:hover {
		background: var(--surface-1);
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
	}

	@container pay-flow (max-width: 820px) {
		.pay-flow-layout {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
