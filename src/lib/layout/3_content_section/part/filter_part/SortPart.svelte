<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import FdDiv from '#lib/common/design/fluid/FdDiv.svelte';
	import { DEFAULT_FOLLOW_SORT, FOLLOW_SORT_OPTIONS, type FilterOption } from '#lib/common/type/filterOptions';
	import { createSpring, createSpringLoop, FluidSetting } from '#lib/common/type';
	import FilterPartCard from './FilterPartCard.svelte';

	interface Props {
		items?: readonly FilterOption[];
		value?: string;
		defaultValue?: string;
		title?: string;
		paused?: boolean;
		onchange?: (value: string) => void;
		class?: string;
	}

	let {
		items = FOLLOW_SORT_OPTIONS,
		value = $bindable(DEFAULT_FOLLOW_SORT),
		defaultValue = DEFAULT_FOLLOW_SORT,
		title = '정렬',
		paused = false,
		onchange,
		class: klass = ''
	}: Props = $props();

	let listEl = $state<HTMLDivElement | null>(null);
	let activeEl = $state<HTMLDivElement | null>(null);
	let hoverEl = $state<HTMLDivElement | null>(null);
	let optionEls = $state<(HTMLButtonElement | null)[]>([]);

	let hoveredIndex = $state<number | null>(null);

	const resolvedValue = $derived(value || defaultValue);
	const activeIndex = $derived.by(() => {
		const idx = items.findIndex((item) => item.value === resolvedValue);
		return idx >= 0 ? idx : 0;
	});

	const ACTIVE_SETTING = new FluidSetting({
		radius: 10,
		reach: 0,
		bulge: 0,
		inset: 6,
		layers: 2,
		layerGap: 2,
		waveAmp: 4,
		waveLength: 94,
		spin: 1.0,
		staticFrontWave: false,
		pauseWhenIdle: false,
		color: 'var(--white-2)',
		hoverColor: 'var(--white-2)',
		pressColor: 'var(--white-3)',
		waveColor: 'var(--white-3)',
		borderWidth: 0,
		hoverReactive: false,
		bulgeReactive: false,
		clickReactive: false
	});

	const PAUSED_ACTIVE_SETTING = ACTIVE_SETTING.with({ pauseWhenIdle: true });
	const activeSetting = $derived(paused ? PAUSED_ACTIVE_SETTING : ACTIVE_SETTING);
	const activeInset = ACTIVE_SETTING.computedInset;

	// 수직 Rubber-Dock 활성 인디케이터 스프링 + 호버 추적 스프링
	const actT = createSpring(0, 420, 34);
	const actB = createSpring(0, 420, 34);
	const actX = createSpring(0, 420, 34);
	const actW = createSpring(0, 420, 34);

	const hovT = createSpring(0, 460, 34);
	const hovB = createSpring(0, 460, 34);
	const hovX = createSpring(0, 460, 34);
	const hovW = createSpring(0, 460, 34);
	const hovOpacity = createSpring(0, 300, 28);

	const allSprings = [actT, actB, actX, actW, hovT, hovB, hovX, hovW, hovOpacity];

	let activeReady = false;
	let hoverInitialized = false;
	let lastActiveIdx = -1;
	let lastActW = -1;
	let lastActH = -1;
	let lastHovW = -1;
	let lastHovH = -1;

	function applyRects() {
		if (activeEl && activeReady) {
			const w = Math.max(0, actW.x + activeInset * 2);
			const h = Math.max(0, actB.x - actT.x + activeInset * 2);
			activeEl.style.opacity = '1';
			activeEl.style.transform = `translate3d(${(actX.x - activeInset).toFixed(2)}px, ${(actT.x - activeInset).toFixed(2)}px, 0)`;
			if (Math.abs(w - lastActW) > 0.15) {
				activeEl.style.width = `${w.toFixed(2)}px`;
				lastActW = w;
			}
			if (Math.abs(h - lastActH) > 0.15) {
				activeEl.style.height = `${h.toFixed(2)}px`;
				lastActH = h;
			}
		}

		if (hoverEl && hoverInitialized) {
			const op = Math.max(0, Math.min(1, hovOpacity.x));
			hoverEl.style.opacity = op > 0.005 ? op.toFixed(3) : '0';
			if (op > 0.005) {
				const w = Math.max(0, hovW.x);
				const h = Math.max(0, hovB.x - hovT.x);
				hoverEl.style.transform = `translate3d(${hovX.x.toFixed(2)}px, ${hovT.x.toFixed(2)}px, 0)`;
				if (Math.abs(w - lastHovW) > 0.15) {
					hoverEl.style.width = `${w.toFixed(2)}px`;
					lastHovW = w;
				}
				if (Math.abs(h - lastHovH) > 0.15) {
					hoverEl.style.height = `${h.toFixed(2)}px`;
					lastHovH = h;
				}
			}
		}
	}

	const springLoop = createSpringLoop({
		springs: allSprings,
		isSettled: () => {
			for (let i = 0; i < allSprings.length; i++) {
				const s = allSprings[i];
				if (Math.abs(s.x - s.t) > 0.05 || Math.abs(s.v) > 0.2) return false;
			}
			return true;
		},
		onFrame: () => applyRects()
	});

	function syncActiveTarget() {
		const btn = optionEls[activeIndex];
		if (!btn || btn.offsetWidth <= 0 || btn.offsetHeight <= 0) return;

		const t = btn.offsetTop;
		const b = t + btn.offsetHeight;
		const x = btn.offsetLeft;
		const w = btn.offsetWidth;

		if (!activeReady || lastActiveIdx === -1) {
			activeReady = true;
			lastActiveIdx = activeIndex;
			actT.x = actT.t = t;
			actB.x = actB.t = b;
			actX.x = actX.t = x;
			actW.x = actW.t = w;
			applyRects();
			return;
		}

		if (activeIndex !== lastActiveIdx) {
			const dir = Math.sign((t + b) / 2 - (actT.x + actB.x) / 2);
			lastActiveIdx = activeIndex;
			if (dir > 0) {
				actT.k = 200;
				actT.c = 20;
				actB.k = 580;
				actB.c = 36;
			} else if (dir < 0) {
				actT.k = 580;
				actT.c = 36;
				actB.k = 200;
				actB.c = 20;
			}
		} else {
			actT.k = actB.k = 420;
			actT.c = actB.c = 34;
		}

		actT.t = t;
		actB.t = b;
		actX.t = x;
		actW.t = w;
		springLoop.wake();
	}

	function syncHoverTarget() {
		if (hoveredIndex === null) {
			hovOpacity.t = 0;
			if (hoverInitialized) springLoop.wake();
			return;
		}

		const btn = optionEls[hoveredIndex];
		if (!btn || btn.offsetWidth <= 0 || btn.offsetHeight <= 0) return;

		const t = btn.offsetTop;
		const b = t + btn.offsetHeight;
		const x = btn.offsetLeft;
		const w = btn.offsetWidth;

		if (!hoverInitialized) {
			hoverInitialized = true;
			hovT.x = hovT.t = t;
			hovB.x = hovB.t = b;
			hovX.x = hovX.t = x;
			hovW.x = hovW.t = w;
			hovOpacity.x = 0;
			hovOpacity.t = 1;
		} else {
			if (hovOpacity.x < 0.08) {
				hovT.x = t;
				hovB.x = b;
				hovX.x = x;
				hovW.x = w;
			}
			hovT.t = t;
			hovB.t = b;
			hovX.t = x;
			hovW.t = w;
			hovOpacity.t = 1;
		}
		springLoop.wake();
	}

	function selectOption(option: FilterOption) {
		if (resolvedValue === option.value) return;
		value = option.value;
		onchange?.(option.value);
	}

	$effect(() => {
		void activeIndex;
		void items;
		tick().then(() => syncActiveTarget());
	});

	$effect(() => {
		void hoveredIndex;
		tick().then(() => syncHoverTarget());
	});

	onMount(() => {
		syncActiveTarget();
		if (!listEl) return;
		const ro = new ResizeObserver(() => {
			syncActiveTarget();
			if (hoveredIndex !== null) syncHoverTarget();
		});
		ro.observe(listEl);
		return () => ro.disconnect();
	});

	onDestroy(() => springLoop.stop());
