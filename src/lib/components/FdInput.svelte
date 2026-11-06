<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { FdWave, organicWave, type FdWaveOptions } from '#lib/fluid';

	interface Props extends Omit<HTMLInputAttributes, 'size' | 'prefix' | 'value'> {
		/** 입력 값 (양방향 바인딩 지원 bind:value) */
		value?: string | number;
		/** 입력 타입 ('text', 'password', 'email', 'number', 'search', 'tel', 'url' 등) */
		type?: string;
		/** 플레이스홀더 텍스트 */
		placeholder?: string;
		/** 비활성화 여부 */
		disabled?: boolean;
		/** 읽기 전용 여부 */
		readonly?: boolean;
		/** 필수 입력 여부 */
		required?: boolean;
		/** 자동 포커스 */
		autofocus?: boolean;

		/* ── 아이콘 및 슬롯 ── */
		/** 입력창 앞쪽 아이콘/요소 스니펫 */
		prefix?: Snippet;
		/** 입력창 뒤쪽 아이콘/요소 스니펫 */
		suffix?: Snippet;
		/** 입력창 앞쪽 고정 텍스트 (예: "$", "https://") */
		prefixText?: string;
		/** 입력창 뒤쪽 고정 텍스트 (예: "원", "kg", ".com") */
		suffixText?: string;

		/* ── 편의 기능 ── */
		/** 내용이 있을 때 우측에 원클릭 지우기(X) 버튼 표시 여부 */
		clearable?: boolean;
		/** type="password" 일 때 비밀번호 표시/숨김 토글 버튼 표시 여부 */
		showPasswordToggle?: boolean;
		/** 가로 폭 100% 채움 여부 */
		fullWidth?: boolean;
		/** 크기 프리셋 ('sm' | 'md' | 'lg') 또는 최소 높이(px) */
		size?: 'sm' | 'md' | 'lg' | number;
		/** Enter 키 입력 시 콜백 */
		onenter?: (val: string | number) => void;
		/** 지우기 버튼 클릭 시 콜백 */
		onclear?: () => void;
		/** 내부 input 엘리먼트 ref 바인딩용 (bind:inputRef) */
		inputRef?: HTMLInputElement;
		/** 내부 input 태그에 직접 지정할 추가 클래스 */
		inputClass?: string;

		/* ── FdButton 호환 유체 물리 및 디자인 props ── */
		/** 보이는 몸체의 모서리 반지름(px). 기본 999 (알약형) */
		radius?: number;
		/** 포인터가 몸체에서 이 거리(px) 안에 들어오면 경계가 튀어나오기 시작 (기본 40) */
		reach?: number;
		/** 근접 시 튀어나오는 최대 높이(px) (기본 8) */
		bulge?: number;
		/** 튀어나온 부분의 폭(px) (기본 22) */
		bulgeWidth?: number;
		/** hover 물결 디자인 (FdWave 또는 일부 값만 담은 객체) */
		wave?: Partial<FdWaveOptions> | FdWave;
		/** focus 물결 디자인 (생략 시 기본적으로 hover 물결과 동일하게 동작) */
		focusWave?: Partial<FdWaveOptions> | FdWave;
		/** 물결 겹 개수 (하위 호환용) */
		layers?: number;
		/** hover 물결 레이어 색상 */
		waveColor?: string;
		/** focus 물결 레이어 색상 (생략 시 focusColor 또는 waveColor 따름) */
		focusWaveColor?: string;
		/** 기본 배경색 (CSS 변수 --lq-color 로도 지정 가능) */
		color?: string;
		/** hover 시 배경색 (CSS 변수 --lq-color-hover 로도 지정 가능) */
		hoverColor?: string;
		/** focus 시 배경색 (CSS 변수 --lq-color-focus 로도 지정 가능, 생략 시 hoverColor 와 동일) */
		focusColor?: string;
		/** 클릭/누름 시 배경색 (CSS 변수 --lq-color-press 로도 지정 가능) */
		pressColor?: string;
		/** 텍스트 색상 (CSS 변수 --lq-text 로도 지정 가능) */
		textColor?: string;
		/** 플레이스홀더 텍스트 색상 (CSS 변수 --lq-placeholder 로도 지정 가능) */
		placeholderColor?: string;
		/**
		 * 실제 박스와 보이는 몸체 사이 여백(px).
		 * 모든 유체 돌출과 물결 효과가 이 여백 안에서 렌더링됩니다.
		 * 생략 시 물결과 돌출 크기에 맞춰 자동 계산됩니다.
		 */
		inset?: number;
		/** 래퍼 클래스 */
		class?: string;
		/** 인라인 스타일 */
		style?: string;
	}

	let {
		value = $bindable(''),
		type = 'text',
		placeholder = '',
		disabled = false,
		readonly = false,
		required = false,
		autofocus = false,
		prefix,
		suffix,
		prefixText,
		suffixText,
		clearable = false,
		showPasswordToggle = false,
		fullWidth = false,
		size = 'md',
		onenter,
		onclear,
		inputRef = $bindable(undefined),
		inputClass = '',
		radius = 999,
		reach = 40,
		bulge = 8,
		bulgeWidth = 22,
		wave: waveProp,
		focusWave: focusWaveProp,
		layers,
		waveColor,
		focusWaveColor,
		color,
		hoverColor,
		focusColor,
		pressColor,
		textColor,
		placeholderColor,
		inset: insetProp,
		class: klass = '',
		style = '',
		oninput,
		onchange,
		onfocus,
		onblur,
		onkeydown,
		...rest
	}: Props = $props();

	const SAFE = 3; // 캔버스를 박스보다 살짝 크게 (안티앨리어싱 여유)

	/** hover 물결 디자인 (인터페이스 클래스, 하위 호환 layers / waveColor 병합) */
	const wvHover = $derived.by(() => {
		const base = FdWave.from(waveProp);
		if (layers !== undefined || waveColor !== undefined) {
			return base.with({
				...(layers !== undefined ? { layers } : {}),
				...(waveColor !== undefined ? { color: waveColor } : {})
			});
		}
		return base;
	});

	/** focus 물결 디자인 (생략 시 기본적으로 hover 물결을 따름) */
	const wvFocus = $derived.by(() => {
		if (focusWaveProp) {
			const base = FdWave.from(focusWaveProp);
			if (focusWaveColor !== undefined) {
				return base.with({ color: focusWaveColor });
			}
			return base;
		}
		if (focusWaveColor !== undefined) {
			return wvHover.with({ color: focusWaveColor });
		}
		return wvHover;
	});

	const autoInset = $derived.by(() => {
		const bulgeExt = bulge * 1.15 + 2;
		const maxWave = Math.max(wvHover.extent, wvFocus.extent);
		return Math.ceil(Math.max(bulgeExt, maxWave)) + 1;
	});
	const inset = $derived(insetProp ?? autoInset);

	let wrap: HTMLDivElement;
	let box: HTMLDivElement;
	let inputEl: HTMLInputElement;
	let canvas: HTMLCanvasElement;

	// 외부 바인딩 동기화
	$effect(() => {
		inputRef = inputEl;
	});

	/** 캔버스가 첫 프레임을 그린 뒤 true → CSS 폴백 배경을 투명하게 */
	let ready = $state(false);
	/** 마우스가 돌출 영역 안에 진입했는지 여부 */
	let hovered = $state(false);
	/** 입력창이 포커스 상태인지 여부 */
	let focused = $state(false);
	/** 비밀번호 표시 여부 */
	let isPasswordVisible = $state(false);

	let relayout: (() => void) | undefined;
	let wakeFn: (() => void) | undefined;

	const effectiveType = $derived.by(() => {
		if (type === 'password' && showPasswordToggle) {
			return isPasswordVisible ? 'text' : 'password';
		}
		return type;
	});

	/**
	 * 엔진은 disabled 가 false 인 동안에만 켜진다.
	 * disabled 로 바뀌면 cleanup 이 실행되어 rAF 루프·포인터/키 리스너·resize 감시를 모두 해제하고
	 * 캔버스를 비운 뒤 CSS 폴백으로 돌아간다. 다시 false 가 되면 새로 시작.
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
		void focusColor;
		void pressColor;
		void wvHover.color;
		void wvFocus.color;
		relayout?.();
	});

	$effect(() => {
		void focused;
		wakeFn?.();
	});

	function handleBoxClick(e: MouseEvent) {
		const target = e.target as HTMLElement | null;
		if (target?.closest('button')) return;
		if (document.activeElement !== inputEl) {
			inputEl?.focus();
		}
	}

	function handleInput(e: Event & { currentTarget: HTMLInputElement }) {
		value = e.currentTarget.value;
		oninput?.(e);
	}

	function handleChange(e: Event & { currentTarget: HTMLInputElement }) {
		value = e.currentTarget.value;
		onchange?.(e);
	}

	function handleKeyDown(e: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		if (e.key === 'Enter') {
			onenter?.(value);
		}
		onkeydown?.(e);
	}

	function handleFocus(e: FocusEvent & { currentTarget: HTMLInputElement }) {
		focused = true;
		onfocus?.(e);
	}

	function handleBlur(e: FocusEvent & { currentTarget: HTMLInputElement }) {
		focused = false;
		onblur?.(e);
	}

	function handleClear(e: MouseEvent) {
		e.stopPropagation();
		value = '';
		onclear?.();
		inputEl?.focus();
	}

	function togglePasswordVisibility(e: MouseEvent) {
		e.stopPropagation();
		isPasswordVisible = !isPasswordVisible;
		inputEl?.focus();
	}

	/* ── 외부에 공개하는 편의 메서드 ── */
	export function focus() {
		inputEl?.focus();
	}
	export function blur() {
		inputEl?.blur();
	}
	export function select() {
		inputEl?.select();
	}
	export function clear() {
		value = '';
		onclear?.();
		inputEl?.focus();
	}

	function startEngine(): (() => void) | void {
		// reduced-motion 이거나 2D 컨텍스트가 없으면 CSS 폴백으로 유지
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const TAU = Math.PI * 2;

		/* ───────── 상태 ───────── */
		let W = 0; // 실제 입력 박스
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
		const fs = { x: focused ? 1 : 0, v: 0 }; // focus 스프링
		const ps = { x: 0, v: 0 }; // press 스프링

		let inside = false;
		let pressed = false;
		let lx = 0; // 포인터 위치 (박스 중심 기준)
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

		let cBase = '#ffffff';
		let cHover = '#ffffff';
		let cFocus = '#ffffff';
		let cPress = '#f3f4f6';
		let cWaveH = '#ffffff';
		let cWaveF = '#ffffff';

		let isTouchTap = false;
		let touchResetTimer: ReturnType<typeof setTimeout> | undefined;

		/** CSS 변수는 box(및 부모 wrap)에서 읽어옴 */
		function readColors() {
			const s = getComputedStyle(box);
			const get = (k: string, d: string) => s.getPropertyValue(k).trim() || d;
			cBase = get('--lq-i-base', cBase);
			cHover = get('--lq-i-hover', cBase);
			cFocus = get('--lq-i-focus', cHover);
			cPress = get('--lq-i-press', cPress);
			cWaveH = get('--lq-i-wave', cHover);
			cWaveF = get('--lq-i-wave-focus', cFocus);
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
			if (focused || inside || pressed || ampT > 0 || fs.x > 0.001 || hs.x > 0.001) {
				wake();
			}
		}

		/* ───────── 물리 ───────── */
		function spring(s: { x: number; v: number }, target: number, k: number, c: number, dt: number) {
			s.v += ((target - s.x) * k - s.v * c) * dt;
			s.x += s.v * dt;
		}

		/** 한 프레임 갱신. 포커스 상태에서는 물결이 살아있도록 moving=true 유지 */
		function update(dt: number): boolean {
			const steps = Math.max(1, Math.ceil(dt * 120));
			const h = dt / steps;
			const hT = inside ? 1 : 0;
			const fT = focused ? 1 : 0;
			const pT = pressed ? 1 : 0;

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
				spring(fs, fT, 150, 13, h);
				spring(ps, pT, 320, 16, h);
				for (let i = 0; i < n; i++) {
					bv[i] += ((tg[i] - b[i]) * 340 - bv[i] * 28) * h;
					b[i] += bv[i] * h;
				}
			}

			if (hs.x > 0.001 || fs.x > 0.001) t += dt;

			let moving =
				hT === 1 ||
				fT === 1 ||
				ampT > 0 ||
				Math.abs(hs.x - hT) > 0.002 ||
				Math.abs(hs.v) > 0.01 ||
				Math.abs(fs.x - fT) > 0.002 ||
				Math.abs(fs.v) > 0.01 ||
				Math.abs(ps.x - pT) > 0.002 ||
				Math.abs(ps.v) > 0.01;

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
					fs.x = fT;
					fs.v = 0;
					ps.x = pT;
					ps.v = 0;
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

		/** 유기적 유체 파동 (공통 구현은 FdWave.ts 의 organicWave) */
		function wave1(i: number, k: number, s: number, seed: number): number {
			return organicWave(rx[i], ry[i], TAU * (i / n), k, s, seed);
		}

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
				const wScale = grow === 0 && bulge > 0 ? Math.max(0, 1 - Math.max(0, bi) / bulge) : 1;
				let off = grow;
				if (wave) off += wave * wScale * wave1(i, k, s, seed);
				xs[i] = rx[i] * sx + nx[i] * off + dx[i] * bi;
				ys[i] = ry[i] * sy + ny[i] * off + dy[i] * bi;
			}
		}

		function draw() {
			if (!n) return;
			const c = ctx!;
			c.setTransform(1, 0, 0, 1, 0, 0);
			c.clearRect(0, 0, canvas.width, canvas.height);
			c.setTransform(dpr, 0, 0, dpr, (cw / 2) * dpr, (ch / 2) * dpr);

			const hv = Math.min(1, Math.max(0, hs.x));
			const fv = Math.min(1, Math.max(0, fs.x));
			const pv = Math.min(1, Math.max(0, ps.x));

			// hover 또는 focus 활성도
			const actV = Math.min(1, Math.max(hv, fv));
			const hw = Math.min(actV, 1.1);

			// press 시 살짝 텐션
			const gx = 1.2 * ps.x;
			const gy = -2.0 * ps.x;
			const sx = (bw / 2 + gx) / (bw / 2);
			const sy = (bh / 2 + gy) / (bh / 2);

			// focus 와 hover 상태에 따른 물결 디자인 선택
			const curWv = fv > 0.5 ? wvFocus : wvHover;
			const curWaveColor = fv > 0.5 ? cWaveF : cWaveH;
			const wl = curWv.waveLength;
			const spin = curWv.spin;
			const amp = curWv.waveAmp * hw;

			// 1) 뒤쪽 물결 겹 (바깥 겹부터)
			const L = curWv.layerCount;
			if (actV > 0.01 && L > 0) {
				const alphas = [0.72, 0.44];
				c.fillStyle = curWaveColor;
				for (let i = L - 1; i >= 0; i--) {
					const curWl = wl * Math.max(0.65, 1 - i * 0.16);
					const dir = i % 2 ? -1 : 1;
					const s = t * spin * dir * (1 + (i + 1) * 0.18);
					const curAmp = amp * (1 + i * 0.45);
					const grow = (i + 1) * curWv.layerGap * hw;
					shape(sx, sy, grow, curAmp, curWl, s, i + 1);
					trace();
					c.globalAlpha = (alphas[i] ?? 0.4) * actV;
					c.fill();
				}
				c.globalAlpha = 1;
			}

			// 2) 본체(가장 앞쪽 레이어)
			const bodyWave = amp * 0.65;
			shape(sx, sy, 0, bodyWave, wl * 1.15, t * spin, 0);
			trace();

			// 기본 베이스
			c.fillStyle = cBase;
			c.fill();

			// hover 색상 오버레이
			if (hv > 0.003 && fv < 0.99) {
				c.globalAlpha = hv * (1 - fv);
				c.fillStyle = cHover;
				c.fill();
			}

			// focus 색상 오버레이
			if (fv > 0.003) {
				c.globalAlpha = fv;
				c.fillStyle = cFocus;
				c.fill();
			}

			// press 색상 오버레이
			if (pv > 0.003) {
				c.globalAlpha = pv;
				c.fillStyle = cPress;
				c.fill();
			}
			c.globalAlpha = 1;
		}

		/* ───────── 루프: 움직일 때만 돈다 (포커스 중엔 일렁임 유지) ───────── */
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

		/* ───────── 입력 이벤트 ───────── */
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

		const onMove = (e: PointerEvent) => {
			if (e.pointerType === 'touch') return;
			const r = box.getBoundingClientRect();
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
			const nextInside = d <= maxB;
			if (nextInside !== inside) {
				inside = nextInside;
				hovered = nextInside;
				if (!nextInside) pressed = false;
			}

			if (d <= 0 || d >= reach || maxB <= 0) {
				ampT = 0;
			} else if (d <= maxB) {
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

		box.addEventListener('pointerdown', onDown);
		box.addEventListener('pointercancel', onCancel);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointermove', onMove, { passive: true });
		document.documentElement.addEventListener('pointerleave', onDocLeave);

		readColors();
		relayout = layout;
		wakeFn = wake;
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

		if (focused) wake();

		return () => {
			clearTimeout(touchResetTimer);
			cancelAnimationFrame(raf);
			ro.disconnect();
			removeDprListener?.();
			window.removeEventListener('resize', layout);
			relayout = undefined;
			wakeFn = undefined;
			box.removeEventListener('pointerdown', onDown);
			box.removeEventListener('pointercancel', onCancel);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointermove', onMove);
			document.documentElement.removeEventListener('pointerleave', onDocLeave);
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ready = false;
			hovered = false;
		};
	}
</script>

<div
	class="lq lq-input {klass}"
	class:full-width={fullWidth}
	bind:this={wrap}
	data-ready={ready || undefined}
	data-hovered={hovered || undefined}
	data-focused={focused || undefined}
	data-disabled={disabled || undefined}
	data-readonly={readonly || undefined}
	style:--lq-i-r="{radius}px"
	style:--lq-i-inset="{inset}px"
	style:--lq-color={color}
	style:--lq-color-hover={hoverColor}
	style:--lq-color-focus={focusColor ?? hoverColor}
	style:--lq-color-press={pressColor}
	style:--lq-color-wave={wvHover.color}
	style:--lq-color-wave-focus={wvFocus.color}
	style:--lq-text={textColor}
	style:--lq-placeholder={placeholderColor}
	style:--lq-input-min-h={typeof size === 'number' ? `${size}px` : undefined}
	{style}
>
	<canvas bind:this={canvas} aria-hidden="true" style:left="{-SAFE}px" style:top="{-SAFE}px"></canvas>

	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={box}
		class="input-box {typeof size === 'string' ? `size-${size}` : ''}"
		onclick={handleBoxClick}
	>
		{#if prefix}
			<div class="input-slot input-prefix" aria-hidden="true">
				{@render prefix()}
			</div>
		{:else if prefixText}
			<span class="input-text-affix input-prefix-text" aria-hidden="true">{prefixText}</span>
		{/if}

		<!-- svelte-ignore a11y_autofocus -->
		<input
			bind:this={inputEl}
			type={effectiveType}
			bind:value
			{placeholder}
			{disabled}
			{readonly}
			{required}
			{autofocus}
			class="inner-input {inputClass}"
			oninput={handleInput}
			onchange={handleChange}
			onkeydown={handleKeyDown}
			onfocus={handleFocus}
			onblur={handleBlur}
			{...rest}
		/>

		{#if clearable && !disabled && !readonly && value !== '' && value !== undefined && value !== null}
			<button
				type="button"
				class="input-action-btn input-clear-btn"
				tabindex="-1"
				aria-label="입력 내용 지우기"
				onclick={handleClear}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<circle cx="12" cy="12" r="10" />
					<path d="m15 9-6 6" />
					<path d="m9 9 6 6" />
				</svg>
			</button>
		{/if}

		{#if showPasswordToggle && type === 'password' && !disabled}
			<button
				type="button"
				class="input-action-btn input-pwd-toggle-btn"
				tabindex="-1"
				aria-label={isPasswordVisible ? '비밀번호 가리기' : '비밀번호 보기'}
				onclick={togglePasswordVisibility}
			>
				{#if isPasswordVisible}
					<!-- 비밀번호 숨기기 아이콘 (눈 감음) -->
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="m15 18-.722-3.25" />
						<path d="M2 8a10.645 10.645 0 0 0 20 0" />
						<path d="m20 15-1.726-2.05" />
						<path d="m4 15 1.726-2.05" />
						<path d="m9 18 .722-3.25" />
					</svg>
				{:else}
					<!-- 비밀번호 보기 아이콘 (눈 뜸) -->
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path
							d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
						/>
						<circle cx="12" cy="12" r="3" />
					</svg>
				{/if}
			</button>
		{/if}

		{#if suffix}
			<div class="input-slot input-suffix">
				{@render suffix()}
			</div>
		{:else if suffixText}
			<span class="input-text-affix input-suffix-text" aria-hidden="true">{suffixText}</span>
		{/if}
	</div>
</div>

<style>
	.lq {
		position: relative;
		display: inline-grid;
		isolation: isolate;
		vertical-align: middle;
	}

	.lq.full-width {
		display: grid;
		width: 100%;
	}

	.lq[data-disabled] {
		opacity: 0.55;
		pointer-events: none;
	}

	canvas {
		position: absolute;
		z-index: 0;
		pointer-events: none;
	}

	.input-box {
		--lq-i-base: var(--lq-color, rgb(255, 255, 255));
		--lq-i-hover: var(--lq-color-hover, var(--lq-i-base));
		--lq-i-focus: var(--lq-color-focus, var(--lq-i-hover));
		--lq-i-press: var(--lq-color-press, #f3f4f6);
		--lq-i-wave: var(--lq-color-wave, var(--lq-i-hover));
		--lq-i-wave-focus: var(--lq-color-wave-focus, var(--lq-i-focus));

		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		box-sizing: border-box;
		width: 100%;
		margin: 0;
		color: var(--lq-text, #282828);
		cursor: text;
		-webkit-tap-highlight-color: transparent;

		border: var(--lq-i-inset) solid transparent;
		border-radius: calc(var(--lq-i-r) + var(--lq-i-inset));

		/* 폴백: JS 로딩 전 / reduced-motion / 엔진 실패 시 보이는 기본 스타일 */
		background: var(--lq-i-base);
		background-clip: padding-box;
		transition:
			background-color 0.15s,
			box-shadow 0.15s;
	}

	.input-box:hover {
		background: var(--lq-i-hover);
		background-clip: padding-box;
	}

	.lq[data-focused] .input-box {
		background: var(--lq-i-focus);
		background-clip: padding-box;
	}

	/* 캔버스가 활성화되면 박스 배경은 투명화 */
	.lq[data-ready] .input-box,
	.lq[data-ready] .input-box:hover,
	.lq[data-ready][data-focused] .input-box {
		background: transparent;
		transition: none;
	}

	/* 크기 프리셋 */
	.input-box.size-sm {
		min-height: var(--lq-input-min-h, 34px);
		padding: 0.35em 0.85em;
		font-size: 0.875rem;
		gap: 0.45rem;
	}
	.input-box.size-md {
		min-height: var(--lq-input-min-h, 42px);
		padding: 0.55em 1.15em;
		font-size: 0.95rem;
		gap: 0.6rem;
	}
	.input-box.size-lg {
		min-height: var(--lq-input-min-h, 50px);
		padding: 0.75em 1.35em;
		font-size: 1.05rem;
		gap: 0.75rem;
	}

	/* 내부 실제 인풋 필드 */
	.inner-input {
		flex: 1 1 0%;
		min-width: 0;
		width: 100%;
		border: none;
		outline: none;
		background: transparent;
		font: inherit;
		color: inherit;
		padding: 0;
		margin: 0;
		-webkit-appearance: none;
		appearance: none;
	}

	.inner-input::placeholder {
		color: var(--lq-placeholder, #a3a3a3);
		opacity: 1;
	}

	.inner-input:disabled {
		cursor: not-allowed;
	}

	/* 접두사/접미사 슬롯 */
	.input-slot {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		color: currentColor;
		opacity: 0.85;
	}

	.input-text-affix {
		font-size: 0.9em;
		font-weight: 500;
		opacity: 0.65;
		user-select: none;
		flex-shrink: 0;
	}

	/* 우측 액션 버튼 (지우기 / 비밀번호 토글) */
	.input-action-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		padding: 3px;
		margin: 0;
		cursor: pointer;
		color: currentColor;
		opacity: 0.55;
		border-radius: 50%;
		transition:
			opacity 0.15s,
			transform 0.15s;
		flex-shrink: 0;
	}

	.input-action-btn:hover {
		opacity: 0.95;
		transform: scale(1.1);
	}

	.input-action-btn:active {
		transform: scale(0.92);
	}
</style>

