<script lang="ts">
	import FdButton from '#lib/common/design/fluid/FdButton.svelte';
	import { ArrowLeftIcon, RefreshCcwIcon, TicketIcon } from '#lib/common/design/icon';
	import { Tabs, TabsList, TabsTrigger } from '#lib/common/design/tabs';
	import { FluidSetting } from '#lib/common/type/fluid';
	import {
		formatBookingPrice,
		formatBookingSessionDate,
		formatSelectedSeatLabel,
		formatTimerSeconds
	} from '../logic/bookingPage.svelte';
	import type {
		BookingConcertMeta,
		BookingCreatedDto,
		BookingFlowPhase,
		ConcertBookingSession,
		QueueStatusDto,
		SeatFloorDto,
		SeatMapDto,
		SeatNodeDto,
		SelectedSeatItem
	} from '../logic/types';

	interface Props {
		mobile: boolean;
		phase: BookingFlowPhase;
		errorMessage: string | null;
		concert: BookingConcertMeta | null;
		selectedSession: ConcertBookingSession | null;
		selectedSessionId: number | null;
		queueStatus: QueueStatusDto | null;
		seatMap: SeatMapDto | null;
		isLoadingSeats: boolean;
		activeFloorId: string;
		selectedSeats: readonly SelectedSeatItem[];
		selectedSeatIds: ReadonlySet<number>;
		maxSeats: number;
		totalPrice: number;
		isCreatingBooking: boolean;
		pendingBooking: BookingCreatedDto | null;
		remainingSec: number | null;
		isCancellingHold: boolean;
		isMountingWidget: boolean;
		isWidgetReady: boolean;
		widgetError: string | null;
		isRequestingPayment: boolean;
		onSelectFloor: (floorId: string) => void;
		onChangeSession: (sessionId: number) => void;
		onToggleSeat: (seat: SelectedSeatItem) => void;
		onRemoveSeat: (seatId: number) => void;
		onRefreshSeats: () => void;
		onCreateBooking: () => void;
		onRequestPayment: () => void;
		onRetryWidget: () => void;
		onReturnToSeats: () => void;
		onGoBack: () => void;
	}

	let {
		mobile,
		phase,
		errorMessage,
		concert,
		selectedSession,
		selectedSessionId,
		queueStatus,
		seatMap,
		isLoadingSeats,
		activeFloorId,
		selectedSeats,
		selectedSeatIds,
		maxSeats,
		totalPrice,
		isCreatingBooking,
		pendingBooking,
		remainingSec,
		isCancellingHold,
		isMountingWidget,
		isWidgetReady,
		widgetError,
		isRequestingPayment,
		onSelectFloor,
		onChangeSession,
		onToggleSeat,
		onRemoveSeat,
		onRefreshSeats,
		onCreateBooking,
		onRequestPayment,
		onRetryWidget,
		onReturnToSeats,
		onGoBack
	}: Props = $props();

	const PRIMARY_BTN_SETTING = new FluidSetting({
		radius: 12,
		inset: 4,
		reach: 18,
		bulge: 2.4,
		bulgeWidth: 14,
		layers: 2,
		layerGap: 1.5,
		waveAmp: 1.3,
		waveLength: 42,
		spin: 1.1,
		pauseWhenIdle: true,
		color: 'var(--white-2)',
		hoverColor: 'var(--white)',
		pressColor: 'var(--white-3)',
		waveColor: 'var(--white-3)',
		hoverWaveColor: 'var(--white-3)',
		textColor: 'var(--bg)',
		borderWidth: 0
	});

	const DISABLED_BTN_SETTING = PRIMARY_BTN_SETTING.with({
		hoverReactive: false,
		bulgeReactive: false,
		clickReactive: false,
		layerGap: 0,
		waveAmp: 0,
		color: 'var(--surface-2)',
		hoverColor: 'var(--surface-2)',
		pressColor: 'var(--surface-2)',
		waveColor: 'var(--surface-2)',
		hoverWaveColor: 'var(--surface-2)',
		textColor: 'var(--muted)'
	});

	const activeFloor = $derived.by<SeatFloorDto | null>(() => {
		const floors = seatMap?.floors ?? [];
		if (floors.length === 0) return null;
		return floors.find((f) => String(f.id) === activeFloorId) ?? floors[0];
	});

	const canSubmitSeats = $derived(selectedSeats.length > 0 && !isCreatingBooking);
	const canSubmitPayment = $derived(
		Boolean(pendingBooking) && isWidgetReady && !isRequestingPayment && remainingSec !== 0
	);

	function groupSeatsByRow(seats: readonly SeatNodeDto[]): Array<{ row: string; seats: SeatNodeDto[] }> {
		const map = new Map<string, SeatNodeDto[]>();
		for (const seat of seats) {
			const rowKey = String(seat.row ?? '').trim() || '-';
			const list = map.get(rowKey);
			if (list) list.push(seat);
			else map.set(rowKey, [seat]);
		}
		return Array.from(map.entries())
			.sort(([a], [b]) => a.localeCompare(b, 'ko', { numeric: true }))
			.map(([row, list]) => ({
				row,
				seats: [...list].sort((a, b) =>
					String(a.number).localeCompare(String(b.number), 'ko', { numeric: true })
				)
			}));
	}

	function formatEta(etaSeconds?: number | null): string {
		if (typeof etaSeconds !== 'number' || !Number.isFinite(etaSeconds) || etaSeconds <= 0) {
			return '잠시 후 입장 예정';
		}
		if (etaSeconds < 60) return `약 ${Math.ceil(etaSeconds)}초`;
		const min = Math.floor(etaSeconds / 60);
		const sec = Math.floor(etaSeconds % 60);
		return sec > 0 ? `약 ${min}분 ${sec}초` : `약 ${min}분`;
	}
