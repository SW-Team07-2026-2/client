<script lang="ts">
	import { untrack } from 'svelte';
	import { organicWave } from '#lib/fluid';

	export type BotState = 'idle' | 'thinking' | 'talking' | 'happy' | 'sleepy';

	interface Props {
		/** 현재 봇의 상태: 'idle' | 'thinking' | 'talking' | 'happy' | 'sleepy' */
		state?: BotState;
		/** 눈 및 주요 포인트 컬러 */
		color?: string;
		/** 눈 네온 글로우 컬러 */
		glowColor?: string;
		/** 바디 배경색 (완전 투명으로 하려면 'transparent') */
		bodyColor?: string;
		/** 바디 테두리 색상 */
		borderColor?: string;
		/** 외곽 바디(모니터 실루엣) 표시 여부 */
		showBody?: boolean;
		/** 머리 위 안테나/인디케이터 표시 여부 */
		showAntenna?: boolean;
		/** 마우스 커서 시선 추적 여부 */
		trackMouse?: boolean;
		/** 채팅창 열림 등으로 호버 시 물결 비활성화 여부 */
		disableHoverWave?: boolean;
		/** AI 작동 중(생각, 말하기 등) 지속적인 물결 활성화 여부 */
		activeWave?: boolean;
		/** 캔버스 기준 크기 (가로/세로 px) */
		size?: number;
		/** 추가 클래스 */
		class?: string;
	}

	let {
		state: botState = 'idle',
		color = '#18181b',
		glowColor = 'rgba(0, 0, 0, 0.12)',
		bodyColor = '#ffffff',
		borderColor = 'rgba(0, 0, 0, 0.08)',
		showBody = true,
		showAntenna = false,
		trackMouse = true,
		disableHoverWave = false,
		activeWave = false,
		size = 220,
		class: className = ''
	}: Props = $props();

	let containerEl: HTMLDivElement | null = $state(null);
	let canvas: HTMLCanvasElement | null = $state(null);

	// 내부 물리 및 애니메이션 변수들
	let targetLookX = 0;
	let targetLookY = 0;
	let currentLookX = 0;
	let currentLookY = 0;

	// 유체 물결 엔진 변수 (FdWave 연동)
	const WAVE_N = 64;
	const rx = new Float32Array(WAVE_N);
	const ry = new Float32Array(WAVE_N);
	const nx = new Float32Array(WAVE_N);
	const ny = new Float32Array(WAVE_N);
	const xs = new Float32Array(WAVE_N);
	const ys = new Float32Array(WAVE_N);

	let hoverSpring = { x: 0, v: 0 };
	let isHovered = false;
	let waveTime = 0;
	let lastFrameTime = performance.now();

	// 부드러운 유기적 눈 깜빡임 물리 상태 (프레임 단위 연속 이징)
	let blinkInfo = {
		active: false,
		startTime: 0,
		duration: 190, // 총 깜빡임 시간 (ms)
		isDouble: false,
		left: true,
		right: true
	};

	let eyeScaleYLeft = 1;
	let eyeScaleYRight = 1;
	let eyeScaleXLeft = 1;
	let eyeScaleXRight = 1;
	let blinkTimer: any = null;

	let mouthOpen = 0; // talking 상태 시 입 열림 정도
	let headTilt = 0; // 머리 기울기 (라디안)
	let targetHeadTilt = 0;

	/** 부드러운 눈 깜빡임 시작 */
	function startBlink(doubleBlink = false, left = true, right = true) {
		if (blinkInfo.active) return;
		blinkInfo = {
			active: true,
			startTime: performance.now(),
			duration: 190,
			isDouble: doubleBlink,
			left,
			right
		};
	}

	/** 외부에서 강제로 눈 깜빡이게 하기 */
	export function blink() {
		startBlink(false, true, true);
	}

	/** 한쪽 눈 부드럽게 윙크하기 ('left' | 'right') */
	export function wink(side: 'left' | 'right' = 'right') {
		startBlink(false, side === 'left', side === 'right');
	}

	function scheduleNextBlink() {
		// 2.2초 ~ 5초 사이 랜덤 주기
		const delay = 2200 + Math.random() * 2800;
		blinkTimer = setTimeout(() => {
			if (botState !== 'sleepy') {
				const isDouble = Math.random() < 0.25; // 25% 확률로 톡톡 두번 깜빡임
				startBlink(isDouble, true, true);
			}
			scheduleNextBlink();
		}, delay);
	}

	$effect(() => {
		if (!canvas || !containerEl) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		let animationFrameId: number;
		let isVisible = true;
		let startTime = performance.now();

		// 고해상도 DPI 보정
		const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
		canvas.width = size * dpr;
		canvas.height = size * dpr;
		ctx.scale(dpr, dpr);

		// 마우스 움직임 추적
		const handlePointerMove = (e: PointerEvent) => {
			if (!trackMouse || !containerEl || botState === 'sleepy') return;

			const rect = containerEl.getBoundingClientRect();
			const centerX = rect.left + rect.width / 2;
			const centerY = rect.top + rect.height / 2;

			const dx = e.clientX - centerX;
			const dy = e.clientY - centerY;

			// 최대 시선 이동 반경 (px)
			const maxRadius = size * 0.085;
			const dist = Math.hypot(dx, dy);

			// 마우스가 원형 봇 반경 근처에 오면 호버 상태 활성화 (단, disableHoverWave일 때는 호버 물결 비활성화)
			const currentR = size * 0.35;
			isHovered = !disableHoverWave && dist <= currentR * 1.35;

			if (dist > 0) {
				const factor = Math.min(dist / 250, 1);
				targetLookX = (dx / dist) * maxRadius * factor;
				targetLookY = (dy / dist) * maxRadius * factor;
			}
		};

		const handlePointerLeave = () => {
			isHovered = false;
			if (botState === 'idle') {
				targetLookX = 0;
				targetLookY = 0;
			}
		};

		window.addEventListener('pointermove', handlePointerMove, { passive: true });
		window.addEventListener('pointerleave', handlePointerLeave, { passive: true });

		// 화면에 보일 때만 렌더링 (전력 절약)
		const observer = new IntersectionObserver((entries) => {
			isVisible = entries[0]?.isIntersecting ?? true;
		});
		observer.observe(containerEl);

		scheduleNextBlink();

		// 원형 기준점(rx, ry, nx, ny) 초기화
		function initCirclePoints(radius: number) {
			for (let k = 0; k < WAVE_N; k++) {
				const th = (k / WAVE_N) * Math.PI * 2;
				const ox = Math.cos(th);
				const oy = Math.sin(th);
				nx[k] = ox;
				ny[k] = oy;
				rx[k] = ox * radius;
				ry[k] = oy * radius;
			}
		}

		// 점들을 부드러운 유체 곡선(Quadratic Curve)으로 연결하여 닫힌 패스 생성
		function tracePoints(context: CanvasRenderingContext2D) {
			context.beginPath();
			context.moveTo((xs[WAVE_N - 1] + xs[0]) / 2, (ys[WAVE_N - 1] + ys[0]) / 2);
			for (let i = 0; i < WAVE_N; i++) {
				const j = (i + 1) % WAVE_N;
				context.quadraticCurveTo(xs[i], ys[i], (xs[i] + xs[j]) / 2, (ys[i] + ys[j]) / 2);
			}
			context.closePath();
		}

		// FdWave 유체 엔진을 사용하여 점들의 위치 계산
		function calcWaveShape(
			grow: number,
			waveAmp: number,
			waveLength: number,
			timePhase: number,
			seed: number
		) {
			const k = (Math.PI * 2) / Math.max(20, waveLength);
			for (let i = 0; i < WAVE_N; i++) {
				const th = (i / WAVE_N) * Math.PI * 2;
				let off = grow;
				if (waveAmp > 0.01) {
					off += waveAmp * organicWave(rx[i], ry[i], th, k, timePhase, seed);
				}
				xs[i] = rx[i] + nx[i] * off;
				ys[i] = ry[i] + ny[i] * off;
			}
		}

		// 둥근 사각형 그리기 헬퍼
		function roundRect(
			context: CanvasRenderingContext2D,
			x: number,
			y: number,
			w: number,
			h: number,
			r: number
		) {
			context.beginPath();
			context.moveTo(x + r, y);
			context.arcTo(x + w, y, x + w, y + h, r);
			context.arcTo(x + w, y + h, x, y + h, r);
			context.arcTo(x, y + h, x, y, r);
			context.arcTo(x, y, x + w, y, r);
			context.closePath();
		}

		// 캡슐 형태 눈 그리기 (가로/세로 유기적 스케일 지원)
		function drawCapsule(
			context: CanvasRenderingContext2D,
			x: number,
			y: number,
			w: number,
			h: number,
			scaleY: number,
			scaleX: number = 1
		) {
			const effectiveW = w * scaleX;
			const effectiveH = Math.max(h * scaleY, 2.5);
			const r = Math.min(effectiveW / 2, effectiveH / 2);
			roundRect(context, x - effectiveW / 2, y - effectiveH / 2, effectiveW, effectiveH, r);
			context.fill();
		}

		// 반달 웃는 눈 (^ 모양 호) 그리기
		function drawHappyEye(
			context: CanvasRenderingContext2D,
			x: number,
			y: number,
			w: number,
			strokeW: number
		) {
			context.beginPath();
			context.arc(x, y + 2, w * 0.55, Math.PI * 1.15, Math.PI * 1.85, false);
			context.lineWidth = strokeW;
			context.lineCap = 'round';
			context.stroke();
		}

		// 메인 렌더 루프
		const render = (currentTime: number) => {
			if (!isVisible) {
				animationFrameId = requestAnimationFrame(render);
				return;
			}

			const dt = Math.min((currentTime - lastFrameTime) / 1000, 0.05);
			lastFrameTime = currentTime;

			// 호버 또는 AI 활성 상태(activeWave)에 따른 물결 목표값
			const shouldWave = activeWave || (!disableHoverWave && isHovered);
			const hT = shouldWave ? 1 : 0;
			hoverSpring.v += ((hT - hoverSpring.x) * 190 - hoverSpring.v * 16) * dt;
			hoverSpring.x += hoverSpring.v * dt;

			if (hoverSpring.x > 0.001) {
				waveTime += dt;
			}

			const elapsed = (currentTime - startTime) / 1000;

			// 상태별 목표값 조정
			if (botState === 'thinking') {
				targetHeadTilt = Math.sin(elapsed * 1.8) * 0.08 - 0.09; // 갸우뚱
				targetLookX = Math.cos(elapsed * 1.2) * (size * 0.05);
				targetLookY = -size * 0.07; // 위쪽을 쳐다봄
			} else if (botState === 'happy') {
				targetHeadTilt = Math.sin(elapsed * 4) * 0.04;
				targetLookX = 0;
				targetLookY = 0;
			} else if (botState === 'sleepy') {
				targetHeadTilt = 0.06;
				targetLookX = 0;
				targetLookY = size * 0.04; // 아래로 처짐
			} else {
				targetHeadTilt = 0;
			}

			// Lerp 부드러운 감속 추적
			currentLookX += (targetLookX - currentLookX) * 0.12;
			currentLookY += (targetLookY - currentLookY) * 0.12;
			headTilt += (targetHeadTilt - headTilt) * 0.1;

			// 눈 깜빡임 부드러운 유기적 이징 계산 (디즈니 Squash & Stretch + Cubic Ease-Out)
			if (blinkInfo.active) {
				const elapsedBlink = currentTime - blinkInfo.startTime;
				const progress = Math.min(elapsedBlink / blinkInfo.duration, 1);

				let scaleY = 1;
				let scaleX = 1;

				if (progress < 0.38) {
					// 1단계: 슥 감김 (0 -> 0.38, easeInQuad로 쫀득하게 가속)
					const p = progress / 0.38;
					scaleY = 1 - (1 - 0.05) * (p * p);
					scaleX = 1 + 0.18 * (p * p); // 가로로 찌그러지는 탄성 (Squash)
				} else {
					// 2단계: 촥~ 부드럽게 탄력 있게 떠짐 (0.38 -> 1.0, easeOutCubic)
					const p = (progress - 0.38) / 0.62;
					const easeOut = 1 - Math.pow(1 - p, 3);
					scaleY = 0.05 + (1 - 0.05) * easeOut;
					scaleX = 1 + 0.18 * (1 - easeOut);
				}

				if (blinkInfo.left) {
					eyeScaleYLeft = scaleY;
					eyeScaleXLeft = scaleX;
				}
				if (blinkInfo.right) {
					eyeScaleYRight = scaleY;
					eyeScaleXRight = scaleX;
				}

				if (progress >= 1) {
					blinkInfo.active = false;
					if (blinkInfo.left) {
						eyeScaleYLeft = 1;
						eyeScaleXLeft = 1;
					}
					if (blinkInfo.right) {
						eyeScaleYRight = 1;
						eyeScaleXRight = 1;
					}

					if (blinkInfo.isDouble) {
						setTimeout(() => {
							startBlink(false, blinkInfo.left, blinkInfo.right);
						}, 75);
					}
				}
			}

			if (botState === 'talking') {
				// 말할 때 입 뻐끔뻐끔
				mouthOpen = (Math.sin(elapsed * 14) + 1) * 0.5 * 10;
			} else {
				mouthOpen += (0 - mouthOpen) * 0.2;
			}

			// 부유 애니메이션 (Floating / Bobbing)
			const floatSpeed = botState === 'sleepy' ? 1.2 : botState === 'happy' ? 3.5 : 2.0;
			const floatAmp = botState === 'sleepy' ? 2 : botState === 'happy' ? 6 : 4.5;
			const floatY = Math.sin(elapsed * floatSpeed) * floatAmp;

			// 캔버스 초기화 (완전 투명)
			ctx.clearRect(0, 0, size, size);

			const cx = size / 2;
			// 안테나가 없으므로 캔버스 정중앙에 완벽하게 정렬
			const cy = size / 2 + floatY;

			ctx.save();
			// 전체 봇 중심 이동 및 회전
			ctx.translate(cx, cy);
			ctx.rotate(headTilt);

			// 완전한 원형 얼굴 반지름 (캔버스에 안정감 있게 꽉 차는 밸런스)
			const R = size * 0.35;

			// 1. 바디 및 유체 물결(Fluid Wave) 렌더링
			if (showBody && bodyColor !== 'transparent') {
				ctx.save();

				const hv = Math.max(0, Math.min(hoverSpring.x, 1.2));
				initCirclePoints(R);

				// 세라믹 화이트 상하 그라데이션
				const bodyGrad = ctx.createLinearGradient(0, -R, 0, R);
				if (bodyColor === '#ffffff') {
					bodyGrad.addColorStop(0, '#ffffff');
					bodyGrad.addColorStop(1, '#f5f5f7');
				} else {
					bodyGrad.addColorStop(0, bodyColor);
					bodyGrad.addColorStop(1, bodyColor);
				}

				// 마우스 호버 시: FdWave 기반 다층 유체 물결 레이어 렌더링
				if (hv > 0.01) {
					const wl = 48;

					// [물결 레이어 2 - 가장 바깥 겹]
					const grow2 = 7 * hv;
					const amp2 = 4.2 * hv;
					const s2 = waveTime * 1.8;
					calcWaveShape(grow2, amp2, wl * 0.9, s2, 2);
					tracePoints(ctx);
					ctx.fillStyle = `rgba(255, 255, 255, ${0.28 * hv})`;
					ctx.shadowColor = 'rgba(255, 255, 255, 0.45)';
					ctx.shadowBlur = 14;
					ctx.fill();

					// [물결 레이어 1 - 중간 겹]
					const grow1 = 3.5 * hv;
					const amp1 = 3.0 * hv;
					const s1 = -waveTime * 2.2;
					calcWaveShape(grow1, amp1, wl, s1, 1);
					tracePoints(ctx);
					ctx.fillStyle = `rgba(255, 255, 255, ${0.48 * hv})`;
					ctx.shadowColor = 'rgba(255, 255, 255, 0.55)';
					ctx.shadowBlur = 12;
					ctx.fill();

					// [본체 - 메인 바디 레이어 (살짝 쫀득하게 출렁임)]
					const amp0 = 1.6 * hv;
					const s0 = waveTime * 1.3;
					calcWaveShape(0, amp0, wl * 1.1, s0, 0);
					tracePoints(ctx);

					// 은은한 화이트 앰비언트 글로우
					const glowPulse = (Math.sin(elapsed * 2.4) + 1) * 0.5 * 6;
					ctx.shadowColor = 'rgba(255, 255, 255, 0.65)';
					ctx.shadowBlur = 18 + glowPulse;
					ctx.fillStyle = bodyGrad;
					ctx.fill();

					// 바디 테두리
					ctx.shadowColor = 'rgba(255, 255, 255, 0.35)';
					ctx.shadowBlur = 6;
					ctx.strokeStyle = borderColor;
					ctx.lineWidth = 1.2;
					ctx.stroke();
				} else {
					// 평상시: 매끄러운 완벽한 원형 바디
					const glowPulse = (Math.sin(elapsed * 2.4) + 1) * 0.5 * 6;
					ctx.shadowColor = 'rgba(255, 255, 255, 0.55)';
					ctx.shadowBlur = 16 + glowPulse;
					ctx.shadowOffsetY = 0;

					ctx.beginPath();
					ctx.arc(0, 0, R, 0, Math.PI * 2);
					ctx.fillStyle = bodyGrad;
					ctx.fill();

					ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
					ctx.shadowBlur = 6;
					ctx.strokeStyle = borderColor;
					ctx.lineWidth = 1.2;
					ctx.stroke();
				}

				// 원형 상단 미세 글래스 하이라이트 (시선에 반응하는 3D 시차 적용)
				const hlX = currentLookX * 0.35;
				const hlY = -R * 0.35 + currentLookY * 0.25;
				ctx.beginPath();
				ctx.ellipse(hlX, hlY, R * 0.72, R * 0.42, currentLookX * 0.02, 0, Math.PI * 2);
				const grad = ctx.createLinearGradient(hlX, hlY - R * 0.4, hlX, hlY + R * 0.4);
				grad.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
				grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
				ctx.fillStyle = grad;
				ctx.fill();
				ctx.restore();
			}

			// 2. 머리 위 오른쪽 사선 막대기 안테나 (마우스 시선에 3D로 연동되는 미니멀 안테나)
			if (showAntenna) {
				ctx.save();

				// [3D 패럴랙스 1] 머리가 구체처럼 회전하듯 안테나 마운트 위치가 시선을 따라 이동
				const stemStartX = R * 0.32 + currentLookX * 0.52;
				const stemStartY = -R * 0.92 + currentLookY * 0.32;

				// [3D 패럴랙스 2] 시선 방향으로 안테나 기둥이 살짝 끄덕이며 입체적인 각도 형성
				const maxRadius = size * 0.085;
				const lookTiltX = (currentLookX / maxRadius) * 0.16; // 좌우 시선 기울기
				const lookTiltY = (currentLookY / maxRadius) * 0.08; // 상하 시선 끄덕임

				const antennaWiggle =
					botState === 'thinking'
						? Math.sin(elapsed * 7) * 0.18
						: botState === 'talking'
							? Math.sin(elapsed * 12) * 0.12
							: Math.sin(elapsed * 2.5) * 0.04;

				ctx.translate(stemStartX, stemStartY);
				// 기본 오른쪽 사선 각도(약 24도) + 3D 시선 반응 + 모션 흔들림
				ctx.rotate(0.42 + lookTiltX + lookTiltY + antennaWiggle);

				const stemLen = size * 0.24; // 기둥 길이
				const stemThickness = Math.max(size * 0.038, 3.6); // 볼드한 굵기

				// 은은하게 빛나는 하얀색 안테나 스타일 (White Ambient Glow)
				ctx.strokeStyle = '#ffffff';
				ctx.fillStyle = '#ffffff';
				ctx.shadowColor = 'rgba(255, 255, 255, 0.65)';
				ctx.shadowBlur = 10;
				ctx.shadowOffsetY = 0;
				ctx.lineWidth = stemThickness;
				ctx.lineCap = 'round';
				ctx.lineJoin = 'round';

				// (1) 오른쪽 사선 막대기 안테나 (라운드 캡 마감)
				ctx.beginPath();
				ctx.moveTo(0, 0);
				ctx.lineTo(0, -stemLen);
				ctx.stroke();

				ctx.restore();
			}

			// 3. 눈 (Eyes) - 눈 크기를 키우고, 눈 사이 간격을 좁힌 귀여운 황금 비율
			ctx.save();
			// 시선 이동 좌표
			ctx.translate(currentLookX, currentLookY);

			const eyeSpacing = R * 0.28; // 눈 사이 간격 대폭 좁힘 (오밀조밀 귀여움)
			const eyeW = R * 0.32; // 눈 너비 확대
			const eyeH = R * 0.62; // 눈 높이 확대

			ctx.fillStyle = color;
			ctx.strokeStyle = color;
			ctx.shadowColor = 'transparent';

			if (botState === 'happy') {
				// 웃는 눈 (^ ^)
				drawHappyEye(ctx, -eyeSpacing, -2, eyeW * 1.8, 3.8);
				drawHappyEye(ctx, eyeSpacing, -2, eyeW * 1.8, 3.8);
			} else if (botState === 'sleepy') {
				// 졸린 눈 (- -)
				drawCapsule(ctx, -eyeSpacing, 0, eyeW * 1.1, eyeH, 0.12);
				drawCapsule(ctx, eyeSpacing, 0, eyeW * 1.1, eyeH, 0.12);
			} else {
				// 평상시 / 생각 중 / 말할 때 (빛 포인트 없는 깔끔한 솔리드 블랙 캡슐 + 유기적 탄성 보간)
				drawCapsule(ctx, -eyeSpacing, 0, eyeW, eyeH, eyeScaleYLeft, eyeScaleXLeft);
				drawCapsule(ctx, eyeSpacing, 0, eyeW, eyeH, eyeScaleYRight, eyeScaleXRight);
			}

			// 4. 입 (Mouth) - 말할 때 귀여운 미소
			if (mouthOpen > 0.5) {
				ctx.save();
				ctx.fillStyle = color;
				ctx.shadowColor = 'transparent';
				// 둥근 캡슐 입이 위아래로 뻐끔거림
				const mouthW = R * 0.36;
				roundRect(ctx, -mouthW / 2, eyeH * 0.65, mouthW, mouthOpen, mouthOpen / 2);
				ctx.fill();
				ctx.restore();
			}

			ctx.restore(); // 시선 translate 복원
			ctx.restore(); // 전체 봇 transform 복원

			animationFrameId = requestAnimationFrame(render);
		};

		animationFrameId = requestAnimationFrame(render);

		return () => {
			cancelAnimationFrame(animationFrameId);
			if (blinkTimer) clearTimeout(blinkTimer);
			window.removeEventListener('pointermove', handlePointerMove);
			window.removeEventListener('pointerleave', handlePointerLeave);
			observer.disconnect();
		};
	});
</script>

<div
	bind:this={containerEl}
	class="bot-container {className}"
	style="width: {size}px; height: {size}px;"
>
	<canvas bind:this={canvas} class="bot-canvas" style="width: {size}px; height: {size}px;"></canvas>
</div>

<style>
	.bot-container {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		user-select: none;
		touch-action: none;
	}

	.bot-canvas {
		display: block;
		background: transparent;
	}
</style>
