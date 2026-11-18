/**
 * 전역 정밀 디바이스 감지 스토어 (Svelte 5 Runes)
 * - 기준 폭(768px) 및 터치 포인터(maxTouchPoints, pointer: coarse), 모바일 User-Agent를 결합해 정밀 판별합니다.
 * - 컴포넌트마다 리사이즈 리스너를 중복 생성하지 않고 단일 싱글톤으로 전역 공유합니다.
 *
 * 사용 예시:
 *   import { isMobile } from '$lib/stores/isMobile.svelte';
 *   // 또는 import { isMobile } from '$lib/stores';
 *
 *   // 1) Svelte 5 프로퍼티 방식 (권장)
 *   {#if isMobile.current}
 *     <MobileComponent />
 *   {:else}
 *     <DesktopComponent />
 *   {/if}
 *
 *   // 2) 함수 호출 방식
 *   {#if isMobile()}
 *     ...
 *   {/if}
 *
 *   // 3) 보조 유틸
 *   isMobile.isDesktop   // 데스크톱 여부 (!isMobile.current)
 *   isMobile.isTouch     // 실제 터치 스크린 여부
 *   isMobile.width       // 현재 브라우저 폭(px)
 *   isMobile.breakpoint  // 'sm' | 'md' | 'lg' | 'xl'
 */

// 화면 크기 기준 상수
export const BREAKPOINTS = {
	sm: 640,
	md: 768, // 모바일 기준 (<= 768px)
	lg: 1024, // 태블릿-데스크톱 기준
	xl: 1280
} as const;

export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl';

class MobileDetector {
	#width = $state<number>(1200); // SSR 기본값 (데스크톱)
	#isTouch = $state<boolean>(false);
	#isMobileUserAgent = $state<boolean>(false);

	/** 현재 창 폭 (px) */
	get width(): number {
		return this.#width;
	}

	/** 실제 터치 포인터 지원 여부 */
	get isTouch(): boolean {
		return this.#isTouch;
	}

	/** 현재 브레이크포인트 ('sm' | 'md' | 'lg' | 'xl') */
	get breakpoint(): Breakpoint {
		const w = this.#width;
		if (w < BREAKPOINTS.sm) return 'sm';
		if (w <= BREAKPOINTS.md) return 'md';
		if (w <= BREAKPOINTS.lg) return 'lg';
		return 'xl';
	}

	/**
	 * 정밀 모바일 판별 결과:
	 * - 화면 폭이 768px 이하이거나,
	 * - 1024px 이하 태블릿 구간에서 터치 디바이스인 경우 모바일로 판별
	 */
	get current(): boolean {
		if (this.#width <= BREAKPOINTS.md) return true;
		if (this.#width <= BREAKPOINTS.lg && (this.#isTouch || this.#isMobileUserAgent)) return true;
		return false;
	}

	/** current의 별칭 */
	get value(): boolean {
		return this.current;
	}

	/** 데스크톱 여부 (!current) */
	get isDesktop(): boolean {
		return !this.current;
	}

	constructor() {
		if (typeof window !== 'undefined') {
			this.#init();
		}
	}

	#init(): void {
		// 1. 터치 및 디바이스 특성 정밀 감지
		const hasTouchPoints = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
		const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
		this.#isTouch = hasTouchPoints || coarsePointer;

		// 2. 모바일 User-Agent 보조 감지
		if (typeof navigator !== 'undefined') {
			this.#isMobileUserAgent =
				/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
		}

		// 3. 윈도우 폭 초기화
		this.#width = window.innerWidth;

		// 4. 반응형 동기화 (matchMedia change + passive resize)
		const mql = window.matchMedia(`(max-width: ${BREAKPOINTS.md}px)`);
		const update = () => {
			this.#width = window.innerWidth;
		};

		mql.addEventListener('change', update);
		window.addEventListener('resize', update, { passive: true });
	}
}

const detector = new MobileDetector();

/**
 * 함수로도 호출할 수 있고(`isMobile()`), 객체 속성(`isMobile.current`)으로도 접근 가능한 하이브리드 인터페이스
 */
export interface IsMobileAccessor {
	(): boolean;
	readonly current: boolean;
	readonly value: boolean;
	readonly isDesktop: boolean;
	readonly isTouch: boolean;
	readonly width: number;
	readonly breakpoint: Breakpoint;
}

function createIsMobileAccessor(): IsMobileAccessor {
	const fn = (() => detector.current) as IsMobileAccessor;

	Object.defineProperties(fn, {
		current: {
			get() {
				return detector.current;
			},
			enumerable: true
		},
		value: {
			get() {
				return detector.value;
			},
			enumerable: true
		},
		isDesktop: {
			get() {
				return detector.isDesktop;
			},
			enumerable: true
		},
		isTouch: {
			get() {
				return detector.isTouch;
			},
			enumerable: true
		},
		width: {
			get() {
				return detector.width;
			},
			enumerable: true
		},
		breakpoint: {
			get() {
				return detector.breakpoint;
			},
			enumerable: true
		}
	});

	return fn;
}

export const isMobile = createIsMobileAccessor();
export default isMobile;

