<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';

	export interface SpringDropdownOption {
		value: number | string;
		label: string;
		subLabel?: string;
		soldOut?: boolean;
		dotColor?: string;
	}

	interface Props {
		options: readonly SpringDropdownOption[];
		value: number | string | null;
		label?: string;
		placeholder?: string;
		disabled?: boolean;
		onSelect?: (value: number | string) => void;
	}

	let {
		options,
		value,
		label = '옵션 선택',
		placeholder = '선택해 주세요',
		disabled = false,
		onSelect
	}: Props = $props();

	interface SpringState {
		x: number;
		v: number;
		t: number;
		k: number;
		c: number;
	}

	interface RowMotion {
		s: SpringState;
		k: SpringState;
	}

	const ROW_H = 44;
	const PAD = 6;

	let rootEl = $state<HTMLDivElement | null>(null);
	let trigEl = $state<HTMLButtonElement | null>(null);
	let menuEl = $state<HTMLDivElement | null>(null);
	let hlEl = $state<HTMLElement | null>(null);
	let chevEl = $state<SVGSVGElement | null>(null);
	let slotAEl = $state<HTMLSpanElement | null>(null);
	let slotBEl = $state<HTMLSpanElement | null>(null);
	let optEls: Array<HTMLButtonElement | undefined> = $state([]);
	let tickEls: Array<SVGPathElement | undefined> = $state([]);

	let open = $state(false);
	let hoveredIdx = $state(-1);
	let frontSlot = $state<0 | 1>(0);
	let slotData = $state<[SpringDropdownOption | null, SpringDropdownOption | null]>([null, null]);

	let reduceMotion = false;
	let rafId = 0;
	let lastTime = 0;
	const pendingTimers = new Set<ReturnType<typeof setTimeout>>();

	const makeSpring = (x: number, k = 400, c = 30): SpringState => ({ x, v: 0, t: x, k, c });
	const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

	function tune(s: SpringState, k: number, c: number) {
		s.k = k;
		s.c = reduceMotion ? 2 * Math.sqrt(k) : c;
	}

	function stepSpring(s: SpringState, dt: number) {
		const a = -s.k * (s.x - s.t) - s.c * s.v;
		s.v += a * dt;
		s.x += s.v * dt;
	}

	function isSettled(s: SpringState, eps = 0.004): boolean {
		return Math.abs(s.x - s.t) <= eps && Math.abs(s.v) <= eps * 10;
	}

	function schedule(ms: number, fn: () => void) {
		const id = setTimeout(() => {
			pendingTimers.delete(id);
			fn();
		}, ms);
		pendingTimers.add(id);
	}

	function clearTimers() {
		for (const id of pendingTimers) clearTimeout(id);
		pendingTimers.clear();
	}

	// 코어 스프링들 (Spring Dropdown 물리 프리셋)
	const H = makeSpring(0, 300, 23);
	const C = makeSpring(0, 300, 18);
	const O = makeSpring(0, 400, 34);
	const TS = makeSpring(1, 500, 18);
	const R = makeSpring(1, 340, 26);
	const HT = makeSpring(PAD, 620, 36);
	const HB = makeSpring(PAD + ROW_H, 620, 36);
	const HO = makeSpring(0, 400, 32);

	let rowMotions: RowMotion[] = [];
	let lastRenderedValue: number | string | null = null;
	let lastOptionsSig = '';

	const menuHeight = $derived(PAD * 2 + ROW_H * Math.max(1, options.length));
	const selectedIndex = $derived(options.findIndex((o) => o.value === value));

	function syncRowMotions(list: readonly SpringDropdownOption[], activeIdx: number) {
		rowMotions = list.map((_, i) => ({
			s: makeSpring(open ? 1 : 0, 300, 24),
			k: makeSpring(i === activeIdx ? 1 : 0, 260, 26)
		}));
	}

	// options / value 변경 시 내부 슬롯 및 스프링 동기화
	$effect(() => {
		const list = options;
		const selIdx = selectedIndex;
		const sig = list.map((o) => String(o.value)).join('|');
		const selectedOpt = selIdx >= 0 ? list[selIdx] : (list[0] ?? null);

		untrack(() => {
			if (sig !== lastOptionsSig) {
				lastOptionsSig = sig;
				clearTimers();
				if (open) {
					open = false;
					hoveredIdx = -1;
					H.x = H.t = 0;
					H.v = 0;
					C.x = C.t = 0;
					C.v = 0;
					O.x = O.t = 0;
					O.v = 0;
					HO.x = HO.t = 0;
					HO.v = 0;
				}
				syncRowMotions(list, selIdx);
				const prevOpt = slotData[frontSlot];
				if (prevOpt && selectedOpt && prevOpt.value !== selectedOpt.value) {
					const nextSlot = (frontSlot ^ 1) as 0 | 1;
					const nextData: [SpringDropdownOption | null, SpringDropdownOption | null] = [
						slotData[0],
						slotData[1]
					];
					nextData[nextSlot] = selectedOpt;
					slotData = nextData;
					frontSlot = nextSlot;
					R.x = reduceMotion ? 1 : 0;
					R.v = 0;
					R.t = 1;
				} else {
					slotData = [selectedOpt, null];
					frontSlot = 0;
					R.x = R.t = 1;
					R.v = 0;
				}
				lastRenderedValue = selectedOpt?.value ?? null;
				wakeLoop();
				return;
			}

			if (selectedOpt && selectedOpt.value !== lastRenderedValue) {
				const hadPrev = lastRenderedValue !== null;
				lastRenderedValue = selectedOpt.value;
				if (hadPrev && !reduceMotion) {
					const nextSlot = (frontSlot ^ 1) as 0 | 1;
					const nextData: [SpringDropdownOption | null, SpringDropdownOption | null] = [
						slotData[0],
						slotData[1]
					];
					nextData[nextSlot] = selectedOpt;
					slotData = nextData;
					frontSlot = nextSlot;
					R.x = 0;
					R.v = 0;
					R.t = 1;
				} else {
					slotData = [selectedOpt, null];
					frontSlot = 0;
					R.x = R.t = 1;
					R.v = 0;
				}
			}

			for (let i = 0; i < rowMotions.length; i++) {
				rowMotions[i].k.t = i === selIdx ? 1 : 0;
			}
			wakeLoop();
		});
	});

	function hoverRow(idx: number, snap = false) {
		if (idx === hoveredIdx || idx < 0 || idx >= options.length) return;
		const top = PAD + idx * ROW_H;
		if (snap || hoveredIdx < 0 || reduceMotion) {
			HT.x = HT.t = top;
			HB.x = HB.t = top + ROW_H;
			HT.v = HB.v = 0;
		} else {
			const down = idx > hoveredIdx;
			tune(down ? HB : HT, 620, 36);
			tune(down ? HT : HB, 200, 20);
			HT.t = top;
			HB.t = top + ROW_H;
		}
		hoveredIdx = idx;
		HO.t = 1;
		wakeLoop();
	}

	function setOpen(nextOpen: boolean) {
		if (disabled && nextOpen) return;
		if (open === nextOpen) return;
		clearTimers();
		open = nextOpen;

		const mh = menuHeight;
		H.t = nextOpen ? mh : 0;
		C.t = nextOpen ? 1 : 0;
		O.t = nextOpen ? 1 : 0;

		const n = rowMotions.length;
		for (let i = 0; i < n; i++) {
			const delay = reduceMotion ? 0 : nextOpen ? 45 + i * 40 : (n - 1 - i) * 18;
			schedule(delay, () => {
				if (rowMotions[i]) {
					rowMotions[i].s.t = open ? 1 : 0;
					wakeLoop();
				}
			});
		}

		if (nextOpen) {
			const initialIdx = selectedIndex >= 0 ? selectedIndex : 0;
			if (options.length > 0) {
				hoverRow(initialIdx, true);
			}
		} else {
			hoveredIdx = -1;
			HO.t = 0;
		}
		wakeLoop();
	}

	function pickOption(idx: number) {
		const opt = options[idx];
		if (!opt) return;

		TS.x = reduceMotion ? 1 : 0.96;
		for (let i = 0; i < rowMotions.length; i++) {
			rowMotions[i].k.t = i === idx ? 1 : 0;
		}
		onSelect?.(opt.value);
		wakeLoop();

		schedule(reduceMotion ? 0 : 210, () => {
			setOpen(false);
		});
	}

	function handleTriggerClick() {
		if (disabled || options.length === 0) return;
		TS.x = reduceMotion ? 1 : 0.968;
		setOpen(!open);
	}

	function handleTriggerKeyDown(e: KeyboardEvent) {
		if (disabled || options.length === 0) return;
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			if (!open) {
				setOpen(true);
			} else {
				const dir = e.key === 'ArrowDown' ? 1 : -1;
				const next = clamp(hoveredIdx + dir, 0, options.length - 1);
				hoverRow(next);
			}
		} else if ((e.key === 'Enter' || e.key === ' ') && open && hoveredIdx >= 0) {
			e.preventDefault();
			pickOption(hoveredIdx);
		} else if (e.key === 'Escape' && open) {
			e.preventDefault();
			setOpen(false);
		}
	}

	function renderFrame() {
		const mh = menuHeight;

		if (trigEl) {
			trigEl.style.transform = `scale(${TS.x.toFixed(4)})`;
		}
		if (chevEl) {
			chevEl.style.transform = `rotate(${(180 * C.x).toFixed(2)}deg)`;
		}
		if (menuEl) {
			const h = Math.max(0, H.x);
			const o = clamp(O.x, 0, 1);
			menuEl.style.height = `${h.toFixed(2)}px`;
			menuEl.style.opacity = o.toFixed(3);
			menuEl.style.visibility = h < 1 ? 'hidden' : 'visible';
			menuEl.style.pointerEvents = open ? 'auto' : 'none';
			menuEl.style.transform = `scaleX(${(0.92 + 0.08 * clamp(H.x / mh, 0, 1.05)).toFixed(4)})`;

			if (hlEl) {
				hlEl.style.opacity = (clamp(HO.x, 0, 1) * o).toFixed(3);
				const ht = clamp(Math.min(HT.x, HB.x - 16), PAD, Math.max(PAD, mh - PAD - 16));
				const hb = clamp(HB.x, ht + 16, Math.max(ht + 16, mh - PAD));
				hlEl.style.height = `${(hb - ht).toFixed(2)}px`;
				hlEl.style.transform = `translate3d(0, ${ht.toFixed(2)}px, 0)`;
			}
		}

		for (let i = 0; i < rowMotions.length; i++) {
			const rm = rowMotions[i];
			const el = optEls[i];
			const tick = tickEls[i];
			if (el) {
				const s = clamp(rm.s.x, 0, 1);
				el.style.opacity = s.toFixed(3);
				el.style.transform = `translate3d(0, ${((rm.s.x - 1) * 14).toFixed(2)}px, 0)`;
			}
			if (tick) {
				tick.style.strokeDashoffset = (22 * (1 - clamp(rm.k.x, 0, 1))).toFixed(2);
			}
		}

		const slotEls = [slotAEl, slotBEl];
		const activeEl = slotEls[frontSlot];
		const prevEl = slotEls[frontSlot ^ 1];
		const r = R.x;
		if (activeEl) {
			activeEl.style.opacity = clamp(r, 0, 1).toFixed(3);
			activeEl.style.transform = `translate3d(0, ${((1 - r) * 20).toFixed(2)}px, 0)`;
		}
		if (prevEl) {
			prevEl.style.opacity = clamp(1 - r, 0, 1).toFixed(3);
			prevEl.style.transform = `translate3d(0, ${(-r * 20).toFixed(2)}px, 0)`;
		}
	}

	function tickLoop(now: number) {
		rafId = 0;
		const dt = Math.min((now - lastTime) / 1000, 1 / 30) || 1 / 60;
		lastTime = now;

		const sub = 4;
		const subDt = dt / sub;
		for (let step = 0; step < sub; step++) {
			stepSpring(H, subDt);
			stepSpring(C, subDt);
			stepSpring(O, subDt);
			stepSpring(TS, subDt);
			stepSpring(R, subDt);
			stepSpring(HT, subDt);
			stepSpring(HB, subDt);
			stepSpring(HO, subDt);
			for (let i = 0; i < rowMotions.length; i++) {
				stepSpring(rowMotions[i].s, subDt);
				stepSpring(rowMotions[i].k, subDt);
			}
		}

		renderFrame();

		let moving =
			!isSettled(H, 0.08) ||
			!isSettled(C) ||
			!isSettled(O) ||
			!isSettled(TS) ||
			!isSettled(R) ||
			!isSettled(HT, 0.08) ||
			!isSettled(HB, 0.08) ||
			!isSettled(HO);

		if (!moving) {
			for (let i = 0; i < rowMotions.length; i++) {
				if (!isSettled(rowMotions[i].s) || !isSettled(rowMotions[i].k)) {
					moving = true;
					break;
				}
			}
		}

		if (moving) {
			rafId = requestAnimationFrame(tickLoop);
		}
	}

	function wakeLoop() {
		if (typeof window === 'undefined' || rafId) return;
		lastTime = performance.now();
		rafId = requestAnimationFrame(tickLoop);
	}

	onMount(() => {
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		reduceMotion = mq.matches;
		const onReduceChange = (e: MediaQueryListEvent) => {
			reduceMotion = e.matches;
		};
		mq.addEventListener('change', onReduceChange);

		const onOutsideDown = (e: PointerEvent) => {
			if (!open || !rootEl) return;
			if (!e.composedPath().includes(rootEl)) {
				setOpen(false);
			}
		};
		window.addEventListener('pointerdown', onOutsideDown);
		renderFrame();

		return () => {
			mq.removeEventListener('change', onReduceChange);
			window.removeEventListener('pointerdown', onOutsideDown);
		};
	});

	onDestroy(() => {
		clearTimers();
		if (rafId) cancelAnimationFrame(rafId);
	});
