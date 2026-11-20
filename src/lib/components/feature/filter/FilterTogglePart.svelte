<script lang="ts">
	import { isMobile } from '#lib/stores';
	import FilterPartCard from './FilterPartCard.svelte';

	interface Props {
		title?: string;
		description?: string;
		checked?: boolean;
		onchange?: (checked: boolean) => void;
		class?: string;
	}

	let {
		title = '품절 제외',
		description = '',
		checked = $bindable(false),
		onchange,
		class: klass = ''
	}: Props = $props();

	const mobile = $derived(isMobile.current);

	function handleToggle() {
		const next = !checked;
		checked = next;
		onchange?.(next);
	}
</script>

<FilterPartCard class="toggle-part {klass}" showHeader={false}>
	<button
		type="button"
		role="switch"
		aria-checked={checked}
		aria-label={title}
		class="filter-toggle-row"
		class:is-checked={checked}
		class:is-mobile={mobile}
		onclick={handleToggle}
	>
		<span class="toggle-copy">
			<span class="toggle-title">{title}</span>
			{#if description}
				<span class="toggle-desc">{description}</span>
			{/if}
		</span>

		<span class="toggle-track" aria-hidden="true">
			<span class="toggle-thumb"></span>
		</span>
	</button>
</FilterPartCard>

<style>
	:global(.filter-part-card.toggle-part .part-body) {
		flex: 1 1 auto;
		justify-content: center;
	}

	.filter-toggle-row {
		appearance: none;
		border: none;
		background: transparent;
		padding: 0.08rem 0.25rem;
		margin: 0;
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		cursor: pointer;
		text-align: left;
		color: inherit;
		font-family: inherit;
		-webkit-tap-highlight-color: transparent;
	}

	.filter-toggle-row:focus-visible {
		outline: 2px solid var(--muted);
		outline-offset: 4px;
		border-radius: 10px;
	}

	.toggle-copy {
		display: inline-flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 0.45rem;
		min-width: 0;
	}

	.toggle-title {
		font-size: 0.82rem;
		font-weight: var(--fw-semibold);
		line-height: 1.25rem;
		letter-spacing: -0.01em;
		color: var(--muted);
		transition: color 0.2s ease;
	}

	.filter-toggle-row.is-checked .toggle-title,
	.filter-toggle-row:hover .toggle-title {
		color: var(--fg);
	}

	.toggle-desc {
		font-size: 0.74rem;
		font-weight: var(--fw-regular);
		line-height: 1.15rem;
		letter-spacing: -0.01em;
		color: var(--muted);
		opacity: 0.75;
	}

	.toggle-track {
		position: relative;
		flex: 0 0 auto;
		width: 40px;
		height: 22px;
		border-radius: 999px;
		background: var(--surface-3);
		border: 1px solid var(--line);
		box-sizing: border-box;
		transition:
			background-color 0.24s ease,
			border-color 0.24s ease;
	}

	.filter-toggle-row:hover .toggle-track {
		background: var(--surface-4);
	}

	.filter-toggle-row.is-checked .toggle-track {
		background: var(--white);
		border-color: var(--white);
	}

	.toggle-thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 16px;
		height: 16px;
		border-radius: 999px;
		background: var(--muted);
		transform: translate3d(0, 0, 0);
		transition:
			transform 0.28s cubic-bezier(0.32, 0.72, 0, 1),
			background-color 0.24s ease;
	}

	.filter-toggle-row.is-checked .toggle-thumb {
		background: var(--bg);
		transform: translate3d(18px, 0, 0);
	}

	.filter-toggle-row.is-mobile .toggle-title {
		font-size: 0.8rem;
	}

	.filter-toggle-row.is-mobile .toggle-desc {
		font-size: 0.72rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.toggle-title,
		.toggle-track,
		.toggle-thumb {
			transition: none;
		}
	}
</style>
