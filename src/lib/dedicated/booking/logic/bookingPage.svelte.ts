import { goto } from '$app/navigation';
import { api, auth } from '#lib/auth/auth.svelte';
import { alertDialog } from '#lib/common/logic/alertDialog.svelte';
import { toast } from '#lib/common/logic/toast.svelte';
import { TOSS_CLIENT_KEY } from '#lib/config/pay';
import { PAYMENT_FAIL_ROUTE_PATH, PAYMENT_SUCCESS_ROUTE_PATH } from '#lib/config/routes';
import { loadTossPaymentsSdk, type TossPaymentWidgets } from '#lib/dedicated/pay/logic/tossSdk';
import { saveBookingPaymentDraft } from './bookingDraft';
import type {
	BookingConcertMeta,
	BookingCreatedDto,
	BookingFlowPhase,
	ConcertBookingSession,
	QueueStatusDto,
	SeatMapDto,
	SelectedSeatItem
} from './types';

interface RawConcertDetailDto {
	id: number;
	title?: string | null;
	startsAt?: string | null;
	saleStatus?: string | null;
	queueEnabled?: boolean | null;
	maxSeatsPerUser?: number | null;
	posterUrl?: string | null;
	venue?: { name?: string | null } | null;
	sessions?: Array<{
		id: number;
		startsAt?: string | null;
		saleStatus?: string | null;
	}> | null;
}

const KST_SESSION_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
	timeZone: 'Asia/Seoul',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	weekday: 'short',
	hour: '2-digit',
	minute: '2-digit',
	hour12: false
});

export function formatBookingSessionDate(iso?: string | null): string {
	if (!iso) return '-';
	const ms = Date.parse(iso);
	if (Number.isNaN(ms)) return iso;
	return KST_SESSION_FORMATTER.format(new Date(ms));
}

export function formatBookingPrice(price: number): string {
	return `${Math.max(0, Math.round(price)).toLocaleString('ko-KR')}원`;
}

