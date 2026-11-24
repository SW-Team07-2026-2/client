import { tick, untrack } from 'svelte';
import { goto, preloadCode } from '$app/navigation';
import { page } from '$app/state';
import { catalogFeed, isMobile } from '#lib/common/logic';
import {
	createKeepAliveSlideController,
	resolveSlideDirection,
	type SlideDirection
} from './keepAliveSlide';
import { attachMobileSwipe } from './mobileSwipe';
import {
	MAIN_SECTIONS,
	MAIN_SECTION_KEYS,
	getMainSection,
	parseMainSectionDetailId,
	resolveMainSectionIndex,
	resolveMainSectionKey,
	type MainSectionKey
} from './sectionRegistry';

/**
 * 2_main_section 통합 컨트롤러
 * - 5개 카테고리 섹션(artist · concert · album · goods · mypage)의
 *   Keep-Alive 마운트, 목록/상세 독립 스크롤 분리, 좌우 슬라이드, 모바일 스와이프,
 *   제자리 고정 영역(pinned header) 높이 보정을 전담합니다.
 */
export class MainSectionController {
	mountedSections = $state<Record<MainSectionKey, boolean>>({
		artist: false,
		concert: false,
		album: false,
		goods: false,
		mypage: false
	});

	exitingSection = $state<MainSectionKey | null>(null);
	exitingDeltaY = $state(0);
	isSliding = $state(false);
	swipePreviewSection = $state<MainSectionKey | null>(null);
	swipePreviewTop = $state(0);
	isSwiping = $state(false);
	stageMinHeight = $state('');
	routeDir = $state<SlideDirection>(1);

	// PC 제자리 고정 영역(콘텐츠 헤더 · 옵션바) 표시 대상 및 스크롤 보정 오프셋
	headerSection = $state<MainSectionKey | null>(null);
	headerOffsetY = $state(0);
	controlSection = $state<MainSectionKey | null>(null);
	controlOffsetY = $state(0);

	private paneEls: Partial<Record<MainSectionKey, HTMLDivElement>> = {};
	private pinnedHeaderEl: HTMLDivElement | undefined;
	private pinnedControlEl: HTMLDivElement | undefined;
	private slideController = createKeepAliveSlideController();

	// 목록 스크롤과 상세 스크롤을 완전히 분리 기억
	private listScrollPositions: Record<MainSectionKey, number> = {
		artist: 0,
		concert: 0,
		album: 0,
		goods: 0,
		mypage: 0
	};
	private detailScrollPositions: Record<string, number> = {};

	private preNavScrollY = 0;
	private pendingTargetScrollY: number | null = null;
	private pendingExitingDeltaY = 0;
	private pendingFromHeaderHeight = 0;
	private pendingSwipeOffsetPx = 0;
	private pendingSwipeDurationMs = 0;
	private lastTrackedSection: MainSectionKey | null = null;
	private swipeFallbackTimer: ReturnType<typeof setTimeout> | undefined;

	constructor() {
		const initialKey = untrack(() => resolveMainSectionKey(page.url.pathname));
		if (initialKey) {
			this.mountedSections[initialKey] = true;
			this.lastTrackedSection = initialKey;
			this.headerSection = initialKey;
			this.controlSection = getMainSection(initialKey).supportsOptions ? initialKey : null;
		}
	}

	get pathname(): string {
		return page.url.pathname;
	}

	get activeSection(): MainSectionKey | null {
		return resolveMainSectionKey(this.pathname);
	}

	get activeDetailId(): number | null {
		return parseMainSectionDetailId(this.pathname);
	}

	get isDetailRoute(): boolean {
		return this.activeDetailId !== null;
	}

	get documentTitle(): string {
		const key = this.activeSection;
		return key ? getMainSection(key).documentTitle : 'INDIG';
	}

	registerPaneEl = (key: MainSectionKey, el: HTMLDivElement | undefined): void => {
		if (el) {
			this.paneEls[key] = el;
		} else {
			delete this.paneEls[key];
		}
	};

	registerPinnedHeaderEl = (el: HTMLDivElement | undefined): void => {
		this.pinnedHeaderEl = el;
	};

	registerPinnedControlEl = (el: HTMLDivElement | undefined): void => {
		this.pinnedControlEl = el;
	};

	ensureMounted = (key: MainSectionKey): void => {
		if (!this.mountedSections[key]) {
			this.mountedSections[key] = true;
		}
	};

