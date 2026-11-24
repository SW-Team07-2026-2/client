<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import {
		createSpring,
		createSpringLoop,
		prefersReducedMotion
	} from '#lib/common/type/spring';

	interface Props {
		pullPx: number;
		progress: number;
		ready: boolean;
		refreshing: boolean;
	}

	let { pullPx, progress, ready, refreshing }: Props = $props();

	const HOLD_Y = 36;
	const REST_Y = 5;
	const REST_S = 0.25;

	let layerEl = $state<HTMLDivElement | null>(null);
	let dropEl = $state<HTMLDivElement | null>(null);
	let spinEl = $state<HTMLDivElement | null>(null);

	const D = createSpring(REST_Y, 380, 20); // 물방울 중심 Y
	const DS = createSpring(REST_S, 420, 18); // 물방울 스케일 (임계 도달 시 pop 임펄스)
	const SP = createSpring(0, 400, 26); // 스피너 투명도/스케일
	const VIS = createSpring(0, 420, 30); // 전체 핸들/구 레이어 가시성

	const allSprings = [D, DS, SP, VIS];

	function clamp(v: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, v));
	}

	function renderVisuals() {
		const vis = clamp(VIS.x, 0, 1);
		if (layerEl) {
			layerEl.style.opacity = vis > 0.005 ? vis.toFixed(3) : '0';
		}

		// 빠르게 당겨질수록 물방울이 세로로 늘어나고 가로로 좁아짐
		const stretch = 1 + clamp(Math.abs(D.v) / 1600, 0, 0.35);
		const sx = Math.max(0.05, DS.x / stretch);
		const sy = Math.max(0.05, DS.x * stretch);
		const dropY = D.x - 16;

		const sp = clamp(SP.x, 0, 1);
		if (dropEl) {
			dropEl.style.transform = `translate3d(0, ${dropY.toFixed(2)}px, 0) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
			dropEl.style.opacity = (1 - sp).toFixed(3);
		}
		if (spinEl) {
			const spinScale = 0.6 + 0.4 * sp;
			spinEl.style.transform = `translate3d(0, ${dropY.toFixed(2)}px, 0) scale(${spinScale.toFixed(3)})`;
			spinEl.style.opacity = sp > 0.005 ? sp.toFixed(3) : '0';
		}
	}

	const loop = createSpringLoop({
		springs: allSprings,
		isSettled: () =>
			allSprings.every((s) => Math.abs(s.x - s.t) < 0.02 && Math.abs(s.v) < 0.05),
		onFrame: () => {
			renderVisuals();
		}
	});

	let wasReady = false;

	$effect(() => {
		const curPull = pullPx;
		const curProgress = progress;
		const curReady = ready;
		const curRefreshing = refreshing;

		untrack(() => {
			const isPulling = !curRefreshing && curPull > 0.5;
			const isVisible = isPulling || curRefreshing;

			if (curRefreshing) {
				D.t = HOLD_Y;
				DS.t = 1;
				SP.t = 1;
				VIS.t = 1;
			} else if (isPulling) {
				D.t = Math.max(REST_Y, curPull * 0.68);
				DS.t = REST_S + (1 - REST_S) * clamp(curProgress, 0, 1);
				SP.t = 0;
				VIS.t = 1;
				// 임계값 돌파 순간 탄성 팝 임펄스
				if (curReady && !wasReady && !prefersReducedMotion()) {
					DS.v += 4;
				}
			} else {
				D.t = REST_Y;
				DS.t = REST_S;
				SP.t = 0;
				VIS.t = 0;
			}

			wasReady = curReady;

			if (prefersReducedMotion()) {
				for (const s of allSprings) {
					s.x = s.t;
					s.v = 0;
				}
				renderVisuals();
				return;
			}

			if (isVisible || VIS.x > 0.005 || Math.abs(D.x - D.t) > 0.05 || SP.x > 0.005) {
				loop.wake();
			}
		});
	});

	onDestroy(() => {
		loop.stop();
	});
</script>

<!-- SVG Goo 필터 정의 (핸들과 물방울이 점성 있게 이어지다 떨어지는 효과) -->
<svg class="mb-ptr-goo-defs" width="0" height="0" aria-hidden="true">
	<filter id="mb-ptr-goo" x="-50%" y="-50%" width="200%" height="200%">
		<feGaussianBlur in="SourceGraphic" stdDeviation="7" result="b" />
		<feColorMatrix
			in="b"
			mode="matrix"
			values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"
			result="g"
		/>
		<feComposite in="SourceGraphic" in2="g" operator="atop" />
	</filter>
</svg>

<!-- 모바일 당겨서 새로고침 Goo-Drop 인디케이터 (순수 렌더링) -->
<div bind:this={layerEl} class="mb-ptr-layer" aria-hidden="true">
	<div class="mb-ptr-goo">
		<div class="mb-ptr-handle"></div>
		<div bind:this={dropEl} class="mb-ptr-drop"></div>
	</div>

	<div bind:this={spinEl} class="mb-ptr-spin">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
			<path d="M12 4a8 8 0 0 1 8 8" />
		</svg>
	</div>
</div>

<style>
	.mb-ptr-goo-defs {
		position: absolute;
		pointer-events: none;
	}

	.mb-ptr-layer {
		position: fixed;
		top: 62px;
		left: 0;
		right: 0;
		height: 120px;
		z-index: 46;
		pointer-events: none;
		opacity: 0;
		will-change: opacity;
	}

	.mb-ptr-goo {
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		height: 120px;
		filter: url(#mb-ptr-goo);
		pointer-events: none;
		z-index: 1;
	}

	.mb-ptr-handle {
		position: absolute;
		left: 50%;
		top: 2px;
		width: 44px;
		height: 6px;
		margin-left: -22px;
		border-radius: 3px;
		background: var(--white);
	}

	.mb-ptr-drop {
		position: absolute;
		left: 50%;
		top: 0;
		width: 32px;
		height: 32px;
		margin-left: -16px;
		border-radius: 50%;
		background: var(--white);
		will-change: transform, opacity;
	}

	.mb-ptr-spin {
		position: absolute;
		left: 50%;
		top: 0;
		width: 32px;
		height: 32px;
		margin-left: -16px;
		padding: 6px;
		border-radius: 50%;
		background: var(--white);
		color: var(--bg);
		z-index: 2;
		pointer-events: none;
		opacity: 0;
		box-sizing: border-box;
		will-change: transform, opacity;
	}

	.mb-ptr-spin svg {
		width: 100%;
		height: 100%;
		display: block;
		animation: mb-ptr-spin 0.8s linear infinite;
	}

	@keyframes mb-ptr-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.mb-ptr-spin svg {
			animation: none;
		}
	}
</style>