</script>

<!-- 스프링 물리 드롭다운 (트리거 롤업 · 스트레치 하이라이트 · 체크 스트로크 드로우 · 순수 렌더링) -->
<div bind:this={rootEl} class="spring-dd" class:is-open={open} class:is-disabled={disabled}>
	<button
		bind:this={trigEl}
		type="button"
		class="dd-trig"
		{disabled}
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-label={label}
		onclick={handleTriggerClick}
		onkeydown={handleTriggerKeyDown}
	>
		<span class="dd-val">
			<span bind:this={slotAEl} class="dd-slot">
				{#if slotData[0]}
					{#if slotData[0].dotColor}
						<i class="dd-dot" style:background={slotData[0].dotColor} aria-hidden="true"></i>
					{/if}
					<span class="dd-slot-label" class:is-soldout={slotData[0].soldOut}>
						{slotData[0].label}
					</span>
					{#if slotData[0].subLabel}
						<span class="dd-slot-sub">{slotData[0].subLabel}</span>
					{/if}
				{:else}
					<span class="dd-slot-placeholder">{placeholder}</span>
				{/if}
			</span>
			<span bind:this={slotBEl} class="dd-slot" aria-hidden="true">
				{#if slotData[1]}
					{#if slotData[1].dotColor}
						<i class="dd-dot" style:background={slotData[1].dotColor} aria-hidden="true"></i>
					{/if}
					<span class="dd-slot-label" class:is-soldout={slotData[1].soldOut}>
						{slotData[1].label}
					</span>
					{#if slotData[1].subLabel}
						<span class="dd-slot-sub">{slotData[1].subLabel}</span>
					{/if}
				{/if}
			</span>
		</span>

		<svg
			bind:this={chevEl}
			class="dd-chev"
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

	<div bind:this={menuEl} class="dd-menu" role="listbox" aria-label={label}>
		<i bind:this={hlEl} class="dd-hl" aria-hidden="true"></i>
		{#each options as opt, i (opt.value)}
			{@const isSelected = i === selectedIndex}
			<button
				bind:this={optEls[i]}
				type="button"
				role="option"
				aria-selected={isSelected}
				class="dd-opt"
				class:is-soldout={opt.soldOut}
				onpointerenter={() => {
					if (open) hoverRow(i);
				}}
				onpointermove={() => {
					if (open) hoverRow(i);
				}}
				onclick={() => {
					if (open) pickOption(i);
				}}
			>
				{#if opt.dotColor}
					<i class="dd-dot" style:background={opt.dotColor} aria-hidden="true"></i>
				{/if}
				<span class="dd-opt-label">{opt.label}</span>
				{#if opt.subLabel}
					<span class="dd-opt-sub">{opt.subLabel}</span>
				{/if}
				<svg
					class="dd-tick"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path bind:this={tickEls[i]} d="M5 12.5l4.5 4.5L19 7.5" />
				</svg>
			</button>
		{/each}
	</div>
</div>

<style>
	.spring-dd {
		position: relative;
		width: 100%;
		height: 48px;
		z-index: 2;
		user-select: none;
		-webkit-user-select: none;
	}

	.spring-dd.is-open {
		z-index: 30;
	}

	.spring-dd.is-disabled {
		opacity: 0.55;
		pointer-events: none;
	}

	.dd-trig {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 14px 0 16px;
		border: none;
		border-radius: 14px;
		background: var(--surface);
		color: var(--white);
		font: inherit;
		cursor: pointer;
		will-change: transform;
		transition: background-color 0.16s ease;
		-webkit-tap-highlight-color: transparent;
	}

	.dd-trig:hover {
		background: var(--surface-2);
	}

	.dd-trig:focus-visible {
		outline: 2px solid var(--white-2);
		outline-offset: 2px;
	}

	.dd-val {
		position: relative;
		flex: 1;
		min-width: 0;
		height: 100%;
		overflow: hidden;
	}

	.dd-slot {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		gap: 9px;
		will-change: transform, opacity;
	}

	.dd-dot {
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: 999px;
	}

	.dd-slot-label {
		font-size: 0.9rem;
		font-weight: var(--fw-semibold);
		letter-spacing: -0.01em;
		color: var(--white);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.dd-slot-label.is-soldout {
		color: var(--muted);
		text-decoration: line-through;
	}

	.dd-slot-sub {
		margin-left: auto;
		flex-shrink: 0;
		font-size: 0.82rem;
		font-weight: var(--fw-medium);
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.dd-slot-placeholder {
		font-size: 0.88rem;
		color: var(--muted);
	}

	.dd-chev {
		flex: none;
		width: 18px;
		height: 18px;
		color: var(--muted);
		will-change: transform;
	}

	.dd-menu {
		position: absolute;
		left: 0;
		right: 0;
		top: calc(100% + 8px);
		height: 0;
		padding: 6px;
		border-radius: 16px;
		border: none;
		overflow: hidden;
		background: color-mix(in srgb, var(--surface) 94%, var(--bg));
		-webkit-backdrop-filter: blur(20px);
		backdrop-filter: blur(20px);
		box-shadow: 0 18px 40px rgba(0, 0, 0, 0.52);
		transform-origin: 50% 0;
		visibility: hidden;
		box-sizing: border-box;
		will-change: transform, height, opacity;
	}

	.dd-hl {
		position: absolute;
		left: 6px;
		right: 6px;
		top: 0;
		border-radius: 11px;
		background: color-mix(in srgb, var(--white) 9%, transparent);
		opacity: 0;
		pointer-events: none;
		will-change: transform, height;
	}

	.dd-opt {
		position: relative;
		z-index: 1;
		width: 100%;
		height: 44px;
		padding: 0 10px 0 12px;
		border: none;
		border-radius: 11px;
		background: transparent;
		font: inherit;
		color: var(--white);
		display: flex;
		align-items: center;
		gap: 9px;
		text-align: left;
		cursor: pointer;
		opacity: 0;
		will-change: transform, opacity;
		-webkit-tap-highlight-color: transparent;
	}

	.dd-opt.is-soldout .dd-opt-label {
		color: var(--muted);
		text-decoration: line-through;
	}

	.dd-opt-label {
		flex: 1;
		min-width: 0;
		font-size: 0.88rem;
		font-weight: var(--fw-medium);
		letter-spacing: -0.01em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.dd-opt-sub {
		flex-shrink: 0;
		font-size: 0.8rem;
		font-weight: var(--fw-medium);
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.dd-tick {
		flex: none;
		width: 17px;
		height: 17px;
		color: var(--white);
	}

	.dd-tick path {
		stroke-dasharray: 22;
		stroke-dashoffset: 22;
	}
</style>
