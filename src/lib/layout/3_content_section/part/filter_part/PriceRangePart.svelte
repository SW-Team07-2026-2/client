<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { DEFAULT_PRICE_MAX, DEFAULT_PRICE_MIN, DEFAULT_PRICE_STEP } from '#lib/common/type/filterOptions';
	import { createSpring, createSpringLoop, type SpringState } from '#lib/common/type';
	import FilterPartCard from './FilterPartCard.svelte';

	interface Props {
		min?: number;
		max?: number;
		step?: number;
		/** 선택된 가격 범위 [min, max] (null이면 전체 범위) */
		value?: [number, number] | null;
		title?: string;
		onchange?: (value: [number, number] | null) => void;
		class?: string;
	}

	let {
		min = DEFAULT_PRICE_MIN,
		max = DEFAULT_PRICE_MAX,
		step = DEFAULT_PRICE_STEP,
		value = $bindable<[number, number] | null>(null),
		title = '가격대',
		onchange,
		class: klass = ''
	}: Props = $props();

	let areaEl = $state<HTMLDivElement | null>(null);
	let fillEl = $state<HTMLSpanElement | null>(null);
	let thumbAEl = $state<HTMLButtonElement | null>(null);
	let thumbBEl = $state<HTMLButtonElement | null>(null);
	let tipAEl = $state<HTMLSpanElement | null>(null);
	let tipBEl = $state<HTMLSpanElement | null>(null);
	let tipMergedEl = $state<HTMLSpanElement | null>(null);

	const initialMin = untrack(() => (value ? value[0] : min));
	const initialMax = untrack(() => (value ? value[1] : max));

	const va = createSpring(initialMin, 260, 24);
	const vb = createSpring(initialMax, 260, 24);
	const mergeSpring = createSpring(0, 300, 26);

	let drag: { s: SpringState; isA: boolean } | null = null;

	// 매 프레임 강제 리플로우 방지를 위한 DOM 너비/텍스트 캐시
	let areaWidth = 0;
	let tipAWidth = 0;
	let tipBWidth = 0;
	let tipMergedWidth = 0;
	let prevTextA = '';
	let prevTextB = '';
	let prevTextMerged = '';
	let prevValA = Number.NaN;
	let prevValB = Number.NaN;

	const isActiveFilter = $derived(value !== null);

	function clamp(v: number, lo: number, hi: number): number {
		return Math.max(lo, Math.min(hi, v));
	}

	function snapToStep(raw: number): number {
		return clamp(Math.round((raw - min) / step) * step + min, min, max);
	}

	function formatWon(raw: number, isMaxThumb = false): string {
		const rounded = clamp(Math.round(raw / 1000) * 1000, min, max) || 0;
		if (isMaxThumb && rounded >= max) {
			if (max >= 10000 && max % 10000 === 0) {
				return `${max / 10000}만원 이상`;
			}
			return `${max.toLocaleString('ko-KR')}원 이상`;
		}
		return `${rounded.toLocaleString('ko-KR')}원`;
	}

	function gapV(): number {
		const span = Math.max(1, max - min);
		const w = Math.max(1, areaWidth || areaEl?.clientWidth || 280);
		return (34 / w) * span;
	}

	function commitValue() {
		const nextMin = snapToStep(va.t);
		const nextMax = snapToStep(vb.t);
		const nextValue: [number, number] | null =
			nextMin <= min && nextMax >= max ? null : [nextMin, nextMax];

		const prev = value;
		const unchanged =
			(prev === null && nextValue === null) ||
			(prev !== null && nextValue !== null && prev[0] === nextValue[0] && prev[1] === nextValue[1]);
		if (!unchanged) {
			value = nextValue;
			onchange?.(nextValue);
		}
	}

	function tipAt(
		el: HTMLSpanElement,
		tipWidth: number,
		areaW: number,
		x: number,
		vel: number,
		span: number,
		o: number,
		sc: number
	) {
		const tilt = clamp((vel / span) * areaW * -0.02, -12, 12);
		const halfW = tipWidth * 0.5;
		const clampedCenter = clamp(x, halfW, Math.max(halfW, areaW - halfW));
		el.style.opacity = o.toFixed(3);
		el.style.transform = `translate3d(${(clampedCenter - halfW).toFixed(2)}px, 0, 0) rotate(${tilt.toFixed(2)}deg) scale(${sc.toFixed(3)})`;
	}

	function renderSlider() {
		if (!areaEl || !fillEl || !thumbAEl || !thumbBEl || !tipAEl || !tipBEl || !tipMergedEl) {
			return;
		}
		const w = areaWidth || (areaWidth = areaEl.clientWidth);
		if (w <= 0) return;

		// 1) 텍스트 변경분을 먼저 반영 (쓰기 배치)
		const textA = formatWon(va.x, false);
		const textB = formatWon(vb.x, true);
		const mergedText = `${textA} – ${textB}`;

		const changedA = textA !== prevTextA;
		const changedB = textB !== prevTextB;
		const changedMerged = mergedText !== prevTextMerged;

		if (changedA) {
			tipAEl.textContent = textA;
			prevTextA = textA;
		}
		if (changedB) {
			tipBEl.textContent = textB;
			prevTextB = textB;
		}
		if (changedMerged) {
			tipMergedEl.textContent = mergedText;
			prevTextMerged = mergedText;
		}

		// 2) 변경된 말풍선 너비만 측정 (읽기 배치 → 이후 프레임에서는 0 리플로우)
		if (changedA || tipAWidth === 0) tipAWidth = tipAEl.offsetWidth;
		if (changedB || tipBWidth === 0) tipBWidth = tipBEl.offsetWidth;
		if (changedMerged || tipMergedWidth === 0) tipMergedWidth = tipMergedEl.offsetWidth;

		// 3) 계산 및 스타일 반영 (쓰기 전용)
		const span = Math.max(1, max - min);
		const xa = ((va.x - min) / span) * w;
		const xb = ((vb.x - min) / span) * w;

		const safeValA = clamp(Math.round(va.x), min, max) || 0;
		const safeValB = clamp(Math.round(vb.x), min, max) || 0;
		thumbAEl.style.transform = `translate3d(${xa.toFixed(2)}px, 0, 0)`;
		thumbBEl.style.transform = `translate3d(${xb.toFixed(2)}px, 0, 0)`;
		if (safeValA !== prevValA) {
			thumbAEl.setAttribute('aria-valuenow', String(safeValA));
			prevValA = safeValA;
		}
		if (safeValB !== prevValB) {
			thumbBEl.setAttribute('aria-valuenow', String(safeValB));
			prevValB = safeValB;
		}

		const fillLeft = clamp(xa, 0, w);
		const fillRight = clamp(xb, fillLeft, w);
		fillEl.style.transform = `translate3d(${fillLeft.toFixed(2)}px, 0, 0)`;
		fillEl.style.width = `${Math.max(0, fillRight - fillLeft).toFixed(2)}px`;

		const need = (tipAWidth + tipBWidth) * 0.5 + 10;
		mergeSpring.t = xb - xa < need ? 1 : 0;
		const m = clamp(mergeSpring.x, 0, 1);

		const mid = (xa + xb) * 0.5;
		tipAt(tipAEl, tipAWidth, w, xa + (mid - xa) * m, va.v, span, 1 - m, 1 - 0.2 * m);
		tipAt(tipBEl, tipBWidth, w, xb + (mid - xb) * m, vb.v, span, 1 - m, 1 - 0.2 * m);
		tipAt(
			tipMergedEl,
			tipMergedWidth,
			w,
			mid,
			(va.v + vb.v) * 0.5,
			span,
			m,
			0.8 + 0.2 * m
		);
	}

	const springLoop = createSpringLoop({
		springs: [va, vb, mergeSpring],
		isSettled: () =>
			!drag &&
			Math.abs(va.x - va.t) < 0.5 &&
			Math.abs(va.v) < 1 &&
			Math.abs(vb.x - vb.t) < 0.5 &&
			Math.abs(vb.v) < 1 &&
			Math.abs(mergeSpring.x - mergeSpring.t) < 0.004 &&
			Math.abs(mergeSpring.v) < 0.02,
		onFrame: () => renderSlider(),
		onSnap: () => {
			renderSlider();
			mergeSpring.x = mergeSpring.t;
			mergeSpring.v = 0;
			renderSlider();
		}
	});

	function handleThumbDown(e: PointerEvent, s: SpringState, isA: boolean) {
		e.stopPropagation();
		drag = { s, isA };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		springLoop.wake();
	}

	function handleThumbMove(e: PointerEvent, s: SpringState, isA: boolean) {
		if (!drag || drag.s !== s || !areaEl) return;
		const r = areaEl.getBoundingClientRect();
		const span = Math.max(1, max - min);
		let v = clamp(min + ((e.clientX - r.left) / Math.max(1, r.width)) * span, min, max);
		const minGap = Math.max(step, gapV());
		v = isA ? Math.min(v, vb.t - minGap) : Math.max(v, va.t + minGap);
		s.t = snapToStep(v);
		springLoop.wake();
	}

	function handleThumbEnd(s: SpringState) {
		if (!drag || drag.s !== s) return;
		drag = null;
		commitValue();
		springLoop.wake();
	}

	function handleThumbKeyDown(e: KeyboardEvent, s: SpringState, isA: boolean) {
		const d =
			e.key === 'ArrowRight' || e.key === 'ArrowUp'
				? step
				: e.key === 'ArrowLeft' || e.key === 'ArrowDown'
					? -step
					: 0;
		if (!d) return;
		e.preventDefault();
		const minGap = Math.max(step, gapV());
		s.t = isA
			? snapToStep(clamp(s.t + d, min, vb.t - minGap))
			: snapToStep(clamp(s.t + d, va.t + minGap, max));
		commitValue();
		springLoop.wake();
	}

	function handleAreaPointerDown(e: PointerEvent) {
		if (!areaEl) return;
		const r = areaEl.getBoundingClientRect();
		const span = Math.max(1, max - min);
		const clicked = snapToStep(
			clamp(min + ((e.clientX - r.left) / Math.max(1, r.width)) * span, min, max)
		);
		const minGap = Math.max(step, gapV());

		if (Math.abs(clicked - va.t) <= Math.abs(clicked - vb.t)) {
			va.t = snapToStep(Math.min(clicked, vb.t - minGap));
		} else {
			vb.t = snapToStep(Math.max(clicked, va.t + minGap));
		}
		commitValue();
		springLoop.wake();
	}

	function handleReset() {
		va.t = min;
		vb.t = max;
		if (value !== null) {
			value = null;
			onchange?.(null);
		}
		springLoop.wake();
	}

	// 외부 value 변경(예: 전체 초기화 버튼) 시 슬라이더 목표값 동기화
	$effect(() => {
		const targetA = value ? clamp(value[0], min, max) : min;
		const targetB = value ? clamp(value[1], min, max) : max;
		if (!drag && (Math.abs(va.t - targetA) > 0.5 || Math.abs(vb.t - targetB) > 0.5)) {
			va.t = targetA;
			vb.t = targetB;
			springLoop.wake();
		}
	});

	onMount(() => {
		if (!areaEl) return;
		areaWidth = areaEl.clientWidth;
		renderSlider();
		const ro = new ResizeObserver(() => {
			if (!areaEl) return;
			areaWidth = areaEl.clientWidth;
			renderSlider();
		});
		ro.observe(areaEl);
		return () => ro.disconnect();
	});

	onDestroy(() => springLoop.stop());
