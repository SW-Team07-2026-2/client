/** 장바구니 · 주문 · 결제 공용 타입 정의 */

export type ProductOrderType = 'PHYSICAL_ALBUM' | 'GOODS' | string;

export interface CartLineItem {
	optionId: number;
	productId: number;
	productType: ProductOrderType;
	productName: string;
	optionName: string;
	vinylColor?: string | null;
	size?: string | null;
	thumbnailUrl?: string | null;
	price: number;
	qty: number;
	stockQty?: number | null;
	soldOut: boolean;
	addedAt?: string | null;
}

export interface CartViewResponse {
	items?: CartLineItem[] | null;
	totalPrice?: number;
}

export interface ShippingAddress {
	id: number;
	label?: string | null;
	recipientName: string;
	phone: string;
	zonecode: string;
	address: string;
	addressDetail?: string | null;
	isDefault: boolean;
}

export interface ShippingFormInput {
	recipientName: string;
	phone: string;
	zonecode: string;
	address: string;
	addressDetail: string;
}

export interface CheckoutItemSnapshot {
	optionId: number;
	productId: number;
	productType: ProductOrderType;
	productName: string;
	optionName: string;
	thumbnailUrl?: string | null;
	price: number;
	qty: number;
}

export interface CheckoutDraft {
	items: CheckoutItemSnapshot[];
	pendingOrder?: {
		orderId: number;
		pgOrderId: string;
		amount: number;
		orderName: string;
		expiresAt?: string | null;
	};
}

export interface OrderCreateResponse {
	orderId: number;
	amount: number;
	pgOrderId: string;
	status: string;
	expiresAt?: string | null;
}

export interface PaymentView {
	paymentId: number;
	orderType: 'TICKET' | 'GOODS' | string;
	orderRef: string;
	amount: number;
	status: string;
	method?: string | null;
	reason?: string | null;
	requestedAt?: string | null;
	completedAt?: string | null;
}

export type PaymentResultMode = 'success' | 'fail';
export type PaymentConfirmStatus = 'confirming' | 'succeeded' | 'pending' | 'failed';
