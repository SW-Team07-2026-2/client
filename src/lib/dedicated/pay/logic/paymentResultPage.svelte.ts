import { goto } from '$app/navigation';
import { api } from '#lib/auth/auth.svelte';
import { cartState, type CartViewDto } from '#lib/common/logic';
import { CART_ROUTE_PATH, CHECKOUT_ROUTE_PATH } from '#lib/config/routes';
import { clearCheckoutDraft, loadCheckoutDraft } from './checkoutDraft';
import type { PaymentConfirmStatus, PaymentResultMode, PaymentView } from './types';

export interface PaymentResultQuery {
	paymentKey?: string | null;
	orderId?: string | null;
	amount?: string | null;
	code?: string | null;
	message?: string | null;
}

const ERROR_MESSAGES: Record<string, string> = {
	AMOUNT_MISMATCH: '결제 금액이 주문 정보와 일치하지 않습니다.',
	ALREADY_CONFIRMED: '이미 결제가 완료된 주문입니다.',
	PAYMENT_EXPIRED: '결제 유효 시간이 만료되었습니다. 다시 주문해 주세요.',
	PAYMENT_NOT_PENDING: '결제 가능한 상태가 아닙니다.',
	PG_PROCESSING: '결제 승인 결과를 확인하고 있습니다. 잠시 후 다시 확인해 주세요.',
	PG_UNAVAILABLE: '결제사 응답이 지연되고 있습니다. 잠시 후 다시 확인해 주세요.',
	PAY_PROCESS_CANCELED: '결제가 취소되었습니다.',
	USER_CANCEL: '결제가 취소되었습니다.'
};

/**
 * 결제 후 결과 페이지 전용 컨트롤러 (`src/lib/dedicated/pay/logic/paymentResultPage.svelte.ts`)
 * - `/payments/success`: 쿼리 파라미터(`paymentKey`, `orderId`, `amount`)로 `POST /api/payments/confirm` 승인 처리
 * - `/payments/fail`: 실패/취소 사유 표시 및 재시도 안내
 */
export class PaymentResultController {
	status = $state<PaymentConfirmStatus>('confirming');
	payment = $state<PaymentView | null>(null);
	orderName = $state('');
	amount = $state<number | null>(null);
	orderRef = $state('');
	errorCode = $state<string | null>(null);
	errorMessage = $state<string | null>(null);

	private lastQuery: PaymentResultQuery | null = null;
	private confirmToken = 0;

	initialize = async (mode: PaymentResultMode, query: PaymentResultQuery): Promise<void> => {
		this.lastQuery = query;
		const draft = loadCheckoutDraft();
		if (draft?.pendingOrder?.orderName) {
			this.orderName = draft.pendingOrder.orderName;
		}

		if (mode === 'fail') {
			this.status = 'failed';
			this.orderRef = query.orderId?.trim() ?? '';
			this.errorCode = query.code?.trim() || 'PAYMENT_FAILED';
			this.errorMessage =
				query.message?.trim() ||
				(this.errorCode ? ERROR_MESSAGES[this.errorCode] : null) ||
				'결제가 완료되지 않았습니다.';
			return;
		}

		await this.confirmPayment(query);
	};

	retryConfirm = async (): Promise<void> => {
		if (!this.lastQuery) return;
		await this.confirmPayment(this.lastQuery);
	};

	goToOrders = (): void => {
		void goto('/mypage', { reset: false });
	};

	goToCart = (): void => {
		void goto(CART_ROUTE_PATH, { reset: false });
	};

	goToCheckout = (): void => {
		void goto(CHECKOUT_ROUTE_PATH, { reset: false });
	};

	goHome = (): void => {
		void goto('/artist', { reset: false });
	};

	private async confirmPayment(query: PaymentResultQuery): Promise<void> {
		const paymentKey = query.paymentKey?.trim() ?? '';
		const orderId = query.orderId?.trim() ?? '';
		const parsedAmount = Number(query.amount);

		this.orderRef = orderId;
		this.amount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : null;

		if (!paymentKey || !orderId || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
			this.status = 'failed';
			this.errorCode = 'INVALID_CALLBACK';
			this.errorMessage = '결제 승인에 필요한 정보가 올바르지 않습니다.';
			return;
		}

		const token = ++this.confirmToken;
		this.status = 'confirming';
		this.errorCode = null;
		this.errorMessage = null;

		try {
			const res = await api<PaymentView>('/api/payments/confirm', {
				method: 'POST',
				body: JSON.stringify({
					paymentKey,
					orderId,
					amount: parsedAmount
				})
			});
			if (token !== this.confirmToken) return;

			this.payment = res;
			this.amount = typeof res?.amount === 'number' ? res.amount : parsedAmount;
			this.orderRef = res?.orderRef || orderId;
			this.status = 'succeeded';

			// 결제 성공 시 체크아웃 초안 정리 + 서버 장바구니 최신 상태 동기화
			clearCheckoutDraft();
			void this.refreshCartState();
		} catch (err) {
			if (token !== this.confirmToken) return;
			const code = (err as { code?: string })?.code ?? null;
			this.errorCode = code;

			if (code === 'ALREADY_CONFIRMED') {
				this.status = 'succeeded';
				clearCheckoutDraft();
				void this.refreshCartState();
				return;
			}

			if (code === 'PG_PROCESSING' || code === 'PG_UNAVAILABLE' || code === 'PAYMENT_PENDING') {
				this.status = 'pending';
				this.errorMessage =
					(code && ERROR_MESSAGES[code]) || '결제 결과를 확인 중입니다. 잠시 후 다시 시도해 주세요.';
				return;
			}

			console.error('Payment confirm failed:', err);
			this.status = 'failed';
			this.errorMessage =
				(code && ERROR_MESSAGES[code]) ||
				'결제 승인에 실패했습니다. 카드 한도나 결제 정보를 확인해 주세요.';
		}
	}

	private async refreshCartState(): Promise<void> {
		try {
			const res = await api<CartViewDto>('/api/cart');
			cartState.syncFromCartView(res);
		} catch {
			// 무시
		}
	}
}
