<script module lang="ts">
	interface ExtractedWaveColors {
		inner: string;
		outer: string;
		accent: string;
	}

	const WHITE_WAVE_COLORS: ExtractedWaveColors = {
		inner: 'rgb(255, 255, 255)',
		outer: 'rgb(255, 255, 255)',
		accent: 'rgb(255, 255, 255)'
	};

	const waveColorCache = new Map<string, ExtractedWaveColors>();
	const corsBlockedOrigins = new Set<string>();
	const warmedImageUrls = new Set<string>();

	function getUrlOrigin(url: string): string | null {
		if (typeof window === 'undefined') return null;
		try {
			const parsed = new URL(url, window.location.href);
			if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
				return parsed.origin;
			}
		} catch {
			// 잘못된 URL 형식은 origin 판별 생략
		}
		return null;
	}

	function isInlineImageUrl(url: string): boolean {
		return url.startsWith('data:') || url.startsWith('blob:');
	}

	export function prewarmFdImages(urls: readonly string[], limit = 8): void {
		if (typeof window === 'undefined') return;
		let queued = 0;
		for (const raw of urls) {
			if (queued >= limit) break;
			const url = raw.trim();
			if (!url || isInlineImageUrl(url) || warmedImageUrls.has(url)) continue;
			warmedImageUrls.add(url);
			queued += 1;

			const img = new Image();
			img.decoding = 'async';
			const origin = getUrlOrigin(url);
			const corsBlocked = Boolean(
				origin && origin !== window.location.origin && corsBlockedOrigins.has(origin)
			);
			if (!corsBlocked) {
				img.crossOrigin = 'anonymous';
				img.onload = () => {
					void img.decode?.().catch(() => {});
				};
				img.onerror = () => {
					if (origin && origin !== window.location.origin) {
						corsBlockedOrigins.add(origin);
					}
					const retry = new Image();
					retry.decoding = 'async';
					retry.onload = () => {
						void retry.decode?.().catch(() => {});
					};
					retry.src = url;
				};
			} else {
				img.onload = () => {
					void img.decode?.().catch(() => {});
				};
			}
			img.src = url;
		}
	}

	function setBoundedColorCache(key: string, value: ExtractedWaveColors, limit = 240) {
		if (waveColorCache.size >= limit && !waveColorCache.has(key)) {
			const oldest = waveColorCache.keys().next().value;
			if (oldest !== undefined) waveColorCache.delete(oldest);
		}
		waveColorCache.set(key, value);
	}
</script>

