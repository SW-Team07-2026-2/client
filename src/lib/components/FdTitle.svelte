<script lang="ts">
	import { onMount } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLElement> {
		/** 이동할 링크 경로 (예: '/', '/home'). 지정 시 <a> 태그로 렌더링되며 SvelteKit SPA 네비게이션으로 동작 */
		href?: string;
		/** 클릭 시 페이지를 새로고침할지 여부 (레거시 지원용, href 사용 권장) */
		reloadOnClick?: boolean;
		/** reloadOnClick 별칭 */
		reload?: boolean;
		/** hover 시 해당 알파벳의 메타볼 연결이 끊어지고 LP판이 드러나는 효과 활성화 여부 (기본 true) */
		disconnectOnHover?: boolean;
		/** 클릭 시 해당 알파벳의 LP판 분리 상태를 토글할지 여부 (기본 true) */
		disconnectOnClick?: boolean;
		/** 로고 높이(px). 생략하면 CSS 크기에 맞춤 (기본 84) */
		height?: number;
		/** 로고 기본 색상 (기본 #ffffff) */
		color?: string;
		/** LP판 홈 및 중앙 구멍 색상 (기본 #070709) */
		holeColor?: string;
		/** LP판 무늬(트랙 홈, 회전 그루브 아크, 라벨 링) 표시 여부. false면 단색 원판 + 중앙 작은 구멍만 표시 (기본 true) */
		lpPattern?: boolean;
		/** 접근성 라벨 */
		ariaLabel?: string;
	}

	let {
		href,
		reloadOnClick = false,
		reload = false,
		disconnectOnHover = true,
		disconnectOnClick = true,
		height,
		color = '#ffffff',
		holeColor = '#070709',
		lpPattern = true,
		ariaLabel = 'INDIG 로고',
		class: klass = '',
		onclick,
		...rest
	}: Props = $props();

	let btn: HTMLElement;
	let canvas: HTMLCanvasElement;
	let relayout: (() => void) | undefined;
	/** 캔버스가 첫 프레임을 그린 뒤 true → SSR 플레이스홀더(title.svg)를 숨김 */
	let ready = $state(false);

	$effect(() => {
		void height;
		void color;
		void holeColor;
		relayout?.();
	});

	// Group 2.svg 원본 비율: 가로 38R x 세로 10R
	const LOGO_W_UNITS = 38;
	const LOGO_H_UNITS = 10;
	const ASPECT = LOGO_W_UNITS / LOGO_H_UNITS;

	interface NodeDef {
		x: number; // R 단위 중심 X
		y: number; // R 단위 중심 Y
	}

	interface BridgeDef {
		a: number;
		b: number;
		diagonal?: boolean;
	}

	interface LetterDef {
		char: string;
		x0: number; // 시작 X (R 단위)
		w: number; // 폭 (R 단위)
		nodes: NodeDef[];
		bridges: BridgeDef[];
	}

	// 원본 로고(I-N-D-I-G)의 메타볼 원 배치 및 브릿지 그래프 정의
	const LETTERS: LetterDef[] = [
		// 0: I (x: 0..2)
		{
			char: 'I',
			x0: 0,
			w: 2,
			nodes: [
				{ x: 1, y: 1 },
				{ x: 1, y: 3 },
				{ x: 1, y: 5 },
				{ x: 1, y: 7 },
				{ x: 1, y: 9 }
			],
			bridges: [
				{ a: 0, b: 1 },
				{ a: 1, b: 2 },
				{ a: 2, b: 3 },
				{ a: 3, b: 4 }
			]
		},
		// 1: N (x: 3..13)
		{
			char: 'N',
			x0: 3,
			w: 10,
			nodes: [
				// 왼쪽 기둥 (0..3)
				{ x: 4, y: 3 },
				{ x: 4, y: 5 },
				{ x: 4, y: 7 },
				{ x: 4, y: 9 },
				// 상단 바 (4..6)
				{ x: 6, y: 1 },
				{ x: 8, y: 1 },
				{ x: 10, y: 1 },
				// 오른쪽 기둥 (7..10)
				{ x: 12, y: 3 },
				{ x: 12, y: 5 },
				{ x: 12, y: 7 },
				{ x: 12, y: 9 }
			],
			bridges: [
				{ a: 0, b: 1 },
				{ a: 1, b: 2 },
				{ a: 2, b: 3 },
				{ a: 4, b: 5 },
				{ a: 5, b: 6 },
				{ a: 7, b: 8 },
				{ a: 8, b: 9 },
				{ a: 9, b: 10 },
				{ a: 0, b: 4, diagonal: true },
				{ a: 6, b: 7, diagonal: true }
			]
		},
		// 2: D (x: 14..24)
		{
			char: 'D',
			x0: 14,
			w: 10,
			nodes: [
				// 왼쪽 기둥 (0..4)
				{ x: 15, y: 1 },
				{ x: 15, y: 3 },
				{ x: 15, y: 5 },
				{ x: 15, y: 7 },
				{ x: 15, y: 9 },
				// 상단 바 (5..7)
				{ x: 17, y: 1 },
				{ x: 19, y: 1 },
				{ x: 21, y: 1 },
				// 오른쪽 기둥 (8..10)
				{ x: 23, y: 3 },
				{ x: 23, y: 5 },
				{ x: 23, y: 7 },
				// 하단 바 (11..13)
				{ x: 17, y: 9 },
				{ x: 19, y: 9 },
				{ x: 21, y: 9 }
			],
			bridges: [
				{ a: 0, b: 1 },
				{ a: 1, b: 2 },
				{ a: 2, b: 3 },
				{ a: 3, b: 4 },
				{ a: 0, b: 5 },
				{ a: 5, b: 6 },
				{ a: 6, b: 7 },
				{ a: 8, b: 9 },
				{ a: 9, b: 10 },
				{ a: 4, b: 11 },
				{ a: 11, b: 12 },
				{ a: 12, b: 13 },
				{ a: 1, b: 5, diagonal: true },
				{ a: 3, b: 11, diagonal: true },
				{ a: 7, b: 8, diagonal: true },
				{ a: 13, b: 10, diagonal: true }
			]
		},
		// 3: I (x: 25..27)
		{
			char: 'I',
			x0: 25,
			w: 2,
			nodes: [
				{ x: 26, y: 1 },
				{ x: 26, y: 3 },
				{ x: 26, y: 5 },
				{ x: 26, y: 7 },
				{ x: 26, y: 9 }
			],
			bridges: [
				{ a: 0, b: 1 },
				{ a: 1, b: 2 },
				{ a: 2, b: 3 },
				{ a: 3, b: 4 }
			]
		},
		// 4: G (x: 28..38)
		{
			char: 'G',
			x0: 28,
			w: 10,
			nodes: [
				// 왼쪽 기둥 (0..2)
				{ x: 29, y: 3 },
				{ x: 29, y: 5 },
				{ x: 29, y: 7 },
				// 상단 바 (3..5)
				{ x: 31, y: 1 },
				{ x: 33, y: 1 },
				{ x: 35, y: 1 },
				// 우상단 훅 끝점 (6)
				{ x: 37, y: 3 },
				// 하단 바 (7..9)
				{ x: 31, y: 9 },
				{ x: 33, y: 9 },
				{ x: 35, y: 9 },
				// 중앙 가로 바 및 우하단 기둥 (10..12)
				{ x: 35, y: 6 },
				{ x: 37, y: 6 },
				{ x: 37, y: 8 }
			],
			bridges: [
				{ a: 0, b: 1 },
				{ a: 1, b: 2 },
				{ a: 3, b: 4 },
				{ a: 4, b: 5 },
				{ a: 7, b: 8 },
				{ a: 8, b: 9 },
				{ a: 10, b: 11 },
				{ a: 11, b: 12 },
				{ a: 0, b: 3, diagonal: true },
				{ a: 2, b: 7, diagonal: true },
				{ a: 5, b: 6, diagonal: true },
				{ a: 9, b: 12, diagonal: true }
			]
		}
	];

	onMount(() => {
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const TAU = Math.PI * 2;
		const PAD = 0.6;

		// 알파벳별 물리 상태 (split: 0 = 완전히 이어진 메타볼 로고, 1 = 연결이 끊어지고 LP판으로 분리)
		const states = LETTERS.map(() => ({
			hovered: false,
			pinned: false,
			split: 0,
			vel: 0,
			spin: Math.random() * TAU
		}));

		let cw = 0;
		let ch = 0;
		let dpr = 1;
		let R = 10;
		let ox = 0;
		let oy = 0;
		let pointerX = -9999;
		let pointerY = -9999;
		let raf = 0;
		let last = 0;
		let time = 0;

		function layout() {
			if (!btn || !canvas) return;
			const rect = btn.getBoundingClientRect();
			cw = Math.round(rect.width) || (height ? Math.round(height * ASPECT) : 380);
			ch = Math.round(rect.height) || Math.round(cw / ASPECT);
			dpr = Math.min(window.devicePixelRatio || 1, 4);

			canvas.width = Math.round(cw * dpr);
			canvas.height = Math.round(ch * dpr);

			R = Math.min(cw / (LOGO_W_UNITS + PAD * 2), ch / (LOGO_H_UNITS + PAD * 2));
			ox = (cw - LOGO_W_UNITS * R) / 2;
			oy = (ch - LOGO_H_UNITS * R) / 2;

			draw();
			// 첫 프레임이 그려지면 SSR 플레이스홀더 제거
			ready = true;
		}

		relayout = layout;

		/**
		 * 두 원(P1, P2, 반지름 r) 사이의 유체 메타볼 브릿지를 정확한 외접 원호(arc)로 그린다.
		 * pinch(0 -> 1)가 커질수록 브릿지 허리(waist)가 잘록하게 조여들다 끊어진다.
		 */
		function drawBridge(
			c: CanvasRenderingContext2D,
			x1: number,
			y1: number,
			x2: number,
			y2: number,
			r: number,
			diagonal: boolean,
			pinch: number
		) {
			if (pinch >= 1) return;

			const dx = x2 - x1;
			const dy = y2 - y1;
			const L = Math.hypot(dx, dy);
			if (L < 1e-3 || L >= 4 * r) return;

			const ux = dx / L;
			const uy = dy / L;
			const nx = -uy;
			const ny = ux;
			const mx = (x1 + x2) * 0.5;
			const my = (y1 + y2) * 0.5;

			const w0 =
				!diagonal && L <= 2.05 * r ? r : Math.sqrt(Math.max(0, 4 * r * r - L * L * 0.25)) - r;

			// pinch가 진행될수록 허리 폭(w)이 0으로 수축하며 유체 표면장력처럼 잘록해짐
			const ease = pinch * pinch * (3 - 2 * pinch);
			const w = w0 * (1 - ease);
			if (w <= 0.015 * r) return;

			// 직교 브릿지가 아직 수축하기 전(w ≈ r)에는 직선으로 연결
			if (r - w < 1e-2 * r) {
				c.beginPath();
				c.moveTo(x1 + r * nx, y1 + r * ny);
				c.lineTo(x2 + r * nx, y2 + r * ny);
				c.lineTo(x2 - r * nx, y2 - r * ny);
				c.lineTo(x1 - r * nx, y1 - r * ny);
				c.closePath();
				c.fill();
				return;
			}

			// 두 원(반지름 r)에 동시에 외접하면서 중점에서의 허리 반폭이 정확히 w인 오목 원호 반지름 rF
			const rF = (L * L * 0.25 + w * w - r * r) / (2 * (r - w));
			const hF = w + rF;

			// 양쪽 오목 필렛 원의 중심 (F+, F-)
			const fxP = mx + hF * nx;
			const fyP = my + hF * ny;
			const fxM = mx - hF * nx;
			const fyM = my - hF * ny;

			const th1P = Math.atan2(y1 - fyP, x1 - fxP);
			const th2P = Math.atan2(y2 - fyP, x2 - fxP);
			const th2M = Math.atan2(y2 - fyM, x2 - fxM);
			const th1M = Math.atan2(y1 - fyM, x1 - fxM);

			c.beginPath();
			c.arc(fxP, fyP, rF, th1P, th2P, false);
			c.arc(fxM, fyM, rF, th2M, th1M, false);
			c.closePath();
			c.fill();
		}

		/**
		 * Group 2.svg의 G 우하단 곡률 보정:
		 * 1) 중앙 가로바와 하단 바 사이의 안쪽 반원 오목 홈 (중심 (35.5R, 7.5R), 반지름 0.5R)
		 * 2) 우하단 외곽 S자 베지어 곡선 (M 37 9 C 36.1272 9, 36 10, 35 10)
		 * pinch가 진행될수록 우하단 기둥/브릿지 안으로 부드럽게 수축하며 사라진다.
		 */
		function drawGContours(
			c: CanvasRenderingContext2D,
			pts: { x: number; y: number }[],
			r: number,
			pinch: number
		) {
			if (pinch >= 1) return;
			const ease = pinch * pinch * (3 - 2 * pinch);
			const k = (1 - ease) * (1 - ease);
			if (k <= 0.01) return;

			const p9 = pts[9]; // (35R, 9R)
			const p10 = pts[10]; // (35R, 6R)
			const p12 = pts[12]; // (37R, 8R)

			// 1) 안쪽 반원 오목 필렛: (35.5R, 7R) -> (36R, 7.5R) -> (35.5R, 8R)
			const nx = p10.x + (1 - 0.5 * k) * r;
			const ny = (p10.y + p9.y) * 0.5 - 0.15;
			const nr = (0.5 * r) / Math.max(k, 0.4);

			c.beginPath();
			c.moveTo(nx, ny - nr);
			c.arc(nx, ny, nr, -Math.PI * 0.5, Math.PI * 0.5, false);
			c.lineTo(nx + r, ny + nr);
			c.lineTo(nx + r, ny - nr);
			c.closePath();
			c.fill();

			// 2) 우하단 외곽 S자 곡선 보강: M 37 9 C 36.1272 9, 36 10, 35 10
			const sx = p12.x;
			const sy = p12.y + r * k;
			const ex = p9.x;
			const ey = p9.y + r * k;
			const cp1x = p9.x + 1.1272 * r * k + (1 - k) * (p12.x - p9.x) * 0.5;
			const cp1y = sy;
			const cp2x = p9.x + r * k;
			const cp2y = ey;

			c.beginPath();
			c.moveTo(p9.x, p9.y);
			c.lineTo(p12.x, p12.y);
			c.lineTo(sx, sy);
			c.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, ex, ey);
			c.closePath();
			c.fill();
		}

		/**
		 * 브릿지가 끊어진 직후 각 원에 남아 있다가 표면장력으로 스며드는 물방울 돌기
		 */
		function drawSnapDrop(
			c: CanvasRenderingContext2D,
			x1: number,
			y1: number,
			x2: number,
			y2: number,
			r: number,
			recoil: number
		) {
			if (recoil <= 0 || recoil >= 1) return;
			const dx = x2 - x1;
			const dy = y2 - y1;
			const L = Math.hypot(dx, dy) || 1;
			const ux = dx / L;
			const uy = dy / L;
			const nx = -uy;
			const ny = ux;

			const bud = r * 0.28 * (1 - recoil) * (1 - recoil);
			const spread = 0.38 * (1 - 0.5 * recoil);

			for (const [cx, cy, dir] of [
				[x1, y1, 1],
				[x2, y2, -1]
			] as const) {
				const bx = cx + dir * ux * (r + bud);
				const by = cy + dir * uy * (r + bud);
				const sx1 = cx + dir * ux * r * Math.cos(spread) + nx * r * Math.sin(spread);
				const sy1 = cy + dir * uy * r * Math.cos(spread) + ny * r * Math.sin(spread);
				const sx2 = cx + dir * ux * r * Math.cos(spread) - nx * r * Math.sin(spread);
				const sy2 = cy + dir * uy * r * Math.cos(spread) - ny * r * Math.sin(spread);

				c.beginPath();
				c.moveTo(sx1, sy1);
				c.quadraticCurveTo(bx, by, sx2, sy2);
				c.closePath();
				c.fill();
			}
		}

		/**
		 * 개별 원 위에 LP 레코드 디테일(트랙 홈, 회전 광택 아크, 라벨 링, 중앙 스핀들 홀) 렌더링
		 */
		function drawLpDetails(
			c: CanvasRenderingContext2D,
			x: number,
			y: number,
			r: number,
			alpha: number,
			angle: number
		) {
			if (alpha <= 0.01) return;
			c.save();

			if (lpPattern) {
			// 1) LP 미세 트랙 홈 (동심원)
			c.strokeStyle = holeColor;
			c.lineWidth = Math.max(1, r * 0.055);
			for (const ratio of [0.8, 0.64, 0.48]) {
				c.globalAlpha = alpha * 0.22;
				c.beginPath();
				c.arc(x, y, r * ratio, 0, TAU);
				c.stroke();
			}

			// 2) 회전하는 LP 그루브 아크 (회전감이 눈에 보이도록 대칭 호 렌더링)
			c.lineWidth = Math.max(1.1, r * 0.075);
			c.lineCap = 'round';
			c.globalAlpha = alpha * 0.42;
			for (const [ratio, arcLen, offset] of [
				[0.72, 1.05, 0],
				[0.56, 0.85, 1.1]
			] as const) {
				c.beginPath();
				c.arc(x, y, r * ratio, angle + offset, angle + offset + arcLen);
				c.stroke();
				c.beginPath();
				c.arc(x, y, r * ratio, angle + offset + Math.PI, angle + offset + Math.PI + arcLen);
				c.stroke();
			}

			// 3) 중앙 라벨 링
			c.globalAlpha = alpha * 0.28;
			c.fillStyle = holeColor;
			c.beginPath();
			c.arc(x, y, r * 0.34, 0, TAU);
			c.fill();
			}

			// 4) 중앙 스핀들 구멍 (LP 중심 홀)
			c.globalAlpha = alpha;
			c.fillStyle = holeColor;
			c.beginPath();
			c.arc(x, y, r * 0.17 * alpha, 0, TAU);
			c.fill();

			c.restore();
		}

		function update(dt: number): boolean {
			let moving = false;
			time += dt;

			for (let i = 0; i < LETTERS.length; i++) {
				const st = states[i];
				const target = st.hovered || st.pinned ? 1 : 0;

				// 부드럽고 쫀득한 유체 스프링 보간
				const k = target === 1 ? 170 : 140;
				const damp = target === 1 ? 16 : 18;
				st.vel += ((target - st.split) * k - st.vel * damp) * dt;
				st.split += st.vel * dt;

				if (st.split > 0.01) {
					st.spin += dt * (2.4 + (i % 2) * 0.4) * Math.min(1, st.split);
				}

				if (target === 1 || Math.abs(st.split - target) > 0.002 || Math.abs(st.vel) > 0.01) {
					moving = true;
				} else {
					st.split = target;
					st.vel = 0;
				}
			}

			return moving;
		}

		function draw() {
			if (!cw || !ch) return;
			const c = ctx!;
			c.setTransform(1, 0, 0, 1, 0, 0);
			c.clearRect(0, 0, canvas.width, canvas.height);
			c.setTransform(dpr, 0, 0, dpr, 0, 0);

			for (let li = 0; li < LETTERS.length; li++) {
				const letter = LETTERS[li];
				const st = states[li];
				const sp = Math.max(0, Math.min(1.15, st.split));

				// sp === 0 이면 완전히 결합된 메타볼, sp가 커질수록 원들이 살짝 수축·부유하며 개별 LP판으로 분리
				const shrink = 1 - 0.11 * Math.min(1, sp);
				const r = R * shrink;

				// 브릿지 수축 진행도 (sp = 0 ~ 0.58 구간에서 잘록해지다 0.58에서 끊어짐)
				const pinch = Math.min(1, sp / 0.58);
				const recoil = sp > 0.58 ? Math.min(1, (sp - 0.58) / 0.32) : 0;

				// 각 원의 현재 중심 좌표 계산 (분리 시 미세한 유체 부유감)
				const pts = letter.nodes.map((nd, ni) => {
					let x = ox + nd.x * R;
					let y = oy + nd.y * R;
					if (sp > 0.01) {
						const floatAmp = R * 0.055 * Math.min(1, sp);
						x += Math.sin(time * 2.6 + ni * 1.7 + li) * floatAmp;
						y += Math.cos(time * 2.2 + ni * 2.3 + li * 0.7) * floatAmp;
					}
					return { x, y };
				});

				c.fillStyle = color;

				// 1) 메타볼 브릿지 렌더링 (끊어지기 전) 또는 끊어진 직후 물방울 잔상
				for (const br of letter.bridges) {
					const p1 = pts[br.a];
					const p2 = pts[br.b];
					if (pinch < 1) {
						drawBridge(c, p1.x, p1.y, p2.x, p2.y, r, !!br.diagonal, pinch);
					} else if (recoil < 1) {
						drawSnapDrop(c, p1.x, p1.y, p2.x, p2.y, r, recoil);
					}
				}

				// G(li === 4)의 Group 2.svg 우하단 반원 홈 및 S자 외곽 곡률 보정
				if (li === 4 && pinch < 1) {
					drawGContours(c, pts, r, pinch);
				}

				// 2) 각 노드 원(메타볼 코어 / LP판 본체) 렌더링
				for (let ni = 0; ni < pts.length; ni++) {
					const p = pts[ni];
					c.beginPath();
					c.arc(p.x, p.y, r, 0, TAU);
					c.fill();
				}

				// 3) 유체 연결이 끊어지며 드러나는 LP판 디테일 (이스터에그)
				if (sp > 0.18) {
					const lpAlpha = Math.min(1, (sp - 0.18) / 0.55);
					for (let ni = 0; ni < pts.length; ni++) {
						const p = pts[ni];
						const dir = ni % 2 === 0 ? 1 : -1;
						drawLpDetails(c, p.x, p.y, r, lpAlpha, st.spin * dir + ni * 0.8);
					}
				}
			}
		}

		function tick(now: number) {
			raf = 0;
			const dt = Math.min((now - last) / 1000, 1 / 30) || 1 / 60;
			last = now;
			const moving = update(dt);
			draw();
			if (moving) raf = requestAnimationFrame(tick);
		}

		function wake() {
			if (raf) return;
			last = performance.now();
			raf = requestAnimationFrame(tick);
		}

		/** 포인터가 위치한 알파벳 인덱스 반환 (없으면 -1) */
		function hitLetterIndex(clientX: number, clientY: number): number {
			const rect = btn.getBoundingClientRect();
			pointerX = clientX - rect.left;
			pointerY = clientY - rect.top;
			if (pointerX < 0 || pointerX > rect.width || pointerY < 0 || pointerY > rect.height) {
				return -1;
			}
			const ux = (pointerX - ox) / R;
			const uy = (pointerY - oy) / R;
			if (uy < -0.5 || uy > LOGO_H_UNITS + 0.5) return -1;

			for (let i = 0; i < LETTERS.length; i++) {
				const l = LETTERS[i];
				if (ux >= l.x0 - 0.45 && ux <= l.x0 + l.w + 0.45) {
					return i;
				}
			}
			return -1;
		}

		const onPointerMove = (e: PointerEvent) => {
			if (!disconnectOnHover || e.pointerType === 'touch') return;
			const idx = hitLetterIndex(e.clientX, e.clientY);
			let changed = false;
			for (let i = 0; i < states.length; i++) {
				const next = i === idx;
				if (states[i].hovered !== next) {
					states[i].hovered = next;
					changed = true;
				}
			}
			if (changed) wake();
		};

		const onPointerLeave = () => {
			let changed = false;
			for (let i = 0; i < states.length; i++) {
				if (states[i].hovered) {
					states[i].hovered = false;
					changed = true;
				}
			}
			if (changed) wake();
		};

		const onClick = (e: MouseEvent) => {
			onclick?.(e as MouseEvent & { currentTarget: EventTarget & HTMLElement });
			if (e.defaultPrevented) return;

			if (reloadOnClick || reload) {
				window.location.reload();
				return;
			}

			// 링크 이동 모드가 아닐 때 LP판 분리 토글 이스터에그 작동
			if (!href && disconnectOnClick) {
				const idx = hitLetterIndex(e.clientX, e.clientY);
				if (idx >= 0) {
					states[idx].pinned = !states[idx].pinned;
					wake();
				} else {
					const anyPinned = states.some((s) => s.pinned);
					for (const s of states) s.pinned = !anyPinned;
					wake();
				}
			}
		};

		btn.addEventListener('pointermove', onPointerMove);
		btn.addEventListener('pointerleave', onPointerLeave);
		btn.addEventListener('click', onClick);
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

		const ro = new ResizeObserver(layout);
		ro.observe(btn);
		layout();

		return () => {
			relayout = undefined;
			cancelAnimationFrame(raf);
			ro.disconnect();
			removeDprListener?.();
			window.removeEventListener('resize', layout);
			btn.removeEventListener('pointermove', onPointerMove);
			btn.removeEventListener('pointerleave', onPointerLeave);
			btn.removeEventListener('click', onClick);
		};
	});
