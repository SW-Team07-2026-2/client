<script lang="ts">
	import FdLine from '#lib/common/design/fluid/FdLine.svelte';
	import type { ToastItem, ToastSwipeDirection } from '#lib/common/logic/toast.svelte';

	interface Props {
		item: ToastItem;
		/** 스택 내 순서 (0 = 최전면) */
		index: number;
		/** 펼쳐진 상태 여부 (뷰포트 호버·포커스) */
		expanded: boolean;
		/** 펼쳐졌을 때 이 토스트가 위로 밀려나야 하는 누적 오프셋(px) */
		expandedOffsetY: number;
		/** 최전면 토스트 높이(px, 접힘 상태에서 뒤쪽 토스트 높이 동기화용) */
		frontHeight: number;
		/** 스와이프 닫기 허용 방향 */
		swipeDirections: readonly ToastSwipeDirection[];
		/** 남은 시간 프로그레스 바 표시 여부 */
		progressBar: boolean;
		/** 타이머 일시정지 여부 */
		paused: boolean;
		onDismiss: (
			id: number,
			reason: 'dismiss' | 'swipe',
			swipeExit?: { x: number; y: number; durationMs: number }
		) => void;
		onMeasureHeight: (id: number, height: number) => void;
	}

	let {
		item,
		index,
		expanded,
		expandedOffsetY,
		frontHeight,
		swipeDirections,
		progressBar,
		paused,
		onDismiss,
		onMeasureHeight
	}: Props = $props();

	let rootEl = $state<HTMLDivElement | null>(null);
	let measuredHeight = $state(0);

	// 스와이프 제스처 상태
	let dragging = $state(false);
	let dragX = $state(0);
	let dragY = $state(0);
	let startX = 0;
	let startY = 0;
	let lastX = 0;
	let lastY = 0;
	let lastTime = 0;
	let velocityX = 0;
	let velocityY = 0;
	let lockedAxis: 'x' | 'y' | null = null;
	let activePointerId: number | null = null;

	const isBehind = $derived(index > 0 && !expanded);
	const showProgress = $derived(
		(item.progressBar ?? progressBar) &&
			item.type !== 'loading' &&
			item.duration > 0 &&
			(index === 0 || expanded)
	);

	const statusWaveColor = $derived.by(() => {
		switch (item.type) {
			case 'success':
				return 'var(--toast-success-wave)';
			case 'error':
				return 'var(--toast-error-wave)';
			case 'warning':
				return 'var(--white-2)';
			case 'loading':
				return 'var(--muted)';
			default:
				return 'var(--toast-info-wave)';
		}
	});

	const progressLineSetting = $derived({
		color: statusWaveColor,
		waveColor: statusWaveColor,
		layers: 2,
		layerGap: 4,
		waveAmp: 4.2,
		waveLength: 48,
		spin: -3.4
	});

	// FdLine progress(1 -> 0)를 캔버스 재할당 없이 부드럽게 구동해 끝단 수렴 곡선을 유지
	let barProgress = $state(1);
	let lastUpdateKey = $state(-1);

	$effect(() => {
		const key = item.updateKey;
		if (key !== lastUpdateKey) {
			lastUpdateKey = key;
			barProgress = 1;
		}
	});

	$effect(() => {
		if (!showProgress || paused || item.duration <= 0 || item.state === 'exiting') return;
		let rafId = 0;
		let lastTs = performance.now();
		const duration = item.duration;

		const step = (now: number) => {
			const dt = Math.max(0, Math.min(100, now - lastTs));
			lastTs = now;
			barProgress = Math.max(0, barProgress - dt / duration);
			if (barProgress > 0) {
				rafId = requestAnimationFrame(step);
			}
		};

		rafId = requestAnimationFrame(step);
		return () => {
			if (rafId) cancelAnimationFrame(rafId);
		};
	});

	// 허용되지 않은 방향 드래그 시 최대 48px까지 부드럽게 저항하는 러버밴드
	function rubberBand(delta: number): number {
		const sign = delta < 0 ? -1 : 1;
		const abs = Math.abs(delta);
		return sign * 48 * (1 - Math.exp(-abs / 96));
	}

	function isDirectionAllowed(axis: 'x' | 'y', delta: number): boolean {
		if (axis === 'x') {
			return delta < 0
				? swipeDirections.includes('left')
				: swipeDirections.includes('right');
		}
		return delta < 0 ? swipeDirections.includes('up') : swipeDirections.includes('down');
	}

	// 스택 기준 변환 계산 (접힘: step당 scale -0.05, 최소 0.9, 위로 12px 씩 노출 / 펼침: 누적 오프셋)
	const stackScale = $derived(expanded ? 1 : Math.max(0.9, 1 - index * 0.05));
	const stackY = $derived(expanded ? -expandedOffsetY : -index * 12);

	const swipeOpacity = $derived.by(() => {
		if (!dragging) return 1;
		const w = rootEl?.offsetWidth || 320;
		const h = rootEl?.offsetHeight || 64;
		let ratio = 0;
		if (lockedAxis === 'x' && isDirectionAllowed('x', dragX)) {
			ratio = Math.min(1, Math.abs(dragX) / w);
		} else if (lockedAxis === 'y' && isDirectionAllowed('y', dragY)) {
			ratio = Math.min(1, Math.abs(dragY) / Math.max(h * 1.6, 96));
		}
		return Math.max(0, 1 - ratio);
	});

	const inlineStyle = $derived.by(() => {
		const zIndex = 100 - index;
		const cascadeDelay = expanded ? index * 30 : index * 20;

		if (item.state === 'entering') {
			return `z-index:${zIndex};transform:translate3d(0,calc(100% + 16px),0) scale(0.96);opacity:0;filter:blur(4px);`;
		}

		if (item.state === 'exiting') {
			if (item.exitReason === 'swipe' && item.swipeExit) {
				const { x, y, durationMs } = item.swipeExit;
				return `z-index:${zIndex};transform:translate3d(${x.toFixed(1)}px,${(stackY + y).toFixed(1)}px,0) scale(${stackScale});opacity:0;transition:transform ${durationMs}ms linear,opacity ${durationMs}ms linear;`;
			}
			return `z-index:${zIndex};transform:translate3d(0,calc(${stackY}px + 100% + 16px),0) scale(0.96);opacity:0;filter:blur(4px);transition:transform 200ms cubic-bezier(0.33,0.17,0.67,0.5),opacity 200ms cubic-bezier(0.33,0.17,0.67,0.5),filter 200ms cubic-bezier(0.33,0.17,0.67,0.5);`;
		}

		if (dragging) {
			return `z-index:${zIndex};transform:translate3d(${dragX.toFixed(1)}px,${(stackY + dragY).toFixed(1)}px,0) scale(${stackScale});opacity:${swipeOpacity.toFixed(3)};filter:blur(0px);transition:none;`;
		}

		const heightRule =
			!expanded && index > 0 && frontHeight > 0 ? `height:${frontHeight}px;` : '';
		return `z-index:${zIndex};${heightRule}transform:translate3d(0,${stackY}px,0) scale(${stackScale});opacity:1;filter:blur(0px);transition-delay:${cascadeDelay}ms;`;
	});

	$effect(() => {
		if (!rootEl) return;
		const el = rootEl;
		const report = () => {
			if (!expanded && index > 0) return;
			const h = el.offsetHeight;
			if (h > 0 && h !== measuredHeight) {
				measuredHeight = h;
				onMeasureHeight(item.id, h);
			}
		};
		report();
		const ro = new ResizeObserver(report);
		ro.observe(el);
		return () => ro.disconnect();
	});

	function handlePointerDown(e: PointerEvent) {
		if (item.state === 'exiting') return;
		if ((e.target as HTMLElement | null)?.closest?.('[data-toast-close]')) return;
		if (e.pointerType === 'mouse' && e.button !== 0) return;

		activePointerId = e.pointerId;
		dragging = true;
		lockedAxis = null;
		startX = lastX = e.clientX;
		startY = lastY = e.clientY;
		lastTime = performance.now();
		velocityX = 0;
		velocityY = 0;
		dragX = 0;
		dragY = 0;

		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function handlePointerMove(e: PointerEvent) {
		if (!dragging || activePointerId !== e.pointerId) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;

		if (!lockedAxis && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
			lockedAxis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
		}

		const now = performance.now();
		const dt = Math.max(1, now - lastTime);
		velocityX = (e.clientX - lastX) / dt;
		velocityY = (e.clientY - lastY) / dt;
		lastX = e.clientX;
		lastY = e.clientY;
		lastTime = now;

		if (lockedAxis === 'x') {
			dragX = isDirectionAllowed('x', dx) ? dx : rubberBand(dx);
			dragY = 0;
		} else if (lockedAxis === 'y') {
			dragX = 0;
			dragY = isDirectionAllowed('y', dy) ? dy : rubberBand(dy);
		}
	}

	function finishSwipe(e: PointerEvent, cancelled = false) {
		if (!dragging || activePointerId !== e.pointerId) return;
		dragging = false;
		activePointerId = null;

		if (!cancelled && lockedAxis) {
			const w = rootEl?.offsetWidth || 320;
			const h = rootEl?.offsetHeight || 64;

			if (lockedAxis === 'x' && isDirectionAllowed('x', dragX)) {
				const speed = Math.abs(velocityX);
				const passed = Math.abs(dragX) > w * 0.32 || (speed > 0.45 && Math.abs(dragX) > 24);
				if (passed) {
					const dir = dragX < 0 ? -1 : 1;
					const targetX = dir * (w + 32);
					const remaining = Math.max(20, Math.abs(targetX - dragX));
					const durationMs = Math.round(
						Math.max(80, Math.min(360, remaining / Math.max(speed, 0.75)))
					);
					onDismiss(item.id, 'swipe', { x: targetX, y: 0, durationMs });
					return;
				}
			} else if (lockedAxis === 'y' && isDirectionAllowed('y', dragY)) {
				const speed = Math.abs(velocityY);
				const passed =
					Math.abs(dragY) > Math.max(h * 0.55, 36) || (speed > 0.42 && Math.abs(dragY) > 18);
				if (passed) {
					const dir = dragY < 0 ? -1 : 1;
					const targetY = dir * (h + 48);
					const remaining = Math.max(20, Math.abs(targetY - dragY));
					const durationMs = Math.round(
						Math.max(80, Math.min(360, remaining / Math.max(speed, 0.65)))
					);
					onDismiss(item.id, 'swipe', { x: 0, y: targetY, durationMs });
					return;
				}
			}
		}

		dragX = 0;
		dragY = 0;
		lockedAxis = null;
	}
</script>

<!-- Animate UI 스펙 기반 개별 토스트 카드 (스프링 진입 · 스와이프 닫기/러버밴드 · 상태별 아이콘 모션 · 남은 시간 바) -->
<div
	bind:this={rootEl}
	class="aui-toast-root"
	data-type={item.type}
	data-state={item.state}
	data-behind={isBehind ? '' : undefined}
	data-expanded={expanded ? '' : undefined}
	role={item.type === 'error' ? 'alert' : 'status'}
	aria-live={item.type === 'error' ? 'assertive' : 'polite'}
	style={inlineStyle}
	onpointerdown={handlePointerDown}
	onpointermove={handlePointerMove}
	onpointerup={(e) => finishSwipe(e, false)}
	onpointercancel={(e) => finishSwipe(e, true)}
>
	<div class="aui-toast-content" data-behind={isBehind ? '' : undefined}>
		<!-- 상태 아이콘 (착지 0.2s 후 상태별 고유 모션 실행) -->
		<span class="aui-toast-icon" data-slot="toast-icon" aria-hidden="true">
			{#key `${item.type}-${item.updateKey}`}
				{#if item.type === 'success'}
					<svg
						class="icon-svg is-success"
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.4"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path class="draw-check" pathLength="1" d="m4.5 12.75 5 5 10-11" />
					</svg>
				{:else if item.type === 'error'}
					<svg
						class="icon-svg is-error"
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.4"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path class="draw-cross-a" pathLength="1" d="M18 6 6 18" />
						<path class="draw-cross-b" pathLength="1" d="m6 6 12 12" />
					</svg>
				{:else if item.type === 'warning'}
					<svg
						class="icon-svg is-pop"
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
						<path d="M12 9v4" />
						<path d="M12 17h.01" />
					</svg>
				{:else if item.type === 'loading'}
					<span class="icon-spinner"></span>
				{:else}
					<svg
						class="icon-svg is-pop"
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<circle cx="12" cy="12" r="9.5" />
						<path d="M12 16v-4" />
						<path d="M12 8h.01" />
					</svg>
				{/if}
			{/key}
		</span>

		{#key `${item.message}-${item.description ?? ''}-${item.updateKey}`}
			<div class="aui-toast-text">
				<p class="aui-toast-title">{item.message}</p>
				{#if item.description}
					<p class="aui-toast-desc">{item.description}</p>
				{/if}
			</div>
		{/key}

		<button
			type="button"
			class="aui-toast-close"
			data-toast-close
			aria-label="알림 닫기"
			onclick={() => onDismiss(item.id, 'dismiss')}
		>
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M18 6 6 18" />
				<path d="m6 6 12 12" />
			</svg>
		</button>
	</div>

	{#if showProgress}
		<div class="aui-toast-progress" data-animate-ui-toast-progress aria-hidden="true">
			<div class="aui-toast-progress-bar" data-animate-ui-toast-progress-bar>
				<FdLine
					active={true}
					direction="up"
					thickness={2.5}
					baseHeight={5}
					progress={barProgress}
					setting={progressLineSetting}
				/>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Animate UI spring(stiffness: 280, damping: 24) ≈ 525ms, ~4% overshoot */
	.aui-toast-root {
		--toast-spring: linear(
			0,
			0.028 2%,
			0.105 4.2%,
			0.402 9.4%,
			0.713 15.1%,
			0.909 20.6%,
			1.008 26.2%,
			1.04 32.1%,
			1.036 39%,
			1.016 48.5%,
			1.003 60%,
			0.999 74%,
			1
		);
		--toast-status-color: var(--toast-info-wave);
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		width: 100%;
		border-radius: 14px;
		overflow: hidden;
		background: color-mix(in srgb, var(--surface) 92%, var(--bg));
		border: var(--thin-border);
		box-shadow:
			0 14px 36px rgba(0, 0, 0, 0.48),
			0 2px 8px rgba(0, 0, 0, 0.28);
		-webkit-backdrop-filter: blur(20px) saturate(160%);
		backdrop-filter: blur(20px) saturate(160%);
		color: var(--fg);
		touch-action: none;
		user-select: none;
		cursor: grab;
		transform-origin: center bottom;
		will-change: transform, opacity, filter;
		transition:
			transform 525ms var(--toast-spring),
			opacity 240ms ease-out,
			filter 240ms ease-out,
			height 420ms var(--toast-spring);
	}

	.aui-toast-root:active {
		cursor: grabbing;
	}

	.aui-toast-root[data-type='success'] {
		--toast-status-color: var(--toast-success-wave);
	}

	.aui-toast-root[data-type='error'] {
		--toast-status-color: var(--toast-error-wave);
	}

	.aui-toast-root[data-type='info'] {
		--toast-status-color: var(--toast-info-wave);
	}

	.aui-toast-root[data-type='warning'] {
		--toast-status-color: var(--white-2);
	}

	.aui-toast-root[data-type='loading'] {
		--toast-status-color: var(--muted);
	}

	.aui-toast-content {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.82rem 0.85rem 0.88rem 0.92rem;
		opacity: 1;
		transition: opacity 200ms cubic-bezier(0.23, 1, 0.32, 1);
	}

	.aui-toast-content[data-behind] {
		opacity: 0;
	}

	.aui-toast-icon {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--toast-status-color);
	}

	.icon-svg {
		display: block;
		overflow: visible;
	}

	/* Success check draws itself after landing (0.2s delay, 0.3s draw) */
	.draw-check {
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		animation: aui-draw-stroke 300ms cubic-bezier(0.22, 1, 0.36, 1) 180ms forwards;
	}

	/* Error cross draws itself and shakes "no" */
	.icon-svg.is-error {
		animation: aui-error-shake 400ms ease-in-out 260ms;
	}

	.draw-cross-a {
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		animation: aui-draw-stroke 220ms cubic-bezier(0.22, 1, 0.36, 1) 160ms forwards;
	}

	.draw-cross-b {
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		animation: aui-draw-stroke 220ms cubic-bezier(0.22, 1, 0.36, 1) 240ms forwards;
	}

	/* Info / Warning pop in from 0.5 out of 2px blur */
	.icon-svg.is-pop {
		opacity: 0;
		transform: scale(0.5);
		filter: blur(2px);
		animation: aui-icon-pop 340ms cubic-bezier(0.22, 1.35, 0.36, 1) 180ms forwards;
	}

	.icon-spinner {
		width: 16px;
		height: 16px;
		border-radius: 999px;
		border: 2px solid color-mix(in srgb, var(--fg) 22%, transparent);
		border-top-color: var(--white);
		animation: aui-spin 700ms linear infinite;
	}

	.aui-toast-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.16rem;
		animation: aui-text-swap 150ms ease-out;
	}

	.aui-toast-title {
		margin: 0;
		font-size: 0.875rem;
		font-weight: var(--fw-semibold);
		line-height: 1.38;
		letter-spacing: -0.015em;
		color: var(--white);
		word-break: keep-all;
	}

	.aui-toast-desc {
		margin: 0;
		font-size: 0.78rem;
		font-weight: var(--fw-regular);
		line-height: 1.4;
		color: var(--muted);
		word-break: keep-all;
	}

	.aui-toast-close {
		width: 26px;
		height: 26px;
		flex-shrink: 0;
		padding: 0;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--muted);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.aui-toast-close:hover {
		background: var(--surface-2);
		color: var(--white);
	}

	.aui-toast-progress {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 2px;
		background: color-mix(in srgb, var(--white) 8%, transparent);
		overflow: visible;
		pointer-events: none;
	}

	.aui-toast-progress-bar {
		width: 100%;
		height: 100%;
		opacity: 0.9;
	}

	@keyframes aui-draw-stroke {
		to {
			stroke-dashoffset: 0;
		}
	}

	@keyframes aui-error-shake {
		0%,
		100% {
			transform: translateX(0);
		}
		20% {
			transform: translateX(-3px);
		}
		42% {
			transform: translateX(3px);
		}
		64% {
			transform: translateX(-2px);
		}
		84% {
			transform: translateX(1.5px);
		}
	}

	@keyframes aui-icon-pop {
		to {
			opacity: 1;
			transform: scale(1);
			filter: blur(0px);
		}
	}

	@keyframes aui-text-swap {
		from {
			opacity: 0;
			filter: blur(2px);
		}
		to {
			opacity: 1;
			filter: blur(0px);
		}
	}

	@keyframes aui-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.aui-toast-root {
			transition:
				opacity 180ms ease,
				filter 180ms ease;
			transition-delay: 0ms !important;
		}

		.draw-check,
		.draw-cross-a,
		.draw-cross-b {
			stroke-dashoffset: 0;
			animation: none;
		}

		.icon-svg.is-error {
			animation: none;
		}

		.icon-svg.is-pop {
			opacity: 1;
			transform: none;
			filter: none;
			animation: none;
		}
	}
</style>
