import { goto } from '$app/navigation';
import { page } from '$app/state';
import { auth } from '#lib/auth';
import { catalogFeed } from '#lib/common/logic';
import {
	cancelSmoothScroll,
	handleSameRouteScrollTop,
	smoothScrollToTop
} from './scrollToTop';
import {
	attachMobileScrollVisibility,
	mobileScrollVisibility,
	showMobileHeader,
	syncMobileScrollAnchor
} from './mobileScrollVisibility.svelte';

export interface AppShellPcNavItem {
	label: string;
	baseHref: string;
	href: string;
	active: boolean;
}

export interface AppShellMobileNavItem {
	label: string;
	value: string;
	icon: 'artist' | 'concert' | 'album' | 'goods' | 'mypage';
}

export type MobileShellPane = 'left' | 'center' | 'right';
export type MobileOverlayKind = 'chatbot' | 'notifications' | null;

const PC_NAV_DEFS = [
	{ label: '아티스트', baseHref: '/artist' },
	{ label: '공연', baseHref: '/concert' },
	{ label: '앨범', baseHref: '/album' },
	{ label: '굿즈', baseHref: '/goods' }
] as const;

export const MOBILE_NAV_ITEMS: readonly AppShellMobileNavItem[] = [
	{ label: '아티스트', value: '/artist', icon: 'artist' },
	{ label: '공연', value: '/concert', icon: 'concert' },
	{ label: '음반∙LP', value: '/album', icon: 'album' },
	{ label: '굿즈', value: '/goods', icon: 'goods' },
	{ label: '마이페이지', value: '/mypage', icon: 'mypage' }
];

const OTHER_CATEGORY_LIST_PATHS = new Set(['/concert', '/album', '/goods', '/mypage']);

function isRouteActive(route: string, pathname: string): boolean {
	return pathname === route || pathname.startsWith(`${route}/`);
}

function resolveMobileRouteValue(pathname: string): string {
	return MOBILE_NAV_ITEMS.find((item) => isRouteActive(item.value, pathname))?.value ?? '/artist';
}

/**
 * 1_app_shell 통합 컨트롤러
 * - PC/모바일 헤더, 하단 네비게이션, 모바일 3-패널(left: 챗봇 / center: 메인 / right: 알림)
 *   상태 및 SvelteKit shallow 뒤로가기 히스토리 관리를 전담합니다.
 */
export class AppShellController {
	scrollY = $state(0);
	activeMobileOverlay = $state<MobileOverlayKind>(null);

	private openingHistoryPending = false;
	private skipHistoryBackOnClose = false;

	get pathname(): string {
		return page.url.pathname;
	}

	/* ── PC 헤더 파생 상태 ── */

	get pcNavItems(): AppShellPcNavItem[] {
		const currentPath = this.pathname;
		return PC_NAV_DEFS.map((item) => ({
			label: item.label,
			baseHref: item.baseHref,
			href: catalogFeed.getCategoryNavHref(item.baseHref, currentPath),
			active: isRouteActive(item.baseHref, currentPath)
		}));
	}

	get isPcHeaderScrolled(): boolean {
		return this.scrollY > 2;
	}

	/* ── 모바일 헤더 / 하단바 / 3-패널 상태 ── */

	get isMobileHeaderHidden(): boolean {
		return mobileScrollVisibility.hidden;
	}

	get isMobileHeaderScrolled(): boolean {
		return mobileScrollVisibility.scrolled;
	}

	get selectedMobileRoute(): string {
		return resolveMobileRouteValue(this.pathname);
	}

	get profileImageUrl(): string {
		return auth.user?.profileImageUrl ?? '';
	}

	get activeMobilePane(): MobileShellPane {
		if (this.activeMobileOverlay === 'chatbot') return 'left';
		if (this.activeMobileOverlay === 'notifications') return 'right';
		return 'center';
	}

	/* ── PC 네비게이션 액션 ── */

	handlePcNavClick = (e: MouseEvent, targetHref: string): void => {
		handleSameRouteScrollTop(e, targetHref, this.pathname);
	};

