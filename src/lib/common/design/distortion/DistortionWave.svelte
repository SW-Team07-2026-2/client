<script lang="ts">
	import { tick, untrack, type Component, type Snippet } from 'svelte';
	import { prefersReducedMotion } from '#lib/common/type/spring';
	import { captureElementToCanvas } from './domSnapshot';
	import type {
		DistortionWavePalette,
		DistortionWaveStyle,
		DistortionWaveType
	} from './webglWaveRenderer';

	interface Props {
		/** true로 전환될 때 파동과 함께 revealedContent를 드러냅니다. */
		revealed: boolean;
		/** 파동 방향 ('center' | 'vertical' | 'horizontal') */
		type?: DistortionWaveType;
		/** 파동 컬러 팔레트 */
		palette?: DistortionWavePalette;
		/** 파동 시작점 (정규화 0~1 좌표, 기본 중앙) */
		origin?: { x: number; y: number };
		/** 전환 재생 시간(ms, 기본 860) */
		duration?: number;
		/** 셰이더 세부 파라미터 */
		waveStyle?: DistortionWaveStyle;
		/** 전환 전 뷰 (불투명 배경 권장) */
		children: Snippet;
		/** 전환 후 드러날 뷰 (불투명 배경 권장) */
		revealedContent: Snippet;
		/** 파동 위로 왜곡 없이 라이브 유지될 오버레이 (선택) */
		overlay?: Snippet;
		/** 전환 완료 콜백 */
		onFinish?: (revealed: boolean) => void;
	}

	let {
		revealed,
		type = 'center',
		palette = 'colorful',
		origin = { x: 0.5, y: 0.5 },
		duration = 860,
		waveStyle,
		children,
		revealedContent,
		overlay,
		onFinish
	}: Props = $props();

	let rootEl = $state<HTMLDivElement | null>(null);
	let beforeEl = $state<HTMLDivElement | null>(null);
	let afterEl = $state<HTMLDivElement | null>(null);

	let prevRevealed = untrack(() => revealed);
	let visualRevealed = $state(untrack(() => revealed));
	let animating = $state(false);
	let waveToken = 0;

	interface ActiveWavePayload {
		beforeCanvas: HTMLCanvasElement;
		afterCanvas: HTMLCanvasElement;
		width: number;
		height: number;
		dpr: number;
		targetRevealed: boolean;
	}

	let activeWave = $state<ActiveWavePayload | null>(null);
	// WebGL2 캔버스 컴포넌트는 실제 전환이 필요할 때만 동적 임포트 (모바일 초기 번들 차단)
	let WaveCanvasComp = $state<Component<any> | null>(null);

	$effect(() => {
		const next = revealed;
		if (next === prevRevealed) return;
		prevRevealed = next;
		void startTransition(next);
	});

	async function startTransition(targetRevealed: boolean): Promise<void> {
		const token = ++waveToken;

		if (prefersReducedMotion() || !rootEl || !beforeEl || !afterEl) {
			visualRevealed = targetRevealed;
			activeWave = null;
			animating = false;
			onFinish?.(targetRevealed);
			return;
		}

		await tick();
		if (token !== waveToken || !rootEl || !beforeEl || !afterEl) return;

		const rect = rootEl.getBoundingClientRect();
		const width = Math.round(rect.width);
		const height = Math.round(rect.height);
		if (width <= 0 || height <= 0) {
			visualRevealed = targetRevealed;
			onFinish?.(targetRevealed);
			return;
		}

		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const fromEl = targetRevealed ? beforeEl : afterEl;
		const toEl = targetRevealed ? afterEl : beforeEl;

		try {
			const [mod, beforeCanvas, afterCanvas] = await Promise.all([
				WaveCanvasComp ? Promise.resolve({ default: WaveCanvasComp }) : import('./DistortionWaveCanvas.svelte'),
				captureElementToCanvas(fromEl, width, height, dpr),
				captureElementToCanvas(toEl, width, height, dpr)
			]);

			if (token !== waveToken) return;

			if (!beforeCanvas || !afterCanvas) {
				visualRevealed = targetRevealed;
				onFinish?.(targetRevealed);
				return;
			}

			WaveCanvasComp = mod.default;
			animating = true;
			activeWave = {
				beforeCanvas,
				afterCanvas,
				width,
				height,
				dpr,
				targetRevealed
			};
		} catch {
			if (token !== waveToken) return;
			visualRevealed = targetRevealed;
			activeWave = null;
			animating = false;
			onFinish?.(targetRevealed);
		}
	}

	function handleWaveDone() {
		const target = activeWave?.targetRevealed ?? revealed;
		visualRevealed = target;
		activeWave = null;
		animating = false;
		onFinish?.(target);
	}
</script>

<!-- WebGL2 굴절 파동 뷰 전환 래퍼 (DOM 스냅샷 + GPU 굴절·색수차·컬러 림, 순수 렌더링) -->
<div bind:this={rootEl} class="distortion-wave-root" class:is-animating={animating}>
	<div
		bind:this={beforeEl}
		class="wave-layer is-before"
		class:is-hidden={visualRevealed}
		aria-hidden={visualRevealed || animating ? true : undefined}
		inert={visualRevealed || animating ? true : undefined}
	>
		{@render children()}
	</div>

	<div
		bind:this={afterEl}
		class="wave-layer is-after"
		class:is-hidden={!visualRevealed}
		aria-hidden={!visualRevealed || animating ? true : undefined}
		inert={!visualRevealed || animating ? true : undefined}
	>
		{@render revealedContent()}
	</div>

	{#if animating && activeWave && WaveCanvasComp}
		<WaveCanvasComp
			beforeCanvas={activeWave.beforeCanvas}
			afterCanvas={activeWave.afterCanvas}
			width={activeWave.width}
			height={activeWave.height}
			dpr={activeWave.dpr}
			{duration}
			{origin}
			{type}
			{palette}
			{waveStyle}
			onDone={handleWaveDone}
		/>
	{/if}

	{#if overlay}
		<div class="wave-overlay">
			{@render overlay()}
		</div>
	{/if}
</div>

<style>
	.distortion-wave-root {
		position: relative;
		display: grid;
		overflow: hidden;
		border-radius: inherit;
		width: 100%;
	}

	.wave-layer {
		grid-area: 1 / 1;
		width: 100%;
		min-width: 0;
		transition: opacity 0.22s ease;
	}

	.wave-layer.is-hidden {
		opacity: 0;
		visibility: hidden;
		pointer-events: none;
	}

	.distortion-wave-root.is-animating .wave-layer {
		transition: none;
	}

	.wave-overlay {
		position: relative;
		grid-area: 1 / 1;
		z-index: 6;
		pointer-events: none;
	}

	.wave-overlay :global(button),
	.wave-overlay :global(a) {
		pointer-events: auto;
	}
</style>
