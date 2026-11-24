export type SplashPhase = 'drawing' | 'docking' | 'fading';

// FdTitle.svelte 내부 여백 비율: LOGO_H_UNITS(10) / (LOGO_H_UNITS(10) + PAD(0.6) * 2)
const FDTITLE_GLYPH_RATIO = 10 / 11.2;
// 본 SVG viewBox(-4 -4 886 239) 대비 실제 글자 폭(878) 비율
const SVG_GLYPH_RATIO = 878 / 886;

// 외곽선(0 ~ 1.86s) + 채움(1.72 ~ 2.48s) 완료 시점 + 완료 후 로고 유지 시간
const SVG_COMPLETE_MS = 2480;
const POST_COMPLETE_HOLD_MS = 500;
const MAX_LOAD_WAIT_MS = 10000;
const DOCK_DURATION_MS = 800;
const FADE_DURATION_MS = 180;

export interface LoadingSplashLifecycleParams {
	getLogoEl: () => HTMLDivElement | undefined;
	getTargetEl: () => Element | null | undefined;
	getTargetGlyphRatio: () => number | undefined;
	onreveal?: () => void;
	ondone?: () => void;
}

/**
 * 첫 진입 스플래시(SVG 드로잉 -> 타겟 로고 도킹 -> 페이드아웃) 타이밍 및 좌표 계산 컨트롤러
 */
export class LoadingSplashController {
	phase = $state<SplashPhase>('drawing');
	logoTransform = $state('translate3d(0px, 0px, 0) scale(1)');

	attachLifecycle = (params: LoadingSplashLifecycleParams): (() => void) => {
		if (typeof window === 'undefined') return () => {};

		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			params.onreveal?.();
			params.ondone?.();
			return () => {};
		}

		let cancelled = false;
		const timers: ReturnType<typeof setTimeout>[] = [];
		let loadHandler: (() => void) | null = null;

		const waitMs = (ms: number) =>
			ms <= 0
				? Promise.resolve()
				: new Promise<void>((resolve) => {
						timers.push(setTimeout(resolve, ms));
					});

		const waitWindowLoad =
			document.readyState === 'complete'
				? Promise.resolve()
				: new Promise<void>((resolve) => {
						loadHandler = () => resolve();
						window.addEventListener('load', loadHandler, { once: true });
						timers.push(setTimeout(resolve, MAX_LOAD_WAIT_MS));
					});

		const logoElAtStart = params.getLogoEl();
		const l5FillAnim = logoElAtStart?.querySelector('.l5-fill')?.getAnimations?.()[0];
		const elapsedSvgMs =
			typeof l5FillAnim?.currentTime === 'number' ? l5FillAnim.currentTime : performance.now();
		const remainingHoldMs = Math.max(0, SVG_COMPLETE_MS + POST_COMPLETE_HOLD_MS - elapsedSvgMs);

		void Promise.all([waitMs(remainingHoldMs), waitWindowLoad]).then(() => {
			if (cancelled) return;

			const logoEl = params.getLogoEl();
			const targetEl = params.getTargetEl();

			if (logoEl && targetEl) {
				const logoRect = logoEl.getBoundingClientRect();
				const targetRect = targetEl.getBoundingClientRect();

				if (logoRect.width > 0 && targetRect.width > 0 && targetRect.height > 0) {
					const targetGlyphW =
						targetRect.width * (params.getTargetGlyphRatio() ?? FDTITLE_GLYPH_RATIO);
					const logoGlyphW = logoRect.width * SVG_GLYPH_RATIO;
					const scale = targetGlyphW / logoGlyphW;
					const dx = targetRect.left + targetRect.width / 2 - (logoRect.left + logoRect.width / 2);
					const dy = targetRect.top + targetRect.height / 2 - (logoRect.top + logoRect.height / 2);

					this.logoTransform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
					this.phase = 'docking';

					timers.push(
						setTimeout(() => {
							if (cancelled) return;
							params.onreveal?.();
							this.phase = 'fading';

							timers.push(
								setTimeout(() => {
									if (cancelled) return;
									params.ondone?.();
								}, FADE_DURATION_MS)
							);
						}, DOCK_DURATION_MS)
					);
					return;
				}
			}

			// 타겟을 찾지 못한 경우 제자리 페이드아웃 폴백
			params.onreveal?.();
			this.phase = 'fading';
			timers.push(
				setTimeout(() => {
					if (cancelled) return;
					params.ondone?.();
				}, FADE_DURATION_MS)
			);
		});

		return () => {
			cancelled = true;
			for (const t of timers) clearTimeout(t);
			if (loadHandler) window.removeEventListener('load', loadHandler);
		};
	};
}
