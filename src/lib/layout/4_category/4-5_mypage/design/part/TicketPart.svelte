<script lang="ts">
	import FdButton from '#lib/common/design/fluid/FdButton.svelte';
	import {
		CheckIcon,
		RefreshCcwIcon,
		SquareArrowOutUpRightIcon,
		TicketIcon
	} from '#lib/common/design/icon';
	import { Tabs, TabsContent, TabsContents, TabsList, TabsTrigger } from '#lib/common/design/tabs';
	import { FluidSetting } from '#lib/common/type/fluid';
	import {
		canCancelBooking,
		formatCountdown,
		formatKstDateTime,
		formatKstSessionDateTime,
		formatKstTime,
		formatSeatLabel,
		formatTicketPrice,
		getBookingStatusMeta,
		getEntryStatusBadge,
		type BookingDetailDto,
		type BookingSummaryDto,
		type TicketFilterKey,
		type TicketFilterTab
	} from '../../logic/ticketPart.svelte';
	import EntryQrCanvas from './EntryQrCanvas.svelte';

	interface Props {
		mobile: boolean;
		bookings: readonly BookingSummaryDto[];
		totalCount: number;
		filterTabs: readonly TicketFilterTab[];
		activeFilter: TicketFilterKey;
		detailsById: Record<number, BookingDetailDto>;
		loadingDetailIds: Record<number, boolean>;
		expandedBookingId: number | null;
		serverNowMs: number;
		qrBookingId: number | null;
		qrToken: string | null;
		qrExpiresAt: string | null;
		qrLoading: boolean;
		qrError: string | null;
		isLoading: boolean;
		isLoadingMore: boolean;
		hasNext: boolean;
		cancellingBookingId: number | null;
		errorMessage: string | null;
		onSelectFilter: (filter: TicketFilterKey) => void;
		onToggleExpand: (bookingId: number) => void;
		onRetryQr: (bookingId: number) => void;
		onCancelBooking: (booking: BookingSummaryDto) => void;
		onOpenConcert: (concertId: number) => void;
		onLoadMore: () => void;
		onRetry: () => void;
		onBrowseConcerts: () => void;
	}

	let {
		mobile,
		bookings,
		totalCount,
		filterTabs,
		activeFilter,
		detailsById,
		loadingDetailIds,
		expandedBookingId,
		serverNowMs,
		qrBookingId,
		qrToken,
		qrExpiresAt,
		qrLoading,
		qrError,
		isLoading,
		isLoadingMore,
		hasNext,
		cancellingBookingId,
		errorMessage,
		onSelectFilter,
		onToggleExpand,
		onRetryQr,
		onCancelBooking,
		onOpenConcert,
		onLoadMore,
		onRetry,
		onBrowseConcerts
	}: Props = $props();

	const SKELETON_INDICES = [0, 1, 2];

	const ACTION_BTN_SETTING = new FluidSetting({
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
		color: 'var(--surface-2)',
		hoverColor: 'var(--surface-3)',
		pressColor: 'var(--surface-4)',
		waveColor: 'var(--surface-3)',
		hoverWaveColor: 'var(--surface-4)',
		textColor: 'var(--white)',
		borderWidth: 0
	});

	function getBookingsForTab(key: TicketFilterKey): readonly BookingSummaryDto[] {
		if (key === 'ALL') return bookings;
		if (key === 'CANCELLED') {
			return bookings.filter((b) => b.status === 'CANCELLED' || b.status === 'EXPIRED');
		}
		return bookings.filter((b) => b.status === key);
	}

	function getRemainingMs(iso?: string | null): number {
		if (!iso) return 0;
		const target = Date.parse(iso);
		if (Number.isNaN(target)) return 0;
		return Math.max(0, target - serverNowMs);
	}

	function isQrValidFor(bookingId: number): boolean {
		if (qrBookingId !== bookingId || !qrToken || !qrExpiresAt) return false;
		const expMs = Date.parse(qrExpiresAt);
		if (Number.isNaN(expMs)) return false;
		return serverNowMs < expMs;
	}

	function getUnavailableMessage(status: string): string {
		if (status === 'PENDING') {
			return '결제를 완료하면 예매가 확정되고 입장 QR을 확인할 수 있습니다.';
		}
		if (status === 'CANCELLED') return '취소된 예매입니다.';
		if (status === 'EXPIRED') return '결제 기한이 지나 만료된 예매입니다.';
		return '입장 대상이 아닌 예매입니다.';
	}
