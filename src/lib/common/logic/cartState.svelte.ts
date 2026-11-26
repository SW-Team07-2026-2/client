import { api, auth } from '#lib/auth/auth.svelte';

export interface CartItemDto {
	optionId: number;
	productId?: number;
	productType?: string;
	productName?: string;
	optionName?: string;
	qty: number;
}

export interface CartViewDto {
	items?: CartItemDto[] | null;
	totalPrice?: number;
}

/**
 * 장바구니 담김 상태 공용 스토어 (`GET /api/cart` · `PUT /api/cart/items/{optionId}` 동기화)
 * - 앨범/굿즈 상세 및 카드 빠른 담기 간 장바구니 보유 옵션을 실시간 공유합니다.
 */
class CartStateStore {
	/** optionId -> 담긴 수량 매핑 */
	private qtyByOption = $state<Record<number, number>>({});
	private loaded = false;
	private inflight: Promise<void> | null = null;

	hasOption(optionId: number | null | undefined): boolean {
		if (typeof optionId !== 'number' || !Number.isFinite(optionId)) return false;
		return typeof this.qtyByOption[optionId] === 'number' && this.qtyByOption[optionId] > 0;
	}

	/** 로그인 상태일 때 장바구니 목록을 1회 로드해 캐시합니다. */
	ensureLoaded = async (): Promise<void> => {
		if (!auth.isLoggedIn) {
			this.reset();
			return;
		}
		if (this.loaded) return;
		if (this.inflight) return this.inflight;

		this.inflight = (async () => {
			try {
				const res = await api<CartViewDto>('/api/cart');
				this.syncFromCartView(res);
				this.loaded = true;
			} catch {
				// 장바구니 조회 실패 시 기존 상태 유지
			} finally {
				this.inflight = null;
			}
		})();

		return this.inflight;
	};

	/** `GET /api/cart` 또는 `PUT /api/cart/items/{optionId}` 응답의 CartView로 동기화 */
	syncFromCartView(cartView: CartViewDto | null | undefined): void {
		if (!cartView || !Array.isArray(cartView.items)) return;
		const next: Record<number, number> = {};
		for (const item of cartView.items) {
			if (typeof item.optionId === 'number' && typeof item.qty === 'number' && item.qty > 0) {
				next[item.optionId] = item.qty;
			}
		}
		this.qtyByOption = next;
		this.loaded = true;
	}

	/** 응답 본문이 비어 있는 경우에도 방금 담은 옵션을 즉시 반영 */
	markOptionAdded(optionId: number, qty: number): void {
		if (!Number.isFinite(optionId) || qty <= 0) return;
		this.qtyByOption = {
			...this.qtyByOption,
			[optionId]: qty
		};
	}

	reset(): void {
		this.qtyByOption = {};
		this.loaded = false;
		this.inflight = null;
	}
}

export const cartState = new CartStateStore();
