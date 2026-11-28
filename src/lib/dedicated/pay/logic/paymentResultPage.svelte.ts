import { goto } from '$app/navigation';
import { api } from '#lib/auth/auth.svelte';
import { cartState, type CartViewDto } from '#lib/common/logic';
import {
	CART_ROUTE_PATH,
	CHECKOUT_ROUTE_PATH,
	MYPAGE_SUB_ROUTES
} from '#lib/config/routes';
import {
	clearBookingPaymentDraft,
	loadBookingPaymentDraft
} from '#lib/dedicated/booking/logic/bookingDraft';
import { clearCheckoutDraft, loadCheckoutDraft } from './checkoutDraft';
import type { PaymentConfirmStatus, PaymentResultMode, PaymentView } from './types';

export interface PaymentResultQuery {
	paymentKey?: string | null;
	orderId?: string | null;
	amount?: string | null;
	code?: string | null;
	message?: string | null;
	flow?: string | null;
	bookingId?: string | null;
	concertId?: string | null;
}

interface BookingConfirmResponse {
	bookingId: number;
	status: 'CONFIRMED' | 'PENDING' | 'EXPIRED' | string;
	paymentStatus?: 'APPROVED' | 'DECLINED' | string;
	reason?: string | null;
	pgOrderId?: string | null;
}

const ERROR_MESSAGES: Record<string, string> = {
	AMOUNT_MISMATCH: '결제 금액이 주문 정보와 일치하지 않습니다.',
	ALREADY_CONFIRMED: '이미 결제가 완료된 주문입니다.',
	ALREADY_PAID: '이미 결제가 완료된 예매입니다.',
	PAYMENT_EXPIRED: '결제 유효 시간이 만료되었습니다. 다시 주문해 주세요.',
	HOLD_EXPIRED: '좌석 선점 시간이 만료되어 결제가 진행되지 않았습니다. 좌석을 다시 선택해 주세요.',
	BOOKING_CANCELLED: '취소된 예매입니다. 좌석을 다시 선택해 주세요.',
	PAYMENT_NOT_PENDING: '결제 가능한 상태가 아닙니다.',
	PAYMENT_PENDING: '결제 승인 결과를 확인하고 있습니다. 잠시 후 다시 확인해 주세요.',
	PG_PROCESSING: '결제 승인 결과를 확인하고 있습니다. 잠시 후 다시 확인해 주세요.',
	PG_UNAVAILABLE: '결제사 응답이 지연되고 있습니다. 잠시 후 다시 확인해 주세요.',
	PAY_PROCESS_CANCELED: '결제가 취소되었습니다.',
	USER_CANCEL: '결제가 취소되었습니다.'
};

/**
 * 결제 후 결과 페이지 전용 컨트롤러 (`src/lib/dedicated/pay/logic/paymentResultPage.svelte.ts`)
 * - 굿즈 · 음반: `POST /api/payments/confirm`
 * - 공연 티켓 (`flow=ticket`): `POST /api/concerts/bookings/{bookingId}/confirm`
 */
export class PaymentResultController {
	status = $state<PaymentConfirmStatus>('confirming');
	payment = $state<PaymentView | null>(null);
	orderName = $state('');
	amount = $state<number | null>(null);
	orderRef = $state('');
	errorCode = $state<string | null>(null);
	errorMessage = $state<string | null>(null);
	isTicketFlow = $state(false);

	private lastQuery: PaymentResultQuery | null = null;
	private ticketBookingId: number | null = null;
	private ticketConcertId: number | null = null;
	private confirmToken = 0;