	getSavedScrollY = (pathname?: string | null): number => {
		if (!pathname) return 0;
		const detailId = parseMainSectionDetailId(pathname);
		if (detailId !== null) {
			return this.detailScrollPositions[pathname] ?? 0;
		}
		const key = resolveMainSectionKey(pathname);
		return key ? this.listScrollPositions[key] : 0;
	};

	/** 라우트 변경 시 현재 섹션 마운트 및 전환 트리거 */
	syncCurrentRoute = (getPinnedHeaderHeight?: () => number): void => {
		const activeKey = this.activeSection;
		const pathname = this.pathname;

		untrack(() => {
			catalogFeed.rememberCategoryRoute(pathname);
			if (activeKey) {
				this.ensureMounted(activeKey);
			}

			const prevKey = this.lastTrackedSection;
			if (activeKey === prevKey) return;
			this.lastTrackedSection = activeKey;

			if (prevKey && activeKey) {
				const fromHasControl = getMainSection(prevKey).supportsOptions;
				const toHasControl = getMainSection(activeKey).supportsOptions;
				const fromY = this.preNavScrollY;
				const toY = this.pendingTargetScrollY ?? this.getSavedScrollY(pathname);
				const desktopMode = !isMobile.current && !this.isDetailRoute;

				// 고정 헤더 유무(상세 <-> 목록 등)에 따른 높이 차이 보정
				const toHeaderH = !isMobile.current ? (getPinnedHeaderHeight?.() ?? 0) : 0;
				const headerHeightDelta = !isMobile.current
					? this.pendingFromHeaderHeight - toHeaderH
					: 0;

				this.exitingSection = prevKey;
				this.exitingDeltaY = this.pendingExitingDeltaY + headerHeightDelta;
				this.pendingExitingDeltaY = 0;

				// PC 제자리 고정 영역(헤더 · 옵션바)의 슬라이드 참여 여부 결정
				let headerSlideMode: 'pinned' | 'in' | 'out' | 'none' = 'pinned';
				let controlSlideMode: 'pinned' | 'in' | 'out' | 'none' = 'none';

				if (desktopMode) {
					const headerH = toHeaderH || (this.pinnedHeaderEl?.offsetHeight ?? 120);
					const controlH = this.pinnedControlEl?.offsetHeight ?? 60;
					const headerZone = headerH + (fromHasControl || toHasControl ? controlH : 0);

					if (fromY <= 8 && toY <= 8) {
						// 1) 두 페이지 모두 최상단: 헤더는 제자리 모핑, 옵션바는 카탈로그 간 유지 / 마이페이지 전환 시만 슬라이드
						headerSlideMode = 'pinned';
						this.headerSection = activeKey;
						this.headerOffsetY = 0;

						if (fromHasControl && toHasControl) {
							controlSlideMode = 'pinned';
							this.controlSection = activeKey;
							this.controlOffsetY = 0;
						} else if (fromHasControl && !toHasControl) {
							controlSlideMode = 'out';
							this.controlSection = prevKey;
							this.controlOffsetY = 0;
						} else if (!fromHasControl && toHasControl) {
							controlSlideMode = 'in';
							this.controlSection = activeKey;
							this.controlOffsetY = 0;
						} else {
							controlSlideMode = 'none';
							this.controlSection = null;
							this.controlOffsetY = 0;
						}
					} else if (fromY > 8 && toY <= headerZone) {
						// 2) 스크롤된 페이지 -> 상단 노출 페이지: 헤더와 옵션바가 새 페이지와 함께 좌우 슬라이드 진입
						headerSlideMode = 'in';
						this.headerSection = activeKey;
						this.headerOffsetY = 0;

						if (toHasControl) {
							controlSlideMode = 'in';
							this.controlSection = activeKey;
							this.controlOffsetY = 0;
						} else {
							controlSlideMode = 'none';
							this.controlSection = null;
							this.controlOffsetY = 0;
						}
					} else if (fromY <= headerZone && toY > headerZone) {
						// 3) 상단 노출 페이지 -> 스크롤된 페이지: 이전 페이지의 헤더/옵션바가 현재 뷰포트 위치에서 좌우 슬라이드 퇴장
						const exitTopOffset = Math.max(0, toY - fromY);
						headerSlideMode = 'out';
						this.headerSection = prevKey;
						this.headerOffsetY = exitTopOffset;

						if (fromHasControl) {
							controlSlideMode = 'out';
							this.controlSection = prevKey;
							this.controlOffsetY = exitTopOffset;
						} else {
							controlSlideMode = 'none';
							this.controlSection = null;
							this.controlOffsetY = 0;
						}
					} else {
						// 4) 두 페이지 모두 헤더 영역 아래로 스크롤됨: 화면 밖이므로 상태만 동기화
						headerSlideMode = 'none';
						controlSlideMode = 'none';
						this.headerSection = activeKey;
						this.headerOffsetY = 0;
						this.controlSection = toHasControl ? activeKey : null;
						this.controlOffsetY = 0;
					}
				} else {
					this.headerSection = activeKey;
					this.headerOffsetY = 0;
					this.controlSection = toHasControl ? activeKey : null;
					this.controlOffsetY = 0;
				}

				const dir = this.routeDir;
				const startOffsetPx = this.pendingSwipeOffsetPx;
				const durationOverrideMs = this.pendingSwipeDurationMs;
				this.pendingSwipeOffsetPx = 0;
				this.pendingSwipeDurationMs = 0;
				clearTimeout(this.swipeFallbackTimer);

				if (startOffsetPx !== 0) {
					this.swipePreviewSection = null;
					this.swipePreviewTop = 0;
					this.isSwiping = false;
				}

				void tick().then(() => {
					const outEl = this.paneEls[prevKey];
					const inEl = this.paneEls[activeKey];
					const elementsOut: (HTMLElement | undefined)[] = [outEl];
					const elementsIn: (HTMLElement | undefined)[] = [inEl];

					if (headerSlideMode === 'out' && this.pinnedHeaderEl) {
						elementsOut.push(this.pinnedHeaderEl);
					} else if (headerSlideMode === 'in' && this.pinnedHeaderEl) {
						elementsIn.push(this.pinnedHeaderEl);
					}

					if (controlSlideMode === 'out' && this.pinnedControlEl) {
						elementsOut.push(this.pinnedControlEl);
					} else if (controlSlideMode === 'in' && this.pinnedControlEl) {
						elementsIn.push(this.pinnedControlEl);
					}

					this.slideController.start({
						elementsOut,
						elementsIn,
						dir,
						startOffsetPx,
						durationOverrideMs,
						onStateChange: (sliding) => {
							this.isSliding = sliding;
						},
						onFinish: () => {
							this.exitingSection = null;
							this.exitingDeltaY = 0;
							this.stageMinHeight = '';
							this.headerSection = this.activeSection;
							this.headerOffsetY = 0;
							this.controlSection =
								this.activeSection && getMainSection(this.activeSection).supportsOptions
									? this.activeSection
									: null;
							this.controlOffsetY = 0;
						}
					});
				});
			} else {
				this.slideController.cancel((sliding) => {
					this.isSliding = sliding;
				});
				this.exitingSection = null;
				this.exitingDeltaY = 0;
				this.headerSection = activeKey;
				this.headerOffsetY = 0;
				this.controlSection =
					activeKey && getMainSection(activeKey).supportsOptions ? activeKey : null;
				this.controlOffsetY = 0;
			}
		});
	};

