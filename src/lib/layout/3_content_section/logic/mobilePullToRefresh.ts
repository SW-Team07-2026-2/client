export interface PullToRefreshState {
	/** 현재 당겨진 거리(px, 고무줄 저항 적용) */
	pullPx: number;
	/** 트리거 임계값 대비 진행률 (0 ~ 1) */
	progress: number;
	/** 손을 떼면 새로고침이 실행되는 준비 상태 여부 */
	ready: boolean;
	/** 새로고침 실행 중 스피너 표시 여부 */
	refreshing: boolean;
}

export interface MobilePullToRefreshOptions {
	/** 현재 페이지에서 Pull-to-Refresh를 허용할지 여부 */
	canStart: () => boolean;
	/** 상태 변경 콜백 (순수 UI 인디케이터로 전달) */
	onStateChange: (state: PullToRefreshState) => void;
	/** 임계값 도달 후 손을 떼었을 때 실행할 새로고침 콜백 */
	onRefresh: () => void;
	/** 트리거 임계 거리(px, 기본값 64) */
	triggerPx?: number;
	/** 최대 당김 거리(px, 기본값 104) */
	maxPullPx?: number;
	/** 새로고침 인디케이터 유지 시간(ms, 기본값 680) */
	refreshHoldMs?: number;
}

const AXIS_LOCK_THRESHOLD = 10;
const TOP_SCROLL_EPSILON = 1;

function hasScrolledAncestor(target: EventTarget | null): boolean {
	let node = target instanceof HTMLElement ? target : null;
	while (node && node !== document.body && node !== document.documentElement) {
		if (node.dataset.ptrIgnore !== undefined) return true;
		if (node.scrollTop > 0) return true;
		node = node.parentElement;
	}
	return false;
}

/**
 * 모바일 상단 당겨서 새로고침(Pull-to-Refresh) 제스처 컨트롤러
 * - 터치 시작 시점(touchstart)에 이미 최상단(scrollY <= 1)인 경우에만 활성화되어,
 *   아래에서 크게 위로 스크롤할 때는 먼저 최상단에서 한 번 멈추고
 *   최상단에서 한 번 더 당겼을 때만 새로고침이 동작합니다.
 */
export function attachMobilePullToRefresh(options: MobilePullToRefreshOptions): () => void {
	if (typeof window === 'undefined') return () => {};

	const triggerPx = options.triggerPx ?? 64;
	const maxPullPx = options.maxPullPx ?? 104;
	const refreshHoldMs = options.refreshHoldMs ?? 680;

	let tracking = false;
	let pulling = false;
	let refreshing = false;
	let startX = 0;
	let startY = 0;
	let currentPullPx = 0;
	let refreshTimer: ReturnType<typeof setTimeout> | undefined;

	function emit(pullPx: number, isRefreshing: boolean) {
		const clamped = Math.max(0, Math.min(maxPullPx, pullPx));
		const progress = Math.min(1, clamped / triggerPx);
		options.onStateChange({
			pullPx: clamped,
			progress,
			ready: !isRefreshing && clamped >= triggerPx,
			refreshing: isRefreshing
		});
	}

	function resetToIdle() {
		tracking = false;
		pulling = false;
		currentPullPx = 0;
		if (!refreshing) {
			emit(0, false);
		}
	}

	function onTouchStart(e: TouchEvent) {
		if (refreshing || e.touches.length !== 1 || !options.canStart()) {
			tracking = false;
			return;
		}

		// 핵심: 터치 시작 시점에 이미 최상단에 도달해 있어야만 활성화 (크게 스크롤 시 최상단에서 1회 정지 보장)
		const scrollY = Math.max(
			window.scrollY,
			document.scrollingElement?.scrollTop ?? 0,
			document.documentElement?.scrollTop ?? 0
		);
		if (scrollY > TOP_SCROLL_EPSILON || hasScrolledAncestor(e.target)) {
			tracking = false;
			return;
		}

		const touch = e.touches[0];
		startX = touch.clientX;
		startY = touch.clientY;
		currentPullPx = 0;
		pulling = false;
		tracking = true;
	}

	function onTouchMove(e: TouchEvent) {
		if (!tracking || refreshing || e.touches.length !== 1) return;

		const touch = e.touches[0];
		const dx = touch.clientX - startX;
		const dy = touch.clientY - startY;

		if (!pulling) {
			// 좌우 스와이프나 아래 방향 스크롤이면 즉시 추적 해제
			if (dy <= 0) {
				if (Math.abs(dy) >= AXIS_LOCK_THRESHOLD) {
					tracking = false;
				}
				return;
			}
			if (Math.abs(dx) >= AXIS_LOCK_THRESHOLD && Math.abs(dx) >= Math.abs(dy)) {
				tracking = false;
				return;
			}
			if (dy < AXIS_LOCK_THRESHOLD) return;

			// 축이 세로 아래 당김으로 잠긴 시점에 다시 최상단 확인
			if (window.scrollY > TOP_SCROLL_EPSILON) {
				tracking = false;
				return;
			}
			pulling = true;
		}

		if (dy <= 0) {
			currentPullPx = 0;
			emit(0, false);
			return;
		}

		if (e.cancelable) {
			e.preventDefault();
		}

		// 부드러운 고무줄 저항 곡선
		const effectiveDy = Math.max(0, dy - AXIS_LOCK_THRESHOLD);
		currentPullPx = Math.min(maxPullPx, Math.round(effectiveDy * 0.48 * 10) / 10);
		emit(currentPullPx, false);
	}

	function onTouchEndOrCancel(cancelled = false) {
		if (!tracking) return;
		const wasPulling = pulling;
		const finalPull = currentPullPx;
		tracking = false;
		pulling = false;
		currentPullPx = 0;

		if (!wasPulling) return;

		if (!cancelled && finalPull >= triggerPx) {
			refreshing = true;
			emit(triggerPx * 0.78, true);
			options.onRefresh();

			clearTimeout(refreshTimer);
			refreshTimer = setTimeout(() => {
				refreshing = false;
				emit(0, false);
			}, refreshHoldMs);
			return;
		}

		resetToIdle();
	}

	const handleTouchEnd = () => onTouchEndOrCancel(false);
	const handleTouchCancel = () => onTouchEndOrCancel(true);

	window.addEventListener('touchstart', onTouchStart, { passive: true });
	window.addEventListener('touchmove', onTouchMove, { passive: false });
	window.addEventListener('touchend', handleTouchEnd, { passive: true });
	window.addEventListener('touchcancel', handleTouchCancel, { passive: true });

	return () => {
		clearTimeout(refreshTimer);
		window.removeEventListener('touchstart', onTouchStart);
		window.removeEventListener('touchmove', onTouchMove);
		window.removeEventListener('touchend', handleTouchEnd);
		window.removeEventListener('touchcancel', handleTouchCancel);
	};
}
