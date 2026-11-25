/**
 * 전역 정밀 디바이스 감지 스토어 (Svelte 5 Runes)
 * - 화면 폭(width)이 아니라 기기/OS 정보(userAgentData, User-Agent, iPadOS 터치 판별)와
 *   주 입력 포인터((pointer: coarse) && (hover: none))를 결합해 휴대폰·태블릿과 PC·노트북을 구분합니다.
 * - PC/노트북은 터치스크린 지원 여부나 브라우저 창 크기와 무관하게 항상 PC(false)로 판별하며,
 *   휴대폰·태블릿(개발자 도구 기기 에뮬레이션 포함)은 해상도와 무관하게 모바일(true)로 판별합니다.
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

// 화면 크기 기준 상수 (breakpoint 보조 유틸용)
const BREAKPOINTS = {
	sm: 640,
	md: 768,
	lg: 1024,
	xl: 1280
} as const;

type Breakpoint = 'sm' | 'md' | 'lg' | 'xl';

interface NavigatorUADataLike {
	mobile?: boolean;
	platform?: string;
}

class MobileDetector {
	#width = $state<number>(1200); // SSR 기본값 (데스크톱)
	#isTouch = $state<boolean>(false);
	#isMobileDevice = $state<boolean>(false);

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
	 * 기기 기반 모바일(휴대폰·태블릿) 판별 결과:
	 * - 화면 폭과 무관하게 휴대폰·태블릿(및 DevTools 기기 에뮬레이션)은 true
	 * - PC·노트북(터치스크린 포함)은 창을 좁혀도 false
	 */
	get current(): boolean {
		return this.#isMobileDevice;
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

	#syncDeviceState(): void {
		const nav = typeof navigator !== 'undefined' ? navigator : undefined;
		const ua = nav?.userAgent ?? '';
		const uaData = (nav as (Navigator & { userAgentData?: NavigatorUADataLike }) | undefined)
			?.userAgentData;

		const hasTouchPoints = (nav?.maxTouchPoints ?? 0) > 0;
		const isCoarsePrimary = window.matchMedia('(pointer: coarse)').matches;
		const hasNoHover = window.matchMedia('(hover: none)').matches;
		const hasTouchEvent = 'ontouchstart' in window;

		this.#width = window.innerWidth;
		this.#isTouch = hasTouchPoints || isCoarsePrimary;

		// 1. User-Agent Client Hints (Chromium/Android/DevTools)
		const chPlatform = uaData?.platform?.toLowerCase() ?? '';
		if (uaData?.mobile === true || chPlatform === 'android' || chPlatform === 'ios') {
			this.#isMobileDevice = true;
			return;
		}

		// 2. 휴대폰 / 태블릿 User-Agent 문자열 (Android 폰·태블릿, iPhone, iPad, iPod 등)
		if (
			/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Tablet|Silk|Kindle|PlayBook/i.test(
				ua
			)
		) {
			this.#isMobileDevice = true;
			return;
		}

		// 3. iPadOS 13+ (데스크톱 Mac UA로 내려오지만 멀티터치 지원; Mac은 maxTouchPoints 0)
		if (/Macintosh/i.test(ua) && (nav?.maxTouchPoints ?? 0) > 1) {
			this.#isMobileDevice = true;
			return;
		}

		// 4. DevTools 기기 에뮬레이터 등 주 포인터가 터치 전용(coarse + hover: none)인 경우
		//    (터치스크린 PC/노트북은 주 포인터가 pointer: fine & hover: hover이므로 PC로 유지)
		if (isCoarsePrimary && hasNoHover && (hasTouchPoints || hasTouchEvent)) {
			this.#isMobileDevice = true;
			return;
		}

		this.#isMobileDevice = false;
	}

	#init(): void {
		this.#syncDeviceState();

		const update = () => {
			this.#syncDeviceState();
		};

		// DevTools 기기 툴바 토글·회전·창 크기 변화 시 기기 특성까지 함께 실시간 재판별
		const coarseMql = window.matchMedia('(pointer: coarse)');
		const hoverMql = window.matchMedia('(hover: none)');
		coarseMql.addEventListener('change', update);
		hoverMql.addEventListener('change', update);
		window.addEventListener('resize', update, { passive: true });
		window.addEventListener('orientationchange', update, { passive: true });
	}
}

const detector = new MobileDetector();

/**
 * 함수로도 호출할 수 있고(`isMobile()`), 객체 속성(`isMobile.current`)으로도 접근 가능한 하이브리드 인터페이스
 */
interface IsMobileAccessor {
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

