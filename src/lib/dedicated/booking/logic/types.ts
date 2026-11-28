/** 콘서트 예매 전용 타입 정의 (v2 · v3 명세 기준) */

export type BookingFlowPhase =
	| 'loading'
	| 'queue'
	| 'seats'
	| 'payment'
	| 'error';

export type QueueState = 'WAITING' | 'ADMITTED' | 'EXPIRED' | 'SOLD_OUT' | string;

export interface QueueStatusDto {
	state: QueueState;
	rank?: number | null;
	total?: number | null;
	etaSeconds?: number | null;
	pollAfterMs?: number | null;
	degraded?: boolean | null;
	entryToken?: string | null;
	expiresIn?: number | null;
}

export interface ConcertBookingSession {
	id: number;
	startsAt: string;
	saleStatus: string;
	isClosed: boolean;
}

export interface BookingConcertMeta {
	id: number;
	title: string;
	venueName: string;
	posterUrl: string;
	startsAt: string;
	queueEnabled: boolean;
	maxSeatsPerUser: number;
	saleStatus: string;
	sessions: ConcertBookingSession[];
}

export interface SeatNodeDto {
	id: number;
	row: string | number;
	number: number | string;
	x?: number | null;
	y?: number | null;
	angle?: number | null;
	price: number;
	status: 'AVAILABLE' | 'HELD' | 'PAYING' | 'SOLD' | string;
}

export interface SeatSectionDto {
	id: number;
	name: string;
	shape?: string | null;
	angle?: number | null;
	seats: SeatNodeDto[];
}

export interface SeatFloorDto {
	id: number;
	name: string;
	sections: SeatSectionDto[];
}

export interface SeatMapDto {
	concertId: number;
	sessionId?: number | null;
	maxSeatsPerUser: number;
	total: number;
	available: number;
	expiresAt?: string | null;
	expiresIn?: number | null;
	floors: SeatFloorDto[];
}

export interface SelectedSeatItem {
	id: number;
	floorName: string;
	sectionName: string;
	row: string | number;
	number: number | string;
	price: number;
}

export interface BookingCreatedDto {
	bookingId: number;
	amount: number;
	pgOrderId: string;
	status: string;
	expiresAt?: string | null;
	expiresIn?: number | null;
}

export interface BookingPaymentDraft {
	bookingId: number;
	concertId: number;
	sessionId: number | null;
	concertTitle: string;
	sessionStartsAt: string;
	venueName: string;
	pgOrderId: string;
	amount: number;
	seatLabels: string[];
}