</script>

<FilterPartCard
	class="price-range-part {klass}"
	{title}
	showCount={false}
	activeCount={isActiveFilter ? 1 : 0}
	onReset={handleReset}
>
	<div class="price-slider-stage">
		<div
			bind:this={areaEl}
			class="range-area"
			onpointerdown={handleAreaPointerDown}
			role="presentation"
		>
			<span bind:this={tipAEl} class="range-tip" aria-hidden="true"></span>
			<span bind:this={tipBEl} class="range-tip" aria-hidden="true"></span>
			<span bind:this={tipMergedEl} class="range-tip" aria-hidden="true"></span>

			<div class="range-track">
				<span bind:this={fillEl} class="range-fill"></span>
			</div>

			<button
				bind:this={thumbAEl}
				type="button"
				class="range-thumb"
				role="slider"
				aria-label="최소 가격"
				aria-valuemin={min}
				aria-valuemax={max}
				aria-valuenow={value ? value[0] : min}
				onpointerdown={(e) => handleThumbDown(e, va, true)}
				onpointermove={(e) => handleThumbMove(e, va, true)}
				onpointerup={() => handleThumbEnd(va)}
				onpointercancel={() => handleThumbEnd(va)}
				onkeydown={(e) => handleThumbKeyDown(e, va, true)}
			></button>

			<button
				bind:this={thumbBEl}
				type="button"
				class="range-thumb"
				role="slider"
				aria-label="최대 가격"
				aria-valuemin={min}
				aria-valuemax={max}
				aria-valuenow={value ? value[1] : max}
				onpointerdown={(e) => handleThumbDown(e, vb, false)}
				onpointermove={(e) => handleThumbMove(e, vb, false)}
				onpointerup={() => handleThumbEnd(vb)}
				onpointercancel={() => handleThumbEnd(vb)}
				onkeydown={(e) => handleThumbKeyDown(e, vb, false)}
			></button>
		</div>
	</div>
