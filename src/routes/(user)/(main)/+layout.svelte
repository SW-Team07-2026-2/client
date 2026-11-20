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
	import { artistTransition, catalogFeed, isMobile } from '#lib/stores';
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

	function isArtistDetailRoute(pathname?: string | null): boolean {
		return Boolean(pathname && /^\/artist\/\d+\/?$/.test(pathname));
	}

	function isArtistDetailPair(fromPath?: string | null, toPath?: string | null): boolean {
		return (
			(fromPath === '/artist' && isArtistDetailRoute(toPath)) ||
			(isArtistDetailRoute(fromPath) && toPath === '/artist')
		);
	}

	let currentMeta = $derived.by(() => {
		const pathname = page.url.pathname;
		if (isArtistDetailRoute(pathname)) return null;
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

	const initialCategory = untrack(() => resolveCatalogCategoryByPath(page.url.pathname));
	let mountedCategories = $state<Record<CatalogCategoryKey, boolean>>({
		artist: initialCategory === 'artist',
		concert: initialCategory === 'concert',
		album: initialCategory === 'album',
		goods: initialCategory === 'goods'
	});

	let paneEls = $state<Partial<Record<CatalogCategoryKey, HTMLDivElement>>>({});
	let exitingCategory = $state<CatalogCategoryKey | null>(null);
	let exitingScrollOffset = $state(0);
	let exitClearTimer: ReturnType<typeof setTimeout> | undefined;
	let lastTrackedCategory: CatalogCategoryKey | null = initialCategory;
	let lastTrackedPath: string = untrack(() => page.url.pathname);

	$effect.pre(() => {
		const activeCat = currentCatalogCategory;
		if (activeCat && !mountedCategories[activeCat]) {
			mountedCategories[activeCat] = true;
		}
		catalogFeed.activeCategory = activeCat;
		catalogFeed.headerCategory = currentHeaderCategory;
	});

	function animateKeepAlivePane(
		el: HTMLElement | undefined,
		kind: 'in' | 'out',
		dir: SlideDirection
	) {
		if (!el || prefersReducedMotion()) return;
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

		el.animate(keyframes, {
			duration:
				kind === 'in'
					? DIRECTIONAL_BLUR_MOTION.enterDuration
					: DIRECTIONAL_BLUR_MOTION.exitDuration,
			easing: DIRECTIONAL_BLUR_MOTION.easeCss,
			fill: kind === 'in' ? 'backwards' : 'forwards'
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
			if (isArtistDetailPair(prevPath, nextPath) || artistTransition.vtPhase !== 'idle') {
				clearTimeout(exitClearTimer);
				exitingCategory = null;
				exitingScrollOffset = 0;
				return;
			}

			clearTimeout(exitClearTimer);
			if (prevCat && prevCat !== nextCat) {
				exitingCategory = prevCat;
				exitingScrollOffset = isFullHeaderSlide && slideScrollOffset > 0 ? slideScrollOffset : 0;
				const prevEl = paneEls[prevCat];
				animateKeepAlivePane(prevEl, 'out', routeDir);
				exitClearTimer = setTimeout(() => {
					if (exitingCategory === prevCat) {
						exitingCategory = null;
						exitingScrollOffset = 0;
					}
					void tick().then(() => {
						prevEl?.getAnimations().forEach((a) => a.cancel());
					});
				}, DIRECTIONAL_BLUR_MOTION.exitDuration);
			} else {
				exitingCategory = null;
				exitingScrollOffset = 0;
			}

			if (nextCat && nextCat !== prevCat) {
				animateKeepAlivePane(paneEls[nextCat], 'in', routeDir);
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
			stageMinHeight = '';
			triggerHeaderReveal();
			return;
		}

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
				stageMinHeight = '';
				triggerHeaderReveal();
			}
		});
	}

	function isHeaderScrolledPastTop(): boolean {
		if (!headerEl || typeof window === 'undefined') return false;
		const pcHeaderHeight =
			parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pc-header-height')) ||
			70;
		return headerEl.getBoundingClientRect().bottom <= pcHeaderHeight;
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
		if (isArtistDetailPair(fromPath, toPath)) return;

		const fromIdx = resolveRouteIndex(fromPath);
		const toIdx = resolveRouteIndex(toPath);
		if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
			routeDir = resolveSlideDirection(fromIdx, toIdx);
		}

		isFullHeaderSlide = false;
		slideScrollOffset = 0;

		if (fromPath && toPath && fromPath !== toPath && nav.type !== 'popstate') {
			preNavScrollY = window.scrollY;

			// 콘텐츠 헤더가 상단 헤더 위로 완전히 넘어간 경우에는 스크롤 모션 없이 콘텐츠 헤더까지 함께 좌우 블러 전환
			if (isHeaderScrolledPastTop()) {
				clearTimeout(revealClearTimer);
				cancelSmoothScroll();
				isFullHeaderSlide = true;
				slideScrollOffset = preNavScrollY;
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
		if (isArtistDetailPair(fromPath, toPath)) return;
		// 초기 로드나 동일 경로가 아닌 실제 페이지 전환 시 처리
		if (fromPath && toPath && fromPath !== toPath && nav.type !== 'popstate') {
			if (isFullHeaderSlide) {
				cancelSmoothScroll();
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
		if (artistTransition.vtPhase !== 'idle') return { duration: 0 };
		return directionalBlurIn(node, { dir: routeDir });
	}

	function contentBlurOut(node: Element): TransitionConfig {
		if (artistTransition.vtPhase !== 'idle') return { duration: 0 };
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
			cancelAnimationFrame(bootRaf);
			for (const t of timers) clearTimeout(t);
			for (const id of idleIds) win.cancelIdleCallback?.(id);
			clearTimeout(exitClearTimer);
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
	bind:filterState={catalogFeed.filterState}
	onSearchSubmit={(val) => catalogFeed.commitSearch(val)}
	onRefresh={() => catalogFeed.triggerRefresh()}
	headerConcealed={isHeaderConcealedForNav}
	headerRevealing={isHeaderRevealingFromNav}
	headerOpacity={headerInlineOpacity}
	headerTransform={headerInlineTransform}
>
	<div class="route-stage" style:min-height={stageMinHeight || undefined}>
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
					style:position={isExiting && exitingScrollOffset > 0 ? 'absolute' : undefined}
					style:top={isExiting && exitingScrollOffset > 0 ? `${-exitingScrollOffset}px` : undefined}
					style:left={isExiting && exitingScrollOffset > 0 ? '0' : undefined}
					style:right={isExiting && exitingScrollOffset > 0 ? '0' : undefined}
				>
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

	.keepalive-pane.is-active,
	.keepalive-pane.is-exiting {
		will-change: transform;
	}

	.keepalive-pane.is-exiting {
		z-index: 1;
		pointer-events: none;
	}

	.keepalive-pane.is-parked {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		overflow: hidden;
		visibility: hidden;
		pointer-events: none;
		contain: layout style paint;
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
