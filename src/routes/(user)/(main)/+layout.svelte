<script lang="ts">
	import { onMount, tick, untrack, type Snippet } from 'svelte';
	import type { TransitionConfig } from 'svelte/transition';
	import { page } from '$app/state';
	import { beforeNavigate, afterNavigate, preloadCode } from '$app/navigation';
	import { MainLayout } from '#lib/components';
	import BotArea from '#lib/ai/BotArea.svelte';
	import ArtistSection from '#lib/components/feature/artist/ArtistSection.svelte';
	import ConcertSection from '#lib/components/feature/concert/ConcertSection.svelte';
	import AlbumSection from '#lib/components/feature/album/AlbumSection.svelte';
	import GoodsSection from '#lib/components/feature/goods/GoodsSection.svelte';
	import ContentFilterSection from '#lib/components/feature/filter/ContentFilterSection.svelte';
	import {
		DEFAULT_FOLLOW_SORT,
		clearSavedCategoryFilter,
		cloneContentFilterState,
		createEmptyFilterSlice,
		getSavedCategorySlice,
		getSavedFollowSort,
		saveFollowSort,
		type ContentFilterState
	} from '#lib/config/filter';
	import { catalogFeed, isMobile } from '#lib/stores';
	import type { CatalogCategoryKey } from '#lib/config/catalogFeed';
	import {
		DIRECTIONAL_BLUR_MOTION,
		directionalBlurIn,
		directionalBlurOut,
		resolveSlideDirection,
		type SlideDirection
	} from '#lib/utils/directionalBlur';
	import { prefersReducedMotion } from '#lib/fluid/spring';
	import { cancelSmoothScroll, smoothScrollToTop } from '#lib/utils/scroll';

	let { children }: { children: Snippet } = $props();

	let revealClearTimer: ReturnType<typeof setTimeout> | undefined;
	let preNavScrollY = 0;
	let isFullHeaderSlide = false;
	let slideScrollOffset = 0;
	let headerEl = $state<HTMLDivElement | undefined>(undefined);

	/** 스크롤된 상태에서 카테고리 전환 시 바닥 높이 붕괴 방지 */
	let stageMinHeight = $state<string>('');
	/** 스크롤된 상태에서 카테고리 전환 시 상단 도달 전까지 페이지 헤더 숨김 유지 */
	let isHeaderConcealedForNav = $state(false);
	/** 상단 도달 시 페이지 헤더를 부드럽게 페이드인+슬라이드업 시키는 상태 */
	let isHeaderRevealingFromNav = $state(false);
	let routeDir = $state<SlideDirection>(1);

	const CATEGORY_ORDER = ['/artist', '/concert', '/album', '/goods', '/mypage'] as const;

	function resolveRouteIndex(pathname?: string | null): number {
		if (!pathname) return -1;
		return CATEGORY_ORDER.findIndex(
			(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
		);
	}

	interface CategoryMeta {
		title: string;
		englishTitle?: string;
		description?: string;
		searchPlaceholder?: string;
		badge?: string;
	}

	const CATEGORY_MAP: Record<string, CategoryMeta> = {
		'/artist': {
			title: 'Artist',
			englishTitle: 'ARTIST',
			description: '인디 씬의 개성 넘치는 아티스트와 추천 피드를 만나보세요.',
			searchPlaceholder: '아티스트를 검색하세요...'
		},
		'/concert': {
			title: 'Concert',
			englishTitle: 'CONCERT',
			description: '라이브 공연과 페스티벌 일정 및 예매 정보를 확인하세요.',
			searchPlaceholder: '공연을 검색하세요...'
		},
		'/album': {
			title: 'Album',
			englishTitle: 'ALBUM & VINYL',
			description: '인디 음반 및 한정판 바이닐(LP) 발매와 재고 현황을 확인하세요.',
			searchPlaceholder: '앨범을 검색하세요...'
		},
		'/goods': {
			title: 'Merchandise',
			englishTitle: 'MERCHANDISE',
			description: '아티스트 공식 굿즈와 한정 머천다이즈를 둘러보세요.',
			searchPlaceholder: '굿즈를 검색하세요...'
		},
		'/mypage': {
			title: 'My Page',
			englishTitle: 'MY PAGE',
			description: '관심 아티스트, 위시리스트, 예매 내역 및 계정 설정을 관리하세요.',
			searchPlaceholder: '내 활동에서 검색하세요...'
		}
	};

	let currentMeta = $derived.by(() => {
		const pathname = page.url.pathname;
		const matchedKey = Object.keys(CATEGORY_MAP).find(
			(key) => pathname === key || pathname.startsWith(key + '/')
		);
		return matchedKey ? CATEGORY_MAP[matchedKey] : null;
	});

	let displayedMeta = $state<CategoryMeta | null>(null);
	let activeMeta = $derived(displayedMeta ?? currentMeta);

	function resolveCatalogCategoryByPath(pathname?: string | null): CatalogCategoryKey | null {
		if (!pathname) return null;
		if (pathname === '/artist') return 'artist';
		if (pathname === '/concert' || pathname.startsWith('/concert/')) return 'concert';
		if (pathname === '/album' || pathname.startsWith('/album/')) return 'album';
		if (pathname === '/goods' || pathname.startsWith('/goods/')) return 'goods';
		return null;
	}

	function resolveCatalogCategoryByTitle(title?: string | null): CatalogCategoryKey | null {
		if (title === 'Artist') return 'artist';
		if (title === 'Concert') return 'concert';
		if (title === 'Album') return 'album';
		if (title === 'Merchandise') return 'goods';
		return null;
	}

	let currentCatalogCategory = $derived(resolveCatalogCategoryByPath(page.url.pathname));
	let currentHeaderCategory = $derived(resolveCatalogCategoryByTitle(activeMeta?.title));

	const KEEP_ALIVE_CATEGORIES: readonly CatalogCategoryKey[] = [
		'artist',
		'concert',
		'album',
		'goods'
	];

	const KEEP_ALIVE_ROUTE_IDS = {
		artist: '/(user)/(main)/artist',
		concert: '/(user)/(main)/concert',
		album: '/(user)/(main)/album',
		goods: '/(user)/(main)/goods'
	} as const;

	const CATEGORY_TITLES: Record<CatalogCategoryKey, string> = {
		artist: 'INDIG - 아티스트',
		concert: 'INDIG - 공연',
		album: 'INDIG - 음반∙LP',
		goods: 'INDIG - 굿즈'
	};

	const CATEGORY_FILTER_NAME: Record<
		CatalogCategoryKey,
		'Artist' | 'Concert' | 'Album' | 'Merchandise'
	> = {
		artist: 'Artist',
		concert: 'Concert',
		album: 'Album',
		goods: 'Merchandise'
	};

	function buildCategoryFilterState(cat: CatalogCategoryKey, sort = ''): ContentFilterState {
		return {
			...getSavedCategorySlice(CATEGORY_FILTER_NAME[cat]),
			sort
		};
	}

	const initialCategory = untrack(() => resolveCatalogCategoryByPath(page.url.pathname));
	let mountedCategories = $state<Record<CatalogCategoryKey, boolean>>({
		artist: initialCategory === 'artist',
		concert: initialCategory === 'concert',
		album: initialCategory === 'album',
		goods: initialCategory === 'goods'
	});

	let filterOpen = $state(false);
	let filterMounted = $state(false);
	let filterUnmountTimer: ReturnType<typeof setTimeout> | undefined;
	let filterSectionRefs = $state<
		Partial<Record<CatalogCategoryKey, ReturnType<typeof ContentFilterSection>>>
	>({});
	let categoryFilterStates = $state<Record<CatalogCategoryKey, ContentFilterState>>({
		artist: buildCategoryFilterState('artist', untrack(() => catalogFeed.filterState.sort)),
		concert: buildCategoryFilterState('concert', untrack(() => catalogFeed.filterState.sort)),
		album: buildCategoryFilterState('album', untrack(() => catalogFeed.filterState.sort)),
		goods: buildCategoryFilterState('goods', untrack(() => catalogFeed.filterState.sort))
	});
	let syncedFilterCat: CatalogCategoryKey | null = null;
	let prevFeedFollow = untrack(() => catalogFeed.feedMode === 'follow');

	// 첫 마운트 시 자식 섹션(Artist/Concert/Album/GoodsSection)이 API를 호출하기 전에
	// 저장된 카테고리 필터·활성 카테고리를 스토어에 즉시 동기화해 새로고침 직후 첫 요청부터 필터를 반영
	untrack(() => {
		if (initialCategory) {
			const sort =
				catalogFeed.feedMode === 'follow'
					? catalogFeed.filterState.sort || getSavedFollowSort() || DEFAULT_FOLLOW_SORT
					: '';
			const synced = cloneContentFilterState({
				...categoryFilterStates[initialCategory],
				sort
			});
			categoryFilterStates[initialCategory] = synced;
			catalogFeed.activeCategory = initialCategory;
			catalogFeed.headerCategory = initialCategory;
			catalogFeed.filterState = cloneContentFilterState(synced);
			syncedFilterCat = initialCategory;
		}
	});

	$effect(() => {
		const isOpen = filterOpen;
		clearTimeout(filterUnmountTimer);
		if (isOpen) {
			filterMounted = true;
		} else if (filterMounted) {
			filterUnmountTimer = setTimeout(() => {
				filterMounted = false;
			}, 380);
		}
	});

	$effect.pre(() => {
		const follow = catalogFeed.feedMode === 'follow';
		if (follow === prevFeedFollow) return;
		prevFeedFollow = follow;
		untrack(() => {
			const nextSort = follow
				? catalogFeed.filterState.sort || getSavedFollowSort() || DEFAULT_FOLLOW_SORT
				: '';
			if (catalogFeed.filterState.sort !== nextSort) {
				catalogFeed.filterState = { ...catalogFeed.filterState, sort: nextSort };
			}
			for (const cat of KEEP_ALIVE_CATEGORIES) {
				if (categoryFilterStates[cat].sort !== nextSort) {
					categoryFilterStates[cat] = { ...categoryFilterStates[cat], sort: nextSort };
				}
			}
		});
	});

	function handlePaneFilterChange(cat: CatalogCategoryKey, nextState: ContentFilterState) {
		if (catalogFeed.feedMode === 'follow' && nextState.sort) {
			saveFollowSort(nextState.sort);
		}
		categoryFilterStates[cat] = cloneContentFilterState(nextState);
		if (currentCatalogCategory === cat) {
			catalogFeed.filterState = cloneContentFilterState(nextState);
		} else if (nextState.sort !== catalogFeed.filterState.sort) {
			catalogFeed.filterState = { ...catalogFeed.filterState, sort: nextState.sort };
		}
	}

	function handleHeaderFilterReset() {
		const activeCat = currentCatalogCategory;
		if (!activeCat) return;
		const ref = filterSectionRefs[activeCat];
		if (ref) {
			ref.resetAll();
			return;
		}
		clearSavedCategoryFilter(CATEGORY_FILTER_NAME[activeCat]);
		const cleared: ContentFilterState = {
			...createEmptyFilterSlice(),
			sort: catalogFeed.feedMode === 'follow' ? catalogFeed.filterState.sort : ''
		};
		categoryFilterStates[activeCat] = cleared;
		catalogFeed.filterState = cloneContentFilterState(cleared);
	}

	let paneEls = $state<Partial<Record<CatalogCategoryKey, HTMLDivElement>>>({});
	let filterShellEls = $state<Partial<Record<CatalogCategoryKey, HTMLDivElement>>>({});
	let exitingCategory = $state<CatalogCategoryKey | null>(null);
	let exitingDeltaY = $state(0);
	let isPaneSliding = $state(false);
	let exitClearTimer: ReturnType<typeof setTimeout> | undefined;
	let activeSlideToken = 0;
	let lastTrackedCategory: CatalogCategoryKey | null = initialCategory;
	let lastTrackedPath: string = untrack(() => page.url.pathname);

	// 카테고리별 독립 스크롤 위치 기억 (아티스트 -> 공연 -> 아티스트 복귀 시 기존 스크롤 복원)
	const categoryScrollPositions: Record<CatalogCategoryKey, number> = {
		artist: 0,
		concert: 0,
		album: 0,
		goods: 0
	};
	let pendingTargetScrollY: number | null = null;
	let pendingExitingDeltaY = 0;
	let isSmoothScrollingToTop = false;

	$effect.pre(() => {
		const activeCat = currentCatalogCategory;
		if (activeCat && !mountedCategories[activeCat]) {
			mountedCategories[activeCat] = true;
		}
		catalogFeed.activeCategory = activeCat;
		catalogFeed.headerCategory = currentHeaderCategory;

		if (activeCat && activeCat !== syncedFilterCat) {
			syncedFilterCat = activeCat;
			const sort = catalogFeed.feedMode === 'follow' ? catalogFeed.filterState.sort : '';
			const synced = cloneContentFilterState({
				...categoryFilterStates[activeCat],
				sort
			});
			categoryFilterStates[activeCat] = synced;
			catalogFeed.filterState = cloneContentFilterState(synced);
		} else if (!activeCat) {
			syncedFilterCat = null;
		}
	});

	function createPaneSlideAnimation(
		el: HTMLElement | undefined,
		kind: 'in' | 'out',
		dir: SlideDirection
	): Animation | null {
		if (!el) return null;
		el.getAnimations().forEach((a) => a.cancel());

		const offsetX = `${(kind === 'in' ? dir : -dir) * DIRECTIONAL_BLUR_MOTION.distance}%`;
		const keyframes =
			kind === 'in'
				? [
						{ transform: `translate3d(${offsetX}, 0, 0)` },
						{ transform: 'translate3d(0, 0, 0)' }
					]
				: [
						{ transform: 'translate3d(0, 0, 0)' },
						{ transform: `translate3d(${offsetX}, 0, 0)` }
					];

		const anim = el.animate(keyframes, {
			duration:
				kind === 'in'
					? DIRECTIONAL_BLUR_MOTION.enterDuration
					: DIRECTIONAL_BLUR_MOTION.exitDuration,
			easing: DIRECTIONAL_BLUR_MOTION.easeCss,
			fill: kind === 'in' ? 'backwards' : 'forwards'
		});
		// 첫 페인트·레이어 업로드를 마친 뒤 out/in을 동일 VSync startTime으로 동시 출발시켜 프레임 드롭 방지
		anim.pause();
		return anim;
	}

	function finishKeepAliveSlide(token: number, prevEl?: HTMLElement, nextEl?: HTMLElement) {
		if (token !== activeSlideToken) return;
		clearTimeout(exitClearTimer);
		exitingCategory = null;
		exitingDeltaY = 0;
		isPaneSliding = false;
		if (!isSmoothScrollingToTop) {
			stageMinHeight = '';
		}
		void tick().then(() => {
			if (token !== activeSlideToken) return;
			prevEl?.getAnimations().forEach((a) => a.cancel());
			nextEl?.getAnimations().forEach((a) => a.cancel());
		});
	}

	function startKeepAliveSlide(
		prevEl: HTMLElement | undefined,
		nextEl: HTMLElement | undefined,
		dir: SlideDirection
	) {
		clearTimeout(exitClearTimer);
		const token = ++activeSlideToken;

		if (prefersReducedMotion() || (!prevEl && !nextEl)) {
			finishKeepAliveSlide(token, prevEl, nextEl);
			return;
		}

		isPaneSliding = true;
		const outAnim = createPaneSlideAnimation(prevEl, 'out', dir);
		const inAnim = createPaneSlideAnimation(nextEl, 'in', dir);
		const anims = [outAnim, inAnim].filter((a): a is Animation => a !== null);
		if (anims.length === 0) {
			finishKeepAliveSlide(token, prevEl, nextEl);
			return;
		}

		const fallbackMs = Math.max(
			DIRECTIONAL_BLUR_MOTION.enterDuration,
			DIRECTIONAL_BLUR_MOTION.exitDuration
		) + 120;
		exitClearTimer = setTimeout(() => {
			finishKeepAliveSlide(token, prevEl, nextEl);
		}, fallbackMs);

		void Promise.all(anims.map((a) => a.ready))
			.then(() => {
				if (token !== activeSlideToken) {
					for (const a of anims) a.cancel();
					return;
				}
				const syncStart =
					typeof document !== 'undefined' ? (document.timeline?.currentTime ?? null) : null;
				for (const a of anims) {
					a.play();
					if (syncStart !== null) {
						a.startTime = syncStart;
					}
				}
				void Promise.allSettled(anims.map((a) => a.finished)).then(() => {
					finishKeepAliveSlide(token, prevEl, nextEl);
				});
			})
			.catch(() => {
				finishKeepAliveSlide(token, prevEl, nextEl);
			});
	}

	$effect(() => {
		const nextCat = currentCatalogCategory;
		const nextPath = page.url.pathname;
		if (nextPath === lastTrackedPath && nextCat === lastTrackedCategory) return;

		const prevCat = lastTrackedCategory;
		const prevPath = lastTrackedPath;
		lastTrackedCategory = nextCat;
		lastTrackedPath = nextPath;

		untrack(() => {
			const prevEl = prevCat && prevCat !== nextCat ? paneEls[prevCat] : undefined;
			const nextEl = nextCat && nextCat !== prevCat ? paneEls[nextCat] : undefined;

			if (prevCat && prevCat !== nextCat) {
				exitingCategory = prevCat;
				exitingDeltaY = pendingExitingDeltaY;
			} else {
				exitingCategory = null;
				exitingDeltaY = 0;
			}
			pendingExitingDeltaY = 0;

			if (prevEl || nextEl) {
				startKeepAliveSlide(prevEl, nextEl, routeDir);
			} else {
				activeSlideToken += 1;
				clearTimeout(exitClearTimer);
				isPaneSliding = false;
			}
		});
	});

	function buildProximityPreloadOrder(anchor: CatalogCategoryKey | null): CatalogCategoryKey[] {
		const center = anchor ? KEEP_ALIVE_CATEGORIES.indexOf(anchor) : 0;
		return [...KEEP_ALIVE_CATEGORIES]
			.filter((cat) => cat !== anchor)
			.sort((a, b) => {
				const da = Math.abs(KEEP_ALIVE_CATEGORIES.indexOf(a) - center);
				const db = Math.abs(KEEP_ALIVE_CATEGORIES.indexOf(b) - center);
				return da - db || KEEP_ALIVE_CATEGORIES.indexOf(a) - KEEP_ALIVE_CATEGORIES.indexOf(b);
			});
	}

	$effect(() => {
		catalogFeed.syncSearchQuery(catalogFeed.searchQuery);
	});

	// 스크롤이 거의 없는 상태에서의 전환이거나 초기 진입 시에는 즉시 메타 반영
	$effect(() => {
		const next = currentMeta;
		if (!isHeaderConcealedForNav) {
			displayedMeta = next;
		}
	});

	const headerInlineOpacity = $derived(isHeaderConcealedForNav ? 0 : 1);

	const headerInlineTransform = $derived(
		isHeaderConcealedForNav ? 'translate3d(0, 14px, 0)' : 'translate3d(0, 0px, 0)'
	);

	function triggerHeaderReveal() {
		if (!isHeaderConcealedForNav) return;
		isHeaderConcealedForNav = false;
		isHeaderRevealingFromNav = true;
		displayedMeta = currentMeta;

		clearTimeout(revealClearTimer);
		revealClearTimer = setTimeout(() => {
			isHeaderRevealingFromNav = false;
		}, 440);
	}

	/**
	 * 페이지 전환 시 스크롤이 내려가 있다면 상단으로 부드럽게 끌어올리는 커스텀 이징 스크롤
	 */
	function handleNavScrollToTop(initialY?: number) {
		if (typeof window === 'undefined') return;
		const startY = initialY !== undefined ? Math.max(initialY, window.scrollY) : window.scrollY;
		if (startY <= 2) {
			isSmoothScrollingToTop = false;
			stageMinHeight = '';
			triggerHeaderReveal();
			return;
		}

		isSmoothScrollingToTop = true;
		// 새 페이지 컨텐츠가 짧아도 스크롤 도중 바닥이 붕괴되어 튕기지 않도록 일시적 높이 유지
		stageMinHeight = `${startY + window.innerHeight}px`;

		smoothScrollToTop({
			initialY: startY,
			onProgress: (nextY, t) => {
				// 상단 근처에 도달하면 숨겨둔 페이지 헤더를 부드럽게 페이드인 + 텍스트 모핑 시작
				if (isHeaderConcealedForNav && (nextY <= 28 || t >= 0.65)) {
					triggerHeaderReveal();
				}
			},
			onComplete: () => {
				isSmoothScrollingToTop = false;
				stageMinHeight = '';
				triggerHeaderReveal();
			}
		});
	}

	function isHeaderScrolledPastTop(activeCat: CatalogCategoryKey | null = currentCatalogCategory): boolean {
		if (!headerEl || typeof window === 'undefined') return false;
		const pcHeaderHeight =
			parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pc-header-height')) ||
			70;
		let bottom = headerEl.getBoundingClientRect().bottom;
		if (filterOpen && activeCat) {
			const filterEl = filterShellEls[activeCat];
			if (filterEl) {
				bottom = Math.max(bottom, filterEl.getBoundingClientRect().bottom);
			}
		}
		return bottom <= pcHeaderHeight;
	}

	function playHeaderDirectionalSlide(dir: SlideDirection) {
		if (!headerEl || prefersReducedMotion()) return;
		headerEl.getAnimations().forEach((anim) => anim.cancel());
		headerEl.animate(
			[
				{
					transform: `translate3d(${dir * DIRECTIONAL_BLUR_MOTION.distance}%, 0, 0)`
				},
				{
					transform: 'translate3d(0, 0, 0)'
				}
			],
			{
				duration: DIRECTIONAL_BLUR_MOTION.enterDuration,
				easing: DIRECTIONAL_BLUR_MOTION.easeCss,
				fill: 'both'
			}
		);
	}

	beforeNavigate((nav) => {
		if (typeof window === 'undefined') return;
		const fromPath = nav.from?.url.pathname;
		const toPath = nav.to?.url.pathname;

		const fromCat = resolveCatalogCategoryByPath(fromPath);
		const toCat = resolveCatalogCategoryByPath(toPath);

		const fromIdx = resolveRouteIndex(fromPath);
		const toIdx = resolveRouteIndex(toPath);
		if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
			routeDir = resolveSlideDirection(fromIdx, toIdx);
		}

		isFullHeaderSlide = false;
		slideScrollOffset = 0;
		pendingTargetScrollY = null;
		pendingExitingDeltaY = 0;

		if (fromPath && toPath && fromPath !== toPath) {
			preNavScrollY = Math.max(0, window.scrollY);
			const pastHeaderAndFilter = isHeaderScrolledPastTop(fromCat);
			if (fromCat) {
				// 콘텐츠 헤더·필터 영역이 아직 화면에 보이는 정도라면 스크롤 기억을 비워 복귀 시 최상단처럼 노출
				const shouldRememberScroll = headerEl ? pastHeaderAndFilter : preNavScrollY > 140;
				categoryScrollPositions[fromCat] = shouldRememberScroll ? preNavScrollY : 0;
			}

			const targetY = toCat ? categoryScrollPositions[toCat] : 0;
			if (toCat) {
				pendingTargetScrollY = targetY;
			}

			// 저장된 스크롤 위치가 있는 카테고리로 복귀할 때는 해당 Y 위치로 바로 정렬하고
			// 퇴장 패널만 화면 상 상대 위치가 어긋나지 않도록 보정
			if (toCat && targetY > 0) {
				clearTimeout(revealClearTimer);
				cancelSmoothScroll();
				isSmoothScrollingToTop = false;
				isHeaderRevealingFromNav = false;
				isHeaderConcealedForNav = false;
				pendingExitingDeltaY = targetY - preNavScrollY;
				stageMinHeight = `${Math.max(targetY, preNavScrollY) + window.innerHeight}px`;
				return;
			}

			if (nav.type === 'popstate') {
				if (toCat) {
					clearTimeout(revealClearTimer);
					cancelSmoothScroll();
					isSmoothScrollingToTop = false;
					isHeaderRevealingFromNav = false;
					isHeaderConcealedForNav = false;
					pendingExitingDeltaY = -preNavScrollY;
				}
				return;
			}

			// 콘텐츠 헤더와 열린 필터 영역이 상단 헤더 위로 완전히 넘어간 경우에는 스크롤 모션 없이 콘텐츠 헤더까지 함께 좌우 전환
			if (pastHeaderAndFilter) {
				clearTimeout(revealClearTimer);
				cancelSmoothScroll();
				isSmoothScrollingToTop = false;
				isFullHeaderSlide = true;
				slideScrollOffset = preNavScrollY;
				pendingExitingDeltaY = -preNavScrollY;
				isHeaderRevealingFromNav = false;
				isHeaderConcealedForNav = false;
				stageMinHeight = '';
				return;
			}

			if (preNavScrollY > 2) {
				stageMinHeight = `${preNavScrollY + window.innerHeight}px`;
			}
			// 페이지 헤더가 스크롤되어 가려지기 시작한 상태(36px 초과)에서 카테고리를 바꾸면
			// 상단으로 스크롤되는 도중 헤더가 위에서 툭 떨어져 보이지 않도록 숨긴 뒤 상단 도달 시 소프트 리빌
			if (preNavScrollY > 36) {
				clearTimeout(revealClearTimer);
				isHeaderRevealingFromNav = false;
				isHeaderConcealedForNav = true;
			}
		}
	});

	afterNavigate((nav) => {
		const fromPath = nav.from?.url.pathname;
		const toPath = nav.to?.url.pathname;
		// 초기 로드나 동일 경로가 아닌 실제 페이지 전환 시 처리
		if (fromPath && toPath && fromPath !== toPath) {
			const toCat = resolveCatalogCategoryByPath(toPath);
			const targetY = pendingTargetScrollY;
			pendingTargetScrollY = null;

			if (toCat && targetY !== null && (targetY > 0 || nav.type === 'popstate')) {
				cancelSmoothScroll();
				isSmoothScrollingToTop = false;
				isHeaderConcealedForNav = false;
				isHeaderRevealingFromNav = false;
				displayedMeta = currentMeta;
				window.scrollTo({ top: targetY, left: 0, behavior: 'auto' });
				preNavScrollY = 0;
				requestAnimationFrame(() => {
					if (Math.abs(window.scrollY - targetY) > 1) {
						window.scrollTo({ top: targetY, left: 0, behavior: 'auto' });
					}
				});
				return;
			}

			if (nav.type === 'popstate') return;

			if (isFullHeaderSlide) {
				cancelSmoothScroll();
				isSmoothScrollingToTop = false;
				stageMinHeight = '';
				window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
				playHeaderDirectionalSlide(routeDir);
				preNavScrollY = 0;
				requestAnimationFrame(() => {
					isFullHeaderSlide = false;
					slideScrollOffset = 0;
				});
				return;
			}
			handleNavScrollToTop(preNavScrollY);
			preNavScrollY = 0;
		}
	});

	function contentBlurIn(node: Element): TransitionConfig {
		return directionalBlurIn(node, { dir: routeDir });
	}

	function contentBlurOut(node: Element): TransitionConfig {
		if (isFullHeaderSlide && slideScrollOffset > 0) {
			const el = node as HTMLElement;
			el.style.position = 'absolute';
			el.style.top = `${-slideScrollOffset}px`;
			el.style.left = '0';
			el.style.right = '0';
		}
		return directionalBlurOut(node, { dir: routeDir });
	}

	onMount(() => {
		let cancelled = false;
		const queue = buildProximityPreloadOrder(currentCatalogCategory);
		const timers: ReturnType<typeof setTimeout>[] = [];
		const idleIds: number[] = [];
		const win = window as Window & {
			requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
			cancelIdleCallback?: (id: number) => void;
		};

		const scheduleStep = (stepIdx: number) => {
			if (cancelled || stepIdx >= queue.length) return;
			const cat = queue[stepIdx];

			const runStep = () => {
				if (cancelled) return;
				void preloadCode(KEEP_ALIVE_ROUTE_IDS[cat]).catch(() => {});
				if (!mountedCategories[cat]) {
					mountedCategories[cat] = true;
				}
				const nextTimer = setTimeout(() => scheduleStep(stepIdx + 1), 380);
				timers.push(nextTimer);
			};

			if (typeof win.requestIdleCallback === 'function') {
				const id = win.requestIdleCallback(runStep, { timeout: 1200 });
				idleIds.push(id);
			} else {
				const t = setTimeout(runStep, 200);
				timers.push(t);
			}
		};

		// 첫 화면 우선 렌더링 후 유휴 시간에 인접 카테고리부터 순차 백그라운드 마운트
		const bootRaf = requestAnimationFrame(() => {
			if (cancelled) return;
			const startTimer = setTimeout(() => scheduleStep(0), 420);
			timers.push(startTimer);
		});

		return () => {
			cancelled = true;
			activeSlideToken += 1;
			cancelAnimationFrame(bootRaf);
			for (const t of timers) clearTimeout(t);
			for (const id of idleIds) win.cancelIdleCallback?.(id);
			clearTimeout(exitClearTimer);
			clearTimeout(filterUnmountTimer);
			cancelSmoothScroll();
			clearTimeout(revealClearTimer);
			catalogFeed.clearPendingDebounce();
		};
	});
