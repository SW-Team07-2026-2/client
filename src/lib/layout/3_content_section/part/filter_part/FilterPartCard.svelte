<script lang="ts">
	import type { Snippet } from 'svelte';
	import { isMobile } from '#lib/common/logic';

	interface Props {
		title?: string;
		showHeader?: boolean;
		showCount?: boolean;
		activeCount?: number;
		onReset?: () => void;
		children?: Snippet;
		class?: string;
	}

	let {
		title = '',
		showHeader = true,
		showCount = true,
		activeCount = 0,
		onReset,
		children,
		class: klass = ''
	}: Props = $props();

	const mobile = $derived(isMobile.current);
</script>

<section
	class="filter-part-card {klass}"
	class:is-mobile={mobile}
	aria-label={title ? `${title} 필터` : '필터 영역'}
>
	{#if showHeader && title}
		<header class="part-header">
			<div class="part-title-wrap">
				<span class="part-title">{title}</span>
				{#if showCount && activeCount > 0}
					<span class="part-count" aria-label="선택된 필터 {activeCount}개">{activeCount}</span>
				{/if}
			</div>

			{#if activeCount > 0 && onReset}
				<button type="button" class="part-reset-btn" onclick={onReset}>초기화</button>
			{/if}
		</header>
	{/if}

	<div class="part-body">
		{@render children?.()}
	</div>
</section>

<style>
	.filter-part-card {
		width: 100%;
		height: 100%;
		padding: 0.78rem 0.95rem;
		border: none;
		border-radius: 16px;
		background: var(--surface-dim);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.filter-part-card.is-mobile {
		height: auto;
		flex-shrink: 0;
		padding: 0.65rem 0.75rem;
		border-radius: 14px;
		gap: 0.35rem;
	}

	.part-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		min-height: 1.25rem;
		padding: 0 0.25rem;
	}

	.part-title-wrap {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-height: 1.25rem;
	}

	.part-title {
		font-size: 0.78rem;
		font-weight: 600;
		line-height: 1.25rem;
		letter-spacing: -0.01em;
		color: var(--muted);
	}

	.part-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.05rem;
		height: 1.05rem;
		padding: 0 0.28rem;
		border-radius: 999px;
		background: var(--surface-3);
		color: var(--fg);
		font-size: 0.68rem;
		font-weight: 700;
		line-height: 1;
	}

	.part-reset-btn {
		appearance: none;
		border: none;
		background: transparent;
		padding: 0 0.25rem;
		height: 1.25rem;
		display: inline-flex;
		align-items: center;
		color: var(--muted);
		font-size: 0.74rem;
		font-weight: 500;
		line-height: 1;
		cursor: pointer;
		transition: color 0.18s ease;
	}

	.part-reset-btn:hover {
		color: var(--fg);
	}

	.part-body {
		width: 100%;
	}
</style>
