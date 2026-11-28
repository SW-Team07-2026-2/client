import { goto } from '$app/navigation';
import { api } from '#lib/auth/auth.svelte';
import { alertDialog } from '#lib/common/logic/alertDialog.svelte';
import { toast } from '#lib/common/logic/toast.svelte';

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED' | string;

export type EntryStatus =
	| 'NOT_OPEN'
	| 'AVAILABLE'
	| 'CHECKED_IN'
	| 'CLOSED'
	| 'UNAVAILABLE'
	| string;

export type TicketFilterKey = 'ALL' | 'CONFIRMED' | 'PENDING' | 'CANCELLED';

export interface BookingSummaryDto {
	bookingId: number;
	status: BookingStatus;
	totalPrice: number;
	createdAt: string;
	concertId: number;
	concertTitle: string;
	startsAt: string;
	sessionId?: number | null;
	entryStatus: EntryStatus;
	serverTime?: string | null;
	entryQrOpensAt?: string | null;
	entryQrClosesAt?: string | null;
	checkedInAt?: string | null;
}

export interface BookingSeatDto {
	id: number;
	floor?: string | number | null;
	section?: string | number | null;
	row?: string | number | null;
	number?: string | number | null;
	price: number;
}

export interface BookingConcertDto {
	id: number;
	title: string;
	startsAt: string;
	venueName?: string | null;
	sessionId?: number | null;
}

export interface BookingDetailDto {
	bookingId: number;
	status: BookingStatus;
	totalPrice: number;
	pgOrderId?: string | null;
	createdAt: string;
	expiresAt?: string | null;
	expiresIn?: number | null;
	entryStatus: EntryStatus;
	serverTime?: string | null;
	entryQrOpensAt?: string | null;
	entryQrClosesAt?: string | null;
	checkedInAt?: string | null;
	concert: BookingConcertDto;
	seats?: BookingSeatDto[] | null;
}

export interface EntryQrResponse {
	token: string;
	expiresAt: string;
}

export interface TicketFilterTab {
	key: TicketFilterKey;
	label: string;
	count: number;
}

interface BookingCursorResponse {
	items?: BookingSummaryDto[] | null;
	nextCursor?: string | null;
	hasNext?: boolean;
}

const PAGE_SIZE = 20;
const CANCEL_DEADLINE_MS = 24 * 60 * 60 * 1000;
const QR_REFRESH_409_CODES = new Set([
	'ENTRY_NOT_OPEN',
	'ENTRY_CLOSED',
	'ALREADY_CHECKED_IN',
	'ENTRY_NOT_AVAILABLE'
]);

const KST_DATE_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
	timeZone: 'Asia/Seoul',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	weekday: 'short'
});

const KST_TIME_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
	timeZone: 'Asia/Seoul',
	hour: '2-digit',
	minute: '2-digit',
	hour12: false
});

const KST_DATETIME_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
	timeZone: 'Asia/Seoul',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	hour12: false
});

export function formatTicketPrice(price: number): string {
	return `${Math.max(0, Math.round(price)).toLocaleString('ko-KR')}원`;
}

export function formatKstSessionDateTime(iso?: string | null): string {
	if (!iso) return '-';
	const ms = Date.parse(iso);
	if (Number.isNaN(ms)) return iso;
	const date = new Date(ms);
	return `${KST_DATE_FORMATTER.format(date)} ${KST_TIME_FORMATTER.format(date)}`;
}

export function formatKstDateTime(iso?: string | null): string {
	if (!iso) return '-';
	const ms = Date.parse(iso);
	if (Number.isNaN(ms)) return iso;
	return KST_DATETIME_FORMATTER.format(new Date(ms));
}

export function formatKstTime(iso?: string | null): string {
	if (!iso) return '-';
	const ms = Date.parse(iso);
	if (Number.isNaN(ms)) return iso;
	return KST_TIME_FORMATTER.format(new Date(ms));
}

