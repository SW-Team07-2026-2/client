<script lang="ts">
	import FdDiv from '#lib/common/design/fluid/FdDiv.svelte';
	import { FluidSetting } from '#lib/common/type/fluid';
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

	const TRACK_BASE_SETTING = new FluidSetting({
		radius: 999,
		inset: 6,
		reach: 26,
		bulge: 4,
		bulgeWidth: 16,
		layers: 2,
		layerGap: 0,
		waveAmp: 0,
		waveLength: 48,
		spin: 1.1,
		staticFrontWave: true,
		hoverReactive: true,
		bulgeReactive: true,
		clickReactive: true,
		pressDeform: { x: 0.9, y: -1.3 },
		pauseWhenIdle: true,
		color: 'var(--surface-3)',
		hoverColor: 'var(--surface-4)',
		pressColor: 'var(--line)',
		waveColor: 'var(--surface-4)',
		borderWidth: 1,
		borderColor: 'var(--line)',
		hoverBorderColor: 'var(--muted)',
		pressBorderColor: 'var(--muted)'
	});

	const TRACK_ACTIVE_SETTING = TRACK_BASE_SETTING.with({
		layers: 2,
		layerGap: 2.2,
		waveAmp: 2.2,
		spin: 1.5,
		staticFrontWave: true,
		pauseWhenIdle: false,
		color: 'var(--white-2)',
		hoverColor: 'var(--white)',
		pressColor: 'var(--white-3)',
		waveColor: 'var(--white-3)',
		hoverWaveColor: 'var(--white-3)',
		borderWidth: 0
	});

	const trackSetting = $derived(
		checked
			? paused
				? TRACK_ACTIVE_SETTING.with({ pauseWhenIdle: true })
				: TRACK_ACTIVE_SETTING
			: TRACK_BASE_SETTING
	);

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

		<span class="toggle-track-slot" aria-hidden="true">
			<FdDiv
				setting={trackSetting}
				staticFrontWave={true}
				class="toggle-track-fd-wrap"
				bodyClass="toggle-track-fd-body"
			>
				<span class="toggle-thumb"></span>
			</FdDiv>
		</span>
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

	.toggle-track-slot {
		position: relative;
		flex: 0 0 auto;
		width: 40px;
		height: 22px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	:global(.fd-wrap.toggle-track-fd-wrap) {
		margin: -6px;
	}

	:global(.fd-wrap .fd-body.toggle-track-fd-body) {
		position: relative;
		box-sizing: content-box;
		width: 40px;
		height: 22px;
		padding: 0;
	}

	.toggle-thumb {
		position: absolute;
		top: 3px;
		left: 3px;
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
		.toggle-thumb {
			transition: none;
		}
	}
</style>
