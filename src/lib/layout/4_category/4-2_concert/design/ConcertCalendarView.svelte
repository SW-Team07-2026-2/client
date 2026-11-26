<script lang="ts">
	import {
		resolveConcertPosterUrl,
		type CatalogConcert
	} from '#lib/common/catalog/concerts';
	import { LoadingSpinner } from '#lib/dedicated/loading';
	import type {
		ConcertCalendarDay,
		ConcertSelectPayload
	} from '../logic/concertCategory.svelte';

	interface Props {
		month: string;
		days: readonly ConcertCalendarDay[];
		loading: boolean;
		errorMessage: string | null;
		selectedDate: string | null;
		onStepMonth: (delta: number) => void;
		onSelectDate: (date: string | null) => void;
		onSelectConcert: (payload: ConcertSelectPayload) => void;
	}

	let {
		month,
		days,
		loading,
		errorMessage,
		selectedDate,
		onStepMonth,
		onSelectDate,
		onSelectConcert
	}: Props = $props();

	const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

	interface CalendarCell {
		key: string;
		dayNum: number | null;
		dateStr: string | null;
		concerts: CatalogConcert[];
	}

	const monthLabel = $derived.by(() => {
		const [y, m] = month.split('-');
		return y && m ? `${y}년 ${Number(m)}월` : month;
	});

	const concertsByDate = $derived.by(() => {
		const map = new Map<string, CatalogConcert[]>();
		for (const d of days) {
			map.set(d.date, d.concerts);
		}
		return map;
	});

	const cells = $derived.by<CalendarCell[]>(() => {
		const [yStr, mStr] = month.split('-');
		const y = Number(yStr);
		const m = Number(mStr);
		if (!Number.isFinite(y) || !Number.isFinite(m)) return [];

		const firstDow = new Date(y, m - 1, 1).getDay();
		const lastDay = new Date(y, m, 0).getDate();
		const result: CalendarCell[] = [];

		for (let i = 0; i < firstDow; i++) {
			result.push({ key: `pad-start-${i}`, dayNum: null, dateStr: null, concerts: [] });
		}
		for (let d = 1; d <= lastDay; d++) {
			const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
			result.push({
				key: dateStr,
				dayNum: d,
				dateStr,
				concerts: concertsByDate.get(dateStr) ?? []
			});
		}
		return result;
	});

	const visibleConcerts = $derived.by<CatalogConcert[]>(() => {
		if (selectedDate) {
			return concertsByDate.get(selectedDate) ?? [];
		}
		return days.flatMap((d) => d.concerts);
	});
</script>

