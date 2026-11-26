import { goto } from '$app/navigation';
import { api, auth } from '#lib/auth/auth.svelte';
import { cartState, toast } from '#lib/common/logic';
import { CART_MAX_QTY_PER_OPTION } from '#lib/config/pay';
import { CHECKOUT_ROUTE_PATH } from '#lib/config/routes';
import { saveCheckoutDraft } from './checkoutDraft';
import type { CartLineItem, CartViewResponse, CheckoutItemSnapshot } from './types';

/**
 * 장바구니 페이지 전용 컨트롤러 (`src/lib/dedicated/pay/logic/cartPage.svelte.ts`)
 * - GET/PUT/DELETE `/api/cart/**` 연동, 선택 상태, 수량 조절, 공용 cartState 동기화,
 *   체크아웃 초안 저장 및 주문서 이동을 전담합니다.
 */
export class CartPageController {
	isLoading = $state(true);
	errorMessage = $state<string | null>(null);
	items = $state<CartLineItem[]>([]);
	/** 선택된 optionId 집합 (record 기반 반응형) */
	selectedMap = $state<Record<number, boolean>>({});
	/** 개별 옵션 수량 변경/삭제 처리 중 여부 */
	busyOptions = $state<Record<number, boolean>>({});
	clearing = $state(false);

	private loadToken = 0;

	get availableItems(): CartLineItem[] {
		return this.items.filter((item) => !item.soldOut);
	}

	get selectedItems(): CartLineItem[] {
		return this.items.filter((item) => !item.soldOut && Boolean(this.selectedMap[item.optionId]));
	}

	get selectedCount(): number {
		return this.selectedItems.length;
	}

	get selectedQtyTotal(): number {
		return this.selectedItems.reduce((sum, item) => sum + item.qty, 0);
	}

	get selectedTotalPrice(): number {
		return this.selectedItems.reduce((sum, item) => sum + item.price * item.qty, 0);
	}

	get isAllSelected(): boolean {
		const avail = this.availableItems;
		return avail.length > 0 && avail.every((item) => Boolean(this.selectedMap[item.optionId]));
	}

	get canCheckout(): boolean {
		return this.selectedItems.length > 0 && !this.clearing;
	}

	maxQtyFor = (item: CartLineItem): number => {
		if (item.soldOut) return 1;
		const stock =
			typeof item.stockQty === 'number' && item.stockQty > 0
				? item.stockQty
				: CART_MAX_QTY_PER_OPTION;
		return Math.max(1, Math.min(CART_MAX_QTY_PER_OPTION, stock));
	};

	load = async (silent = false): Promise<void> => {
		if (!auth.isLoggedIn) {
			this.items = [];
			this.selectedMap = {};
			this.isLoading = false;
			this.errorMessage = '로그인 후 장바구니를 확인할 수 있습니다.';
			return;
		}

		const token = ++this.loadToken;
		if (!silent || this.items.length === 0) {
			this.isLoading = true;
		}
		this.errorMessage = null;

		try {
			const res = await api<CartViewResponse>('/api/cart');
			if (token !== this.loadToken) return;
			this.applyCartView(res, !silent || this.items.length === 0);
		} catch (err) {
			if (token !== this.loadToken) return;
			console.error('Failed to load cart:', err);
			if (!silent) {
				this.errorMessage = '장바구니를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
			}
		} finally {
			if (token === this.loadToken) {
				this.isLoading = false;
			}
		}
	};

	toggleSelect = (optionId: number): void => {
		const target = this.items.find((i) => i.optionId === optionId);
		if (!target || target.soldOut) return;
		this.selectedMap = {
			...this.selectedMap,
			[optionId]: !this.selectedMap[optionId]
		};
	};

	toggleSelectAll = (): void => {
		const nextChecked = !this.isAllSelected;
		const next: Record<number, boolean> = {};
		for (const item of this.items) {
			next[item.optionId] = !item.soldOut && nextChecked;
		}
		this.selectedMap = next;
	};

