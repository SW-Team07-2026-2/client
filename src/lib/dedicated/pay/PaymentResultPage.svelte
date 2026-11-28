<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { isMobile } from '#lib/common/logic';
	import PaymentResultView from './design/PaymentResultView.svelte';
	import { PaymentResultController } from './logic/paymentResultPage.svelte';
	import type { PaymentResultMode } from './logic/types';

	interface Props {
		mode: PaymentResultMode;
	}

	let { mode }: Props = $props();

	const ctrl = new PaymentResultController();

	onMount(() => {
		const params = page.url.searchParams;
		void ctrl.initialize(mode, {
			paymentKey: params.get('paymentKey'),
			orderId: params.get('orderId'),
			amount: params.get('amount'),
			code: params.get('code'),
			message: params.get('message'),
			flow: params.get('flow'),
			bookingId: params.get('bookingId'),
			concertId: params.get('concertId')
		});
	});
</script>

<!-- 결제 결과 진입점(Shell): PaymentResultController와 PaymentResultView 조립 -->
<PaymentResultView
	mobile={isMobile.current}
	status={ctrl.status}
	payment={ctrl.payment}
	orderName={ctrl.orderName}
	amount={ctrl.amount}
	orderRef={ctrl.orderRef}
	errorCode={ctrl.errorCode}
	errorMessage={ctrl.errorMessage}
	onRetryConfirm={ctrl.retryConfirm}
	onGoToOrders={ctrl.goToOrders}
	onGoToCart={ctrl.goToCart}
	onGoToCheckout={ctrl.goToCheckout}
	onGoHome={ctrl.goHome}
/>
