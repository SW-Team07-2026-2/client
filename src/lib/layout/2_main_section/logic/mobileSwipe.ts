import { tick } from 'svelte';
import { prefersReducedMotion } from '#lib/common/type/spring';
import type { SlideDirection } from './keepAliveSlide';

export interface MobileSwipeCallbacks<T extends string = string> {
	categories: readonly T[];
	canStart: () => boolean;
	getActiveCategory: () => T | null;
	getPaneEl: (cat: T) => HTMLElement | undefined;
	ensureMounted: (cat: T) => void;
	getPreviewHref: (cat: T) => string;
	getSavedScrollY: (pathname: string) => number;
	onSwipingChange: (swiping: boolean) => void;
	onPreviewChange: (cat: T | null, topOffset: number) => void;
	onCommit: (payload: {
		targetCat: T;
		targetHref: string;
		dir: SlideDirection;
		offsetPx: number;
		durationMs: number;
		originCat: T | null;
	}) => void;
}

function hasHorizontalScrollConflict(
	stageEl: HTMLElement,
	target: EventTarget | null,
	dx: number
): boolean {
	let node = target as HTMLElement | null;
	while (node && node !== stageEl) {
		if (node.hasAttribute('data-no-page-swipe')) return true;
		if (node.scrollWidth > node.clientWidth + 1) {
			const overflowX = getComputedStyle(node).overflowX;
			if (overflowX === 'auto' || overflowX === 'scroll') {
				if (dx > 0 && node.scrollLeft > 1) return true;
				if (dx < 0 && node.scrollLeft + node.clientWidth < node.scrollWidth - 1) return true;
			}
		}
		node = node.parentElement;
	}
	return false;
}

/**
 * 모바일 인접 카테고리 좌우 스와이프 제스처(미리보기·리바운드·커밋)를 스테이지에 바인딩합니다.
 */
