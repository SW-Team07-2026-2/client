<script lang="ts">
	import CheckIcon from '#lib/components/ui/CheckIcon.svelte';
	import FdCheckButton from '#lib/components/ui/FdCheckButton.svelte';
	import {
		FILTER_CHIP_STYLE_PROPS,
		FILTER_PROVINCE_CHIP_STYLE_PROPS,
		type FilterOption
	} from '#lib/config/filter';
	import { isMobile } from '#lib/stores';
	import FilterPartCard from './FilterPartCard.svelte';

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
