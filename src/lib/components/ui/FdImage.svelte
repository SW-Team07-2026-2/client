<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { FluidSetting, computeFluidWave, isPointerBlocked } from '#lib/fluid/setting';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		/** 표시할 이미지 경로 (URL 또는 Data URI) */
		src: string;
		/** 대체 텍스트 (웹 접근성 및 폴백 이미지용) */
		alt?: string;
		/** 이미지 맞춤 방식 (기본값: 'cover') */
		fit?: 'cover' | 'contain' | 'fill';
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
		/** 캔버스 물리 엔진 준비 완료 여부 */
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
		children,
		setting,
		hoverRadius,
		active = false,
		disabled = false,
		fullWidth = false,
		staticFrontWave,
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
		extractedWaveColor = $bindable('#8b8b99'),
		class: klass = '',
		bodyClass = '',
		style,
		bodyStyle,
		wrapEl = $bindable(undefined),
		boxEl = $bindable(undefined),
		...rest
	}: Props = $props();

	// 사용자가 명시적으로 waveColor를 지정했는지 판별 (미지정 시 이미지 가장자리 평균색 자동 사용)
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
	let canvas: HTMLCanvasElement;

	let relayout: (() => void) | undefined;
	let syncSetting: (() => void) | undefined;

	let loadedImg = $state<HTMLImageElement | null>(null);
	let autoWaveInner = $state('rgb(148, 163, 184)');
	let autoWaveOuter = $state('rgb(100, 116, 139)');

	/* ───────── 이미지 전체 평균색 추출 유틸 ───────── */

	function fallbackColorFromSrc(source: string): [number, number, number] {
		let hash = 2166136261;
		for (let i = 0; i < source.length; i++) {
			hash ^= source.charCodeAt(i);
			hash = Math.imul(hash, 16777619);
		}
		const hue = Math.abs(hash) % 360;
		// 과도하게 튀지 않도록 차분한 톤으로 변환 (HSL hue, 24%, 38%)
		const s = 0.24;
		const l = 0.38;
		const c = (1 - Math.abs(2 * l - 1)) * s;
		const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
		const m = l - c / 2;
		let r1 = 0,
			g1 = 0,
			b1 = 0;
		if (hue < 60) [r1, g1, b1] = [c, x, 0];
		else if (hue < 120) [r1, g1, b1] = [x, c, 0];
		else if (hue < 180) [r1, g1, b1] = [0, c, x];
		else if (hue < 240) [r1, g1, b1] = [0, x, c];
		else if (hue < 300) [r1, g1, b1] = [x, 0, c];
		else [r1, g1, b1] = [c, 0, x];
		return [
			Math.round((r1 + m) * 255),
			Math.round((g1 + m) * 255),
			Math.round((b1 + m) * 255)
		];
	}

	/** 인위적인 채도/명도 왜곡 없이 원본 이미지의 평균 RGB 색상을 그대로 사용 */
	function formatRgbForWaves(
		r: number,
		g: number,
		b: number
	): { inner: string; outer: string; accent: string } {
		const color = `rgb(${r}, ${g}, ${b})`;
		return {
			inner: color,
			outer: color,
			accent: color
		};
	}

	/**
	 * 오프스크린 캔버스에 이미지를 그리고 이미지 전체 픽셀의
	 * 평균 색상을 추출합니다.
	 */
	function extractAverageWaveColors(
		img: HTMLImageElement,
		sourceUrl: string
	): { inner: string; outer: string; accent: string } {
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
			// 외부 이미지 CORS(SecurityError) 발생 시 아래 폴백 색상으로 안전하게 처리
		}

		const [fr, fg, fb] = fallbackColorFromSrc(sourceUrl);
		return formatRgbForWaves(fr, fg, fb);
	}

	// src 변경 시 이미지 로드 및 전체 평균색 추출
	$effect(() => {
		const currentSrc = src;
		void fit;
		if (typeof window === 'undefined' || !currentSrc) {
			loadedImg = null;
			imageLoaded = false;
			return;
		}

		let cancelled = false;
		imageLoaded = false;

		const [fr, fg, fb] = fallbackColorFromSrc(currentSrc);
		const initial = formatRgbForWaves(fr, fg, fb);
		autoWaveInner = initial.inner;
		autoWaveOuter = initial.outer;
		extractedWaveColor = hasExplicitWaveColor ? (cfg.waveColor ?? initial.accent) : initial.accent;

		const img = new Image();
		if (!currentSrc.startsWith('data:') && !currentSrc.startsWith('blob:')) {
			img.crossOrigin = 'anonymous';
		}

		img.onload = () => {
			if (cancelled) return;
			loadedImg = img;
			imageLoaded = true;
			const extracted = extractAverageWaveColors(img, currentSrc);
			autoWaveInner = extracted.inner;
			autoWaveOuter = extracted.outer;
			extractedWaveColor = hasExplicitWaveColor
				? (cfg.waveColor ?? extracted.accent)
				: extracted.accent;
			syncSetting?.();
		};

		img.onerror = () => {
			if (cancelled) return;
			// 외부 서버가 CORS(Access-Control-Allow-Origin)를 지원하지 않는 경우 crossOrigin 없이 재로드
			if (img.crossOrigin) {
				const retry = new Image();
				retry.onload = () => {
					if (cancelled) return;
					loadedImg = retry;
					imageLoaded = true;
					syncSetting?.();
				};
				retry.onerror = () => {
					if (cancelled) return;
					loadedImg = null;
					imageLoaded = false;
					syncSetting?.();
				};
				retry.src = currentSrc;
				return;
			}
			loadedImg = null;
			imageLoaded = false;
			syncSetting?.();
		};

		img.src = currentSrc;

		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		wrapEl = wrap;
		boxEl = box;
	});

	$effect(() => {
		if (disabled) {
			hovered = false;
			pressed = false;
			return;
		}
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		return untrack(() => initEngine());
	});

	// 도형 크기/여백에 영향을 주는 설정이 바뀌면 레이아웃 재계산
	$effect(() => {
		void inset;
		void SAFE;
		relayout?.();
	});

	// 물결·반지름·색상·최적화 옵션이 동적으로 바뀌면 스프링을 유지한 채 부드럽게 전환
	$effect(() => {
		void cfg;
		void hoverRadius;
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

	function initEngine() {
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		/* ───────── 크기 & 둘레 샘플 점 ───────── */
		let W = 0;
		let H = 0;
		let bw = 0;
		let bh = 0;
		let cw = 0;
		let ch = 0;
		let dpr = 1;
		let n = 0;

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

		/* ───────── 포인터 & 스프링 상태 ───────── */
		let lx = 0;
		let ly = 0;
		let cx = 0;
		let cy = 0;
		let unx = 0;
		let uny = -1;
		let inside = false;
		let wasNear = false;
		let ampT = 0;
		let hasPointer = false;
		let lastClientX = 0;
		let lastClientY = 0;

		// ws: 물결 활성 스프링 (0..1)
		const ws = { x: !cfg.pauseWhenIdle ? 1 : 0, v: 0 };
		// hs: 호버 상태 스프링 (0..1)
		const hs = { x: 0, v: 0 };
		// ps: 클릭/누름 스프링 (0..1)
		const ps = { x: 0, v: 0 };
		// cs: 물결/테두리 색상 변경 크로스페이드 스프링 (0..1)
		const cs = { x: 1, v: 0 };
		// bs: 근접 마그네틱 돌출 진폭 스프링
		const bs = { x: 0, v: 0 };
		// rs: 반지름(radius) 모핑 스프링 (px 단위 현재 반경)
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

		/* ───────── 물결 & 테두리 색상 ───────── */
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
					nextBorder !== cBorder)
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

		/* ───────── 도형 (상단 정중앙 시작 둥근 사각형 둘레 균등 샘플링) ───────── */
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
			// 상단 변 정중앙(x = 0, y = -hh)을 k = 0 시작점으로 고정하여 반지름 모핑 시 회전 왜곡 방지
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
					case 0: // 위 변
						x = -hw + r + sw * u;
						y = -hh;
						oy = -1;
						break;
					case 1: {
						const a = -Math.PI / 2 + (u * Math.PI) / 2; // 우상
						ox = Math.cos(a);
						oy = Math.sin(a);
						x = hw - r + ox * r;
						y = -hh + r + oy * r;
						break;
					}
					case 2: // 오른쪽 변
						x = hw;
						y = -hh + r + sh * u;
						ox = 1;
						break;
					case 3: {
						const a = (u * Math.PI) / 2; // 우하
						ox = Math.cos(a);
						oy = Math.sin(a);
						x = hw - r + ox * r;
						y = hh - r + oy * r;
						break;
					}
					case 4: // 아래 변
						x = hw - r - sw * u;
						y = hh;
						oy = 1;
						break;
					case 5: {
						const a = Math.PI / 2 + (u * Math.PI) / 2; // 좌하
						ox = Math.cos(a);
						oy = Math.sin(a);
						x = -hw + r + ox * r;
						y = hh - r + oy * r;
						break;
					}
					case 6: // 왼쪽 변
						x = -hw;
						y = hh - r - sh * u;
						ox = -1;
						break;
					default: {
						const a = Math.PI + (u * Math.PI) / 2; // 좌상
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
			if (!box || !canvas) return;
			W = box.offsetWidth;
			H = box.offsetHeight;
			bw = W - 2 * inset;
			bh = H - 2 * inset;
			if (bw < 2 || bh < 2) return;

			dpr = Math.min(window.devicePixelRatio || 1, 4);
			cw = W + SAFE * 2;
			ch = H + SAFE * 2;
			canvas.width = Math.round(cw * dpr);
			canvas.height = Math.round(ch * dpr);
			canvas.style.width = cw + 'px';
			canvas.style.height = ch + 'px';

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

			if (!ready) {
				rs.x = getTargetRadius();
				rs.v = 0;
				if (!cfg.pauseWhenIdle) {
					ws.x = 1;
				}
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
			ready = true;
			if (!cfg.pauseWhenIdle || inside || pressed || ampT > 0 || ws.x > 0.001 || hs.x > 0.001) {
				wake();
			}
		}

		/* ───────── 물리 시뮬레이션 ───────── */
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

			// 반지름(radius)이 변하는 중이면 둘레 샘플 좌표 갱신
			if (Math.abs(rs.x - builtRadius) > 0.04) {
				build(rs.x);
			}

			// 근접 돌출: 몸체 경계의 최근접점(cx, cy)을 중심으로 포인터 방향으로 솟음
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

		/* ───────── 렌더링 ───────── */
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

				const wScale =
					grow <= 0 && curBulge > 0 ? Math.max(0, 1 - Math.max(0, bi) / curBulge) : 1;
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

		function drawImageInsideClip(c: CanvasRenderingContext2D, sx: number, sy: number) {
			if (!loadedImg) return;
			const iw = loadedImg.naturalWidth || loadedImg.width || bw;
			const ih = loadedImg.naturalHeight || loadedImg.height || bh;
			if (iw < 1 || ih < 1) return;

			// 앞쪽 이미지가 물결/돌출에 의해 가장자리 일부가 자연스럽게 잘리면서 일렁이도록
			// 마그네틱 돌출 및 물결 진폭만큼의 여유 영역(bleed)을 포함해 렌더링
			const bleed = Math.ceil((cfg.bulgeReactive ? cfg.bulge : 0) + curAmp + 4);
			const targetW = bw * sx + bleed * 2;
			const targetH = bh * sy + bleed * 2;

			if (fit === 'fill') {
				c.drawImage(loadedImg, -targetW / 2, -targetH / 2, targetW, targetH);
				return;
			}

			if (fit === 'contain') {
				const scale = Math.min((bw * sx) / iw, (bh * sy) / ih);
				const dw = iw * scale;
				const dh = ih * scale;
				c.drawImage(loadedImg, -dw / 2, -dh / 2, dw, dh);
				return;
			}

			// 기본값: 'cover'
			const scale = Math.max(targetW / iw, targetH / ih);
			const dw = iw * scale;
			const dh = ih * scale;
			c.drawImage(loadedImg, -dw / 2, -dh / 2, dw, dh);
		}

		function draw() {
			if (!n) return;
			const c = ctx!;
			c.setTransform(1, 0, 0, 1, 0, 0);
			c.clearRect(0, 0, canvas.width, canvas.height);
			c.setTransform(dpr, 0, 0, dpr, (cw / 2) * dpr, (ch / 2) * dpr);

			const wv = Math.min(1, Math.max(0, ws.x));
			const ww = Math.min(ws.x, 1.15);
			const hv = Math.min(1, Math.max(0, hs.x));
			const pv = Math.min(1, Math.max(0, ps.x));
			const cv = Math.min(1, Math.max(0, cs.x));

			// press 시 텐션 변형
			const gx = cfg.pressDeform.x * ps.x;
			const gy = cfg.pressDeform.y * ps.x;
			const sx = (bw / 2 + gx) / (bw / 2);
			const sy = (bh / 2 + gy) / (bh / 2);

			// 1) 뒤쪽 물결 겹 (바깥 겹부터, 미지정 시 이미지 가장자리 평균색 기반 2톤 적용)
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

			// 2) 가장 앞쪽(이미지 본체) 레이어:
			//    물결 진폭만큼 안쪽(-bodyWave * 0.55)으로 파고들며 파동이 일렁여
			//    앞쪽 이미지의 가장자리 일부가 실제로 잘리면서(clip) 물결 윤곽이 형성됨
			const noFrontWave = staticFrontWave ?? cfg.staticFrontWave;
			const bodyWave = noFrontWave ? 0 : (L === 0 ? curAmp : curAmp * 0.85) * ww;
			const frontGrow = noFrontWave ? 0 : -bodyWave * 0.55;
			shape(sx, sy, frontGrow, bodyWave, curWl * 1.1, phase, 0, noFrontWave);
			trace();

			// 뒤쪽 물결 색상이 이미지 내부에 비치지 않도록 본체 내부 클리어 후 클리핑하여 이미지 렌더링
			if (wv > 0.01 && L > 0) {
				c.save();
				c.globalCompositeOperation = 'destination-out';
				c.globalAlpha = 1;
				c.fillStyle = '#000000';
				c.fill();
				c.restore();
			}

			c.save();
			trace();
			c.clip();
			c.globalAlpha = 1;

			if (loadedImg) {
				drawImageInsideClip(c, sx, sy);
			} else {
				// 이미지 로드 전 기본 배경
				c.fillStyle = prevWaveOuter;
				c.globalAlpha = 0.25;
				c.fillRect(-cw / 2, -ch / 2, cw, ch);
			}

			// 클릭(press) 시 미세한 딤 피드백
			if (pv > 0.005 && cfg.clickReactive) {
				c.globalAlpha = 0.18 * pv;
				c.fillStyle = '#000000';
				c.fillRect(-cw / 2, -ch / 2, cw, ch);
			}

			c.restore();

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

		/* ───────── 루프 제어 ───────── */
		function tick(now: number) {
			raf = 0;
			const dt = Math.min((now - last) / 1000, 1 / 30) || 1 / 60;
			last = now;
			const moving = update(dt);
			draw();
			if (moving) raf = requestAnimationFrame(tick);
		}

		function wake(animateColorChange = false) {
			if (!n) return;
			readColors(animateColorChange);
			if (raf) return;
			last = performance.now();
			raf = requestAnimationFrame(tick);
		}

		/* ───────── 포인터 입력 이벤트 ───────── */
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
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ready = false;
			hovered = false;
			pressed = false;
		};
	}
</script>

<div
	class="lq fd-wrap fd-image-wrap {klass}"
	class:full-width={fullWidth}
	bind:this={wrap}
	data-ready={(ready && imageLoaded) || undefined}
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
	<canvas bind:this={canvas} aria-hidden="true" style:left="{-SAFE}px" style:top="{-SAFE}px"
	></canvas>

	<div bind:this={box} class="fd-body fd-image-body {bodyClass}" style={bodyStyle} {...rest}>
		<img
			class="fd-fallback-img"
			{src}
			{alt}
			style:object-fit={fit}
			draggable="false"
			loading="lazy"
		/>
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
		z-index: 0;
		pointer-events: none;
	}

	.fd-image-body {
		--fd-i-border: var(--fd-color-border, transparent);
		--fd-i-border-hover: var(--fd-color-border-hover, var(--fd-i-border));
		--fd-i-border-press: var(--fd-color-border-press, var(--fd-i-border-hover));

		position: relative;
		z-index: 1;
		box-sizing: border-box;
		margin: 0;
		padding: 0;
		width: 100%;
		height: 100%;
		overflow: hidden;
		color: var(--fd-text, #ffffff);
		-webkit-tap-highlight-color: transparent;

		border: var(--fd-i-inset) solid transparent;
		border-radius: calc(var(--fd-i-r) + var(--fd-i-inset));
		background-clip: padding-box;
		box-shadow: inset 0 0 0 var(--fd-border-w, 0px) var(--fd-i-border);
	}

	.fd-fallback-img {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: var(--fd-i-r);
		user-select: none;
		pointer-events: none;
	}

	/* 캔버스와 이미지가 모두 준비되면 폴백 <img>와 CSS 테두리를 숨기고 캔버스가 물결 클리핑 이미지를 전담 */
	.fd-image-wrap[data-ready] .fd-image-body {
		box-shadow: none;
		overflow: visible;
	}

	.fd-image-wrap[data-ready] .fd-fallback-img {
		opacity: 0;
	}

	.fd-image-overlay {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		pointer-events: none;
	}
</style>
