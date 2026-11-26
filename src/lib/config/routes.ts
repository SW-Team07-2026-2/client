/** 앱 전역 주요 라우트 경로 상수 */
export const CART_ROUTE_PATH = '/cart';
export const CHECKOUT_ROUTE_PATH = '/checkout';
export const PAYMENT_SUCCESS_ROUTE_PATH = '/payments/success';
export const PAYMENT_FAIL_ROUTE_PATH = '/payments/fail';

/** Keep-Alive 대상인 장바구니 · 주문/결제 경로 여부 */
export function isCartOrCheckoutRoute(pathname?: string | null): boolean {
	if (!pathname) return false;
	const normalized = pathname.replace(/\/+$/, '') || '/';
	return normalized === CART_ROUTE_PATH || normalized === CHECKOUT_ROUTE_PATH;
}

/** 장바구니 · 결제 · 결제 결과 등 독립 커머스 플로우 경로 여부 */
export function isPayFlowRoute(pathname?: string | null): boolean {
	if (!pathname) return false;
	const normalized = pathname.replace(/\/+$/, '') || '/';
	return (
		normalized === CART_ROUTE_PATH ||
		normalized === CHECKOUT_ROUTE_PATH ||
		normalized === PAYMENT_SUCCESS_ROUTE_PATH ||
		normalized === PAYMENT_FAIL_ROUTE_PATH ||
		normalized.startsWith('/payments/')
	);
}
