import { api, auth } from '#lib/auth/auth.svelte';
import { alertDialog } from '#lib/common/logic/alertDialog.svelte';
import { toast } from '#lib/common/logic/toast.svelte';
import {
	SHIPPING_ADDRESS_DETAIL_MAX_LENGTH,
	SHIPPING_ADDRESS_MAX_COUNT,
	SHIPPING_LABEL_MAX_LENGTH,
	SHIPPING_RECIPIENT_MAX_LENGTH
} from '#lib/config/pay';
import { formatKoreanPhone } from '#lib/dedicated/pay/logic/checkoutPage.svelte';
import { openDaumPostcode } from '#lib/dedicated/pay/logic/daumPostcode';
import type { ShippingAddress, ShippingFormInput } from '#lib/dedicated/pay/logic/types';

interface AddressListResponse {
	items?: ShippingAddress[] | null;
}

const ORDER_STORAGE_PREFIX = 'indig_mypage_address_order_v1:';

function emptyShipping(): ShippingFormInput {
	return {
		recipientName: '',
		phone: '',
		zonecode: '',
		address: '',
		addressDetail: ''
	};
}

function getOrderStorageKey(): string {
	return `${ORDER_STORAGE_PREFIX}${auth.user?.userId ?? 'guest'}`;
}

function readStoredOrder(): number[] {
	if (typeof window === 'undefined') return [];
	try {
		const raw = localStorage.getItem(getOrderStorageKey());
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed)
			? parsed.filter((id): id is number => typeof id === 'number' && Number.isFinite(id))
			: [];
	} catch {
		return [];
	}
}

function saveStoredOrder(ids: number[]): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(getOrderStorageKey(), JSON.stringify(ids));
	} catch {
		// ignore storage quota errors
	}
}

function sortAddressesWithOrder(items: ShippingAddress[]): ShippingAddress[] {
	const stored = readStoredOrder();
	const rank = new Map<number, number>();
	stored.forEach((id, idx) => rank.set(id, idx));

	return [...items].sort((a, b) => {
		if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
		const ra = rank.get(a.id);
		const rb = rank.get(b.id);
		if (ra !== undefined && rb !== undefined) return ra - rb;
		if (ra !== undefined) return -1;
		if (rb !== undefined) return 1;
		return 0;
	});
}

/**
 * 마이페이지 > 배송지 관리 컨트롤러
 * - GET /api/members/me/addresses (목록 조회, 최대 10개)
 * - POST /api/members/me/addresses (신규 추가)
 * - PUT /api/members/me/addresses/{id} (수정)
 * - POST /api/members/me/addresses/{id}/default (기본 배송지 지정)
 * - DELETE /api/members/me/addresses/{id} (삭제, 공용 alertDialog 확인)
 * - 드래그/버튼 순서 변경 (최상단 이동 시 기본 배송지 자동 동기화 + 로컬 순서 보존)
 */
export class AddressPartController {
	addresses = $state<ShippingAddress[]>([]);
	isLoading = $state(false);
	errorMessage = $state<string | null>(null);

	editingId = $state<number | null>(null);
	label = $state('');
	shipping = $state<ShippingFormInput>(emptyShipping());
	setAsDefault = $state(false);
	validationError = $state<string | null>(null);
	isSaving = $state(false);
	deletingId = $state<number | null>(null);
	reordering = $state(false);

	private loaded = false;
	private serverDefaultId: number | null = null;

	get isEditing(): boolean {
		return this.editingId !== null;
	}

	get isLimitReached(): boolean {
		return !this.isEditing && this.addresses.length >= SHIPPING_ADDRESS_MAX_COUNT;
	}

	load = async (force = false): Promise<void> => {
		if (this.isLoading) return;
		if (this.loaded && !force) return;

		this.isLoading = true;
		this.errorMessage = null;
		try {
			const res = await api<AddressListResponse>('/api/members/me/addresses');
			const items = Array.isArray(res?.items) ? res.items : [];
			this.addresses = sortAddressesWithOrder(items);
			this.serverDefaultId = this.addresses.find((a) => a.isDefault)?.id ?? null;
			saveStoredOrder(this.addresses.map((a) => a.id));
			this.loaded = true;
		} catch (err) {
			console.error('Failed to load shipping addresses:', err);
			this.errorMessage = '배송지 목록을 불러오지 못했습니다.';
		} finally {
			this.isLoading = false;
		}
	};