export function formatCountdown(remainingMs: number): string {
	const safeSec = Math.max(0, Math.ceil(remainingMs / 1000));
	const days = Math.floor(safeSec / 86400);
	const hours = Math.floor((safeSec % 86400) / 3600);
	const mins = Math.floor((safeSec % 3600) / 60);
	const secs = safeSec % 60;

	const hh = String(hours).padStart(2, '0');
	const mm = String(mins).padStart(2, '0');
	const ss = String(secs).padStart(2, '0');

	if (days > 0) return `${days}일 ${hh}:${mm}:${ss}`;
	if (hours > 0) return `${hh}:${mm}:${ss}`;
	return `${mm}:${ss}`;
}

export function formatSeatLabel(seat: BookingSeatDto): string {
	const parts: string[] = [];
	const floor = String(seat.floor ?? '').trim();
	const section = String(seat.section ?? '').trim();
	const row = String(seat.row ?? '').trim();
	const num = String(seat.number ?? '').trim();
	if (floor) parts.push(floor);
	if (section) parts.push(`${section}구역`);
	if (row) parts.push(`${row}열`);
	if (num) parts.push(`${num}번`);
	return parts.length > 0 ? parts.join(' ') : `좌석 #${seat.id}`;
}

export function getBookingStatusMeta(status: BookingStatus): {
	label: string;
	tone: 'confirmed' | 'pending' | 'cancelled';
} {
	switch (status) {
		case 'CONFIRMED':
			return { label: '예매 확정', tone: 'confirmed' };
		case 'PENDING':
			return { label: '결제 대기', tone: 'pending' };
		case 'CANCELLED':
			return { label: '예매 취소', tone: 'cancelled' };
		case 'EXPIRED':
			return { label: '만료됨', tone: 'cancelled' };
		default:
			return { label: status || '상태 확인 중', tone: 'pending' };
	}
}

export function getEntryStatusBadge(
	entryStatus: EntryStatus,
	bookingStatus: BookingStatus
): { label: string; tone: 'available' | 'waiting' | 'checked' | 'closed' | 'muted' } | null {
	switch (entryStatus) {
		case 'AVAILABLE':
			return { label: 'QR 입장 가능', tone: 'available' };
		case 'NOT_OPEN':
			return { label: 'QR 공개 예정', tone: 'waiting' };
		case 'CHECKED_IN':
			return { label: '입장 완료 · 관람중', tone: 'checked' };
		case 'CLOSED':
			return { label: '입장 마감', tone: 'closed' };
		case 'UNAVAILABLE':
			if (bookingStatus === 'PENDING') return { label: '결제 전', tone: 'muted' };
			return null;
		default:
			return null;
	}
}

export function canCancelBooking(booking: BookingSummaryDto, serverNowMs: number): boolean {
	if (booking.status === 'PENDING') return true;
	if (booking.status !== 'CONFIRMED') return false;
	if (booking.entryStatus === 'CHECKED_IN' || booking.entryStatus === 'CLOSED') return false;
	const startsMs = Date.parse(booking.startsAt);
	if (Number.isNaN(startsMs)) return true;
	return startsMs - serverNowMs > CANCEL_DEADLINE_MS;
}

/**
 * 마이페이지 > 공연 예매 내역 컨트롤러 (v3 입장 QR · 검표 · 회차 명세 준수)
 * - GET /api/concerts/bookings (열 때 한 번만 커서 조회)
 * - GET /api/concerts/bookings/{id} (티켓 펼칠 때 상세 조회)
 * - GET /api/concerts/bookings/{id}/entry-qr (열린 티켓 1개만 동적 갱신, 메모리 전용)
 * - POST /api/concerts/bookings/{id}/cancel (예매 취소 · 환불)
 */
export class TicketPartController {
	bookings = $state<BookingSummaryDto[]>([]);
	detailsById = $state<Record<number, BookingDetailDto>>({});
	loadingDetailIds = $state<Record<number, boolean>>({});

	activeFilter = $state<TicketFilterKey>('ALL');
	expandedBookingId = $state<number | null>(null);

	isLoading = $state(false);
	isLoadingMore = $state(false);
	cancellingBookingId = $state<number | null>(null);
	errorMessage = $state<string | null>(null);
	nextCursor = $state<string | null>(null);
	hasNext = $state(false);

	// ── 서버 시각 보정 및 1초 카운트다운 시계 ──
	serverOffsetMs = $state(0);
	nowMs = $state(Date.now());

