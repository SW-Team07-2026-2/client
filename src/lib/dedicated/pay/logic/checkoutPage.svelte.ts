import { goto } from '$app/navigation';
import { api, auth } from '#lib/auth/auth.svelte';
import { toast } from '#lib/common/logic';
import {
	SHIPPING_ADDRESS_DETAIL_MAX_LENGTH,
	SHIPPING_PHONE_MAX_DIGITS,
	SHIPPING_RECIPIENT_MAX_LENGTH,
	TOSS_CLIENT_KEY
} from '#lib/config/pay';
import {
	CART_ROUTE_PATH,
	PAYMENT_FAIL_ROUTE_PATH,
	PAYMENT_SUCCESS_ROUTE_PATH
} from '#lib/config/routes';
import { loadCheckoutDraft, saveCheckoutDraft } from './checkoutDraft';
import { closeDaumPostcode, openDaumPostcode } from './daumPostcode';
import { loadTossPaymentsSdk, type TossPaymentWidgets } from './tossSdk';
import type {
	CartViewResponse,
	CheckoutItemSnapshot,
	OrderCreateResponse,
	ShippingAddress,
	ShippingFormInput
} from './types';

interface AddressListResponse {
	items?: ShippingAddress[] | null;
}

/** 한국 전화번호 숫자만 추출해 자동으로 하이픈(-) 포맷팅 (02 최대 10자리, 그 외 최대 11자리) */
export function formatKoreanPhone(raw: string): string {
	const digitsOnly = raw.replace(/\D/g, '');
	if (digitsOnly.startsWith('02')) {
		const d = digitsOnly.slice(0, 10);
		if (d.length <= 2) return d;
		if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
		if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
		return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
	}
	const d = digitsOnly.slice(0, SHIPPING_PHONE_MAX_DIGITS);
	if (d.length <= 3) return d;
	if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
	if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
	return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

/**
 * 주문서 · 결제하기 페이지 전용 컨트롤러 (`src/lib/dedicated/pay/logic/checkoutPage.svelte.ts`)
 * - 체크아웃 상품 복원, 저장 배송지 조회/선택/신규 저장(`GET/POST /api/members/me/addresses`),
 *   토스페이먼츠 SDK v2 위젯 마운트, 주문 생성(`POST /api/catalog/orders`) 및 결제창 호출을 전담합니다.
 */
export class CheckoutPageController {
	isLoading = $state(true);
	errorMessage = $state<string | null>(null);
	items = $state<CheckoutItemSnapshot[]>([]);

	addresses = $state<ShippingAddress[]>([]);
	selectedAddressId = $state<number | 'manual'>('manual');
	saveAsNewAddress = $state(false);
	shipping = $state<ShippingFormInput>({
		recipientName: '',
		phone: '',
		zonecode: '',
		address: '',
		addressDetail: ''
	});
	validationError = $state<string | null>(null);

	widgetReady = $state(false);
	widgetLoading = $state(false);
	widgetError = $state<string | null>(null);
	submitting = $state(false);

	private widgets: TossPaymentWidgets | null = null;
	private paymentMethodsHandle: { destroy?: () => Promise<void> } | null = null;
	private agreementHandle: { destroy?: () => Promise<void> } | null = null;
	private loadToken = 0;

	get hasTossClientKey(): boolean {
		return Boolean(TOSS_CLIENT_KEY);
	}

	get totalPrice(): number {
		return this.items.reduce((sum, item) => sum + item.price * item.qty, 0);
	}

	get totalQty(): number {
		return this.items.reduce((sum, item) => sum + item.qty, 0);
	}

	get orderName(): string {
		if (this.items.length === 0) return 'INDIG 주문';
		const first = this.items[0].productName;
		if (this.items.length === 1) return first;
		return `${first} 외 ${this.items.length - 1}건`;
	}

	get canSubmit(): boolean {
		return (
			!this.isLoading &&
			!this.submitting &&
			this.items.length > 0 &&
			this.totalPrice > 0 &&
			this.widgetReady
		);
	}

	load = async (): Promise<void> => {
		if (!auth.isLoggedIn) {
			this.isLoading = false;
			this.errorMessage = '로그인 후 결제를 진행할 수 있습니다.';
			return;
		}

		const token = ++this.loadToken;
		this.isLoading = true;
		this.errorMessage = null;

		try {
			const draft = loadCheckoutDraft();
			if (draft && draft.items.length > 0) {
				this.items = draft.items;
			} else {
				// 직접 /checkout으로 접근한 경우 현재 장바구니에서 구매 가능한 항목 로드
				const cart = await api<CartViewResponse>('/api/cart');
				if (token !== this.loadToken) return;
				const available = (cart?.items ?? []).filter((i) => !i.soldOut);
				this.items = available.map((item) => ({
					optionId: item.optionId,
					productId: item.productId,
					productType: item.productType,
					productName: item.productName,
					optionName: item.optionName,
					thumbnailUrl: item.thumbnailUrl ?? null,
					price: item.price,
					qty: item.qty
				}));
			}

			await this.fetchAddresses(token);
		} catch (err) {
			if (token !== this.loadToken) return;
			console.error('Failed to initialize checkout:', err);
			this.errorMessage = '주문 정보를 불러오지 못했습니다.';
		} finally {
			if (token === this.loadToken) {
				this.isLoading = false;
			}
		}
	};

	selectAddress = (id: number | 'manual'): void => {
		this.selectedAddressId = id;
		this.validationError = null;
		if (id === 'manual') {
			this.shipping = {
				recipientName: '',
				phone: '',
				zonecode: '',
				address: '',
				addressDetail: ''
			};
			return;
		}

		const found = this.addresses.find((a) => a.id === id);
		if (found) {
			this.shipping = {
				recipientName: found.recipientName.slice(0, SHIPPING_RECIPIENT_MAX_LENGTH),
				phone: formatKoreanPhone(found.phone),
				zonecode: found.zonecode,
				address: found.address,
				addressDetail: (found.addressDetail ?? '').slice(0, SHIPPING_ADDRESS_DETAIL_MAX_LENGTH)
			};
			this.saveAsNewAddress = false;
		}
	};

	updateShippingField = (field: keyof ShippingFormInput, value: string): void => {
		let nextValue = value;
		if (field === 'phone') {
			nextValue = formatKoreanPhone(value);
		} else if (field === 'recipientName') {
			nextValue = value.slice(0, SHIPPING_RECIPIENT_MAX_LENGTH);
		} else if (field === 'addressDetail') {
			nextValue = value.slice(0, SHIPPING_ADDRESS_DETAIL_MAX_LENGTH);
		}
		this.shipping = {
			...this.shipping,
			[field]: nextValue
		};
		this.validationError = null;
	};

	setSaveAsNewAddress = (checked: boolean): void => {
		this.saveAsNewAddress = checked;
	};

	/** Daum(카카오) 우편번호 검색 팝업을 열어 우편번호와 기본 주소를 자동 입력합니다. */
	searchAddress = async (): Promise<boolean> => {
		try {
			const selected = await openDaumPostcode();
			if (!selected) return false;
			this.shipping = {
				...this.shipping,
				zonecode: selected.zonecode,
				address: selected.address
			};
			this.validationError = null;
			return true;
		} catch (err) {
			console.error('Failed to open Daum Postcode:', err);
			toast.error('주소 검색 서비스를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
			return false;
		}
	};

	/** 토스페이먼츠 결제 위젯을 지정된 DOM 셀렉터에 렌더링합니다. */
	mountTossWidget = async (
		paymentMethodsSelector: string,
		agreementSelector: string
	): Promise<void> => {
		if (this.items.length === 0 || this.totalPrice <= 0) return;

		if (!TOSS_CLIENT_KEY) {
			this.widgetReady = false;
			this.widgetError =
				'토스페이먼츠 클라이언트 키(VITE_TOSS_CLIENT_KEY)가 설정되지 않았습니다.';
			return;
		}

		this.widgetLoading = true;
		this.widgetError = null;

		try {
			await this.destroyTossWidget();
			const TossPayments = await loadTossPaymentsSdk();
			const toss = TossPayments(TOSS_CLIENT_KEY);
			const widgets = toss.widgets({ customerKey: TossPayments.ANONYMOUS });

			await widgets.setAmount({ currency: 'KRW', value: this.totalPrice });
			const [methodsHandle, agreementHandle] = await Promise.all([
				widgets.renderPaymentMethods({ selector: paymentMethodsSelector }),
				widgets.renderAgreement({ selector: agreementSelector })
			]);

			this.widgets = widgets;
			this.paymentMethodsHandle = methodsHandle;
			this.agreementHandle = agreementHandle;
			this.widgetReady = true;
		} catch (err) {
			console.error('Failed to mount Toss Payments widget:', err);
			this.widgetReady = false;
			this.widgetError = '결제 수단 위젯을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.';
		} finally {
			this.widgetLoading = false;
		}
	};

	destroyTossWidget = async (): Promise<void> => {
		closeDaumPostcode();
		this.widgetReady = false;
		try {
			await this.paymentMethodsHandle?.destroy?.();
		} catch {
			// 무시
		}
		try {
			await this.agreementHandle?.destroy?.();
		} catch {
			// 무시
		}
		this.paymentMethodsHandle = null;
		this.agreementHandle = null;
		this.widgets = null;
	};

	submitPayment = async (): Promise<void> => {
		if (this.submitting || this.items.length === 0) return;

		const validation = this.validateShipping();
		if (validation) {
			this.validationError = validation;
			toast.info(validation);
			return;
		}

		if (!this.widgets || !this.widgetReady) {
			toast.error('결제 수단 위젯이 아직 준비되지 않았습니다.');
			return;
		}

		this.submitting = true;
		this.validationError = null;

		const normalizedShipping = {
			recipientName: this.shipping.recipientName.trim(),
			phone: this.shipping.phone.trim(),
			zonecode: this.shipping.zonecode.trim(),
			address: this.shipping.address.trim(),
			...(this.shipping.addressDetail.trim()
				? { addressDetail: this.shipping.addressDetail.trim() }
				: {})
		};

		try {
			// 신규 배송지 저장 옵션이 켜져 있으면 비동기 저장 (실패해도 주문은 계속 진행)
			if (this.selectedAddressId === 'manual' && this.saveAsNewAddress) {
				try {
					await api('/api/members/me/addresses', {
						method: 'POST',
						body: JSON.stringify({
							...normalizedShipping,
							isDefault: this.addresses.length === 0
						})
					});
				} catch {
					// 주소록 한도 초과 등 무시
				}
			}

			// 1) 서버 주문 생성 (재고 차감 · pgOrderId 발급)
			const order = await api<OrderCreateResponse>('/api/catalog/orders', {
				method: 'POST',
				body: JSON.stringify({
					items: this.items.map((item) => ({
						optionId: item.optionId,
						qty: item.qty
					})),
					shipping: normalizedShipping
				})
			});

			if (!order?.pgOrderId || typeof order.amount !== 'number') {
				throw new Error('주문 생성 응답이 올바르지 않습니다.');
			}

			// 2) 결제 금액 동기화 및 세션 초안에 대기 주문 기록
			if (order.amount !== this.totalPrice) {
				await this.widgets.setAmount({ currency: 'KRW', value: order.amount });
			}

			saveCheckoutDraft({
				items: this.items,
				pendingOrder: {
					orderId: order.orderId,
					pgOrderId: order.pgOrderId,
					amount: order.amount,
					orderName: this.orderName,
					expiresAt: order.expiresAt ?? null
				}
			});

			// 3) 토스 결제창 호출
			const origin = typeof window !== 'undefined' ? window.location.origin : '';
			await this.widgets.requestPayment({
				orderId: order.pgOrderId,
				orderName: this.orderName,
				successUrl: `${origin}${PAYMENT_SUCCESS_ROUTE_PATH}`,
				failUrl: `${origin}${PAYMENT_FAIL_ROUTE_PATH}`,
				customerName: normalizedShipping.recipientName,
				customerMobilePhone: normalizedShipping.phone.replace(/\D/g, '')
			});
		} catch (err) {
			const code = (err as { code?: string })?.code;
			if (code === 'USER_CANCEL') {
				toast.info('결제가 취소되었습니다.');
			} else if (code === 'OUT_OF_STOCK') {
				toast.error('품절되었거나 재고가 부족한 상품이 있습니다. 장바구니를 확인해 주세요.');
			} else if (code === 'PAYMENT_UNAVAILABLE') {
				toast.error('현재 결제 서비스가 일시적으로 불안정합니다. 잠시 후 다시 시도해 주세요.');
			} else {
				console.error('Checkout submit failed:', err);
				toast.error('결제를 시작하지 못했습니다. 입력 정보와 결제 수단을 확인해 주세요.');
			}
		} finally {
			this.submitting = false;
		}
	};

	goBack = (): void => {
		if (typeof window !== 'undefined' && window.history.length > 1) {
			window.history.back();
			return;
		}
		void goto(CART_ROUTE_PATH, { reset: false });
	};

	goToCart = (): void => {
		void goto(CART_ROUTE_PATH, { reset: false });
	};

	private validateShipping(): string | null {
		const name = this.shipping.recipientName.trim();
		if (!name) return '수령인 이름을 입력해 주세요.';
		if (name.length > SHIPPING_RECIPIENT_MAX_LENGTH) {
			return `수령인 이름은 최대 ${SHIPPING_RECIPIENT_MAX_LENGTH}자까지 입력할 수 있습니다.`;
		}
		const phoneDigits = this.shipping.phone.replace(/\D/g, '');
		if (!phoneDigits) return '연락처를 입력해 주세요.';
		if (!/^0\d{8,10}$/.test(phoneDigits)) {
			return '올바른 연락처를 입력해 주세요. (0으로 시작하는 9~11자리 숫자)';
		}
		const zone = this.shipping.zonecode.trim();
		if (!/^\d{5}$/.test(zone)) return '우편번호 5자리를 입력해 주세요.';
		if (!this.shipping.address.trim()) return '기본 주소를 입력해 주세요.';
		return null;
	}

	private async fetchAddresses(token: number): Promise<void> {
		try {
			const res = await api<AddressListResponse>('/api/members/me/addresses');
			if (token !== this.loadToken) return;
			const list = Array.isArray(res?.items) ? res.items : [];
			this.addresses = list;

			const defaultAddr = list.find((a) => a.isDefault) ?? list[0];
			if (defaultAddr) {
				this.selectAddress(defaultAddr.id);
			} else {
				this.selectedAddressId = 'manual';
			}
		} catch {
			// 저장 배송지 조회 실패 시 직접 입력 모드로 폴백
			if (token === this.loadToken) {
				this.selectedAddressId = 'manual';
			}
		}
	}
}
