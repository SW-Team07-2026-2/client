<script lang="ts">
	import { onMount } from 'svelte';
	import titleLoadingSvg from '#lib/assets/title-loading.svg?raw';

	interface Props {
		/** 로딩 종료 시 로고가 이동해 안착할 대상 엘리먼트 (예: .title-wrap) */
		targetEl?: Element | null;
		/** targetEl 폭 대비 실제 글리프 폭 비율 (기본: FdTitle 내부 여백 비율 10/11.2, 꽉 찬 SVG: 1) */
		targetGlyphRatio?: number;
		/** 실제 페이지의 타이틀을 드러낼 시점 콜백 (도착 직후) */
		onreveal?: () => void;
		/** 오버레이가 완전히 사라진 뒤 언마운트용 콜백 */
		ondone?: () => void;
	}

	let { targetEl = null, targetGlyphRatio, onreveal, ondone }: Props = $props();

	let logoEl: HTMLDivElement | undefined = $state(undefined);
	let phase = $state<'drawing' | 'docking' | 'fading'>('drawing');
	let logoTransform = $state('translate3d(0px, 0px, 0) scale(1)');

	// 외부 CSS 번들 다운로드 전에도 즉시 렌더링되도록 핵심 오버레이 스타일을 SSR HTML에 인라인
	const CRITICAL_STYLE_TAG = `<style>
.indig-splash{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;pointer-events:all;user-select:none}
.indig-splash.is-docking,.indig-splash.is-fading{pointer-events:none}
.indig-splash .splash-backdrop{position:absolute;inset:0;background:var(--bg,#070709);opacity:1;transition:opacity .48s cubic-bezier(.22,1,.36,1)}
.indig-splash.is-docking .splash-backdrop,.indig-splash.is-fading .splash-backdrop{opacity:0}
.indig-splash .splash-logo{position:relative;z-index:1;width:min(74vw,24rem);aspect-ratio:886/239;transform-origin:center center;will-change:transform,opacity;transition:transform .6s cubic-bezier(.22,1,.36,1),opacity .18s ease}
.indig-splash.is-fading .splash-logo{opacity:0}
.indig-splash .splash-spinner{position:absolute;z-index:1;top:calc(50% + clamp(3.75rem,10vh,5.5rem));left:50%;transform:translateX(-50%);color:var(--white-2,#fafafa);pointer-events:none;opacity:1;transition:opacity .22s ease}
.indig-splash .splash-spinner-inner{opacity:0;transform:translateY(6px);animation:indig-spinner-in .28s cubic-bezier(.22,1,.36,1) 3.48s forwards}
.indig-splash.is-docking .splash-spinner,.indig-splash.is-fading .splash-spinner{opacity:0}
@keyframes indig-spinner-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
</style>`;

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

	onMount(() => {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			onreveal?.();
			ondone?.();
			return;
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

		// SVG 렌더링 완료 후에도 최소 POST_COMPLETE_HOLD_MS(0.5초) 동안 완성된 로고를 유지
		const l5FillAnim = logoEl?.querySelector('.l5-fill')?.getAnimations?.()[0];
		const elapsedSvgMs =
			typeof l5FillAnim?.currentTime === 'number' ? l5FillAnim.currentTime : performance.now();
		const remainingHoldMs = Math.max(0, SVG_COMPLETE_MS + POST_COMPLETE_HOLD_MS - elapsedSvgMs);

		void Promise.all([waitMs(remainingHoldMs), waitWindowLoad]).then(() => {
			if (cancelled) return;

			if (logoEl && targetEl) {
				const logoRect = logoEl.getBoundingClientRect();
				const targetRect = targetEl.getBoundingClientRect();

				if (logoRect.width > 0 && targetRect.width > 0 && targetRect.height > 0) {
					const targetGlyphW = targetRect.width * (targetGlyphRatio ?? FDTITLE_GLYPH_RATIO);
					const logoGlyphW = logoRect.width * SVG_GLYPH_RATIO;
					const scale = targetGlyphW / logoGlyphW;
					const dx = targetRect.left + targetRect.width / 2 - (logoRect.left + logoRect.width / 2);
					const dy = targetRect.top + targetRect.height / 2 - (logoRect.top + logoRect.height / 2);

					logoTransform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
					phase = 'docking';

					timers.push(
						setTimeout(() => {
							if (cancelled) return;
							onreveal?.();
							phase = 'fading';

							timers.push(
								setTimeout(() => {
									if (cancelled) return;
									ondone?.();
								}, FADE_DURATION_MS)
							);
						}, DOCK_DURATION_MS)
					);
					return;
				}
			}

			// 타겟을 찾지 못한 경우 제자리 페이드아웃 폴백
			onreveal?.();
			phase = 'fading';
			timers.push(
				setTimeout(() => {
					if (cancelled) return;
					ondone?.();
				}, FADE_DURATION_MS)
			);
		});

		return () => {
			cancelled = true;
			for (const t of timers) clearTimeout(t);
			if (loadHandler) window.removeEventListener('load', loadHandler);
		};
	});
