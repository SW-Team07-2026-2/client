import type { DetailPhase } from '#lib/common/logic/detailOverlayState.svelte';
import { prefersReducedMotion } from '#lib/common/type/spring';

export const DETAIL_SLIDE_UP_MS = 380;
export const DETAIL_SLIDE_DOWN_MS = 340;
export const DETAIL_SLIDE_UP_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
export const DETAIL_SLIDE_DOWN_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';

export interface DetailMotionSession {
	cancel: () => void;
}

export interface DetailSlideMotionParams {
	phase: DetailPhase;
	onExpandFinish: () => void;
	onCloseFinish: () => void;
}

/**
 * 상세 열림(expanding) · 안착(open) · 닫힘(closing)에 맞춰 뒤쪽 목록 래퍼의 투명도를 전환합니다.
 */
export function syncDetailListFade(
	el: HTMLElement | null,
	phase: DetailPhase,
	prevAnim: Animation | null
): Animation | null {
	prevAnim?.cancel();
	if (!el) return null;

	if (prefersReducedMotion()) {
		el.style.opacity = phase === 'open' || phase === 'expanding' ? '0' : '';
		return null;
	}

	if (phase === 'expanding') {
		return el.animate([{ opacity: 1 }, { opacity: 0 }], {
			duration: Math.round(DETAIL_SLIDE_UP_MS * 0.8),
			easing: DETAIL_SLIDE_UP_EASING,
			fill: 'forwards'
		});
	}

	if (phase === 'open') {
		el.style.opacity = '0';
		return null;
	}

	if (phase === 'closing') {
		el.style.opacity = '';
		return el.animate([{ opacity: 0 }, { opacity: 1 }], {
			duration: Math.round(DETAIL_SLIDE_DOWN_MS * 0.9),
			easing: DETAIL_SLIDE_DOWN_EASING,
			fill: 'none'
		});
	}

	el.style.opacity = '';
	return null;
}

/**
 * PC · 모바일 공통 상세 프레임 열기 (GPU transform 아래 -> 위 슬라이드 업)
 */
export function runDetailSlideUp(el: HTMLElement, onFinish: () => void): DetailMotionSession {
	if (prefersReducedMotion() || typeof window === 'undefined') {
		onFinish();
		return { cancel: () => {} };
	}

	const anim = el.animate(
		[
			{ transform: 'translate3d(0, 100%, 0)', opacity: 0.4 },
			{ transform: 'translate3d(0, 0, 0)', opacity: 1 }
		],
		{
			duration: DETAIL_SLIDE_UP_MS,
			easing: DETAIL_SLIDE_UP_EASING,
			fill: 'none'
		}
	);

	anim.onfinish = () => onFinish();

	return {
		cancel: () => anim.cancel()
	};
}

/**
 * PC · 모바일 공통 상세 프레임 닫기 (GPU transform 위 -> 아래 슬라이드 다운)
 */
export function runDetailSlideDown(el: HTMLElement, onFinish: () => void): DetailMotionSession {
	if (prefersReducedMotion() || typeof window === 'undefined') {
		onFinish();
		return { cancel: () => {} };
	}

	const anim = el.animate(
		[
			{ transform: 'translate3d(0, 0, 0)', opacity: 1 },
			{ transform: 'translate3d(0, 100%, 0)', opacity: 0.25 }
		],
		{
			duration: DETAIL_SLIDE_DOWN_MS,
			easing: DETAIL_SLIDE_DOWN_EASING,
			fill: 'forwards'
		}
	);

	anim.onfinish = () => onFinish();

	return {
		cancel: () => anim.cancel()
	};
}

/**
 * PC · 모바일 상세 프레임 공용 Svelte action.
 * `phase`가 `expanding`/`closing`으로 바뀔 때 GPU 슬라이드 업/다운을 실행하고 해제 시 정리합니다.
 */
export function detailSlideMotion(node: HTMLElement, initialParams: DetailSlideMotionParams) {
	let activeSession: DetailMotionSession | null = null;
	let lastPhase: DetailPhase | null = null;

	function cancel() {
		activeSession?.cancel();
		activeSession = null;
	}

	function apply(params: DetailSlideMotionParams) {
		if (params.phase === lastPhase) return;
		lastPhase = params.phase;

		if (params.phase === 'expanding') {
			cancel();
			activeSession = runDetailSlideUp(node, () => {
				activeSession = null;
				params.onExpandFinish();
			});
			return;
		}

		if (params.phase === 'closing') {
			cancel();
			activeSession = runDetailSlideDown(node, () => {
				activeSession = null;
				params.onCloseFinish();
			});
			return;
		}

		cancel();
	}

	apply(initialParams);

	return {
		update(nextParams: DetailSlideMotionParams) {
			apply(nextParams);
		},
		destroy() {
			cancel();
		}
	};
}
