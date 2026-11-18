<script lang="ts">
	import { GENRES, type GenreCode } from '#lib/config/genre';
	import { isMobile } from '#lib/stores';
	import FdCheckButton from '../ui/FdCheckButton.svelte';

	export interface FilterOption {
		value: string;
		label: string;
	}

	interface Props {
		/** 필터 항목 목록 (미지정 시 공식 23개 GENRES 사용) */
		items?: readonly FilterOption[];
		/** 선택된 값 목록 (빈 배열일 때 '전체' 선택 상태, 양방향 바인딩) */
		selected?: string[];
		/** 다중 선택 허용 여부 (기본값: true — 여러 항목 선택 가능) */
		multiple?: boolean;
		/** 접근성 라벨 제목 (기본값: '장르') */
		title?: string;
		/** '전체' 버튼 라벨 (기본값: '전체') */
		allLabel?: string;
		/** 선택 변경 콜백 */
		onchange?: (selected: string[]) => void;
		/** '전체' 복귀 콜백 */
		onreset?: () => void;
		/** 추가 클래스 */
		class?: string;
	}

	let {
		items = GENRES,
		selected = $bindable<string[]>([]),
		multiple = true,
		title = '장르',
		allLabel = '전체',
		onchange,
		onreset,
		class: klass = ''
	}: Props = $props();

	const mobile = $derived(isMobile.current);

	// selected가 비어 있으면 '전체'가 항상 선택 상태 유지
	let allChecked = $state(true);
	$effect(() => {
		allChecked = selected.length === 0;
	});

	const chipBaseSetting = {
		radius: 999,
		reach: 28,
		bulge: 5,
		bulgeWidth: 18,
		layers: 2,
		layerGap: 2.2,
		waveAmp: 2.2,
		waveLength: 60,
		spin: 1.0,
		inset: 7
	} as const;

	const chipActiveSetting = {
		layerGap: 2.5,
		waveAmp: 2.6,
		waveLength: 60,
		spin: 1.35
	} as const;

	const chipStyleProps = {
		class: 'content-filter-chip',
		setting: chipBaseSetting,
		activeSetting: chipActiveSetting,
		color: 'var(--surface-3)',
		hoverColor: 'var(--surface-4)',
		pressColor: 'var(--line)',
		waveColor: 'var(--surface-4)',
		textColor: 'var(--muted)',
		borderWidth: 0,
		activeColor: 'var(--white-2)',
		activeHoverColor: 'var(--white)',
		activePressColor: 'var(--white-3)',
		activeWaveColor: 'var(--white-3)',
		activeTextColor: 'var(--bg)',
		activeBorderWidth: 0
	} as const;

	function handleAllToggle() {
		allChecked = true;
		if (selected.length > 0) {
			selected = [];
			onchange?.([]);
			onreset?.();
		}
	}

	function handleToggle(val: string, nextChecked: boolean) {
		let next: string[];
		if (multiple) {
			if (nextChecked) {
				next = selected.includes(val) ? selected : [...selected, val];
			} else {
				next = selected.filter((v) => v !== val);
			}
		} else {
			next = nextChecked ? [val] : [];
		}
		selected = next;
		onchange?.(next);
	}

	export function isSelected(val: GenreCode | string): boolean {
		return selected.includes(val);
	}
</script>

<div
	class="content-filter-area {klass}"
	class:is-mobile={mobile}
	role="region"
	aria-label="{title} 필터"
>
	<div class="filter-chip-list">
		<FdCheckButton
			{...chipStyleProps}
			color="var(--surface-dim)"
			hoverColor="var(--surface-dim)"
			pressColor="var(--surface-3)"
			waveColor="var(--line-wave)"
			borderWidth={1}
			borderColor="var(--line)"
			hoverBorderColor="var(--muted)"
			pressBorderColor="var(--muted)"
			bind:checked={allChecked}
			onchange={handleAllToggle}
		>
			{allLabel}
		</FdCheckButton>

		{#each items as item (item.value)}
			{@const isChecked = selected.includes(item.value)}
			<FdCheckButton
				{...chipStyleProps}
				checked={isChecked}
				onchange={(next) => handleToggle(item.value, next)}
			>
				{item.label}
			</FdCheckButton>
		{/each}
	</div>
</div>

<style>
	.content-filter-area {
		width: 100%;
		padding: 0.75rem 0.9rem;
		border: none;
		border-radius: 16px;
		background: var(--surface-dim);
		box-sizing: border-box;
	}

	.content-filter-area.is-mobile {
		padding: 0.65rem 0.75rem;
		border-radius: 14px;
	}

	.filter-chip-list {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0;
	}

	.content-filter-area.is-mobile .filter-chip-list {
		margin-inline: -2px;
	}

	:global(.fd-wrap .fd-body .fd-check-btn.content-filter-chip) {
		padding: 0.36rem 0.86rem;
		font-size: 0.84rem;
		font-weight: 500;
		letter-spacing: -0.01em;
		line-height: 1.3;
		transition: color 0.18s ease;
	}

	:global(.fd-wrap:hover .fd-body:not([data-checked]) .fd-check-btn.content-filter-chip) {
		color: var(--fg);
	}

	:global(.fd-wrap .fd-body[data-checked] .fd-check-btn.content-filter-chip) {
		color: var(--bg);
		font-weight: 600;
	}
</style>
