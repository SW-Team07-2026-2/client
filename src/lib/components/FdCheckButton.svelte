<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import { FdWave, organicWave, type FdWaveOptions } from '#lib/fluid';

	interface Props extends Omit<HTMLButtonAttributes, 'onchange'> {
		children?: Snippet;
		/** 비활성화. true 이면 물결/돌출 엔진을 아예 끄고 일반 비활성 버튼으로 동작 (기본 false) */
		disabled?: boolean;
		/** 활성(체크) 상태. bind:checked 로 양방향 바인딩 가능 */
		checked?: boolean;
		/** 활성 상태가 바뀔 때 호출 */
		onchange?: (checked: boolean) => void;
		/** 보이는 몸체의 모서리 반지름(px). 크게 주면 알약, 정사각형이면 원 */
		radius?: number;
		/** 포인터가 몸체에서 이 거리(px) 안에 들어오면 경계가 튀어나오기 시작 */
		reach?: number;
		/** 근접 시 튀어나오는 최대 높이(px) */
		bulge?: number;
		/** 튀어나온 부분의 폭(px). 작을수록 뾰족하고 국소적 */
		bulgeWidth?: number;
		/** hover 시 물결 디자인. FdWave 또는 일부 값만 담은 객체 */
		hoverWave?: Partial<FdWaveOptions> | FdWave;
		/** 활성(체크) 상태에서 계속 일렁이는 물결 디자인. FdWave 또는 일부 값만 담은 객체 */
		activeWave?: Partial<FdWaveOptions> | FdWave;
		/** 기본 배경색 (CSS 변수 --lq-color 로도 지정 가능) */
		color?: string;
		/** hover 시 배경색 (CSS 변수 --lq-color-hover 로도 지정 가능) */
		hoverColor?: string;
		/** 클릭(press) 시 배경색 (CSS 변수 --lq-color-press 로도 지정 가능) */
		pressColor?: string;
		/** 활성 상태 배경색 (CSS 변수 --lq-color-active 로도 지정 가능, 생략하면 hoverColor) */
		activeColor?: string;
		/** 텍스트 색상 (CSS 변수 --lq-text 로도 지정 가능) */
		textColor?: string;
		/**
		 * 실제 버튼 박스와 보이는 몸체 사이 여백(px).
		 * 모든 효과가 이 여백 안에서만 움직여서 튀어나온 부분도 클릭됨.
		 * 생략하면 bulge / hoverWave / activeWave 에서 자동 계산
		 */
		inset?: number;
	}

	let {
		children,
		disabled = false,
		checked = $bindable(false),
		onchange,
		onclick,
		radius = 999,
		reach = 40,
		bulge = 8,
		bulgeWidth = 22,
		hoverWave: hoverWaveProp,
		activeWave: activeWaveProp,
		color,
		hoverColor,
		pressColor,
		activeColor,
		textColor,
		inset: insetProp,
		class: klass = '',
		...rest
	}: Props = $props();

	const SAFE = 3; // 캔버스를 박스보다 살짝 크게 (안티앨리어싱 여유)

	/** hover 물결: 기본 FdWave 값 */
	const hw0 = $derived(FdWave.from(hoverWaveProp));
	/** 활성 물결: 지정하지 않으면 hover 보다 조금 더 크고 빠르게 일렁임 */
	const aw0 = $derived(
		activeWaveProp
			? FdWave.from(activeWaveProp)
			: new FdWave({ layerGap: 4, waveAmp: 4.5, spin: 1.8 })
	);

	const autoInset = $derived.by(() => {
		const bulgeExt = bulge * 1.15 + 2;
		return Math.ceil(Math.max(bulgeExt, hw0.extent, aw0.extent)) + 1;
	});
	const inset = $derived(insetProp ?? autoInset);

	let wrap: HTMLSpanElement;
	let btn: HTMLButtonElement;
	let canvas: HTMLCanvasElement;
	/** 캔버스가 첫 프레임을 그린 뒤 true → CSS 폴백 배경을 투명하게 */
	let ready = $state(false);
	/** 실제 그려진(돌출 포함) 영역 안에 포인터가 들어왔는지 여부 */
	let hovered = $state(false);
	let relayout: (() => void) | undefined;
	let wakeFn: (() => void) | undefined;

	/**
	 * 엔진은 disabled 가 false 인 동안에만 켜진다.
	 * disabled 로 바뀌면 cleanup 이 실행되어 rAF 루프·포인터/키 리스너·resize 감시를 모두 해제하고
	 * 캔버스를 비운 뒤 CSS 폴백(일반 비활성 버튼)으로 돌아간다. 다시 false 가 되면 새로 시작.
	 */
	$effect(() => {
		if (disabled) return;
		return untrack(() => startEngine());
	});

	$effect(() => {
		void inset;
		void radius;
		void color;
		void hoverColor;
		void pressColor;
		void activeColor;
		void hw0.color;
		void aw0.color;
		relayout?.();
	});

	// 활성 상태가 바뀌면 애니메이션 루프 깨우기
	$effect(() => {
		void checked;
		wakeFn?.();
	});

	function handleClick(e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
		if (disabled) return;
		checked = !checked;
		onchange?.(checked);
		onclick?.(e);
	}

	function startEngine(): (() => void) | void {
		// reduced-motion 이거나 2D 컨텍스트가 없으면 CSS 폴백 버튼으로 유지
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const TAU = Math.PI * 2;

		/* ───────── 상태 ───────── */
		let W = 0; // 실제 버튼 박스
		let H = 0;
		let bw = 0; // 보이는 몸체
		let bh = 0;
		let cw = 0; // 캔버스 크기(css px)
		let ch = 0;
		let dpr = 1;
		let n = 0;
		// 휴식 위치(몸체 중심 기준), 바깥 법선, 돌출 방향, 돌출 변위/속도/목표, 임시 좌표
		let rx = new Float32Array(0);
		let ry = new Float32Array(0);
		let nx = new Float32Array(0);
		let ny = new Float32Array(0);
		let dx = new Float32Array(0);
		let dy = new Float32Array(0);
		let b = new Float32Array(0);
		let bv = new Float32Array(0);
		let tg = new Float32Array(0);
		let xs = new Float32Array(0);
		let ys = new Float32Array(0);

		const hs = { x: 0, v: 0 }; // hover 스프링
		const ps = { x: 0, v: 0 }; // press 스프링
		const act = { x: checked ? 1 : 0, v: 0 }; // active(체크) 스프링
		let inside = false;
		let focused = false;
		let pressed = false;
		let lx = 0; // 포인터 위치 (버튼 중심 기준)
		let ly = 0;
		let cx = 0; // 몸체 경계 위에서 포인터와 가장 가까운 점
		let cy = 0;
		let unx = 0; // 해당 점의 바깥 단위 법선
		let uny = -1;
		let ampT = 0; // 목표 돌출 높이(px)
		let wasNear = false;
		let t = 0;
		let raf = 0;
		let last = 0;

		let cBase = '#6366f1';
		let cHover = '#818cf8';
		let cPress = '#4f46e5';
		let cActive = '#818cf8';
		let cWaveH = '#818cf8';
		let cWaveA = '#818cf8';

		let isTouchTap = false;
		let touchResetTimer: ReturnType<typeof setTimeout> | undefined;

		/** CSS 변수는 btn(및 부모 wrap)에서 읽어옴 */
		function readColors() {
			const s = getComputedStyle(btn);
			const get = (k: string, d: string) => s.getPropertyValue(k).trim() || d;
			cBase = get('--lq-i-base', cBase);
			cHover = get('--lq-i-hover', cBase);
			cPress = get('--lq-i-press', cPress);
			cActive = get('--lq-i-active', cHover);
			cWaveH = get('--lq-i-wave', cHover);
			cWaveA = get('--lq-i-wave-active', cActive);
		}

		/* ───────── 도형 ───────── */
		/** 보이는 몸체(둥근 사각형) 둘레를 길이 기준으로 균등 샘플링 (점 + 바깥 법선) */
		function build() {
			const r = Math.min(radius, bw / 2, bh / 2);
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

		function layout() {
			W = btn.offsetWidth;
			H = btn.offsetHeight;
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

			const r = Math.min(radius, bw / 2, bh / 2);
			const approx = 2 * (bw - 2 * r) + 2 * (bh - 2 * r) + 2 * Math.PI * r;
			n = Math.min(180, Math.max(48, Math.round(approx / 6)));
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
			build();
			readColors();
			draw();
			ready = true;
			if (checked || inside || focused || pressed || ampT > 0 || act.x > 0.001 || hs.x > 0.001) {
				wake();
			}
		}

		/* ───────── 물리 ───────── */
		function spring(s: { x: number; v: number }, target: number, k: number, c: number, dt: number) {
			s.v += ((target - s.x) * k - s.v * c) * dt;
			s.x += s.v * dt;
		}

		/** 한 프레임 갱신. 아직 움직이는 중이면 true (활성 상태에선 물결이 계속 일렁이므로 항상 true) */
		function update(dt: number): boolean {
			const steps = Math.max(1, Math.ceil(dt * 120));
			const h = dt / steps;
			const hT = inside || focused ? 1 : 0;
			const pT = pressed ? 1 : 0;
			const aT = checked ? 1 : 0;

			// 근접 돌출: 몸체 경계의 최근접점(cx, cy)을 중심으로 포인터 방향으로 솟음
			if (ampT > 0.01) {
				const sig = Math.max(6, bulgeWidth);
				const focusDist = Math.max(ampT, bulge, 12);
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
				spring(hs, hT, 180, 14, h);
				spring(ps, pT, 320, 16, h);
				spring(act, aT, 150, 13, h);
				for (let i = 0; i < n; i++) {
					bv[i] += ((tg[i] - b[i]) * 340 - bv[i] * 28) * h;
					b[i] += bv[i] * h;
				}
			}
			if (hs.x > 0.001 || act.x > 0.001) t += dt;

			let moving =
				hT === 1 ||
				aT === 1 ||
				ampT > 0 ||
				Math.abs(hs.x - hT) > 0.002 ||
				Math.abs(hs.v) > 0.01 ||
				Math.abs(ps.x - pT) > 0.002 ||
				Math.abs(ps.v) > 0.01 ||
				Math.abs(act.x - aT) > 0.002 ||
				Math.abs(act.v) > 0.01;
			if (!moving) {
				for (let i = 0; i < n; i++) {
					if (Math.abs(b[i]) > 0.02 || Math.abs(bv[i]) > 0.05) {
						moving = true;
						break;
					}
				}
				if (!moving) {
					hs.x = hT;
					hs.v = 0;
					ps.x = pT;
					ps.v = 0;
					act.x = aT;
					act.v = 0;
					b.fill(0);
					bv.fill(0);
				}
			}
			return moving;
		}

		/* ───────── 그리기 ───────── */
		function trace() {
			ctx!.beginPath();
			ctx!.moveTo((xs[n - 1] + xs[0]) / 2, (ys[n - 1] + ys[0]) / 2);
			for (let i = 0; i < n; i++) {
				const j = (i + 1) % n;
				ctx!.quadraticCurveTo(xs[i], ys[i], (xs[i] + xs[j]) / 2, (ys[i] + ys[j]) / 2);
			}
			ctx!.closePath();
		}

		/** 유기적 유체 파동 (공통 구현은 FdWave.ts 의 organicWave) */
		function wave1(i: number, k: number, s: number, seed: number): number {
			return organicWave(rx[i], ry[i], TAU * (i / n), k, s, seed);
		}

		/**
		 * 윤곽 좌표 계산: 휴식 위치 * 스케일 + 법선 방향(확장 + 유기적 물결) + 포인터 방향(돌출).
		 * 돌출은 상한을 둬서 항상 실제 버튼 박스 안에 머묾
		 */
		function shape(
			sx: number,
			sy: number,
			grow: number,
			wave: number,
			wl: number,
			s: number,
			seed: number
		) {
			const cap = bulge * 1.15;
			const k = TAU / Math.max(20, wl);
			for (let i = 0; i < n; i++) {
				const bi = b[i] > cap ? cap : b[i];
				// 본체(grow === 0)는 돌출 끝점에서 물결을 줄여 마우스와 만나는 경계를 정확히 맞춤
				const wScale = grow === 0 && bulge > 0 ? Math.max(0, 1 - Math.max(0, bi) / bulge) : 1;
				let off = grow;
				if (wave) off += wave * wScale * wave1(i, k, s, seed);
				xs[i] = rx[i] * sx + nx[i] * off + dx[i] * bi;
				ys[i] = ry[i] * sy + ny[i] * off + dy[i] * bi;
			}
		}

		/**
		 * 뒤쪽 물결 겹 그리기 (바깥 겹부터, 최대 2겹)
		 * 뒤쪽(i가 클수록)으로 갈수록 파장은 짧아지고 진폭은 커져서 곡률이 점차 커짐
		 * @param weight 전체 불투명도 가중치 (0~1)
		 * @param scale  진폭/간격 배율 (스프링 오버슈트 포함)
		 */
		function drawLayers(
			c: CanvasRenderingContext2D,
			w: FdWave,
			fill: string,
			weight: number,
			scale: number,
			sx: number,
			sy: number,
			seedBase: number
		) {
			const L = w.layerCount;
			if (weight <= 0.01 || scale <= 0 || L <= 0) return;
			const alphas = [0.72, 0.44];
			c.fillStyle = fill;
			for (let i = L - 1; i >= 0; i--) {
				const wl = w.waveLength * Math.max(0.65, 1 - i * 0.16);
				const dir = i % 2 ? -1 : 1;
				const s = t * w.spin * dir * (1 + (i + 1) * 0.18);
				const amp = w.waveAmp * (1 + i * 0.45) * scale;
				const grow = (i + 1) * w.layerGap * scale;
				shape(sx, sy, grow, amp, wl, s, seedBase + i);
				trace();
				c.globalAlpha = (alphas[i] ?? 0.4) * weight;
				c.fill();
			}
			c.globalAlpha = 1;
		}

		function draw() {
			if (!n) return;
			const c = ctx!;
			c.setTransform(1, 0, 0, 1, 0, 0);
			c.clearRect(0, 0, canvas.width, canvas.height);
			c.setTransform(dpr, 0, 0, dpr, (cw / 2) * dpr, (ch / 2) * dpr);

			const hv = Math.min(1, Math.max(0, hs.x));
			const pv = Math.min(1, Math.max(0, ps.x));
			const av = Math.min(1, Math.max(0, act.x));
			// 물결 오버슈트 상한 (inset 안에 머물게)
			const hwScale = Math.min(hs.x, 1.1) * (1 - av); // hover 물결은 활성화될수록 활성 물결로 넘어감
			const awScale = Math.min(act.x, 1.1);

			// 눌림(press)만 크기에 반영
			const gx = 1.5 * ps.x;
			const gy = -2.5 * ps.x;
			const sx = (bw / 2 + gx) / (bw / 2);
			const sy = (bh / 2 + gy) / (bh / 2);

			// 1) 뒤쪽 물결: hover 물결 → 활성 물결 순으로 크로스페이드
			drawLayers(c, hw0, cWaveH, hv * (1 - av), hwScale, sx, sy, 1);
			drawLayers(c, aw0, cWaveA, av, awScale, sx, sy, 4);

			// 2) 본체(가장 앞쪽 레이어): 두 물결 디자인을 활성 정도에 따라 보간
			const mix = (a: number, bb: number) => a + (bb - a) * av;
			const bodyAmp = (hw0.waveAmp * hwScale + aw0.waveAmp * awScale) * 0.65;
			const bodyWl = mix(hw0.waveLength, aw0.waveLength) * 1.15;
			const bodySpin = mix(hw0.spin, aw0.spin);
			shape(sx, sy, 0, bodyAmp, bodyWl, t * bodySpin, 0);
			trace();
			c.fillStyle = cBase;
			c.fill();
			if (hv > 0.003) {
				c.globalAlpha = hv;
				c.fillStyle = cHover;
				c.fill();
			}
			if (av > 0.003) {
				c.globalAlpha = av;
				c.fillStyle = cActive;
				c.fill();
			}
			if (pv > 0.003) {
				c.globalAlpha = pv;
				c.fillStyle = cPress;
				c.fill();
			}
			c.globalAlpha = 1;
		}

		/* ───────── 루프: 움직일 때만 돈다 (활성 상태에선 계속) ───────── */
		function tick(now: number) {
			raf = 0;
			const dt = Math.min((now - last) / 1000, 1 / 30) || 1 / 60;
			last = now;
			const moving = update(dt);
			draw();
			if (moving) raf = requestAnimationFrame(tick);
		}

		function wake() {
			if (raf || !n) return;
			readColors();
			last = performance.now();
			raf = requestAnimationFrame(tick);
		}

		/* ───────── 입력 ───────── */
		const onDown = (e: PointerEvent) => {
			if (e.pointerType === 'touch') {
				clearTimeout(touchResetTimer);
				isTouchTap = true;
				inside = true;
				hovered = true;
			} else if (!inside) {
				return;
			}
			pressed = true;
			wake();
		};
		const onUp = (e: PointerEvent) => {
			if (!pressed && e.pointerType !== 'touch') return;
			pressed = false;
			if (e.pointerType === 'touch') {
				hovered = false;
				// 터치 후 뒤따르는 click 이벤트를 허용하기 위해 inside=false 처리를 약간 지연
				clearTimeout(touchResetTimer);
				touchResetTimer = setTimeout(() => {
					isTouchTap = false;
					inside = false;
				}, 400);
			}
			wake();
		};
		const onCancel = () => {
			clearTimeout(touchResetTimer);
			isTouchTap = false;
			inside = false;
			hovered = false;
			pressed = false;
			wake();
		};
		const onClickGuard = (e: MouseEvent) => {
			if (isTouchTap) {
				clearTimeout(touchResetTimer);
				isTouchTap = false;
				inside = false;
				return;
			}
			// 투명 inset 여백 중 아직 돌출부와 겹치지 않은 바깥 영역 클릭은 무시 (토글도 막힘)
			if (e.detail > 0 && !inside) {
				e.preventDefault();
				e.stopPropagation();
			}
		};
		const onFocus = () => {
			if (btn.matches(':focus-visible')) {
				focused = true;
				wake();
			}
		};
		const onBlur = () => {
			focused = false;
			wake();
		};
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Enter' || e.key === ' ') {
				pressed = true;
				wake();
			}
		};
		const onKeyUp = (e: KeyboardEvent) => {
			if (e.key === 'Enter' || e.key === ' ') {
				pressed = false;
				wake();
			}
		};

		/** 근접 감지 및 마우스-돌출 경계 일치 판정 */
		const onMove = (e: PointerEvent) => {
			if (e.pointerType === 'touch') return;
			const r = btn.getBoundingClientRect();
			if (!r.width || !r.height) return;
			lx = (e.clientX - (r.left + r.width / 2)) * (W / r.width);
			ly = (e.clientY - (r.top + r.height / 2)) * (H / r.height);

			const hbw = bw / 2;
			const hbh = bh / 2;
			const rr = Math.min(radius, hbw, hbh);
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

			const maxB = Math.max(0, bulge);
			// 돌출 끝점(d = maxB)과 마우스가 만나는 지점부터가 실제 겹침(hover) 경계
			const nextInside = d <= maxB;
			if (nextInside !== inside) {
				inside = nextInside;
				hovered = nextInside;
				if (!nextInside) pressed = false;
			}

			if (d <= 0 || d >= reach || maxB <= 0) {
				ampT = 0;
			} else if (d <= maxB) {
				// 0 < d <= maxB 구간에서는 돌출 높이가 포인터 거리(d)와 정확히 일치하여 경계가 어긋나지 않음
				ampT = d;
			} else {
				const span = Math.max(1, reach - maxB);
				ampT = maxB * ((reach - d) / span);
			}

			const active = ampT > 0 || nextInside;
			if (active || wasNear) wake();
			wasNear = active;
		};
		const onDocLeave = () => {
			if (!wasNear && !inside) return;
			ampT = 0;
			inside = false;
			hovered = false;
			pressed = false;
			wasNear = false;
			wake();
		};

		btn.addEventListener('pointerdown', onDown);
		btn.addEventListener('pointercancel', onCancel);
		btn.addEventListener('click', onClickGuard);
		btn.addEventListener('focus', onFocus);
		btn.addEventListener('blur', onBlur);
		btn.addEventListener('keydown', onKeyDown);
		btn.addEventListener('keyup', onKeyUp);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointermove', onMove, { passive: true });
		document.documentElement.addEventListener('pointerleave', onDocLeave);

		readColors();
		relayout = layout;
		wakeFn = wake;
		layout();
		const ro = new ResizeObserver(layout);
		ro.observe(btn);

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

		// 처음부터 checked=true 로 마운트된 경우에도 물결 시작
		if (checked) wake();

		return () => {
			clearTimeout(touchResetTimer);
			cancelAnimationFrame(raf);
			ro.disconnect();
			removeDprListener?.();
			window.removeEventListener('resize', layout);
			relayout = undefined;
			wakeFn = undefined;
			btn.removeEventListener('pointerdown', onDown);
			btn.removeEventListener('pointercancel', onCancel);
			btn.removeEventListener('click', onClickGuard);
			btn.removeEventListener('focus', onFocus);
			btn.removeEventListener('blur', onBlur);
			btn.removeEventListener('keydown', onKeyDown);
			btn.removeEventListener('keyup', onKeyUp);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointermove', onMove);
			document.documentElement.removeEventListener('pointerleave', onDocLeave);
			// 캔버스를 비우고 CSS 폴백 상태로 복귀 (disabled 전환 / 언마운트)
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ready = false;
			hovered = false;
		};
	}
