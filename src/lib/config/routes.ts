/** 앱 전역 주요 라우트 경로 상수 */
export const ALERT_ROUTE_PATH = '/alert';
export const CART_ROUTE_PATH = '/cart';
export const CHECKOUT_ROUTE_PATH = '/checkout';
export const PAYMENT_SUCCESS_ROUTE_PATH = '/payments/success';
export const PAYMENT_FAIL_ROUTE_PATH = '/payments/fail';

/** 마이페이지 기본 및 하위 섹션 경로 */
export const MYPAGE_ROUTE_PATH = '/mypage';
export const MYPAGE_SUB_ROUTES = {
	account: '/mypage/account',
	collection: '/mypage/collection',
	order: '/mypage/order',
	ticket: '/mypage/ticket',
	address: '/mypage/address'
} as const;

export type MyPageRouteKey = keyof typeof MYPAGE_SUB_ROUTES;

/** 경로에서 마이페이지 하위 섹션 키를 파싱 (루트 `/mypage` 또는 타 경로는 null) */
export function parseMyPageSubRoute(pathname?: string | null): MyPageRouteKey | null {
	if (!pathname) return null;
	const normalized = pathname.replace(/\/+$/, '') || '/';
	for (const [key, path] of Object.entries(MYPAGE_SUB_ROUTES)) {
		if (normalized === path) {
			return key as MyPageRouteKey;
		}
	}
	return null;
}

/** 알림함 전용 경로 여부 */
export function isAlertRoute(pathname?: string | null): boolean {
	const normalized = (pathname ?? '').replace(/\/+$/, '') || '/';
	return normalized === ALERT_ROUTE_PATH;
}

/** Keep-Alive 대상인 장바구니 · 주문/결제 경로 여부 */
export function isCartOrCheckoutRoute(pathname?: string | null): boolean {
	if (!pathname) return false;
	const normalized = pathname.replace(/\/+$/, '') || '/';
	return normalized === CART_ROUTE_PATH || normalized === CHECKOUT_ROUTE_PATH;
}

/** 장바구니 · 결제 · 결제 결과 · 공연 예매 등 독립 커머스 플로우 경로 여부 */
export function isPayFlowRoute(pathname?: string | null): boolean {
	if (!pathname) return false;
	const normalized = pathname.replace(/\/+$/, '') || '/';
	return (
		normalized === CART_ROUTE_PATH ||
		normalized === CHECKOUT_ROUTE_PATH ||
		normalized === PAYMENT_SUCCESS_ROUTE_PATH ||
		normalized === PAYMENT_FAIL_ROUTE_PATH ||
		normalized.startsWith('/payments/') ||
		normalized.startsWith('/booking/')
	);
}
