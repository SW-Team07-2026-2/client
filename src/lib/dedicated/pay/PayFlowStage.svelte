<script lang="ts">
	import { onDestroy, tick, untrack } from 'svelte';
	import { isMobile } from '#lib/common/logic';
	import PayFlowView, { type PayFlowStep } from './design/PayFlowView.svelte';
	import { CartPageController } from './logic/cartPage.svelte';
	import { CheckoutPageController } from './logic/checkoutPage.svelte';

	interface Props {
		step: PayFlowStep;
		/** Keep-Alive 파킹 중에는 false, 실제 /cart 또는 /checkout 활성 시 true */
		active?: boolean;
	}

	let { step, active = true }: Props = $props();

	const PAYMENT_METHODS_ID = 'indig-toss-payment-methods';
	const AGREEMENT_ID = 'indig-toss-agreement';

	const cartCtrl = new CartPageController();
	const checkoutCtrl = new CheckoutPageController();

	let prevStep = untrack(() => step);
	let prevActive = untrack(() => active);
	/** cart -> checkout: 1 (장바구니가 왼쪽으로 나가고 결제가 오른쪽에서 진입), checkout -> cart: -1 (반대) */
	const slideDir = $derived<1 | -1>(step === 'checkout' ? 1 : -1);
	let cartHasLoaded = false;

	$effect.pre(() => {
		const isActive = active;
		const nextStep = step;

		if (!isActive) {
			if (prevActive) {
				prevActive = false;
				void checkoutCtrl.destroyTossWidget();
			}
			// 유휴 시간 프리마운트 시 장바구니 데이터를 백그라운드에서 미리 적재해 첫 진입 시 스켈레톤 깜빡임 제거
			if (!cartHasLoaded) {
				cartHasLoaded = true;
				void cartCtrl.load(false);
			}
			return;
		}

		const justEntered = !prevActive;
		prevActive = true;

		if (nextStep !== prevStep) {
			prevStep = nextStep;
			if (typeof window !== 'undefined') {
				window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
			}
		}

		if (nextStep === 'cart') {
			void checkoutCtrl.destroyTossWidget();
			if (!cartHasLoaded) {
				cartHasLoaded = true;
				void cartCtrl.load(false);
			} else if (justEntered) {
				// 재진입 시 기존 화면을 즉시 보여주면서 백그라운드에서 최신 장바구니 동기화
				void cartCtrl.load(true);
			}
		} else if (nextStep === 'checkout') {
			void (async () => {
				await checkoutCtrl.load();
				if (active && step === 'checkout' && checkoutCtrl.items.length > 0) {
					await tick();
					await checkoutCtrl.mountTossWidget(`#${PAYMENT_METHODS_ID}`, `#${AGREEMENT_ID}`);
				}
			})();
		}
	});

	onDestroy(() => {
		void checkoutCtrl.destroyTossWidget();
	});

	function handleBack() {
		if (step === 'checkout') {
			checkoutCtrl.goBack();
		} else {
			cartCtrl.goBack();
		}
	}
</script>

<!-- 장바구니 <-> 주문·결제 통합 스테이지(Shell): 우측 요약 카드/하단 바를 유지한 채 좌측 본문만 좌우 전환 -->
<PayFlowView
	{step}
	{slideDir}
	mobile={isMobile.current}
	cartLoading={cartCtrl.isLoading}
	cartError={cartCtrl.errorMessage}
	cartItems={cartCtrl.items}
	selectedMap={cartCtrl.selectedMap}
	busyOptions={cartCtrl.busyOptions}
	clearing={cartCtrl.clearing}
	isAllSelected={cartCtrl.isAllSelected}
	selectedCount={cartCtrl.selectedCount}
	selectedQtyTotal={cartCtrl.selectedQtyTotal}
	selectedTotalPrice={cartCtrl.selectedTotalPrice}
	canCheckout={cartCtrl.canCheckout}
	getMaxQty={cartCtrl.maxQtyFor}
	onToggleSelectAll={cartCtrl.toggleSelectAll}
	onToggleSelect={cartCtrl.toggleSelect}
	onStepQty={cartCtrl.stepQty}
	onRemoveItem={cartCtrl.removeItem}
	onClearCart={cartCtrl.clearCart}
	onOpenProduct={cartCtrl.goToProduct}
	onProceedToCheckout={cartCtrl.proceedToCheckout}
	onGoToCatalog={cartCtrl.goToCatalog}
	checkoutLoading={checkoutCtrl.isLoading}
	checkoutError={checkoutCtrl.errorMessage}
	checkoutItems={checkoutCtrl.items}
	checkoutTotalPrice={checkoutCtrl.totalPrice}
	checkoutTotalQty={checkoutCtrl.totalQty}
	addresses={checkoutCtrl.addresses}
	selectedAddressId={checkoutCtrl.selectedAddressId}
	shipping={checkoutCtrl.shipping}
	saveAsNewAddress={checkoutCtrl.saveAsNewAddress}
	validationError={checkoutCtrl.validationError}
	widgetLoading={checkoutCtrl.widgetLoading}
	widgetError={checkoutCtrl.widgetError}
	submitting={checkoutCtrl.submitting}
	canSubmitPayment={checkoutCtrl.canSubmit}
	paymentMethodsId={PAYMENT_METHODS_ID}
	agreementId={AGREEMENT_ID}
	onSelectAddress={checkoutCtrl.selectAddress}
	onUpdateShipping={checkoutCtrl.updateShippingField}
	onToggleSaveAddress={checkoutCtrl.setSaveAsNewAddress}
	onSubmitPayment={checkoutCtrl.submitPayment}
	onGoToCart={checkoutCtrl.goToCart}
	onBack={handleBack}
/>