	initialize = async (mode: PaymentResultMode, query: PaymentResultQuery): Promise<void> => {
		this.lastQuery = query;

		const parsedBookingId = query.bookingId ? Number(query.bookingId) : NaN;
		const parsedConcertId = query.concertId ? Number(query.concertId) : NaN;
		const ticketDraft = loadBookingPaymentDraft();
		const isTicket =
			query.flow === 'ticket' ||
			(Number.isInteger(parsedBookingId) && parsedBookingId > 0);

		this.isTicketFlow = isTicket;
		this.ticketBookingId =
			Number.isInteger(parsedBookingId) && parsedBookingId > 0
				? parsedBookingId
				: (ticketDraft?.bookingId ?? null);
		this.ticketConcertId =
			Number.isInteger(parsedConcertId) && parsedConcertId > 0
				? parsedConcertId
				: (ticketDraft?.concertId ?? null);

		if (isTicket && ticketDraft) {
			this.orderName =
				ticketDraft.seatLabels.length > 1
					? `${ticketDraft.concertTitle} (${ticketDraft.seatLabels.length}매)`
					: `${ticketDraft.concertTitle} 티켓`;
		} else {
			const draft = loadCheckoutDraft();
			if (draft?.pendingOrder?.orderName) {
				this.orderName = draft.pendingOrder.orderName;
			}
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

		if (isTicket) {
			await this.confirmTicketBooking(query);
		} else {
			await this.confirmPayment(query);
		}
	};

	retryConfirm = async (): Promise<void> => {
		if (!this.lastQuery) return;
		if (this.isTicketFlow) {
			await this.confirmTicketBooking(this.lastQuery);
		} else {
			await this.confirmPayment(this.lastQuery);
		}
	};

	goToOrders = (): void => {
		void goto(
			this.isTicketFlow ? MYPAGE_SUB_ROUTES.ticket : MYPAGE_SUB_ROUTES.order,
			{ reset: false }
		);
	};

	goToCart = (): void => {
		void goto(CART_ROUTE_PATH, { reset: false });
	};

	goToCheckout = (): void => {
		if (this.isTicketFlow && this.ticketConcertId !== null) {
			void goto(`/booking/${this.ticketConcertId}`, { reset: false });
			return;
		}
		void goto(CHECKOUT_ROUTE_PATH, { reset: false });
	};

	goHome = (): void => {
		void goto(this.isTicketFlow ? '/concert' : '/artist', { reset: false });
	};

	private async confirmTicketBooking(query: PaymentResultQuery): Promise<void> {
		const paymentKey = query.paymentKey?.trim() ?? '';
		const orderId = query.orderId?.trim() ?? '';
		const parsedAmount = Number(query.amount);
		const bookingId = this.ticketBookingId;

		this.orderRef = orderId;
		this.amount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : null;

		if (
			!bookingId ||
			!paymentKey ||
			!Number.isFinite(parsedAmount) ||
			parsedAmount <= 0
		) {
			this.status = 'failed';
			this.errorCode = 'INVALID_CALLBACK';
			this.errorMessage = '티켓 결제 승인에 필요한 정보가 올바르지 않습니다.';
			return;
		}

		const token = ++this.confirmToken;
		this.status = 'confirming';
		this.errorCode = null;
		this.errorMessage = null;

		try {
			const res = await api<BookingConfirmResponse>(
				`/api/concerts/bookings/${bookingId}/confirm`,
				{
					method: 'POST',
					body: JSON.stringify({
						paymentKey,
						amount: parsedAmount
					})
				}
			);
			if (token !== this.confirmToken) return;

			if (res?.status === 'CONFIRMED' || res?.paymentStatus === 'APPROVED') {
				this.orderRef = res.pgOrderId || orderId || `#${bookingId}`;
				this.payment = {
					paymentId: bookingId,
					orderType: 'TICKET',
					orderRef: this.orderRef,
					amount: parsedAmount,
					status: 'APPROVED'
				};
				this.status = 'succeeded';
				clearBookingPaymentDraft();
				return;
			}

			this.status = 'failed';
			this.errorCode = res?.paymentStatus || 'PAYMENT_DECLINED';
			this.errorMessage =
				res?.reason || '결제가 승인되지 않았습니다. 다시 시도해 주세요.';
		} catch (err) {
			if (token !== this.confirmToken) return;
			const code = (err as { code?: string })?.code ?? null;
			this.errorCode = code;

			if (code === 'ALREADY_PAID' || code === 'ALREADY_CONFIRMED') {
				this.status = 'succeeded';
				clearBookingPaymentDraft();
				return;
			}

			if (code === 'PAYMENT_PENDING' || code === 'PG_PROCESSING' || code === 'PG_UNAVAILABLE') {
				this.status = 'pending';
				this.errorMessage =
					(code && ERROR_MESSAGES[code]) ||
					'결제 결과를 확인 중입니다. 잠시 후 다시 시도해 주세요.';
				return;
			}

			console.error('Ticket booking confirm failed:', err);
			this.status = 'failed';
			this.errorMessage =
				(code && ERROR_MESSAGES[code]) ||
				'티켓 결제 승인에 실패했습니다. 잠시 후 다시 시도해 주세요.';
		}
	}

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
