<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import FdDiv from './FdDiv.svelte';
	import { FluidSetting } from '#lib/fluid/setting';

	interface SpringState {
		x: number;
		v: number;
		t: number;
		k: number;
		c: number;
	}

	const DOCK_LEAD = [640, 38] as const;
	const DOCK_TRAIL = [150, 16] as const;
	const DOCK_SYNC = [600, 44] as const;
	const DOCK_NOM = [380, 34] as const;

	export interface SegmentOption {
		/** 항목 고유 값 */
		value: string;
		/** 버튼에 표시할 텍스트 */
		label: string;
		/** 개별 비활성화 여부 */
		disabled?: boolean;
	}

	export type SegmentInput = string | SegmentOption;

	interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'onchange'> {
		/** 세그먼트 버튼 목록 (문자열 또는 { value, label, disabled } 객체 배열) */
		items: SegmentInput[];
		/** 현재 선택된 값 (양방향 바인딩 가능, 미지정 시 첫 번째 항목 자동 선택) */
		value?: string;
		/** 배치 방향 ('horizontal' | 'vertical') */
		orientation?: 'horizontal' | 'vertical';
		/** 다른 버튼이 선택되었을 때 호출되는 콜백 */
		onchange?: (value: string, item: SegmentOption, index: number) => void;
		/** 페이지 이동/새로고침 후에도 마지막 선택을 유지할 스토리지 키 (미지정 시 유지 안 함) */
		persistKey?: string;
		/** 상태 유지 스토리지 종류 ('local' | 'session') */
		storage?: 'local' | 'session';
		/** 전체 비활성화 여부 */
		disabled?: boolean;
		/**
		 * 인디케이터 이동 모드
		 * - false (기본값): 호버 시 활성~호버 버튼까지 영역이 늘어나고 선택 시 줄어드는 모드
		 * - true: 호버 시 늘어나지 않고, 선택 시 Rubber Dock 스타일의 탄성 스트레치 모션으로 빠르게 이동
		 */
		rubberDock?: boolean;

		/* ── FluidSetting 관련 Props ── */
		/** 뒤쪽 FdDiv 인디케이터 설정 (개별 prop과 함께 지정 시 개별 prop 우선) */
		setting?: FluidSetting | Partial<FluidSetting>;
		radius?: number;
		color?: string;
		hoverColor?: string;
		waveColor?: string;
		layers?: number;
		layerGap?: number;
		waveAmp?: number;
		waveLength?: number;
		spin?: number;
		borderWidth?: number;
		borderColor?: string;
		/** 유휴 상태일 때 물결 정지 여부 (미지정 시 호버 중에만 물결 활성화, false 지정 시 항상 물결) */
		pauseWhenIdle?: boolean;

		/* ── 외부 CSS 커스터마이징 클래스 ── */
		/** 개별 버튼 추가 클래스 */
		buttonClass?: string;
		/** 선택된 버튼 추가 클래스 */
		activeButtonClass?: string;
	}

	let {
		items = [],
		value = $bindable<string | undefined>(undefined),
		orientation = 'horizontal',
		onchange,
		persistKey,
		storage = 'local',
		disabled = false,
		rubberDock = false,
		setting,
		radius,
		color,
		hoverColor,
		waveColor,
		layers,
		layerGap,
		waveAmp,
		waveLength,
		spin,
		borderWidth,
		borderColor,
		pauseWhenIdle,
		buttonClass = '',
		activeButtonClass = '',
		class: klass = '',
		...rest
	}: Props = $props();

	const normalizedItems = $derived<SegmentOption[]>(
		items.map((item) => (typeof item === 'string' ? { value: item, label: item } : item))
	);

	function getStorage(): Storage | null {
		if (typeof window === 'undefined' || !persistKey) return null;
		try {
			return storage === 'session' ? window.sessionStorage : window.localStorage;
		} catch {
			return null;
		}
	}

	function findFirstEnabledIndex(list: SegmentOption[]): number {
		const idx = list.findIndex((item) => !item.disabled);
		return idx >= 0 ? idx : 0;
	}

	// 초기/목록 변경 시 유효한 선택값 보장 (기본값: 가장 앞 버튼)
	$effect(() => {
		const list = normalizedItems;
		if (list.length === 0) return;

		const exists = value !== undefined && list.some((item) => item.value === value && !item.disabled);
		if (!exists) {
			value = list[findFirstEnabledIndex(list)]?.value;
		}
	});

	const activeIndex = $derived.by(() => {
		if (normalizedItems.length === 0) return -1;
		const idx = normalizedItems.findIndex((item) => item.value === value);
		return idx >= 0 ? idx : findFirstEnabledIndex(normalizedItems);
	});

	let hoveredIndex = $state<number | null>(null);
	let containerEl: HTMLDivElement | undefined = $state(undefined);
	let buttonEls: Array<HTMLButtonElement | undefined> = $state([]);

	interface IndicatorRect {
		x: number;
		y: number;
		width: number;
		height: number;
		ready: boolean;
	}

	let indicatorRect = $state<IndicatorRect>({
		x: 0,
		y: 0,
		width: 0,
		height: 0,
		ready: false
	});

	const isHovering = $derived(hoveredIndex !== null && !disabled);

	const resolvedSetting = $derived.by(() => {
		const base =
			setting !== undefined
				? FluidSetting.from(setting)
				: new FluidSetting({
						radius: 999,
						reach: 0,
						bulge: 0,
						layers: 2,
						color: 'var(--surface-2, #2e2e2e)',
						hoverColor: 'var(--surface-2, #2e2e2e)',
						pressColor: 'var(--surface-2, #2e2e2e)',
						waveColor: 'var(--line, #3b3b3b)',
						borderWidth: 0,
						hoverReactive: false,
						bulgeReactive: false,
						clickReactive: false
					});

		const patch: Partial<FluidSetting> = {
			// pauseWhenIdle이 명시되지 않으면 호버 시에만 물결 활성화
			pauseWhenIdle: pauseWhenIdle ?? !isHovering
		};

		if (radius !== undefined) patch.radius = radius;
		if (color !== undefined) patch.color = color;
		if (hoverColor !== undefined) patch.hoverColor = hoverColor;
		if (waveColor !== undefined) patch.waveColor = waveColor;
		if (layers !== undefined) patch.layers = layers;
		if (layerGap !== undefined) patch.layerGap = layerGap;
		if (waveAmp !== undefined) patch.waveAmp = waveAmp;
		if (waveLength !== undefined) patch.waveLength = waveLength;
		if (spin !== undefined) patch.spin = spin;
		if (borderWidth !== undefined) patch.borderWidth = borderWidth;
		if (borderColor !== undefined) patch.borderColor = borderColor;

		return base.with(patch);
	});

	const indicatorInset = $derived(resolvedSetting.computedInset);

	// ── Rubber Dock 스프링 상태 (rubberDock = true 전용) ──
	const makeSpring = (x = 0, k = 400, c = 30): SpringState => ({ x, v: 0, t: x, k, c });
	const L = makeSpring();
	const R = makeSpring();
	const T = makeSpring();
	const B = makeSpring();
	const NomW = makeSpring();
	const NomH = makeSpring();
	const allSprings = [L, R, T, B, NomW, NomH];

	let springReady = false;
	let lastSpringActiveIndex = -1;
	let springRafId = 0;
	let springLastTime = 0;
	let prefersReducedMotion = false;

	function clampVal(v: number, a: number, b: number): number {
		return Math.max(a, Math.min(b, v));
	}

	function tuneSpring(s: SpringState, [k, c]: readonly [number, number]) {
		s.k = k;
		s.c = prefersReducedMotion ? 2 * Math.sqrt(k) : c;
	}

	function stepSpring(s: SpringState, dt: number) {
		const a = -s.k * (s.x - s.t) - s.c * s.v;
		s.v += a * dt;
		s.x += s.v * dt;
	}

	function stopSpringLoop() {
		if (springRafId) {
			cancelAnimationFrame(springRafId);
			springRafId = 0;
		}
	}

	function applyRubberRect() {
		const l = Math.min(L.x, R.x);
		const r = Math.max(L.x, R.x);
		const t = Math.min(T.x, B.x);
		const b = Math.max(T.x, B.x);
		const rawW = Math.max(r - l, 12);
		const rawH = Math.max(b - t, 12);

		let ix = l;
		let iy = t;
		let iw = rawW;
		let ih = rawH;

		if (orientation === 'horizontal') {
			const baseW = Math.max(NomW.x, 12);
			const squash = clampVal(1 / Math.sqrt(rawW / baseW), 0.66, 1.1);
			ih = rawH * squash;
			iy = t + (rawH - ih) / 2;
		} else {
			const baseH = Math.max(NomH.x, 12);
			const squash = clampVal(1 / Math.sqrt(rawH / baseH), 0.66, 1.1);
			iw = rawW * squash;
			ix = l + (rawW - iw) / 2;
		}

		indicatorRect = {
			x: ix,
			y: iy,
			width: Math.max(0, iw),
			height: Math.max(0, ih),
			ready: true
		};
	}

	function snapSprings(left: number, right: number, top: number, bottom: number) {
		stopSpringLoop();
		const w = Math.max(0, right - left);
		const h = Math.max(0, bottom - top);
		L.x = L.t = left;
		L.v = 0;
		R.x = R.t = right;
		R.v = 0;
		T.x = T.t = top;
		T.v = 0;
		B.x = B.t = bottom;
		B.v = 0;
		NomW.x = NomW.t = w;
		NomW.v = 0;
		NomH.x = NomH.t = h;
		NomH.v = 0;
		applyRubberRect();
	}

	function tickSprings(now: number) {
		springRafId = 0;
		const dt = Math.min((now - springLastTime) / 1000, 1 / 30) || 1 / 60;
		springLastTime = now;

		// Rubber Dock과 동일한 4-서브스텝 적분으로 높은 강성(--dock-lead: 640 38)에서도 안정성 보장
		const sub = 4;
		const subDt = dt / sub;
		for (let k = 0; k < sub; k++) {
			for (let i = 0; i < allSprings.length; i++) {
				stepSpring(allSprings[i], subDt);
			}
		}

		let settled = true;
		for (let i = 0; i < allSprings.length; i++) {
			const s = allSprings[i];
			if (Math.abs(s.x - s.t) > 0.05 || Math.abs(s.v) > 0.2) {
				settled = false;
				break;
			}
		}

		if (settled) {
			for (let i = 0; i < allSprings.length; i++) {
				allSprings[i].x = allSprings[i].t;
				allSprings[i].v = 0;
			}
			applyRubberRect();
			return;
		}

		applyRubberRect();
		springRafId = requestAnimationFrame(tickSprings);
	}

	function wakeSprings() {
		if (springRafId) return;
		springLastTime = performance.now();
		springRafId = requestAnimationFrame(tickSprings);
	}

	function measureIndicator() {
		if (!containerEl || activeIndex < 0) {
			stopSpringLoop();
			springReady = false;
			lastSpringActiveIndex = -1;
			indicatorRect = { x: 0, y: 0, width: 0, height: 0, ready: false };
			return;
		}

		const activeBtn = buttonEls[activeIndex];
		if (!activeBtn) {
			stopSpringLoop();
			springReady = false;
			lastSpringActiveIndex = -1;
			indicatorRect = { x: 0, y: 0, width: 0, height: 0, ready: false };
			return;
		}

		if (rubberDock) {
			const targetL = activeBtn.offsetLeft;
			const targetR = targetL + activeBtn.offsetWidth;
			const targetT = activeBtn.offsetTop;
			const targetB = targetT + activeBtn.offsetHeight;
			const targetW = Math.max(0, targetR - targetL);
			const targetH = Math.max(0, targetB - targetT);

			if (!springReady) {
				springReady = true;
				lastSpringActiveIndex = activeIndex;
				snapSprings(targetL, targetR, targetT, targetB);
				return;
			}

			if (activeIndex === lastSpringActiveIndex) {
				const changed =
					Math.abs(L.t - targetL) > 0.5 ||
					Math.abs(R.t - targetR) > 0.5 ||
					Math.abs(T.t - targetT) > 0.5 ||
					Math.abs(B.t - targetB) > 0.5;
				if (changed) {
					if (springRafId) {
						L.t = targetL;
						R.t = targetR;
						T.t = targetT;
						B.t = targetB;
						NomW.t = targetW;
						NomH.t = targetH;
					} else {
						snapSprings(targetL, targetR, targetT, targetB);
					}
				}
				return;
			}

			lastSpringActiveIndex = activeIndex;

			if (orientation === 'horizontal') {
				const dir = Math.sign((targetL + targetR) / 2 - (L.x + R.x) / 2);
				if (dir === 0) {
					tuneSpring(L, DOCK_SYNC);
					tuneSpring(R, DOCK_SYNC);
				} else {
					// 진행 방향 앞쪽(leading)은 빠르게, 뒤쪽(trailing)은 느리게 따라오며 고무처럼 늘어남
					const leftTune = dir > 0 ? DOCK_TRAIL : DOCK_LEAD;
					const rightTune = dir > 0 ? DOCK_LEAD : DOCK_TRAIL;
					tuneSpring(L, leftTune);
					tuneSpring(R, rightTune);
				}
				tuneSpring(T, DOCK_SYNC);
				tuneSpring(B, DOCK_SYNC);
				tuneSpring(NomW, DOCK_NOM);
				tuneSpring(NomH, DOCK_SYNC);
			} else {
				const dir = Math.sign((targetT + targetB) / 2 - (T.x + B.x) / 2);
				if (dir === 0) {
					tuneSpring(T, DOCK_SYNC);
					tuneSpring(B, DOCK_SYNC);
				} else {
					const topTune = dir > 0 ? DOCK_TRAIL : DOCK_LEAD;
					const bottomTune = dir > 0 ? DOCK_LEAD : DOCK_TRAIL;
					tuneSpring(T, topTune);
					tuneSpring(B, bottomTune);
				}
				tuneSpring(L, DOCK_SYNC);
				tuneSpring(R, DOCK_SYNC);
				tuneSpring(NomW, DOCK_SYNC);
				tuneSpring(NomH, DOCK_NOM);
			}

			L.t = targetL;
			R.t = targetR;
			T.t = targetT;
			B.t = targetB;
			NomW.t = targetW;
			NomH.t = targetH;
			wakeSprings();
			return;
		}

		stopSpringLoop();
		springReady = false;
		lastSpringActiveIndex = activeIndex;

		const hoverBtn =
			hoveredIndex !== null && hoveredIndex !== activeIndex ? buttonEls[hoveredIndex] : undefined;

		// 활성화 버튼과 호버 버튼을 모두 감싸는 bounding box 계산
		const minLeft = hoverBtn ? Math.min(activeBtn.offsetLeft, hoverBtn.offsetLeft) : activeBtn.offsetLeft;
		const minTop = hoverBtn ? Math.min(activeBtn.offsetTop, hoverBtn.offsetTop) : activeBtn.offsetTop;
		const maxRight = hoverBtn
			? Math.max(activeBtn.offsetLeft + activeBtn.offsetWidth, hoverBtn.offsetLeft + hoverBtn.offsetWidth)
			: activeBtn.offsetLeft + activeBtn.offsetWidth;
		const maxBottom = hoverBtn
			? Math.max(activeBtn.offsetTop + activeBtn.offsetHeight, hoverBtn.offsetTop + hoverBtn.offsetHeight)
			: activeBtn.offsetTop + activeBtn.offsetHeight;

		indicatorRect = {
			x: minLeft,
			y: minTop,
			width: Math.max(0, maxRight - minLeft),
			height: Math.max(0, maxBottom - minTop),
			ready: true
		};
	}

	onMount(() => {
		const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
		prefersReducedMotion = reduceMq.matches;
		const handleReduceChange = (e: MediaQueryListEvent) => {
			prefersReducedMotion = e.matches;
		};
		reduceMq.addEventListener('change', handleReduceChange);

		// 1. 스토리지 복원 (persistKey가 있을 때만)
		const store = getStorage();
		if (store && persistKey) {
			const saved = store.getItem(persistKey);
			if (saved !== null) {
				const matched = normalizedItems.find((item) => item.value === saved && !item.disabled);
				if (matched) {
					value = matched.value;
				}
			}
		}

		void tick().then(measureIndicator);

		if (!containerEl) {
			return () => {
				reduceMq.removeEventListener('change', handleReduceChange);
				stopSpringLoop();
			};
		}
		const ro = new ResizeObserver(() => {
			measureIndicator();
		});
		ro.observe(containerEl);
		for (const btn of buttonEls) {
			if (btn) ro.observe(btn);
		}

		return () => {
			reduceMq.removeEventListener('change', handleReduceChange);
			ro.disconnect();
			stopSpringLoop();
		};
	});

	// 선택 인덱스, 호버 인덱스, 방향, 항목, 이동 모드 변경 시 인디케이터 위치 재계산
	$effect(() => {
		void activeIndex;
		void hoveredIndex;
		void orientation;
		void normalizedItems.length;
		void rubberDock;
		void tick().then(measureIndicator);
	});

	function handleSelect(item: SegmentOption, index: number) {
		if (disabled || item.disabled) return;
		const prevValue = value;
		value = item.value;

		// 누른 버튼만 감싸도록 호버 범위를 현재 선택 버튼과 일치시킴
		if (hoveredIndex !== null) {
			hoveredIndex = index;
		}

		const store = getStorage();
		if (store && persistKey) {
			try {
				store.setItem(persistKey, item.value);
			} catch {
				// 스토리지 용량/권한 오류 무시
			}
		}

		if (prevValue !== item.value) {
			onchange?.(item.value, item, index);
		}
	}

	function handleButtonPointerEnter(e: PointerEvent, index: number, item: SegmentOption) {
		if (disabled || item.disabled) return;
		if (e.pointerType === 'touch') return;
		hoveredIndex = index;
	}

	function handleContainerPointerLeave() {
		hoveredIndex = null;
	}