	// ── 현재 열린 티켓 1개의 입장 QR 상태 (메모리 전용, 스토리지 저장 금지) ──
	qrBookingId = $state<number | null>(null);
	qrToken = $state<string | null>(null);
	qrExpiresAt = $state<string | null>(null);
	qrIssuedAtMs = $state<number | null>(null);
	qrLoading = $state(false);
	qrError = $state<string | null>(null);

	private loaded = false;
	private active = false;
	private clockTimer: ReturnType<typeof setInterval> | null = null;
	private qrTimer: ReturnType<typeof setTimeout> | null = null;
	private qrRequestSeq = 0;
	private autoOpenedBookingId: number | null = null;
	private visibilityBound = false;

	get serverNowMs(): number {
		return this.nowMs + this.serverOffsetMs;
	}

	getServerNowMs(): number {
		return Date.now() + this.serverOffsetMs;
	}

	get filterTabs(): readonly TicketFilterTab[] {
		let confirmed = 0;
		let pending = 0;
		let cancelled = 0;
		for (const b of this.bookings) {
			if (b.status === 'CONFIRMED') confirmed++;
			else if (b.status === 'PENDING') pending++;
			else if (b.status === 'CANCELLED' || b.status === 'EXPIRED') cancelled++;
		}
		return [
			{ key: 'ALL', label: '전체', count: this.bookings.length },
			{ key: 'CONFIRMED', label: '예매 확정', count: confirmed },
			{ key: 'PENDING', label: '결제 대기', count: pending },
			{ key: 'CANCELLED', label: '취소 · 만료', count: cancelled }
		];
	}

	private syncServerClock(serverTime?: string | null): void {
		if (!serverTime) return;
		const parsed = Date.parse(serverTime);
		if (!Number.isNaN(parsed)) {
			this.serverOffsetMs = parsed - Date.now();
		}
	}

	private clearQrTimer(): void {
		if (this.qrTimer !== null) {
			clearTimeout(this.qrTimer);
			this.qrTimer = null;
		}
	}

	private resetQrState(): void {
		this.clearQrTimer();
		this.qrRequestSeq++;
		this.qrBookingId = null;
		this.qrToken = null;
		this.qrExpiresAt = null;
		this.qrIssuedAtMs = null;
		this.qrLoading = false;
		this.qrError = null;
	}

	private startClock(): void {
		if (this.clockTimer !== null) return;
		this.nowMs = Date.now();
		this.clockTimer = setInterval(() => {
			this.nowMs = Date.now();
			this.checkNotOpenCountdownReached();
		}, 1000);
	}

	private stopClock(): void {
		if (this.clockTimer !== null) {
			clearInterval(this.clockTimer);
			this.clockTimer = null;
		}
	}

	/** NOT_OPEN 카운트다운이 0에 도달하면 entry-qr을 즉시 요청 */
	private checkNotOpenCountdownReached(): void {
		const openId = this.expandedBookingId;
		if (openId === null || this.autoOpenedBookingId === openId) return;

		const detail = this.detailsById[openId];
		if (!detail || detail.entryStatus !== 'NOT_OPEN' || !detail.entryQrOpensAt) return;

		const opensAtMs = Date.parse(detail.entryQrOpensAt);
		if (!Number.isNaN(opensAtMs) && this.getServerNowMs() >= opensAtMs) {
			this.autoOpenedBookingId = openId;
			void this.fetchEntryQr(openId);
		}
	}

	private handleVisibilityChange = (): void => {
		if (typeof document === 'undefined' || !this.active) return;

		if (document.visibilityState === 'hidden') {
			// 백그라운드 전환 시 갱신 중지
			this.clearQrTimer();
			this.stopClock();
		} else if (document.visibilityState === 'visible') {
			// 복귀 시 시계 재개 + 열린 티켓이 있으면 상세 조회부터 다시
			this.startClock();
			if (this.expandedBookingId !== null) {
				void this.fetchDetail(this.expandedBookingId);
			}
		}
	};

