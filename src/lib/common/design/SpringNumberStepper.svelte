<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import SlidingNumber from '#lib/common/design/SlidingNumber.svelte';

	interface Props {
		value: number;
		min?: number;
		max?: number;
		disabled?: boolean;
		ariaLabel?: string;
		onStep: (delta: number) => void;
	}

	let {
		value,
		min = 1,
		max = 10,
		disabled = false,
		ariaLabel = '수량 선택',
		onStep
	}: Props = $props();

	interface SpringState {
		x: number;
		v: number;
		t: number;
		k: number;
		c: number;
	}

	let minusEl = $state<HTMLButtonElement | null>(null);
	let plusEl = $state<HTMLButtonElement | null>(null);
	let numEl = $state<HTMLDivElement | null>(null);

	let reduceMotion = false;
	let rafId = 0;
	let lastTime = 0;

	const makeSpring = (x: number, k = 400, c = 30): SpringState => ({ x, v: 0, t: x, k, c });

	function stepSpring(s: SpringState, dt: number) {
		const a = -s.k * (s.x - s.t) - s.c * s.v;
		s.v += a * dt;
		s.x += s.v * dt;
	}

	function isSettled(s: SpringState, eps = 0.004): boolean {
		return Math.abs(s.x - s.t) <= eps && Math.abs(s.v) <= eps * 10;
	}

	// Number Stepper 한계 벽 충돌 반동 스프링
	const KM = makeSpring(0, 600, 14);
	const KP = makeSpring(0, 600, 14);
	const NN = makeSpring(0, 500, 16);

	const isAtMin = $derived(value <= min);
	const isAtMax = $derived(value >= max);

	function handleStep(delta: -1 | 1) {
		if (disabled) return;
		const next = value + delta;
		if (next < min || next > max) {
			if (!reduceMotion) {
				if (delta < 0) {
					KM.v = -300;
				} else {
					KP.v = 300;
				}
				NN.v = 160 * delta;
				wakeLoop();
			}
			return;
		}
		onStep(delta);
	}

	function renderFrame() {
		if (minusEl) {
			minusEl.style.transform = `translate3d(${(KM.x * 0.06).toFixed(2)}px, 0, 0)`;
		}
		if (plusEl) {
			plusEl.style.transform = `translate3d(${(KP.x * 0.06).toFixed(2)}px, 0, 0)`;
		}
		if (numEl) {
			numEl.style.transform = `translate3d(${(NN.x * 0.04).toFixed(2)}px, 0, 0)`;
		}
	}

	function tickLoop(now: number) {
		rafId = 0;
		const dt = Math.min((now - lastTime) / 1000, 1 / 30) || 1 / 60;
		lastTime = now;

		const sub = 4;
		const subDt = dt / sub;
		for (let i = 0; i < sub; i++) {
			stepSpring(KM, subDt);
			stepSpring(KP, subDt);
			stepSpring(NN, subDt);
		}

		renderFrame();

		const moving = !isSettled(KM, 0.08) || !isSettled(KP, 0.08) || !isSettled(NN, 0.08);
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
		renderFrame();

		return () => {
			mq.removeEventListener('change', onReduceChange);
		};
	});

	onDestroy(() => {
		if (rafId) cancelAnimationFrame(rafId);
	});
</script>

<!-- 스프링 수량 스테퍼 (공용 SlidingNumber 자릿수 롤링 + 최소/최대 한계 충돌 반동, 순수 렌더링) -->
<div class="spring-stepper" class:is-disabled={disabled} role="group" aria-label={ariaLabel}>
	<button
		bind:this={minusEl}
		type="button"
		class="stp-btn"
		class:is-limit={isAtMin}
		{disabled}
		aria-label="수량 감소"
		aria-disabled={disabled || isAtMin}
		onclick={() => handleStep(-1)}
	>
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path d="M6 12h12" />
		</svg>
	</button>

	<div bind:this={numEl} class="stp-num" aria-live="polite">
		<SlidingNumber {value} thousandSeparator="" />
	</div>

	<button
		bind:this={plusEl}
		type="button"
		class="stp-btn"
		class:is-limit={isAtMax}
		{disabled}
		aria-label="수량 증가"
		aria-disabled={disabled || isAtMax}
		onclick={() => handleStep(1)}
	>
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path d="M6 12h12M12 6v12" />
		</svg>
	</button>
</div>

<style>
	.spring-stepper {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 48px;
		padding: 0 7px;
		box-sizing: border-box;
		border-radius: 14px;
		background: var(--surface);
		border: none;
		user-select: none;
		-webkit-user-select: none;
	}

	.spring-stepper.is-disabled {
		opacity: 0.45;
		pointer-events: none;
	}

	.stp-btn {
		width: 34px;
		height: 34px;
		padding: 0;
		border: none;
		border-radius: 999px;
		background: color-mix(in srgb, var(--white) 9%, transparent);
		color: var(--white);
		cursor: pointer;
		display: grid;
		place-items: center;
		will-change: transform;
		transition:
			opacity 0.2s ease,
			background-color 0.16s ease;
		-webkit-tap-highlight-color: transparent;
	}

	.stp-btn:hover:not(.is-limit):not(:disabled) {
		background: color-mix(in srgb, var(--white) 16%, transparent);
	}

	.stp-btn:focus-visible {
		outline: 2px solid var(--white-2);
		outline-offset: 2px;
	}

	.stp-btn.is-limit {
		opacity: 0.38;
	}

	.stp-btn svg {
		width: 16px;
		height: 16px;
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 2.2;
	}

	.stp-num {
		position: relative;
		min-width: 36px;
		height: 28px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 1.15rem;
		font-weight: var(--fw-bold);
		font-variant-numeric: tabular-nums;
		color: var(--white);
		will-change: transform;
	}
</style>