</script>

<svelte:element
	this={href ? 'a' : 'button'}
	bind:this={btn}
	href={href}
	type={href ? undefined : 'button'}
	aria-label={ariaLabel}
	class="lq-title {klass}"
	style:width={height ? `min(100%, ${Math.round(height * ASPECT)}px)` : '100%'}
	style:height="auto"
	style:aspect-ratio="{LOGO_W_UNITS} / {LOGO_H_UNITS}"
	style:max-width="100%"
	{...rest}
>
	<!-- 하이드레이션 전에도 로고가 보이도록 SSR되는 정적 플레이스홀더 (캔버스 로고와 동일 여백) -->
	<span
		class="placeholder"
		class:hidden={ready}
		style:background-color={color}
		aria-hidden="true"
	></span>
	<canvas bind:this={canvas} aria-hidden="true"></canvas>
</svelte:element>

<style>
	.lq-title {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		margin: 0;
		border: none;
		background: transparent;
		cursor: pointer;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
		max-width: 100%;
		box-sizing: border-box;
		text-decoration: none;
		color: inherit;
	}

	.lq-title:focus-visible {
		outline: 2px solid rgba(255, 255, 255, 0.5);
		outline-offset: 6px;
		border-radius: 8px;
	}

	/* 캔버스 레이아웃과 동일: 38x10 로고 + 사방 PAD(0.6) 여백 → 약 5.357% 인셋 */
	.placeholder {
		position: absolute;
		inset: 5.357%;
		pointer-events: none;
		-webkit-mask: url('/title.svg') center / contain no-repeat;
		mask: url('/title.svg') center / contain no-repeat;
		filter: drop-shadow(0 0 7px rgba(0, 0, 0));
	}

	.placeholder.hidden {
		visibility: hidden;
	}

	canvas {
		display: block;
		width: 100%;
		height: 100%;
		pointer-events: none;
		/* 살짝 어두운 그린 그림자 */
		filter: drop-shadow(0 0 7px rgba(0, 0, 0));
	}
</style>
