import { afterNavigate } from '$app/navigation';
import { auth } from '#lib/auth';
import { setAnalyticsUser, trackNavigation } from './analytics';

/**
 * 루트 레이아웃 초기화 중에 한 번 부른다 — 로그인 상태 → GA4 user_id, 화면 이동 → 상세 조회 · 머문 시간.
 * 운영 주소(ANALYTICS_HOSTS)에서만 동작한다 (#lib/common/logic/analytics).
 */
export function useAnalytics(): void {
	$effect(() => {
		setAnalyticsUser(auth.user?.userId ?? null);
	});
	afterNavigate(({ to }) => {
		trackNavigation(to?.url.pathname ?? null);
	});
}