	updateLabel = (value: string): void => {
		this.label = value.slice(0, SHIPPING_LABEL_MAX_LENGTH);
		this.validationError = null;
	};

	updateField = (field: keyof ShippingFormInput, value: string): void => {
		let next = value;
		if (field === 'phone') {
			next = formatKoreanPhone(value);
		} else if (field === 'recipientName') {
			next = value.slice(0, SHIPPING_RECIPIENT_MAX_LENGTH);
		} else if (field === 'addressDetail') {
			next = value.slice(0, SHIPPING_ADDRESS_DETAIL_MAX_LENGTH);
		}
		this.shipping = { ...this.shipping, [field]: next };
		this.validationError = null;
	};

	searchAddress = async (): Promise<boolean> => {
		try {
			const result = await openDaumPostcode();
			if (!result) return false;
			this.shipping = {
				...this.shipping,
				zonecode: result.zonecode,
				address: result.address
			};
			this.validationError = null;
			return true;
		} catch (err) {
			console.error('Daum Postcode error:', err);
			toast.error('주소 검색창을 열지 못했습니다. 잠시 후 다시 시도해 주세요.');
			return false;
		}
	};

	toggleSetAsDefault = (checked: boolean): void => {
		this.setAsDefault = checked;
	};

	startEdit = (addr: ShippingAddress): void => {
		this.editingId = addr.id;
		this.label = addr.label?.trim() ?? '';
		this.shipping = {
			recipientName: addr.recipientName ?? '',
			phone: formatKoreanPhone(addr.phone ?? ''),
			zonecode: addr.zonecode ?? '',
			address: addr.address ?? '',
			addressDetail: addr.addressDetail?.trim() ?? ''
		};
		this.setAsDefault = Boolean(addr.isDefault);
		this.validationError = null;
	};

	cancelEdit = (): void => {
		this.editingId = null;
		this.label = '';
		this.shipping = emptyShipping();
		this.setAsDefault = false;
		this.validationError = null;
	};

	private validateForm(): string | null {
		const name = this.shipping.recipientName.trim();
		const phone = this.shipping.phone.trim();
		const zone = this.shipping.zonecode.trim();
		const addr = this.shipping.address.trim();

		if (!name) return '수령인 이름을 입력해 주세요.';
		if (!/^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(phone)) {
			return '올바른 연락처 형식을 입력해 주세요. (예: 010-1234-5678)';
		}
		if (!/^\d{5}$/.test(zone) || !addr) {
			return '주소 검색을 통해 배송지를 선택해 주세요.';
		}
		return null;
	}

	submitForm = async (): Promise<void> => {
		if (this.isSaving) return;

		if (this.isLimitReached) {
			const msg = `배송지는 최대 ${SHIPPING_ADDRESS_MAX_COUNT}개까지 등록할 수 있습니다.`;
			this.validationError = msg;
			toast.error(msg);
			return;
		}

		const errMsg = this.validateForm();
		if (errMsg) {
			this.validationError = errMsg;
			return;
		}

		this.isSaving = true;
		this.validationError = null;

		const payload = {
			label: this.label.trim() || undefined,
			recipientName: this.shipping.recipientName.trim(),
			phone: this.shipping.phone.trim(),
			zonecode: this.shipping.zonecode.trim(),
			address: this.shipping.address.trim(),
			addressDetail: this.shipping.addressDetail.trim() || undefined,
			isDefault: this.setAsDefault || undefined
		};

		try {
			if (this.editingId !== null) {
				const targetId = this.editingId;
				const updated = await api<ShippingAddress>(`/api/members/me/addresses/${targetId}`, {
					method: 'PUT',
					body: JSON.stringify(payload)
				});
				if (updated) {
					const list = this.addresses.map((a) => {
						if (a.id === updated.id) return updated;
						if (updated.isDefault) return { ...a, isDefault: false };
						return a;
					});
					this.addresses = sortAddressesWithOrder(list);
					this.serverDefaultId = this.addresses.find((a) => a.isDefault)?.id ?? null;
					saveStoredOrder(this.addresses.map((a) => a.id));
				} else {
					await this.load(true);
				}
				this.cancelEdit();
				toast.success('배송지가 수정되었습니다.');
			} else {
				const created = await api<ShippingAddress>('/api/members/me/addresses', {
					method: 'POST',
					body: JSON.stringify(payload)
				});
				if (created) {
					const base = created.isDefault
						? this.addresses.map((a) => ({ ...a, isDefault: false }))
						: [...this.addresses];
					const list = created.isDefault ? [created, ...base] : [...base, created];
					this.addresses = sortAddressesWithOrder(list);
					this.serverDefaultId = this.addresses.find((a) => a.isDefault)?.id ?? null;
					saveStoredOrder(this.addresses.map((a) => a.id));
				} else {
					await this.load(true);
				}
				this.cancelEdit();
				toast.success('새 배송지가 저장되었습니다.');
			}
		} catch (err) {
			console.error('Failed to save shipping address:', err);
			const code = (err as { code?: string })?.code;
			const msg =
				code === 'ADDRESS_LIMIT_EXCEEDED'
					? `배송지는 최대 ${SHIPPING_ADDRESS_MAX_COUNT}개까지 등록할 수 있습니다.`
					: err instanceof Error && err.message
						? err.message
						: '배송지 저장에 실패했습니다.';
			this.validationError = msg;
			toast.error(msg);
		} finally {
			this.isSaving = false;
		}
	};

