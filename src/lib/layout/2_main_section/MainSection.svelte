<script lang="ts">
	import { onDestroy, onMount, type Snippet } from 'svelte';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { ContentSection } from '../3_content_section';
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
		/** 메인 레지스트리에 속하지 않는 예외 라우트 폴백 슬롯 */
		children?: Snippet;
	}

	let { pinnedHeader, pinnedControl, children }: Props = $props();

	const ctrl = new MainSectionController();
	let stageEl = $state<HTMLDivElement | undefined>(undefined);
	let pinnedHeaderEl = $state<HTMLDivElement | undefined>(undefined);
	let pinnedControlHeight = $state(60);

	const activeDescriptor = $derived(
		ctrl.activeSection ? getMainSection(ctrl.activeSection) : null
	);
	const headerDescriptor = $derived(
		ctrl.headerSection ? getMainSection(ctrl.headerSection) : activeDescriptor
	);
	const controlDescriptor = $derived(
		ctrl.controlSection ? getMainSection(ctrl.controlSection) : null
	);

	function getPinnedHeaderHeight(): number {
		if (!pinnedHeaderEl) return 0;
		return Math.round(pinnedHeaderEl.getBoundingClientRect().height);
	}

	function getStageRect() {
		if (!stageEl) return null;
		const r = stageEl.getBoundingClientRect();
		if (r.width <= 0) return null;
		return { left: r.left, top: r.top, width: r.width, height: r.height };
	}

	// 하위 3_content_section 및 DetailOverlayFrame에 상세 확장 가로 기준 및 현재 섹션 상태 제공
	setMainSectionContext({
		getStageRect,
		getActiveSection: () => ctrl.activeSection,
		getActiveDetailId: () => ctrl.activeDetailId,
		getPinnedHeaderHeight
	});

	function bindPane(node: HTMLDivElement, key: MainSectionKey) {
		ctrl.registerPaneEl(key, node);
		return {
			destroy() {
				ctrl.registerPaneEl(key, undefined);
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
				ctrl.registerPinnedControlEl(undefined);
			}
		};
	}

	$effect.pre(() => {
		ctrl.syncCurrentRoute(getPinnedHeaderHeight);
	});

	beforeNavigate((nav) => {
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
		if (!stageEl) return;
		return ctrl.attachSwipe(stageEl);
	});

	onDestroy(() => {
		ctrl.cleanup();
	});
</script>

<svelte:head>
	<title>{ctrl.documentTitle}</title>
</svelte:head>

<!-- 2_main_section: 제자리 고정 영역(pinned) + 좌우 슬라이드 Keep-Alive 스테이지(상세 확장 기준) -->
<div
	class="main-section-root"
	class:is-sliding={ctrl.isSliding || ctrl.isSwiping}
	data-detail-stage
>
	<!-- 1) 좌우 이동 시 제자리에 유지되는 상단 헤더 영역 (PC 다이나믹 타이틀 헤더) -->
	{#if pinnedHeader && !ctrl.isDetailRoute}
		<div
			use:bindPinnedHeader
			class="main-pinned-header"
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
		class:is-sliding={ctrl.isSliding || ctrl.isSwiping}
		style:min-height={ctrl.stageMinHeight || undefined}
		style:--pc-pinned-control-height="{pinnedControlHeight}px"
	>
		<!-- 카탈로그 간 제자리 유지 / 마이페이지 전환 시에만 좌우 슬라이드되는 PC 옵션바 (0 높이 오버레이) -->
		{#if pinnedControl && !ctrl.isDetailRoute && controlDescriptor}
			<div
				use:bindPinnedControl
				class="main-pinned-control"
				style:top={ctrl.controlOffsetY !== 0 ? `${ctrl.controlOffsetY}px` : undefined}
				style:pointer-events={ctrl.controlOffsetY !== 0 ? 'none' : undefined}
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
						detailId={isActive ? ctrl.activeDetailId : null}
					/>
				</div>
			{/if}
		{/each}

		{#if ctrl.activeSection === null && children}
			<div class="fallback-route-pane">
				{@render children()}
			</div>
		{/if}
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

	.main-section-stage.is-sliding .main-pinned-control {
		will-change: transform;
	}

	.keepalive-pane {
		position: relative;
		width: 100%;
		min-height: 100%;
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

	.fallback-route-pane {
		width: 100%;
	}
</style>
