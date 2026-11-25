<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { FluidSetting, computeFluidWave, isPointerBlocked } from '#lib/common/type/fluid';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		/** 내부에 렌더링할 콘텐츠 */
		children?: Snippet;
		/** 유체/물결/반응성/최적화 설정 (FluidSetting 인스턴스 또는 부분 설정 객체) */
		setting?: FluidSetting | Partial<FluidSetting>;
		/** 비활성화 여부 */
		disabled?: boolean;
		/** 가로 전체 폭(width: 100%) 사용 여부 */
		fullWidth?: boolean;
		/** 가장 앞쪽(본체) 레이어의 물결 요동 비활성화 여부 (true면 뒷 레이어만 물결침, 미지정 시 setting.staticFrontWave 따름) */
		staticFrontWave?: boolean;

		/* ── 상태 바인딩 (상위 컴포넌트에서 조회/전달 가능) ── */
		/** 현재 포인터 호버 상태 여부 */
		hovered?: boolean;
		/** 현재 포인터 누름(press) 상태 여부 */
		pressed?: boolean;
		/** 캔버스 물리 엔진 준비 완료 여부 */
		ready?: boolean;

		/* ── 스타일 & DOM 참조 ── */
		/** 외부 래퍼(.lq.fd-wrap) 클래스 */
		class?: string;
		/** 내부 몸체(.fd-body) 클래스 */
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
		children,
		setting,
		disabled = false,
		fullWidth = false,
		staticFrontWave,
		hovered = $bindable(false),
		pressed = $bindable(false),
		ready = $bindable(false),
		class: klass = '',
		bodyClass = '',
		style,
		bodyStyle,
		wrapEl = $bindable(undefined),
		boxEl = $bindable(undefined),
		...rest
	}: Props = $props();

	const cfg = $derived(FluidSetting.from(setting));
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

	// 도형 크기/둘레에 영향을 주는 설정이 바뀌면 레이아웃 재계산
	$effect(() => {
		void cfg.radius;
		void inset;
		void SAFE;
		relayout?.();
	});

	// 색상이나 물결·최적화 옵션이 동적으로 바뀌면 스프링을 유지한 채 부드럽게 전환
	$effect(() => {
		void cfg;
		void staticFrontWave;
		syncSetting?.();
	});

	function isTransparent(col: string): boolean {
		const c = col.trim().toLowerCase();
		return !c || c === 'transparent' || c === 'rgba(0, 0, 0, 0)' || c === 'rgba(0,0,0,0)';
	}

	/** 색상이 반투명(alpha < 1)인지 판별 — 불투명 본체에서 불필요한 destination-out 경계선(블랙 틈새) 방지 */
	function hasTranslucentAlpha(col: string): boolean {
		const c = col.trim().toLowerCase();
		if (isTransparent(c)) return true;
		// rgba(r, g, b, a) / hsla(h, s, l, a)
		const commaAlpha = /^(?:rgba|hsla)\([^,]+,[^,]+,[^,]+,\s*([^)]+)\)$/.exec(c);
		if (commaAlpha) {
			const v = commaAlpha[1].trim();
			const num = v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v);
			return Number.isFinite(num) && num < 0.995;
		}
		// rgb(r g b / a) / hsl(... / a) / oklch(... / a)
		const slashAlpha = /\/\s*([0-9.]+%?)\s*\)$/.exec(c);
		if (slashAlpha) {
			const v = slashAlpha[1].trim();
			const num = v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v);
			return Number.isFinite(num) && num < 0.995;
		}
		// #rrggbbaa / #rgba
		if (c.startsWith('#')) {
			if (c.length === 9) return parseInt(c.slice(7, 9), 16) < 254;
			if (c.length === 5) return parseInt(c.slice(4, 5), 16) < 15;
		}
		return false;
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

		// ws: 물결 활성 스프링 (0..1) — 호버 중이거나 pauseWhenIdle=false일 때 1로 수렴
		const ws = { x: !cfg.pauseWhenIdle ? 1 : 0, v: 0 };
		// hs: 호버 색상 스프링 (0..1)
		const hs = { x: 0, v: 0 };
		// ps: 클릭/누름 스프링 (0..1)
		const ps = { x: 0, v: 0 };
		// cs: 설정(색상) 변경 시 이전 색상 -> 새 색상 크로스페이드 스프링 (0..1)
		const cs = { x: 1, v: 0 };
		// bs: 근접 마그네틱 돌출 진폭 스프링 (임계 감쇠로 출렁임 없이 매끄럽게 수렴)
		const bs = { x: 0, v: 0 };

		// 물결 및 테두리 파라미터 보간 상태 (setting이 동적으로 바뀔 때 부드럽게 이어짐)
		let curAmp = cfg.waveAmp;
		let curGap = cfg.layerGap;
		let curWl = cfg.waveLength;
		let curSpin = cfg.spin;
		let curBorderW = Math.max(0, cfg.borderWidth);

		let phase = 0;
		let raf = 0;
		let last = 0;

		/* ───────── 색상 (CSS 변수 해석) ───────── */
		let cBase = cfg.color;
		let prevBase = cBase;
		let cHover = cfg.hoverColor ?? cBase;
		let prevHover = cHover;
		let cPress = cfg.pressColor;
		let cWave = cfg.waveColor ?? cHover;
		let prevWave = cWave;
		let cHoverWave = cfg.hoverWaveColor ?? cWave;
		let prevHoverWave = cHoverWave;

		let cBorder = cfg.borderColor ?? cfg.textColor;
		let prevBorder = cBorder;
		let cHoverBorder = cfg.hoverBorderColor ?? cBorder;
		let prevHoverBorder = cHoverBorder;
		let cPressBorder = cfg.pressBorderColor ?? cHoverBorder;

		let touchResetTimer: ReturnType<typeof setTimeout> | undefined;

		function readColors(animateChange = false) {
			if (!box) return;
			const s = getComputedStyle(box);
			const get = (k: string, d: string) => s.getPropertyValue(k).trim() || d;
			const nextBase = get('--fd-i-base', cfg.color);
			const nextHover = get('--fd-i-hover', nextBase);
			const nextPress = get('--fd-i-press', cfg.pressColor);
			const nextWave = get('--fd-i-wave', nextHover);
			const nextHoverWave = get('--fd-i-wave-hover', nextWave);

			const fallbackBorder = cfg.borderColor ?? cfg.textColor;
			const nextBorder = get('--fd-i-border', fallbackBorder);
			const nextHoverBorder = get('--fd-i-border-hover', nextBorder);
			const nextPressBorder = get('--fd-i-border-press', nextHoverBorder);

			if (
				animateChange &&
				(nextBase !== cBase ||
					nextHover !== cHover ||
					nextWave !== cWave ||
					nextHoverWave !== cHoverWave ||
					nextBorder !== cBorder ||
					nextHoverBorder !== cHoverBorder)
			) {
				prevBase = cBase;
				prevHover = cHover;
				prevWave = cWave;
				prevHoverWave = cHoverWave;
				prevBorder = cBorder;
				prevHoverBorder = cHoverBorder;
				cs.x = 0;
				cs.v = 0;
			} else if (!animateChange) {
				prevBase = nextBase;
				prevHover = nextHover;
				prevWave = nextWave;
				prevHoverWave = nextHoverWave;
				prevBorder = nextBorder;
				prevHoverBorder = nextHoverBorder;
				cs.x = 1;
				cs.v = 0;
			}

			cBase = nextBase;
			cHover = nextHover;
			cPress = nextPress;
			cWave = nextWave;
			cHoverWave = nextHoverWave;
			cBorder = nextBorder;
			cHoverBorder = nextHoverBorder;
			cPressBorder = nextPressBorder;
		}

		/* ───────── 도형 (둥근 사각형 둘레 균등 샘플링) ───────── */
		function build() {
			const r = Math.min(cfg.radius, bw / 2, bh / 2);
			const hw = bw / 2;
			const hh = bh / 2;
			const sw = bw - 2 * r;
			const sh = bh - 2 * r;
			const qa = (Math.PI * r) / 2;
			const lens = [sw, qa, sh, qa, sw, qa, sh, qa];
			const total = lens.reduce((a, c) => a + c, 0);

			for (let k = 0; k < n; k++) {
				let s = (k / n) * total;
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

		let laidOutW = 0;
		let laidOutH = 0;
		let laidOutDpr = 0;
		let laidOutRadius = -1;
		let laidOutInset = -1;
		let laidOutSafe = -1;

		function layout() {
			if (!box || !canvas) return;
			const nextW = box.offsetWidth;
			const nextH = box.offsetHeight;
			const nextBw = nextW - 2 * inset;
			const nextBh = nextH - 2 * inset;
			if (nextBw < 2 || nextBh < 2) return;

			const nextDpr = Math.min(window.devicePixelRatio || 1, 4);
			if (
				ready &&
				nextW === laidOutW &&
				nextH === laidOutH &&
				nextDpr === laidOutDpr &&
				cfg.radius === laidOutRadius &&
				inset === laidOutInset &&
				SAFE === laidOutSafe
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
			laidOutRadius = cfg.radius;
			laidOutInset = inset;
			laidOutSafe = SAFE;

			cw = W + SAFE * 2;
			ch = H + SAFE * 2;
			canvas.width = Math.round(cw * dpr);
			canvas.height = Math.round(ch * dpr);
			canvas.style.width = cw + 'px';
			canvas.style.height = ch + 'px';

			const r = Math.min(cfg.radius, bw / 2, bh / 2);
			const approx = 2 * (bw - 2 * r) + 2 * (bh - 2 * r) + 2 * Math.PI * r;
			const nextN = Math.min(360, Math.max(48, Math.round(approx / 5)));

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
						const src = Math.min(oldN - 1, Math.floor((i / n) * oldN));
						b[i] = oldB[src];
						bv[i] = oldBv[src];
					}
				}
			}
			if (!ready && !cfg.pauseWhenIdle) {
				ws.x = 1;
				curAmp = cfg.waveAmp;
				curGap = cfg.layerGap;
				curWl = cfg.waveLength;
				curSpin = cfg.spin;
			}
			build();
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

			const hT = inside && cfg.hoverReactive ? 1 : 0;
			const wT = !cfg.pauseWhenIdle || hT === 1 ? 1 : 0;
			const pT = pressed && cfg.clickReactive ? 1 : 0;
			const bT = cfg.bulgeReactive && ampT > 0.01 ? ampT * 1.02 : 0;

			// 물결 및 테두리 두께 부드러운 보간
			const lerpRate = Math.min(1, dt * 12);
			curAmp += (cfg.waveAmp - curAmp) * lerpRate;
			curGap += (cfg.layerGap - curGap) * lerpRate;
			curWl += (cfg.waveLength - curWl) * lerpRate;
			curSpin += (cfg.spin - curSpin) * lerpRate;
			const targetBorderW = Math.max(0, cfg.borderWidth);
			curBorderW += (targetBorderW - curBorderW) * lerpRate;

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
				spring(ws, wT, 180, 14, h);
				spring(hs, hT, 180, 14, h);
				spring(ps, pT, 320, 16, h);
				spring(cs, 1, 90, 19, h);
				spring(bs, bT, 280, 34, h);
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
					curBorderW = targetBorderW;
					b.fill(0);
					bv.fill(0);
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

				// 돌출 부위는 파동을 자연스럽게 감쇠시켜 매끈한 마그네틱 봉우리를 유지
				const wScale =
					grow === 0 && curBulge > 0 ? Math.max(0, 1 - Math.max(0, bi) / curBulge) : 1;
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
			} else if (alpha >= 0.999) {
				c.fillStyle = prev;
				c.globalAlpha = 1;
				c.fill();
				c.fillStyle = curr;
				c.globalAlpha = cv;
				c.fill();
			} else {
				// 반투명 물결 레이어는 두 번 겹쳐 그리면 알파가 누적되고 마지막 프레임에 색이 튀므로
				// 단일 패스 color-mix 보간으로 밝은 색 <-> 어두운 색 전환을 매끄럽게 유지
				c.fillStyle = `color-mix(in srgb, ${prev}, ${curr} ${(cv * 100).toFixed(2)}%)`;
				c.globalAlpha = alpha;
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
			} else if (alpha >= 0.999) {
				c.strokeStyle = prev;
				c.globalAlpha = 1;
				c.stroke();
				c.strokeStyle = curr;
				c.globalAlpha = cv;
				c.stroke();
			} else {
				c.strokeStyle = `color-mix(in srgb, ${prev}, ${curr} ${(cv * 100).toFixed(2)}%)`;
				c.globalAlpha = alpha;
				c.stroke();
			}
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

			// 1) 뒤쪽 물결 겹 (바깥 겹부터)
			const L = cfg.layerCount;
			if (wv > 0.01 && L > 0) {
				const alphas = [0.72, 0.44];
				for (let i = L - 1; i >= 0; i--) {
					const wl = curWl * Math.max(0.65, 1 - i * 0.16);
					const dir = i % 2 ? -1 : 1;
					const s = phase * dir * (1 + (i + 1) * 0.18);
					const amp = curAmp * (1 + i * 0.45) * ww;
					const grow = (i + 1) * curGap * ww;
					shape(sx, sy, grow, amp, wl, s, i + 1);
					trace();
					const layerAlpha = (alphas[i] ?? 0.4) * wv;
					if (hv <= 0.003 || (cHoverWave === cWave && prevHoverWave === prevWave)) {
						fillCrossfade(c, prevWave, cWave, cv, layerAlpha);
					} else if (hv >= 0.997) {
						fillCrossfade(c, prevHoverWave, cHoverWave, cv, layerAlpha);
					} else {
						fillCrossfade(c, prevWave, cWave, cv, layerAlpha * (1 - hv));
						fillCrossfade(c, prevHoverWave, cHoverWave, cv, layerAlpha * hv);
					}
				}
				c.globalAlpha = 1;
			}

			// 2) 본체 (가장 앞쪽 레이어 — staticFrontWave가 true면 물결 요동은 없애고 마우스 근접 돌출만 유지)
			const noFrontWave = staticFrontWave ?? cfg.staticFrontWave;
			const bodyWave = noFrontWave ? 0 : (L === 0 ? curAmp : curAmp * 0.75) * ww;
			shape(sx, sy, 0, bodyWave, curWl * 1.1, phase, 0, noFrontWave);
			trace();

			// 반투명 본체 색상일 때만 뒤쪽 물결이 내부에 비치지 않도록 클리어
			// (불투명 본체에 destination-out을 쓰면 안티앨리어싱 픽셀에 1px 검은 틈새/계단현상이 생김)
			const needsBodyCutout =
				hasTranslucentAlpha(cBase) ||
				(hv > 0.003 && hasTranslucentAlpha(cHover)) ||
				(cv < 0.997 &&
					(hasTranslucentAlpha(prevBase) || (hv > 0.003 && hasTranslucentAlpha(prevHover))));
			if (wv > 0.01 && L > 0 && needsBodyCutout) {
				c.save();
				c.globalCompositeOperation = 'destination-out';
				c.globalAlpha = 1;
				c.fillStyle = '#000000';
				c.fill();
				c.restore();
			}

			// 기본 및 호버 베이스 색상 (호버 상태에서도 설정 변경 시 부드럽게 크로스페이드)
			if (hv <= 0.003 || (cHover === cBase && prevHover === prevBase)) {
				fillCrossfade(c, prevBase, cBase, cv, 1);
			} else if (hv >= 0.997) {
				fillCrossfade(c, prevHover, cHover, cv, 1);
			} else {
				fillCrossfade(c, prevBase, cBase, cv, 1);
				fillCrossfade(c, prevHover, cHover, cv, hv);
			}

			// press 색상 오버레이
			if (pv > 0.003 && !isTransparent(cPress)) {
				c.globalAlpha = pv;
				c.fillStyle = cPress;
				c.fill();
			}

			// 3) 본체 외곽 테두리 (borderWidth > 0 일 때만 렌더링)
			if (curBorderW > 0.05) {
				c.lineWidth = curBorderW;
				c.lineJoin = 'round';
				c.lineCap = 'round';

				if (hv <= 0.003 || (cHoverBorder === cBorder && prevHoverBorder === prevBorder)) {
					strokeCrossfade(c, prevBorder, cBorder, cv, 1);
				} else if (hv >= 0.997) {
					strokeCrossfade(c, prevHoverBorder, cHoverBorder, cv, 1);
				} else {
					const hoverHidesBorder = cHoverBorder !== cBorder && isTransparent(cHoverBorder);
					const baseBorderAlpha = hoverHidesBorder ? Math.max(0, 1 - hv) : 1;
					strokeCrossfade(c, prevBorder, cBorder, cv, baseBorderAlpha);
					if (!isTransparent(cHoverBorder)) {
						strokeCrossfade(c, prevHoverBorder, cHoverBorder, cv, hv);
					}
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
			const rr = Math.min(cfg.radius, hbw, hbh);
			const ihw = hbw - rr;
			const ihh = hbh - rr;

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
			// Svelte가 DOM style 프로퍼티를 갱신한 직후 색상을 읽어 부드럽게 크로스페이드
			queueMicrotask(() => {
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
	class="lq fd-wrap {klass}"
	class:full-width={fullWidth}
	bind:this={wrap}
	data-ready={ready || undefined}
	data-hovered={hovered || undefined}
	data-pressed={pressed || undefined}
	data-disabled={disabled || undefined}
	style:--lq-i-r="{cfg.radius}px"
	style:--lq-i-inset="{inset}px"
	style:--fd-i-r="{cfg.radius}px"
	style:--fd-i-inset="{inset}px"
	style:--fd-border-w="{Math.max(0, cfg.borderWidth)}px"
	style:--fd-color={cfg.color}
	style:--fd-color-hover={cfg.hoverColor}
	style:--fd-color-press={cfg.pressColor}
	style:--fd-color-wave={cfg.waveColor}
	style:--fd-color-wave-hover={cfg.hoverWaveColor}
	style:--fd-color-border={cfg.borderColor}
	style:--fd-color-border-hover={cfg.hoverBorderColor}
	style:--fd-color-border-press={cfg.pressBorderColor}
	style:--fd-text={cfg.textColor}
	{style}
>
	<canvas bind:this={canvas} aria-hidden="true" style:left="{-SAFE}px" style:top="{-SAFE}px"
	></canvas>

	<div bind:this={box} class="fd-body {bodyClass}" style={bodyStyle} {...rest}>
		{@render children?.()}
	</div>
</div>

<style>
	.fd-wrap {
		position: relative;
		display: inline-grid;
		isolation: isolate;
		vertical-align: middle;
	}

	.fd-wrap.full-width {
		display: grid;
		width: 100%;
	}

	.fd-wrap[data-disabled] {
		opacity: 0.55;
		pointer-events: none;
	}

	canvas {
		position: absolute;
		z-index: 0;
		pointer-events: none;
	}

	.fd-body {
		--fd-i-base: var(--fd-color, rgb(255, 255, 255));
		--fd-i-hover: var(--fd-color-hover, var(--fd-i-base));
		--fd-i-press: var(--fd-color-press, #737373);
		--fd-i-wave: var(--fd-color-wave, var(--fd-i-hover));
		--fd-i-wave-hover: var(--fd-color-wave-hover, var(--fd-i-wave));
		--fd-i-border: var(--fd-color-border, var(--fd-text, #282828));
		--fd-i-border-hover: var(--fd-color-border-hover, var(--fd-i-border));
		--fd-i-border-press: var(--fd-color-border-press, var(--fd-i-border-hover));

		position: relative;
		z-index: 1;
		box-sizing: border-box;
		margin: 0;
		padding: 0.65em 1.35em;
		color: var(--fd-text, #282828);
		-webkit-tap-highlight-color: transparent;

		border: var(--fd-i-inset) solid transparent;
		border-radius: calc(var(--fd-i-r) + var(--fd-i-inset));

		/* 폴백: JS 로딩 전 / reduced-motion / 엔진 실패 시 보이는 기본 스타일 */
		background: var(--fd-i-base);
		background-clip: padding-box;
		box-shadow: inset 0 0 0 var(--fd-border-w, 0px) var(--fd-i-border);
		transition:
			background-color 0.15s,
			box-shadow 0.15s;
	}

	.fd-body:hover {
		background: var(--fd-i-hover);
		background-clip: padding-box;
		box-shadow: inset 0 0 0 var(--fd-border-w, 0px) var(--fd-i-border-hover);
	}

	/* 캔버스가 준비되면 CSS 배경/테두리는 투명화하고 캔버스가 전담 */
	.fd-wrap[data-ready] .fd-body,
	.fd-wrap[data-ready] .fd-body:hover {
		background: transparent;
		box-shadow: none;
		transition: none;
	}
</style>
