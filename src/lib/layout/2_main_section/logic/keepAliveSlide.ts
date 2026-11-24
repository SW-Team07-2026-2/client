import { tick } from 'svelte';
import { prefersReducedMotion } from '#lib/common/type/spring';

export type SlideDirection = 1 | -1;

/** 좌우 슬라이드 전환 공통 모션 상수 */
export const SLIDE_MOTION = {
	distance: 100,
	enterDuration: 480,
	exitDuration: 480,
	easeCss: 'cubic-bezier(0.32, 0.72, 0, 1)'
} as const;

/** 이전/다음 인덱스 비교로 슬라이드 방향(1 | -1)을 계산합니다. */
export function resolveSlideDirection(prevIndex: number, nextIndex: number): SlideDirection {
	return nextIndex >= prevIndex ? 1 : -1;
}

export interface KeepAliveSlideParams {
	elementsOut: (HTMLElement | undefined)[];
	elementsIn: (HTMLElement | undefined)[];
	dir: SlideDirection;
	startOffsetPx?: number;
	durationOverrideMs?: number;
	onStateChange: (sliding: boolean) => void;
	onFinish: () => void;
}

function createSlideAnim(
	el: HTMLElement | undefined,
	kind: 'in' | 'out',
	dir: SlideDirection,
	startOffsetPx: number,
	durationOverrideMs: number
): Animation | null {
	if (!el) return null;
	el.getAnimations().forEach((a) => a.cancel());

	const offsetX = `${(kind === 'in' ? dir : -dir) * SLIDE_MOTION.distance}%`;
	const startTransform =
		startOffsetPx !== 0
			? kind === 'in'
				? `translate3d(calc(${dir * SLIDE_MOTION.distance}% + ${startOffsetPx.toFixed(1)}px), 0, 0)`
				: `translate3d(${startOffsetPx.toFixed(1)}px, 0, 0)`
			: kind === 'in'
				? `translate3d(${offsetX}, 0, 0)`
				: 'translate3d(0, 0, 0)';
	const endTransform =
		kind === 'in' ? 'translate3d(0, 0, 0)' : `translate3d(${offsetX}, 0, 0)`;

	const anim = el.animate([{ transform: startTransform }, { transform: endTransform }], {
		duration:
			durationOverrideMs > 0
				? durationOverrideMs
				: kind === 'in'
					? SLIDE_MOTION.enterDuration
					: SLIDE_MOTION.exitDuration,
		easing:
			startOffsetPx !== 0 ? 'cubic-bezier(0.22, 1, 0.36, 1)' : SLIDE_MOTION.easeCss,
		fill: 'both'
	});
	el.style.transform = '';
	el.style.willChange = '';
	anim.pause();
	return anim;
}

/**
 * Keep-Alive 카테고리 패널 및 PC 상세 오버레이를 동일 VSync 프레임으로 동기화해 슬라이드 전환합니다.
 */
export function createKeepAliveSlideController() {
	let activeToken = 0;
	let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

	function finish(
		token: number,
		allEls: (HTMLElement | undefined)[],
		onStateChange: (sliding: boolean) => void,
		onFinish: () => void
	) {
		if (token !== activeToken) return;
		clearTimeout(fallbackTimer);
		onStateChange(false);
		onFinish();
		void tick().then(() => {
			if (token !== activeToken) return;
			for (const el of allEls) {
				if (!el) continue;
				el.getAnimations().forEach((a) => a.cancel());
				el.style.transform = '';
				el.style.willChange = '';
			}
		});
	}

	function start(params: KeepAliveSlideParams) {
		clearTimeout(fallbackTimer);
		const token = ++activeToken;
		const {
			elementsOut,
			elementsIn,
			dir,
			startOffsetPx = 0,
			durationOverrideMs = 0,
			onStateChange,
			onFinish
		} = params;

		const allEls = [...elementsOut, ...elementsIn].filter((el): el is HTMLElement => Boolean(el));
		if (prefersReducedMotion() || allEls.length === 0) {
			finish(token, allEls, onStateChange, onFinish);
			return;
		}

		onStateChange(true);
		const anims = [
			...elementsOut.map((el) => createSlideAnim(el, 'out', dir, startOffsetPx, durationOverrideMs)),
			...elementsIn.map((el) => createSlideAnim(el, 'in', dir, startOffsetPx, durationOverrideMs))
		].filter((a): a is Animation => a !== null);

		if (anims.length === 0) {
			finish(token, allEls, onStateChange, onFinish);
			return;
		}

		const fallbackMs =
			(durationOverrideMs > 0
				? durationOverrideMs
				: Math.max(SLIDE_MOTION.enterDuration, SLIDE_MOTION.exitDuration)) +
			120;
		fallbackTimer = setTimeout(() => {
			finish(token, allEls, onStateChange, onFinish);
		}, fallbackMs);

		void Promise.all(anims.map((a) => a.ready))
			.then(() => {
				if (token !== activeToken) {
					for (const a of anims) a.cancel();
					return;
				}
				const syncStart =
					typeof document !== 'undefined' ? (document.timeline?.currentTime ?? null) : null;
				for (const a of anims) {
					a.play();
					if (syncStart !== null) {
						a.startTime = syncStart;
					}
				}
				void Promise.allSettled(anims.map((a) => a.finished)).then(() => {
					finish(token, allEls, onStateChange, onFinish);
				});
			})
			.catch(() => {
				finish(token, allEls, onStateChange, onFinish);
			});
	}

	function cancel(onStateChange?: (sliding: boolean) => void) {
		activeToken += 1;
		clearTimeout(fallbackTimer);
		onStateChange?.(false);
	}

	return { start, cancel };
}