</script>

<!-- 콘서트 예매 전용 뷰 (대기열 · 좌석 선택 · 토스 결제, 순수 렌더링) -->
<div class="booking-page" class:is-mobile={mobile}>
	<!-- 상단 헤더 바 -->
	<header class="booking-header">
		<button type="button" class="back-btn" onclick={onGoBack} aria-label="공연 상세로 돌아가기">
			<ArrowLeftIcon size={18} />
			<span>공연 상세</span>
		</button>

		<div class="header-meta">
			{#if concert}
				<h1 class="header-title">{concert.title}</h1>
				<p class="header-sub">
					<span>{formatBookingSessionDate(selectedSession?.startsAt || concert.startsAt)}</span>
					{#if concert.venueName}
						<span class="dot-sep" aria-hidden="true">·</span>
						<span>{concert.venueName}</span>
					{/if}
				</p>
			{/if}
		</div>

		{#if remainingSec !== null && (phase === 'seats' || phase === 'payment')}
			<div class="timer-pill" class:is-urgent={remainingSec <= 60}>
				<span class="timer-label">남은 시간</span>
				<strong class="timer-val">{formatTimerSeconds(remainingSec)}</strong>
			</div>
		{/if}
	</header>

	<!-- 단계 표시 -->
	{#if phase !== 'loading' && phase !== 'error'}
		<ol class="step-bar" aria-label="예매 진행 단계">
			{#if concert?.queueEnabled}
				<li class="step-item" class:is-active={phase === 'queue'} class:is-done={phase === 'seats' || phase === 'payment'}>
					<span class="step-num">1</span>
					<span>대기열</span>
				</li>
			{/if}
			<li class="step-item" class:is-active={phase === 'seats'} class:is-done={phase === 'payment'}>
				<span class="step-num">{concert?.queueEnabled ? 2 : 1}</span>
				<span>좌석 선택</span>
			</li>
			<li class="step-item" class:is-active={phase === 'payment'}>
				<span class="step-num">{concert?.queueEnabled ? 3 : 2}</span>
				<span>결제</span>
			</li>
		</ol>
	{/if}

	<!-- 본문 단계별 렌더링 -->
	{#if phase === 'loading'}
		<div class="center-card">
			<p class="center-title">예매 정보를 준비하는 중입니다...</p>
		</div>
	{:else if phase === 'error'}
		<div class="center-card" role="alert">
			<span class="center-icon" aria-hidden="true">
				<TicketIcon size={24} strokeWidth={1.7} />
			</span>
			<p class="center-title">{errorMessage || '예매를 진행할 수 없습니다.'}</p>
			<button type="button" class="soft-btn" onclick={onGoBack}>공연으로 돌아가기</button>
		</div>
	{:else if phase === 'queue'}
		<section class="center-card queue-card" aria-label="예매 대기열">
			{#if queueStatus?.state === 'SOLD_OUT'}
				<p class="center-title">모든 좌석이 매진되었습니다</p>
				<p class="center-desc">취소 · 환불 좌석이 발생하면 다시 예매할 수 있습니다.</p>
				<button type="button" class="soft-btn" onclick={onGoBack}>공연으로 돌아가기</button>
			{:else if queueStatus?.state === 'EXPIRED'}
				<p class="center-title">대기열 순번이 만료되었습니다</p>
				<p class="center-desc">다시 예매 버튼을 눌러 대기열에 입장해 주세요.</p>
				<button type="button" class="soft-btn" onclick={onGoBack}>공연으로 돌아가기</button>
			{:else}
				<p class="queue-eyebrow">예매 대기 중</p>
				<p class="queue-rank">
					{#if typeof queueStatus?.rank === 'number'}
						{queueStatus.rank.toLocaleString('ko-KR')}번
					{:else}
						순번 확인 중...
					{/if}
				</p>

				{#if typeof queueStatus?.rank === 'number' && typeof queueStatus?.total === 'number' && queueStatus.total > 0}
					{@const progress = Math.max(
						4,
						Math.min(100, Math.round(((queueStatus.total - queueStatus.rank + 1) / queueStatus.total) * 100))
					)}
					<div class="queue-progress-track" aria-hidden="true">
						<div class="queue-progress-fill" style:width="{progress}%"></div>
					</div>
					<p class="queue-meta">
						전체 대기 {queueStatus.total.toLocaleString('ko-KR')}명 · 예상 대기 {formatEta(queueStatus.etaSeconds)}
					</p>
				{/if}

				<div class="queue-warning" role="note">
					화면을 나가거나 앱을 백그라운드로 전환하면 대기 순번이 사라집니다.
				</div>
			{/if}
		</section>
	{:else if phase === 'seats'}
		<div class="seats-layout">
			<div class="seats-stage-col">
				<!-- 다회차 공연 회차 전환 바 -->
				{#if concert && concert.sessions.length > 1}
					<div class="session-bar" role="radiogroup" aria-label="회차 변경">
						{#each concert.sessions as sess, idx (sess.id)}
							<button
								type="button"
								role="radio"
								class="session-pill"
								class:is-selected={selectedSessionId === sess.id}
								aria-checked={selectedSessionId === sess.id}
								disabled={sess.isClosed}
								onclick={() => onChangeSession(sess.id)}
							>
								<span>{idx + 1}회차</span>
								<span>{formatBookingSessionDate(sess.startsAt)}</span>
								{#if sess.isClosed}
									<span class="closed-tag">마감</span>
								{/if}
							</button>
						{/each}
					</div>
				{/if}

				<!-- 층 탭 & 새로고침 -->
				<div class="seat-toolbar">
					{#if seatMap && seatMap.floors.length > 1}
						<Tabs value={activeFloorId} onValueChange={onSelectFloor}>
							<TabsList ariaLabel="층 선택">
								{#each seatMap.floors as floor (floor.id)}
									<TabsTrigger value={String(floor.id)}>{floor.name}</TabsTrigger>
								{/each}
							</TabsList>
						</Tabs>
					{:else if activeFloor}
						<span class="floor-single-label">{activeFloor.name}</span>
					{/if}

					<div class="toolbar-right">
						{#if seatMap}
							<span class="avail-count">
								잔여 <strong>{seatMap.available}</strong> / {seatMap.total}석
							</span>
						{/if}
						<button
							type="button"
							class="refresh-seats-btn"
							disabled={isLoadingSeats}
							onclick={onRefreshSeats}
						>
							<RefreshCcwIcon size={14} />
							<span>새로고침</span>
						</button>
					</div>
				</div>

				<!-- 범례 -->
				<div class="seat-legend" aria-label="좌석 상태 안내">
					<span class="legend-item">
						<i class="legend-dot is-avail"></i>선택 가능
					</span>
					<span class="legend-item">
						<i class="legend-dot is-selected"></i>선택됨
					</span>
					<span class="legend-item">
						<i class="legend-dot is-taken"></i>예매 불가
					</span>
				</div>

				<!-- 무대 & 좌석 배치 -->
				<div class="seat-map-surface">
					<div class="stage-bar" aria-hidden="true">STAGE</div>

					{#if isLoadingSeats && !seatMap}
						<p class="map-empty">좌석 배치도를 불러오는 중입니다...</p>
					{:else if !activeFloor || activeFloor.sections.length === 0}
						<p class="map-empty">표시할 좌석 정보가 없습니다.</p>
					{:else}
						<div class="sections-grid">
							{#each activeFloor.sections as section (section.id)}
								{@const rows = groupSeatsByRow(section.seats)}
								<div class="section-box">
									<div class="section-box-head">
										<h3 class="section-name">{section.name}구역</h3>
										<span class="section-avail">
											잔여 {section.seats.filter((s) => s.status === 'AVAILABLE').length}석
										</span>
									</div>

									<div class="seat-rows">
										{#each rows as rowGroup (rowGroup.row)}
											<div class="seat-row">
												<span class="row-label">{rowGroup.row}</span>
												<div class="row-seats">
													{#each rowGroup.seats as seat (seat.id)}
														{@const isAvail = seat.status === 'AVAILABLE'}
														{@const isPicked = selectedSeatIds.has(seat.id)}
														<button
															type="button"
															class="seat-btn"
															class:is-available={isAvail}
															class:is-selected={isPicked}
															class:is-taken={!isAvail}
															disabled={!isAvail}
															aria-pressed={isPicked}
															title={`${activeFloor.name} ${section.name}구역 ${seat.row}열 ${seat.number}번 · ${formatBookingPrice(seat.price)}`}
															onclick={() =>
																onToggleSeat({
																	id: seat.id,
																	floorName: activeFloor.name,
																	sectionName: section.name,
																	row: seat.row,
																	number: seat.number,
																	price: seat.price
																})}
														>
															{seat.number}
														</button>
													{/each}
												</div>
											</div>
										{/each}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<!-- 우측(PC) / 하단(모바일) 선택 좌석 요약 -->
			<aside class="summary-panel" aria-label="선택한 좌석">
				<div class="summary-head">
					<h2 class="summary-heading">선택한 좌석</h2>
					<span class="summary-quota">{selectedSeats.length} / {maxSeats}매</span>
				</div>

				{#if selectedSeats.length === 0}
					<p class="summary-empty">좌석 배치도에서 원하는 좌석을 선택해 주세요.</p>
				{:else}
					<ul class="picked-list">
						{#each selectedSeats as seat (seat.id)}
							<li class="picked-item">
								<span class="picked-label">{formatSelectedSeatLabel(seat)}</span>
								<span class="picked-right">
									<span class="picked-price">{formatBookingPrice(seat.price)}</span>
									<button
										type="button"
										class="picked-remove-btn"
										aria-label="{formatSelectedSeatLabel(seat)} 선택 해제"
										onclick={() => onRemoveSeat(seat.id)}
									>
										×
									</button>
								</span>
							</li>
						{/each}
					</ul>
				{/if}

				<div class="summary-total-row">
					<span>총 결제 금액</span>
					<strong class="summary-total-val">{formatBookingPrice(totalPrice)}</strong>
				</div>

				<FdButton
					type="button"
					fullWidth
					setting={canSubmitSeats ? PRIMARY_BTN_SETTING : DISABLED_BTN_SETTING}
					disabled={!canSubmitSeats}
					class="booking-primary-fd-btn"
					onclick={onCreateBooking}
				>
					{#if isCreatingBooking}
						좌석 선점 중...
					{:else}
						좌석 선택 완료 · 결제하기
					{/if}
				</FdButton>
			</aside>
		</div>
	{:else if phase === 'payment'}
		<div class="payment-layout">
			<section class="payment-widget-col" aria-label="결제 수단 선택">
				<div class="payment-col-head">
					<h2 class="summary-heading">결제 수단</h2>
					<button
						type="button"
						class="soft-btn is-sm"
						disabled={isCancellingHold}
						onclick={onReturnToSeats}
					>
						{isCancellingHold ? '선점 해제 중...' : '좌석 다시 선택'}
					</button>
				</div>

				{#if widgetError}
					<div class="widget-error-box" role="alert">
						<p>{widgetError}</p>
						<button type="button" class="soft-btn is-sm" onclick={onRetryWidget}>
							위젯 다시 불러오기
						</button>
					</div>
				{:else}
					{#if isMountingWidget}
						<p class="widget-loading">토스 결제 위젯을 불러오는 중입니다...</p>
					{/if}
					<div class="toss-widget-surface">
						<div id="ticket-toss-methods"></div>
						<div id="ticket-toss-agreement"></div>
					</div>
				{/if}
			</section>

			<aside class="summary-panel" aria-label="예매 결제 요약">
				<div class="summary-head">
					<h2 class="summary-heading">예매 요약</h2>
					<span class="summary-quota">{selectedSeats.length}매</span>
				</div>

				<ul class="picked-list">
					{#each selectedSeats as seat (seat.id)}
						<li class="picked-item">
							<span class="picked-label">{formatSelectedSeatLabel(seat)}</span>
							<span class="picked-price">{formatBookingPrice(seat.price)}</span>
						</li>
					{/each}
				</ul>

				<div class="summary-total-row">
					<span>최종 결제 금액</span>
					<strong class="summary-total-val">{formatBookingPrice(totalPrice)}</strong>
				</div>

				<p class="policy-caption">
					취소 · 환불은 예매한 회차 시작 24시간 전까지 가능합니다.
				</p>

				<FdButton
					type="button"
					fullWidth
					setting={canSubmitPayment ? PRIMARY_BTN_SETTING : DISABLED_BTN_SETTING}
					disabled={!canSubmitPayment}
					class="booking-primary-fd-btn"
					onclick={onRequestPayment}
				>
					{#if isRequestingPayment}
						결제창 여는 중...
					{:else}
						{formatBookingPrice(totalPrice)} 결제하기
					{/if}
				</FdButton>
			</aside>
		</div>
	{/if}
</div>

<style>
	.booking-page {
		width: 100%;
		max-width: 1120px;
		margin: 0 auto;
		padding: 1.5rem 1.25rem 4rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.booking-page.is-mobile {
		padding: 1rem 1rem 3rem;
		gap: 1.15rem;
	}

	/* ── 헤더 ── */
	.booking-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		padding-bottom: 1rem;
		border-bottom: var(--thin-border);
	}

	.back-btn {
		height: 36px;
		padding: 0 0.75rem;
		border: var(--thin-border);
		border-radius: 10px;
		background: transparent;
		color: var(--white-2);
		font: inherit;
		font-size: 0.84rem;
		font-weight: var(--fw-medium);
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		cursor: pointer;
		flex-shrink: 0;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.back-btn:hover {
		background: var(--surface);
		color: var(--white);
	}

	.header-meta {
		flex: 1;
		min-width: 180px;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.header-title {
		margin: 0;
		font-size: 1.15rem;
		font-weight: var(--fw-bold);
		color: var(--white);
		letter-spacing: -0.02em;
	}

	.header-sub {
		margin: 0;
		font-size: 0.82rem;
		color: var(--muted);
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.dot-sep {
		opacity: 0.5;
	}

	.timer-pill {
		padding: 0.4rem 0.8rem;
		border-radius: 999px;
		background: var(--surface);
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.82rem;
		flex-shrink: 0;
	}

	.timer-pill.is-urgent {
		background: color-mix(in srgb, var(--toast-error-bg) 80%, transparent);
		color: var(--toast-error-fg);
	}

	.timer-label {
		color: var(--muted);
	}

	.timer-pill.is-urgent .timer-label {
		color: inherit;
	}

	.timer-val {
		color: var(--white);
		font-variant-numeric: tabular-nums;
	}

	.timer-pill.is-urgent .timer-val {
		color: inherit;
	}

	/* ── 스텝 바 ── */
	.step-bar {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		align-items: center;
		gap: 0.9rem;
		flex-wrap: wrap;
	}

	.step-item {
		display: inline-flex;
		align-items: center;
		gap: 0.42rem;
		font-size: 0.82rem;
		color: var(--muted);
	}

	.step-item.is-active {
		color: var(--white);
		font-weight: var(--fw-semibold);
	}

	.step-item.is-done {
		color: var(--white-2);
	}

	.step-num {
		width: 22px;
		height: 22px;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--muted);
		font-size: 0.74rem;
		font-weight: var(--fw-bold);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.step-item.is-active .step-num {
		background: var(--white);
		color: var(--bg);
	}

	/* ── 중앙 카드 (로딩 · 에러 · 대기열) ── */
	.center-card {
		padding: 3.25rem 1.5rem;
		border-radius: 18px;
		background: var(--surface);
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.75rem;
	}

	.center-icon {
		width: 48px;
		height: 48px;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--muted);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.center-title {
		margin: 0;
		font-size: 1rem;
		font-weight: var(--fw-semibold);
		color: var(--white);
	}

	.center-desc {
		margin: 0;
		font-size: 0.85rem;
		color: var(--muted);
	}

	.queue-eyebrow {
		margin: 0;
		font-size: 0.84rem;
		color: var(--muted);
	}

	.queue-rank {
		margin: 0;
		font-size: 2.2rem;
		font-weight: var(--fw-bold);
		color: var(--white);
		font-variant-numeric: tabular-nums;
	}

	.queue-progress-track {
		width: min(320px, 100%);
		height: 8px;
		border-radius: 999px;
		background: var(--surface-2);
		overflow: hidden;
	}

	.queue-progress-fill {
		height: 100%;
		border-radius: 999px;
		background: var(--white);
		transition: width 0.35s ease;
	}

	.queue-meta {
		margin: 0;
		font-size: 0.84rem;
		color: var(--fg);
	}

	.queue-warning {
		margin-top: 0.5rem;
		padding: 0.65rem 1rem;
		border-radius: 10px;
		background: color-mix(in srgb, var(--toast-error-bg) 60%, transparent);
		color: var(--toast-error-fg);
		font-size: 0.8rem;
		font-weight: var(--fw-medium);
	}

	/* ── 좌석 선택 레이아웃 ── */
	.seats-layout,
	.payment-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 320px;
		gap: 1.5rem;
		align-items: start;
	}

	.booking-page.is-mobile .seats-layout,
	.booking-page.is-mobile .payment-layout {
		grid-template-columns: 1fr;
	}

	.seats-stage-col,
	.payment-widget-col {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.session-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.session-pill {
		padding: 0.45rem 0.78rem;
		border: var(--thin-border);
		border-radius: 10px;
		background: var(--surface);
		color: var(--fg);
		font: inherit;
		font-size: 0.8rem;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		cursor: pointer;
	}

	.session-pill.is-selected {
		background: var(--white);
		border-color: var(--white);
		color: var(--bg);
		font-weight: var(--fw-semibold);
	}

	.session-pill:disabled {
		opacity: 0.42;
		cursor: not-allowed;
	}

	.closed-tag {
		font-size: 0.7rem;
		opacity: 0.8;
	}

	.seat-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.floor-single-label {
		font-size: 0.92rem;
		font-weight: var(--fw-semibold);
		color: var(--white);
	}

	.toolbar-right {
		display: inline-flex;
		align-items: center;
		gap: 0.75rem;
		margin-left: auto;
	}

	.avail-count {
		font-size: 0.82rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.avail-count strong {
		color: var(--white);
	}

	.refresh-seats-btn {
		height: 32px;
		padding: 0 0.7rem;
		border: var(--thin-border);
		border-radius: 9px;
		background: transparent;
		color: var(--white-2);
		font: inherit;
		font-size: 0.78rem;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		cursor: pointer;
	}

	.refresh-seats-btn:hover:not(:disabled) {
		background: var(--surface);
		color: var(--white);
	}

	.seat-legend {
		display: flex;
		align-items: center;
		gap: 1rem;
		font-size: 0.78rem;
		color: var(--muted);
	}

	.legend-item {
		display: inline-flex;
		align-items: center;
		gap: 0.38rem;
	}

	.legend-dot {
		width: 12px;
		height: 12px;
		border-radius: 4px;
		display: inline-block;
	}

	.legend-dot.is-avail {
		background: var(--surface-3);
		border: 1px solid color-mix(in srgb, var(--white) 25%, transparent);
	}

	.legend-dot.is-selected {
		background: var(--white);
	}

	.legend-dot.is-taken {
		background: var(--surface-dim);
		opacity: 0.45;
	}

	.seat-map-surface {
		padding: 1.25rem;
		border-radius: 16px;
		background: var(--surface);
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.stage-bar {
		width: min(360px, 100%);
		margin: 0 auto;
		padding: 0.5rem 1rem;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--muted);
		font-size: 0.76rem;
		font-weight: var(--fw-bold);
		letter-spacing: 0.18em;
		text-align: center;
	}

	.map-empty {
		margin: 1.5rem 0;
		text-align: center;
		font-size: 0.86rem;
		color: var(--muted);
	}

	.sections-grid {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.section-box {
		padding: 0.95rem 1rem;
		border-radius: 12px;
		background: var(--surface-dim);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.section-box-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.section-name {
		margin: 0;
		font-size: 0.88rem;
		font-weight: var(--fw-semibold);
		color: var(--white);
	}

	.section-avail {
		font-size: 0.76rem;
		color: var(--muted);
	}

	.seat-rows {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		overflow-x: auto;
		padding-bottom: 0.2rem;
	}

	.seat-row {
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}

	.row-label {
		width: 24px;
		font-size: 0.74rem;
		font-weight: var(--fw-semibold);
		color: var(--muted);
		text-align: center;
		flex-shrink: 0;
	}

	.row-seats {
		display: flex;
		align-items: center;
		gap: 0.32rem;
		flex-wrap: nowrap;
	}

	.seat-btn {
		min-width: 30px;
		height: 30px;
		padding: 0 0.25rem;
		border-radius: 7px;
		border: 1px solid transparent;
		font: inherit;
		font-size: 0.74rem;
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition:
			background-color 0.14s ease,
			border-color 0.14s ease,
			color 0.14s ease,
			transform 0.12s ease;
	}

	.seat-btn.is-available {
		background: var(--surface-2);
		border-color: color-mix(in srgb, var(--white) 16%, transparent);
		color: var(--white-2);
	}

	.seat-btn.is-available:hover {
		background: var(--surface-3);
		border-color: color-mix(in srgb, var(--white) 40%, transparent);
		color: var(--white);
		transform: translateY(-1px);
	}

	.seat-btn.is-selected {
		background: var(--white);
		border-color: var(--white);
		color: var(--bg);
	}

	.seat-btn.is-taken {
		background: var(--surface);
		color: var(--muted);
		opacity: 0.32;
		cursor: not-allowed;
	}

	/* ── 요약 사이드바 ── */
	.summary-panel {
		position: sticky;
		top: calc(var(--pc-header-height, 70px) + 1.25rem);
		padding: 1.2rem;
		border-radius: 16px;
		background: var(--surface);
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.booking-page.is-mobile .summary-panel {
		position: static;
	}

	.summary-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.summary-heading {
		margin: 0;
		font-size: 0.96rem;
		font-weight: var(--fw-bold);
		color: var(--white);
	}

	.summary-quota {
		font-size: 0.8rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.summary-empty {
		margin: 0.5rem 0;
		font-size: 0.83rem;
		color: var(--muted);
	}

	.picked-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.picked-item {
		padding: 0.55rem 0.7rem;
		border-radius: 10px;
		background: var(--surface-dim);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		font-size: 0.82rem;
	}

	.picked-label {
		color: var(--white-2);
	}

	.picked-right {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
	}

	.picked-price {
		color: var(--white);
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
	}

	.picked-remove-btn {
		width: 22px;
		height: 22px;
		padding: 0;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--muted);
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
	}

	.picked-remove-btn:hover {
		background: var(--surface-2);
		color: var(--white);
	}

	.summary-total-row {
		padding-top: 0.85rem;
		border-top: var(--thin-border);
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		font-size: 0.86rem;
		color: var(--muted);
	}

	.summary-total-val {
		font-size: 1.12rem;
		font-weight: var(--fw-bold);
		color: var(--white);
		font-variant-numeric: tabular-nums;
	}

	.policy-caption {
		margin: 0;
		font-size: 0.76rem;
		color: var(--muted);
		line-height: 1.45;
	}

	.booking-page :global(.fd-btn.booking-primary-fd-btn) {
		height: 44px;
		font-size: 0.9rem;
		font-weight: var(--fw-bold);
	}

	/* ── 토스 결제 위젯 ── */
	.payment-col-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.toss-widget-surface {
		border-radius: 16px;
		overflow: hidden;
		background: var(--white);
		padding: 0.5rem;
	}

	.widget-loading {
		margin: 0;
		font-size: 0.84rem;
		color: var(--muted);
	}

	.widget-error-box {
		padding: 1.5rem;
		border-radius: 14px;
		background: var(--surface);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		text-align: center;
		font-size: 0.86rem;
		color: var(--toast-error-fg);
	}

	.widget-error-box p {
		margin: 0;
	}

	.soft-btn {
		height: 38px;
		padding: 0 1rem;
		border: none;
		border-radius: 10px;
		background: var(--surface-2);
		color: var(--white-2);
		font: inherit;
		font-size: 0.84rem;
		font-weight: var(--fw-semibold);
		cursor: pointer;
	}

	.soft-btn.is-sm {
		height: 32px;
		padding: 0 0.75rem;
		font-size: 0.78rem;
	}

	.soft-btn:hover:not(:disabled) {
		background: var(--surface-3);
		color: var(--white);
	}
</style>
