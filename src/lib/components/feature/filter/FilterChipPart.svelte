<script lang="ts">
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
		showHeader = true,
		showCount = true,
		onchange,
		class: klass = ''
	}: Props = $props();

	const mobile = $derived(isMobile.current);
	const selectedSet = $derived(new Set(selected));

	function handleToggle(val: string, nextChecked: boolean) {
		let next: string[];
		if (multiple) {
			if (nextChecked) {
				next = selectedSet.has(val) ? selected : [...selected, val];
			} else {
				next = selected.filter((v) => v !== val);
			}
		} else {
			next = nextChecked ? [val] : [];
		}
		selected = next;
		onchange?.(next);
	}

	function handleReset() {
		if (selected.length === 0) return;
		selected = [];
		onchange?.([]);
	}
</script>

<FilterPartCard
	class="chip-part {klass}"
	{title}
	{showHeader}
	{showCount}
	activeCount={selected.length}
	onReset={handleReset}
>
	<div class="filter-chip-list" class:is-mobile={mobile}>
		{#each items as item, idx (item.value)}
			{#if idx > 0 && item.group && item.group !== items[idx - 1].group}
				<span class="filter-chip-divider" aria-hidden="true"></span>
			{/if}
			<FdCheckButton
				{...(item.isProvince ? FILTER_PROVINCE_CHIP_STYLE_PROPS : FILTER_CHIP_STYLE_PROPS)}
				checked={selectedSet.has(item.value)}
				onchange={(next) => handleToggle(item.value, next)}
			>
				{item.label}
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
</style>