export function formatTimerSeconds(sec: number): string {
	const safe = Math.max(0, Math.floor(sec));
	const m = Math.floor(safe / 60);
	const s = safe % 60;
	return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatSelectedSeatLabel(seat: SelectedSeatItem): string {
	const parts: string[] = [];
	const floor = String(seat.floorName ?? '').trim();
	const section = String(seat.sectionName ?? '').trim();
	const row = String(seat.row ?? '').trim();
	const num = String(seat.number ?? '').trim();
	if (floor) parts.push(floor);
	if (section) parts.push(`${section}구역`);
	if (row) parts.push(`${row}열`);
	if (num) parts.push(`${num}번`);
	return parts.join(' ');
}

/**
 * 콘서트 예매 전용 컨트롤러 (대기열 → 좌석 선택 → 토스 결제)
 * - 대기열: POST /api/concerts/{id}/queue -> pollAfterMs 주기 폴링 -> 이탈 시 DELETE
 * - 좌석: GET /api/concerts/{id}/seats?sessionId= (+ X-Entry-Token)
 * - 예매 생성: POST /api/concerts/{id}/bookings ({ seatIds }) -> PENDING 선점
 * - 결제: 토스 위젯 -> /payments/success?flow=ticket&bookingId={id}
 */
export class BookingPageController {
	phase = $state<BookingFlowPhase>('loading');
	errorMessage = $state<string | null>(null);

	concert = $state<BookingConcertMeta | null>(null);
	selectedSessionId = $state<number | null>(null);

	// ── 대기열 상태 ──
	queueStatus = $state<QueueStatusDto | null>(null);
	entryToken = $state<string | null>(null);

	// ── 좌석 맵 상태 ──
	seatMap = $state<SeatMapDto | null>(null);
	isLoadingSeats = $state(false);
	activeFloorId = $state<string>('');
	selectedSeats = $state<SelectedSeatItem[]>([]);
	isCreatingBooking = $state(false);

	// ── 결제(선점) 상태 ──
	pendingBooking = $state<BookingCreatedDto | null>(null);
	remainingSec = $state<number | null>(null);
	isCancellingHold = $state(false);

	// ── 토스 위젯 상태 ──
	isMountingWidget = $state(false);
	isWidgetReady = $state(false);
	widgetError = $state<string | null>(null);
	isRequestingPayment = $state(false);

	private concertId: number | null = null;
	private pollTimer: ReturnType<typeof setTimeout> | null = null;
	private countdownTimer: ReturnType<typeof setInterval> | null = null;
	private widgets: TossPaymentWidgets | null = null;
	private paymentMethodsHandle: { destroy?: () => Promise<void> } | null = null;
	private agreementHandle: { destroy?: () => Promise<void> } | null = null;
	private destroyed = false;

	get selectedSession(): ConcertBookingSession | null {
		if (!this.concert) return null;
		if (this.selectedSessionId !== null) {
			return this.concert.sessions.find((s) => s.id === this.selectedSessionId) ?? null;
		}
		return this.concert.sessions[0] ?? null;
	}

	get maxSeats(): number {
		return this.seatMap?.maxSeatsPerUser ?? this.concert?.maxSeatsPerUser ?? 4;
	}

	get totalPrice(): number {
		if (this.pendingBooking) return this.pendingBooking.amount;
		return this.selectedSeats.reduce((sum, s) => sum + s.price, 0);
	}

	get selectedSeatIds(): ReadonlySet<number> {
		return new Set(this.selectedSeats.map((s) => s.id));
	}

	private clearPollTimer(): void {
		if (this.pollTimer !== null) {
			clearTimeout(this.pollTimer);
			this.pollTimer = null;
		}
	}

	private clearCountdownTimer(): void {
		if (this.countdownTimer !== null) {
			clearInterval(this.countdownTimer);
			this.countdownTimer = null;
		}
	}

	private startCountdown(seconds?: number | null): void {
		this.clearCountdownTimer();
		if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
			this.remainingSec = null;
			return;
		}
		this.remainingSec = Math.floor(seconds);
		this.countdownTimer = setInterval(() => {
			if (this.remainingSec === null) return;
			if (this.remainingSec <= 1) {
				this.remainingSec = 0;
				this.clearCountdownTimer();
				if (this.phase === 'payment') {
					toast.error('좌석 선점 시간이 만료되었습니다. 좌석을 다시 선택해 주세요.');
					void this.returnToSeats(false);
				}
				return;
			}
			this.remainingSec -= 1;
		}, 1000);
	}

	private getEntryHeaders(): HeadersInit | undefined {
		return this.entryToken ? { 'X-Entry-Token': this.entryToken } : undefined;
	}

	initialize = async (concertId: number, initialSessionId: number | null): Promise<void> => {
		this.destroyed = false;
		this.concertId = concertId;
		this.phase = 'loading';
		this.errorMessage = null;
		this.selectedSeats = [];
		this.pendingBooking = null;
		this.entryToken = null;
		this.queueStatus = null;

		try {
			const dto = await api<RawConcertDetailDto>(`/api/concerts/${concertId}`);
			if (this.destroyed || !dto) return;

			const sessions: ConcertBookingSession[] = Array.isArray(dto.sessions)
				? dto.sessions
						.filter((s) => typeof s?.id === 'number')
						.map((s) => {
							const st = s.saleStatus?.trim().toUpperCase() ?? '';
							return {
								id: s.id,
								startsAt: s.startsAt ?? dto.startsAt ?? '',
								saleStatus: st,
								isClosed: st === 'CLOSED'
							};
						})
				: [];

			this.concert = {
				id: dto.id,
				title: dto.title?.trim() || `공연 #${dto.id}`,
				venueName: dto.venue?.name?.trim() || '',
				posterUrl: dto.posterUrl?.trim() || '',
				startsAt: dto.startsAt ?? '',
				queueEnabled: Boolean(dto.queueEnabled),
				maxSeatsPerUser:
					typeof dto.maxSeatsPerUser === 'number' && dto.maxSeatsPerUser > 0
						? dto.maxSeatsPerUser
						: 4,
				saleStatus: dto.saleStatus?.trim().toUpperCase() ?? '',
				sessions
			};

			// 회차 선택 결정 (쿼리 파라미터 우선 -> 첫 오픈 회차)
			if (sessions.length > 0) {
				const requested =
					initialSessionId !== null
						? sessions.find((s) => s.id === initialSessionId && !s.isClosed)
						: null;
				const firstOpen = sessions.find((s) => !s.isClosed) ?? null;
				this.selectedSessionId = requested?.id ?? firstOpen?.id ?? null;
				if (this.selectedSessionId === null) {
					this.phase = 'error';
					this.errorMessage = '예매 가능한 회차가 없습니다.';
					return;
				}
			} else {
				this.selectedSessionId = initialSessionId;
			}

			if (this.concert.queueEnabled) {
				await this.enterQueue();
			} else {
				await this.loadSeatMap();
			}
		} catch (err) {
			if (this.destroyed) return;
			console.error('Failed to initialize concert booking:', err);
			this.phase = 'error';
			this.errorMessage = '공연 정보를 불러오지 못했습니다.';
		}
	};

	private enterQueue = async (): Promise<void> => {
		if (this.concertId === null || this.destroyed) return;
		this.clearPollTimer();
		this.phase = 'queue';

		try {
			const status = await api<QueueStatusDto>(`/api/concerts/${this.concertId}/queue`, {
				method: 'POST'
			});
			if (this.destroyed) return;
			await this.handleQueueStatus(status);
		} catch (err) {
			if (this.destroyed) return;
			const code = (err as { code?: string })?.code;

			if (code === 'ALREADY_IN_QUEUE') {
				await this.pollQueueStatus();
				return;
			}
			if (code === 'QUEUE_DISABLED') {
				await this.loadSeatMap();
				return;
			}
			if (code === 'SOLD_OUT') {
				this.queueStatus = { state: 'SOLD_OUT' };
				return;
			}
			if (code === 'QUEUE_NOT_OPEN') {
				this.phase = 'error';
				this.errorMessage = '아직 예매 대기열이 열리지 않았습니다.';
				return;
			}
			if (code === 'QUEUE_CLOSED') {
				this.phase = 'error';
				this.errorMessage = '예매 대기열이 마감되었습니다.';
				return;
			}

			console.error('Queue enter failed:', err);
			this.phase = 'error';
			this.errorMessage =
				err instanceof Error && err.message
					? err.message
					: '대기열 입장에 실패했습니다. 잠시 후 다시 시도해 주세요.';
		}
	};

	private pollQueueStatus = async (): Promise<void> => {
		if (this.concertId === null || this.destroyed) return;
		this.clearPollTimer();

		try {
			const status = await api<QueueStatusDto>(
				`/api/concerts/${this.concertId}/queue/status`
			);
			if (this.destroyed) return;
			await this.handleQueueStatus(status);
		} catch (err) {
			if (this.destroyed) return;
			const code = (err as { code?: string })?.code;
			if (code === 'NOT_IN_QUEUE') {
				await this.enterQueue();
				return;
			}
			if (code === 'QUEUE_CLOSED') {
				this.phase = 'error';
				this.errorMessage = '예매 대기열이 마감되었습니다.';
				return;
			}
			// 일시 오류 시 5초 뒤 재조회
			this.pollTimer = setTimeout(() => void this.pollQueueStatus(), 5_000);
		}
	};

	private handleQueueStatus = async (status: QueueStatusDto): Promise<void> => {
		this.queueStatus = status;

		if (status.state === 'ADMITTED') {
			this.clearPollTimer();
			this.entryToken = status.entryToken ?? null;
			await this.loadSeatMap();
			return;
		}

		if (status.state === 'WAITING') {
			// v2 명세 §4-2: 반드시 pollAfterMs 주기대로 조회
			const delay =
				typeof status.pollAfterMs === 'number' && status.pollAfterMs >= 1000
					? status.pollAfterMs
					: 3000;
			this.pollTimer = setTimeout(() => void this.pollQueueStatus(), delay);
			return;
		}

		// EXPIRED / SOLD_OUT -> 폴링 중지
		this.clearPollTimer();
	};

	loadSeatMap = async (): Promise<void> => {
		if (this.concertId === null || this.destroyed) return;

		this.isLoadingSeats = true;
		this.phase = 'seats';
		this.errorMessage = null;

		try {
			const qs =
				this.selectedSessionId !== null
					? `?sessionId=${this.selectedSessionId}`
					: '';
			const map = await api<SeatMapDto>(`/api/concerts/${this.concertId}/seats${qs}`, {
				headers: this.getEntryHeaders()
			});
			if (this.destroyed) return;

			this.seatMap = map;
			this.selectedSeats = [];
			if (map.floors && map.floors.length > 0) {
				const stillExists = map.floors.some((f) => String(f.id) === this.activeFloorId);
				if (!stillExists) {
					this.activeFloorId = String(map.floors[0].id);
				}
			}
			if (typeof map.expiresIn === 'number' && map.expiresIn > 0) {
				this.startCountdown(map.expiresIn);
			}
		} catch (err) {
			if (this.destroyed) return;
			const code = (err as { code?: string })?.code;
			if (
				code === 'ENTRY_TOKEN_REQUIRED' ||
				code === 'ENTRY_TOKEN_INVALID' ||
				code === 'QUEUE_NOT_ADMITTED'
			) {
				this.entryToken = null;
				await this.enterQueue();
				return;
			}
			console.error('Failed to load seat map:', err);
			this.phase = 'error';
			this.errorMessage =
				code === 'SESSION_REQUIRED'
					? '예매할 회차를 선택해 주세요.'
					: '좌석 배치도를 불러오지 못했습니다.';
		} finally {
			this.isLoadingSeats = false;
		}
	};

	selectFloor = (floorId: string): void => {
		this.activeFloorId = floorId;
	};

	changeSession = (sessionId: number): void => {
		if (this.selectedSessionId === sessionId) return;
		const target = this.concert?.sessions.find((s) => s.id === sessionId);
		if (target?.isClosed) return;
		this.selectedSessionId = sessionId;
		void this.loadSeatMap();
	};

	toggleSeat = (seat: SelectedSeatItem): void => {
		const exists = this.selectedSeats.some((s) => s.id === seat.id);
		if (exists) {
			this.selectedSeats = this.selectedSeats.filter((s) => s.id !== seat.id);
			return;
		}
		if (this.selectedSeats.length >= this.maxSeats) {
			toast.info(`1인 최대 ${this.maxSeats}매까지 선택할 수 있습니다.`);
			return;
		}
		this.selectedSeats = [...this.selectedSeats, seat];
	};

	removeSelectedSeat = (seatId: number): void => {
		this.selectedSeats = this.selectedSeats.filter((s) => s.id !== seatId);
	};

	createBooking = async (): Promise<void> => {
		if (this.concertId === null || this.isCreatingBooking || this.selectedSeats.length === 0) {
			return;
		}

		this.isCreatingBooking = true;
		try {
			const created = await api<BookingCreatedDto>(
				`/api/concerts/${this.concertId}/bookings`,
				{
					method: 'POST',
					headers: this.getEntryHeaders(),
					body: JSON.stringify({
						seatIds: this.selectedSeats.map((s) => s.id)
					})
				}
			);
			if (this.destroyed || !created) return;

			this.pendingBooking = created;
			this.phase = 'payment';
			this.widgetError = null;
			this.isWidgetReady = false;
			this.startCountdown(created.expiresIn ?? 420);
		} catch (err) {
			if (this.destroyed) return;
			const apiErr = err as { code?: string; message?: string; result?: { bookingId?: number } };
			const code = apiErr?.code;

			if (code === 'HOLD_EXISTS') {
				const existingId = apiErr?.result?.bookingId;
				if (typeof existingId === 'number') {
					void alertDialog.danger({
						title: '진행 중인 좌석 선점이 있습니다',
						description:
							'이 공연에 결제 대기 중인 기존 선점이 남아 있습니다.\n기존 선점을 취소하고 새로 선택한 좌석으로 진행할까요?',
						confirmText: '기존 선점 취소',
						cancelText: '유지하기',
						closeOnOverlay: true,
						onConfirm: async () => {
							await api(`/api/concerts/bookings/${existingId}/cancel`, { method: 'POST' });
							toast.success('기존 선점을 취소했습니다. 다시 시도해 주세요.');
							await this.loadSeatMap();
						}
					});
				} else {
					toast.error('이미 결제 대기 중인 좌석 선점이 있습니다. 마이페이지에서 확인해 주세요.');
				}
				return;
			}

			if (code === 'SEAT_TAKEN' || code === 'SEAT_LOCKED') {
				toast.error('이미 다른 사용자가 선택한 좌석이 포함되어 있습니다. 좌석을 다시 확인해 주세요.');
				await this.loadSeatMap();
				return;
			}

			if (code === 'SEAT_LIMIT_EXCEEDED' || code === 'ALREADY_PAID') {
				toast.error('이미 이 회차에 확정된 예매가 있습니다.');
				return;
			}

			if (code === 'SESSION_CLOSED') {
				toast.error('이미 시작한 회차는 예매할 수 없습니다.');
				return;
			}

			if (
				code === 'ENTRY_TOKEN_REQUIRED' ||
				code === 'ENTRY_TOKEN_INVALID' ||
				code === 'QUEUE_NOT_ADMITTED'
			) {
				toast.info('대기열 인증이 만료되어 다시 입장합니다.');
				this.entryToken = null;
				await this.enterQueue();
				return;
			}

			console.error('Failed to create booking:', err);
			toast.error(apiErr?.message || '좌석 선점에 실패했습니다.');
		} finally {
			this.isCreatingBooking = false;
		}
	};

	mountTossWidgets = async (
		methodsSelector: string,
		agreementSelector: string
	): Promise<void> => {
		if (!this.pendingBooking || this.isMountingWidget) return;

		if (!TOSS_CLIENT_KEY) {
			this.widgetError = '결제 클라이언트 키가 설정되지 않았습니다.';
			return;
		}

		this.isMountingWidget = true;
		this.widgetError = null;
		this.isWidgetReady = false;

		await this.destroyTossWidgets();

		try {
			const TossPayments = await loadTossPaymentsSdk();
			if (this.destroyed || !this.pendingBooking) return;

			const customerKey = auth.user?.userId
				? `indig_member_${auth.user.userId}`
				: TossPayments.ANONYMOUS;
			const tossPayments = TossPayments(TOSS_CLIENT_KEY);
			const widgets = tossPayments.widgets({ customerKey });

			await widgets.setAmount({
				currency: 'KRW',
				value: this.pendingBooking.amount
			});

			const [methodsHandle, agreementHandle] = await Promise.all([
				widgets.renderPaymentMethods({ selector: methodsSelector }),
				widgets.renderAgreement({ selector: agreementSelector })
			]);

			if (this.destroyed) {
				await methodsHandle?.destroy?.();
				await agreementHandle?.destroy?.();
				return;
			}

			this.widgets = widgets;
			this.paymentMethodsHandle = methodsHandle;
			this.agreementHandle = agreementHandle;
			this.isWidgetReady = true;
		} catch (err) {
			console.error('Failed to mount Toss widgets for booking:', err);
			this.widgetError = '결제 위젯을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
		} finally {
			this.isMountingWidget = false;
		}
	};

	requestPayment = async (): Promise<void> => {
		if (
			!this.pendingBooking ||
			!this.concert ||
			!this.widgets ||
			!this.isWidgetReady ||
			this.isRequestingPayment
		) {
			return;
		}

		this.isRequestingPayment = true;
		try {
			const seatLabels = this.selectedSeats.map(formatSelectedSeatLabel);
			const sessionStartsAt = this.selectedSession?.startsAt || this.concert.startsAt;
			const orderName =
				seatLabels.length > 1
					? `${this.concert.title} (${seatLabels.length}매)`
					: `${this.concert.title} 티켓`;

			saveBookingPaymentDraft({
				bookingId: this.pendingBooking.bookingId,
				concertId: this.concert.id,
				sessionId: this.selectedSessionId,
				concertTitle: this.concert.title,
				sessionStartsAt,
				venueName: this.concert.venueName,
				pgOrderId: this.pendingBooking.pgOrderId,
				amount: this.pendingBooking.amount,
				seatLabels
			});

			const origin = window.location.origin;
			const successUrl = `${origin}${PAYMENT_SUCCESS_ROUTE_PATH}?flow=ticket&bookingId=${this.pendingBooking.bookingId}`;
			const failUrl = `${origin}${PAYMENT_FAIL_ROUTE_PATH}?flow=ticket&bookingId=${this.pendingBooking.bookingId}&concertId=${this.concert.id}`;

			await this.widgets.requestPayment({
				orderId: this.pendingBooking.pgOrderId,
				orderName,
				successUrl,
				failUrl,
				customerName: auth.user?.nickname || undefined
			});
		} catch (err) {
			const code = (err as { code?: string })?.code;
			if (code === 'USER_CANCEL' || code === 'PAY_PROCESS_CANCELED') {
				toast.info('결제를 취소했습니다.');
			} else {
				console.error('Ticket payment request failed:', err);
				toast.error('결제 요청 중 오류가 발생했습니다.');
			}
		} finally {
			this.isRequestingPayment = false;
		}
	};

	returnToSeats = async (cancelServerHold = true): Promise<void> => {
		if (this.isCancellingHold) return;
		const bookingId = this.pendingBooking?.bookingId;

		this.isCancellingHold = true;
		try {
			await this.destroyTossWidgets();
			if (cancelServerHold && typeof bookingId === 'number') {
				await api(`/api/concerts/bookings/${bookingId}/cancel`, { method: 'POST' });
			}
			this.pendingBooking = null;
			await this.loadSeatMap();
		} catch (err) {
			console.error('Failed to release pending booking:', err);
			this.pendingBooking = null;
			await this.loadSeatMap();
		} finally {
			this.isCancellingHold = false;
		}
	};

	goBackToConcert = (): void => {
		if (this.concertId !== null) {
			void goto(`/concert/${this.concertId}`, { reset: false });
		} else {
			void goto('/concert', { reset: false });
		}
	};

	private async destroyTossWidgets(): Promise<void> {
		try {
			await this.paymentMethodsHandle?.destroy?.();
			await this.agreementHandle?.destroy?.();
		} catch {
			// ignore
		}
		this.paymentMethodsHandle = null;
		this.agreementHandle = null;
		this.widgets = null;
		this.isWidgetReady = false;
	}

	cleanup = (): void => {
		this.destroyed = true;
		this.clearPollTimer();
		this.clearCountdownTimer();
		void this.destroyTossWidgets();

		// 대기열 대기 중에 화면을 나가면 이탈 호출 (best-effort)
		if (
			this.concertId !== null &&
			this.phase === 'queue' &&
			this.queueStatus?.state === 'WAITING'
		) {
			void api(`/api/concerts/${this.concertId}/queue`, { method: 'DELETE' }).catch(() => {});
		}
	};
}
