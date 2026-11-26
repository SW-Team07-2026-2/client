<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getAccordionContext } from './context';

	interface Props {
		/** 아코디언 항목 고유 키 */
		value: string;
		/** 헤더 제목 텍스트 */
		title: string;
		/** 비활성화 여부 */
		disabled?: boolean;
		/** 펼쳐졌을 때 표시할 본문 */
		children: Snippet;
	}

	let { value, title, disabled = false, children }: Props = $props();

	const ctx = getAccordionContext();
	let localOpen = $state(false);

	const expanded = $derived(ctx ? ctx.isOpen(value) : localOpen);

	function handleToggle() {
		if (disabled) return;
		if (ctx) {
			ctx.toggle(value);
		} else {
			localOpen = !localOpen;
		}
	}
</script>

<!-- 공용 아코디언 아이템 (180도 회전 화살표 + 부드러운 높이 펼침, 순수 렌더링) -->
<div class="accordion-item" class:is-expanded={expanded}>
	<h3 class="accordion-header">
		<button
			type="button"
			class="accordion-trigger"
			aria-expanded={expanded}
			{disabled}
			onclick={handleToggle}
		>
			<span class="accordion-title">{title}</span>
			<svg
				class="accordion-chevron"
				width="17"
				height="17"
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
	</h3>

	<div class="accordion-panel" aria-hidden={!expanded}>
		<div class="accordion-panel-inner">
			<div class="accordion-content">
				{@render children()}
			</div>
		</div>
	</div>
</div>

<style>
	.accordion-item {
		width: 100%;
		border-bottom: var(--thin-border);
	}

	.accordion-item:last-child {
		border-bottom: none;
	}

	.accordion-header {
		margin: 0;
		display: flex;
	}

	.accordion-trigger {
		width: 100%;
		padding: 0.95rem 0.15rem;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--white-2);
		font: inherit;
		font-size: 0.94rem;
		font-weight: var(--fw-semibold);
		text-align: left;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		cursor: pointer;
		outline: none;
		transition: color 0.16s ease;
	}

	.accordion-trigger:hover:not(:disabled) {
		color: var(--white);
	}

	.accordion-trigger:hover:not(:disabled) .accordion-title {
		text-decoration: underline;
		text-underline-offset: 4px;
	}

	.accordion-trigger:focus-visible {
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--white) 28%, transparent);
	}

	.accordion-trigger:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.accordion-chevron {
		flex-shrink: 0;
		color: var(--muted);
		transform: rotate(0deg);
		transition:
			transform 0.35s cubic-bezier(0.215, 0.61, 0.355, 1),
			color 0.2s ease;
	}

	.accordion-item.is-expanded .accordion-chevron {
		transform: rotate(180deg);
		color: var(--white);
	}

	.accordion-panel {
		display: grid;
		grid-template-rows: 0fr;
		opacity: 0;
		transition:
			grid-template-rows 0.35s cubic-bezier(0.215, 0.61, 0.355, 1),
			opacity 0.26s ease;
	}

	.accordion-item.is-expanded .accordion-panel {
		grid-template-rows: 1fr;
		opacity: 1;
	}

	.accordion-panel-inner {
		overflow: hidden;
		min-height: 0;
	}

	.accordion-content {
		padding: 0.1rem 0.15rem 1.15rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.accordion-chevron,
		.accordion-panel {
			transition: none;
		}
	}
</style>
