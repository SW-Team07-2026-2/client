<script lang="ts">
	import type { AlbumMediaItem } from '../logic/albumDetailState.svelte';
	import AlbumMediaShape from './AlbumMediaShape.svelte';

	interface Props {
		items: AlbumMediaItem[];
		coverUrl?: string;
		open?: boolean;
		interactive?: boolean;
	}

	let { items, coverUrl = '', open = false, interactive = true }: Props = $props();

	let hotIndex = $state(-1);

	$effect(() => {
		if (!open || !interactive) {
			hotIndex = -1;
		}
	});

	const count = $derived(items.length);

	/**
	 * Fan Cards + FolderFloat 모션 결합:
	 * - 닫힘(idle): 앨범 커버 상단 뒤로 살짝 고개만 내민 정돈된 스택
	 * - 열림(hover): 위쪽으로 부채꼴(fan)로 펼쳐지며, 개별 미디어 hover 시 한 단계 더 리프트
	 */
	function computeTransform(index: number, total: number, isOpen: boolean, isHot: boolean): string {
		const center = (total - 1) / 2;
		const d = index - center;

		if (!isOpen) {
			const restX = d * 5;
			const restY = -6 + Math.abs(d) * 2.5;
			const restRot = d * 3;
			return `translate3d(${restX.toFixed(1)}%, ${restY.toFixed(1)}%, 0) rotate(${restRot.toFixed(1)}deg) scale(0.92)`;
		}

		if (total === 1) {
			const singleRot = items[0]?.kind === 'cassette' ? -4 : 16;
			const liftY = isHot ? -35 : -30;
			const sc = isHot ? 1.03 : 0.98;
			return `translate3d(0%, ${liftY}%, 0) rotate(${singleRot}deg) scale(${sc})`;
		}

		const spreadX = total === 2 ? 19 : total === 3 ? 17 : 14;
		const spreadRot = total === 2 ? 10 : total === 3 ? 9 : 8;
		const x = d * spreadX;
		const arcDrop = Math.abs(d) * (total >= 3 ? 5.5 : 4.5);
		const baseLift = -32 + arcDrop;
		const y = baseLift + (isHot ? -7 : 0);
		const rot = d * spreadRot;
		const sc = isHot ? 1.04 : 0.94;

		return `translate3d(${x.toFixed(1)}%, ${y.toFixed(1)}%, 0) rotate(${rot.toFixed(1)}deg) scale(${sc})`;
	}

	function computeZIndex(index: number, total: number, isHot: boolean): number {
		if (isHot) return 12;
		const center = (total - 1) / 2;
		return 5 - Math.round(Math.abs(index - center));
	}
</script>

<!-- 앨범 커버 뒤쪽 상단으로 펼쳐지는 피지컬 상품(LP · CD · 카세트) 부채꼴 스택 (순수 렌더링) -->
<div class="album-media-fan" class:is-open={open} aria-hidden="true">
	{#each items as item, idx (item.id)}
		{@const isHot = open && interactive && hotIndex === idx}
		<div
			class="fan-media-card is-{item.kind}"
			class:is-open={open}
			class:is-hot={isHot}
			role="presentation"
			style:transform={computeTransform(idx, count, open, isHot)}
			style:z-index={computeZIndex(idx, count, isHot)}
			style:transition-delay={open ? `${idx * 42}ms` : `${(count - 1 - idx) * 20}ms`}
			onpointerenter={() => {
				if (open && interactive) hotIndex = idx;
			}}
			onpointerleave={() => {
				if (hotIndex === idx) hotIndex = -1;
			}}
		>
			<AlbumMediaShape
				kind={item.kind}
				imageUrl={item.imageUrl}
				{coverUrl}
				spinning={open}
			/>
		</div>
	{/each}
</div>

<style>
	.album-media-fan {
		position: absolute;
		inset: 0;
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}

	.fan-media-card {
		position: absolute;
		width: 82%;
		height: 82%;
		transform-origin: 50% 100%;
		will-change: transform;
		transition:
			transform 0.48s cubic-bezier(0.22, 1.18, 0.36, 1),
			filter 0.28s ease;
		pointer-events: none;
	}

	.fan-media-card.is-cassette {
		width: 80%;
		height: 58%;
	}

	.album-media-fan.is-open .fan-media-card {
		pointer-events: auto;
	}

	@media (prefers-reduced-motion: reduce) {
		.fan-media-card {
			transition: none;
		}
	}
</style>