<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import {
		FluidSetting,
		computeFluidWave,
		isPointerBlocked,
		prefersReducedMotion
	} from '#lib/common/type';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		/** 표시할 이미지 경로 (URL 또는 Data URI) */
		src: string;
		/** 대체 텍스트 (웹 접근성 및 폴백 이미지용) */
		alt?: string;
		/** 이미지 맞춤 방식 (기본값: 'cover') */
		fit?: 'cover' | 'contain' | 'fill';
		/** 이미지 정렬 기준 위치 (CSS object-position, 기본값: '50% 50%') */
		objectPosition?: string;
		/** 브라우저 이미지 로딩 전략 (기본값: 'lazy') */
		loading?: 'eager' | 'lazy';
		/** 이미지 디코딩 힌트 (기본값: 'async') */
		decoding?: 'async' | 'sync' | 'auto';
		/** 이미지 위에 겹쳐서 렌더링할 선택적 오버레이 콘텐츠 */
		children?: Snippet;
		/** 유체/물결/반응성/최적화 설정 (FluidSetting 인스턴스 또는 부분 설정 객체) */
		setting?: FluidSetting | Partial<FluidSetting>;
		/** 호버 시 모핑될 목표 모서리 반경 (px). 미지정 시 setting.radius 유지 */
		hoverRadius?: number;
		/** 외부에서 강제로 호버/물결 활성 상태를 제어할지 여부 (예: 카드 전체 호버 연동) */
		active?: boolean;
		/** 비활성화 여부 */
		disabled?: boolean;
		/** 가로 전체 폭(width: 100%) 사용 여부 */
		fullWidth?: boolean;
		/** 가장 앞쪽(이미지 본체) 레이어의 물결 요동 비활성화 여부 (미지정 시 setting.staticFrontWave 따름) */
		staticFrontWave?: boolean;
		/** 물결/유체 캔버스 효과 완전 비활성화 (모바일 등에서 순수 이미지로만 표시할 때 사용) */
		disableWave?: boolean;

		/* ── FluidSetting 개별 오버라이드 Props ── */
		radius?: number;
		reach?: number;
		bulge?: number;
		bulgeWidth?: number;
		layers?: number;
		layerGap?: number;
		waveAmp?: number;
		waveLength?: number;
		spin?: number;
		waveColor?: string;
		borderWidth?: number;
		borderColor?: string;
		hoverBorderColor?: string;
		pressBorderColor?: string;
		inset?: number;

		/* ── 상태 바인딩 (상위 컴포넌트에서 조회/전달 가능) ── */
		/** 현재 포인터 호버 상태 여부 */
		hovered?: boolean;
		/** 현재 포인터 누름(press) 상태 여부 */
		pressed?: boolean;
		/** 이미지 및 컴포넌트 준비 완료 여부 */
		ready?: boolean;
		/** 이미지 로드 완료 여부 */
		imageLoaded?: boolean;
		/** 이미지 전체에서 자동 추출(또는 지정)된 대표 물결 색상 */
		extractedWaveColor?: string;

		/* ── 스타일 & DOM 참조 ── */
		/** 외부 래퍼(.lq.fd-wrap.fd-image-wrap) 클래스 */
		class?: string;
		/** 내부 몸체(.fd-body.fd-image-body) 클래스 */
		bodyClass?: string;
		/** 외부 래퍼 인라인 스타일 */
		style?: string;
		/** 내부 몸체 인라인 스타일 */
		bodyStyle?: string;
		/** 외부 래퍼 DOM 엘리먼트 바인딩 */
		wrapEl?: HTMLDivElement | null;
		/** 내부 몸체 DOM 엘리먼트 바인딩 */
		boxEl?: HTMLDivElement | null;
	}

	let {
		src,
		alt = '',
		fit = 'cover',
		objectPosition = '50% 50%',
		loading = 'lazy',
		decoding = 'async',
		children,
		setting,
		hoverRadius,
		active = false,
		disabled = false,
		fullWidth = false,
		staticFrontWave,
		disableWave = false,
		radius,
		reach,
		bulge,
		bulgeWidth,
		layers,
		layerGap,
		waveAmp,
		waveLength,
		spin,
		waveColor,
		borderWidth,
		borderColor,
		hoverBorderColor,
		pressBorderColor,
		inset: insetProp,
		hovered = $bindable(false),
		pressed = $bindable(false),
		ready = $bindable(false),
		imageLoaded = $bindable(false),
		extractedWaveColor = $bindable(WHITE_WAVE_COLORS.accent),
		class: klass = '',
		bodyClass = '',
		style,
		bodyStyle,
		wrapEl = $bindable(undefined),
		boxEl = $bindable(undefined),
		...rest
	}: Props = $props();

	const hasExplicitWaveColor = $derived(
		waveColor !== undefined ||
			(setting !== undefined &&
				typeof setting === 'object' &&
				'waveColor' in setting &&
				setting.waveColor !== undefined)
	);

	const cfg = $derived.by(() => {
		const base = FluidSetting.from(setting);
		const patch: Partial<FluidSetting> = {};
		if (radius !== undefined) patch.radius = radius;
		if (reach !== undefined) patch.reach = reach;
		if (bulge !== undefined) patch.bulge = bulge;
		if (bulgeWidth !== undefined) patch.bulgeWidth = bulgeWidth;
		if (layers !== undefined) patch.layers = layers;
		if (layerGap !== undefined) patch.layerGap = layerGap;
		if (waveAmp !== undefined) patch.waveAmp = waveAmp;
		if (waveLength !== undefined) patch.waveLength = waveLength;
		if (spin !== undefined) patch.spin = spin;
		if (waveColor !== undefined) patch.waveColor = waveColor;
		if (borderWidth !== undefined) patch.borderWidth = borderWidth;
		if (borderColor !== undefined) patch.borderColor = borderColor;
		if (hoverBorderColor !== undefined) patch.hoverBorderColor = hoverBorderColor;
		if (pressBorderColor !== undefined) patch.pressBorderColor = pressBorderColor;
		if (insetProp !== undefined) patch.inset = insetProp;
		return Object.keys(patch).length > 0 ? base.with(patch) : base;
	});

	const inset = $derived(cfg.computedInset);

	// 캔버스 여유 여백: 돌출 및 물결/테두리가 잘리지 않도록 확보
	const SAFE = $derived(
		Math.max(28, Math.ceil(cfg.bulge * 1.4 + cfg.waveExtent + Math.max(0, cfg.borderWidth) + 14))
	);
	const TAU = Math.PI * 2;

	let wrap: HTMLDivElement;
	let box: HTMLDivElement;
	let imgEl: HTMLImageElement | undefined = $state(undefined);
	let canvas: HTMLCanvasElement | undefined = $state(undefined);
	let useCorsFallback = $state(false);

	const imgCrossOrigin = $derived<'anonymous' | undefined>(
		!src || isInlineImageUrl(src) || useCorsFallback ? undefined : 'anonymous'
	);
	const imgRenderKey = $derived(`${src}|${imgCrossOrigin ?? 'nocors'}`);

	// 평소(유휴)에는 순수 <img>만 렌더링하고, 근접·호버·클릭·상시 물결 시에만 물결 전용 <canvas> 활성화
	let canvasActive = $state(untrack(() => active || !cfg.pauseWhenIdle));
	let pendingPointer: { x: number; y: number } | null = null;
	let pendingPress = false;
	let snapRadiusOnCanvasMount = untrack(() => active);

	let relayout: (() => void) | undefined;
	let syncSetting: (() => void) | undefined;

	let autoWaveInner = $state(WHITE_WAVE_COLORS.inner);
	let autoWaveOuter = $state(WHITE_WAVE_COLORS.outer);

	/* ───────── 이미지 전체 평균색 추출 유틸 ───────── */

	function formatRgbForWaves(r: number, g: number, b: number): ExtractedWaveColors {
		const color = `rgb(${r}, ${g}, ${b})`;
		return { inner: color, outer: color, accent: color };
	}

	function applyWaveColors(colors: ExtractedWaveColors) {
		autoWaveInner = colors.inner;
		autoWaveOuter = colors.outer;
		extractedWaveColor = hasExplicitWaveColor ? (cfg.waveColor ?? colors.accent) : colors.accent;
	}

	function extractAverageWaveColors(img: HTMLImageElement): ExtractedWaveColors | null {
		try {
			const size = 32;
			const off = document.createElement('canvas');
			off.width = size;
			off.height = size;
			const octx = off.getContext('2d', { willReadFrequently: true });
			if (octx) {
				const iw = img.naturalWidth || img.width || size;
				const ih = img.naturalHeight || img.height || size;
				if (fit === 'cover') {
					const scale = Math.max(size / iw, size / ih);
					const dw = iw * scale;
					const dh = ih * scale;
					octx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
				} else {
					octx.drawImage(img, 0, 0, size, size);
				}

				const data = octx.getImageData(0, 0, size, size).data;
				let sumR = 0;
				let sumG = 0;
				let sumB = 0;
				let totalW = 0;

				for (let i = 0; i < data.length; i += 4) {
					const a = data[i + 3];
					if (a < 20) continue;

					const w = a / 255;
					sumR += data[i] * w;
					sumG += data[i + 1] * w;
					sumB += data[i + 2] * w;
					totalW += w;
				}

				if (totalW > 0.01) {
					return formatRgbForWaves(
						Math.round(sumR / totalW),
						Math.round(sumG / totalW),
						Math.round(sumB / totalW)
					);
				}
			}
		} catch {
			// Tainted Canvas 등 픽셀 읽기 불가 시 null 반환 -> 하얀색 기본값 적용
		}

		return null;
	}

	function resolveLoadedImgWaveColors(targetImg: HTMLImageElement, currentSrc: string) {
		const cacheKey = `${fit}:${currentSrc}`;
		const cached = waveColorCache.get(cacheKey);
		if (cached) {
			applyWaveColors(cached);
			syncSetting?.();
			return;
		}
		if (useCorsFallback) {
			applyWaveColors(WHITE_WAVE_COLORS);
			syncSetting?.();
			return;
		}
		const runExtract = () => {
			if (src !== currentSrc) return;
			const extracted = extractAverageWaveColors(targetImg);
			const nextColors = extracted ?? WHITE_WAVE_COLORS;
			if (extracted) {
				setBoundedColorCache(cacheKey, extracted, 240);
			}
			applyWaveColors(nextColors);
			syncSetting?.();
		};
		const win = window as Window & {
			requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
		};
		if (typeof win.requestIdleCallback === 'function') {
			win.requestIdleCallback(runExtract, { timeout: 600 });
		} else {
			setTimeout(runExtract, 80);
		}
	}

	function handleImgLoad() {
		imageLoaded = true;
		ready = true;
		if (typeof window === 'undefined' || !src || !imgEl) return;
		resolveLoadedImgWaveColors(imgEl, src);
	}

	function handleImgError() {
		imageLoaded = false;
		ready = false;
		if (typeof window === 'undefined' || !src || useCorsFallback || isInlineImageUrl(src)) {
			applyWaveColors(WHITE_WAVE_COLORS);
			return;
		}
		const origin = getUrlOrigin(src);
		if (origin && origin !== window.location.origin) {
			corsBlockedOrigins.add(origin);
		}
		useCorsFallback = true;
		applyWaveColors(WHITE_WAVE_COLORS);
	}

	// src 변경 시 CORS 지원 여부 확인 및 <img> 단일 요청 기반 상태 동기화
	$effect(() => {
		const currentSrc = src;
		void fit;
		if (typeof window === 'undefined' || !currentSrc) {
			useCorsFallback = false;
			imageLoaded = false;
			ready = false;
			applyWaveColors(WHITE_WAVE_COLORS);
			return;
		}

		const origin = getUrlOrigin(currentSrc);
		useCorsFallback = Boolean(
			origin && origin !== window.location.origin && corsBlockedOrigins.has(origin)
		);

		const cacheKey = `${fit}:${currentSrc}`;
		const cachedColors = waveColorCache.get(cacheKey);
		applyWaveColors(cachedColors ?? WHITE_WAVE_COLORS);

		const currentImgEl = untrack(() => imgEl);
		if (currentImgEl && currentImgEl.complete && currentImgEl.naturalWidth > 0) {
			imageLoaded = true;
			ready = true;
			resolveLoadedImgWaveColors(currentImgEl, currentSrc);
		} else {
			imageLoaded = false;
			ready = false;
		}
	});

	$effect(() => {
		wrapEl = wrap;
		boxEl = box;
	});

	// 캔버스 비활성(유휴) 상태에서 포인터 근접·진입·클릭을 감지해 온디맨드로 캔버스를 깨움
	$effect(() => {
		if (disabled || disableWave) {
			hovered = false;
			pressed = false;
			canvasActive = false;
			return;
		}
		if (prefersReducedMotion()) {
			canvasActive = false;
			return;
		}
		if (active || !cfg.pauseWhenIdle || hovered || pressed) {
			if (!canvasActive) {
				snapRadiusOnCanvasMount = active && !hovered && !pressed;
				canvasActive = true;
			}
		}

		if (canvasActive || !wrap || !box) return;

		let visibleInViewport = true;
		const io =
			typeof IntersectionObserver !== 'undefined'
				? new IntersectionObserver(
						(entries) => {
							visibleInViewport = entries[0]?.isIntersecting ?? true;
						},
						{ rootMargin: '80px' }
					)
				: null;
		io?.observe(wrap);

		const wakeFromPointer = (clientX: number, clientY: number, isPress = false) => {
			pendingPointer = { x: clientX, y: clientY };
			if (isPress) pendingPress = true;
			snapRadiusOnCanvasMount = false;
			canvasActive = true;
		};

		const onIdleEnter = (e: PointerEvent) => {
			if (!cfg.hoverReactive && !cfg.bulgeReactive) return;
			if (isPointerBlocked(e.target, wrap)) return;
			wakeFromPointer(e.clientX, e.clientY, false);
		};

		const onIdleDown = (e: PointerEvent) => {
			if (e.pointerType !== 'touch' && !cfg.clickReactive) return;
			wakeFromPointer(e.clientX, e.clientY, cfg.clickReactive);
		};

		const onIdleUp = () => {
			pendingPress = false;
		};

		const onIdleMove = (e: PointerEvent) => {
			if (!visibleInViewport || e.pointerType === 'touch') return;
			if (!cfg.bulgeReactive && !cfg.hoverReactive) return;
			if (isPointerBlocked(e.target, wrap)) return;

			const r = box.getBoundingClientRect();
			if (!r.width || !r.height) return;

			const W = r.width;
			const H = r.height;
			const bw = W - 2 * inset;
			const bh = H - 2 * inset;
			if (bw < 2 || bh < 2) return;

			const lx = e.clientX - (r.left + W / 2);
			const ly = e.clientY - (r.top + H / 2);
			const rr = Math.min(cfg.radius, bw / 2, bh / 2);
			const ihw = Math.max(0, bw / 2 - rr);
			const ihh = Math.max(0, bh / 2 - rr);
			const qx = Math.abs(lx) - ihw;
			const qy = Math.abs(ly) - ihh;
			const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr;

			const triggerDist = cfg.bulgeReactive && cfg.bulge > 0 ? cfg.reach : 0;
			if (d <= triggerDist) {
				wakeFromPointer(e.clientX, e.clientY, false);
			}
		};

		box.addEventListener('pointerenter', onIdleEnter);
		box.addEventListener('pointerdown', onIdleDown);
		window.addEventListener('pointerup', onIdleUp);
		if (cfg.bulgeReactive && cfg.bulge > 0) {
			window.addEventListener('pointermove', onIdleMove, { passive: true });
		}

		return () => {
			io?.disconnect();
			box.removeEventListener('pointerenter', onIdleEnter);
			box.removeEventListener('pointerdown', onIdleDown);
			window.removeEventListener('pointerup', onIdleUp);
			window.removeEventListener('pointermove', onIdleMove);
		};
	});

	// canvasActive 가 true가 되어 <canvas> DOM이 마운트된 동안에만 2D 물결 엔진 실행
	$effect(() => {
		if (!canvasActive || !canvas || disabled || prefersReducedMotion()) return;
		return untrack(() => initWaveEngine(canvas!));
	});

	$effect(() => {
		void cfg.radius;
		void hoverRadius;
		void inset;
		void SAFE;
		relayout?.();
	});

	$effect(() => {
		void cfg;
		void active;
		void staticFrontWave;
		void autoWaveInner;
		void autoWaveOuter;
		void hasExplicitWaveColor;
		syncSetting?.();
	});

	function isTransparent(col: string): boolean {
		const c = col.trim().toLowerCase();
		return !c || c === 'transparent' || c === 'rgba(0, 0, 0, 0)' || c === 'rgba(0,0,0,0)';
	}

	function traceRoundedRect(c: CanvasRenderingContext2D, w: number, h: number, r: number) {
		const hw = w / 2;
		const hh = h / 2;
		const rr = Math.max(0, Math.min(r, hw, hh));
		c.beginPath();
		c.moveTo(-hw + rr, -hh);
		c.lineTo(hw - rr, -hh);
		c.arcTo(hw, -hh, hw, -hh + rr, rr);
		c.lineTo(hw, hh - rr);
		c.arcTo(hw, hh, hw - rr, hh, rr);
		c.lineTo(-hw + rr, hh);
		c.arcTo(-hw, hh, -hw, hh - rr, rr);
		c.lineTo(-hw, -hh + rr);
		c.arcTo(-hw, -hh, -hw + rr, -hh, rr);
		c.closePath();
	}

	function initWaveEngine(targetCanvas: HTMLCanvasElement) {
		const ctx = targetCanvas.getContext('2d');
		if (!ctx) return;

		let W = 0;
		let H = 0;
		let bw = 0;
		let bh = 0;
		let cw = 0;
		let ch = 0;
		let dpr = 1;
		let n = 0;

		let laidOutW = 0;
		let laidOutH = 0;
		let laidOutDpr = 0;
		let laidOutSafe = -1;
		let laidOutInset = -1;
		let engineReady = false;

		let rx: Float32Array;
		let ry: Float32Array;
		let nx: Float32Array;
		let ny: Float32Array;
		let dx: Float32Array;
		let dy: Float32Array;
		let b: Float32Array;
		let bv: Float32Array;
		let tg: Float32Array;
		let xs: Float32Array;
		let ys: Float32Array;

		let lx = 0;
		let ly = 0;
		let cx = 0;
		let cy = 0;
		let unx = 0;
		let uny = -1;
		let inside = false;
		let wasNear = false;
		let ampT = 0;
		let hasPointer = pendingPointer !== null;
		let lastClientX = pendingPointer?.x ?? 0;
		let lastClientY = pendingPointer?.y ?? 0;
		pendingPointer = null;

		if (pendingPress) {
			pressed = true;
			pendingPress = false;
		}

		const ws = { x: !cfg.pauseWhenIdle ? 1 : 0, v: 0 };
		const hs = { x: 0, v: 0 };
		const ps = { x: 0, v: 0 };
		const cs = { x: 1, v: 0 };
		const bs = { x: 0, v: 0 };
		const rs = { x: cfg.radius, v: 0 };

		let curAmp = cfg.waveAmp;
		let curGap = cfg.layerGap;
		let curWl = cfg.waveLength;
		let curSpin = cfg.spin;
		let curBorderW = Math.max(0, cfg.borderWidth);
		let builtRadius = -1;

		let phase = 0;
		let raf = 0;
		let last = 0;

		let cWaveInner = autoWaveInner;
		let prevWaveInner = cWaveInner;
		let cWaveOuter = autoWaveOuter;
		let prevWaveOuter = cWaveOuter;

		let cBorder = cfg.borderColor ?? cfg.textColor;
		let prevBorder = cBorder;
		let cHoverBorder = cfg.hoverBorderColor ?? cBorder;
		let cPressBorder = cfg.pressBorderColor ?? cHoverBorder;

		let touchResetTimer: ReturnType<typeof setTimeout> | undefined;

		function getTargetRadius(): number {
			const maxR = Math.max(2, Math.min(bw, bh) / 2);
			const baseR = Math.min(cfg.radius, maxR);
			if (hoverRadius !== undefined && ((inside && cfg.hoverReactive) || active)) {
				return Math.min(hoverRadius, maxR);
			}
			return baseR;
		}

		function syncImgDom(sx: number, sy: number, curR: number) {
			if (!imgEl) return;
			const nextR = `${curR.toFixed(2)}px`;
			if (imgEl.style.borderRadius !== nextR) {
				imgEl.style.borderRadius = nextR;
			}
			if (Math.abs(sx - 1) > 0.0005 || Math.abs(sy - 1) > 0.0005) {
				imgEl.style.transform = `scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`;
			} else if (imgEl.style.transform) {
				imgEl.style.transform = '';
			}
		}

		function resetImgDom() {
			if (!imgEl) return;
			imgEl.style.borderRadius = '';
			imgEl.style.transform = '';
		}

		function readColors(animateChange = false) {
			if (!box) return;
			const s = getComputedStyle(box);
			const get = (k: string, d: string) => s.getPropertyValue(k).trim() || d;

			const cssWave = s.getPropertyValue('--fd-color-wave').trim();
			let nextWaveInner: string;
			let nextWaveOuter: string;

			if (hasExplicitWaveColor || cssWave) {
				const explicit = cssWave || cfg.waveColor || autoWaveInner;
				nextWaveInner = explicit;
				nextWaveOuter = explicit;
			} else {
				nextWaveInner = autoWaveInner;
				nextWaveOuter = autoWaveOuter;
			}

			const fallbackBorder = cfg.borderColor ?? cfg.textColor;
			const nextBorder = get('--fd-i-border', fallbackBorder);
			const nextHoverBorder = get('--fd-i-border-hover', nextBorder);
			const nextPressBorder = get('--fd-i-border-press', nextHoverBorder);

			if (
				animateChange &&
				(nextWaveInner !== cWaveInner ||
					nextWaveOuter !== cWaveOuter ||
					nextBorder !== cBorder ||
					nextHoverBorder !== cHoverBorder)
			) {
				prevWaveInner = cWaveInner;
				prevWaveOuter = cWaveOuter;
				prevBorder = cBorder;
				cs.x = 0;
				cs.v = 0;
			} else if (!animateChange) {
				prevWaveInner = nextWaveInner;
				prevWaveOuter = nextWaveOuter;
				prevBorder = nextBorder;
				cs.x = 1;
				cs.v = 0;
			}

			cWaveInner = nextWaveInner;
			cWaveOuter = nextWaveOuter;
			cBorder = nextBorder;
			cHoverBorder = nextHoverBorder;
			cPressBorder = nextPressBorder;
		}

		function build(rInput?: number) {
			if (bw < 2 || bh < 2 || !n) return;
			const hw = bw / 2;
			const hh = bh / 2;
			const r = Math.max(1, Math.min(rInput ?? rs.x, hw, hh));
			builtRadius = r;

			const sw = Math.max(0, bw - 2 * r);
			const sh = Math.max(0, bh - 2 * r);
			const qa = (Math.PI * r) / 2;
			const lens = [sw, qa, sh, qa, sw, qa, sh, qa];
			const total = lens.reduce((a, c) => a + c, 0);
			const startOffset = sw / 2;

			for (let k = 0; k < n; k++) {
				let s = (startOffset + (k / n) * total) % total;
				let i = 0;
				while (i < 7 && s > lens[i]) {
					s -= lens[i];
					i++;
				}
				const u = lens[i] > 0 ? s / lens[i] : 0;
				let x = 0;
				let y = 0;
				let ox = 0;
				let oy = 0;
				switch (i) {
					case 0:
						x = -hw + r + sw * u;
						y = -hh;
						oy = -1;
						break;
					case 1: {
						const a = -Math.PI / 2 + (u * Math.PI) / 2;
						ox = Math.cos(a);
						oy = Math.sin(a);
						x = hw - r + ox * r;
						y = -hh + r + oy * r;
						break;
					}
					case 2:
						x = hw;
						y = -hh + r + sh * u;
						ox = 1;
						break;
					case 3: {
						const a = (u * Math.PI) / 2;
						ox = Math.cos(a);
						oy = Math.sin(a);
						x = hw - r + ox * r;
						y = hh - r + oy * r;
						break;
					}
					case 4:
						x = hw - r - sw * u;
						y = hh;
						oy = 1;
						break;
					case 5: {
						const a = Math.PI / 2 + (u * Math.PI) / 2;
						ox = Math.cos(a);
						oy = Math.sin(a);
						x = -hw + r + ox * r;
						y = hh - r + oy * r;
						break;
					}
					case 6:
						x = -hw;
						y = hh - r - sh * u;
						ox = -1;
						break;
					default: {
						const a = Math.PI + (u * Math.PI) / 2;
						ox = Math.cos(a);
						oy = Math.sin(a);
						x = -hw + r + ox * r;
						y = -hh + r + oy * r;
					}
				}
				rx[k] = x;
				ry[k] = y;
				nx[k] = ox;
				ny[k] = oy;
				dx[k] = ox;
				dy[k] = oy;
			}
		}

		function layout() {
			if (!box || !targetCanvas) return;
			const nextW = box.offsetWidth;
			const nextH = box.offsetHeight;
			const nextBw = nextW - 2 * inset;
			const nextBh = nextH - 2 * inset;
			if (nextBw < 2 || nextBh < 2) return;

			const nextDpr = Math.min(window.devicePixelRatio || 1, 4);
			if (
				engineReady &&
				nextW === laidOutW &&
				nextH === laidOutH &&
				nextDpr === laidOutDpr &&
				SAFE === laidOutSafe &&
				inset === laidOutInset
			) {
				return;
			}

			W = nextW;
			H = nextH;
			bw = nextBw;
			bh = nextBh;
			dpr = nextDpr;
			laidOutW = nextW;
			laidOutH = nextH;
			laidOutDpr = nextDpr;
			laidOutSafe = SAFE;
			laidOutInset = inset;

			cw = W + SAFE * 2;
			ch = H + SAFE * 2;
			targetCanvas.width = Math.round(cw * dpr);
			targetCanvas.height = Math.round(ch * dpr);
			targetCanvas.style.width = cw + 'px';
			targetCanvas.style.height = ch + 'px';

			const maxPossiblePerim = 2 * (bw + bh);
			const nextN = Math.min(360, Math.max(72, Math.round(maxPossiblePerim / 4.5)));

			if (nextN !== n) {
				const oldN = n;
				const oldB = b;
				const oldBv = bv;
				n = nextN;
				rx = new Float32Array(n);
				ry = new Float32Array(n);
				nx = new Float32Array(n);
				ny = new Float32Array(n);
				dx = new Float32Array(n);
				dy = new Float32Array(n);
				b = new Float32Array(n);
				bv = new Float32Array(n);
				tg = new Float32Array(n);
				xs = new Float32Array(n);
				ys = new Float32Array(n);
				if (oldN > 0 && oldB && oldBv) {
					for (let i = 0; i < n; i++) {
						const srcIdx = Math.min(oldN - 1, Math.floor((i / n) * oldN));
						b[i] = oldB[srcIdx];
						bv[i] = oldBv[srcIdx];
					}
				}
			}

			if (!engineReady) {
				const maxR = Math.max(2, Math.min(bw, bh) / 2);
				rs.x = snapRadiusOnCanvasMount ? getTargetRadius() : Math.min(cfg.radius, maxR);
				rs.v = 0;
				snapRadiusOnCanvasMount = false;
				if (!cfg.pauseWhenIdle) ws.x = 1;
				curAmp = cfg.waveAmp;
				curGap = cfg.layerGap;
				curWl = cfg.waveLength;
				curSpin = cfg.spin;
			}

			build(rs.x);
			if (hasPointer) {
				const topEl = document.elementFromPoint(lastClientX, lastClientY);
				if (isPointerBlocked(topEl, wrap)) {
					hasPointer = false;
					ampT = 0;
					inside = false;
					hovered = false;
					pressed = false;
					wasNear = false;
				} else {
					syncPointerCoords(lastClientX, lastClientY);
				}
			}
			readColors(false);
			draw();
			engineReady = true;
			wake();
		}

		function spring(s: { x: number; v: number }, target: number, k: number, c: number, dt: number) {
			s.v += ((target - s.x) * k - s.v * c) * dt;
			s.x += s.v * dt;
		}

		function update(dt: number): boolean {
			const steps = Math.max(1, Math.ceil(dt * 120));
			const h = dt / steps;

			const hT = (inside && cfg.hoverReactive) || active ? 1 : 0;
			const wT = !cfg.pauseWhenIdle || hT === 1 ? 1 : 0;
			const pT = pressed && cfg.clickReactive ? 1 : 0;
			const bT = cfg.bulgeReactive && ampT > 0.01 ? ampT * 1.02 : 0;
			const rT = getTargetRadius();

			const lerpRate = Math.min(1, dt * 12);
			curAmp += (cfg.waveAmp - curAmp) * lerpRate;
			curGap += (cfg.layerGap - curGap) * lerpRate;
			curWl += (cfg.waveLength - curWl) * lerpRate;
			curSpin += (cfg.spin - curSpin) * lerpRate;
			const targetBorderW = Math.max(0, cfg.borderWidth);
			curBorderW += (targetBorderW - curBorderW) * lerpRate;

			for (let s = 0; s < steps; s++) {
				spring(ws, wT, 180, 14, h);
				spring(hs, hT, 180, 14, h);
				spring(ps, pT, 320, 16, h);
				spring(cs, 1, 150, 13, h);
				spring(bs, bT, 280, 34, h);
				spring(rs, rT, 170, 16, h);
			}

			if (Math.abs(rs.x - builtRadius) > 0.04) {
				build(rs.x);
			}

			if (cfg.bulgeReactive && ampT > 0.01) {
				const sig = Math.max(6, cfg.bulgeWidth);
				const focusDist = Math.max(ampT, cfg.bulge, 12);
				const fx = cx + unx * focusDist;
				const fy = cy + uny * focusDist;
				for (let i = 0; i < n; i++) {
					const ex = fx - rx[i];
					const ey = fy - ry[i];
					const el = Math.hypot(ex, ey) || 1;
					const ux = ex / el;
					const uy = ey / el;
					const k = ux * nx[i] + uy * ny[i] > 0 ? 0.35 : 0;
					const vx = nx[i] * (1 - k) + ux * k;
					const vy = ny[i] * (1 - k) + uy * k;
					const vl = Math.hypot(vx, vy) || 1;
					dx[i] = vx / vl;
					dy[i] = vy / vl;

					const distToC = Math.hypot(rx[i] - cx, ry[i] - cy);
					const q = distToC / sig;
					tg[i] = ampT * 1.02 * Math.exp(-q * q);
				}
			} else {
				tg.fill(0);
			}

			for (let s = 0; s < steps; s++) {
				for (let i = 0; i < n; i++) {
					bv[i] += ((tg[i] - b[i]) * 340 - bv[i] * 28) * h;
					b[i] += bv[i] * h;
				}
			}

			if (ws.x > 0.001) {
				phase += dt * curSpin;
			}

			let moving =
				wT === 1 ||
				hT === 1 ||
				ampT > 0 ||
				Math.abs(ws.x - wT) > 0.002 ||
				Math.abs(ws.v) > 0.01 ||
				Math.abs(hs.x - hT) > 0.002 ||
				Math.abs(hs.v) > 0.01 ||
				Math.abs(ps.x - pT) > 0.002 ||
				Math.abs(ps.v) > 0.01 ||
				Math.abs(cs.x - 1) > 0.002 ||
				Math.abs(cs.v) > 0.01 ||
				Math.abs(bs.x - bT) > 0.01 ||
				Math.abs(bs.v) > 0.05 ||
				Math.abs(rs.x - rT) > 0.05 ||
				Math.abs(rs.v) > 0.1 ||
				Math.abs(curBorderW - targetBorderW) > 0.02;

			if (!moving) {
				for (let i = 0; i < n; i++) {
					if (Math.abs(b[i]) > 0.02 || Math.abs(bv[i]) > 0.05) {
						moving = true;
						break;
					}
				}
				if (!moving) {
					ws.x = wT;
					ws.v = 0;
					hs.x = hT;
					hs.v = 0;
					ps.x = pT;
					ps.v = 0;
					cs.x = 1;
					cs.v = 0;
					bs.x = bT;
					bs.v = 0;
					rs.x = rT;
					rs.v = 0;
					curBorderW = targetBorderW;
					b.fill(0);
					bv.fill(0);
					if (Math.abs(rs.x - builtRadius) > 0.01) {
						build(rs.x);
					}
				}
			}
			return moving;
		}

		function trace() {
			const c = ctx!;
			c.beginPath();
			c.moveTo((xs[0] + xs[n - 1]) / 2, (ys[0] + ys[n - 1]) / 2);
			for (let i = 0; i < n; i++) {
				const ni = (i + 1) % n;
				c.quadraticCurveTo(xs[i], ys[i], (xs[i] + xs[ni]) / 2, (ys[i] + ys[ni]) / 2);
			}
			c.closePath();
		}

		function shape(
			sx: number,
			sy: number,
			grow: number,
			wave: number,
			wl: number,
			s: number,
			seed: number,
			spatialBulge = false
		) {
			const curBulge = cfg.bulgeReactive ? cfg.bulge : 0;
			const cap = curBulge * 1.15;
			const k = TAU / Math.max(20, wl);
			const sig = Math.max(6, cfg.bulgeWidth);
			const focusDist = Math.max(bs.x, curBulge, 12);
			const fx = cx + unx * focusDist;
			const fy = cy + uny * focusDist;

			for (let i = 0; i < n; i++) {
				let bi = 0;
				let bdx = dx[i];
				let bdy = dy[i];

				if (spatialBulge) {
					if (curBulge > 0 && bs.x > 0.005) {
						const distToC = Math.hypot(rx[i] - cx, ry[i] - cy);
						const q = distToC / sig;
						const rawB = bs.x * Math.exp(-q * q);
						bi = rawB > cap ? cap : rawB;

						if (bi > 0.001) {
							const ex = fx - rx[i];
							const ey = fy - ry[i];
							const el = Math.hypot(ex, ey) || 1;
							const ux = ex / el;
							const uy = ey / el;
							const blend = ux * nx[i] + uy * ny[i] > 0 ? 0.35 : 0;
							const vx = nx[i] * (1 - blend) + ux * blend;
							const vy = ny[i] * (1 - blend) + uy * blend;
							const vl = Math.hypot(vx, vy) || 1;
							bdx = vx / vl;
							bdy = vy / vl;
						}
					}
				} else {
					bi = b[i] > cap ? cap : b[i];
				}

				const wScale = grow <= 0 && curBulge > 0 ? Math.max(0, 1 - Math.max(0, bi) / curBulge) : 1;
				let off = grow;
				if (wave) off += wave * wScale * computeFluidWave(rx[i], ry[i], TAU * (i / n), k, s, seed);
				xs[i] = rx[i] * sx + nx[i] * off + bdx * bi;
				ys[i] = ry[i] * sy + ny[i] * off + bdy * bi;
			}
		}

		function fillCrossfade(
			c: CanvasRenderingContext2D,
			prev: string,
			curr: string,
			cv: number,
			alpha = 1
		) {
			if (cv >= 0.997 || prev === curr) {
				if (!isTransparent(curr)) {
					c.fillStyle = curr;
					c.globalAlpha = alpha;
					c.fill();
				}
				return;
			}
			const prevTrans = isTransparent(prev);
			const currTrans = isTransparent(curr);
			if (prevTrans && currTrans) return;
			if (prevTrans) {
				c.fillStyle = curr;
				c.globalAlpha = alpha * cv;
				c.fill();
			} else if (currTrans) {
				c.fillStyle = prev;
				c.globalAlpha = alpha * (1 - cv);
				c.fill();
			} else {
				c.fillStyle = prev;
				c.globalAlpha = alpha;
				c.fill();
				c.fillStyle = curr;
				c.globalAlpha = alpha * cv;
				c.fill();
			}
		}

		function strokeCrossfade(
			c: CanvasRenderingContext2D,
			prev: string,
			curr: string,
			cv: number,
			alpha = 1
		) {
			if (cv >= 0.997 || prev === curr) {
				if (!isTransparent(curr)) {
					c.strokeStyle = curr;
					c.globalAlpha = alpha;
					c.stroke();
				}
				return;
			}
			const prevTrans = isTransparent(prev);
			const currTrans = isTransparent(curr);
			if (prevTrans && currTrans) return;
			if (prevTrans) {
				c.strokeStyle = curr;
				c.globalAlpha = alpha * cv;
				c.stroke();
			} else if (currTrans) {
				c.strokeStyle = prev;
				c.globalAlpha = alpha * (1 - cv);
				c.stroke();
			} else {
				c.strokeStyle = prev;
				c.globalAlpha = alpha;
				c.stroke();
				c.strokeStyle = curr;
				c.globalAlpha = alpha * cv;
				c.stroke();
			}
		}

		function draw() {
			if (!n || bw < 2 || bh < 2) return;
			const c = ctx!;
			c.setTransform(1, 0, 0, 1, 0, 0);
			c.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
			c.setTransform(dpr, 0, 0, dpr, (cw / 2) * dpr, (ch / 2) * dpr);

			const wv = Math.min(1, Math.max(0, ws.x));
			const ww = Math.min(ws.x, 1.15);
			const hv = Math.min(1, Math.max(0, hs.x));
			const pv = Math.min(1, Math.max(0, ps.x));
			const cv = Math.min(1, Math.max(0, cs.x));

			const gx = cfg.pressDeform.x * ps.x;
			const gy = cfg.pressDeform.y * ps.x;
			const sx = (bw / 2 + gx) / (bw / 2);
			const sy = (bh / 2 + gy) / (bh / 2);
			const curR = Math.min(rs.x, (bw * sx) / 2, (bh * sy) / 2);

			// 아래쪽 <img> 모서리 반경 및 press 변형을 캔버스 스프링과 1:1 동기화
			syncImgDom(sx, sy, curR);

			// 1) 바깥 물결 레이어만 캔버스에 그림 (바깥 겹부터)
			const L = cfg.layerCount;
			if (wv > 0.01 && L > 0) {
				const alphas = [0.74, 0.45];
				for (let i = L - 1; i >= 0; i--) {
					const wl = curWl * Math.max(0.65, 1 - i * 0.16);
					const dir = i % 2 ? -1 : 1;
					const s = phase * dir * (1 + (i + 1) * 0.18);
					const amp = curAmp * (1 + i * 0.45) * ww;
					const grow = (i + 1) * curGap * ww;
					shape(sx, sy, grow, amp, wl, s, i + 1);
					trace();
					const prevCol = i === 0 ? prevWaveInner : prevWaveOuter;
					const currCol = i === 0 ? cWaveInner : cWaveOuter;
					fillCrossfade(c, prevCol, currCol, cv, (alphas[i] ?? 0.42) * wv);
				}
				c.globalAlpha = 1;
			}

			// 2) 앞쪽 물결 윤곽선 계산 후, <img> 내부만 투명하게 도려냄
			//    → <img> 안쪽으로 파고든 물결 골에서는 물결 레이어 안쪽이 이미지 가장자리 위로 일렁이며 겹침
			//    → <img> 바깥쪽은 도려내지 않아 외곽 물결과의 틈새 없음
			const noFrontWave = staticFrontWave ?? cfg.staticFrontWave;
			const bodyWave = noFrontWave ? 0 : (L === 0 ? curAmp : curAmp * 0.85) * ww;
			const frontGrow = noFrontWave ? 0 : -bodyWave * 0.65;
			shape(sx, sy, frontGrow, bodyWave, curWl * 1.1, phase, 0, noFrontWave);

			if (wv > 0.01 && L > 0) {
				c.save();
				traceRoundedRect(c, bw * sx, bh * sy, curR);
				c.clip();
				trace();
				c.globalCompositeOperation = 'destination-out';
				c.globalAlpha = 1;
				c.fillStyle = '#000000';
				c.fill();
				c.restore();
			}

			// 클릭(press) 시 <img> 위 미세 딤 피드백
			if (pv > 0.005 && cfg.clickReactive) {
				c.save();
				traceRoundedRect(c, bw * sx, bh * sy, curR);
				c.fillStyle = '#000000';
				c.globalAlpha = 0.18 * pv;
				c.fill();
				c.restore();
			}

			// 3) 본체 외곽 테두리 (borderWidth > 0 일 때만 렌더링)
			if (curBorderW > 0.05) {
				trace();
				c.lineWidth = curBorderW;
				c.lineJoin = 'round';
				c.lineCap = 'round';

				strokeCrossfade(c, prevBorder, cBorder, cv, 1);

				if (hv > 0.003 && cHoverBorder !== cBorder && !isTransparent(cHoverBorder)) {
					c.globalAlpha = hv;
					c.strokeStyle = cHoverBorder;
					c.stroke();
				}

				if (pv > 0.003 && cPressBorder !== cHoverBorder && !isTransparent(cPressBorder)) {
					c.globalAlpha = pv;
					c.strokeStyle = cPressBorder;
					c.stroke();
				}
			}

			c.globalAlpha = 1;
		}

		function tick(now: number) {
			raf = 0;
			const dt = Math.min((now - last) / 1000, 1 / 30) || 1 / 60;
			last = now;
			const moving = update(dt);
			draw();
			if (moving) {
				raf = requestAnimationFrame(tick);
				return;
			}
			// 유휴 상태로 완전히 복귀하면 캔버스를 꺼서 순수 <img>만 유지 (메모리·GPU 절약)
			if (
				!active &&
				!inside &&
				!pressed &&
				cfg.pauseWhenIdle &&
				ws.x <= 0.002 &&
				bs.x <= 0.01 &&
				ps.x <= 0.002
			) {
				resetImgDom();
				canvasActive = false;
			}
		}

		function wake(animateColorChange = false) {
			if (!n) return;
			readColors(animateColorChange);
			if (raf) return;
			last = performance.now();
			raf = requestAnimationFrame(tick);
		}

		const onDown = (e: PointerEvent) => {
			if (e.pointerType === 'touch') {
				clearTimeout(touchResetTimer);
				if (cfg.hoverReactive) {
					inside = true;
					hovered = true;
				}
			} else if (!inside && cfg.hoverReactive && cfg.bulgeReactive) {
				return;
			}
			if (cfg.clickReactive) {
				pressed = true;
			}
			wake();
		};

		const onUp = (e: PointerEvent) => {
			if (!pressed && e.pointerType !== 'touch') return;
			pressed = false;
			if (e.pointerType === 'touch') {
				hovered = false;
				clearTimeout(touchResetTimer);
				touchResetTimer = setTimeout(() => {
					inside = false;
					wake();
				}, 400);
			}
			wake();
		};

		const onCancel = () => {
			clearTimeout(touchResetTimer);
			inside = false;
			hovered = false;
			pressed = false;
			wake();
		};

		function syncPointerCoords(clientX: number, clientY: number): boolean {
			const r = box.getBoundingClientRect();
			if (!r.width || !r.height) return false;
			lx = (clientX - (r.left + r.width / 2)) * (W / r.width);
			ly = (clientY - (r.top + r.height / 2)) * (H / r.height);

			const hbw = bw / 2;
			const hbh = bh / 2;
			const rr = Math.min(rs.x, hbw, hbh);
			const ihw = Math.max(0, hbw - rr);
			const ihh = Math.max(0, hbh - rr);

			const ix = Math.max(-ihw, Math.min(ihw, lx));
			const iy = Math.max(-ihh, Math.min(ihh, ly));
			const ox = lx - ix;
			const oy = ly - iy;
			const ol = Math.hypot(ox, oy);

			const qx = Math.abs(lx) - ihw;
			const qy = Math.abs(ly) - ihh;
			const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr;

			if (ol > 1e-4) {
				unx = ox / ol;
				uny = oy / ol;
				cx = ix + unx * rr;
				cy = iy + uny * rr;
			}

			const maxB = cfg.bulgeReactive ? Math.max(0, cfg.bulge) : 0;
			const nextInside = d <= maxB;
			if (nextInside !== inside) {
				inside = nextInside;
				hovered = cfg.hoverReactive ? nextInside : false;
				if (!nextInside) pressed = false;
			}

			if (!cfg.bulgeReactive || d <= 0 || d >= cfg.reach || maxB <= 0) {
				ampT = 0;
			} else if (d <= maxB) {
				ampT = d;
			} else {
				const span = Math.max(1, cfg.reach - maxB);
				ampT = maxB * ((cfg.reach - d) / span);
			}

			return ampT > 0 || nextInside;
		}

		const clearPointer = () => {
			hasPointer = false;
			if (!wasNear && !inside && ampT <= 0) return;
			ampT = 0;
			inside = false;
			hovered = false;
			pressed = false;
			wasNear = false;
			wake();
		};

		const onMove = (e: PointerEvent) => {
			if (e.pointerType === 'touch') return;
			if (!cfg.hoverReactive && !cfg.bulgeReactive) return;

			if (isPointerBlocked(e.target, wrap)) {
				clearPointer();
				return;
			}

			hasPointer = true;
			lastClientX = e.clientX;
			lastClientY = e.clientY;
			const activeNear = syncPointerCoords(e.clientX, e.clientY);
			if (activeNear || wasNear) wake();
			wasNear = activeNear;
		};

		const onDocLeave = () => {
			clearPointer();
		};

		box.addEventListener('pointerdown', onDown);
		box.addEventListener('pointercancel', onCancel);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointermove', onMove, { passive: true });
		document.documentElement.addEventListener('pointerleave', onDocLeave);

		readColors(false);
		relayout = layout;
		syncSetting = () => {
			queueMicrotask(() => {
				if (!engineReady) return;
				draw();
				wake(true);
			});
		};
		layout();

		const ro = new ResizeObserver(layout);
		ro.observe(box);

		window.addEventListener('resize', layout);

		let removeDprListener: (() => void) | null = null;
		function watchDpr() {
			removeDprListener?.();
			const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dpr)`);
			const handler = () => {
				layout();
				watchDpr();
			};
			mq.addEventListener('change', handler);
			removeDprListener = () => mq.removeEventListener('change', handler);
		}
		watchDpr();

		return () => {
			clearTimeout(touchResetTimer);
			cancelAnimationFrame(raf);
			ro.disconnect();
			removeDprListener?.();
			window.removeEventListener('resize', layout);
			relayout = undefined;
			syncSetting = undefined;
			box.removeEventListener('pointerdown', onDown);
			box.removeEventListener('pointercancel', onCancel);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointermove', onMove);
			document.documentElement.removeEventListener('pointerleave', onDocLeave);
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
			resetImgDom();
			hovered = false;
			pressed = false;
		};
	}
</script>

<div
	class="lq fd-wrap fd-image-wrap {klass}"
	class:full-width={fullWidth}
	bind:this={wrap}
	data-ready={imageLoaded || undefined}
	data-hovered={hovered || undefined}
	data-pressed={pressed || undefined}
	data-disabled={disabled || undefined}
	style:--lq-i-r="{cfg.radius}px"
	style:--lq-i-inset="{inset}px"
	style:--fd-i-r="{cfg.radius}px"
	style:--fd-i-inset="{inset}px"
	style:--fd-border-w="{Math.max(0, cfg.borderWidth)}px"
	style:--fd-color-wave={hasExplicitWaveColor ? cfg.waveColor : undefined}
	style:--fd-color-border={cfg.borderColor}
	style:--fd-color-border-hover={cfg.hoverBorderColor}
	style:--fd-color-border-press={cfg.pressBorderColor}
	style:--fd-text={cfg.textColor}
	{style}
>
	{#if canvasActive}
		<canvas bind:this={canvas} aria-hidden="true" style:left="{-SAFE}px" style:top="{-SAFE}px"
		></canvas>
	{/if}

	<div bind:this={box} class="fd-body fd-image-body {bodyClass}" style={bodyStyle} {...rest}>
		{#key imgRenderKey}
			<img
				bind:this={imgEl}
				class="fd-img"
				{src}
				{alt}
				crossorigin={imgCrossOrigin}
				style:object-fit={fit}
				style:object-position={objectPosition}
				draggable="false"
				{loading}
				{decoding}
				onload={handleImgLoad}
				onerror={handleImgError}
			/>
		{/key}
		{#if cfg.borderWidth > 0 && !canvasActive}
			<span class="fd-image-idle-border" aria-hidden="true"></span>
		{/if}
		{#if children}
			<div class="fd-image-overlay">
				{@render children()}
			</div>
		{/if}
	</div>
</div>

<style>
	.fd-image-wrap {
		position: relative;
		display: inline-grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr);
		min-width: 0;
		min-height: 0;
		isolation: isolate;
		vertical-align: middle;
	}

	.fd-image-wrap.full-width {
		display: grid;
		width: 100%;
	}

	.fd-image-wrap[data-disabled] {
		opacity: 0.55;
		pointer-events: none;
	}

	canvas {
		position: absolute;
		z-index: 1;
		pointer-events: none;
	}

	.fd-image-body {
		--fd-i-border: var(--fd-color-border, transparent);
		--fd-i-border-hover: var(--fd-color-border-hover, var(--fd-i-border));
		--fd-i-border-press: var(--fd-color-border-press, var(--fd-i-border-hover));

		position: relative;
		box-sizing: border-box;
		margin: 0;
		padding: 0;
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		color: var(--fd-text, #ffffff);
		-webkit-tap-highlight-color: transparent;

		border: var(--fd-i-inset) solid transparent;
		border-radius: calc(var(--fd-i-r) + var(--fd-i-inset));
	}

	.fd-img {
		position: relative;
		z-index: 0;
		display: block;
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		border-radius: var(--fd-i-r);
		background: color-mix(in srgb, var(--surface-3, #2c2c2e) 45%, transparent);
		user-select: none;
		pointer-events: none;
	}

	.fd-image-idle-border {
		position: absolute;
		inset: 0;
		z-index: 1;
		border-radius: var(--fd-i-r);
		box-shadow: inset 0 0 0 var(--fd-border-w, 0px) var(--fd-i-border);
		pointer-events: none;
	}

	.fd-image-overlay {
		position: absolute;
		inset: 0;
		z-index: 2;
		display: grid;
		place-items: center;
		pointer-events: none;
	}
</style>