	/** 공연 예매 내역 화면 활성화 (타이머 · visibilitychange 리스너 등록) */
	activate = (): void => {
		if (this.active) return;
		this.active = true;
		this.startClock();

		if (typeof document !== 'undefined' && !this.visibilityBound) {
			document.addEventListener('visibilitychange', this.handleVisibilityChange);
			this.visibilityBound = true;
		}

		// 다른 파트에서 돌아왔을 때 열린 티켓이 있으면 상세 조회부터 재개
		if (this.expandedBookingId !== null) {
			void this.fetchDetail(this.expandedBookingId);
		}
	};

	/** 다른 파트나 화면으로 이동 시 QR 갱신 · 타이머 즉시 중단 */
	deactivate = (): void => {
		if (!this.active) return;
		this.active = false;
		this.stopClock();
		this.resetQrState();

		if (typeof document !== 'undefined' && this.visibilityBound) {
			document.removeEventListener('visibilitychange', this.handleVisibilityChange);
			this.visibilityBound = false;
		}
	};

	setFilter = (filter: TicketFilterKey): void => {
		this.activeFilter = filter;
	};

	/** 목록 조회 (열 때 한 번만) */
	load = async (force = false): Promise<void> => {
		if (this.isLoading) return;
		if (this.loaded && !force) return;

		this.isLoading = true;
		this.errorMessage = null;
		try {
			const qs = new URLSearchParams({ size: String(PAGE_SIZE) });
			const res = await api<BookingCursorResponse>(`/api/concerts/bookings?${qs.toString()}`);
			const items = Array.isArray(res?.items) ? res.items : [];
			const firstServerTime = items.find((b) => b.serverTime)?.serverTime;
			this.syncServerClock(firstServerTime);

			this.bookings = items;
			this.nextCursor = res?.nextCursor ?? null;
			this.hasNext = Boolean(res?.hasNext && this.nextCursor);
			this.loaded = true;
		} catch (err) {
			console.error('Failed to load concert bookings:', err);
			this.errorMessage = '공연 예매 내역을 불러오지 못했습니다.';
		} finally {
			this.isLoading = false;
		}
	};

	/** 커서 기반 추가 불러오기 */
	loadMore = async (): Promise<void> => {
		if (this.isLoading || this.isLoadingMore || !this.hasNext || !this.nextCursor) return;

		this.isLoadingMore = true;
		try {
			const qs = new URLSearchParams({
				cursor: this.nextCursor,
				size: String(PAGE_SIZE)
			});
			const res = await api<BookingCursorResponse>(`/api/concerts/bookings?${qs.toString()}`);
			const nextItems = Array.isArray(res?.items) ? res.items : [];
			const firstServerTime = nextItems.find((b) => b.serverTime)?.serverTime;
			this.syncServerClock(firstServerTime);

			const seen = new Set(this.bookings.map((b) => b.bookingId));
			const appended = nextItems.filter((b) => !seen.has(b.bookingId));

			this.bookings = [...this.bookings, ...appended];
			this.nextCursor = res?.nextCursor ?? null;
			this.hasNext = Boolean(res?.hasNext && this.nextCursor);
		} catch (err) {
			console.error('Failed to load more concert bookings:', err);
			toast.error('추가 예매 내역을 불러오지 못했습니다.');
		} finally {
			this.isLoadingMore = false;
		}
	};

	private syncSummaryFromDetail(detail: BookingDetailDto): void {
		this.bookings = this.bookings.map((b) =>
			b.bookingId === detail.bookingId
				? {
						...b,
						status: detail.status,
						entryStatus: detail.entryStatus,
						serverTime: detail.serverTime ?? b.serverTime,
						entryQrOpensAt: detail.entryQrOpensAt ?? b.entryQrOpensAt,
						entryQrClosesAt: detail.entryQrClosesAt ?? b.entryQrClosesAt,
						checkedInAt: detail.checkedInAt ?? b.checkedInAt,
						startsAt: detail.concert?.startsAt ?? b.startsAt,
						sessionId: detail.concert?.sessionId ?? b.sessionId
					}
				: b
		);
	}