</script>

<span
	class="lq"
	bind:this={wrap}
	data-ready={ready || undefined}
	data-hovered={hovered || undefined}
	data-checked={checked || undefined}
	style:--lq-i-r="{radius}px"
	style:--lq-i-inset="{inset}px"
	style:--lq-color={color}
	style:--lq-color-hover={hoverColor}
	style:--lq-color-press={pressColor}
	style:--lq-color-active={activeColor}
	style:--lq-color-wave={hw0.color}
	style:--lq-color-wave-active={aw0.color}
	style:--lq-text={textColor}
>
	<canvas bind:this={canvas} aria-hidden="true" style:left="{-SAFE}px" style:top="{-SAFE}px"
	></canvas>
	<button
		bind:this={btn}
		type="button"
		class={klass}
		{disabled}
		aria-pressed={checked}
		onclick={handleClick}
		{...rest}
	>
		{@render children?.()}
	</button>
</span>

<style>
	/*
	 * 겉모습은 CSS 변수 또는 prop으로 지정 가능 (모두 선택사항):
	 *   --lq-color / --lq-color-hover / --lq-color-press / --lq-color-active
	 *   --lq-color-wave / --lq-color-wave-active / --lq-text
	 *
	 * 구조: 실제 버튼 박스 = 보이는 몸체 + 사방 inset 여백.
	 * 여백은 투명 border 로 만들어서, 튀어나온 부분 위에서도 클릭/hover 가 동작함
	 */
	.lq {
		position: relative;
		display: inline-grid;
		isolation: isolate;
	}

	.lq:has(button:disabled) {
		opacity: 0.5;
	}

	canvas {
		position: absolute;
		z-index: 0;
		pointer-events: none;
	}

	button {
		--lq-i-base: var(--lq-color, rgb(255, 255, 255));
		--lq-i-hover: var(--lq-color-hover, var(--lq-i-base));
		--lq-i-press: var(--lq-color-press, #737373);
		--lq-i-active: var(--lq-color-active, var(--lq-i-hover));
		--lq-i-wave: var(--lq-color-wave, var(--lq-i-hover));
		--lq-i-wave-active: var(--lq-color-wave-active, var(--lq-i-active));

		position: relative;
		z-index: 1;
		appearance: none;
		margin: 0;
		padding: 0.7em 1.4em;
		font: inherit;
		color: var(--lq-text, #282828);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;

		border: var(--lq-i-inset) solid transparent;
		border-radius: calc(var(--lq-i-r) + var(--lq-i-inset));

		/* 폴백: JS 로딩 전 / reduced-motion / 엔진 실패 시 보이는 일반 버튼 (몸체 영역만 칠함) */
		background: var(--lq-i-base);
		background-clip: padding-box;
		transition: background-color 0.15s;
	}
	button:hover {
		background: var(--lq-i-hover);
		background-clip: padding-box;
	}
	.lq[data-checked] button {
		background: var(--lq-i-active);
		background-clip: padding-box;
	}
	button:active {
		background: var(--lq-i-press);
		background-clip: padding-box;
	}
	button:disabled {
		cursor: not-allowed;
	}
	button:focus-visible {
		outline: 2px solid var(--lq-i-hover);
		outline-offset: calc(3px - var(--lq-i-inset));
	}

	/* 캔버스가 그릴 준비가 되면 버튼 배경은 투명 (글자와 클릭만 담당), 커서도 실제 겹침 경계에만 표시 */
	.lq[data-ready] button,
	.lq[data-ready] button:hover,
	.lq[data-ready] button:active {
		background: transparent;
		transition: none;
		cursor: default;
	}
	.lq[data-ready][data-hovered] button:not(:disabled) {
		cursor: pointer;
	}
</style>
