<script lang="ts">
	import FdSwitch from '#lib/common/design/fluid/FdSwitch.svelte';
	import { isMobile } from '#lib/common/logic';
	import FilterPartCard from './FilterPartCard.svelte';

	interface Props {
		title?: string;
		description?: string;
		checked?: boolean;
		paused?: boolean;
		/** true면 외곽 FilterPartCard 없이 다른 필터 파트 내부에 인라인으로 삽입 */
		embedded?: boolean;
		onchange?: (checked: boolean) => void;
		class?: string;
	}

	let {
		title = '품절 제외',
		description = '',
		checked = $bindable(false),
		paused = false,
		embedded = false,
		onchange,
		class: klass = ''
	}: Props = $props();

	const mobile = $derived(isMobile.current);

	function handleToggle() {
		const next = !checked;
		checked = next;
		onchange?.(next);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			handleToggle();
		}
	}
</script>

{#snippet toggleRow()}
	<div
		role="switch"
		tabindex="0"
		aria-checked={checked}
		aria-label={title}
		class="filter-toggle-row"
		class:is-checked={checked}
		class:is-mobile={mobile}
		class:is-embedded={embedded}
		onclick={handleToggle}
		onkeydown={handleKeyDown}
	>
		<span class="toggle-copy">
			<span class="toggle-title">{title}</span>
			{#if description}
				<span class="toggle-desc">{description}</span>
			{/if}
		</span>

		<FdSwitch {checked} {paused} interactive={false} />
	</div>
{/snippet}

{#if embedded}
	{@render toggleRow()}
{:else}
	<FilterPartCard class="toggle-part {klass}" showHeader={false}>
		{@render toggleRow()}
	</FilterPartCard>
{/if}

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

	.filter-toggle-row.is-mobile .toggle-title {
		font-size: 0.8rem;
	}

	.filter-toggle-row.is-mobile .toggle-desc {
		font-size: 0.72rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.toggle-title {
			transition: none;
		}
	}
</style>