	/** 티켓 상세 조회 + entryStatus에 따른 QR 흐름 시작 */
	fetchDetail = async (bookingId: number): Promise<void> => {
		this.loadingDetailIds = { ...this.loadingDetailIds, [bookingId]: true };
		try {
			const detail = await api<BookingDetailDto>(`/api/concerts/bookings/${bookingId}`);
			if (!detail) return;

			this.syncServerClock(detail.serverTime);
			this.detailsById = { ...this.detailsById, [bookingId]: detail };
			this.syncSummaryFromDetail(detail);

			// 상세 응답이 돌아왔을 때 여전히 이 티켓이 열려 있고 활성 상태인 경우에만 QR 제어
			if (!this.active || this.expandedBookingId !== bookingId) return;

			if (detail.entryStatus === 'AVAILABLE') {
				void this.fetchEntryQr(bookingId);
			} else if (detail.entryStatus === 'NOT_OPEN') {
				this.resetQrState();
				this.autoOpenedBookingId = null;
				this.checkNotOpenCountdownReached();
			} else {
				this.resetQrState();
			}
		} catch (err) {
			console.error(`Failed to load booking detail #${bookingId}:`, err);
			toast.error('예매 상세 정보를 불러오지 못했습니다.');
		} finally {
			const next = { ...this.loadingDetailIds };
			delete next[bookingId];
			this.loadingDetailIds = next;
		}
	};

	/** 입장 QR 발급 및 동적 주기 갱신: min(expiresAt - 10초, 지금 + 20초) */
	fetchEntryQr = async (bookingId: number): Promise<void> => {
		if (!this.active || this.expandedBookingId !== bookingId) return;

		this.clearQrTimer();
		const seq = ++this.qrRequestSeq;
		const isSameBooking = this.qrBookingId === bookingId;
		this.qrBookingId = bookingId;
		this.qrLoading = !isSameBooking || !this.qrToken;

		try {
			const res = await api<EntryQrResponse>(`/api/concerts/bookings/${bookingId}/entry-qr`);
			if (seq !== this.qrRequestSeq || !this.active || this.expandedBookingId !== bookingId) {
				return;
			}

			if (!res?.token || !res?.expiresAt) {
				throw new Error('입장 QR 응답이 올바르지 않습니다.');
			}

			const nowMs = this.getServerNowMs();
			this.qrToken = res.token;
			this.qrExpiresAt = res.expiresAt;
			this.qrIssuedAtMs = nowMs;
			this.qrError = null;
			this.qrLoading = false;

			// NOT_OPEN 카운트다운 직후 성공했다면 상세도 AVAILABLE로 동기화
			const existing = this.detailsById[bookingId];
			if (existing && existing.entryStatus === 'NOT_OPEN') {
				const promoted: BookingDetailDto = { ...existing, entryStatus: 'AVAILABLE' };
				this.detailsById = { ...this.detailsById, [bookingId]: promoted };
				this.syncSummaryFromDetail(promoted);
			}

			const expMs = Date.parse(res.expiresAt);
			const nextTargetMs = Number.isNaN(expMs)
				? nowMs + 20_000
				: Math.min(expMs - 10_000, nowMs + 20_000);
			const delayMs = Math.max(2_000, nextTargetMs - nowMs);

			this.qrTimer = setTimeout(() => {
				void this.fetchEntryQr(bookingId);
			}, delayMs);
		} catch (err) {
			if (seq !== this.qrRequestSeq || !this.active || this.expandedBookingId !== bookingId) {
				return;
			}
			this.qrLoading = false;

			const status = (err as { status?: number })?.status;
			const code = (err as { code?: string })?.code;

			// 409 상태 변경 응답이면 QR 갱신 즉시 중단 + 상세 재조회
			if (status === 409 || (code && QR_REFRESH_409_CODES.has(code))) {
				this.resetQrState();
				void this.fetchDetail(bookingId);
				return;
			}

			if (status === 404 || code === 'NOT_FOUND') {
				this.resetQrState();
				this.qrBookingId = bookingId;
				this.qrError = '예매 정보를 찾을 수 없습니다.';
				return;
			}

			// 네트워크 오류 / 5xx: 기존 QR은 expiresAt까지 유지하고 백그라운드로 재시도 지속
			this.qrError = '입장 QR을 갱신하지 못했습니다. 네트워크를 확인해 주세요.';
			this.qrTimer = setTimeout(() => {
				void this.fetchEntryQr(bookingId);
			}, 5_000);
		}
	};

