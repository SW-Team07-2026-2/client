<script lang="ts">
	import { untrack } from 'svelte';
	import FdButton from '#lib/common/design/fluid/FdButton.svelte';
	import { FluidSetting } from '#lib/common/type/fluid';

	interface Props {
		/** 보유 음반 등록 여부 */
		collected: boolean;
		/** 요청 처리 중 여부 */
		loading?: boolean;
		/** 비활성화 여부 */
		disabled?: boolean;
		/** 클릭 콜백 */
		onclick?: () => void;
	}

	let { collected, loading = false, disabled = false, onclick }: Props = $props();

	const BUTTON_SETTING = new FluidSetting({
		radius: 14,
		inset: 6,
		reach: 28,
		bulge: 4,
		bulgeWidth: 16,
		layers: 2,
		layerGap: 2.2,
		waveAmp: 2.4,
		waveLength: 52,
		spin: 1.2,
		pauseWhenIdle: true,
		color: 'var(--surface)',
		hoverColor: 'var(--surface-2)',
		pressColor: 'var(--surface-3)',
		waveColor: 'var(--surface-3)',
		hoverWaveColor: 'var(--surface-3)',
		textColor: 'var(--fg)',
		borderWidth: 0
	});

	let bounceAnim = $state(false);
	let checkAnimState = $state<'idle' | 'drawing' | 'erasing'>('idle');
	let prevCollected = untrack(() => collected);
	let bounceTimer: ReturnType<typeof setTimeout> | undefined;

	function triggerBounce() {
		clearTimeout(bounceTimer);
		bounceAnim = false;
		if (typeof requestAnimationFrame === 'function') {
			requestAnimationFrame(() => {
				bounceAnim = true;
				bounceTimer = setTimeout(() => {
					bounceAnim = false;
				}, 520);
			});
		}
	}

	// 초기 마운트 시 이미 등록된 상태면 즉시 체크 표시 유지, 이후 상태 전환 시에만 드로우/지우기 애니메이션 실행
	$effect(() => {
		const next = collected;
		if (next === prevCollected) return;
		prevCollected = next;
		checkAnimState = next ? 'drawing' : 'erasing';
		triggerBounce();
	});

	function handlePointerEnter(e: PointerEvent) {
		if (e.pointerType === 'touch' || disabled) return;
		triggerBounce();
	}

	function handleClick() {
		if (disabled || loading) return;
		triggerBounce();
		onclick?.();
	}
</script>

<!-- 보유 음반 북마크+체크 아이콘 전용 FdButton (호버 띠용+물결 · 클릭 체크 드로우/해제, 순수 렌더링) -->
<div class="collection-btn-wrap" role="presentation" onpointerenter={handlePointerEnter}>
	<FdButton
		setting={BUTTON_SETTING}
		{disabled}
		class="album-collection-fd-btn {loading ? 'is-loading' : ''}"
		aria-pressed={collected}
		aria-busy={loading}
		aria-label={collected ? '보유 음반 해제' : '보유 음반 등록'}
		title={collected ? '보유 음반 해제' : '보유 음반 등록'}
		onclick={handleClick}
	>
		<svg
			class="bookmark-svg"
			class:is-loading={loading}
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<g class="bookmark-group" class:is-bouncing={bounceAnim}>
				<path
					class="bookmark-ribbon"
					d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z"
				/>
				<path
					class="bookmark-check"
					class:is-checked={collected}
					class:is-drawing={checkAnimState === 'drawing'}
					class:is-erasing={checkAnimState === 'erasing'}
					d="m9 10 2 2 4-4"
					pathLength="1"
				/>
			</g>
		</svg>
	</FdButton>
</div>

<style>
	.collection-btn-wrap {
		display: inline-flex;
		flex-shrink: 0;
	}

	.collection-btn-wrap :global(.fd-wrap) {
		margin: -6px;
	}

	.collection-btn-wrap :global(.fd-btn.album-collection-fd-btn) {
		width: 46px;
		height: 46px;
		padding: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.collection-btn-wrap :global(.fd-btn.album-collection-fd-btn.is-loading) {
		cursor: progress;
	}

	.bookmark-svg {
		display: block;
		overflow: visible;
		opacity: 1;
		filter: blur(0px);
		transition:
			opacity 0.18s ease,
			filter 0.18s ease;
	}

	.bookmark-svg.is-loading {
		opacity: 0.35;
		filter: blur(1px);
	}

	/* 1) 호버/클릭 시 상단 기준(50% 0%) 세로 띠용 애니메이션: scaleY [1 -> 0.82 -> 1.03 -> 1] */
	.bookmark-group {
		transform-box: fill-box;
		transform-origin: 50% 0%;
		transform: scaleY(1);
	}

	.bookmark-group.is-bouncing {
		animation: bookmark-bounce 0.5s ease-in-out;
	}

	@keyframes bookmark-bounce {
		0% {
			transform: scaleY(1);
		}
		33% {
			transform: scaleY(0.82);
		}
		72% {
			transform: scaleY(1.03);
		}
		100% {
			transform: scaleY(1);
		}
	}

	/* 2) 가운데 체크 표시 드로우 / 해제 애니메이션 */
	.bookmark-check {
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		opacity: 0;
	}

	.bookmark-check.is-checked {
		stroke-dashoffset: 0;
		opacity: 1;
	}

	.bookmark-check.is-checked.is-drawing {
		animation: bookmark-check-draw 0.4s ease-in-out 0.15s both;
	}

	.bookmark-check:not(.is-checked).is-erasing {
		animation: bookmark-check-erase 0.24s ease-in-out both;
	}

	@keyframes bookmark-check-draw {
		from {
			stroke-dashoffset: 1;
			opacity: 0;
		}
		to {
			stroke-dashoffset: 0;
			opacity: 1;
		}
	}

	@keyframes bookmark-check-erase {
		from {
			stroke-dashoffset: 0;
			opacity: 1;
		}
		to {
			stroke-dashoffset: 1;
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.bookmark-group.is-bouncing,
		.bookmark-check.is-checked.is-drawing,
		.bookmark-check:not(.is-checked).is-erasing {
			animation: none;
		}
	}
</style>
