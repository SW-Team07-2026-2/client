import type {
	DetailMorphSeed,
	DetailPhase,
	DetailRect
} from '#lib/common/logic/detailOverlayState.svelte';
import { prefersReducedMotion } from '#lib/common/type/spring';

export const DETAIL_MORPH_DURATION_MS = 400;
export const DETAIL_MORPH_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

export interface DetailTargetBox {
	left: number;
	top: number;
	width: number;
	height: number;
	borderRadius: string;
}

export interface DetailMorphTargets {
	frameEl: HTMLElement;
	contentEl: HTMLElement | null;
	seedEl: HTMLElement | null;
	backdropEl?: HTMLElement | null;
	targetTop: number;
	targetBox?: DetailTargetBox;
	seed: DetailMorphSeed | null;
}

function resolveTargetBox(targets: DetailMorphTargets): DetailTargetBox {
	if (targets.targetBox) return targets.targetBox;
	return {
		left: 0,
		top: targets.targetTop,
		width: window.innerWidth,
		height: Math.max(1, window.innerHeight - targets.targetTop),
		borderRadius: '0px'
	};
}

function resolveSeedRadius(seed: DetailMorphSeed | null): string {
	if (seed?.shape === 'circle') return '999px';
	return `${seed?.shapeRadius ?? 18}px`;
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
			duration: Math.round(DETAIL_MORPH_DURATION_MS * 0.8),
			easing: DETAIL_MORPH_EASING,
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
			duration: Math.round(DETAIL_MORPH_DURATION_MS * 0.85),
			easing: DETAIL_MORPH_EASING,
			fill: 'none'
		});
	}

	el.style.opacity = '';
	return null;
}

/**
 * PC · 모바일 공통 아이템 -> 상세 프레임 확장 모핑 애니메이션
 */
export function runDetailExpandAnimation(
	targets: DetailMorphTargets,
	onFinish: () => void
): Animation[] {
	const origin = targets.seed?.originRect ?? null;
	if (!origin || prefersReducedMotion() || typeof window === 'undefined') {
		onFinish();
		return [];
	}

	const anims: Animation[] = [];
	const box = resolveTargetBox(targets);
	const seedRadius = resolveSeedRadius(targets.seed);

	const frameAnim = targets.frameEl.animate(
		[
			{
				left: `${origin.left}px`,
				top: `${origin.top}px`,
				width: `${origin.width}px`,
				height: `${origin.height}px`,
				borderRadius: seedRadius,
				opacity: 0.96
			},
			{
				left: `${box.left}px`,
				top: `${box.top}px`,
				width: `${box.width}px`,
				height: `${box.height}px`,
				borderRadius: box.borderRadius,
				opacity: 1
			}
		],
		{
			duration: DETAIL_MORPH_DURATION_MS,
			easing: DETAIL_MORPH_EASING,
			fill: 'none'
		}
	);
	anims.push(frameAnim);

	if (targets.backdropEl) {
		const backdropAnim = targets.backdropEl.animate([{ opacity: 0 }, { opacity: 1 }], {
			duration: Math.round(DETAIL_MORPH_DURATION_MS * 0.75),
			easing: 'ease-out',
			fill: 'backwards'
		});
		anims.push(backdropAnim);
	}

	if (targets.contentEl) {
		const contentAnim = targets.contentEl.animate(
			[
				{ opacity: 0, transform: 'translate3d(0, 14px, 0)' },
				{ opacity: 1, transform: 'translate3d(0, 0, 0)' }
			],
			{
				duration: Math.round(DETAIL_MORPH_DURATION_MS * 0.85),
				delay: 70,
				easing: DETAIL_MORPH_EASING,
				fill: 'backwards'
			}
		);
		anims.push(contentAnim);
	}

	if (targets.seedEl) {
		const seedAnim = targets.seedEl.animate([{ opacity: 1 }, { opacity: 0 }], {
			duration: Math.round(DETAIL_MORPH_DURATION_MS * 0.55),
			easing: 'ease-out',
			fill: 'forwards'
		});
		anims.push(seedAnim);
	}

	frameAnim.onfinish = () => {
		onFinish();
	};

	return anims;
}

/**
 * PC · 모바일 공통 상세 프레임 -> 아이템 축소 모핑 애니메이션
 * - 되돌아갈 아이템(returnRect)이 없는 경우(새로고침 · URL 직접 진입 등)
 *   페이지 전체가 아래로 내려가며 사라지는 폴백 애니메이션을 실행합니다.
 */
export function runDetailCloseAnimation(
	targets: DetailMorphTargets & { returnRect: DetailRect | null },
	onFinish: () => void
): Animation[] {
	if (prefersReducedMotion() || typeof window === 'undefined') {
		onFinish();
		return [];
	}

	const returnRect = targets.returnRect;
	if (!returnRect) {
		const anims: Animation[] = [];
		const slideDownAnim = targets.frameEl.animate(
			[
				{ transform: 'translate3d(0, 0, 0)', opacity: 1 },
				{ transform: 'translate3d(0, 100%, 0)', opacity: 0.25 }
			],
			{
				duration: 360,
				easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
				fill: 'forwards'
			}
		);
		anims.push(slideDownAnim);

		if (targets.backdropEl) {
			const backdropAnim = targets.backdropEl.animate([{ opacity: 1 }, { opacity: 0 }], {
				duration: 280,
				easing: 'ease-out',
				fill: 'forwards'
			});
			anims.push(backdropAnim);
		}

		slideDownAnim.onfinish = () => {
			onFinish();
		};
		return anims;
	}

	const anims: Animation[] = [];
	const box = resolveTargetBox(targets);
	const seedRadius = resolveSeedRadius(targets.seed);

	const frameAnim = targets.frameEl.animate(
		[
			{
				left: `${box.left}px`,
				top: `${box.top}px`,
				width: `${box.width}px`,
				height: `${box.height}px`,
				borderRadius: box.borderRadius,
				opacity: 1
			},
			{
				left: `${returnRect.left}px`,
				top: `${returnRect.top}px`,
				width: `${returnRect.width}px`,
				height: `${returnRect.height}px`,
				borderRadius: seedRadius,
				opacity: 0.92
			}
		],
		{
			duration: Math.round(DETAIL_MORPH_DURATION_MS * 0.9),
			easing: DETAIL_MORPH_EASING,
			fill: 'forwards'
		}
	);
	anims.push(frameAnim);

	if (targets.backdropEl) {
		const backdropAnim = targets.backdropEl.animate([{ opacity: 1 }, { opacity: 0 }], {
			duration: Math.round(DETAIL_MORPH_DURATION_MS * 0.65),
			easing: 'ease-out',
			fill: 'forwards'
		});
		anims.push(backdropAnim);
	}

	if (targets.contentEl) {
		const contentAnim = targets.contentEl.animate([{ opacity: 1 }, { opacity: 0 }], {
			duration: Math.round(DETAIL_MORPH_DURATION_MS * 0.4),
			easing: 'ease-out',
			fill: 'forwards'
		});
		anims.push(contentAnim);
	}

	if (targets.seedEl) {
		const seedAnim = targets.seedEl.animate([{ opacity: 0 }, { opacity: 1 }], {
			duration: Math.round(DETAIL_MORPH_DURATION_MS * 0.55),
			easing: 'ease-in',
			fill: 'forwards'
		});
		anims.push(seedAnim);
	}

	frameAnim.onfinish = () => {
		onFinish();
	};

	return anims;
}