	confirmDelete = (addr: ShippingAddress): void => {
		if (this.deletingId !== null) return;
		const titleLabel = addr.label?.trim()
			? `${addr.label.trim()} (${addr.recipientName})`
			: addr.recipientName;

		void alertDialog.danger({
			title: '배송지를 삭제할까요?',
			description: `${titleLabel}\n[${addr.zonecode}] ${addr.address}`,
			confirmText: '삭제',
			cancelText: '취소',
			closeOnOverlay: true,
			onConfirm: async () => {
				this.deletingId = addr.id;
				try {
					await api<void>(`/api/members/me/addresses/${addr.id}`, {
						method: 'DELETE'
					});
					if (this.editingId === addr.id) {
						this.cancelEdit();
					}
					// 기본 배송지 삭제 시 서버가 다른 배송지를 기본으로 승격하므로 목록 재조회
					await this.load(true);
					toast.success('배송지가 삭제되었습니다.');
				} catch (err) {
					console.error('Failed to delete shipping address:', err);
					toast.error('배송지 삭제에 실패했습니다.');
					throw err;
				} finally {
					this.deletingId = null;
				}
			}
		});
	};

	/** 드래그 또는 클릭으로 배송지 위치 변경 (commit=false 시 드래그 중 즉시 스왑만 수행, commit=true 시 순서 저장 + 기본 배송지 동기화) */
	reorder = async (fromIndex: number, toIndex: number, commit = true): Promise<void> => {
		if (
			fromIndex !== toIndex &&
			fromIndex >= 0 &&
			toIndex >= 0 &&
			fromIndex < this.addresses.length &&
			toIndex < this.addresses.length
		) {
			const next = [...this.addresses];
			const [moved] = next.splice(fromIndex, 1);
			next.splice(toIndex, 0, moved);

			const topItem = next[0];
			const shouldMarkTopDefault = Boolean(topItem && !topItem.isDefault);

			this.addresses = shouldMarkTopDefault
				? next.map((a, idx) => ({ ...a, isDefault: idx === 0 }))
				: next;
		}

		if (!commit) return;

		saveStoredOrder(this.addresses.map((a) => a.id));

		const topItem = this.addresses[0];
		if (topItem && topItem.id !== this.serverDefaultId && !this.reordering) {
			this.reordering = true;
			try {
				await api<ShippingAddress>(`/api/members/me/addresses/${topItem.id}/default`, {
					method: 'POST'
				});
				this.serverDefaultId = topItem.id;
			} catch (err) {
				console.error('Failed to promote default address on reorder:', err);
				await this.load(true);
				toast.error('기본 배송지 변경에 실패했습니다.');
			} finally {
				this.reordering = false;
			}
		}
	};

	/** 클릭으로 간단히 한 칸 위로 이동 (맨 위 항목이면 한 칸 아래로 이동) */
	nudgePosition = (index: number): void => {
		if (this.addresses.length < 2) return;
		const targetIndex = index > 0 ? index - 1 : 1;
		void this.reorder(index, targetIndex);
	};
}
