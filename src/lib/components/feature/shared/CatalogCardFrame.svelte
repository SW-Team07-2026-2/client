<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import FdImage from '#lib/components/ui/FdImage.svelte';
	import { FluidSetting } from '#lib/fluid/setting';

	interface Props {
		src: string;
		alt: string;
		ariaLabel: string;
		aspectRatio?: string;
		radius?: number;
		hoverRadius?: number;
		setting?: FluidSetting | Partial<FluidSetting>;
		active?: boolean;
		extractedWaveColor?: string;
		onSelect?: () => void;
		badge?: Snippet;
		footer?: Snippet;
		action?: Snippet<[{ isActive: boolean; waveColor: string }]>;
		class?: string;
	}

	let {
		src,
		alt,
		ariaLabel,
		aspectRatio = '1 / 1',
		radius = 20,
		hoverRadius = 28,
		setting,
		active = false,
		extractedWaveColor = $bindable('var(--muted-wave)'),
		onSelect,
		badge,
		footer,
		action,
		class: klass = ''
	}: Props = $props();

	let cardHovered = $state(false);
	let imageHovered = $state(false);
	let focused = $state(false);
	let actionMounted = $state(untrack(() => active));

	const isActive = $derived(active || cardHovered || imageHovered || focused);

	$effect(() => {
		if (isActive && !actionMounted) actionMounted = true;
	});

	const resolvedSetting = $derived.by(() => {
		const base = new FluidSetting({
			radius,
			layers: 2,
			layerGap: 2.8,
			waveAmp: 2.5,
			waveLength: 68,
			spin: 1.1,
			bulge: 6,
			reach: 32,
			inset: 14
		});
		return setting ? base.with(setting) : base;
	});
</script>

<article
	class="catalog-card {klass}"
	class:is-active={isActive}
	onpointerenter={() => {
		cardHovered = true;
	}}
	onpointerleave={() => {
		cardHovered = false;
	}}
	onfocusin={() => {
		focused = true;
	}}
	onfocusout={(e) => {
		const nextTarget = e.relatedTarget as Node | null;
		if (!nextTarget || !e.currentTarget.contains(nextTarget)) {
			focused = false;
		}
	}}
>
	<div
		class="catalog-stage"
		style:aspect-ratio={aspectRatio}
		role="button"
		tabindex="0"
		aria-label={ariaLabel}
		onclick={() => onSelect?.()}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				onSelect?.();
			}
		}}
	>
		<FdImage
			class="catalog-fd-image"
			{src}
			{alt}
			setting={resolvedSetting}
			{hoverRadius}
			active={isActive}
			bind:hovered={imageHovered}
			bind:extractedWaveColor
			fullWidth
		>
			{#if badge}
				<div class="catalog-badge-anchor">
					{@render badge()}
				</div>
			{/if}
		</FdImage>
	</div>

	<div class="catalog-footer">
		{#if footer}
			<button type="button" class="catalog-meta-btn" tabindex="-1" onclick={() => onSelect?.()}>
				{@render footer()}
			</button>
		{/if}

		{#if action}
			<div class="catalog-action-slot" aria-hidden={!isActive}>
				{#if actionMounted}
					{@render action({ isActive, waveColor: extractedWaveColor })}
				{/if}
			</div>
		{/if}
	</div>
</article>

<style>
	.catalog-card {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		width: 100%;
		padding: 0;
		box-sizing: border-box;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
	}

	.catalog-card.is-active {
		z-index: 10;
	}

	.catalog-stage {
		position: relative;
		width: 100%;
		cursor: pointer;
		outline: none;
		display: grid;
		place-items: stretch;
	}

	.catalog-stage:focus-visible {
		outline: 2px solid var(--fg);
		outline-offset: 2px;
		border-radius: 26px;
	}

	:global(.catalog-fd-image) {
		width: 100%;
		height: 100%;
		z-index: 1;
	}

	.catalog-badge-anchor {
		position: absolute;
		top: 10px;
		left: 10px;
		z-index: 3;
		pointer-events: none;
	}

	.catalog-footer {
		position: relative;
		z-index: 2;
		width: 100%;
		padding: 0 14px;
		margin-top: -0.2rem;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}

	.catalog-meta-btn {
		appearance: none;
		border: none;
		background: transparent;
		padding: 0;
		margin: 0;
		width: 100%;
		text-align: left;
		cursor: pointer;
		color: var(--fg);
		display: flex;
		flex-direction: column;
		gap: 0.22rem;
		transition:
			transform 0.32s cubic-bezier(0.22, 1, 0.36, 1),
			color 0.22s ease;
	}

	.catalog-card.is-active .catalog-meta-btn {
		transform: translateY(0.15rem);
		color: var(--white);
	}

	.catalog-action-slot {
		position: absolute;
		top: calc(100% + 0.25rem);
		left: 14px;
		opacity: 0;
		transform: translateY(-0.2rem) scale(0.94);
		pointer-events: none;
		z-index: 15;
		transition:
			opacity 0.24s cubic-bezier(0.22, 1, 0.36, 1),
			transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.catalog-card.is-active .catalog-action-slot {
		opacity: 1;
		transform: translateY(0.15rem) scale(1);
		pointer-events: auto;
	}
</style>
