<script lang="ts">
	import { onMount } from 'svelte';
	import { isMobile } from '#lib/common/logic';
	import { toast, type ToastSwipeDirection } from '#lib/common/logic/toast.svelte';
	import ToastCard from './ToastCard.svelte';

	interface Props {
		/** 스와이프 닫기 허용 방향 (기본값: ['down', 'left']) */
		swipeDirection?: ToastSwipeDirection | ToastSwipeDirection[];
		/** 하단 남은 시간 프로그레스 바 표시 여부 (기본값: true) */
		progressBar?: boolean;
	}

	let { swipeDirection = ['down', 'left'], progressBar = true }: Props = $props();

	const STACK_GAP_PX = 12;

	let hovered = $state(false);
	let focused = $state(false);
	let heights = $state<Record<number, number>>({});

	const mobile = $derived(isMobile.current);
	const normalizedDirections = $derived<readonly ToastSwipeDirection[]>(
		Array.isArray(swipeDirection) ? swipeDirection : [swipeDirection]
	);
	const expanded = $derived(hovered || focused);

	const activeItems = $derived(toast.items);
	const frontId = $derived(activeItems[0]?.id ?? null);
	const frontHeight = $derived(frontId !== null ? (heights[frontId] ?? 58) : 58);

	// 펼쳐졌을 때 각 인덱스별 누적 Y 오프셋 계산 (0.75rem = 12px 간격)
	const expandedOffsets = $derived.by(() => {
		const offsets: number[] = [];
		let acc = 0;
		for (let i = 0; i < activeItems.length; i++) {
			offsets.push(acc);
			const h = heights[activeItems[i].id] ?? frontHeight;
			acc += h + STACK_GAP_PX;
		}
		return offsets;
	});

	const viewportHeight = $derived.by(() => {
		if (activeItems.length === 0) return 0;
		if (expanded) {
			const lastIdx = activeItems.length - 1;
			const lastH = heights[activeItems[lastIdx].id] ?? frontHeight;
			return (expandedOffsets[lastIdx] ?? 0) + lastH;
		}
		return frontHeight + Math.max(0, activeItems.length - 1) * 12;
	});

	$effect(() => {
		if (activeItems.length === 0) {
			hovered = false;
			focused = false;
		}
	});

	$effect(() => {
		if (hovered || focused) {
			toast.pauseAll();
		} else if (typeof document === 'undefined' || document.visibilityState === 'visible') {
			toast.resumeAll();
		}
	});

	onMount(() => {
		const onVisibilityChange = () => {
			if (document.visibilityState === 'hidden') {
				toast.pauseAll();
			} else if (!hovered && !focused) {
				toast.resumeAll();
			}
		};
		document.addEventListener('visibilitychange', onVisibilityChange);
		return () => {
			document.removeEventListener('visibilitychange', onVisibilityChange);
		};
	});

	function handleMeasureHeight(id: number, h: number) {
		if (heights[id] === h) return;
		heights = { ...heights, [id]: h };
	}

	function handleDismiss(
		id: number,
		reason: 'dismiss' | 'swipe',
		swipeExit?: { x: number; y: number; durationMs: number }
	) {
		toast.dismiss(id, reason, swipeExit);
	}
</script>

<!-- 전역 Animate UI 토스트 뷰포트 (스택 · 호버/포커스 펼침 · down/left 스와이프 닫기 · 남은 시간 바) -->
{#if activeItems.length > 0}
	<div
		class="aui-toast-viewport"
		class:is-mobile={mobile}
		style:height="{viewportHeight}px"
		role="region"
		aria-label="알림"
		onpointerenter={(e) => {
			if (e.pointerType === 'mouse') hovered = true;
		}}
		onpointerleave={() => {
			hovered = false;
		}}
		onfocusin={() => {
			focused = true;
		}}
		onfocusout={(e) => {
			const next = e.relatedTarget as Node | null;
			if (!next || !e.currentTarget.contains(next)) {
				focused = false;
			}
		}}
	>
		{#each activeItems as item, idx (item.id)}
			<ToastCard
				{item}
				index={idx}
				{expanded}
				expandedOffsetY={expandedOffsets[idx] ?? 0}
				{frontHeight}
				swipeDirections={normalizedDirections}
				{progressBar}
				paused={toast.paused}
				onDismiss={handleDismiss}
				onMeasureHeight={handleMeasureHeight}
			/>
		{/each}
	</div>
{/if}

<style>
	.aui-toast-viewport {
		position: fixed;
		left: 1.5rem;
		bottom: 1.5rem;
		z-index: 9999;
		width: min(360px, calc(100vw - 3rem));
		pointer-events: auto;
	}

	.aui-toast-viewport.is-mobile {
		left: 50%;
		bottom: calc(var(--mobile-bottom-bar-height, 72px) + 0.85rem);
		transform: translateX(-50%);
		width: min(360px, calc(100vw - 2rem));
	}
</style>
