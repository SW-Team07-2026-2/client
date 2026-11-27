<script lang="ts">
	import type { Snippet } from 'svelte';
	import CheckIcon from '#lib/common/design/icon/CheckIcon.svelte';
	import FdCheckButton from '#lib/common/design/fluid/FdCheckButton.svelte';
	import { FluidSetting } from '#lib/common/type/fluid';
	import type { FilterOption } from '#lib/common/type/filterOptions';
	import { isMobile } from '#lib/common/logic';
	import FilterPartCard from './FilterPartCard.svelte';

	const FILTER_CHIP_BASE_SETTING = new FluidSetting({
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
	});

	const FILTER_CHIP_ACTIVE_SETTING = {
		layerGap: 2.5,
		waveAmp: 2.6,
		waveLength: 60,
		spin: 1.35
	} as const;

	const FILTER_CHIP_STYLE_PROPS = {
		class: 'content-filter-chip',
		setting: FILTER_CHIP_BASE_SETTING,
		activeSetting: FILTER_CHIP_ACTIVE_SETTING,
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

	const FILTER_PROVINCE_CHIP_STYLE_PROPS = {
		...FILTER_CHIP_STYLE_PROPS,
		class: 'content-filter-chip is-province',
		color: 'var(--surface-dim)',
		hoverColor: 'var(--surface-3)',
		pressColor: 'var(--surface-4)',
		waveColor: 'var(--line-wave)',
		textColor: 'var(--fg)',
		borderWidth: 1,
		borderColor: 'var(--line)',
		hoverBorderColor: 'var(--muted)',
		pressBorderColor: 'var(--muted)',
		activeBorderWidth: 1,
		activeBorderColor: 'var(--white-2)',
		activeHoverBorderColor: 'var(--white)',
		activePressBorderColor: 'var(--white-3)'
	} as const;

	interface Props {
		title: string;
		items: readonly FilterOption[];
		selected?: string[];
		multiple?: boolean;
		showAll?: boolean;
		allLabel?: string;
		showHeader?: boolean;
		showCount?: boolean;
		onchange?: (selected: string[]) => void;
		/** 칩 목록 하단에 구분선과 함께 삽입할 보조 컨트롤 슬롯 */
		footer?: Snippet;
		class?: string;
	}

	let {
		title,
		items = [],
		selected = $bindable<string[]>([]),
		multiple = true,
		showAll = true,
		allLabel = '전체',
		showHeader = true,
		showCount = false,
		onchange,
		footer,
		class: klass = ''
	}: Props = $props();

	const mobile = $derived(isMobile.current);
	const selectedSet = $derived(new Set(selected));
	const isAllSelected = $derived(
		selected.length === 0 ||
			(items.length > 0 && items.every((item) => selectedSet.has(item.value)))
	);

	function handleAllToggle() {
		if (selected.length === 0) return;
		selected = [];
		onchange?.([]);
	}

	function handleToggle(val: string, nextChecked: boolean) {
		let next: string[];
		if (multiple) {
			if (nextChecked) {
				next = selectedSet.has(val) ? selected : [...selected, val];
			} else {
				next = selected.filter((v) => v !== val);
			}
			// 모든 개별 칩이 선택되면 사실상 '전체' 상태이므로 []로 정규화
			if (items.length > 0 && items.every((item) => next.includes(item.value))) {
				next = [];
			}
		} else {
			next = nextChecked ? [val] : [];
		}
		selected = next;
		onchange?.(next);
	}
</script>

{#snippet chipContent(label: string, isChecked: boolean)}
	<span class="chip-inner">
		<span class="chip-check-slot" class:is-checked={isChecked} aria-hidden="true">
			<span class="chip-check-clip">
				<CheckIcon size={13} strokeWidth={2.6} hovered={isChecked} />
			</span>
		</span>
		<span class="chip-label">{label}</span>
	</span>
{/snippet}

<FilterPartCard
	class="chip-part {klass}"
	{title}
	{showHeader}
	showCount={showCount && !showAll}
	activeCount={selected.length}
>
	<div class="filter-chip-list" class:is-mobile={mobile}>
		{#if showAll}
			<FdCheckButton
				{...FILTER_CHIP_STYLE_PROPS}
				preventAutoToggle
				checked={isAllSelected}
				onchange={handleAllToggle}
			>
				{@render chipContent(allLabel, isAllSelected)}
			</FdCheckButton>
			{#if items.length > 0}
				<span class="filter-chip-divider" aria-hidden="true"></span>
			{/if}
		{/if}
		{#each items as item, idx (item.value)}
			{@const isItemChecked = selectedSet.has(item.value)}
			{#if idx > 0 && item.group && item.group !== items[idx - 1].group}
				<span class="filter-chip-divider" aria-hidden="true"></span>
			{/if}
			<FdCheckButton
				{...(item.isProvince ? FILTER_PROVINCE_CHIP_STYLE_PROPS : FILTER_CHIP_STYLE_PROPS)}
				preventAutoToggle
				checked={isItemChecked}
				onchange={(next) => handleToggle(item.value, next)}
			>
				{@render chipContent(item.label, isItemChecked)}
			</FdCheckButton>
		{/each}
	</div>

	{#if footer}
		<div class="filter-chip-footer">
			{@render footer()}
		</div>
	{/if}
</FilterPartCard>

<style>
	.filter-chip-list {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0;
	}

	.filter-chip-list.is-mobile {
		margin-inline: -2px;
	}

	.filter-chip-divider {
		display: inline-block;
		width: 1px;
		height: 1.05rem;
		margin: 0 0.25rem;
		background: var(--line);
		flex-shrink: 0;
	}

	.filter-chip-list.is-mobile .filter-chip-divider {
		margin: 0 0.15rem;
		height: 0.95rem;
	}

	.filter-chip-footer {
		margin-top: 0.55rem;
		padding-top: 0.55rem;
		border-top: var(--thin-border);
	}

	:global(.fd-wrap .fd-body .fd-check-btn.content-filter-chip) {
		padding: 0.36rem 0.86rem;
		font-size: 0.84rem;
		font-weight: 500;
		letter-spacing: -0.01em;
		line-height: 1.3;
		transition: color 0.28s cubic-bezier(0.22, 1, 0.36, 1);
	}

	:global(.fd-wrap .fd-body .fd-check-btn.content-filter-chip.is-province) {
		font-weight: 600;
	}

	:global(.fd-wrap:hover .fd-body:not([data-checked]) .fd-check-btn.content-filter-chip) {
		color: var(--fg);
	}

	:global(.fd-wrap .fd-body[data-checked] .fd-check-btn.content-filter-chip) {
		color: var(--bg);
		font-weight: 600;
	}

	.chip-inner {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		white-space: nowrap;
	}

	.chip-check-slot {
		display: inline-grid;
		grid-template-columns: 0fr;
		align-items: center;
		margin-right: 0;
		opacity: 0;
		transform: scale(0.7);
		transform-origin: center;
		transition:
			grid-template-columns 0.34s cubic-bezier(0.22, 1, 0.36, 1),
			margin-right 0.34s cubic-bezier(0.22, 1, 0.36, 1),
			opacity 0.22s ease,
			transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.chip-check-slot.is-checked {
		grid-template-columns: 1fr;
		margin-right: 0.34rem;
		opacity: 1;
		transform: scale(1);
	}

	.chip-check-clip {
		min-width: 0;
		overflow: hidden;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.chip-label {
		display: inline-block;
	}

	@media (prefers-reduced-motion: reduce) {
		.chip-check-slot {
			transition: none;
		}
	}
</style>
