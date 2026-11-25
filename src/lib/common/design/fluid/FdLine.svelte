<script lang="ts">
	import { untrack } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { FluidSetting, computeFluidWave } from '#lib/common/type/fluid';

	export type FdLineDirection = 'up' | 'down' | 'left' | 'right';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		/** 유체/물결/색상/테두리 설정 (FluidSetting 인스턴스 또는 부분 설정 객체) */
		setting?: FluidSetting | Partial<FluidSetting>;
		/** 물결 활성 여부 (true: 부드럽게 일렁임, false: 평평한 선으로 복귀 후 rAF 정지) */
		active?: boolean;
		/** 선 기준 물결이 솟아오르는 한쪽 방향 */
		direction?: FdLineDirection;
		/** 기본 선 두께 (px) */
		thickness?: number;
		/** 앞쪽(본체) 물결의 기본 높이 (px). 미지정 시 FluidSetting의 waveAmp · layerGap 기반으로 자동 계산 */
		baseHeight?: number;
		/** 외부 래퍼 클래스 */
		class?: string;
		/** 외부 래퍼 인라인 스타일 */
		style?: string;
	}

	let {
		setting,
		active = true,
		direction = 'up',
		thickness = 1,
		baseHeight,
		class: klass = '',
		style,
		...rest
	}: Props = $props();

	const cfg = $derived(FluidSetting.from(setting));
	const isVertical = $derived(direction === 'left' || direction === 'right');

	const resolvedBaseHeight = $derived(
		baseHeight !== undefined ? Math.max(0, baseHeight) : Math.max(4, cfg.waveAmp * 2.2)
	);

	// 캔버스 여유 높이(또는 폭): 모든 물결 겹과 진폭·테두리가 잘리지 않도록 확보
	const canvasReach = $derived.by(() => {
		const L = cfg.layerCount;
		const maxLayerAmp = cfg.waveAmp * (1 + Math.max(0, L) * 0.35);
		const peak = resolvedBaseHeight + L * Math.max(cfg.layerGap, 3) + maxLayerAmp * 1.45;
		return Math.max(16, Math.ceil(peak + Math.max(0, cfg.borderWidth) + 6));
	});

	let wrap: HTMLDivElement;
	let canvas: HTMLCanvasElement;

	let syncControl: (() => void) | undefined;
	let relayout: (() => void) | undefined;

	$effect(() => {
		if (typeof window === 'undefined') return;
		return untrack(() => initEngine());
	});

	$effect(() => {
		void active;
		void direction;
		void thickness;
		void resolvedBaseHeight;
		void canvasReach;
		void cfg.layers;
		void cfg.layerGap;
		void cfg.waveAmp;
		void cfg.waveLength;
		void cfg.spin;
		void cfg.color;
		void cfg.waveColor;
		void cfg.hoverColor;
		void cfg.borderWidth;
		void cfg.borderColor;
		void cfg.staticFrontWave;
		relayout?.();
		syncControl?.();
	});

	function initEngine(): () => void {
		const ctx = canvas.getContext('2d');
		if (!ctx) return () => {};

		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const TAU = Math.PI * 2;
		const BACK_ALPHAS = [0.68, 0.36];

		let dpr = Math.min(window.devicePixelRatio || 1, 2);
		let span = 0; // 선의 길이 (가로면 width, 세로면 height)
		let reach = 0; // 물결이 뻗어나가는 수직/수평 캔버스 영역

		let intensity = active ? 1 : 0;
		let targetIntensity = active ? 1 : 0;
		let phase = Math.random() * TAU;
		let rafId = 0;
		let lastTs = 0;

		let fillColor = '#ffffff';
		let waveColor = '#ffffff';
		let strokeColor = '#ffffff';

		function readColors() {
			const cs = getComputedStyle(wrap);
			fillColor = cs.getPropertyValue('--fd-l-color').trim() || '#ffffff';
			waveColor = cs.getPropertyValue('--fd-l-wave').trim() || fillColor;
			strokeColor = cs.getPropertyValue('--fd-l-border').trim() || fillColor;
		}

		function layout() {
			// getBoundingClientRect()는 상위 3D transform(rotateX 등)의 투영 크기를 반환해
			// 회전 중 캔버스 폭이 어긋날 수 있으므로 변환 전 실제 CSS 레이아웃 크기(clientWidth/Height)를 사용
			span = isVertical ? wrap.clientHeight : wrap.clientWidth;
			reach = canvasReach + Math.max(1, thickness);
			dpr = Math.min(window.devicePixelRatio || 1, 2);

			const cw = Math.max(1, Math.round(isVertical ? reach : span));
			const ch = Math.max(1, Math.round(isVertical ? span : reach));

			canvas.width = Math.max(1, Math.round(cw * dpr));
			canvas.height = Math.max(1, Math.round(ch * dpr));
			canvas.style.width = `${cw}px`;
			canvas.style.height = `${ch}px`;

			readColors();
		}

		function drawWaveLayer(
			layerIdx: number,
			totalLayers: number,
			effIntensity: number,
			curSpan: number,
			curReach: number
		) {
			if (!ctx || curSpan < 2) return;

			const isFront = layerIdx === 0;
			const baseRise = resolvedBaseHeight + layerIdx * Math.max(cfg.layerGap, 2.5);
			const ampScale = isFront && cfg.staticFrontWave ? 0 : 1 + layerIdx * 0.35;
			const amp = cfg.waveAmp * ampScale;
			const waveLen = Math.max(24, cfg.waveLength);
			const k = TAU / waveLen;
			const seed = 1.37 + layerIdx * 2.13;
			const layerPhase = phase * (1 + layerIdx * 0.14) + layerIdx * 1.65;

			const segments = Math.max(24, Math.min(120, Math.round(curSpan / 6)));
			const pts: Array<{ x: number; y: number }> = new Array(segments + 1);

			const dir = direction;
			const baseThickness = Math.max(0, thickness);

			for (let i = 0; i <= segments; i++) {
				const t = i / segments;
				const along = t * curSpan;

				// 양 끝단에서 0으로 부드럽게 수렴하는 벨(사인) 엔벨로프
				const env = Math.pow(Math.sin(Math.PI * t), 0.85);
				const w = amp > 0 ? computeFluidWave(along, layerIdx * 19, t * TAU, k, layerPhase, seed) : 0;
				const rise = Math.max(0, (baseRise + w * amp) * env * effIntensity);
				const offset = baseThickness + rise;

				if (dir === 'up') {
					pts[i] = { x: along, y: curReach - offset };
				} else if (dir === 'down') {
					pts[i] = { x: along, y: offset };
				} else if (dir === 'left') {
					pts[i] = { x: curReach - offset, y: along };
				} else {
					pts[i] = { x: offset, y: along };
				}
			}

			ctx.beginPath();

			// 직선 기준선 시작점
			if (dir === 'up') {
				ctx.moveTo(0, curReach);
				ctx.lineTo(pts[0].x, pts[0].y);
			} else if (dir === 'down') {
				ctx.moveTo(0, 0);
				ctx.lineTo(pts[0].x, pts[0].y);
			} else if (dir === 'left') {
				ctx.moveTo(curReach, 0);
				ctx.lineTo(pts[0].x, pts[0].y);
			} else {
				ctx.moveTo(0, 0);
				ctx.lineTo(pts[0].x, pts[0].y);
			}

			// 부드러운 2차 베지어 곡선으로 물결 윤곽 연결
			for (let i = 1; i < pts.length - 1; i++) {
				const midX = (pts[i].x + pts[i + 1].x) * 0.5;
				const midY = (pts[i].y + pts[i + 1].y) * 0.5;
				ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
			}
			const last = pts[pts.length - 1];
			ctx.lineTo(last.x, last.y);

			// 직선 기준선 끝점으로 닫기
			if (dir === 'up') {
				ctx.lineTo(curSpan, curReach);
			} else if (dir === 'down') {
				ctx.lineTo(curSpan, 0);
			} else if (dir === 'left') {
				ctx.lineTo(curReach, curSpan);
			} else {
				ctx.lineTo(0, curSpan);
			}
			ctx.closePath();

			ctx.save();
			if (isFront) {
				ctx.globalAlpha = 1;
				ctx.fillStyle = fillColor;
				ctx.fill();
				if (cfg.borderWidth > 0) {
					ctx.lineWidth = cfg.borderWidth;
					ctx.strokeStyle = strokeColor;
					ctx.stroke();
				}
			} else {
				const backIdx = Math.min(BACK_ALPHAS.length - 1, Math.max(0, layerIdx - 1));
				// totalLayers가 1일 때는 0.58, 2일 때는 안쪽 0.68 · 바깥쪽 0.36
				ctx.globalAlpha = totalLayers === 1 ? 0.58 : BACK_ALPHAS[backIdx];
				ctx.fillStyle = waveColor;
				ctx.fill();
			}
			ctx.restore();
		}

		function render() {
			if (!ctx) return;
			const cw = canvas.width / dpr;
			const ch = canvas.height / dpr;

			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			ctx.clearRect(0, 0, cw, ch);

			if (span < 2) return;

			const curReach = isVertical ? cw : ch;
			const eff = reducedMotion ? (active ? 1 : 0) : intensity;

			// 물결이 완전히 꺼졌으면 기준선만 깔끔하게 1px 렌더링
			if (eff <= 0.002) {
				if (thickness > 0) {
					ctx.save();
					ctx.fillStyle = fillColor;
					if (direction === 'up') {
						ctx.fillRect(0, curReach - thickness, span, thickness);
					} else if (direction === 'down') {
						ctx.fillRect(0, 0, span, thickness);
					} else if (direction === 'left') {
						ctx.fillRect(curReach - thickness, 0, thickness, span);
					} else {
						ctx.fillRect(0, 0, thickness, span);
					}
					ctx.restore();
				}
				return;
			}

			const L = cfg.layerCount;
			for (let layerIdx = L; layerIdx >= 0; layerIdx--) {
				drawWaveLayer(layerIdx, L, eff, span, curReach);
			}
		}

		function stopLoop() {
			if (rafId) {
				cancelAnimationFrame(rafId);
				rafId = 0;
			}
			lastTs = 0;
		}

		function tick(now: number) {
			rafId = 0;
			const dt = lastTs ? Math.min(0.05, (now - lastTs) / 1000) : 1 / 60;
			lastTs = now;

			const lerpRate = targetIntensity > intensity ? 7.5 : 8.5;
			intensity += (targetIntensity - intensity) * Math.min(1, dt * lerpRate);
			if (Math.abs(targetIntensity - intensity) < 0.003) {
				intensity = targetIntensity;
			}

			if (!reducedMotion && intensity > 0.002) {
				phase += dt * cfg.spin * 1.15;
				if (phase > TAU * 1000) phase %= TAU;
			}

			render();

			// active=true 이거나, active=false로 감쇠 중일 때만 rAF 유지
			if (!reducedMotion && (targetIntensity > 0 || intensity > 0.002)) {
				rafId = requestAnimationFrame(tick);
			} else {
				lastTs = 0;
			}
		}

		function ensureRunning() {
			targetIntensity = active ? 1 : 0;
			if (reducedMotion) {
				intensity = targetIntensity;
				render();
				return;
			}
			if (!rafId) {
				lastTs = 0;
				rafId = requestAnimationFrame(tick);
			}
		}

		relayout = () => {
			layout();
			render();
		};
		syncControl = () => {
			readColors();
			ensureRunning();
		};

		layout();
		ensureRunning();

		const ro = new ResizeObserver(() => {
			layout();
			render();
		});
		ro.observe(wrap);

		return () => {
			stopLoop();
			ro.disconnect();
			relayout = undefined;
			syncControl = undefined;
		};
	}

	const resolvedWaveColor = $derived(cfg.waveColor ?? cfg.hoverColor ?? cfg.color);
	const resolvedBorderColor = $derived(cfg.borderColor ?? cfg.color);
