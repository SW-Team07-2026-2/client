<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { DetailPhase } from '#lib/common/logic/detailOverlayState.svelte';
	import { detailSlideMotion } from '../logic/detailTransition';

	interface Props {
		itemId: number;
		phase: DetailPhase;
		onExpandFinish: () => void;
		onCloseFinish: () => void;
		onClose: () => void;
		children: Snippet<[{ id: number; close: () => void; mobile: boolean }]>;
	}

	let { itemId, phase, onExpandFinish, onCloseFinish, onClose, children }: Props = $props();
</script>

<!-- PC 전용 상세 프레임: 안착(open) 시 일반 문서 흐름(window 스크롤) · 열기/닫기 시 GPU 슬라이드 업/다운 -->
<div
	use:detailSlideMotion={{ phase, onExpandFinish, onCloseFinish }}
	class="pc-detail-frame"
	class:is-transitioning={phase === 'expanding' || phase === 'closing'}
	data-detail-phase={phase}
	role="region"
	aria-label="상세 페이지"
>
	<div class="pc-detail-body">
		{@render children({ id: itemId, close: onClose, mobile: false })}
	</div>
</div>

<style>
	.pc-detail-frame {
		position: relative;
		width: 100%;
		min-height: calc(100dvh - var(--pc-header-height, 70px));
		border-radius: var(--detail-frame-radius, 22px) var(--detail-frame-radius, 22px) 0 0;
		border-top: var(--detail-frame-border);
		background: var(--bg);
		overflow: clip;
		box-sizing: border-box;
	}

	/* 열기/닫기 슬라이드 전환 중에만 뷰포트 고정 레이어로 GPU transform 애니메이션 수행 */
	.pc-detail-frame.is-transitioning {
		position: fixed;
		top: var(--pc-header-height, 70px);
		left: 0;
		right: 0;
		bottom: 0;
		min-height: 0;
		z-index: 48;
		overflow: hidden;
		pointer-events: none;
		will-change: transform, opacity;
	}

	.pc-detail-body {
		position: relative;
		width: 100%;
		box-sizing: border-box;
	}
</style>
