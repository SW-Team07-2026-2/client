let activeScrollRafId = 0;

export interface SmoothScrollToTopOptions {
	initialY?: number;
	onProgress?: (nextY: number, progress: number) => void;
	onComplete?: () => void;
}

/** 진행 중인 상단 스크롤 애니메이션을 중단합니다. */
export function cancelSmoothScroll(): void {
	if (activeScrollRafId) {
		cancelAnimationFrame(activeScrollRafId);
		activeScrollRafId = 0;
	}
}

/**
 * 현재 스크롤 위치를 페이지 최상단(y = 0)으로 부드럽게 이동시킵니다.
 */
export function smoothScrollToTop(options: SmoothScrollToTopOptions = {}): void {
	if (typeof window === 'undefined') return;
	const { initialY, onProgress, onComplete } = options;

	const startY = initialY !== undefined ? Math.max(initialY, window.scrollY) : window.scrollY;
	if (startY <= 2) {
		if (startY > 0) window.scrollTo(0, 0);
		onComplete?.();
		return;
	}

	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
		cancelSmoothScroll();
		window.scrollTo(0, 0);
		onComplete?.();
		return;
	}

	cancelSmoothScroll();
	const startTime = performance.now();
	// 스크롤 거리에 비례해 340ms ~ 540ms 동안 부드러운 가감속으로 상단 도달
	const duration = Math.min(540, Math.max(340, Math.sqrt(startY) * 15));

	function step(now: number) {
		const elapsed = now - startTime;
		const t = Math.min(1, elapsed / duration);
		// 초반 급발진을 없애고 부드럽게 출발해 매끄럽게 안착하는 비대칭 ease-in-out 곡선
		const ease =
			t < 0.28
				? (t / 0.28) * (t / 0.28) * 0.22
				: 0.22 + (1 - Math.pow(1 - (t - 0.28) / 0.72, 3)) * 0.78;

		const nextY = Math.round(startY * (1 - ease));
		window.scrollTo(0, nextY);
		onProgress?.(nextY, t);

		if (t < 1) {
			activeScrollRafId = requestAnimationFrame(step);
		} else {
			activeScrollRafId = 0;
			onComplete?.();
		}
	}

	activeScrollRafId = requestAnimationFrame(step);
}

/**
 * 네비게이션 링크 클릭 시 현재 경로와 동일한 카테고리라면
 * 페이지 재이동 대신 최상단으로 부드럽게 스크롤합니다.
 */
export function handleSameRouteScrollTop(
	e: MouseEvent,
	href: string,
	currentPathname: string
): boolean {
	if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return false;
	const current = currentPathname.replace(/\/+$/, '') || '/';
	const target = href.replace(/\/+$/, '') || '/';
	if (current !== target) return false;

	e.preventDefault();
	smoothScrollToTop();
	return true;
}
