<script lang="ts">
	import { onDestroy, type Snippet } from 'svelte';
	import type { CatalogCategoryKey } from '#lib/config/catalogFeed';
	import type {
		DetailMorphSeed,
		DetailPhase,
		DetailRect
	} from '#lib/common/logic/detailOverlayState.svelte';
	import { runDetailCloseAnimation, runDetailExpandAnimation } from '../logic/detailMorph';

	interface Props {
		category: CatalogCategoryKey;
		itemId: number;
		phase: DetailPhase;
		sliding: boolean;
		listScrollY: number;
		seed: DetailMorphSeed | null;
		resolveReturnRect: () => DetailRect | null;
		onExpandFinish: () => void;
		onCloseFinish: () => void;
		onClose: () => void;
		children: Snippet<[{ id: number; close: () => void; mobile: boolean }]>;
	}

	let {
		category,
		itemId,
		phase,
		sliding,
		listScrollY,
		seed,
		resolveReturnRect,
		onExpandFinish,
		onCloseFinish,
		onClose,
		children
	}: Props = $props();

	const MB_HEADER_PX = 60;

	let frameEl = $state<HTMLDivElement | null>(null);
	let contentEl = $state<HTMLDivElement | null>(null);
	let seedLayerEl = $state<HTMLDivElement | null>(null);
	let activeAnims: Animation[] = [];

	function cancelActiveAnims() {
		for (const anim of activeAnims) anim.cancel();
		activeAnims = [];
	}

	function getMbHeaderBottom(): number {
		if (typeof document === 'undefined') return MB_HEADER_PX;
		const header = document.querySelector<HTMLElement>('.mobile-top-header');
		if (header) {
			const bottom = Math.round(header.getBoundingClientRect().bottom);
			if (bottom > 0 && bottom <= 100) return bottom;
		}
		return MB_HEADER_PX;
	}

	$effect(() => {
		const curPhase = phase;
		const el = frameEl;
		if (!el) return;

		if (curPhase === 'expanding') {
			cancelActiveAnims();
			activeAnims = runDetailExpandAnimation(
				{
					frameEl: el,
					contentEl,
					seedEl: seedLayerEl,
					targetTop: getMbHeaderBottom(),
					seed
				},
				() => {
					activeAnims = [];
					onExpandFinish();
				}
			);
			return;
		}

		if (curPhase === 'closing') {
			cancelActiveAnims();
			activeAnims = runDetailCloseAnimation(
				{
					frameEl: el,
					contentEl,
					seedEl: seedLayerEl,
					targetTop: getMbHeaderBottom(),
					seed,
					returnRect: resolveReturnRect()
				},
				() => {
					activeAnims = [];
					onCloseFinish();
				}
			);
		}
	});

	onDestroy(() => {
		cancelActiveAnims();
	});
</script>

<!-- 모바일 전용 상세 프레임: 상단 고정 MbHeader(60px)와 하단 MbNavigationBar 사이 전체를 차지하며 좌우 스와이프와 함께 슬라이드 -->
<div
	bind:this={frameEl}
	class="mb-detail-frame"
	class:is-sliding={sliding}
	class:is-transitioning={phase === 'expanding' || phase === 'closing'}
	style:top={sliding ? `${listScrollY}px` : undefined}
	data-detail-frame="{category}-{itemId}"
	data-detail-phase={phase}
	role="region"
	aria-label="상세 페이지"
>
	{#if seed?.imageSrc && (phase === 'expanding' || phase === 'closing')}
		<div bind:this={seedLayerEl} class="detail-seed-preview" aria-hidden="true">
			<img src={seed.imageSrc} alt="" class="detail-seed-img" />
		</div>
	{/if}

	<div bind:this={contentEl} class="mb-detail-scroll-body">
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
		will-change: left, top, width, height, border-radius, opacity;
	}

	/* 좌우 카테고리 스와이프·슬라이드 중에는 부모 .keepalive-pane 기준 절대 위치로 전환해
	   목록 스크롤 위치(listScrollY)와 무관하게 상단 헤더(60px) 바로 아래에 정확히 밀착 */
	.mb-detail-frame.is-sliding {
		position: absolute;
		bottom: auto;
		height: calc(100dvh - 60px);
	}

	.mb-detail-frame.is-transitioning {
		pointer-events: none;
	}

	.detail-seed-preview {
		position: absolute;
		inset: 0;
		z-index: 2;
		pointer-events: none;
		overflow: hidden;
		background: var(--surface);
	}

	.detail-seed-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 50% 40%;
		display: block;
	}

	.mb-detail-scroll-body {
		position: relative;
		z-index: 1;
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
