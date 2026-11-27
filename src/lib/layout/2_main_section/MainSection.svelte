<script lang="ts">
	import { onDestroy, onMount, type Snippet } from 'svelte';
	import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
	import { detailOverlay, isMobile } from '#lib/common/logic';
	import { resolveMobilePopstateRedirect } from '#lib/common/logic/detailNavigation';
	import { ContentSection } from '../3_content_section';
	import { syncDetailListFade } from '../3_content_section/logic/detailTransition';
	import { setMainSectionContext } from './logic/context';
	import type { SlideDirection } from './logic/keepAliveSlide';
	import { MainSectionController } from './logic/mainSection.svelte';
	import {
		MAIN_SECTIONS,
		getMainSection,
		type MainSectionDescriptor,
		type MainSectionKey
	} from './logic/sectionRegistry';

	interface Props {
		/**
		 * 좌우 전환 시 제자리에 남아 모핑/유지되어야 하는 상단 헤더 슬롯 (예: PC 다이나믹 타이틀 헤더)
		 * - 스크롤된 페이지에서 상단 페이지로 이동 시 새 페이지와 함께 좌우 슬라이드 진입
		 */
		pinnedHeader?: Snippet<
			[{ section: MainSectionDescriptor | null; isDetailRoute: boolean; routeDir: SlideDirection }]
		>;
		/**
		 * 카탈로그 간 전환 시 제자리에 유지되고, 마이페이지 전환 시에만 좌우 슬라이드되는 옵션바 슬롯
		 * - 레이아웃 높이를 점유하지 않고 스테이지 최상단에 오버레이되어 세로 점프를 원천 차단
		 */
		pinnedControl?: Snippet<
			[{ section: MainSectionDescriptor; isDetailRoute: boolean; routeDir: SlideDirection }]
		>;
		/** Keep-Alive로 유지되는 장바구니 · 주문/결제 플로우 슬롯 */
		payFlow?: Snippet<[{ active: boolean }]>;
		/** 현재 라우트가 장바구니 · 주문/결제 플로우인지 여부 */
		payFlowActive?: boolean;
		/** 메인 레지스트리에 속하지 않는 예외 라우트 폴백 슬롯 */
		children?: Snippet;
	}

	let { pinnedHeader, pinnedControl, payFlow, payFlowActive = false, children }: Props = $props();

	const ctrl = new MainSectionController();
	let stageEl = $state<HTMLDivElement | undefined>(undefined);
	let pinnedHeaderEl = $state<HTMLDivElement | undefined>(undefined);
	let pinnedControlEl = $state<HTMLDivElement | undefined>(undefined);
	let pinnedControlHeight = $state(60);
	let headerFadeAnim: Animation | null = null;
	let controlFadeAnim: Animation | null = null;

	const activeDescriptor = $derived(
		ctrl.activeSection ? getMainSection(ctrl.activeSection) : null
	);
	const activeDetailPhase = $derived(
		ctrl.activeSection && ctrl.activeSection !== 'mypage'
			? detailOverlay.getSlot(ctrl.activeSection).phase
			: 'closed'
	);
	// 상세 페이지가 완전히 안착(open)하고 좌우 슬라이드/퇴장 전환 중이 아닐 때만 고정 헤더/옵션바를 언마운트
	const hidePinnedForSettledDetail = $derived(
		ctrl.isDetailRoute &&
			!ctrl.isSliding &&
			!ctrl.isSwiping &&
			ctrl.exitingSection === null &&
			activeDetailPhase === 'open'
	);
	const headerDescriptor = $derived(
		!hidePinnedForSettledDetail && ctrl.headerSection ? getMainSection(ctrl.headerSection) : null
	);
	const controlDescriptor = $derived(
		!hidePinnedForSettledDetail && ctrl.controlSection ? getMainSection(ctrl.controlSection) : null
	);

	function getPinnedHeaderHeight(): number {
		if (!pinnedHeaderEl) return 0;
		return Math.round(pinnedHeaderEl.getBoundingClientRect().height);
	}

	// 하위 3_content_section에 좌우 슬라이드 상태 · 목록 스크롤 위치 제공
	setMainSectionContext({
		isSlidingOrSwiping: () => ctrl.isSliding || ctrl.isSwiping || ctrl.exitingSection !== null,
		getSectionListScrollY: ctrl.getSectionListScrollY
	});

	function bindPane(node: HTMLDivElement, key: MainSectionKey) {
		ctrl.registerPaneEl(key, node);
		return {
			destroy() {
				ctrl.registerPaneEl(key, undefined);
			}
		};
	}

	function bindFallbackPane(node: HTMLDivElement) {
		ctrl.registerFallbackPaneEl(node);
		return {
			destroy() {
				ctrl.registerFallbackPaneEl(undefined);
			}
		};
	}

	function bindFallbackExitHost(node: HTMLDivElement) {
		ctrl.registerFallbackExitHostEl(node);
		return {
			destroy() {
				ctrl.registerFallbackExitHostEl(undefined);
			}
		};
	}

	function bindPayFlowPane(node: HTMLDivElement) {
		ctrl.registerPayFlowPaneEl(node);
		return {
			destroy() {
				ctrl.registerPayFlowPaneEl(undefined);
			}
		};
	}

	function bindPinnedHeader(node: HTMLDivElement) {
		pinnedHeaderEl = node;
		ctrl.registerPinnedHeaderEl(node);
		return {
			destroy() {
				pinnedHeaderEl = undefined;
				ctrl.registerPinnedHeaderEl(undefined);
			}
		};
	}

	function bindPinnedControl(node: HTMLDivElement) {
		pinnedControlEl = node;
		ctrl.registerPinnedControlEl(node);
		const updateHeight = () => {
			const h = Math.round(node.getBoundingClientRect().height);
			if (h > 0) pinnedControlHeight = h;
		};
		updateHeight();
		const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateHeight) : null;
		ro?.observe(node);
		return {
			destroy() {
				ro?.disconnect();
				pinnedControlEl = undefined;
				ctrl.registerPinnedControlEl(undefined);
			}
		};
	}

	// 상세 열림(expanding) · 닫힘(closing) 전환 시 고정 헤더·옵션바도 목록과 함께 부드럽게 투명도 전환
	$effect(() => {
		const phase = activeDetailPhase;
		if (ctrl.isSliding || ctrl.isSwiping || ctrl.exitingSection !== null) return;
		if (pinnedHeaderEl) {
			headerFadeAnim = syncDetailListFade(pinnedHeaderEl, phase, headerFadeAnim);
		}
		if (pinnedControlEl) {
			controlFadeAnim = syncDetailListFade(pinnedControlEl, phase, controlFadeAnim);
		}
	});

	$effect.pre(() => {
		ctrl.syncCurrentRoute(getPinnedHeaderHeight);
	});

	beforeNavigate((nav) => {
		// 모바일 OS/브라우저 뒤로가기(popstate) 정책:
		// - 상세 페이지 -> 현재 보고 있는 카테고리의 목록으로 복귀
		// - 아티스트 외 목록/메인 탭 -> 아티스트 목록(`/artist`)으로 복귀
		if (nav.type === 'popstate') {
			const mobileRedirectTarget = resolveMobilePopstateRedirect(
				nav.from?.url.pathname,
				nav.to?.url.pathname
			);
			if (mobileRedirectTarget) {
				nav.cancel();
				setTimeout(() => {
					void goto(mobileRedirectTarget, { reset: false, replaceState: true });
				}, 0);
				return;
			}
		}

		ctrl.handleBeforeNavigate(
			nav.from?.url.pathname,
			nav.to?.url.pathname,
			getPinnedHeaderHeight()
		);
	});

	afterNavigate(() => {
		ctrl.handleAfterNavigate();
	});

	onMount(() => {
		ctrl.preloadRoutes();
		ctrl.premountIdleSections();
		if (!stageEl) return;
		return ctrl.attachSwipe(stageEl);
	});

	onDestroy(() => {
		headerFadeAnim?.cancel();
		controlFadeAnim?.cancel();
		ctrl.cleanup();
	});
