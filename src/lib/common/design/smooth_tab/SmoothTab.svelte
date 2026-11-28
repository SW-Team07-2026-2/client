<script lang="ts">
	import type { Snippet } from 'svelte';
	import { untrack } from 'svelte';

	export interface SmoothTabItem {
		id: string;
		title: string;
		/** 탭 라벨 옆에 표시할 짧은 배지 (예: '기본') */
		badge?: string;
	}

	interface Props {
		items: readonly SmoothTabItem[];
		/** 비제어 초기 선택 탭 ID */
		defaultTabId?: string;
		/** 제어 선택 탭 ID */
		value?: string;
		/** 탭 변경 콜백 */
		onChange?: (tabId: string) => void;
		/** 탭 리스트 정렬 */
		align?: 'start' | 'center';
		/** 접근성 탭 리스트 라벨 */
		label?: string;
		/** 패널 카드 표시 및 스와이프 활성화 여부 (panel 스니펫이 있을 때 기본 true) */
		swipeable?: boolean;
		/** 추가 CSS 클래스 */
		class?: string;
		/** 각 탭에 대응하는 패널 렌더 스니펫 (생략 시 탭 바만 렌더링) */
		panel?: Snippet<[SmoothTabItem, number]>;
	}

	let {
		items,
		defaultTabId,
		value,
		onChange,
		align = 'start',
		label = '탭 목록',
		swipeable = true,
		class: klass = '',
		panel
	}: Props = $props();

	// Kokonut UI SmoothTab v2.0.0 물리 상수
	const RUBBER_BAND = 0.35;
	const SWIPE_VELOCITY = 0.11; // px/ms
	const AXIS_LOCK = 6;
	const VELOCITY_WINDOW = 100;
	const NEIGHBOUR_OPACITY = 0.35;
	const SPRING_K = 420;
	const SPRING_C = 38;

	interface TabRect {
		left: number;
		width: number;
		top: number;
		height: number;
	}

	interface DragState {
		pointerId: number;
		startX: number;
		startY: number;
		startProgress: number;
		axis: 'x' | 'y' | null;
		width: number;
		samples: Array<{ x: number; t: number }>;
	}

	const rawUid = $props.id();
	const baseId = `smooth-tab-${rawUid.replace(/[^a-zA-Z0-9_-]/g, '')}`;

	const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
	const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

	function indicatorRect(rects: TabRect[], pVal: number): TabRect | null {
		const last = rects.length - 1;
		if (last < 0) return null;
		const p = clamp(pVal, 0, last);
		const i = Math.min(Math.floor(p), Math.max(last - 1, 0));
		const a = rects[i];
		const b = rects[Math.min(i + 1, last)];
		const t = p - i;
		let left = lerp(a.left, b.left, t);
		let width = lerp(a.width, b.width, t);
		const over = pVal < 0 ? -pVal : pVal - last;
		if (over > 0) {
			const squash = width * Math.min(over, 0.5) * 0.4;
			width -= squash;
			if (pVal > last) {
				left += squash;
			}
		}
		return { left, width, top: a.top, height: a.height };
	}

	function rubberBand(raw: number, last: number): number {
		if (raw < 0) return raw * RUBBER_BAND;
		if (raw > last) return last + (raw - last) * RUBBER_BAND;
		return raw;
	}

	function findIndex(id: string | undefined): number {
		if (!id) return 0;
		const idx = items.findIndex((item) => item.id === id);
		return idx >= 0 ? idx : 0;
	}

	let uncontrolledIndex = $state(untrack(() => findIndex(defaultTabId)));
	const count = $derived(items.length);
	const selected = $derived(
		value === undefined
			? clamp(uncontrolledIndex, 0, Math.max(count - 1, 0))
			: clamp(findIndex(value), 0, Math.max(count - 1, 0))
	);

	let tablistEl = $state<HTMLDivElement | null>(null);
	let overlayEl = $state<HTMLDivElement | null>(null);
	let viewportEl = $state<HTMLDivElement | null>(null);
	let trackEl = $state<HTMLDivElement | null>(null);
	let tabEls: Array<HTMLButtonElement | undefined> = $state([]);
	let panelEls: Array<HTMLDivElement | undefined> = $state([]);

	let rects: TabRect[] = [];
	let panelHeights: number[] = [];
	let listSize = { width: 0, height: 0 };

	// 물리 상태 (React re-render 없이 직접 DOM 페인트)
	let curProgress = untrack(() => selected);
	let curVelocity = 0;
	let targetProgress = curProgress;
	let rafId = 0;
	let lastTs = 0;
	let reducedMotion = false;
	let drag: DragState | null = null;
	let suppressClick = false;
	let isDragging = $state(false);

	function paint(p: number) {
		const n = Math.max(1, items.length);
		if (trackEl) {
			trackEl.style.transform = `translate3d(${((-p * 100) / n).toFixed(4)}%, 0, 0)`;
		}
		for (let i = 0; i < n; i++) {
			const panelEl = panelEls[i];
			if (panelEl) {
				const d = Math.min(Math.abs(p - i), 1);
				panelEl.style.opacity = (1 - d * (1 - NEIGHBOUR_OPACITY)).toFixed(3);
			}
		}
		if (viewportEl && panelHeights.length > 0) {
			const last = panelHeights.length - 1;
			const clamped = clamp(p, 0, last);
			const i = Math.min(Math.floor(clamped), Math.max(last - 1, 0));
			const t = clamped - i;
			const hA = panelHeights[i] ?? 0;
			const hB = panelHeights[Math.min(i + 1, last)] ?? hA;
			const h = lerp(hA, hB, t);
			if (h > 0) {
				viewportEl.style.height = `${h.toFixed(2)}px`;
			}
		}
		const r = indicatorRect(rects, p);
		if (overlayEl && r) {
			const right = Math.max(0, listSize.width - r.left - r.width);
			const bottom = Math.max(0, listSize.height - r.top - r.height);
			overlayEl.style.clipPath = `inset(${r.top.toFixed(2)}px ${right.toFixed(2)}px ${bottom.toFixed(2)}px ${r.left.toFixed(2)}px round ${(r.height / 2).toFixed(2)}px)`;
		}
	}

	function stopAnim() {
		if (rafId) {
			cancelAnimationFrame(rafId);
			rafId = 0;
		}
		lastTs = 0;
	}

	function stepLoop(now: number) {
		rafId = 0;
		const dt = lastTs ? Math.min((now - lastTs) / 1000, 1 / 30) : 1 / 60;
		lastTs = now;

		const sub = 4;
		const subDt = dt / sub;
		const c = reducedMotion ? 2 * Math.sqrt(SPRING_K) : SPRING_C;
		for (let s = 0; s < sub; s++) {
			const acc = -SPRING_K * (curProgress - targetProgress) - c * curVelocity;
			curVelocity += acc * subDt;
			curProgress += curVelocity * subDt;
		}

		if (
			Math.abs(curProgress - targetProgress) < 0.0008 &&
			Math.abs(curVelocity) < 0.008
		) {
			curProgress = targetProgress;
			curVelocity = 0;
			paint(curProgress);
			return;
		}

		paint(curProgress);
		rafId = requestAnimationFrame(stepLoop);
	}

	function settle(index: number, opts?: { instant?: boolean; velocity?: number }) {
		targetProgress = index;
		stopAnim();
		if (opts?.instant || reducedMotion) {
			curProgress = index;
			curVelocity = 0;
			paint(curProgress);
			return;
		}
		curVelocity = opts?.velocity ?? curVelocity;
		lastTs = performance.now();
		rafId = requestAnimationFrame(stepLoop);
	}

	function select(index: number, opts?: { instant?: boolean; velocity?: number }) {
		if (count === 0) return;
		const next = clamp(index, 0, count - 1);
		settle(next, opts);
		if (next !== selected) {
			uncontrolledIndex = next;
			onChange?.(items[next].id);
		}
	}

	function measure() {
		if (!tablistEl) return;
		const box = tablistEl.getBoundingClientRect();
		const ratio = box.width / (tablistEl.offsetWidth || 1);
		const scale = Math.abs(ratio - 1) < 0.01 ? 1 : ratio;
		listSize = { width: box.width / scale, height: box.height / scale };
		rects = items.map((_, i) => {
			const tab = tabEls[i];
			const r = tab?.getBoundingClientRect();
			return r
				? {
						left: (r.left - box.left) / scale,
						width: r.width / scale,
						top: (r.top - box.top) / scale,
						height: r.height / scale
					}
				: { left: 0, width: 0, top: 0, height: 0 };
		});
		paint(curProgress);
	}

	// 탭 목록 크기/개수 변경 및 폰트 로드 시 재측정
	$effect(() => {
		const el = tablistEl;
		void items.length;
		void items.map((item) => `${item.id}:${item.title}:${item.badge ?? ''}`).join('|');
		if (!el) return;

		let alive = true;
		const safeMeasure = () => {
			if (alive) measure();
		};
		safeMeasure();
		const ro = new ResizeObserver(safeMeasure);
		ro.observe(el);
		if (typeof document !== 'undefined' && document.fonts?.ready) {
			document.fonts.ready.then(safeMeasure).catch(() => undefined);
		}

		return () => {
			alive = false;
			ro.disconnect();
		};
	});

	function measurePanels() {
		if (!viewportEl) return;
		panelHeights = items.map((_, i) => panelEls[i]?.offsetHeight ?? 0);
		paint(curProgress);
	}

	// 각 패널 자연 높이 측정 및 변동 추적 (활성 탭 높이에 맞춰 뷰포트 높이를 스프링 보간)
	$effect(() => {
		const vp = viewportEl;
		void items.length;
		if (!vp) return;

		let alive = true;
		const safeMeasurePanels = () => {
			if (alive) measurePanels();
		};
		safeMeasurePanels();

		const ro = new ResizeObserver(safeMeasurePanels);
		for (let i = 0; i < items.length; i++) {
			const pEl = panelEls[i];
			if (pEl) ro.observe(pEl);
		}

		return () => {
			alive = false;
			ro.disconnect();
		};
	});

	// reduced-motion 동기화 및 언마운트 정리
	$effect(() => {
		if (typeof window === 'undefined') return;
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		const sync = () => {
			reducedMotion = mq.matches;
		};
		sync();
		mq.addEventListener('change', sync);
		return () => {
			mq.removeEventListener('change', sync);
			stopAnim();
		};
	});

	// 외부 value 변경 추종
	$effect(() => {
		const sel = selected;
		untrack(() => {
			if (!drag && sel !== targetProgress) {
				settle(sel);
			}
			// 선택된 탭이 스크롤 영역 밖에 있으면 부드럽게 보이도록 스크롤
			tabEls[sel]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
		});
	});

	function handleTabKeyDown(e: KeyboardEvent, i: number) {
		if (count < 2) return;
		const keys: Record<string, number> = {
			ArrowRight: (i + 1) % count,
			ArrowLeft: (i - 1 + count) % count,
			Home: 0,
			End: count - 1
		};
		const next = keys[e.key];
		if (next === undefined) return;
		e.preventDefault();
		tabEls[next]?.focus();
		select(next, { instant: e.repeat });
	}

	function onPointerDown(e: PointerEvent) {
		if (!swipeable || count < 2) return;
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		// 입력 필드 내부의 커서 드래그·텍스트 선택은 스와이프로 가로채지 않음
		const target = e.target as HTMLElement | null;
		if (target?.closest('input, textarea, select')) return;

		const host = e.currentTarget as HTMLDivElement;
		drag = {
			pointerId: e.pointerId,
			startX: e.clientX,
			startY: e.clientY,
			startProgress: curProgress,
			axis: null,
			width: host.clientWidth || 1,
			samples: [{ x: e.clientX, t: e.timeStamp }]
		};
	}

	function onPointerMove(e: PointerEvent) {
		const current = drag;
		if (!current || current.pointerId !== e.pointerId) return;

		if (current.axis === null) {
			const dx = e.clientX - current.startX;
			const dy = e.clientY - current.startY;
			if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK) return;
			current.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
			if (current.axis === 'x') {
				stopAnim();
				current.startProgress = curProgress;
				current.startX = e.clientX;
				current.samples = [{ x: e.clientX, t: e.timeStamp }];
				(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
				isDragging = true;
			}
		}

		if (current.axis !== 'x') return;

		current.samples.push({ x: e.clientX, t: e.timeStamp });
		while (current.samples.length > 2 && e.timeStamp - current.samples[0].t > VELOCITY_WINDOW) {
			current.samples.shift();
		}

		const raw = current.startProgress - (e.clientX - current.startX) / current.width;
		curProgress = rubberBand(raw, count - 1);
		paint(curProgress);
	}

	function endDrag(e: PointerEvent, cancelled: boolean) {
		const current = drag;
		if (!current || current.pointerId !== e.pointerId) return;
		drag = null;
		isDragging = false;
		if (current.axis !== 'x') return;

		if (!cancelled) {
			suppressClick = true;
			window.setTimeout(() => {
				suppressClick = false;
			}, 0);
		}

		const first = current.samples[0];
		const vx = (e.clientX - first.x) / Math.max(e.timeStamp - first.t, 1);
		const p = curProgress;
		let next = Math.round(p);
		if (!cancelled && Math.abs(vx) > SWIPE_VELOCITY) {
			next = vx < 0 ? Math.floor(p) + 1 : Math.ceil(p) - 1;
		}
		select(next, { velocity: (-vx * 1000) / current.width });
	}

	function handleClickCapture(e: MouseEvent) {
		if (suppressClick) {
			suppressClick = false;
			e.preventDefault();
			e.stopPropagation();
		}
	}

	const tabId = (i: number) => `${baseId}-tab-${i}`;
	const panelId = (i: number) => `${baseId}-panel-${i}`;