	/* ── 모바일 네비게이션 액션 ── */

	handleMobileLogoClick = (): void => {
		smoothScrollToTop();
	};

	handleMobileNavSelect = (nextValue: string): void => {
		const currentPath = this.pathname;
		if (isRouteActive(nextValue, currentPath)) return;

		const targetHref = catalogFeed.getCategoryNavHref(nextValue, currentPath);
		const normalizedFrom = currentPath.replace(/\/+$/, '') || '/';
		const fromOtherCategoryList = OTHER_CATEGORY_LIST_PATHS.has(normalizedFrom);
		void goto(targetHref, { reset: false, replaceState: fromOtherCategoryList });
	};

	handleMobileActiveReselect = (selectedRoute: string): void => {
		if (this.pathname !== selectedRoute && typeof window !== 'undefined' && window.scrollY <= 10) {
			void goto(selectedRoute, { reset: false });
		} else {
			smoothScrollToTop();
		}
	};

	/* ── 모바일 3-패널 전환 (챗봇=left · 알림=right · 뒤로가기=center) ── */

	openMobileOverlay = (kind: Exclude<MobileOverlayKind, null>): void => {
		if (this.activeMobileOverlay === kind) return;
		const wasClosed = this.activeMobileOverlay === null;
		this.activeMobileOverlay = kind;

		const pageOverlay = page.state.mobileOverlay;
		if (typeof window !== 'undefined' && wasClosed && !pageOverlay && !this.openingHistoryPending) {
			this.openingHistoryPending = true;
			void goto('', {
				state: { ...page.state, mobileOverlay: kind },
				shallow: true
			}).finally(() => {
				this.openingHistoryPending = false;
			});
		}
	};

	closeMobileOverlay = (): void => {
		if (!this.activeMobileOverlay) return;
		showMobileHeader();
		const pageOverlay = page.state.mobileOverlay;
		if (typeof window !== 'undefined' && pageOverlay && !this.skipHistoryBackOnClose) {
			window.history.back();
			return;
		}
		this.skipHistoryBackOnClose = false;
		this.activeMobileOverlay = null;
	};

	syncOverlayFromHistoryState = (pageOverlay: MobileOverlayKind | undefined): void => {
		if (!pageOverlay && this.activeMobileOverlay !== null && !this.openingHistoryPending) {
			showMobileHeader();
			this.skipHistoryBackOnClose = true;
			this.activeMobileOverlay = null;
		}
	};

	handleBeforeRouteNavigate = (isPopstate: boolean, fromPath?: string, toPath?: string): void => {
		if (fromPath && toPath && fromPath !== toPath) {
			cancelSmoothScroll();
		}
		if (!this.activeMobileOverlay) return;
		if (!isPopstate && fromPath && toPath && fromPath !== toPath) {
			showMobileHeader();
			this.skipHistoryBackOnClose = true;
			this.activeMobileOverlay = null;
		}
	};

	clearStaleOverlayHistoryState = (): void => {
		if (page.state.mobileOverlay && !this.activeMobileOverlay) {
			void goto('', {
				state: { ...page.state, mobileOverlay: undefined },
				shallow: true,
				replace: true
			});
		}
	};

	/* ── 생명주기 연결 ── */

	syncAfterNavigate = (isPopstate: boolean): void => {
		syncMobileScrollAnchor();
		if (isPopstate && typeof document !== 'undefined') {
			const activeEl = document.activeElement as HTMLElement | null;
			if (activeEl?.classList.contains('mobile-dock-btn')) {
				activeEl.blur();
			}
		}
	};

	attachWindowListeners = (): (() => void) => {
		if (typeof window === 'undefined') return () => {};

		const detachMobileScroll = attachMobileScrollVisibility();

		const handleScroll = () => {
			this.scrollY = Math.max(0, window.scrollY);
		};
		handleScroll();
		window.addEventListener('scroll', handleScroll, { passive: true });

		return () => {
			detachMobileScroll();
			window.removeEventListener('scroll', handleScroll);
		};
	};
}