</script>

<svelte:head>
	{@html CRITICAL_STYLE_TAG}
</svelte:head>

<div
	class="indig-splash"
	class:is-docking={phase === 'docking'}
	class:is-fading={phase === 'fading'}
	aria-hidden="true"
>
	<div class="splash-backdrop"></div>

	<div bind:this={logoEl} class="splash-logo" style:transform={logoTransform}>
		{@html titleLoadingSvg}
	</div>

	<!-- SSR에 포함해 JS 로드 전에도 SVG 완성 1초 후(3.48s) 순수 CSS로 자동 노출 -->
	<div class="splash-spinner" aria-hidden="true">
		<div class="splash-spinner-inner">
			<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
				<rect width="10" height="10" x="1" y="1" fill="currentColor" rx="1">
					<animate
						id="SVG7WybndBt"
						fill="freeze"
						attributeName="x"
						begin="0;SVGo3aOUHlJ.end"
						dur="0.2s"
						values="1;13"
					/>
					<animate
						id="SVGVoKldbWM"
						fill="freeze"
						attributeName="y"
						begin="SVGFpk9ncYc.end"
						dur="0.2s"
						values="1;13"
					/>
					<animate
						id="SVGKsXgPbui"
						fill="freeze"
						attributeName="x"
						begin="SVGaI8owdNK.end"
						dur="0.2s"
						values="13;1"
					/>
					<animate
						id="SVG7JzAfdGT"
						fill="freeze"
						attributeName="y"
						begin="SVG28A4To9L.end"
						dur="0.2s"
						values="13;1"
					/>
				</rect>
				<rect width="10" height="10" x="1" y="13" fill="currentColor" rx="1">
					<animate
						id="SVGUiS2jeZq"
						fill="freeze"
						attributeName="y"
						begin="SVG7WybndBt.end"
						dur="0.2s"
						values="13;1"
					/>
					<animate
						id="SVGU0vu2GEM"
						fill="freeze"
						attributeName="x"
						begin="SVGVoKldbWM.end"
						dur="0.2s"
						values="1;13"
					/>
					<animate
						id="SVGOIboFeLf"
						fill="freeze"
						attributeName="y"
						begin="SVGKsXgPbui.end"
						dur="0.2s"
						values="1;13"
					/>
					<animate
						id="SVG14lAaeuv"
						fill="freeze"
						attributeName="x"
						begin="SVG7JzAfdGT.end"
						dur="0.2s"
						values="13;1"
					/>
				</rect>
				<rect width="10" height="10" x="13" y="13" fill="currentColor" rx="1">
					<animate
						id="SVGFpk9ncYc"
						fill="freeze"
						attributeName="x"
						begin="SVGUiS2jeZq.end"
						dur="0.2s"
						values="13;1"
					/>
					<animate
						id="SVGaI8owdNK"
						fill="freeze"
						attributeName="y"
						begin="SVGU0vu2GEM.end"
						dur="0.2s"
						values="13;1"
					/>
					<animate
						id="SVG28A4To9L"
						fill="freeze"
						attributeName="x"
						begin="SVGOIboFeLf.end"
						dur="0.2s"
						values="1;13"
					/>
					<animate
						id="SVGo3aOUHlJ"
						fill="freeze"
						attributeName="y"
						begin="SVG14lAaeuv.end"
						dur="0.2s"
						values="1;13"
					/>
				</rect>
			</svg>
		</div>
	</div>
</div>