	retryEntryQr = (bookingId: number): void => {
		if (this.expandedBookingId !== bookingId) return;
		this.qrError = null;
		void this.fetchEntryQr(bookingId);
	};

	toggleExpand = (bookingId: number): void => {
		if (this.expandedBookingId === bookingId) {
			this.expandedBookingId = null;
			this.autoOpenedBookingId = null;
			this.resetQrState();
			return;
		}

		// 기존 열린 티켓의 QR 갱신 중단 후 새 티켓 상세 조회
		this.resetQrState();
		this.autoOpenedBookingId = null;
		this.expandedBookingId = bookingId;
		void this.fetchDetail(bookingId);
	};

	confirmCancel = (booking: BookingSummaryDto): void => {
		if (this.cancellingBookingId !== null) return;
		if (!canCancelBooking(booking, this.getServerNowMs())) {
			toast.error('취소 가능 기한이 지났거나 취소할 수 없는 예매입니다.');
			return;
		}

		const isConfirmed = booking.status === 'CONFIRMED';

		void alertDialog.danger({
			title: isConfirmed ? '예매를 취소하고 환불할까요?' : '좌석 선점을 취소할까요?',
			description: isConfirmed
				? `${booking.concertTitle} (${formatKstSessionDateTime(booking.startsAt)})\n결제 금액 ${formatTicketPrice(booking.totalPrice)}이 환불 처리되며 취소 후에는 되돌릴 수 없습니다.`
				: `${booking.concertTitle}\n결제 대기 중인 예매가 취소되며 선점된 좌석이 해제됩니다.`,
			confirmText: isConfirmed ? '취소 · 환불' : '예매 취소',
			cancelText: '유지하기',
			closeOnOverlay: true,
			onConfirm: async () => {
				this.cancellingBookingId = booking.bookingId;
				try {
					const updated = await api<BookingDetailDto>(
						`/api/concerts/bookings/${booking.bookingId}/cancel`,
						{ method: 'POST' }
					);

					if (this.expandedBookingId === booking.bookingId) {
						this.resetQrState();
					}

					if (updated) {
						this.syncServerClock(updated.serverTime);
						this.detailsById = { ...this.detailsById, [booking.bookingId]: updated };
						this.syncSummaryFromDetail(updated);
					} else {
						this.bookings = this.bookings.map((b) =>
							b.bookingId === booking.bookingId
								? { ...b, status: 'CANCELLED', entryStatus: 'UNAVAILABLE' }
								: b
						);
					}

					toast.success(
						isConfirmed
							? '예매 취소 및 환불이 완료되었습니다.'
							: '예매가 취소되었습니다.'
					);
				} catch (err) {
					console.error(`Failed to cancel booking #${booking.bookingId}:`, err);
					const status = (err as { status?: number })?.status;
					const code = (err as { code?: string })?.code;

					// v2 명세 §5: 503 PG_UNAVAILABLE / PG_PROCESSING은 실패가 아니라 환불 처리 중 안내 + 상세 재조회
					if (status === 503 || code === 'PG_UNAVAILABLE' || code === 'PG_PROCESSING') {
						toast.info('환불 처리 중입니다. 잠시 후 상태가 자동으로 반영됩니다.');
						void this.fetchDetail(booking.bookingId);
						return;
					}

					const msg =
						code === 'BOOKING_NOT_CANCELLABLE'
							? '회차 시작 24시간 전이 지나 취소할 수 없는 예매입니다.'
							: code === 'PG_CANCEL_REJECTED'
								? '결제사에서 환불이 거절되었습니다. 고객센터로 문의해 주세요.'
								: err instanceof Error && err.message
									? err.message
									: '예매 취소에 실패했습니다.';
					toast.error(msg);
					throw err;
				} finally {
					this.cancellingBookingId = null;
				}
			}
		});
	};

	openConcert = (concertId: number): void => {
		void goto(`/concert/${concertId}`, { reset: false });
	};

	browseConcerts = (): void => {
		void goto('/concert', { reset: false });
	};
}
