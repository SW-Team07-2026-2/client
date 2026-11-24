<script lang="ts">
	import { onDestroy, type Snippet } from 'svelte';
	import type { CatalogCategoryKey } from '#lib/config/catalogFeed';
	import type {
		DetailMorphSeed,
		DetailPhase,
		DetailRect
	} from '#lib/common/logic/detailOverlayState.svelte';
	import {
		runDetailCloseAnimation,
		runDetailExpandAnimation,
		type DetailTargetBox
	} from '../logic/detailMorph';

	interface Props {
		category: CatalogCategoryKey;
		itemId: number;
		phase: DetailPhase;
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
		seed,
		resolveReturnRect,
		onExpandFinish,
		onCloseFinish,
		onClose,
		children
	}: Props = $props();

	const PC_HEADER_PX = 70;

	let frameEl = $state<HTMLDivElement | null>(null);
	let contentEl = $state<HTMLDivElement | null>(null);
	let seedLayerEl = $state<HTMLDivElement | null>(null);
	let activeAnims: Animation[] = [];
	let closeRafId = 0;

	function cancelActiveAnims() {
		if (closeRafId) {
			cancelAnimationFrame(closeRafId);
			closeRafId = 0;
		}
		for (const anim of activeAnims) anim.cancel();
		activeAnims = [];
	}

	function getPcHeaderBottom(): number {
		if (typeof document === 'undefined') return PC_HEADER_PX;
		const header = document.querySelector<HTMLElement>('.main-header, header');
		if (header) {
			const bottom = Math.round(header.getBoundingClientRect().bottom);
			if (bottom > 0 && bottom <= 120) return bottom;
		}
		return PC_HEADER_PX;
	}

	function getPcTargetBox(): DetailTargetBox {
		const headerBottom = getPcHeaderBottom();
		const rootStyle =
			typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null;
		const radius = rootStyle?.getPropertyValue('--detail-frame-radius').trim() || '22px';

		return {
			left: 0,
			top: headerBottom,
			width: document.documentElement.clientWidth || window.innerWidth,
			height: Math.max(1, window.innerHeight - headerBottom),
			borderRadius: `${radius} ${radius} 0 0`
		};
	}

	$effect(() => {
		const curPhase = phase;
		const el = frameEl;
		if (!el) return;

		if (curPhase === 'expanding') {
			cancelActiveAnims();
			const targetBox = getPcTargetBox();
			activeAnims = runDetailExpandAnimation(
				{
					frameEl: el,
					contentEl,
					seedEl: seedLayerEl,
					targetTop: targetBox.top,
					targetBox,
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
			// 뒤쪽 목록 복원 + 스크롤 위치 반영 후 정확한 카드 좌표를 측정하기 위해 1프레임 대기
			closeRafId = requestAnimationFrame(() => {
				closeRafId = 0;
				if (!frameEl || phase !== 'closing') return;
				const targetBox = getPcTargetBox();
				activeAnims = runDetailCloseAnimation(
					{
						frameEl,
						contentEl,
						seedEl: seedLayerEl,
						targetTop: targetBox.top,
						targetBox,
						seed,
						returnRect: resolveReturnRect()
					},
					() => {
						activeAnims = [];
						onCloseFinish();
					}
				);
			});
		}
	});

	onDestroy(() => {
		cancelActiveAnims();
	});
</script>

<!-- PC 전용 상세 프레임: 안착(open) 시 일반 문서 흐름으로 window 스크롤 사용 · 좌우하단 여백 없이 상단만 라운드 -->
<div
	bind:this={frameEl}
	class="pc-detail-frame"
	class:is-transitioning={phase === 'expanding' || phase === 'closing'}
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

	<div bind:this={contentEl} class="pc-detail-body">
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

	/* 확장/축소 모핑 전환 중에만 뷰포트 고정 레이어로 카드 <-> 프레임 모핑 수행 */
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
		will-change: left, top, width, height, border-radius, opacity;
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

	.pc-detail-body {
		position: relative;
		z-index: 1;
		width: 100%;
		box-sizing: border-box;
	}
</style>
