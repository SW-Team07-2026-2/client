<script lang="ts">
	import { tick, untrack, type Snippet } from 'svelte';
	import type { DetailPhase } from '#lib/common/logic/detailOverlayState.svelte';
	import { detailSlideMotion } from '../logic/detailTransition';

	interface Props {
		itemId: number | null;
		phase: DetailPhase;
		active: boolean;
		sliding: boolean;
		listScrollY: number;
		savedScrollTop?: number;
		onScrollChange?: (scrollTop: number) => void;
		onExpandFinish: () => void;
		onCloseFinish: () => void;
		onClose: () => void;
		children: Snippet<[{ id: number | null; close: () => void; mobile: boolean }]>;
	}

	let {
		itemId,
		phase,
		active,
		sliding,
		listScrollY,
		savedScrollTop = 0,
		onScrollChange,
		onExpandFinish,
		onCloseFinish,
		onClose,
		children
	}: Props = $props();

	let scrollBodyEl = $state<HTMLDivElement | null>(null);
	const isShown = $derived(active || sliding);
	let restoringScroll = false;

	// Keep-Alive 파킹(display: none) 해제, 아이템 전환, 또는 슬라이드 종료(absolute -> fixed 레이어 전환) 시
	// 브라우저가 scrollTop을 0으로 리셋하는 현상을 막고 아이템별 독립 스크롤 위치를 복원합니다.
	$effect(() => {
		const el = scrollBodyEl;
		const shown = isShown;
		void itemId;
		void sliding;
		if (!el || !shown) return;

		const targetTop = untrack(() => savedScrollTop);
		restoringScroll = true;
		el.scrollTop = targetTop;

		let cancelled = false;
		let raf1 = 0;
		let raf2 = 0;

		void tick().then(() => {
			if (cancelled || !scrollBodyEl) return;
			scrollBodyEl.scrollTop = targetTop;
			raf1 = requestAnimationFrame(() => {
				if (cancelled || !scrollBodyEl) return;
				if (Math.abs(scrollBodyEl.scrollTop - targetTop) > 1) {
					scrollBodyEl.scrollTop = targetTop;
				}
				raf2 = requestAnimationFrame(() => {
					if (!cancelled) {
						restoringScroll = false;
					}
				});
			});
		});

		return () => {
			cancelled = true;
			if (raf1) cancelAnimationFrame(raf1);
			if (raf2) cancelAnimationFrame(raf2);
			restoringScroll = false;
		};
	});

	function handleBodyScroll() {
		if (restoringScroll || !scrollBodyEl || !active || sliding || phase !== 'open') return;
		onScrollChange?.(scrollBodyEl.scrollTop);
	}
</script>

<!-- 모바일 전용 상세 프레임: 뷰포트 최상단(0)부터 채워 상단 MbHeader(60px) 뒤로 블러·콘텐츠가 자연스럽게 비치도록 구성 -->
<div
	use:detailSlideMotion={{ phase, onExpandFinish, onCloseFinish }}
	class="mb-detail-frame"
	class:is-sliding={sliding}
	class:is-transitioning={phase === 'expanding' || phase === 'closing'}
	style:top={sliding ? `${listScrollY - 60}px` : undefined}
	data-detail-phase={phase}
	role="region"
	aria-label="상세 페이지"
>
	<div bind:this={scrollBodyEl} class="mb-detail-scroll-body" onscroll={handleBodyScroll}>
		{@render children({ id: itemId, close: onClose, mobile: true })}
	</div>
</div>

<style>
	.mb-detail-frame {
		--mb-detail-top-offset: 60px;
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 48;
		background: var(--bg);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		will-change: transform, opacity;
	}

	.mb-detail-frame.is-sliding {
		position: absolute;
		bottom: auto;
		height: 100dvh;
	}

	.mb-detail-frame.is-transitioning {
		pointer-events: none;
	}

	.mb-detail-scroll-body {
		position: relative;
		flex: 1;
		width: 100%;
		height: 100%;
		overflow-y: auto;
		overscroll-behavior: contain;
		box-sizing: border-box;
		padding-bottom: calc(
			var(--mobile-bottom-bar-height, 72px) + 16px + env(safe-area-inset-bottom, 0px)
		);
	}

	.mb-detail-frame.is-transitioning .mb-detail-scroll-body {
		overflow: hidden;
	}
</style>