</script>

<!-- FdLine: 선 기준 한쪽 방향으로 양끝이 수렴하는 다중 유체 물결 (FluidSetting 호환 · active 토글) -->
<div
	bind:this={wrap}
	class="fd-line is-{direction} {klass}"
	class:is-vertical={isVertical}
	style:--fd-l-color={cfg.color}
	style:--fd-l-wave={resolvedWaveColor}
	style:--fd-l-border={resolvedBorderColor}
	style:--fd-l-thickness="{thickness}px"
	{style}
	aria-hidden="true"
	{...rest}
>
	<canvas bind:this={canvas} class="fd-line-canvas is-{direction}"></canvas>
</div>

<style>
	.fd-line {
		position: relative;
		width: 100%;
		height: var(--fd-l-thickness, 1px);
		pointer-events: none;
		overflow: visible;
	}

	.fd-line.is-vertical {
		width: var(--fd-l-thickness, 1px);
		height: 100%;
	}

	.fd-line-canvas {
		position: absolute;
		display: block;
		pointer-events: none;
	}

	.fd-line-canvas.is-up {
		left: 0;
		bottom: 0;
	}

	.fd-line-canvas.is-down {
		left: 0;
		top: 0;
	}

	.fd-line-canvas.is-left {
		top: 0;
		right: 0;
	}

	.fd-line-canvas.is-right {
		top: 0;
		left: 0;
	}
</style>
