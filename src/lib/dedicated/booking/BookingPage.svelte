<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import { isMobile } from '#lib/common/logic';
	import BookingPageView from './design/BookingPageView.svelte';
	import { BookingPageController } from './logic/bookingPage.svelte';

	interface Props {
		concertId: number;
	}

	let { concertId }: Props = $props();

	const ctrl = new BookingPageController();

	const TOSS_METHODS_SELECTOR = '#ticket-toss-methods';
	const TOSS_AGREEMENT_SELECTOR = '#ticket-toss-agreement';

	onMount(() => {
		const rawSession = page.url.searchParams.get('sessionId');
		const parsedSession = rawSession ? Number(rawSession) : NaN;
		const sessionId = Number.isInteger(parsedSession) && parsedSession > 0 ? parsedSession : null;
		void ctrl.initialize(concertId, sessionId);
	});

	$effect(() => {
		if (ctrl.phase !== 'payment' || !ctrl.pendingBooking) return;
		void tick().then(() => {
			if (ctrl.phase === 'payment' && !ctrl.isWidgetReady && !ctrl.isMountingWidget) {
				void ctrl.mountTossWidgets(TOSS_METHODS_SELECTOR, TOSS_AGREEMENT_SELECTOR);
			}
		});
	});

	onDestroy(() => {
		ctrl.cleanup();
	});
</script>

<!-- 콘서트 예매 전용 페이지 Shell -->
<BookingPageView
	mobile={isMobile.current}
	phase={ctrl.phase}
	errorMessage={ctrl.errorMessage}
	concert={ctrl.concert}
	selectedSession={ctrl.selectedSession}
	selectedSessionId={ctrl.selectedSessionId}
	queueStatus={ctrl.queueStatus}
	seatMap={ctrl.seatMap}
	isLoadingSeats={ctrl.isLoadingSeats}
	activeFloorId={ctrl.activeFloorId}
	selectedSeats={ctrl.selectedSeats}
	selectedSeatIds={ctrl.selectedSeatIds}
	maxSeats={ctrl.maxSeats}
	totalPrice={ctrl.totalPrice}
	isCreatingBooking={ctrl.isCreatingBooking}
	pendingBooking={ctrl.pendingBooking}
	remainingSec={ctrl.remainingSec}
	isCancellingHold={ctrl.isCancellingHold}
	isMountingWidget={ctrl.isMountingWidget}
	isWidgetReady={ctrl.isWidgetReady}
	widgetError={ctrl.widgetError}
	isRequestingPayment={ctrl.isRequestingPayment}
	onSelectFloor={ctrl.selectFloor}
	onChangeSession={ctrl.changeSession}
	onToggleSeat={ctrl.toggleSeat}
	onRemoveSeat={ctrl.removeSelectedSeat}
	onRefreshSeats={() => void ctrl.loadSeatMap()}
	onCreateBooking={() => void ctrl.createBooking()}
	onRequestPayment={() => void ctrl.requestPayment()}
	onRetryWidget={() => void ctrl.mountTossWidgets(TOSS_METHODS_SELECTOR, TOSS_AGREEMENT_SELECTOR)}
	onReturnToSeats={() => void ctrl.returnToSeats(true)}
	onGoBack={ctrl.goBackToConcert}
/>