</script>

<svelte:head>
	{#if currentCatalogCategory}
		<title>{CATEGORY_TITLES[currentCatalogCategory]}</title>
	{/if}
</svelte:head>

<MainLayout
	bind:headerEl
	title={activeMeta?.title}
	englishTitle={activeMeta?.englishTitle}
	description={activeMeta?.description}
	searchPlaceholder={activeMeta?.searchPlaceholder}
	badge={activeMeta?.badge}
	bind:feedMode={catalogFeed.feedMode}
	bind:searchQuery={catalogFeed.searchQuery}
	bind:filterOpen
	bind:filterState={catalogFeed.filterState}
	onFilterReset={handleHeaderFilterReset}
	onSearchSubmit={(val) => catalogFeed.commitSearch(val)}
	onRefresh={() => catalogFeed.triggerRefresh()}
	headerConcealed={isHeaderConcealedForNav}
	headerRevealing={isHeaderRevealingFromNav}
	headerOpacity={headerInlineOpacity}
	headerTransform={headerInlineTransform}
>
	<div
		class="route-stage"
		class:is-sliding={isPaneSliding}
		style:min-height={stageMinHeight || undefined}
	>
		{#each KEEP_ALIVE_CATEGORIES as category (category)}
			{#if mountedCategories[category]}
				{@const isActive = currentCatalogCategory === category}
				{@const isExiting = exitingCategory === category}
				{@const isParked = !isActive && !isExiting}
				<div
					bind:this={paneEls[category]}
					class="keepalive-pane"
					class:is-active={isActive}
					class:is-exiting={isExiting}
					class:is-parked={isParked}
					inert={!isActive ? true : undefined}
					aria-hidden={!isActive ? true : undefined}
					style:position={isExiting && exitingDeltaY !== 0 ? 'absolute' : undefined}
					style:top={isExiting && exitingDeltaY !== 0 ? `${exitingDeltaY}px` : undefined}
					style:left={isExiting && exitingDeltaY !== 0 ? '0' : undefined}
					style:right={isExiting && exitingDeltaY !== 0 ? '0' : undefined}
				>
					{#if !isMobile.current}
						<div bind:this={filterShellEls[category]} class="pane-filter-shell">
							<div
								class="pane-filter-drawer"
								class:is-open={filterOpen}
								aria-hidden={!filterOpen}
								inert={!filterOpen || undefined}
							>
								<div class="pane-filter-drawer-inner">
									<div class="pane-filter-drawer-content">
										{#if filterMounted}
											<ContentFilterSection
												bind:this={filterSectionRefs[category]}
												category={CATEGORY_FILTER_NAME[category]}
												feedMode={catalogFeed.feedMode}
												active={isActive}
												isolatedCategory={true}
												bind:filterState={categoryFilterStates[category]}
												onchange={(next) => handlePaneFilterChange(category, next)}
											/>
										{/if}
									</div>
								</div>
							</div>
						</div>
					{/if}

					<main class="catalog-container" class:is-mobile={isMobile.current}>
						{#if category === 'artist'}
							<ArtistSection active={isActive} />
						{:else if category === 'concert'}
							<ConcertSection active={isActive} />
						{:else if category === 'album'}
							<AlbumSection active={isActive} />
						{:else}
							<GoodsSection active={isActive} />
						{/if}
					</main>
				</div>
			{/if}
		{/each}

		{#if currentCatalogCategory === null}
			{#key page.url.pathname}
				<div class="route-transition-pane" in:contentBlurIn out:contentBlurOut>
					{@render children()}
				</div>
			{/key}
		{/if}
	</div>

	{#snippet overlay()}
		<!-- AI 어시스턴트 봇 & 대화창 (플로팅 봇 + 상단 도킹 모핑 + 말풍선 없는 마크다운 대화) -->
		<BotArea />
	{/snippet}
</MainLayout>

<style>
	.route-stage {
		position: relative;
		z-index: 1;
		isolation: isolate;
		display: grid;
		grid-template-columns: 100%;
		width: 100%;
		overflow-x: clip;
		contain: layout style;
	}

	.route-transition-pane,
	.keepalive-pane {
		grid-area: 1 / 1;
		position: relative;
		z-index: 2;
		width: 100%;
		min-width: 0;
		contain: layout style;
		backface-visibility: hidden;
	}

	.keepalive-pane.is-active {
		transform: translate3d(0, 0, 0);
		will-change: transform;
	}

	.keepalive-pane.is-exiting {
		will-change: transform;
		z-index: 1;
		pointer-events: none;
	}

	.route-stage.is-sliding .keepalive-pane {
		pointer-events: none;
	}

	.keepalive-pane.is-parked {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		overflow: hidden;
		opacity: 0;
		z-index: 0;
		pointer-events: none;
		contain: layout style paint;
	}

	.pane-filter-shell {
		width: 100%;
		max-width: var(--content-max-width);
		margin: 0 auto;
		padding: 0 var(--content-header-padding-x);
		box-sizing: border-box;
	}

	.pane-filter-drawer {
		display: grid;
		grid-template-rows: 0fr;
		opacity: 0;
		width: 100%;
		transition:
			grid-template-rows 0.36s cubic-bezier(0.22, 1, 0.36, 1),
			opacity 0.26s ease;
	}

	.pane-filter-drawer.is-open {
		grid-template-rows: 1fr;
		opacity: 1;
	}

	.keepalive-pane.is-parked .pane-filter-drawer,
	.keepalive-pane.is-exiting .pane-filter-drawer {
		transition: none;
	}

	.pane-filter-drawer-inner {
		min-height: 0;
		overflow: hidden;
	}

	.pane-filter-drawer-content {
		padding: 0.25rem 12px 0.35rem 8px;
		box-sizing: border-box;
	}

	.catalog-container {
		width: 100%;
		max-width: var(--content-max-width);
		margin: 0 auto;
		min-height: calc(100dvh - 60px);
		padding: 1.25rem var(--content-padding-x) 3.5rem;
		box-sizing: border-box;
		color: var(--fg);
	}

	.catalog-container.is-mobile {
		padding: 0.75rem var(--content-padding-x-mobile) 2.5rem;
	}

	@media (max-width: 768px) {
		.catalog-container {
			padding: 0.75rem var(--content-padding-x-mobile) 2.5rem;
		}
	}
</style>
