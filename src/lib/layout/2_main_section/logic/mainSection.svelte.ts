import { tick, untrack } from 'svelte';
import { goto, preloadCode } from '$app/navigation';
import { page } from '$app/state';
import { catalogFeed, detailOverlay, isMobile } from '#lib/common/logic';
import { prefersReducedMotion } from '#lib/common/type/spring';
import {
	SLIDE_MOTION,
	createKeepAliveSlideController,
	resolveSlideDirection,
	type SlideDirection
} from './keepAliveSlide';
import { attachMobileSwipe } from './mobileSwipe';
import { resolvePinnedTransition, shouldUseSmoothPcScroll } from './pinnedTransition';
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
	/** 각 카테고리별로 마지막에 열려 있던 상세 ID (카테고리 이동 후에도 유지) */
	sectionDetailIds = $state<Record<MainSectionKey, number | null>>({
		artist: null,
		concert: null,
		album: null,
		goods: null,
		mypage: null
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
	private pendingSmoothScrollFromY: number | null = null;
	private pendingExitingDeltaY = 0;
	private pendingFromHeaderHeight = 0;
	private pendingSwipeOffsetPx = 0;
	private pendingSwipeDurationMs = 0;
	private lastTrackedSection: MainSectionKey | null = null;
	private swipeFallbackTimer: ReturnType<typeof setTimeout> | undefined;
	private transitionScrollRafId = 0;

	private cancelTransitionScroll(): void {
		if (this.transitionScrollRafId) {
			cancelAnimationFrame(this.transitionScrollRafId);
			this.transitionScrollRafId = 0;
		}
	}

	private animateTransitionScroll(fromY: number, toY: number, durationMs: number): void {
		this.cancelTransitionScroll();
		if (typeof window === 'undefined') return;
		if (Math.abs(toY - fromY) <= 1 || prefersReducedMotion()) {
			window.scrollTo({ top: toY, left: 0, behavior: 'auto' });
			return;
		}

		window.scrollTo({ top: fromY, left: 0, behavior: 'auto' });
		const startTime = performance.now();
		const delta = toY - fromY;

		const step = (now: number) => {
			const t = Math.min(1, (now - startTime) / durationMs);
			const inv = 1 - t;
			const eased = 1 - inv * inv * inv;
			window.scrollTo({ top: Math.round(fromY + delta * eased), left: 0, behavior: 'auto' });
			if (t < 1) {
				this.transitionScrollRafId = requestAnimationFrame(step);
			} else {
				this.transitionScrollRafId = 0;
				window.scrollTo({ top: toY, left: 0, behavior: 'auto' });
			}
		};

		this.transitionScrollRafId = requestAnimationFrame(step);
	}

	constructor() {
		const initialKey = untrack(() => resolveMainSectionKey(page.url.pathname));
		const initialDetailId = untrack(() => parseMainSectionDetailId(page.url.pathname));
		if (initialKey) {
			this.mountedSections[initialKey] = true;
			this.sectionDetailIds[initialKey] = initialDetailId;
			this.lastTrackedSection = initialKey;
			this.headerSection = initialDetailId === null ? initialKey : null;
			this.controlSection =
				getMainSection(initialKey).supportsOptions && initialDetailId === null
					? initialKey
					: null;
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
		const key = resolveMainSectionKey(pathname);
		if (isMobile.current) {
			return key ? this.listScrollPositions[key] : 0;
		}
		const detailId = parseMainSectionDetailId(pathname);
		if (detailId !== null) {
			return this.detailScrollPositions[pathname] ?? 0;
		}
		return key ? this.listScrollPositions[key] : 0;
	};

	isSectionDetail = (key: MainSectionKey | null): boolean => {
		return Boolean(key && this.sectionDetailIds[key] !== null);
	};

	getSectionListScrollY = (key: MainSectionKey): number => {
		if (key === this.activeSection && typeof window !== 'undefined') {
			return Math.max(0, window.scrollY);
		}
		return this.listScrollPositions[key] ?? 0;
	};

	/** 라우트 변경 시 현재 섹션 마운트 및 전환 트리거 */
	syncCurrentRoute = (getPinnedHeaderHeight?: () => number): void => {
		const activeKey = this.activeSection;
		const pathname = this.pathname;
		const activeDetailId = this.activeDetailId;

		untrack(() => {
			catalogFeed.rememberCategoryRoute(pathname);
			if (activeKey) {
				this.ensureMounted(activeKey);
				this.sectionDetailIds[activeKey] = activeDetailId;
			}

			const prevKey = this.lastTrackedSection;
			if (activeKey === prevKey) {
				// 같은 카테고리 내 목록 <-> 상세 전환 시 헤더/컨트롤바 섹션 키 유지
				// (실제 숨김/언마운트는 MainSection에서 detailOverlay phase === 'open' 안착 시점에 처리해
				//  expanding 도중 헤더가 먼저 사라져 목록이 위로 점프하는 현상을 방지)
				if (activeKey) {
					const hasControl = getMainSection(activeKey).supportsOptions;
					this.headerSection = activeKey;
					this.controlSection = hasControl ? activeKey : null;
				}
				return;
			}
			this.lastTrackedSection = activeKey;

			if (prevKey && activeKey) {
				const fromY = this.preNavScrollY;
				const toY = this.pendingTargetScrollY ?? this.getSavedScrollY(pathname);
				const toIsDetail = activeDetailId !== null;
				const fromHeaderH = !isMobile.current ? this.pendingFromHeaderHeight : 0;
				const baseExitingDeltaY = this.pendingExitingDeltaY;
				this.pendingExitingDeltaY = 0;

				const initialToHeaderH =
					!isMobile.current && !toIsDetail ? (getPinnedHeaderHeight?.() ?? 0) : 0;

				this.exitingSection = prevKey;
				this.exitingDeltaY = baseExitingDeltaY + (fromHeaderH - initialToHeaderH);

				// 제자리 고정 영역(PC 헤더 · PC 옵션바 · 모바일 검색/필터 헤더)의 슬라이드 참여 여부 계산
				const pinnedPlan = resolvePinnedTransition({
					prevKey,
					activeKey,
					fromY,
					toY,
					isMobile: isMobile.current,
					fromIsDetail: this.isSectionDetail(prevKey),
					toIsDetail,
					headerHeight: initialToHeaderH || (this.pinnedHeaderEl?.offsetHeight ?? 0),
					controlHeight: this.pinnedControlEl?.offsetHeight ?? 0
				});

				const { headerSlideMode, controlSlideMode } = pinnedPlan;
				this.headerSection = pinnedPlan.headerSection;
				this.headerOffsetY = pinnedPlan.headerOffsetY;
				this.controlSection = pinnedPlan.controlSection;
				// PC 목록 -> 상세 퇴장 시 헤더가 overlay(높이 0)로 빠지므로 옵션바도 원래 헤더 높이만큼 아래에서 퇴장
				this.controlOffsetY =
					!isMobile.current && toIsDetail && controlSlideMode === 'out'
						? fromHeaderH
						: pinnedPlan.controlOffsetY;

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
					// 새 페이지의 pinnedHeader가 DOM에 마운트된 뒤 실제 높이를 재측정해 퇴장 페이지 Y 오프셋 정확히 보정
					if (!isMobile.current) {
						const actualToHeaderLayoutH = !toIsDetail
							? (this.pinnedHeaderEl?.offsetHeight ?? 0)
							: 0;
						this.exitingDeltaY = baseExitingDeltaY + (fromHeaderH - actualToHeaderLayoutH);
					}

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
							this.headerSection =
								this.activeSection && !this.isDetailRoute ? this.activeSection : null;
							this.headerOffsetY = 0;
							this.controlSection =
								this.activeSection &&
								getMainSection(this.activeSection).supportsOptions &&
								!this.isDetailRoute
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
				this.headerSection = activeKey && !this.isDetailRoute ? activeKey : null;
				this.headerOffsetY = 0;
				this.controlSection =
					activeKey && getMainSection(activeKey).supportsOptions && !this.isDetailRoute
						? activeKey
						: null;
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

		this.cancelTransitionScroll();
		this.preNavScrollY = Math.max(0, window.scrollY);
		this.pendingTargetScrollY = null;
		this.pendingSmoothScrollFromY = null;
		this.pendingExitingDeltaY = 0;
		this.pendingFromHeaderHeight = !isMobile.current ? pinnedHeaderHeight : 0;

		// 1) 같은 카테고리 내 목록 -> 상세 진입 (상세는 자체 고정 프레임에서 스크롤하므로 배경 목록 스크롤 위치 유지)
		if (fromKey && toKey === fromKey && fromDetailId === null && toDetailId !== null) {
			this.listScrollPositions[fromKey] = this.preNavScrollY;
			this.detailScrollPositions[toPath] = 0;
			this.pendingTargetScrollY = null;
			return;
		}

		// 2) 같은 카테고리 내 상세 -> 목록 복귀 (보존된 목록 스크롤이 현재 window.scrollY와 다르면 복원)
		if (fromKey && toKey === fromKey && fromDetailId !== null && toDetailId === null) {
			this.detailScrollPositions[fromPath] = 0;
			const savedListY = this.listScrollPositions[fromKey] ?? 0;
			this.pendingTargetScrollY =
				Math.abs(this.preNavScrollY - savedListY) > 1 ? savedListY : null;
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

			// PC에서 이전/다음 페이지 모두 217px 이하 스크롤이면, 헤더·옵션바를 제자리에 두고 부드럽게 스크롤 이동하며 전환
			const smoothPcHeaderTransition = shouldUseSmoothPcScroll({
				isMobile: isMobile.current,
				fromDetailId,
				toDetailId,
				fromY: this.preNavScrollY,
				toY: targetY
			});

			if (smoothPcHeaderTransition) {
				this.pendingSmoothScrollFromY = this.preNavScrollY;
				this.pendingExitingDeltaY = 0;
			} else {
				this.pendingExitingDeltaY = targetY - this.preNavScrollY;
			}

			const requiredHeight = Math.max(targetY, this.preNavScrollY);
			this.stageMinHeight = requiredHeight > 0 ? `${requiredHeight + window.innerHeight}px` : '';
		}
	};

	/** afterNavigate 훅 연결 */
	handleAfterNavigate = (): void => {
		if (typeof window === 'undefined') return;
		if (this.pendingTargetScrollY !== null) {
			const targetY = this.pendingTargetScrollY;
			const smoothFromY = this.pendingSmoothScrollFromY;
			this.pendingTargetScrollY = null;
			this.pendingSmoothScrollFromY = null;

			if (smoothFromY !== null) {
				this.animateTransitionScroll(smoothFromY, targetY, SLIDE_MOTION.enterDuration);
				return;
			}

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
			canStart: () =>
				isMobile.current && !this.isSliding && !detailOverlay.hasAnyTransitioning(),
			getActiveCategory: () => this.activeSection,
			getPaneEl: (key) => this.paneEls[key],
			getControlEl: () => this.pinnedControlEl,
			getControlDragRole: (originKey, previewKey) => {
				if (!originKey || !previewKey) return 'none';
				const originHas =
					getMainSection(originKey).supportsOptions && !this.isSectionDetail(originKey);
				const previewHas =
					getMainSection(previewKey).supportsOptions && !this.isSectionDetail(previewKey);
				if (originHas && !previewHas) return 'origin';
				if (!originHas && previewHas) return 'preview';
				return 'none';
			},
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
				// 현재 페이지에 옵션바가 없을 때(마이페이지 또는 상세 페이지) 카탈로그 목록으로 드래그 프리뷰 시
				// 상단 옵션바를 미리 마운트해 손가락과 함께 자연스럽게 슬라이드 인
				const active = this.activeSection;
				const activeHasControl = Boolean(
					active && getMainSection(active).supportsOptions && !this.isSectionDetail(active)
				);
				if (!activeHasControl) {
					const previewHasControl = Boolean(
						key && getMainSection(key).supportsOptions && !this.isSectionDetail(key)
					);
					this.controlSection = previewHasControl ? key : null;
				}
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
		this.cancelTransitionScroll();
		this.slideController.cancel((sliding) => {
			this.isSliding = sliding;
		});
	};
}
