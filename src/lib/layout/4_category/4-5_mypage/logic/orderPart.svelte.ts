import { goto } from '$app/navigation';
import { api } from '#lib/auth/auth.svelte';
import { alertDialog } from '#lib/common/logic/alertDialog.svelte';
import { toast } from '#lib/common/logic/toast.svelte';

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REFUNDED' | string;

export type OrderFilterKey = 'ALL' | 'CONFIRMED' | 'PENDING' | 'CANCELLED';

export interface OrderSummaryDto {
	orderId: number;
	status: OrderStatus;
	totalPrice: number;
	createdAt: string;
}

export interface OrderLineItemDto {
	optionId?: number;
	productId: number;
	productType?: string | null;
	productName?: string | null;
	name?: string | null;
	optionName?: string | null;
	qty: number;
	price: number;
}

export interface OrderShippingDto {
	recipientName: string;
	phone: string;
	zonecode: string;
	address: string;
	addressDetail?: string | null;
}

export interface OrderDetailDto extends OrderSummaryDto {
	pgOrderId?: string | null;
	shipping?: OrderShippingDto | null;
	items?: OrderLineItemDto[] | null;
}

export interface OrderProductMeta {
	id: number;
	productType?: string | null;
	thumbnailUrl?: string | null;
	artistName?: string | null;
	albumId?: number | null;
	format?: string | null;
}

export interface OrderFilterTab {
	key: OrderFilterKey;
	label: string;
	count: number;
}

interface OrderCursorResponse {
	items?: OrderSummaryDto[] | null;
	nextCursor?: string | null;
	hasNext?: boolean;
}

interface ProductListResponse {
	items?: OrderProductMeta[] | null;
}

const PAGE_SIZE = 20;

export function formatOrderPrice(price: number): string {
	return `${Math.max(0, Math.round(price)).toLocaleString('ko-KR')}원`;
}

export function formatOrderDate(iso?: string | null): string {
	if (!iso) return '-';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}.${m}.${day}`;
}

export function formatOrderDateTime(iso?: string | null): string {
	if (!iso) return '-';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	const hh = String(d.getHours()).padStart(2, '0');
	const mm = String(d.getMinutes()).padStart(2, '0');
	return `${y}.${m}.${day} ${hh}:${mm}`;
}

export function getOrderStatusMeta(status: OrderStatus): {
	label: string;
	deliveryText: string;
	tone: 'confirmed' | 'pending' | 'cancelled';
} {
	switch (status) {
		case 'CONFIRMED':
			return {
				label: '결제 완료',
				deliveryText: '배송 준비 중',
				tone: 'confirmed'
			};
		case 'PENDING':
			return {
				label: '결제 대기',
				deliveryText: '결제 완료 후 배송이 시작됩니다',
				tone: 'pending'
			};
		case 'REFUNDED':
			return {
				label: '환불 완료',
				deliveryText: '결제 금액 환불이 완료되었습니다',
				tone: 'cancelled'
			};
		case 'CANCELLED':
			return {
				label: '주문 취소',
				deliveryText: '취소된 주문입니다',
				tone: 'cancelled'
			};
		default:
			return {
				label: status || '상태 확인 중',
				deliveryText: '',
				tone: 'pending'
			};
	}
}

export function canCancelOrder(status: OrderStatus): boolean {
	return status === 'PENDING' || status === 'CONFIRMED';
}

export function resolveOrderItemName(item: OrderLineItemDto): string {
	return item.productName?.trim() || item.name?.trim() || `상품 #${item.productId}`;
}

export function resolveProductTypeLabel(
	productType?: string | null,
	format?: string | null
): string {
	if (format?.trim()) return format.trim();
	if (productType === 'PHYSICAL_ALBUM') return '음반';
	if (productType === 'GOODS') return '굿즈';
	return '';
}

/**
 * 마이페이지 > 주문 · 배송 내역 컨트롤러
 * - GET /api/catalog/orders (커서 페이징)
 * - GET /api/catalog/orders/{id} (주문 상세 조회 · 캐시)
 * - GET /api/catalog/products?ids=... (상품 썸네일 · 아티스트 · 앨범 ID 일괄 조회)
 * - POST /api/catalog/orders/{id}/cancel (주문 취소 / 결제 후 환불)
 */
export class OrderPartController {
	orders = $state<OrderSummaryDto[]>([]);
	detailsById = $state<Record<number, OrderDetailDto>>({});
	loadingDetailIds = $state<Record<number, boolean>>({});
	productsById = $state<Record<number, OrderProductMeta>>({});

	activeFilter = $state<OrderFilterKey>('ALL');
	expandedOrderId = $state<number | null>(null);

	isLoading = $state(false);
	isLoadingMore = $state(false);
	cancellingOrderId = $state<number | null>(null);
	errorMessage = $state<string | null>(null);
	nextCursor = $state<string | null>(null);
	hasNext = $state(false);

	private loaded = false;