</script>

<FilterPartCard class="sort-part {klass}" {title}>
	<div
		bind:this={listEl}
		class="sort-select-list"
		role="radiogroup"
		tabindex="-1"
		aria-label="{title} 기준"
		onpointerleave={() => {
			hoveredIndex = null;
		}}
	>
		<div bind:this={hoverEl} class="sort-indicator is-hover" aria-hidden="true"></div>

		<div bind:this={activeEl} class="sort-indicator is-active" aria-hidden="true">
			<FdDiv
				setting={activeSetting}
				fullWidth={true}
				staticFrontWave={true}
				class="sort-fd-wrap"
				bodyClass="sort-fd-body"
			/>
		</div>

		{#each items as option, idx (option.value)}
			{@const isActive = idx === activeIndex}
			<button
				bind:this={optionEls[idx]}
				type="button"
				role="radio"
				aria-checked={isActive}
				class="sort-option-btn"
				class:is-active={isActive}
				onpointerenter={(e) => {
					if (e.pointerType !== 'touch') hoveredIndex = idx;
				}}
				onclick={() => selectOption(option)}
			>
				<span class="sort-option-label">{option.label}</span>
			</button>
		{/each}
	</div>
</FilterPartCard>

<style>
	.sort-select-list {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 2px;
		width: 100%;
		isolation: isolate;
	}

	.sort-indicator {
		position: absolute;
		top: 0;
		left: 0;
		opacity: 0;
		pointer-events: none;
	}

	.sort-indicator.is-hover {
		z-index: 0;
		border-radius: 10px;
		background: var(--surface-3);
	}

	.sort-indicator.is-active {
		z-index: 1;
	}

	:global(.fd-wrap.sort-fd-wrap) {
		width: 100%;
		height: 100%;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr);
	}

	:global(.fd-wrap.sort-fd-wrap .fd-body.sort-fd-body) {
		width: 100%;
		height: 100%;
		padding: 0;
		min-width: 0;
		min-height: 0;
	}

	.sort-option-btn {
		position: relative;
		z-index: 2;
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.65rem;
		padding: 0.44rem 0.72rem;
		margin: 0;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 0.84rem;
		font-weight: 500;
		letter-spacing: -0.01em;
		text-align: left;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		transition: color 0.18s ease;
	}

	.sort-option-btn:hover:not(.is-active) {
		color: var(--fg);
	}

	.sort-option-btn.is-active {
		color: var(--bg);
		font-weight: 600;
	}

	.sort-option-btn:focus-visible {
		outline: 2px solid var(--line);
		outline-offset: -2px;
	}

	.sort-option-label {
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
