/** 1D 감쇠 조화 진동자 스프링 상태 */
export interface SpringState {
	x: number;
	v: number;
	t: number;
	k: number;
	c: number;
}

/** 스프링 상태 객체 생성 */
export function createSpring(x = 0, k = 300, c = 26): SpringState {
	return { x, v: 0, t: x, k, c };
}

/** 단일 서브스텝 스프링 적분 */
export function stepSpring(s: SpringState, dt: number): void {
	const a = -s.k * (s.x - s.t) - s.c * s.v;
	s.v += a * dt;
	s.x += s.v * dt;
}

/** OS 모션 감소 설정 여부 조회 */
export function prefersReducedMotion(): boolean {
	return (
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
	);
}

/**
 * 4-substep 고정밀 스프링 rAF 루프 드라이버.
 * 프레임당 추가 배열/객체 할당 없이 등록된 스프링을 갱신합니다.
 */
export function createSpringLoop(options: {
	springs: SpringState[];
	isSettled: () => boolean;
	onFrame: (settled: boolean) => void;
	onSnap?: () => void;
}) {
	const { springs, isSettled, onFrame, onSnap } = options;
	let rafId = 0;
	let lastTime = 0;

	function stop() {
		if (rafId) {
			cancelAnimationFrame(rafId);
			rafId = 0;
		}
	}

	function snapAll() {
		for (let i = 0; i < springs.length; i++) {
			springs[i].x = springs[i].t;
			springs[i].v = 0;
		}
	}

	function tick(now: number) {
		rafId = 0;
		const dt = Math.min((now - lastTime) / 1000, 1 / 30) || 1 / 60;
		lastTime = now;

		const sub = 4;
		const subDt = dt / sub;
		for (let i = 0; i < sub; i++) {
			for (let j = 0; j < springs.length; j++) {
				stepSpring(springs[j], subDt);
			}
		}

		if (isSettled()) {
			snapAll();
			onFrame(true);
			return;
		}

		onFrame(false);
		rafId = requestAnimationFrame(tick);
	}

	function wake() {
		if (typeof window === 'undefined') return;
		if (prefersReducedMotion()) {
			stop();
			snapAll();
			if (onSnap) {
				onSnap();
			} else {
				onFrame(true);
			}
			return;
		}
		if (rafId) return;
		lastTime = performance.now();
		rafId = requestAnimationFrame(tick);
	}

	return { wake, stop };
}
