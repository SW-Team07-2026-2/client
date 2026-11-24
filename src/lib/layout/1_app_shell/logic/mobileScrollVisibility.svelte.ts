const TOP_ALWAYS_SHOW_Y = 24;
const HIDE_MIN_SCROLL_Y = 96;
const HIDE_SCROLL_DELTA = 44;
const SHOW_SCROLL_DELTA = 32;
const BOTTOM_BOUNCE_GUARD = 48;
const TOGGLE_COOLDOWN_MS = 220;

let hidden = $state(false);
let scrolled = $state(false);

let lastScrollY = 0;
let scrollAccum = 0;
let lastToggleTime = 0;
let ignoreScrollSync = false;
let syncResetFrame: number | undefined;
let activeMounts = 0;
let listening = false;

function updateAnchorFromWindow() {
	if (typeof window === 'undefined') return;
	const currentY = Math.max(0, window.scrollY);
	lastScrollY = currentY;
	scrollAccum = 0;
	scrolled = currentY > 2;
	if (currentY <= TOP_ALWAYS_SHOW_Y) {
		hidden = false;
	}
}

function handleWindowScroll() {
	if (ignoreScrollSync) return;
	const currentY = Math.max(0, window.scrollY);
	scrolled = currentY > 2;

	if (currentY <= TOP_ALWAYS_SHOW_Y) {
		hidden = false;
		lastScrollY = currentY;
		scrollAccum = 0;
		return;
	}

	const delta = currentY - lastScrollY;
	lastScrollY = currentY;
	if (delta === 0) return;

	const doc = document.documentElement;
	if (delta < 0 && currentY + window.innerHeight >= doc.scrollHeight - BOTTOM_BOUNCE_GUARD) {
		scrollAccum = 0;
		return;
	}

	if ((delta > 0 && scrollAccum < 0) || (delta < 0 && scrollAccum > 0)) {
		scrollAccum = 0;
	}
	scrollAccum += delta;

	const now = performance.now();
	if (now - lastToggleTime < TOGGLE_COOLDOWN_MS) {
		return;
	}

	if (!hidden && currentY > HIDE_MIN_SCROLL_Y && scrollAccum >= HIDE_SCROLL_DELTA) {
		hidden = true;
		scrollAccum = 0;
		lastToggleTime = now;
	} else if (hidden && scrollAccum <= -SHOW_SCROLL_DELTA) {
		hidden = false;
		scrollAccum = 0;
		lastToggleTime = now;
	}
}

/**
 * 모바일 상단 헤더를 즉시 표시 상태로 복원하고 스크롤 기준점을 동기화합니다.
 * (AI 챗봇 · 알림 화면에서 메인으로 복귀할 때 항상 헤더가 보이도록 보장)
 */
export function showMobileHeader(): void {
	hidden = false;
	scrollAccum = 0;
	lastToggleTime = 0;
	syncMobileScrollAnchor();
}

/**
 * 라우트 전환 직후의 프로그래밍 방식 스크롤 복원 점프를 사용자 스크롤로 오인하지 않도록 기준점을 동기화합니다.
 */
export function syncMobileScrollAnchor(): void {
	if (typeof window === 'undefined') return;
	ignoreScrollSync = true;
	updateAnchorFromWindow();
	if (syncResetFrame !== undefined) {
		cancelAnimationFrame(syncResetFrame);
	}
	syncResetFrame = requestAnimationFrame(() => {
		updateAnchorFromWindow();
		ignoreScrollSync = false;
		syncResetFrame = undefined;
	});
}

/**
 * 모바일 상·하단 스크롤 반응형 바의 공통 가시성 상태(`hidden`, `scrolled`)를 활성화합니다.
 */
export function attachMobileScrollVisibility(): () => void {
	activeMounts += 1;
	if (typeof window !== 'undefined' && !listening) {
		updateAnchorFromWindow();
		window.addEventListener('scroll', handleWindowScroll, { passive: true });
		listening = true;
	}

	return () => {
		activeMounts = Math.max(0, activeMounts - 1);
		if (activeMounts === 0 && typeof window !== 'undefined' && listening) {
			window.removeEventListener('scroll', handleWindowScroll);
			listening = false;
			if (syncResetFrame !== undefined) {
				cancelAnimationFrame(syncResetFrame);
				syncResetFrame = undefined;
			}
			ignoreScrollSync = false;
		}
	};
}

export const mobileScrollVisibility = {
	get hidden() {
		return hidden;
	},
	get scrolled() {
		return scrolled;
	}
};