</script>

<svelte:head>
	<title>{ctrl.documentTitle}</title>
</svelte:head>

<!-- 2_main_section: 제자리 고정 영역(pinned) + 좌우 슬라이드 Keep-Alive 스테이지 -->
<div
	class="main-section-root"
	class:is-sliding={ctrl.isSliding || ctrl.isSwiping || ctrl.exitingSection !== null}
	class:is-vertical-sliding={ctrl.isVerticalSliding}
>
	<!-- 1) 좌우 이동 시 제자리에 유지되는 상단 헤더 영역 (PC 다이나믹 타이틀 헤더) -->
	{#if pinnedHeader && headerDescriptor}
		<div
			use:bindPinnedHeader
			class="main-pinned-header"
			class:is-overlay-exit={(ctrl.isDetailRoute || ctrl.activeSection === null) &&
				(ctrl.isSliding || ctrl.exitingSection !== null)}
			style:top={ctrl.headerOffsetY !== 0 ? `${ctrl.headerOffsetY}px` : undefined}
			style:pointer-events={ctrl.headerOffsetY !== 0 ? 'none' : undefined}
		>
			{@render pinnedHeader({
				section: headerDescriptor,
				isDetailRoute: ctrl.isDetailRoute,
				routeDir: ctrl.routeDir
			})}
		</div>
	{/if}

	<!-- 2) 각 카테고리별 Keep-Alive 좌우 이동 스테이지 -->
	<div
		bind:this={stageEl}
		class="main-section-stage"
		class:is-sliding={ctrl.isSliding || ctrl.isSwiping || ctrl.exitingSection !== null}
		style:min-height={ctrl.stageMinHeight || undefined}
		style:--pc-pinned-control-height="{pinnedControlHeight}px"
	>
		<!-- 카탈로그 간 제자리 유지 / 마이페이지 전환 시에만 좌우 슬라이드되는 옵션바 (PC: 스테이지 최상단, 모바일: MbHeader 하단 뷰포트 고정) -->
		{#if pinnedControl && controlDescriptor}
			<div
				use:bindPinnedControl
				class="main-pinned-control"
				class:is-mobile-fixed={isMobile.current}
				style:top={!isMobile.current && ctrl.controlOffsetY !== 0
					? `${ctrl.controlOffsetY}px`
					: undefined}
				style:pointer-events={!isMobile.current && ctrl.controlOffsetY !== 0 ? 'none' : undefined}
			>
				{@render pinnedControl({
					section: controlDescriptor,
					isDetailRoute: ctrl.isDetailRoute,
					routeDir: ctrl.routeDir
				})}
			</div>
		{/if}
		{#each MAIN_SECTIONS as section (section.key)}
			{#if ctrl.mountedSections[section.key]}
				{@const isActive = ctrl.activeSection === section.key}
				{@const isExiting = ctrl.exitingSection === section.key}
				{@const isSwipePreview =
					!isActive && !isExiting && ctrl.swipePreviewSection === section.key}
				{@const isParked = !isActive && !isExiting && !isSwipePreview}
				{@const paneAbsTop =
					isExiting && ctrl.exitingDeltaY !== 0
						? ctrl.exitingDeltaY
						: isSwipePreview
							? ctrl.swipePreviewTop
							: null}
				<div
					use:bindPane={section.key}
					class="keepalive-pane"
					class:is-active={isActive}
					class:is-exiting={isExiting}
					class:is-swipe-preview={isSwipePreview}
					class:is-parked={isParked}
					inert={!isActive ? true : undefined}
					aria-hidden={!isActive ? true : undefined}
					style:position={paneAbsTop !== null ? 'absolute' : undefined}
					style:top={paneAbsTop !== null ? `${paneAbsTop}px` : undefined}
					style:left={paneAbsTop !== null ? '0' : undefined}
					style:right={paneAbsTop !== null ? '0' : undefined}
				>
					<ContentSection
						{section}
						active={isActive}
						detailId={ctrl.sectionDetailIds[section.key]}
					/>
				</div>
			{/if}
		{/each}

		{#if payFlow}
			<div
				use:bindPayFlowPane
				class="pay-flow-keepalive"
				class:is-active={payFlowActive}
				class:is-exiting={ctrl.exitingPayFlow}
				class:is-parked={!payFlowActive && !ctrl.exitingPayFlow}
				inert={!payFlowActive ? true : undefined}
				aria-hidden={!payFlowActive ? true : undefined}
			>
				<div
					class="pay-flow-inner"
					style:transform={ctrl.exitingPayFlow && ctrl.payFlowExitTop !== 0
						? `translate3d(0, ${ctrl.payFlowExitTop}px, 0)`
						: undefined}
				>
					{@render payFlow({ active: payFlowActive })}
				</div>
			</div>
		{/if}

		{#if ctrl.activeSection === null && !payFlowActive && children}
			<div use:bindFallbackPane class="fallback-route-pane">
				{@render children()}
			</div>
		{/if}

		<!-- 독립 섹션(/cart, /checkout 등) -> 메인 복귀 시 위로 퇴장하는 스냅샷 호스트 -->
		<div use:bindFallbackExitHost class="fallback-exit-host" aria-hidden="true"></div>
	</div>
</div>

<style>
	.main-section-root {
		position: relative;
		width: 100%;
		min-height: 100%;
		display: flex;
		flex-direction: column;
		overflow-x: clip;
		overflow-y: visible;
	}

	.main-pinned-header {
		position: relative;
		z-index: 4;
		width: 100%;
	}

	/* 목록 -> 상세 전환 중 퇴장하는 헤더는 레이아웃 높이를 점유하지 않아 상세 페이지가 헤더 바로 아래에서 진입 */
	.main-pinned-header.is-overlay-exit {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		pointer-events: none;
	}

	.main-section-root.is-sliding .main-pinned-header {
		will-change: transform;
	}

	.main-section-stage {
		position: relative;
		flex: 1;
		width: 100%;
		min-height: 100%;
		overflow-x: clip;
		overflow-y: visible;
	}

	.main-pinned-control {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 3;
	}

	.main-pinned-control.is-mobile-fixed {
		position: fixed;
		top: 60px;
		left: 0;
		right: 0;
		z-index: 45;
		pointer-events: none;
	}

	/* 모바일 필터 오픈 시 하단 네비게이션(z:50)을 덮는 필터 오버레이(z:55)보다 필터 X 버튼이 위에 유지되도록 승격 */
	.main-pinned-control.is-mobile-fixed:has(:global(.mb-content-header.is-filter-open)) {
		z-index: 56;
	}

	.main-section-stage.is-sliding .main-pinned-control {
		will-change: transform;
	}

	.keepalive-pane {
		position: relative;
		width: 100%;
		min-height: 100%;
		contain: style;
	}

	.main-section-stage.is-sliding .keepalive-pane {
		will-change: transform;
	}

	.keepalive-pane.is-exiting,
	.keepalive-pane.is-swipe-preview {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		pointer-events: none;
	}

	.keepalive-pane.is-parked {
		display: none;
	}

	.main-section-root.is-vertical-sliding {
		overflow: clip;
	}

	.fallback-route-pane {
		position: relative;
		z-index: 2;
		width: 100%;
	}

	.main-section-root.is-vertical-sliding .fallback-route-pane,
	.main-section-root.is-vertical-sliding .pay-flow-keepalive {
		will-change: transform;
	}

	.pay-flow-keepalive {
		position: relative;
		z-index: 2;
		width: 100%;
		contain: style;
	}

	.pay-flow-keepalive.is-parked {
		display: none;
	}

	/* Keep-Alive 장바구니/결제 퇴장 시 cloneNode 없이 라이브 패널을 100dvh 커튼으로 잘라 위로 퇴장 */
	.pay-flow-keepalive.is-exiting {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 100dvh;
		overflow: hidden;
		background: var(--bg);
		z-index: 6;
		pointer-events: none;
		will-change: transform;
		-webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 84%, transparent 100%);
		mask-image: linear-gradient(to bottom, #000 0%, #000 84%, transparent 100%);
	}

	.pay-flow-inner {
		width: 100%;
	}

	.fallback-exit-host {
		position: fixed;
		inset: 0;
		z-index: 6;
		pointer-events: none;
		overflow: hidden;
	}

	/* 폴백 독립 페이지(/payments/* 등) 퇴장 시 현재 뷰포트(100dvh)만 잘라내고 하단 경계를 페이드 처리 */
	.fallback-exit-host :global(.fallback-exit-curtain) {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 100dvh;
		overflow: hidden;
		background: var(--bg);
		pointer-events: none;
		will-change: transform;
		-webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 84%, transparent 100%);
		mask-image: linear-gradient(to bottom, #000 0%, #000 84%, transparent 100%);
	}

	.fallback-exit-host :global(.fallback-exit-curtain)::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 72px;
		pointer-events: none;
		background: linear-gradient(to bottom, transparent, color-mix(in srgb, var(--bg) 72%, transparent));
	}
</style>