	/** beforeNavigate 훅 연결 (목록<->상세 vs 카테고리 간 전환 분리) */
	handleBeforeNavigate = (
		fromPath?: string | null,
		toPath?: string | null,
		pinnedHeaderHeight = 0
	): void => {
		if (typeof window === 'undefined' || !fromPath || !toPath || fromPath === toPath) return;

		const fromKey = resolveMainSectionKey(fromPath);
		const toKey = resolveMainSectionKey(toPath);
		const fromDetailId = parseMainSectionDetailId(fromPath);
		const toDetailId = parseMainSectionDetailId(toPath);
		const fromIdx = resolveMainSectionIndex(fromPath);
		const toIdx = resolveMainSectionIndex(toPath);

		if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
			this.routeDir = resolveSlideDirection(fromIdx, toIdx);
		}

		this.preNavScrollY = Math.max(0, window.scrollY);
		this.pendingTargetScrollY = null;
		this.pendingExitingDeltaY = 0;
		this.pendingFromHeaderHeight = !isMobile.current ? pinnedHeaderHeight : 0;

		// 1) 같은 카테고리 내 목록 -> 상세 진입 (목록 스크롤 보존, 상세는 최상단 시작)
		if (fromKey && toKey === fromKey && fromDetailId === null && toDetailId !== null) {
			this.listScrollPositions[fromKey] = this.preNavScrollY;
			this.detailScrollPositions[toPath] = 0;
			this.pendingTargetScrollY = 0;
			return;
		}