</script>

<!-- 마이페이지 > 공연 예매 내역 파트 (v3 입장 QR · 회차 · 서버 시각 기준, 순수 렌더링) -->
<div class="ticket-part" class:is-mobile={mobile} data-part="ticket">
	{#if isLoading && totalCount === 0}
		<div class="skeleton-list" aria-busy="true" aria-label="공연 예매 내역 불러오는 중">
			{#each SKELETON_INDICES as idx (idx)}
				<div class="ticket-skeleton-card">
					<div class="skel-row-top">
						<span class="skel-pill skel-w-sm"></span>
						<span class="skel-pill skel-w-xs"></span>
					</div>
					<div class="skel-lines">
						<span class="skel-line skel-w-lg"></span>
						<span class="skel-line skel-w-md"></span>
					</div>
				</div>
			{/each}
		</div>
	{:else if errorMessage && totalCount === 0}
		<div class="state-box" role="alert">
			<p class="state-title">{errorMessage}</p>
			<div class="state-action">
				<FdButton
					type="button"
					setting={ACTION_BTN_SETTING}
					class="ticket-fd-btn"
					onclick={onRetry}
				>
					다시 시도
				</FdButton>
			</div>
		</div>
	{:else if totalCount === 0}
		<div class="state-box">
			<span class="empty-icon" aria-hidden="true">
				<TicketIcon size={24} strokeWidth={1.7} />
			</span>
			<p class="state-title">공연 예매 내역이 없습니다</p>
			<p class="state-desc">
				공연을 예매하시면 이곳에서 회차 정보와 입장 QR을 확인하실 수 있어요.
			</p>
			<div class="state-action">
				<FdButton
					type="button"
					setting={ACTION_BTN_SETTING}
					class="ticket-fd-btn"
					onclick={onBrowseConcerts}
				>
					공연 둘러보기
				</FdButton>
			</div>
		</div>
	{:else}
		<Tabs
			value={activeFilter}
			onValueChange={(next) => onSelectFilter(next as TicketFilterKey)}
			class="ticket-tabs"
		>
			<TabsList ariaLabel="예매 상태 필터" class="ticket-tabs-list">
				{#each filterTabs as tab (tab.key)}
					<TabsTrigger value={tab.key}>
						<span>{tab.label}</span>
						<span class="filter-count">{tab.count}</span>
					</TabsTrigger>
				{/each}
			</TabsList>

			<TabsContents>
				{#each filterTabs as tab (tab.key)}
					{@const tabBookings = getBookingsForTab(tab.key)}
					<TabsContent value={tab.key}>
						{#if tabBookings.length === 0}
							<div class="state-box is-compact">
								<p class="state-title">해당 상태의 예매 내역이 없습니다</p>
								<button
									type="button"
									class="reset-filter-btn"
									onclick={() => onSelectFilter('ALL')}
								>
									전체 예매 보기
								</button>
							</div>
						{:else}
							<ul class="ticket-list">
								{#each tabBookings as booking (booking.bookingId)}
									{@const statusMeta = getBookingStatusMeta(booking.status)}
									{@const detail = detailsById[booking.bookingId]}
									{@const currentEntryStatus = detail?.entryStatus ?? booking.entryStatus}
									{@const entryBadge = getEntryStatusBadge(currentEntryStatus, booking.status)}
									{@const opensAt = detail?.entryQrOpensAt ?? booking.entryQrOpensAt}
									{@const closesAt = detail?.entryQrClosesAt ?? booking.entryQrClosesAt}
									{@const checkedInAt = detail?.checkedInAt ?? booking.checkedInAt}
									{@const isExpanded = expandedBookingId === booking.bookingId}
									{@const isDetailLoading = Boolean(loadingDetailIds[booking.bookingId])}
									{@const isCancelling = cancellingBookingId === booking.bookingId}
									{@const cancelable = canCancelBooking(booking, serverNowMs)}
									{@const qrValid = isQrValidFor(booking.bookingId)}
									<li class="ticket-card" class:is-expanded={isExpanded}>
										<!-- 상단 상태 바 -->
										<div class="ticket-card-head">
											<div class="ticket-head-left">
												<span class="status-badge" data-tone={statusMeta.tone}>
													{statusMeta.label}
												</span>
												{#if entryBadge}
													<span class="entry-badge" data-entry-tone={entryBadge.tone}>
														{entryBadge.label}
													</span>
												{/if}
											</div>

											<button
												type="button"
												class="expand-toggle-btn"
												aria-expanded={isExpanded}
												onclick={() => onToggleExpand(booking.bookingId)}
											>
												<span>
													{#if isExpanded}
														접기
													{:else if currentEntryStatus === 'AVAILABLE'}
														입장 QR 보기
													{:else}
														상세 보기
													{/if}
												</span>
												<svg
													class="expand-chevron"
													width="15"
													height="15"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
													stroke-linecap="round"
													stroke-linejoin="round"
													aria-hidden="true"
												>
													<path d="m6 9 6 6 6-6" />
												</svg>
											</button>
										</div>

										<!-- 요약 행 -->
										<div class="ticket-card-summary">
											<button
												type="button"
												class="summary-main-btn"
												onclick={() => onToggleExpand(booking.bookingId)}
											>
												<div class="summary-info">
													<p class="summary-title">{booking.concertTitle}</p>
													<p class="summary-session">
														<span>회차 {formatKstSessionDateTime(booking.startsAt)}</span>
													</p>
													<div class="summary-bottom-row">
														<span class="summary-price">
															{formatTicketPrice(booking.totalPrice)}
														</span>

														{#if currentEntryStatus === 'NOT_OPEN' && opensAt}
															<span class="summary-countdown">
																QR 공개까지 {formatCountdown(getRemainingMs(opensAt))}
															</span>
														{:else if currentEntryStatus === 'AVAILABLE' && closesAt}
															<span class="summary-countdown is-live">
																입장 마감까지 {formatCountdown(getRemainingMs(closesAt))}
															</span>
														{:else if currentEntryStatus === 'CHECKED_IN' && checkedInAt}
															<span class="summary-countdown">
																{formatKstTime(checkedInAt)} 입장 완료
															</span>
														{/if}
													</div>
												</div>
											</button>

											{#if cancelable}
												<div class="summary-actions">
													<button
														type="button"
														class="cancel-ticket-btn"
														disabled={isCancelling}
														onclick={() => onCancelBooking(booking)}
													>
														{#if isCancelling}
															처리 중...
														{:else if booking.status === 'CONFIRMED'}
															예매 취소
														{:else}
															선점 취소
														{/if}
													</button>
												</div>
											{/if}
										</div>

										<!-- 펼침 상세 · 입장 QR 패널 -->
										<div class="ticket-detail-panel" aria-hidden={!isExpanded}>
											<div class="ticket-detail-inner">
												<div class="ticket-detail-content">
													{#if isDetailLoading && !detail}
														<p class="detail-loading">티켓 정보를 불러오는 중입니다...</p>
													{:else}
														<!-- 1) 입장 QR / 입장 상태 영역 -->
														<div class="qr-section" data-entry-status={currentEntryStatus}>
															{#if currentEntryStatus === 'AVAILABLE'}
																{#if qrValid && qrToken}
																	<EntryQrCanvas token={qrToken} size={mobile ? 180 : 196} />

																	<div class="qr-meta">
																		<p class="qr-status-title">입장 QR 코드</p>
																		{#if closesAt}
																			<p class="qr-countdown-line">
																				입장 마감까지
																				<strong class="qr-countdown-val">
																					{formatCountdown(getRemainingMs(closesAt))}
																				</strong>
																				<span class="qr-sub-time">({formatKstTime(closesAt)} 마감)</span>
																			</p>
																		{/if}
																		<p class="qr-hint">
																			{#if qrError}
																				네트워크가 불안정합니다. 현재 QR은 만료 전까지 사용할 수 있습니다.
																			{:else}
																				보안을 위해 QR 코드가 자동으로 갱신됩니다.
																			{/if}
																		</p>
																	</div>
																{:else if qrLoading}
																	<div class="qr-placeholder-box">
																		<p class="qr-status-title">입장 QR을 발급하는 중입니다...</p>
																	</div>
																{:else}
																	<div class="qr-placeholder-box is-error">
																		<p class="qr-status-title">
																			{qrError || 'QR 유효 시간이 만료되었습니다.'}
																		</p>
																		<button
																			type="button"
																			class="qr-retry-btn"
																			onclick={() => onRetryQr(booking.bookingId)}
																		>
																			<RefreshCcwIcon size={14} />
																			<span>다시 시도</span>
																		</button>
																	</div>
																{/if}
															{:else if currentEntryStatus === 'NOT_OPEN'}
																<div class="qr-state-card">
																	<p class="qr-state-eyebrow">QR 공개까지 남은 시간</p>
																	<p class="qr-big-countdown">
																		{opensAt ? formatCountdown(getRemainingMs(opensAt)) : '-'}
																	</p>
																	<p class="qr-hint">
																		입장 QR은 예매한 회차 시작 60분 전
																		{#if opensAt}
																			({formatKstDateTime(opensAt)})
																		{/if}
																		부터 공개됩니다.
																	</p>
																</div>
															{:else if currentEntryStatus === 'CHECKED_IN'}
																<div class="qr-state-card is-checked">
																	<span class="checked-icon" aria-hidden="true">
																		<CheckIcon size={18} />
																	</span>
																	<p class="qr-status-title">입장 완료 · 관람중</p>
																	{#if checkedInAt}
																		<p class="qr-hint">
																			검표 시각 {formatKstDateTime(checkedInAt)}
																		</p>
																	{/if}
																</div>
															{:else if currentEntryStatus === 'CLOSED'}
																<div class="qr-state-card">
																	<p class="qr-status-title">입장 마감</p>
																	<p class="qr-hint">
																		{#if closesAt}
																			입장 마감 시각({formatKstDateTime(closesAt)})이 지나 QR 입장이 종료되었습니다.
																		{:else}
																			입장 가능 시간이 마감되었습니다.
																		{/if}
																	</p>
																</div>
															{:else}
																<div class="qr-state-card">
																	<p class="qr-status-title">{statusMeta.label}</p>
																	<p class="qr-hint">
																		{getUnavailableMessage(booking.status)}
																	</p>
																</div>
															{/if}
														</div>

														<!-- 2) 공연 · 좌석 정보 -->
														{#if detail}
															<div class="detail-block">
																<div class="detail-block-head">
																	<h4 class="detail-block-title">공연 · 좌석 정보</h4>
																	<button
																		type="button"
																		class="concert-link-btn"
																		onclick={() => onOpenConcert(detail.concert.id)}
																	>
																		<span>공연 상세</span>
																		<SquareArrowOutUpRightIcon size={13} />
																	</button>
																</div>

																<dl class="ticket-meta-grid">
																	<div class="meta-pair">
																		<dt>예매 회차</dt>
																		<dd>{formatKstSessionDateTime(detail.concert.startsAt)}</dd>
																	</div>
																	{#if detail.concert.venueName}
																		<div class="meta-pair">
																			<dt>공연장</dt>
																			<dd>{detail.concert.venueName}</dd>
																		</div>
																	{/if}
																	{#if opensAt && closesAt}
																		<div class="meta-pair">
																			<dt>입장 가능 시간</dt>
																			<dd>
																				{formatKstTime(opensAt)} ~ {formatKstTime(closesAt)}
																			</dd>
																		</div>
																	{/if}
																</dl>

																{#if detail.seats && detail.seats.length > 0}
																	<ul class="seat-list">
																		{#each detail.seats as seat (seat.id)}
																			<li class="seat-row">
																				<span class="seat-name">{formatSeatLabel(seat)}</span>
																				<span class="seat-price">
																					{formatTicketPrice(seat.price)}
																				</span>
																			</li>
																		{/each}
																	</ul>
																{/if}
															</div>

															<!-- 3) 예매 · 결제 정보 -->
															<div class="detail-block">
																<h4 class="detail-block-title">예매 정보</h4>
																<dl class="ticket-meta-grid">
																	<div class="meta-pair">
																		<dt>예매번호</dt>
																		<dd class="mono-val">
																			{detail.pgOrderId || `#${detail.bookingId}`}
																		</dd>
																	</div>
																	<div class="meta-pair">
																		<dt>예매일시</dt>
																		<dd>{formatKstDateTime(detail.createdAt)}</dd>
																	</div>
																	<div class="meta-pair">
																		<dt>총 결제 금액</dt>
																		<dd class="strong-val">
																			{formatTicketPrice(detail.totalPrice)}
																		</dd>
																	</div>
																</dl>
																{#if booking.status === 'CONFIRMED' && currentEntryStatus !== 'CHECKED_IN' && currentEntryStatus !== 'CLOSED'}
																	<p class="cancel-policy-note">
																		취소 · 환불은 예매한 회차 시작 24시간 전까지 가능합니다.
																	</p>
																{/if}
															</div>
														{/if}
													{/if}
												</div>
											</div>
										</div>
									</li>
								{/each}
							</ul>
						{/if}
					</TabsContent>
				{/each}
			</TabsContents>
		</Tabs>

		{#if hasNext}
			<div class="load-more-wrap">
				<FdButton
					type="button"
					setting={ACTION_BTN_SETTING}
					class="ticket-fd-btn"
					disabled={isLoadingMore}
					onclick={onLoadMore}
				>
					{isLoadingMore ? '불러오는 중...' : '더 불러오기'}
				</FdButton>
			</div>
		{/if}
	{/if}
</div>

<style>
	.ticket-part {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		width: 100%;
	}

	.ticket-part :global(.ui-tabs.ticket-tabs) {
		gap: 1rem;
	}

	.filter-count {
		font-size: 0.72rem;
		font-variant-numeric: tabular-nums;
		opacity: 0.7;
	}

	/* ── 스켈레톤 ── */
	.skeleton-list {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.ticket-skeleton-card {
		padding: 1.15rem 1.2rem;
		border-radius: 16px;
		background: var(--surface-dim);
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.skel-row-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.skel-lines {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.skel-pill,
	.skel-line {
		display: block;
		height: 14px;
		border-radius: 7px;
		background: var(--surface-2);
		animation: ticket-skel-pulse 1.4s ease-in-out infinite;
	}

	.skel-w-xs {
		width: 68px;
	}
	.skel-w-sm {
		width: 120px;
	}
	.skel-w-md {
		width: 52%;
	}
	.skel-w-lg {
		width: 76%;
	}

	@keyframes ticket-skel-pulse {
		0%,
		100% {
			opacity: 0.55;
		}
		50% {
			opacity: 0.9;
		}
	}

	/* ── 빈 / 에러 상태 ── */
	.state-box {
		padding: 3rem 1.25rem;
		border-radius: 16px;
		background: var(--surface-dim);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		gap: 0.65rem;
	}

	.state-box.is-compact {
		padding: 2.25rem 1.25rem;
	}

	.empty-icon {
		width: 48px;
		height: 48px;
		border-radius: 999px;
		background: var(--surface-1);
		color: var(--muted);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 0.2rem;
	}

	.state-title {
		margin: 0;
		font-size: 0.96rem;
		font-weight: var(--fw-semibold);
		color: var(--white-2);
	}

	.state-desc {
		margin: 0;
		max-width: 340px;
		font-size: 0.84rem;
		color: var(--muted);
		line-height: 1.5;
		word-break: keep-all;
	}

	.state-action {
		margin-top: 0.55rem;
	}

	.reset-filter-btn {
		margin-top: 0.35rem;
		padding: 0.45rem 0.9rem;
		border: var(--thin-border);
		border-radius: 999px;
		background: transparent;
		color: var(--white-2);
		font: inherit;
		font-size: 0.82rem;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.reset-filter-btn:hover {
		background: var(--surface-1);
		color: var(--white);
	}

	/* ── 예매 카드 리스트 ── */
	.ticket-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.ticket-card {
		border-radius: 16px;
		background: var(--surface-dim);
		padding: 1.1rem 1.2rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.ticket-card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding-bottom: 0.75rem;
		border-bottom: var(--thin-border);
	}

	.ticket-head-left {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.45rem;
		min-width: 0;
	}

	.status-badge,
	.entry-badge {
		padding: 0.16rem 0.54rem;
		border-radius: 999px;
		font-size: 0.72rem;
		font-weight: var(--fw-semibold);
		line-height: 1.35;
	}

	.status-badge[data-tone='confirmed'] {
		background: color-mix(in srgb, var(--white) 14%, transparent);
		color: var(--white);
	}

	.status-badge[data-tone='pending'] {
		background: var(--surface-2);
		color: var(--white-2);
	}

	.status-badge[data-tone='cancelled'] {
		background: color-mix(in srgb, var(--toast-error-bg) 70%, transparent);
		color: var(--toast-error-fg);
	}

	.entry-badge[data-entry-tone='available'] {
		background: var(--white);
		color: var(--bg);
	}

	.entry-badge[data-entry-tone='waiting'] {
		background: var(--surface-2);
		color: var(--white-2);
	}

	.entry-badge[data-entry-tone='checked'] {
		background: color-mix(in srgb, var(--toast-success-bg) 80%, transparent);
		color: var(--toast-success-fg);
	}

	.entry-badge[data-entry-tone='closed'],
	.entry-badge[data-entry-tone='muted'] {
		background: var(--surface-1);
		color: var(--muted);
	}

	.expand-toggle-btn {
		padding: 0.25rem 0.45rem;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 0.8rem;
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		flex-shrink: 0;
		cursor: pointer;
		transition:
			color 0.15s ease,
			background-color 0.15s ease;
	}

	.expand-toggle-btn:hover {
		color: var(--white);
		background: color-mix(in srgb, var(--white) 6%, transparent);
	}

	.expand-chevron {
		transition: transform 0.28s cubic-bezier(0.215, 0.61, 0.355, 1);
	}

	.ticket-card.is-expanded .expand-chevron {
		transform: rotate(180deg);
		color: var(--white);
	}

	/* ── 요약 행 ── */
	.ticket-card-summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.9rem;
	}

	.summary-main-btn {
		flex: 1;
		min-width: 0;
		padding: 0;
		border: none;
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.summary-info {
		display: flex;
		flex-direction: column;
		gap: 0.28rem;
	}

	.summary-title {
		margin: 0;
		font-size: 0.98rem;
		font-weight: var(--fw-bold);
		color: var(--white);
		line-height: 1.35;
		word-break: keep-all;
	}

	.summary-session {
		margin: 0;
		font-size: 0.83rem;
		color: var(--fg);
		font-variant-numeric: tabular-nums;
	}

	.summary-bottom-row {
		margin-top: 0.15rem;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.65rem;
	}

	.summary-price {
		font-size: 0.92rem;
		font-weight: var(--fw-bold);
		color: var(--white-2);
		font-variant-numeric: tabular-nums;
	}

	.summary-countdown {
		font-size: 0.78rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.summary-countdown.is-live {
		color: var(--white);
		font-weight: var(--fw-semibold);
	}

	.summary-actions {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.cancel-ticket-btn {
		height: 32px;
		padding: 0 0.78rem;
		border: var(--thin-border);
		border-radius: 9px;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 0.78rem;
		font-weight: var(--fw-medium);
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			border-color 0.15s ease,
			color 0.15s ease;
	}

	.cancel-ticket-btn:hover:not(:disabled) {
		background: color-mix(in srgb, var(--toast-error-bg) 70%, transparent);
		border-color: color-mix(in srgb, var(--toast-error-fg) 35%, transparent);
		color: var(--toast-error-fg);
	}

	.cancel-ticket-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* ── 펼침 상세 · 입장 QR 패널 ── */
	.ticket-detail-panel {
		display: grid;
		grid-template-rows: 0fr;
		opacity: 0;
		transition:
			grid-template-rows 0.3s cubic-bezier(0.215, 0.61, 0.355, 1),
			opacity 0.24s ease;
	}

	.ticket-card.is-expanded .ticket-detail-panel {
		grid-template-rows: 1fr;
		opacity: 1;
	}

	.ticket-detail-inner {
		overflow: hidden;
		min-height: 0;
	}

	.ticket-detail-content {
		padding-top: 1rem;
		border-top: var(--thin-border);
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
	}

	.detail-loading {
		margin: 0;
		font-size: 0.83rem;
		color: var(--muted);
	}

	/* ── QR 섹션 ── */
	.qr-section {
		padding: 1.25rem 1.1rem;
		border-radius: 14px;
		background: var(--surface-1);
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: 0.9rem;
	}

	.qr-meta,
	.qr-state-card,
	.qr-placeholder-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
	}

	.qr-state-eyebrow {
		margin: 0;
		font-size: 0.78rem;
		color: var(--muted);
	}

	.qr-big-countdown {
		margin: 0;
		font-size: 1.55rem;
		font-weight: var(--fw-bold);
		color: var(--white);
		letter-spacing: 0.02em;
		font-variant-numeric: tabular-nums;
	}

	.qr-status-title {
		margin: 0;
		font-size: 0.94rem;
		font-weight: var(--fw-semibold);
		color: var(--white);
	}

	.qr-countdown-line {
		margin: 0;
		font-size: 0.84rem;
		color: var(--fg);
		display: inline-flex;
		align-items: baseline;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.35rem;
	}

	.qr-countdown-val {
		color: var(--white);
		font-weight: var(--fw-bold);
		font-variant-numeric: tabular-nums;
	}

	.qr-sub-time {
		font-size: 0.76rem;
		color: var(--muted);
	}

	.qr-hint {
		margin: 0;
		max-width: 340px;
		font-size: 0.78rem;
		color: var(--muted);
		line-height: 1.45;
		word-break: keep-all;
	}

	.checked-icon {
		width: 36px;
		height: 36px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--toast-success-bg) 80%, transparent);
		color: var(--toast-success-fg);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 0.15rem;
	}

	.qr-retry-btn {
		margin-top: 0.35rem;
		height: 34px;
		padding: 0 0.9rem;
		border: var(--thin-border);
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--white);
		font: inherit;
		font-size: 0.8rem;
		font-weight: var(--fw-semibold);
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.qr-retry-btn:hover {
		background: var(--surface-3);
	}

	/* ── 상세 정보 블럭 ── */
	.detail-block {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.detail-block-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.detail-block-title {
		margin: 0;
		font-size: 0.8rem;
		font-weight: var(--fw-semibold);
		color: var(--muted);
	}

	.concert-link-btn {
		padding: 0.2rem 0.45rem;
		border: none;
		border-radius: 7px;
		background: transparent;
		color: var(--white-2);
		font: inherit;
		font-size: 0.78rem;
		display: inline-flex;
		align-items: center;
		gap: 0.28rem;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.concert-link-btn:hover {
		background: color-mix(in srgb, var(--white) 8%, transparent);
		color: var(--white);
	}

	.ticket-meta-grid {
		margin: 0;
		padding: 0.75rem 0.95rem;
		border-radius: 12px;
		background: var(--surface-1);
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.meta-pair {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.82rem;
	}

	.meta-pair dt {
		color: var(--muted);
		flex-shrink: 0;
	}

	.meta-pair dd {
		margin: 0;
		color: var(--fg);
		text-align: right;
		word-break: break-all;
	}

	.meta-pair dd.mono-val {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.78rem;
		color: var(--white-2);
	}

	.meta-pair dd.strong-val {
		font-weight: var(--fw-bold);
		color: var(--white);
		font-variant-numeric: tabular-nums;
	}

	.seat-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.seat-row {
		padding: 0.6rem 0.85rem;
		border-radius: 10px;
		background: var(--surface-1);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.84rem;
	}

	.seat-name {
		color: var(--white-2);
		font-weight: var(--fw-medium);
	}

	.seat-price {
		color: var(--white);
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
	}

	.cancel-policy-note {
		margin: 0.1rem 0 0;
		font-size: 0.76rem;
		color: var(--muted);
	}

	.load-more-wrap {
		display: flex;
		justify-content: center;
		padding-top: 0.35rem;
	}

	.ticket-part :global(.fd-btn.ticket-fd-btn) {
		height: 38px;
		padding: 0 1.25rem;
		font-size: 0.85rem;
		font-weight: var(--fw-semibold);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.ticket-part.is-mobile .ticket-card {
		padding: 1rem;
	}

	.ticket-part.is-mobile .ticket-card-summary {
		flex-direction: column;
		align-items: stretch;
		gap: 0.75rem;
	}

	.ticket-part.is-mobile .summary-actions {
		justify-content: flex-end;
	}

	@media (prefers-reduced-motion: reduce) {
		.expand-chevron,
		.ticket-detail-panel {
			transition: none;
		}
	}
</style>
