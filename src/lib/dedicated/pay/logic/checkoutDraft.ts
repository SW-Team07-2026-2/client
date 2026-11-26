import { PAY_CHECKOUT_DRAFT_STORAGE_KEY } from '#lib/config/pay';
import type { CheckoutDraft } from './types';

/** 체크아웃 임시 데이터(선택 상품 · 생성된 주문 정보)를 sessionStorage에 저장/복원합니다. */
export function saveCheckoutDraft(draft: CheckoutDraft): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.setItem(PAY_CHECKOUT_DRAFT_STORAGE_KEY, JSON.stringify(draft));
	} catch {
		// 스토리지 용량 제한 등 무시
	}
}

export function loadCheckoutDraft(): CheckoutDraft | null {
	if (typeof sessionStorage === 'undefined') return null;
	try {
		const raw = sessionStorage.getItem(PAY_CHECKOUT_DRAFT_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as CheckoutDraft;
		if (!parsed || !Array.isArray(parsed.items)) return null;
		return parsed;
	} catch {
		return null;
	}
}

export function clearCheckoutDraft(): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.removeItem(PAY_CHECKOUT_DRAFT_STORAGE_KEY);
	} catch {
		// 무시
	}
}
