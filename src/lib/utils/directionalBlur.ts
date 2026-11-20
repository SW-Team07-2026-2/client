import { cubicOut } from 'svelte/easing';
import type { TransitionConfig } from 'svelte/transition';
import { prefersReducedMotion } from '#lib/fluid/spring';

export type SlideDirection = 1 | -1;

/**
 * 좌우 블러 슬라이드 전환 공통 모션 상수.
 * JS(rAF/Svelte transition)와 layout.css의 `--dir-blur-*` CSS 변수와 값을 일치시킵니다.
 */
export const DIRECTIONAL_BLUR_MOTION = {
	distance: 38,
	blur: 6,
	enterDuration: 420,
	exitDuration: 320,
	easeCss: 'cubic-bezier(0.22, 1, 0.36, 1)'
} as const;

export interface DirectionalBlurParams {
	/** 1: 다음(오른쪽에서 등장, 왼쪽으로 퇴장), -1: 이전(왼쪽에서 등장, 오른쪽으로 퇴장) */
	dir?: SlideDirection;
	/** 수평 이동 거리 (px) */
	distance?: number;
	/** 블러 강도 (px) */
	blur?: number;
	/** 전환 시간 (ms) */
	duration?: number;
	/** 이징 함수 */
	easing?: (t: number) => number;
}

/** 이전/다음 인덱스 비교로 슬라이드 방향(1 | -1)을 계산합니다. */
export function resolveSlideDirection(prevIndex: number, nextIndex: number): SlideDirection {
	return nextIndex >= prevIndex ? 1 : -1;
}

/** 표준 3차 감속 이징 함수 (0 -> 1) */
export function easeOutCubic(t: number): number {
	const inv = 1 - t;
	return 1 - inv * inv * inv;
}

/**
 * Svelte `in:` 트랜지션 — 진행 방향에서 블러를 풀며 제자리로 슬라이드 인.
 * `out:directionalBlurOut`과 함께 쓸 때는 부모를 `display: grid` + 자식 `grid-area: 1 / 1`로 겹치면 자연스럽습니다.
 */
export function directionalBlurIn(
	node: Element,
	params: DirectionalBlurParams = {}
): TransitionConfig {
	if (prefersReducedMotion()) return { duration: 0 };

	const {
		dir = 1,
		distance = DIRECTIONAL_BLUR_MOTION.distance,
		blur = DIRECTIONAL_BLUR_MOTION.blur,
		duration = DIRECTIONAL_BLUR_MOTION.enterDuration,
		easing = cubicOut
	} = params;

	const el = node as HTMLElement;
	el.style.willChange = 'transform, opacity, filter';

	return {
		duration,
		easing,
		css: (t, u) =>
			`opacity: ${t.toFixed(4)}; filter: ${u > 0.008 ? `blur(${(u * blur).toFixed(2)}px)` : 'none'}; transform: translate3d(${(u * dir * distance).toFixed(2)}px, 0, 0);`,
		tick: (t) => {
			if (t === 1) el.style.willChange = '';
		}
	};
}

/**
 * Svelte `out:` 트랜지션 — 진행 반대 방향으로 블러되며 슬라이드 아웃.
 */
export function directionalBlurOut(
	node: Element,
	params: DirectionalBlurParams = {}
): TransitionConfig {
	if (prefersReducedMotion()) return { duration: 0 };

	const {
		dir = 1,
		distance = DIRECTIONAL_BLUR_MOTION.distance,
		blur = DIRECTIONAL_BLUR_MOTION.blur,
		duration = DIRECTIONAL_BLUR_MOTION.exitDuration,
		easing = cubicOut
	} = params;

	const el = node as HTMLElement;
	el.style.willChange = 'transform, opacity, filter';
	el.style.pointerEvents = 'none';

	return {
		duration,
		easing,
		css: (t, u) =>
			`opacity: ${t.toFixed(4)}; filter: ${u > 0.008 ? `blur(${(u * blur).toFixed(2)}px)` : 'none'}; transform: translate3d(${(-u * dir * distance).toFixed(2)}px, 0, 0);`
	};
}
