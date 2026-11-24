import { goto, preloadCode } from '$app/navigation';
import { auth, clearSignupFlow } from '#lib/auth';
import { mapArtistItem, type ArtistItemDto, type CatalogArtist } from '#lib/config/artists';
import { CATALOG_DEFAULT_PAGE_SIZE, fetchCatalogPage } from '#lib/config/catalogFeed';
import { DEFAULT_FOLLOW_SORT } from '#lib/common/type/filterOptions';
import {
	buildCatalogRequestKey,
	catalogFeed,
	getSavedCategorySlice,
	getSavedFollowSort,
	isMobile
} from '#lib/common/logic';

/**
 * 첫 화면(FirstDisplay) 전용 로직 컨트롤러
 * - URL XSRF 캡처, 가입 대기 표식 정리, 모바일 기로그인 자동 리다이렉트,
 *   스플래시 종료 후 /artist 라우트 코드 & 첫 페이지 데이터 프리페치, 로그인/계속하기 액션을 전담합니다.
 */
export class FirstDisplayController {
	private artistPreloadStarted = false;

	get isLoggedIn(): boolean {
		return Boolean(auth.isLoggedIn && auth.user);
	}

	get isVerified(): boolean {
		return auth.isVerified;
	}

	get isLoading(): boolean {
		return auth.isLoading;
	}

	get nickname(): string {
		return auth.user?.nickname ?? '회원';
	}

	/** 마운트 시 인증 상태 동기화 및 모바일 기로그인 자동 이동 설정 */
	attachLifecycle = (hasOverlayChildren: () => boolean): (() => void) => {
		if (typeof window === 'undefined') return () => {};

		let cancelled = false;
		auth.captureXsrfFromUrl();

		// /signup 이 아닌 루트(/) 진입 시에는 이전 가입 대기 표식 정리
		if (!hasOverlayChildren()) {
			clearSignupFlow();
		}

		// 모바일에서 이미 로그인된 상태로 '/' 진입 시 스플래시 진행 중 /artist 코드 선행 로드
		if (!hasOverlayChildren() && isMobile.current && auth.isLoggedIn) {
			void preloadCode('/(user)/artist').catch(() => {
				// 코드 프리로드 실패 시 goto 시점 로드로 폴백
			});
		}

		const redirectMobileAuthedToArtist = async () => {
			const isAuthed = await auth.checkAuth();
			if (cancelled || hasOverlayChildren()) return;
			if (isAuthed && auth.isLoggedIn && isMobile.current) {
				await goto('/artist', { replaceState: true });
			}
		};

		void redirectMobileAuthedToArtist();

		const handlePageShow = (event: PageTransitionEvent) => {
			if (!event.persisted || cancelled || hasOverlayChildren()) return;
			if (auth.isLoggedIn && isMobile.current) {
				void goto('/artist', { replaceState: true });
			}
		};
		window.addEventListener('pageshow', handlePageShow);

		return () => {
			cancelled = true;
			window.removeEventListener('pageshow', handlePageShow);
		};
	};

	/** 유휴 시간에 /artist 코드 및 1페이지 스냅샷 프리페치 예약 */
	scheduleArtistWarmup = (enabled: boolean): (() => void) | void => {
		if (typeof window === 'undefined') return;
		if (!enabled || !auth.isLoggedIn || !auth.isVerified || this.artistPreloadStarted) {
			return;
		}
		this.artistPreloadStarted = true;

		let idleId: number | undefined;
		let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
		const win = window as Window & {
			requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
			cancelIdleCallback?: (id: number) => void;
		};

		const run = () => {
			void this.warmupArtistRoute();
		};

		if (typeof win.requestIdleCallback === 'function') {
			idleId = win.requestIdleCallback(run, { timeout: 1200 });
		} else {
			fallbackTimer = setTimeout(run, 150);
		}

		return () => {
			if (idleId !== undefined) win.cancelIdleCallback?.(idleId);
			if (fallbackTimer !== undefined) clearTimeout(fallbackTimer);
		};
	};

	private async warmupArtistRoute(): Promise<void> {
		try {
			await preloadCode('/(user)/artist');
		} catch {
			// 코드 프리로드 실패 시 실제 이동 시점 로드로 폴백
		}

		if (!auth.isLoggedIn || catalogFeed.getArtistSnapshot()) return;

		const feedMode = catalogFeed.resolvedFeedMode;
		const query = catalogFeed.debouncedQuery;
		const filterState = {
			...getSavedCategorySlice('Artist'),
			sort:
				feedMode === 'follow'
					? catalogFeed.filterState.sort || getSavedFollowSort() || DEFAULT_FOLLOW_SORT
					: ''
		};
		const requestKey = buildCatalogRequestKey('artist', {
			feedMode,
			query,
			filterState,
			refreshTick: catalogFeed.refreshTick,
			authKey: `${auth.isLoggedIn}:${auth.isVerified}`
		});

		try {
			const res = await fetchCatalogPage<CatalogArtist, ArtistItemDto>({
				category: 'artist',
				feedMode,
				page: 0,
				pageSize: CATALOG_DEFAULT_PAGE_SIZE,
				query,
				filterState,
				mapItem: mapArtistItem
			});
			if (
				!auth.isLoggedIn ||
				res.degraded ||
				res.items.length === 0 ||
				catalogFeed.getArtistSnapshot()
			) {
				return;
			}
			catalogFeed.saveArtistSnapshot({
				artists: res.items,
				currentPage: res.page,
				hasNext: res.hasNext,
				query: query.trim(),
				genre: (filterState.genres ?? []).join(','),
				requestKey
			});
		} catch {
			// 데이터 프리페치 실패 시 /artist 진입 후 재조회
		}
	}

	continueToArtist = (): void => {
		void goto('/artist', { replaceState: isMobile.current });
	};

	startKakaoLogin = (): void => {
		auth.startKakaoLogin();
	};
}