	get filterTabs(): readonly OrderFilterTab[] {
		let confirmed = 0;
		let pending = 0;
		let cancelled = 0;
		for (const o of this.orders) {
			if (o.status === 'CONFIRMED') confirmed++;
			else if (o.status === 'PENDING') pending++;
			else if (o.status === 'CANCELLED' || o.status === 'REFUNDED') cancelled++;
		}
		return [
			{ key: 'ALL', label: '전체', count: this.orders.length },
			{ key: 'CONFIRMED', label: '결제 완료', count: confirmed },
			{ key: 'PENDING', label: '결제 대기', count: pending },
			{ key: 'CANCELLED', label: '취소 · 환불', count: cancelled }
		];
	}

	get filteredOrders(): readonly OrderSummaryDto[] {
		if (this.activeFilter === 'ALL') return this.orders;
		if (this.activeFilter === 'CANCELLED') {
			return this.orders.filter((o) => o.status === 'CANCELLED' || o.status === 'REFUNDED');
		}
		return this.orders.filter((o) => o.status === this.activeFilter);
	}

	setFilter = (filter: OrderFilterKey): void => {
		this.activeFilter = filter;
	};

	private fetchMissingProducts = async (productIds: number[]): Promise<void> => {
		const missing = Array.from(
			new Set(
				productIds.filter(
					(id) => typeof id === 'number' && Number.isFinite(id) && !(id in this.productsById)
				)
			)
		);
		if (missing.length === 0) return;

		const nextMap: Record<number, OrderProductMeta> = { ...this.productsById };
		for (let i = 0; i < missing.length; i += 50) {
			const chunk = missing.slice(i, i + 50);
			try {
				const res = await api<ProductListResponse>(
					`/api/catalog/products?ids=${chunk.join(',')}`
				);
				const items = Array.isArray(res?.items) ? res.items : [];
				for (const item of items) {
					if (typeof item?.id === 'number') {
						nextMap[item.id] = item;
					}
				}
			} catch (err) {
				console.error('Failed to batch-fetch order product thumbnails:', err);
			}
		}
		this.productsById = nextMap;
	};

	private prefetchOrderDetails = async (orderIds: number[]): Promise<void> => {
		const missing = orderIds.filter((id) => !(id in this.detailsById));
		if (missing.length === 0) return;

		// 서버 부하를 피하기 위해 최대 3건씩 순차 배치로 상세 조회
		const nextDetails: Record<number, OrderDetailDto> = { ...this.detailsById };
		const productIds: number[] = [];
		const CONCURRENCY = 3;

		for (let i = 0; i < missing.length; i += CONCURRENCY) {
			const batch = missing.slice(i, i + CONCURRENCY);
			const results = await Promise.all(
				batch.map(async (id) => {
					try {
						const detail = await api<OrderDetailDto>(`/api/catalog/orders/${id}`);
						return detail ?? null;
					} catch (err) {
						console.error(`Failed to prefetch order detail #${id}:`, err);
						return null;
					}
				})
			);

			for (const detail of results) {
				if (!detail || typeof detail.orderId !== 'number') continue;
				nextDetails[detail.orderId] = detail;
				const items = Array.isArray(detail.items) ? detail.items : [];
				for (const it of items) {
					if (typeof it.productId === 'number') productIds.push(it.productId);
				}
			}
		}

		this.detailsById = nextDetails;
		if (productIds.length > 0) {
			await this.fetchMissingProducts(productIds);
		}
	};

	ensureDetail = async (orderId: number): Promise<void> => {
		if (orderId in this.detailsById || this.loadingDetailIds[orderId]) return;

		this.loadingDetailIds = { ...this.loadingDetailIds, [orderId]: true };
		try {
			const detail = await api<OrderDetailDto>(`/api/catalog/orders/${orderId}`);
			if (detail) {
				this.detailsById = { ...this.detailsById, [orderId]: detail };
				const productIds = (detail.items ?? [])
					.map((it) => it.productId)
					.filter((id): id is number => typeof id === 'number');
				if (productIds.length > 0) {
					await this.fetchMissingProducts(productIds);
				}
			}
		} catch (err) {
			console.error(`Failed to load order detail #${orderId}:`, err);
			toast.error('주문 상세 정보를 불러오지 못했습니다.');
		} finally {
			const next = { ...this.loadingDetailIds };
			delete next[orderId];
			this.loadingDetailIds = next;
		}
	};

	load = async (force = false): Promise<void> => {
		if (this.isLoading) return;
		if (this.loaded && !force) return;

		this.isLoading = true;
		this.errorMessage = null;
		try {
			const qs = new URLSearchParams({ size: String(PAGE_SIZE) });
			const res = await api<OrderCursorResponse>(`/api/catalog/orders?${qs.toString()}`);
			const items = Array.isArray(res?.items) ? res.items : [];
			this.orders = items;
			this.nextCursor = res?.nextCursor ?? null;
			this.hasNext = Boolean(res?.hasNext && this.nextCursor);
			this.loaded = true;

			if (items.length > 0) {
				await this.prefetchOrderDetails(items.map((o) => o.orderId));
			}
		} catch (err) {
			console.error('Failed to load orders:', err);
			this.errorMessage = '주문 · 배송 내역을 불러오지 못했습니다.';
		} finally {
			this.isLoading = false;
		}
	};