		// 2) 같은 카테고리 내 상세 -> 목록 복귀 (상세 스크롤 초기화, 목록 스크롤 복원)
		if (fromKey && toKey === fromKey && fromDetailId !== null && toDetailId === null) {
			this.detailScrollPositions[fromPath] = 0;
			const targetY = this.listScrollPositions[fromKey] ?? 0;
			this.pendingTargetScrollY = targetY;
			const requiredHeight = Math.max(targetY, this.preNavScrollY);
			this.stageMinHeight = requiredHeight > 0 ? `${requiredHeight + window.innerHeight}px` : '';
			return;
		}

		// 3) 다른 카테고리/섹션 간 전환 (목록/상세 각각 독립 스크롤 기억·복원)
		if (fromDetailId !== null) {
			this.detailScrollPositions[fromPath] = this.preNavScrollY;
		} else if (fromKey) {
			this.listScrollPositions[fromKey] = this.preNavScrollY;
		}

		if (toKey) {
			const targetY = this.getSavedScrollY(toPath);
			this.pendingTargetScrollY = targetY;
			this.pendingExitingDeltaY = targetY - this.preNavScrollY;
			const requiredHeight = Math.max(targetY, this.preNavScrollY);
			this.stageMinHeight = requiredHeight > 0 ? `${requiredHeight + window.innerHeight}px` : '';
		}
	};

	/** afterNavigate 훅 연결 */
	handleAfterNavigate = (): void => {
		if (typeof window === 'undefined') return;
		if (this.pendingTargetScrollY !== null) {
			const targetY = this.pendingTargetScrollY;
			this.pendingTargetScrollY = null;
			window.scrollTo({ top: targetY, left: 0, behavior: 'auto' });
			requestAnimationFrame(() => {
				if (Math.abs(window.scrollY - targetY) > 1) {
					window.scrollTo({ top: targetY, left: 0, behavior: 'auto' });
				}
			});
		}
	};

	/** 모바일 좌우 스와이프 제스처 바인딩 */
	attachSwipe = (stageEl: HTMLElement): (() => void) => {
		return attachMobileSwipe<MainSectionKey>(stageEl, {
			categories: MAIN_SECTION_KEYS,
			canStart: () => isMobile.current && !this.isSliding && this.activeDetailId === null,
			getActiveCategory: () => this.activeSection,
			getPaneEl: (key) => this.paneEls[key],
			ensureMounted: (key) => this.ensureMounted(key),
			getPreviewHref: (key) =>
				catalogFeed.getCategoryNavHref(getMainSection(key).href, this.pathname),
			getSavedScrollY: (pathname) => this.getSavedScrollY(pathname),
			onSwipingChange: (swiping) => {
				this.isSwiping = swiping;
			},
			onPreviewChange: (key, topOffset) => {
				this.swipePreviewSection = key;
				this.swipePreviewTop = topOffset;
			},
			onCommit: ({ targetCat, targetHref, dir, offsetPx, durationMs, originCat }) => {
				this.routeDir = dir;
				this.pendingSwipeOffsetPx = offsetPx;
				this.pendingSwipeDurationMs = durationMs;

				clearTimeout(this.swipeFallbackTimer);
				this.swipeFallbackTimer = setTimeout(() => {
					this.pendingSwipeOffsetPx = 0;
					this.pendingSwipeDurationMs = 0;
					this.swipePreviewSection = null;
					this.swipePreviewTop = 0;
					this.isSwiping = false;
					if (originCat) {
						const el = this.paneEls[originCat];
						if (el) {
							el.style.transform = '';
							el.style.willChange = '';
						}
					}
					const pEl = this.paneEls[targetCat];
					if (pEl) {
						pEl.style.transform = '';
						pEl.style.willChange = '';
					}
				}, 600);

				const fromPath = this.pathname.replace(/\/+$/, '') || '/';
				const replaceState = fromPath !== '/artist';
				void goto(targetHref, { reset: false, replaceState });
			}
		});
	};

	/** 인접 라우트 코드 프리로드 */
	preloadRoutes = (): void => {
		for (const sec of MAIN_SECTIONS) {
			void preloadCode(sec.routeId);
		}
	};

	cleanup = (): void => {
		clearTimeout(this.swipeFallbackTimer);
		this.slideController.cancel((sliding) => {
			this.isSliding = sliding;
		});
	};
}
