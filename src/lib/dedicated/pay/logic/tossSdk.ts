import { TOSS_PAYMENTS_SDK_URL } from '#lib/config/pay';

export interface TossPaymentWidgets {
	setAmount: (amount: { currency: 'KRW'; value: number }) => Promise<void>;
	renderPaymentMethods: (options: {
		selector: string;
		variantKey?: string;
	}) => Promise<{ destroy?: () => Promise<void> }>;
	renderAgreement: (options: {
		selector: string;
		variantKey?: string;
	}) => Promise<{ destroy?: () => Promise<void> }>;
	requestPayment: (options: {
		orderId: string;
		orderName: string;
		successUrl: string;
		failUrl: string;
		customerName?: string;
		customerMobilePhone?: string;
	}) => Promise<void>;
}

export interface TossPaymentsInstance {
	widgets: (options: { customerKey: string }) => TossPaymentWidgets;
}

export interface TossPaymentsConstructor {
	(clientKey: string): TossPaymentsInstance;
	ANONYMOUS: string;
}

declare global {
	interface Window {
		TossPayments?: TossPaymentsConstructor;
	}
}

let sdkLoadPromise: Promise<TossPaymentsConstructor> | null = null;

/**
 * 토스페이먼츠 SDK v2 스크립트를 필요 시점에만 동적 로드합니다.
 */
export function loadTossPaymentsSdk(): Promise<TossPaymentsConstructor> {
	if (typeof window === 'undefined') {
		return Promise.reject(new Error('브라우저 환경에서만 결제를 진행할 수 있습니다.'));
	}

	if (typeof window.TossPayments === 'function') {
		return Promise.resolve(window.TossPayments);
	}

	if (sdkLoadPromise) return sdkLoadPromise;

	sdkLoadPromise = new Promise<TossPaymentsConstructor>((resolve, reject) => {
		const existing = document.querySelector<HTMLScriptElement>(
			`script[src="${TOSS_PAYMENTS_SDK_URL}"]`
		);

		const onLoad = () => {
			if (typeof window.TossPayments === 'function') {
				resolve(window.TossPayments);
			} else {
				sdkLoadPromise = null;
				reject(new Error('토스페이먼츠 SDK를 초기화하지 못했습니다.'));
			}
		};

		const onError = () => {
			sdkLoadPromise = null;
			reject(new Error('토스페이먼츠 SDK 스크립트를 불러오지 못했습니다.'));
		};

		if (existing) {
			existing.addEventListener('load', onLoad, { once: true });
			existing.addEventListener('error', onError, { once: true });
			return;
		}

		const script = document.createElement('script');
		script.src = TOSS_PAYMENTS_SDK_URL;
		script.async = true;
		script.addEventListener('load', onLoad, { once: true });
		script.addEventListener('error', onError, { once: true });
		document.head.appendChild(script);
	});

	return sdkLoadPromise;
}
