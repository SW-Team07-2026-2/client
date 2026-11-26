<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		WebGLWaveRenderer,
		type DistortionWavePalette,
		type DistortionWaveStyle,
		type DistortionWaveType
	} from './webglWaveRenderer';

	interface Props {
		beforeCanvas: HTMLCanvasElement;
		afterCanvas: HTMLCanvasElement;
		width: number;
		height: number;
		dpr: number;
		duration: number;
		origin: { x: number; y: number };
		type: DistortionWaveType;
		palette: DistortionWavePalette;
		waveStyle?: DistortionWaveStyle;
		onDone: () => void;
	}

	let {
		beforeCanvas,
		afterCanvas,
		width,
		height,
		dpr,
		duration,
		origin,
		type,
		palette,
		waveStyle,
		onDone
	}: Props = $props();

	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let renderer: WebGLWaveRenderer | null = null;
	let rafId = 0;

	onMount(() => {
		if (!canvasEl) {
			onDone();
			return;
		}

		const pixelW = Math.max(1, Math.round(width * dpr));
		const pixelH = Math.max(1, Math.round(height * dpr));
		canvasEl.width = pixelW;
		canvasEl.height = pixelH;

		renderer = WebGLWaveRenderer.create(canvasEl);
		if (!renderer) {
			onDone();
			return;
		}

		renderer.uploadSnapshots(beforeCanvas, afterCanvas);
		const startTime = performance.now();

		const frame = (now: number) => {
			if (!renderer) return;
			const t = Math.min(1, (now - startTime) / Math.max(120, duration));
			renderer.render({
				width: pixelW,
				height: pixelH,
				progress: t,
				origin,
				type,
				palette,
				style: waveStyle
			});

			if (t < 1) {
				rafId = requestAnimationFrame(frame);
			} else {
				rafId = 0;
				onDone();
			}
		};

		rafId = requestAnimationFrame(frame);
	});

	onDestroy(() => {
		if (rafId) cancelAnimationFrame(rafId);
		renderer?.destroy();
		renderer = null;
	});
</script>

<canvas bind:this={canvasEl} class="distortion-wave-canvas" aria-hidden="true"></canvas>

<style>
	.distortion-wave-canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		pointer-events: none;
		z-index: 4;
	}
</style>
