<script lang="ts">
	import { onMount, tick, type Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import FdDiv from './FdDiv.svelte';
	import { FluidSetting } from '#lib/common/type/fluid';

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
	const SLOT_TUNE = [380, 36] as const;

	export interface SegmentOption {
		/** 항목 고유 값 */
		value: string;
		/** 버튼에 표시할 텍스트 */
		label: string;
		/** 개별 비활성화 여부 */
		disabled?: boolean;
	}

	export interface SegmentMergeConfig {
		/** 병합 상태 여부 (true면 targetValues 항목들이 하나로 모아지며 mergedOption으로 전환) */
		active: boolean;
		/** 하나로 합쳐질 연속 항목들의 value 목록 */
		targetValues: string[];
		/** 병합되었을 때 표시할 단일 항목 */
		mergedOption: SegmentOption;
	}

	export type SegmentInput = string | SegmentOption;

	interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'onchange'> {
		/** 세그먼트 버튼 목록 (문자열 또는 { value, label, disabled } 객체 배열) */
		items: SegmentInput[];
		/** 현재 선택된 값 (양방향 바인딩 가능, 미지정 시 첫 번째 항목 자동 선택) */
		value?: string;
		/** 배치 방향 ('horizontal' | 'vertical') */
		orientation?: 'horizontal' | 'vertical';
		/** 특정 연속 항목들을 하나의 항목으로 자연스럽게 모으거나 펼치는 설정 */
		merge?: SegmentMergeConfig;
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
		reach?: number;
		bulge?: number;
		bulgeWidth?: number;
		bulgeReactive?: boolean;
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
		/** 기본 라벨 대신 렌더링할 커스텀 항목 콘텐츠 스니펫 */
		itemContent?: Snippet<[{ item: SegmentOption; isActive: boolean; index: number }]>;
	}

	let {
		items = [],
		value = $bindable<string | undefined>(undefined),
		orientation = 'horizontal',
		merge,
		onchange,
		persistKey,
		storage = 'local',
		disabled = false,
		rubberDock = false,
		setting,
		radius,
		reach,
		bulge,
		bulgeWidth,
		bulgeReactive,
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
		itemContent,
		class: klass = '',
		...rest
	}: Props = $props();

	const normalizedItems = $derived<SegmentOption[]>(
		items.map((item) => (typeof item === 'string' ? { value: item, label: item } : item))
	);

	const mergeSlice = $derived.by(() => {
		if (!merge || merge.targetValues.length === 0 || orientation !== 'horizontal') {
			return {
				hasMerge: false,
				active: false,
				start: -1,
				before: normalizedItems,
				group: [] as SegmentOption[],
				after: [] as SegmentOption[]
			};
		}
		const start = normalizedItems.findIndex((item) => item.value === merge.targetValues[0]);
		if (start < 0 || start + merge.targetValues.length > normalizedItems.length) {
			return {
				hasMerge: false,
				active: false,
				start: -1,
				before: normalizedItems,
				group: [] as SegmentOption[],
				after: [] as SegmentOption[]
			};
		}
		const matchesAll = merge.targetValues.every(
			(val, offset) => normalizedItems[start + offset]?.value === val
		);
		if (!matchesAll) {
			return {
				hasMerge: false,
				active: false,
				start: -1,
				before: normalizedItems,
				group: [] as SegmentOption[],
				after: [] as SegmentOption[]
			};
		}
		return {
			hasMerge: true,
			active: merge.active,
			start,
			before: normalizedItems.slice(0, start),
			group: normalizedItems.slice(start, start + merge.targetValues.length),
			after: normalizedItems.slice(start + merge.targetValues.length)
		};
	});

	const visibleItems = $derived.by(() => {
		if (!mergeSlice.hasMerge || !mergeSlice.active || !merge) return normalizedItems;
		return [...mergeSlice.before, merge.mergedOption, ...mergeSlice.after];
	});

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
		const list = visibleItems;
		if (list.length === 0) return;

		const exists = value !== undefined && list.some((item) => item.value === value && !item.disabled);
		if (!exists) {
			value = list[findFirstEnabledIndex(list)]?.value;
		}
	});

	const activeVisibleIndex = $derived.by(() => {
		if (visibleItems.length === 0) return -1;
		const idx = visibleItems.findIndex((item) => item.value === value);
		return idx >= 0 ? idx : findFirstEnabledIndex(visibleItems);
	});

	const activeKey = $derived(activeVisibleIndex >= 0 ? visibleItems[activeVisibleIndex]?.value : undefined);

	let hoveredIndex = $state<number | null>(null);
	let containerEl: HTMLDivElement | undefined = $state(undefined);
	let buttonEls: Array<HTMLButtonElement | undefined> = $state([]);
	let mergeSlotEl: HTMLDivElement | undefined = $state(undefined);
	let expandedGroupEl: HTMLDivElement | undefined = $state(undefined);
	let mergedBtnEl: HTMLButtonElement | undefined = $state(undefined);

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
		if (reach !== undefined) patch.reach = reach;
		if (bulge !== undefined) patch.bulge = bulge;
		if (bulgeWidth !== undefined) patch.bulgeWidth = bulgeWidth;
		if (bulgeReactive !== undefined) patch.bulgeReactive = bulgeReactive;
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

	// ── Rubber Dock + 병합 슬롯 폭 스프링 상태 ──
	const makeSpring = (x = 0, k = 400, c = 30): SpringState => ({ x, v: 0, t: x, k, c });
	const L = makeSpring();
	const R = makeSpring();
	const T = makeSpring();
	const B = makeSpring();
	const NomW = makeSpring();
	const NomH = makeSpring();
	const SlotW = makeSpring(0, SLOT_TUNE[0], SLOT_TUNE[1]);
	const allSprings = [L, R, T, B, NomW, NomH, SlotW];

	let springReady = false;
	let slotSpringReady = false;
	let rubberInFlight = false;
	let lastSpringActiveKey: string | undefined = undefined;
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

	function getRelativeRect(el: HTMLElement, container: HTMLElement) {
		let left = 0;
		let top = 0;
		let cur: HTMLElement | null = el;
		while (cur && cur !== container) {
			left += cur.offsetLeft;
			top += cur.offsetTop;
			cur = cur.offsetParent as HTMLElement | null;
		}
		return {
			left,
			top,
			width: el.offsetWidth,
			height: el.offsetHeight
		};
	}

	function findButtonElByKey(key: string | undefined): HTMLButtonElement | undefined {
		if (key === undefined) return undefined;
		if (mergeSlice.hasMerge && mergeSlice.active && merge && key === merge.mergedOption.value) {
			return mergedBtnEl;
		}
		const idx = normalizedItems.findIndex((item) => item.value === key);
		return idx >= 0 ? buttonEls[idx] : undefined;
	}

	function measureMergeTargetWidth(): number | null {
		if (!mergeSlice.hasMerge || !expandedGroupEl || !mergedBtnEl) return null;
		const targetW = mergeSlice.active ? mergedBtnEl.offsetWidth : expandedGroupEl.offsetWidth;
		return targetW > 0 ? targetW : null;
	}

	function isSlotMoving(): boolean {
		return (
			mergeSlice.hasMerge &&
			slotSpringReady &&
			(Math.abs(SlotW.x - SlotW.t) > 0.1 || Math.abs(SlotW.v) > 0.2)
		);
	}

	function syncSlotSpringTarget(): boolean {
		if (!mergeSlice.hasMerge) {
			slotSpringReady = false;
			SlotW.x = SlotW.t = 0;
			SlotW.v = 0;
			if (mergeSlotEl) mergeSlotEl.style.width = '';
			return false;
		}
		const targetW = measureMergeTargetWidth();
		if (targetW === null) return false;

		if (!slotSpringReady || prefersReducedMotion) {
			slotSpringReady = true;
			SlotW.x = SlotW.t = targetW;
			SlotW.v = 0;
			if (mergeSlotEl) mergeSlotEl.style.width = `${targetW.toFixed(2)}px`;
			return false;
		}

		tuneSpring(SlotW, SLOT_TUNE);
		SlotW.t = targetW;
		return Math.abs(SlotW.x - SlotW.t) > 0.25;
	}

	function syncIndicatorWithShiftedEl(el: HTMLElement, snapImmediate: boolean) {
		if (!containerEl) return;
		if (snapImmediate) {
			syncIndicatorTargetsToEl(el, true);
			return;
		}
		const rect = getRelativeRect(el, containerEl);
		const deltaL = rect.left - L.t;
		const deltaR = rect.left + rect.width - R.t;
		L.x += deltaL;
		R.x += deltaR;
		syncIndicatorTargetsToEl(el, false);
	}

	function syncIndicatorTargetsToEl(el: HTMLElement, snapImmediate: boolean) {
		if (!containerEl) return;
		const rect = getRelativeRect(el, containerEl);
		const targetL = rect.left;
		const targetR = rect.left + rect.width;
		const targetT = rect.top;
		const targetB = rect.top + rect.height;
		L.t = targetL;
		R.t = targetR;
		T.t = targetT;
		B.t = targetB;
		NomW.t = rect.width;
		NomH.t = rect.height;
		if (snapImmediate) {
			L.x = targetL;
			L.v = 0;
			R.x = targetR;
			R.v = 0;
			T.x = targetT;
			T.v = 0;
			B.x = targetB;
			B.v = 0;
			NomW.x = rect.width;
			NomW.v = 0;
			NomH.x = rect.height;
			NomH.v = 0;
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
		rubberInFlight = false;
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

		const slotMovingNow = isSlotMoving();
		if (mergeSlice.hasMerge && mergeSlotEl && slotSpringReady) {
			mergeSlotEl.style.width = `${Math.max(0, SlotW.x).toFixed(2)}px`;
		}

		const activeBtn = findButtonElByKey(activeKey);
		if (activeBtn && containerEl && mergeSlice.hasMerge && slotMovingNow) {
			syncIndicatorWithShiftedEl(activeBtn, !rubberInFlight);
		}

		let indicatorSettled = true;
		for (let i = 0; i < 6; i++) {
			const s = allSprings[i];
			if (Math.abs(s.x - s.t) > 0.05 || Math.abs(s.v) > 0.2) {
				indicatorSettled = false;
				break;
			}
		}
		if (indicatorSettled) {
			rubberInFlight = false;
		}

		const settled = indicatorSettled && !slotMovingNow;

		if (settled) {
			for (let i = 0; i < allSprings.length; i++) {
				allSprings[i].x = allSprings[i].t;
				allSprings[i].v = 0;
			}
			if (mergeSlice.hasMerge && mergeSlotEl && slotSpringReady) {
				mergeSlotEl.style.width = `${Math.max(0, SlotW.t).toFixed(2)}px`;
				if (activeBtn && containerEl) {
					syncIndicatorTargetsToEl(activeBtn, true);
				}
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
		const slotNeedsAnim = syncSlotSpringTarget();

		if (!containerEl || activeKey === undefined) {
			stopSpringLoop();
			springReady = false;
			lastSpringActiveKey = undefined;
			indicatorRect = { x: 0, y: 0, width: 0, height: 0, ready: false };
			return;
		}

		const activeBtn = findButtonElByKey(activeKey);
		if (!activeBtn) {
			stopSpringLoop();
			springReady = false;
			lastSpringActiveKey = undefined;
			indicatorRect = { x: 0, y: 0, width: 0, height: 0, ready: false };
			return;
		}

		const rect = getRelativeRect(activeBtn, containerEl);

		if (rubberDock) {
			const targetL = rect.left;
			const targetR = rect.left + rect.width;
			const targetT = rect.top;
			const targetB = rect.top + rect.height;
			const targetW = rect.width;
			const targetH = rect.height;

			if (!springReady) {
				springReady = true;
				lastSpringActiveKey = activeKey;
				snapSprings(targetL, targetR, targetT, targetB);
				return;
			}

			if (activeKey === lastSpringActiveKey) {
				if (slotNeedsAnim || isSlotMoving()) {
					if (rubberInFlight) {
						const nearlySettled = Math.abs(L.x - L.t) < 6 && Math.abs(R.x - R.t) < 6;
						if (nearlySettled) {
							rubberInFlight = false;
							syncIndicatorTargetsToEl(activeBtn, true);
						} else {
							// 슬롯 폭 전환 도중 잔여 러버독 이동이 남아 있으면 대칭 동기화 스프링으로 전환해 화면 좌표 기준 반동 방지
							tuneSpring(L, DOCK_SYNC);
							tuneSpring(R, DOCK_SYNC);
							syncIndicatorWithShiftedEl(activeBtn, false);
						}
					} else {
						syncIndicatorTargetsToEl(activeBtn, true);
					}
					applyRubberRect();
					wakeSprings();
					return;
				}
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

			lastSpringActiveKey = activeKey;
			rubberInFlight = true;

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
		lastSpringActiveKey = activeKey;

		const hoverBtn =
			hoveredIndex === -2
				? mergeSlice.active
					? mergedBtnEl
					: undefined
				: hoveredIndex !== null
					? buttonEls[hoveredIndex]
					: undefined;
		const validHoverBtn = hoverBtn && hoverBtn !== activeBtn ? hoverBtn : undefined;
		const hoverRect = validHoverBtn ? getRelativeRect(validHoverBtn, containerEl) : null;

		// 활성화 버튼과 호버 버튼을 모두 감싸는 bounding box 계산
		const minLeft = hoverRect ? Math.min(rect.left, hoverRect.left) : rect.left;
		const minTop = hoverRect ? Math.min(rect.top, hoverRect.top) : rect.top;
		const maxRight = hoverRect
			? Math.max(rect.left + rect.width, hoverRect.left + hoverRect.width)
			: rect.left + rect.width;
		const maxBottom = hoverRect
			? Math.max(rect.top + rect.height, hoverRect.top + hoverRect.height)
			: rect.top + rect.height;

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
				const matched = visibleItems.find((item) => item.value === saved && !item.disabled);
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
		if (expandedGroupEl) ro.observe(expandedGroupEl);
		if (mergedBtnEl) ro.observe(mergedBtnEl);

		return () => {
			reduceMq.removeEventListener('change', handleReduceChange);
			ro.disconnect();
			stopSpringLoop();
		};
	});

	// 선택 키, 병합 상태, 호버 인덱스, 방향, 항목, 이동 모드 변경 시 인디케이터 위치 재계산
	$effect(() => {
		void activeKey;
		void mergeSlice.hasMerge;
		void mergeSlice.active;
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

		const isMergedItem = mergeSlice.hasMerge && merge && item.value === merge.mergedOption.value;
		const store = getStorage();
		if (store && persistKey && !isMergedItem) {
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

	{#if mergeSlice.hasMerge && merge}
		{#each mergeSlice.before as item, idx (item.value)}
			{@const isActive = item.value === activeKey}
			<button
				bind:this={buttonEls[idx]}
				type="button"
				role="radio"
				aria-checked={isActive}
				aria-label={itemContent ? item.label : undefined}
				disabled={disabled || item.disabled}
				class="fd-seg-btn {buttonClass} {isActive ? `is-active ${activeButtonClass}` : ''}"
				onpointerenter={(e) => handleButtonPointerEnter(e, idx, item)}
				onclick={() => handleSelect(item, idx)}
			>
				{#if itemContent}
					{@render itemContent({ item, isActive, index: idx })}
				{:else}
					<span class="fd-seg-label">{item.label}</span>
				{/if}
			</button>
		{/each}

		{@const isMergedActive = mergeSlice.active && merge.mergedOption.value === activeKey}
		<div
			bind:this={mergeSlotEl}
			class="fd-seg-merge-slot"
			class:is-merged={mergeSlice.active}
		>
			<div
				bind:this={expandedGroupEl}
				class="fd-seg-merge-expanded"
				aria-hidden={mergeSlice.active}
				inert={mergeSlice.active || undefined}
			>
				{#each mergeSlice.group as item, offset (item.value)}
					{@const idx = mergeSlice.start + offset}
					{@const isActive = !mergeSlice.active && item.value === activeKey}
					<button
						bind:this={buttonEls[idx]}
						type="button"
						role={mergeSlice.active ? undefined : 'radio'}
						aria-checked={mergeSlice.active ? undefined : isActive}
						tabindex={mergeSlice.active ? -1 : undefined}
						disabled={disabled || item.disabled}
						class="fd-seg-btn fd-seg-merge-source {buttonClass} {isActive ? `is-active ${activeButtonClass}` : ''}"
						onpointerenter={(e) => {
							if (!mergeSlice.active) handleButtonPointerEnter(e, idx, item);
						}}
						onclick={() => {
							if (!mergeSlice.active) handleSelect(item, idx);
						}}
					>
						<span class="fd-seg-label">{item.label}</span>
					</button>
				{/each}
			</div>

			<button
				bind:this={mergedBtnEl}
				type="button"
				role={mergeSlice.active ? 'radio' : undefined}
				aria-checked={mergeSlice.active ? isMergedActive : undefined}
				tabindex={!mergeSlice.active ? -1 : undefined}
				disabled={disabled || merge.mergedOption.disabled}
				class="fd-seg-btn fd-seg-merged-btn {buttonClass} {isMergedActive ? `is-active ${activeButtonClass}` : ''}"
				aria-hidden={!mergeSlice.active}
				inert={!mergeSlice.active || undefined}
				onpointerenter={(e) => {
					if (mergeSlice.active) handleButtonPointerEnter(e, -2, merge.mergedOption);
				}}
				onclick={() => {
					if (mergeSlice.active) handleSelect(merge.mergedOption, mergeSlice.start);
				}}
			>
				<span class="fd-seg-label">{merge.mergedOption.label}</span>
			</button>
		</div>

		{#each mergeSlice.after as item, offset (item.value)}
			{@const idx = mergeSlice.start + mergeSlice.group.length + offset}
			{@const isActive = item.value === activeKey}
			<button
				bind:this={buttonEls[idx]}
				type="button"
				role="radio"
				aria-checked={isActive}
				aria-label={itemContent ? item.label : undefined}
				disabled={disabled || item.disabled}
				class="fd-seg-btn {buttonClass} {isActive ? `is-active ${activeButtonClass}` : ''}"
				onpointerenter={(e) => handleButtonPointerEnter(e, idx, item)}
				onclick={() => handleSelect(item, idx)}
			>
				{#if itemContent}
					{@render itemContent({ item, isActive, index: idx })}
				{:else}
					<span class="fd-seg-label">{item.label}</span>
				{/if}
			</button>
		{/each}
	{:else}
		{#each normalizedItems as item, idx (item.value)}
			{@const isActive = idx === activeVisibleIndex}
			<button
				bind:this={buttonEls[idx]}
				type="button"
				role="radio"
				aria-checked={isActive}
				aria-label={itemContent ? item.label : undefined}
				disabled={disabled || item.disabled}
				class="fd-seg-btn {buttonClass} {isActive ? `is-active ${activeButtonClass}` : ''}"
				onpointerenter={(e) => handleButtonPointerEnter(e, idx, item)}
				onclick={() => handleSelect(item, idx)}
			>
				{#if itemContent}
					{@render itemContent({ item, isActive, index: idx })}
				{:else}
					<span class="fd-seg-label">{item.label}</span>
				{/if}
			</button>
		{/each}
	{/if}
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
		font-weight: var(--fw-medium, 500);
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

	.fd-seg-label {
		display: inline-block;
		will-change: transform, opacity, filter;
	}

	.fd-seg-merge-slot {
		position: relative;
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		overflow: visible;
	}

	.fd-seg-merge-expanded {
		display: inline-flex;
		align-items: center;
		gap: var(--fd-seg-gap, 4px);
		width: max-content;
		flex-shrink: 0;
	}

	.fd-seg-merge-slot.is-merged .fd-seg-merge-expanded {
		pointer-events: none;
	}

	/* 병합 전 왼쪽 그룹(추천, 인기): 모아질 때 중앙으로 수렴하며 블러 페이드아웃 */
	.fd-seg-merge-source .fd-seg-label {
		opacity: 1;
		filter: blur(0px);
		transform: translate3d(0, 0, 0) scale(1);
		transition:
			opacity 0.24s cubic-bezier(0.22, 1, 0.36, 1) 0.05s,
			filter 0.26s cubic-bezier(0.22, 1, 0.36, 1) 0.05s,
			transform 0.32s cubic-bezier(0.22, 1, 0.36, 1) 0.04s;
	}

	.fd-seg-merge-source:first-child .fd-seg-label {
		transform-origin: center center;
	}

	.fd-seg-merge-source:nth-child(2) .fd-seg-label {
		transform-origin: left center;
	}

	.fd-seg-merge-slot.is-merged .fd-seg-merge-source:first-child .fd-seg-label {
		opacity: 0;
		filter: blur(3px);
		transform: translate3d(8px, 0, 0) scale(0.84);
		transition:
			opacity 0.18s ease,
			filter 0.2s ease,
			transform 0.24s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.fd-seg-merge-slot.is-merged .fd-seg-merge-source:nth-child(n + 2) .fd-seg-label {
		opacity: 0;
		filter: blur(3px);
		transform: translate3d(-34px, 0, 0) scale(0.84);
		transition:
			opacity 0.2s ease,
			filter 0.22s ease,
			transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
	}

	/* 병합 후 단일 버튼(전체): 왼쪽 슬롯에 고정 배치되어 수렴 지점에서 등장 */
	.fd-seg-merged-btn {
		position: absolute;
		left: 0;
		top: 0;
		height: 100%;
		width: max-content;
		pointer-events: none;
	}

	.fd-seg-merge-slot.is-merged .fd-seg-merged-btn {
		pointer-events: auto;
	}

	.fd-seg-merged-btn .fd-seg-label {
		opacity: 0;
		filter: blur(3px);
		transform: translate3d(8px, 0, 0) scale(0.86);
		transition:
			opacity 0.16s ease,
			filter 0.16s ease,
			transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.fd-seg-merge-slot.is-merged .fd-seg-merged-btn .fd-seg-label {
		opacity: 1;
		filter: blur(0px);
		transform: translate3d(0, 0, 0) scale(1);
		transition:
			opacity 0.26s cubic-bezier(0.22, 1, 0.36, 1) 0.07s,
			filter 0.28s cubic-bezier(0.22, 1, 0.36, 1) 0.07s,
			transform 0.32s cubic-bezier(0.22, 1, 0.36, 1) 0.06s;
	}

	@media (prefers-reduced-motion: reduce) {
		.fd-seg-merge-source .fd-seg-label,
		.fd-seg-merged-btn .fd-seg-label {
			transition: none;
		}
	}
</style>
