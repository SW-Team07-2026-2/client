<script lang="ts">
	import type { MainSectionDescriptor } from '../../2_main_section/logic/sectionRegistry';

	export type ConcertViewMode = 'grid' | 'calendar';

	interface Props {
		section: MainSectionDescriptor;
		active: boolean;
	}

	let { section, active }: Props = $props();

	let viewMode = $state<ConcertViewMode>('grid');
	const placeholderCards = Array.from({ length: 12 }, (_, idx) => idx + 1);
</script>

<!-- 4_category / concert: 공연 목록 그리드 + 달력(캘린더) 뷰 전환 진입점 -->
<section
	class="concert-category"
	data-category="concert"
	data-view-mode={viewMode}
	data-active={active ? 'true' : 'false'}
	aria-label={section.label}
>
	<div class="concert-mode-bar" role="tablist" aria-label="공연 보기 방식">
		<button
			type="button"
			role="tab"
			class="concert-mode-btn"
			class:is-active={viewMode === 'grid'}
			aria-selected={viewMode === 'grid'}
			onclick={() => (viewMode = 'grid')}
		>
			목록 보기
		</button>
		<button
			type="button"
			role="tab"
			class="concert-mode-btn"
			class:is-active={viewMode === 'calendar'}
			aria-selected={viewMode === 'calendar'}
			onclick={() => (viewMode = 'calendar')}
		>
			달력 보기
		</button>
	</div>

	{#if viewMode === 'grid'}
		<div class="concert-grid-shell">
			{#each placeholderCards as card (card)}
				<div class="concert-card-shell">
					<span>공연 #{card}</span>
				</div>
			{/each}
		</div>
	{:else}
		<div class="concert-calendar-shell">
			<p class="calendar-title">공연 달력 화면 (구현 예정)</p>
			<p class="calendar-desc">월별 공연 일정을 달력에서 한눈에 탐색할 수 있는 영역입니다.</p>
		</div>
	{/if}
</section>

<style>
	.concert-category {
		width: 100%;
	}

	.concert-mode-bar {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.25rem;
		margin-bottom: 1rem;
		border-radius: 999px;
		background: var(--surface);
		border: var(--thin-border);
	}

	.concert-mode-btn {
		height: 32px;
		padding: 0 0.9rem;
		border: none;
		border-radius: 999px;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 0.82rem;
		font-weight: var(--fw-medium);
		cursor: pointer;
		transition:
			background-color 0.18s ease,
			color 0.18s ease;
	}

	.concert-mode-btn.is-active {
		background: var(--white);
		color: var(--bg);
		font-weight: var(--fw-semibold);
	}

	.concert-grid-shell {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
		gap: 1.1rem;
	}

	.concert-card-shell {
		aspect-ratio: 3 / 4;
		border-radius: 18px;
		background: var(--surface);
		border: var(--thin-border);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--muted);
		font-size: 0.88rem;
	}

	.concert-calendar-shell {
		min-height: 360px;
		padding: 2rem 1.25rem;
		border-radius: 20px;
		background: var(--surface);
		border: var(--thin-border);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		text-align: center;
	}

	.calendar-title {
		margin: 0;
		font-size: 1rem;
		font-weight: var(--fw-semibold);
		color: var(--white);
	}

	.calendar-desc {
		margin: 0;
		font-size: 0.86rem;
		color: var(--muted);
	}
</style>
