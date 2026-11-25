<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { DetailPhase } from '#lib/common/logic/detailOverlayState.svelte';
	import { detailSlideMotion } from '../logic/detailTransition';

	interface Props {
		itemId: number;
		phase: DetailPhase;
		sliding: boolean;
		listScrollY: number;
		onExpandFinish: () => void;
		onCloseFinish: () => void;
		onClose: () => void;
		children: Snippet<[{ id: number; close: () => void; mobile: boolean }]>;
	}

	let {
		itemId,
		phase,
		sliding,
		listScrollY,
		onExpandFinish,
		onCloseFinish,
		onClose,
		children
	}: Props = $props();
</script>

<!-- 모바일 전용 상세 프레임: 상단 고정 MbHeader(60px) ~ 하단 MbNavigationBar 사이 · GPU 슬라이드 업/다운 및 좌우 스와이프 연동 -->
<div
	use:detailSlideMotion={{ phase, onExpandFinish, onCloseFinish }}
	class="mb-detail-frame"
	class:is-sliding={sliding}
	class:is-transitioning={phase === 'expanding' || phase === 'closing'}
	style:top={sliding ? `${listScrollY}px` : undefined}
	data-detail-phase={phase}
	role="region"
	aria-label="상세 페이지"
>
	<div class="mb-detail-scroll-body">
		{@render children({ id: itemId, close: onClose, mobile: true })}
	</div>
</div>

<style>
	.mb-detail-frame {
		position: fixed;
		top: 60px;
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
		height: calc(100dvh - 60px);
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