</FilterPartCard>

<style>
	.price-slider-stage {
		padding: 34px 12px 6px;
		width: 100%;
		box-sizing: border-box;
	}

	.range-area {
		position: relative;
		height: 24px;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		cursor: pointer;
	}

	.range-track {
		position: absolute;
		left: 0;
		right: 0;
		top: 10px;
		height: 4px;
		border-radius: 999px;
		background: var(--surface-4);
	}

	.range-fill {
		position: absolute;
		left: 0;
		top: 0;
		height: 4px;
		border-radius: 999px;
		background: var(--white-2);
	}

	.range-thumb {
		position: absolute;
		top: 1px;
		left: 0;
		width: 22px;
		height: 22px;
		margin-left: -11px;
		padding: 0;
		border: none;
		border-radius: 999px;
		background: var(--white-2);
		cursor: grab;
		touch-action: none;
		transition: background-color 0.15s ease;
	}

	.range-thumb:hover {
		background: var(--white);
	}

	.range-thumb:active {
		cursor: grabbing;
	}

	.range-thumb:focus-visible {
		outline: 2px solid var(--fg);
		outline-offset: 3px;
	}

	.range-tip {
		position: absolute;
		left: 0;
		bottom: 30px;
		padding: 3px 8px;
		border-radius: 9px;
		background: var(--white-2);
		color: var(--bg);
		font-size: 0.74rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		pointer-events: none;
		transform-origin: 50% 100%;
	}
</style>
