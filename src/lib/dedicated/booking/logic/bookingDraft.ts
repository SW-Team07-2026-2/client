import type { BookingPaymentDraft } from './types';

const BOOKING_PAYMENT_DRAFT_KEY = 'indig_ticket_booking_payment_draft_v1';

export function saveBookingPaymentDraft(draft: BookingPaymentDraft): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.setItem(BOOKING_PAYMENT_DRAFT_KEY, JSON.stringify(draft));
	} catch {
		// ignore quota errors
	}
}

export function loadBookingPaymentDraft(): BookingPaymentDraft | null {
	if (typeof sessionStorage === 'undefined') return null;
	try {
		const raw = sessionStorage.getItem(BOOKING_PAYMENT_DRAFT_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as BookingPaymentDraft | null;
		if (!parsed || typeof parsed.bookingId !== 'number') return null;
		return parsed;
	} catch {
		return null;
	}
}

export function clearBookingPaymentDraft(): void {
	if (typeof sessionStorage === 'undefined') return;
	try {
		sessionStorage.removeItem(BOOKING_PAYMENT_DRAFT_KEY);
	} catch {
		// ignore
	}
}