</script>

<!-- Kokonut UI SmoothTab v2.0.0 스펙 기반 공용 스와이프 탭 (클립-패스 인디케이터 · 스프링 물리 · 러버밴드 스와이프) -->
<div class="smooth-tab {klass}">
	<div class="smooth-tab-bar-scroll" class:is-center={align === 'center'}>
		<div bind:this={tablistEl} class="smooth-tablist" role="tablist" aria-label={label}>
			{#each items as item, i (item.id)}
				{@const isSelected = i === selected}
				<button
					bind:this={tabEls[i]}
					id={tabId(i)}
					type="button"
					role="tab"
					aria-selected={isSelected}
					aria-controls={panel ? panelId(i) : undefined}
					tabindex={isSelected ? 0 : -1}
					class="smooth-tab-btn"
					onclick={() => select(i)}
					onkeydown={(e) => handleTabKeyDown(e, i)}
				>
					<span class="smooth-tab-title">{item.title}</span>
					{#if item.badge}
						<span class="smooth-tab-badge">{item.badge}</span>
					{/if}
				</button>
			{/each}

			<!-- 활성 필 오버레이: 동일 라벨을 활성 색으로 렌더링하고 clip-path로 인디케이터 영역만 정밀 클리핑 -->
			<div
				bind:this={overlayEl}
				class="smooth-tab-overlay"
				aria-hidden="true"
				style:clip-path="inset(0 100% 0 0)"
			>
				{#each items as item (item.id)}
					<span class="smooth-tab-overlay-item">
						<span class="smooth-tab-title">{item.title}</span>
						{#if item.badge}
							<span class="smooth-tab-badge is-active">{item.badge}</span>
						{/if}
					</span>
				{/each}
			</div>
		</div>
	</div>

	{#if panel}
		<div
			bind:this={viewportEl}
			role="region"
			aria-label={label}
			class="smooth-tab-viewport"
			class:is-dragging={isDragging}
			onclickcapture={handleClickCapture}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={(e) => endDrag(e, false)}
			onpointercancel={(e) => endDrag(e, true)}
			onlostpointercapture={(e) => endDrag(e, false)}
		>
			<div
				bind:this={trackEl}
				class="smooth-tab-track"
				style:width="{Math.max(1, count) * 100}%"
			>
				{#each items as item, i (item.id)}
					<div
						bind:this={panelEls[i]}
						id={panelId(i)}
						role="tabpanel"
						aria-labelledby={tabId(i)}
						inert={i !== selected}
						tabindex={i === selected ? 0 : -1}
						class="smooth-tab-panel"
						style:width="{100 / Math.max(1, count)}%"
					>
						{@render panel(item, i)}
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.smooth-tab {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		width: 100%;
		min-width: 0;
	}

	.smooth-tab-bar-scroll {
		display: flex;
		justify-content: flex-start;
		max-width: 100%;
		overflow-x: auto;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
	}

	.smooth-tab-bar-scroll::-webkit-scrollbar {
		display: none;
	}

	.smooth-tab-bar-scroll.is-center {
		justify-content: center;
	}

	.smooth-tablist {
		position: relative;
		display: inline-flex;
		align-items: center;
		padding: 4px;
		border-radius: 999px;
		background: var(--surface);
		flex-shrink: 0;
	}

	.smooth-tab-btn,
	.smooth-tab-overlay-item {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		height: 34px;
		padding: 0 0.9rem;
		border-radius: 999px;
		font-size: 0.84rem;
		font-weight: var(--fw-semibold);
		line-height: 1;
		white-space: nowrap;
		flex-shrink: 0;
		box-sizing: border-box;
	}

	.smooth-tab-btn {
		position: relative;
		border: none;
		background: transparent;
		color: var(--muted);
		font-family: inherit;
		cursor: pointer;
		outline: none;
		-webkit-tap-highlight-color: transparent;
		transition: color 150ms ease-out;
	}

	.smooth-tab-btn:hover {
		color: var(--white);
	}

	.smooth-tab-btn:focus-visible {
		outline: 2px solid var(--muted);
		outline-offset: 2px;
	}

	.smooth-tab-overlay {
		position: absolute;
		inset: 0;
		display: inline-flex;
		align-items: center;
		padding: 4px;
		background: var(--white-2);
		pointer-events: none;
	}

	.smooth-tab-overlay-item {
		color: var(--bg);
	}

	.smooth-tab-title {
		white-space: nowrap;
	}

	.smooth-tab-badge {
		padding: 0.14rem 0.38rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--white) 12%, transparent);
		color: var(--fg);
		font-size: 0.66rem;
		font-weight: var(--fw-bold);
		line-height: 1.1;
	}

	.smooth-tab-badge.is-active {
		background: color-mix(in srgb, var(--bg) 16%, transparent);
		color: var(--bg);
	}

	.smooth-tab-viewport {
		position: relative;
		width: 100%;
		overflow: hidden;
		touch-action: pan-y;
	}

	.smooth-tab-viewport.is-dragging {
		cursor: grabbing;
		user-select: none;
	}

	.smooth-tab-track {
		display: flex;
		align-items: flex-start;
		will-change: transform;
	}

	.smooth-tab-panel {
		flex-shrink: 0;
		min-width: 0;
		box-sizing: border-box;
		outline: none;
	}
</style>