<!-- 월별 공연 달력 뷰 (월 이동 · 날짜별 공연 표시 · 하단 일정 리스트, 순수 렌더링) -->
<div class="concert-calendar">
	<div class="cal-header">
		<button
			type="button"
			class="cal-nav-btn"
			aria-label="이전 달"
			onclick={() => onStepMonth(-1)}
		>
			<svg
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="m15 18-6-6 6-6" />
			</svg>
		</button>

		<h2 class="cal-month-title">{monthLabel}</h2>

		<button
			type="button"
			class="cal-nav-btn"
			aria-label="다음 달"
			onclick={() => onStepMonth(1)}
		>
			<svg
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="m9 18 6-6-6-6" />
			</svg>
		</button>
	</div>

	<div class="cal-weekdays" aria-hidden="true">
		{#each WEEKDAYS as wd (wd)}
			<span>{wd}</span>
		{/each}
	</div>

	{#if loading && days.length === 0}
		<div class="cal-state-box" role="status" aria-live="polite">
			<LoadingSpinner size={22} />
		</div>
	{:else if errorMessage}
		<div class="cal-state-box" role="alert">
			<p class="cal-state-text">{errorMessage}</p>
		</div>
	{:else}
		<div class="cal-grid">
			{#each cells as cell (cell.key)}
				{#if cell.dayNum === null}
					<div class="cal-cell is-empty" aria-hidden="true"></div>
				{:else}
					{@const hasEvents = cell.concerts.length > 0}
					{@const isSelected = selectedDate === cell.dateStr}
					<button
						type="button"
						class="cal-cell"
						class:has-events={hasEvents}
						class:is-selected={isSelected}
						disabled={!hasEvents}
						onclick={() => onSelectDate(cell.dateStr)}
					>
						<span class="cal-day-num">{cell.dayNum}</span>
						{#if hasEvents}
							<span class="cal-event-dot" aria-label={`${cell.concerts.length}건`}>
								{cell.concerts.length}
							</span>
						{/if}
					</button>
				{/if}
			{/each}
		</div>

		<div class="cal-agenda">
			<div class="agenda-head">
				<h3 class="agenda-title">
					{selectedDate ? `${selectedDate.replace(/-/g, '.')} 공연` : `${monthLabel} 전체 일정`}
				</h3>
				{#if selectedDate}
					<button type="button" class="agenda-reset-btn" onclick={() => onSelectDate(null)}>
						전체 보기
					</button>
				{/if}
			</div>

			{#if visibleConcerts.length === 0}
				<p class="agenda-empty">예정된 공연 일정이 없습니다.</p>
			{:else}
				<ul class="agenda-list">
					{#each visibleConcerts as concert (concert.id)}
						{@const poster = resolveConcertPosterUrl(concert)}
						<li>
							<button
								type="button"
								class="agenda-item"
								onclick={() => onSelectConcert({ concert })}
							>
								<div class="agenda-thumb">
									{#if poster}
										<img src={poster} alt={concert.title} crossorigin="anonymous" loading="lazy" />
									{/if}
								</div>
								<div class="agenda-info">
									<span class="agenda-date">{concert.dateText}</span>
									<span class="agenda-name">{concert.title}</span>
									<span class="agenda-meta">
										{[concert.artistName, concert.venue].filter(Boolean).join(' · ')}
									</span>
								</div>
								{#if concert.status}
									<span class="agenda-status">{concert.status}</span>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>

<style>
	.concert-calendar {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.cal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.4rem 0.25rem;
	}

	.cal-month-title {
		margin: 0;
		font-size: 1.15rem;
		font-weight: var(--fw-bold);
		color: var(--white);
		letter-spacing: -0.02em;
	}

	.cal-nav-btn {
		width: 36px;
		height: 36px;
		border: none;
		border-radius: 10px;
		background: var(--surface);
		color: var(--fg);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.cal-nav-btn:hover {
		background: var(--surface-2);
		color: var(--white);
	}

	.cal-weekdays {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		text-align: center;
		font-size: 0.78rem;
		font-weight: var(--fw-semibold);
		color: var(--muted);
		padding-bottom: 0.35rem;
	}

	.cal-grid {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 0.4rem;
	}

	.cal-cell {
		min-height: 54px;
		padding: 0.45rem 0.35rem;
		border: none;
		border-radius: 12px;
		background: var(--surface);
		color: var(--muted);
		font: inherit;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		gap: 0.2rem;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.cal-cell.is-empty {
		background: transparent;
	}

	.cal-cell.has-events {
		color: var(--white);
		cursor: pointer;
	}

	.cal-cell.has-events:hover {
		background: var(--surface-2);
	}

	.cal-cell.is-selected {
		background: var(--white-2);
		color: var(--bg);
	}

	.cal-day-num {
		font-size: 0.84rem;
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
	}

	.cal-event-dot {
		min-width: 18px;
		height: 18px;
		padding: 0 0.3rem;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--white-2);
		font-size: 0.68rem;
		font-weight: var(--fw-bold);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.cal-cell.is-selected .cal-event-dot {
		background: var(--bg);
		color: var(--white);
	}

	.cal-state-box {
		min-height: 220px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.cal-state-text {
		margin: 0;
		font-size: 0.9rem;
		color: var(--muted);
	}

	.cal-agenda {
		margin-top: 0.5rem;
		padding-top: 1.25rem;
		border-top: var(--thin-border);
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.agenda-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.agenda-title {
		margin: 0;
		font-size: 0.98rem;
		font-weight: var(--fw-bold);
		color: var(--white);
	}

	.agenda-reset-btn {
		padding: 0.25rem 0.55rem;
		border: none;
		border-radius: 8px;
		background: var(--surface);
		color: var(--muted);
		font: inherit;
		font-size: 0.78rem;
		cursor: pointer;
	}

	.agenda-reset-btn:hover {
		color: var(--white);
	}

	.agenda-empty {
		margin: 0;
		padding: 1.5rem 0;
		text-align: center;
		font-size: 0.88rem;
		color: var(--muted);
	}

	.agenda-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.agenda-item {
		width: 100%;
		padding: 0.75rem;
		border: none;
		border-radius: 14px;
		background: var(--surface);
		color: inherit;
		font: inherit;
		text-align: left;
		display: flex;
		align-items: center;
		gap: 0.85rem;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.agenda-item:hover {
		background: var(--surface-2);
	}

	.agenda-thumb {
		width: 48px;
		height: 64px;
		border-radius: 8px;
		overflow: hidden;
		background: var(--surface-2);
		flex-shrink: 0;
	}

	.agenda-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.agenda-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.18rem;
	}

	.agenda-date {
		font-size: 0.74rem;
		font-weight: var(--fw-semibold);
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.agenda-name {
		font-size: 0.94rem;
		font-weight: var(--fw-bold);
		color: var(--white);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.agenda-meta {
		font-size: 0.8rem;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.agenda-status {
		flex-shrink: 0;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--white-2);
		font-size: 0.74rem;
		font-weight: var(--fw-semibold);
	}
</style>