	stepQty = async (optionId: number, delta: number): Promise<void> => {
		const item = this.items.find((i) => i.optionId === optionId);
		if (!item || item.soldOut || this.busyOptions[optionId]) return;

		const maxQty = this.maxQtyFor(item);
		const nextQty = Math.max(1, Math.min(maxQty, item.qty + delta));
		if (nextQty === item.qty) return;

		const prevQty = item.qty;
		this.items = this.items.map((i) => (i.optionId === optionId ? { ...i, qty: nextQty } : i));
		this.busyOptions = { ...this.busyOptions, [optionId]: true };

		try {
			const res = await api<CartViewResponse>(`/api/cart/items/${optionId}`, {
				method: 'PUT',
				body: JSON.stringify({ qty: nextQty })
			});
			this.applyCartView(res, false);
		} catch (err) {
			this.items = this.items.map((i) => (i.optionId === optionId ? { ...i, qty: prevQty } : i));
			const code = (err as { code?: string })?.code;
			if (code === 'CART_FULL') {
				toast.error(`옵션당 최대 ${CART_MAX_QTY_PER_OPTION}개까지 담을 수 있습니다.`);
			} else if (code === 'OUT_OF_STOCK') {
				toast.error('재고가 부족합니다.');
			} else {
				console.error('Cart qty update failed:', err);
				toast.error('수량을 변경하지 못했습니다.');
			}
		} finally {
			const nextBusy = { ...this.busyOptions };
			delete nextBusy[optionId];
			this.busyOptions = nextBusy;
		}
	};

	removeItem = async (optionId: number): Promise<void> => {
		if (this.busyOptions[optionId]) return;
		this.busyOptions = { ...this.busyOptions, [optionId]: true };

		try {
			const res = await api<CartViewResponse>(`/api/cart/items/${optionId}`, {
				method: 'DELETE'
			});
			this.applyCartView(res, false);
		} catch (err) {
			console.error('Cart item remove failed:', err);
			toast.error('상품을 삭제하지 못했습니다.');
		} finally {
			const nextBusy = { ...this.busyOptions };
			delete nextBusy[optionId];
			this.busyOptions = nextBusy;
		}
	};

	clearCart = async (): Promise<void> => {
		if (this.items.length === 0 || this.clearing) return;
		this.clearing = true;

		try {
			await api<void>('/api/cart', { method: 'DELETE' });
			this.items = [];
			this.selectedMap = {};
			cartState.syncFromCartView({ items: [], totalPrice: 0 });
			toast.info('장바구니를 비웠습니다.');
		} catch (err) {
			console.error('Clear cart failed:', err);
			toast.error('장바구니를 비우지 못했습니다.');
		} finally {
			this.clearing = false;
		}
	};

	goToProduct = (item: CartLineItem): void => {
		const isAlbum = item.productType?.toUpperCase() === 'PHYSICAL_ALBUM';
		const path = isAlbum ? `/album/${item.productId}` : `/goods/${item.productId}`;
		void goto(path, { reset: false });
	};

	proceedToCheckout = (): void => {
		const chosen = this.selectedItems;
		if (chosen.length === 0) {
			toast.info('주문할 상품을 선택해 주세요.');
			return;
		}

		const snapshots: CheckoutItemSnapshot[] = chosen.map((item) => ({
			optionId: item.optionId,
			productId: item.productId,
			productType: item.productType,
			productName: item.productName,
			optionName: item.optionName,
			thumbnailUrl: item.thumbnailUrl ?? null,
			price: item.price,
			qty: item.qty
		}));

		saveCheckoutDraft({ items: snapshots });
		void goto(CHECKOUT_ROUTE_PATH, { reset: false });
	};

	goBack = (): void => {
		if (typeof window !== 'undefined' && window.history.length > 1) {
			window.history.back();
			return;
		}
		void goto('/artist', { reset: false });
	};

	goToCatalog = (): void => {
		void goto('/album', { reset: false });
	};

	private applyCartView(res: CartViewResponse | null | undefined, selectAllAvailable: boolean): void {
		const nextItems = Array.isArray(res?.items) ? res.items : [];
		this.items = nextItems;
		cartState.syncFromCartView({ items: nextItems, totalPrice: res?.totalPrice });

		const nextSelected: Record<number, boolean> = {};
		for (const item of nextItems) {
			if (item.soldOut) {
				nextSelected[item.optionId] = false;
			} else if (selectAllAvailable) {
				nextSelected[item.optionId] = true;
			} else {
				nextSelected[item.optionId] = this.selectedMap[item.optionId] ?? true;
			}
		}
		this.selectedMap = nextSelected;
	}
}