export function attachMobileSwipe<T extends string = string>(
	stageEl: HTMLElement,
	cb: MobileSwipeCallbacks<T>
): () => void {
	const SWIPE_LOCK_THRESHOLD = 10;
	const COMMIT_DISTANCE_RATIO = 0.28;
	const COMMIT_VELOCITY_PX_MS = 0.35;
	const EDGE_RUBBER_MAX = 42;

	let tracking = false;
	let lockedAxis: 'x' | 'y' | null = null;
	let startX = 0;
	let startY = 0;
	let lastX = 0;
	let lastTime = 0;
	let velocityX = 0;
	let currentDragX = 0;
	let startScrollY = 0;
	let originCat: T | null = null;
	let originIdx = -1;
	let previewCat: T | null = null;
	let previewDir: SlideDirection = 1;
	let touchTarget: EventTarget | null = null;
	let reboundToken = 0;
	let activeReboundAnims: Animation[] = [];

	function clearPaneInline(cat: T | null) {
		if (!cat) return;
		const el = cb.getPaneEl(cat);
		if (el) {
			el.style.transform = '';
			el.style.willChange = '';
		}
	}

	function applyDragTransforms() {
		const activeEl = originCat ? cb.getPaneEl(originCat) : undefined;
		if (activeEl) {
			activeEl.style.willChange = 'transform';
			activeEl.style.transform = `translate3d(${currentDragX.toFixed(1)}px, 0, 0)`;
		}
		if (previewCat) {
			const targetCat = previewCat;
			const pEl = cb.getPaneEl(targetCat);
			const pTransform = `translate3d(calc(${previewDir * 100}% + ${currentDragX.toFixed(1)}px), 0, 0)`;
			if (pEl) {
				pEl.style.willChange = 'transform';
				pEl.style.transform = pTransform;
			} else {
				void tick().then(() => {
					const mountedEl = cb.getPaneEl(targetCat);
					if (mountedEl && tracking && previewCat === targetCat) {
						mountedEl.style.willChange = 'transform';
						mountedEl.style.transform = `translate3d(calc(${previewDir * 100}% + ${currentDragX.toFixed(1)}px), 0, 0)`;
					}
				});
			}
		}
	}

	function finishRebound(
		token: number,
		oCat: T | null,
		pCat: T | null
	) {
		if (token !== reboundToken) return;
		for (const a of activeReboundAnims) a.cancel();
		activeReboundAnims = [];
		clearPaneInline(oCat);
		clearPaneInline(pCat);
		cb.onPreviewChange(null, 0);
		cb.onSwipingChange(false);
	}

	function onTouchStart(e: TouchEvent) {
		if (e.touches.length !== 1 || !cb.canStart()) return;
		const activeCat = cb.getActiveCategory();
		if (!activeCat) return;

		if (activeReboundAnims.length > 0) {
			reboundToken += 1;
			for (const a of activeReboundAnims) a.cancel();
			activeReboundAnims = [];
			clearPaneInline(originCat);
			clearPaneInline(previewCat);
			cb.onPreviewChange(null, 0);
			cb.onSwipingChange(false);
		}

		const touch = e.touches[0];
		startX = touch.clientX;
		startY = touch.clientY;
		lastX = touch.clientX;
		lastTime = performance.now();
		velocityX = 0;
		currentDragX = 0;
		lockedAxis = null;
		tracking = true;
		startScrollY = Math.max(0, window.scrollY);
		originCat = activeCat;
		originIdx = cb.categories.indexOf(activeCat);
		previewCat = null;
		previewDir = 1;
		touchTarget = e.target;
	}

	function onTouchMove(e: TouchEvent) {
		if (!tracking) return;
		if (e.touches.length !== 1) {
			onTouchEndOrCancel(true);
			return;
		}

		const touch = e.touches[0];
		const dx = touch.clientX - startX;
		const dy = touch.clientY - startY;

		if (lockedAxis === null) {
			if (Math.abs(dx) < SWIPE_LOCK_THRESHOLD && Math.abs(dy) < SWIPE_LOCK_THRESHOLD) return;
			if (Math.abs(dy) >= Math.abs(dx) || hasHorizontalScrollConflict(stageEl, touchTarget, dx)) {
				lockedAxis = 'y';
				tracking = false;
				return;
			}
			lockedAxis = 'x';
			cb.onSwipingChange(true);
		}

		if (e.cancelable) {
			e.preventDefault();
		}

		const now = performance.now();
		const dt = now - lastTime;
		if (dt > 0) {
			const instV = (touch.clientX - lastX) / dt;
			velocityX = velocityX * 0.4 + instV * 0.6;
			lastX = touch.clientX;
			lastTime = now;
		}

		const dir: SlideDirection = dx < 0 ? 1 : -1;
		const nextIdx = originIdx + dir;
		const targetCat =
			nextIdx >= 0 && nextIdx < cb.categories.length ? cb.categories[nextIdx] : null;

		if (!targetCat) {
			if (previewCat) {
				clearPaneInline(previewCat);
				previewCat = null;
				cb.onPreviewChange(null, 0);
			}
			currentDragX = Math.sign(dx) * Math.min(EDGE_RUBBER_MAX, Math.abs(dx) * 0.25);
		} else {
			currentDragX = dx;
			previewDir = dir;
			if (targetCat !== previewCat) {
				if (previewCat) clearPaneInline(previewCat);
				cb.ensureMounted(targetCat);
				previewCat = targetCat;
				const previewHref = cb.getPreviewHref(targetCat);
				cb.onPreviewChange(targetCat, startScrollY - cb.getSavedScrollY(previewHref));
			}
		}

		applyDragTransforms();
	}

	function onTouchEndOrCancel(cancelled = false) {
		if (!tracking) return;
		const wasHorizontal = lockedAxis === 'x';
		tracking = false;
		lockedAxis = null;
		if (!wasHorizontal) return;

		const stageW = stageEl.clientWidth || window.innerWidth || 375;
		const dx = currentDragX;
		const pCat = previewCat;
		const oCat = originCat;

		const commitByDistance = Math.abs(dx) >= stageW * COMMIT_DISTANCE_RATIO;
		const commitByVelocity =
			Math.abs(dx) >= 24 &&
			Math.abs(velocityX) >= COMMIT_VELOCITY_PX_MS &&
			Math.sign(velocityX) === Math.sign(dx);

		if (!cancelled && pCat && (commitByDistance || commitByVelocity)) {
			const remainingRatio = Math.max(0.15, Math.min(1, 1 - Math.abs(dx) / stageW));
			cb.onCommit({
				targetCat: pCat,
				targetHref: cb.getPreviewHref(pCat),
				dir: previewDir,
				offsetPx: dx,
				durationMs: Math.round(remainingRatio * 280) + 60,
				originCat: oCat
			});
			return;
		}

		const token = ++reboundToken;
		if (prefersReducedMotion()) {
			finishRebound(token, oCat, pCat);
			return;
		}

		const anims: Animation[] = [];
		const activeEl = oCat ? cb.getPaneEl(oCat) : undefined;
		if (activeEl) {
			const anim = activeEl.animate(
				[
					{ transform: `translate3d(${dx.toFixed(1)}px, 0, 0)` },
					{ transform: 'translate3d(0, 0, 0)' }
				],
				{ duration: 240, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' }
			);
			activeEl.style.transform = '';
			anims.push(anim);
		}

		const pEl = pCat ? cb.getPaneEl(pCat) : undefined;
		if (pEl && pCat) {
			const anim = pEl.animate(
				[
					{ transform: `translate3d(calc(${previewDir * 100}% + ${dx.toFixed(1)}px), 0, 0)` },
					{ transform: `translate3d(${previewDir * 100}%, 0, 0)` }
				],
				{ duration: 240, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' }
			);
			pEl.style.transform = '';
			anims.push(anim);
		}

		if (anims.length === 0) {
			finishRebound(token, oCat, pCat);
			return;
		}

		activeReboundAnims = anims;
		void Promise.allSettled(anims.map((a) => a.finished)).then(() => {
			finishRebound(token, oCat, pCat);
		});
	}

	const handleTouchEnd = () => onTouchEndOrCancel(false);
	const handleTouchCancel = () => onTouchEndOrCancel(true);

	stageEl.addEventListener('touchstart', onTouchStart, { passive: true });
	stageEl.addEventListener('touchmove', onTouchMove, { passive: false });
	stageEl.addEventListener('touchend', handleTouchEnd, { passive: true });
	stageEl.addEventListener('touchcancel', handleTouchCancel, { passive: true });

	return () => {
		stageEl.removeEventListener('touchstart', onTouchStart);
		stageEl.removeEventListener('touchmove', onTouchMove);
		stageEl.removeEventListener('touchend', handleTouchEnd);
		stageEl.removeEventListener('touchcancel', handleTouchCancel);
		for (const a of activeReboundAnims) a.cancel();
	};
}
