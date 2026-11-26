import { goto } from '$app/navigation';
import { api, auth } from '#lib/auth/auth.svelte';
import { cartState, toast, type CartViewDto } from '#lib/common/logic';
import { CART_ROUTE_PATH } from '#lib/config/routes';

/**
 * 상품 옵션 장바구니 담기 공용 액션 (`PUT /api/cart/items/{optionId}`)
 * - 앨범 · 굿즈 등 상품 상세 및 빠른 담기에서 공통으로 사용합니다.
 * - 성공 시 공용 cartState 스토어를 즉시 동기화합니다.
 */
export async function addOptionToCart(optionId: number, qty: number): Promise<boolean> {
	if (!auth.isLoggedIn) {
		toast.info('로그인 후 장바구니에 담을 수 있습니다.');
		return false;
	}

	try {
		const res = await api<CartViewDto>(`/api/cart/items/${optionId}`, {
			method: 'PUT',
			body: JSON.stringify({ qty })
		});
		if (res && Array.isArray(res.items)) {
			cartState.syncFromCartView(res);
		} else {
			cartState.markOptionAdded(optionId, qty);
		}
		return true;
	} catch (err) {
		const code = (err as { code?: string })?.code;
		if (code === 'CART_FULL') {
			toast.error('장바구니가 가득 찼습니다. (최대 20종 · 옵션당 10개)');
		} else if (code === 'OUT_OF_STOCK') {
			toast.error('재고가 부족합니다.');
		} else {
			console.error('Add option to cart failed:', err);
			toast.error('장바구니에 담지 못했습니다. 잠시 후 다시 시도해 주세요.');
		}
		return false;
	}
}

/** 장바구니 페이지로 이동 */
export function goToCart(): void {
	void goto(CART_ROUTE_PATH, { reset: false });
}