	loadMore = async (): Promise<void> => {
		if (this.isLoading || this.isLoadingMore || !this.hasNext || !this.nextCursor) return;

		this.isLoadingMore = true;
		try {
			const qs = new URLSearchParams({
				cursor: this.nextCursor,
				size: String(PAGE_SIZE)
			});
			const res = await api<OrderCursorResponse>(`/api/catalog/orders?${qs.toString()}`);
			const nextItems = Array.isArray(res?.items) ? res.items : [];
			const seen = new Set(this.orders.map((o) => o.orderId));
			const appended = nextItems.filter((o) => !seen.has(o.orderId));

			this.orders = [...this.orders, ...appended];
			this.nextCursor = res?.nextCursor ?? null;
			this.hasNext = Boolean(res?.hasNext && this.nextCursor);

			if (appended.length > 0) {
				await this.prefetchOrderDetails(appended.map((o) => o.orderId));
			}
		} catch (err) {
			console.error('Failed to load more orders:', err);
			toast.error('추가 주문 내역을 불러오지 못했습니다.');
		} finally {
			this.isLoadingMore = false;
		}
	};

	toggleExpand = (orderId: number): void => {
		if (this.expandedOrderId === orderId) {
			this.expandedOrderId = null;
			return;
		}
		this.expandedOrderId = orderId;
		void this.ensureDetail(orderId);
	};

	confirmCancel = (order: OrderSummaryDto): void => {
		if (this.cancellingOrderId !== null || !canCancelOrder(order.status)) return;

		const isConfirmed = order.status === 'CONFIRMED';
		const detail = this.detailsById[order.orderId];
		const firstItem = detail?.items?.[0];
		const itemCount = detail?.items?.length ?? 0;
		const summaryTitle = firstItem
			? itemCount > 1
				? `${resolveOrderItemName(firstItem)} 외 ${itemCount - 1}건`
				: resolveOrderItemName(firstItem)
			: `주문 #${order.orderId}`;

		void alertDialog.danger({
			title: isConfirmed ? '주문을 취소하고 환불할까요?' : '주문을 취소할까요?',
			description: isConfirmed
				? `${summaryTitle} (${formatOrderPrice(order.totalPrice)})\n결제 금액이 환불 처리되며 취소 후에는 되돌릴 수 없습니다.`
				: `${summaryTitle} (${formatOrderPrice(order.totalPrice)})\n결제 대기 중인 주문이 취소되며 재고가 복구됩니다.`,
			confirmText: isConfirmed ? '취소 · 환불' : '주문 취소',
			cancelText: '유지하기',
			closeOnOverlay: true,
			onConfirm: async () => {
				this.cancellingOrderId = order.orderId;
				try {
					const updated = await api<OrderDetailDto>(
						`/api/catalog/orders/${order.orderId}/cancel`,
						{ method: 'POST' }
					);
					const nextStatus: OrderStatus =
						updated?.status ?? (isConfirmed ? 'REFUNDED' : 'CANCELLED');

					this.orders = this.orders.map((o) =>
						o.orderId === order.orderId ? { ...o, status: nextStatus } : o
					);
					if (updated) {
						this.detailsById = { ...this.detailsById, [order.orderId]: updated };
					} else if (this.detailsById[order.orderId]) {
						this.detailsById = {
							...this.detailsById,
							[order.orderId]: { ...this.detailsById[order.orderId], status: nextStatus }
						};
					}

					toast.success(
						nextStatus === 'REFUNDED'
							? '주문 취소 및 환불이 완료되었습니다.'
							: '주문이 취소되었습니다.'
					);
				} catch (err) {
					console.error(`Failed to cancel order #${order.orderId}:`, err);
					const code = (err as { code?: string })?.code;
					const msg =
						code === 'PAYMENT_UNAVAILABLE' || code === 'PG_UNAVAILABLE'
							? '결제사 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.'
							: err instanceof Error && err.message
								? err.message
								: '주문 취소에 실패했습니다.';
					toast.error(msg);
					throw err;
				} finally {
					this.cancellingOrderId = null;
				}
			}
		});
	};

	openProduct = (item: OrderLineItemDto): void => {
		const meta = this.productsById[item.productId];
		const productType = item.productType ?? meta?.productType;
		if (productType === 'GOODS') {
			void goto(`/goods/${item.productId}`, { reset: false });
			return;
		}
		if (productType === 'PHYSICAL_ALBUM' || meta?.albumId) {
			const routeId = meta?.albumId ?? item.productId;
			void goto(`/album/${routeId}`, { reset: false });
			return;
		}
		void goto(`/goods/${item.productId}`, { reset: false });
	};

	browseStore = (): void => {
		void goto('/album', { reset: false });
	};
}