</script>

<div
	bind:this={containerEl}
	class="fd-seg-control {klass}"
	class:is-vertical={orientation === 'vertical'}
	class:is-disabled={disabled}
	class:is-rubber-dock={rubberDock}
	role="radiogroup"
	aria-orientation={orientation}
	onpointerleave={handleContainerPointerLeave}
	{...rest}
>
	{#if indicatorRect.ready && indicatorRect.width > 0 && indicatorRect.height > 0}
		<div
			class="fd-seg-indicator"
			aria-hidden="true"
			style:left="{indicatorRect.x - indicatorInset}px"
			style:top="{indicatorRect.y - indicatorInset}px"
			style:width="{indicatorRect.width + indicatorInset * 2}px"
			style:height="{indicatorRect.height + indicatorInset * 2}px"
		>
			<FdDiv
				setting={resolvedSetting}
				{disabled}
				fullWidth={true}
				staticFrontWave={true}
				class="fd-seg-fd-wrap"
				bodyClass="fd-seg-fd-body"
			/>
		</div>
	{/if}

	{#each normalizedItems as item, idx (item.value)}
		{@const isActive = idx === activeIndex}
		<button
			bind:this={buttonEls[idx]}
			type="button"
			role="radio"
			aria-checked={isActive}
			disabled={disabled || item.disabled}
			class="fd-seg-btn {buttonClass} {isActive ? `is-active ${activeButtonClass}` : ''}"
			onpointerenter={(e) => handleButtonPointerEnter(e, idx, item)}
			onclick={() => handleSelect(item, idx)}
		>
			{item.label}
		</button>
	{/each}
</div>

<style>
	.fd-seg-control {
		position: relative;
		display: inline-flex;
		flex-direction: row;
		align-items: center;
		gap: var(--fd-seg-gap, 4px);
		isolation: isolate;
	}

	.fd-seg-control.is-vertical {
		flex-direction: column;
		align-items: stretch;
	}

	.fd-seg-control.is-disabled {
		opacity: 0.55;
		pointer-events: none;
	}

	.fd-seg-indicator {
		position: absolute;
		top: 0;
		left: 0;
		z-index: 0;
		pointer-events: none;
		transition:
			left 0.32s cubic-bezier(0.22, 1, 0.36, 1),
			top 0.32s cubic-bezier(0.22, 1, 0.36, 1),
			width 0.32s cubic-bezier(0.22, 1, 0.36, 1),
			height 0.32s cubic-bezier(0.22, 1, 0.36, 1);
		will-change: left, top, width, height;
	}

	.fd-seg-control.is-rubber-dock .fd-seg-indicator {
		transition: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.fd-seg-indicator {
			transition: none;
		}
	}

	:global(.fd-wrap.fd-seg-fd-wrap) {
		width: 100%;
		height: 100%;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr);
	}

	:global(.fd-wrap.fd-seg-fd-wrap .fd-body.fd-seg-fd-body) {
		width: 100%;
		height: 100%;
		padding: 0;
		min-width: 0;
		min-height: 0;
	}

	/* 버튼 기본 형태: border/배경 없이 글자만 표시 (외부 CSS로 자유롭게 스타일 지정 가능) */
	.fd-seg-btn {
		position: relative;
		z-index: 1;
		background: transparent;
		border: none;
		margin: 0;
		padding: var(--fd-seg-btn-padding, 0.45em 0.9em);
		font: inherit;
		color: var(--fd-seg-color, var(--muted, inherit));
		cursor: pointer;
		white-space: nowrap;
		-webkit-tap-highlight-color: transparent;
		transition: color 0.2s ease;
	}

	.fd-seg-btn:not(.is-active):not(:disabled):hover {
		color: var(--fd-seg-hover-color, var(--fg, inherit));
	}

	.fd-seg-btn.is-active {
		color: var(--fd-seg-active-color, var(--fg, inherit));
	}

	.fd-seg-btn:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}
</style>
