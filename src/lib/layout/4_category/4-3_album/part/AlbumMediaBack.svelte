<script lang="ts">
	import type { AlbumMediaItem } from '../logic/albumDetailState.svelte';

	interface Props {
		items: AlbumMediaItem[];
		coverUrl?: string;
		open?: boolean;
		interactive?: boolean;
	}

	let { items, coverUrl = '', open = false, interactive = true }: Props = $props();

	let failedIds = $state<Record<number, boolean>>({});
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

	function markFailed(id: number) {
		if (failedIds[id]) return;
		failedIds = { ...failedIds, [id]: true };
	}
</script>

<!-- 앨범 커버 뒤쪽 상단으로 펼쳐지는 피지컬 상품(LP · CD · 카세트) 부채꼴 스택 (순수 렌더링) -->
<div class="album-media-fan" class:is-open={open} aria-hidden="true">
	{#each items as item, idx (item.id)}
		{@const isHot = open && interactive && hotIndex === idx}
		{@const hasImg = Boolean(item.imageUrl) && !failedIds[item.id]}
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
			{#if hasImg}
				<div class="real-media-frame is-{item.kind}">
					<img
						class="real-media-img"
						src={item.imageUrl}
						alt=""
						loading="lazy"
						decoding="async"
						onerror={() => markFailed(item.id)}
					/>
					<div class="real-media-finish" aria-hidden="true"></div>
					{#if item.kind === 'lp'}
						<span class="real-lp-spindle" aria-hidden="true"></span>
					{:else if item.kind === 'cd'}
						<span class="real-cd-hub" aria-hidden="true">
							<span class="real-cd-hole"></span>
						</span>
					{/if}
				</div>
			{:else if item.kind === 'lp'}
				<div class="vinyl-disc">
					<div class="vinyl-grooves"></div>
					<div class="vinyl-sheen"></div>
					<div class="vinyl-label">
						{#if coverUrl}
							<img class="vinyl-label-img" src={coverUrl} alt="" loading="lazy" decoding="async" />
						{/if}
						<span class="vinyl-spindle"></span>
					</div>
				</div>
			{:else if item.kind === 'cd'}
				<div class="cd-disc">
					<div class="cd-sheen"></div>
					<div class="cd-inner-ring">
						<span class="cd-hole"></span>
					</div>
				</div>
			{:else}
				<div class="cassette-shell">
					<div class="cassette-label">
						{#if coverUrl}
							<img class="cassette-label-img" src={coverUrl} alt="" loading="lazy" decoding="async" />
						{/if}
						<div class="cassette-window">
							<span class="cassette-reel"></span>
							<span class="cassette-reel"></span>
						</div>
					</div>
					<div class="cassette-bottom-trapezoid"></div>
				</div>
			{/if}
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

	/* 호버(열림) 시 LP · CD 회전 (카세트는 제외 · 닫힐 때 현재 각도에서 자연스럽게 정지) */
	.fan-media-card.is-lp .real-media-frame.is-lp,
	.fan-media-card.is-lp .vinyl-disc {
		animation: album-disc-spin 7.5s linear infinite;
		animation-play-state: paused;
	}

	.fan-media-card.is-cd .real-media-frame.is-cd,
	.fan-media-card.is-cd .cd-disc {
		animation: album-disc-spin 5.4s linear infinite;
		animation-play-state: paused;
	}

	.fan-media-card.is-open.is-lp .real-media-frame.is-lp,
	.fan-media-card.is-open.is-lp .vinyl-disc,
	.fan-media-card.is-open.is-cd .real-media-frame.is-cd,
	.fan-media-card.is-open.is-cd .cd-disc {
		animation-play-state: running;
	}

	@keyframes album-disc-spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	/* ── 실제 상품 이미지(PhysicalItem.thumbnailUrl) 형태 마스킹 & 가장자리 컬러 림 ── */
	.real-media-frame {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: var(--surface);
		display: grid;
		place-items: center;
		box-sizing: border-box;
	}

	.real-media-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.real-media-finish {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	/* 실제 LP: 원형 컷 + 바이닐 컬러 림 & 미세 그루브 광택 + 중앙 스핀들 홀 */
	.real-media-frame.is-lp {
		border-radius: 999px;
		border: 2.5px solid color-mix(in srgb, var(--surface-4) 55%, var(--white) 45%);
		box-shadow:
			inset 0 0 0 3px color-mix(in srgb, var(--bg) 72%, transparent),
			inset 0 0 12px rgba(0, 0, 0, 0.45),
			0 0 0 1px color-mix(in srgb, var(--white) 16%, transparent),
			0 10px 22px rgba(0, 0, 0, 0.56);
	}

	.real-media-frame.is-lp .real-media-finish {
		border-radius: 999px;
		background:
			repeating-radial-gradient(
				circle at 50% 50%,
				transparent 0px,
				transparent 3px,
				color-mix(in srgb, var(--white) 5%, transparent) 3.5px,
				transparent 4.2px
			),
			conic-gradient(
				from 20deg,
				transparent 0deg,
				color-mix(in srgb, var(--white) 18%, transparent) 30deg,
				transparent 68deg,
				transparent 185deg,
				color-mix(in srgb, var(--white) 12%, transparent) 220deg,
				transparent 260deg
			);
	}

	.real-lp-spindle {
		position: relative;
		z-index: 2;
		width: 11%;
		height: 11%;
		border-radius: 999px;
		background: var(--bg);
		border: 1.5px solid color-mix(in srgb, var(--white) 38%, transparent);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--bg) 55%, transparent);
	}

	/* 실제 CD: 원형 컷 + 프리즘 메탈릭 림 + 중앙 투명 허브 링 */
	.real-media-frame.is-cd {
		border-radius: 999px;
		border: 2.5px solid color-mix(in srgb, var(--white) 52%, var(--toast-info-wave) 48%);
		box-shadow:
			inset 0 0 0 2px color-mix(in srgb, var(--white) 28%, transparent),
			0 0 12px color-mix(in srgb, var(--toast-info-wave) 22%, transparent),
			0 10px 20px rgba(0, 0, 0, 0.52);
	}

	.real-media-frame.is-cd .real-media-finish {
		border-radius: 999px;
		background: conic-gradient(
			from 15deg,
			color-mix(in srgb, var(--white) 24%, transparent) 0deg,
			color-mix(in srgb, var(--toast-info-wave) 20%, transparent) 55deg,
			color-mix(in srgb, var(--toast-error-wave) 14%, transparent) 115deg,
			color-mix(in srgb, var(--white) 20%, transparent) 170deg,
			color-mix(in srgb, var(--toast-success-wave) 16%, transparent) 235deg,
			color-mix(in srgb, var(--toast-info-wave) 20%, transparent) 300deg,
			color-mix(in srgb, var(--white) 24%, transparent) 360deg
		);
	}

	.real-cd-hub {
		position: relative;
		z-index: 2;
		width: 26%;
		height: 26%;
		border-radius: 999px;
		background: color-mix(in srgb, var(--surface) 58%, transparent);
		border: 2px solid color-mix(in srgb, var(--white) 48%, transparent);
		display: grid;
		place-items: center;
	}

	.real-cd-hole {
		width: 44%;
		height: 44%;
		border-radius: 999px;
		background: var(--bg);
		border: 1px solid color-mix(in srgb, var(--white) 32%, transparent);
	}

	/* 실제 카세트: 카세트 쉘 라운드 사각형 + 컬러 쉘 테두리 베벨 */
	.real-media-frame.is-cassette {
		border-radius: 10px;
		border: 2.5px solid color-mix(in srgb, var(--white-3) 45%, var(--surface-4) 55%);
		box-shadow:
			inset 0 0 0 2px color-mix(in srgb, var(--bg) 55%, transparent),
			inset 0 1px 0 color-mix(in srgb, var(--white) 30%, transparent),
			0 10px 20px rgba(0, 0, 0, 0.54);
	}

	.real-media-frame.is-cassette .real-media-finish {
		border-radius: 8px;
		background: linear-gradient(
			145deg,
			color-mix(in srgb, var(--white) 14%, transparent) 0%,
			transparent 42%,
			rgba(0, 0, 0, 0.24) 100%
		);
	}

	/* ── 폴백 1) CSS 가상 LP 바이닐 레코드 ── */
	.vinyl-disc {
		position: relative;
		width: 100%;
		height: 100%;
		border-radius: 999px;
		background: radial-gradient(
			circle at 50% 50%,
			var(--surface) 0%,
			var(--bg) 42%,
			var(--surface-dim) 68%,
			var(--bg) 100%
		);
		border: 1px solid color-mix(in srgb, var(--white) 14%, transparent);
		box-shadow: 0 10px 22px rgba(0, 0, 0, 0.55);
		overflow: hidden;
		display: grid;
		place-items: center;
	}

	.vinyl-grooves {
		position: absolute;
		inset: 4%;
		border-radius: 999px;
		background: repeating-radial-gradient(
			circle at 50% 50%,
			transparent 0px,
			transparent 2px,
			color-mix(in srgb, var(--white) 6%, transparent) 2.6px,
			transparent 3.4px
		);
		opacity: 0.75;
	}

	.vinyl-sheen {
		position: absolute;
		inset: 0;
		border-radius: 999px;
		background: conic-gradient(
			from 25deg,
			transparent 0deg,
			color-mix(in srgb, var(--white) 16%, transparent) 32deg,
			transparent 70deg,
			transparent 180deg,
			color-mix(in srgb, var(--white) 12%, transparent) 215deg,
			transparent 255deg
		);
	}

	.vinyl-label {
		position: relative;
		width: 34%;
		height: 34%;
		border-radius: 999px;
		background: var(--surface-3);
		border: 1px solid color-mix(in srgb, var(--white) 18%, transparent);
		overflow: hidden;
		display: grid;
		place-items: center;
	}

	.vinyl-label-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0.88;
	}

	.vinyl-spindle {
		position: relative;
		z-index: 1;
		width: 22%;
		height: 22%;
		border-radius: 999px;
		background: var(--bg);
		border: 1px solid color-mix(in srgb, var(--white) 25%, transparent);
	}

	/* ── 폴백 2) CSS 가상 CD 광학 디스크 ── */
	.cd-disc {
		position: relative;
		width: 100%;
		height: 100%;
		border-radius: 999px;
		background: radial-gradient(
			circle at 50% 50%,
			var(--surface-4) 0%,
			var(--white-3) 34%,
			var(--surface-3) 64%,
			var(--white-2) 96%
		);
		border: 1px solid color-mix(in srgb, var(--white) 32%, transparent);
		box-shadow: 0 10px 20px rgba(0, 0, 0, 0.5);
		overflow: hidden;
		display: grid;
		place-items: center;
	}

	.cd-sheen {
		position: absolute;
		inset: 0;
		border-radius: 999px;
		background: conic-gradient(
			from 15deg,
			color-mix(in srgb, var(--white) 42%, transparent) 0deg,
			color-mix(in srgb, var(--toast-info-wave) 28%, transparent) 45deg,
			color-mix(in srgb, var(--toast-error-wave) 22%, transparent) 95deg,
			color-mix(in srgb, var(--white) 35%, transparent) 145deg,
			color-mix(in srgb, var(--toast-success-wave) 22%, transparent) 210deg,
			color-mix(in srgb, var(--toast-info-wave) 28%, transparent) 280deg,
			color-mix(in srgb, var(--white) 42%, transparent) 360deg
		);
	}

	.cd-inner-ring {
		position: relative;
		width: 32%;
		height: 32%;
		border-radius: 999px;
		background: color-mix(in srgb, var(--surface) 75%, transparent);
		border: 2px solid color-mix(in srgb, var(--white) 35%, transparent);
		display: grid;
		place-items: center;
	}

	.cd-hole {
		width: 44%;
		height: 44%;
		border-radius: 999px;
		background: var(--bg);
		border: 1px solid color-mix(in srgb, var(--white) 25%, transparent);
	}

	/* ── 폴백 3) CSS 가상 카세트 테이프 ── */
	.cassette-shell {
		position: relative;
		width: 100%;
		height: 100%;
		border-radius: 9px;
		background: linear-gradient(155deg, var(--surface-3), var(--surface-dim));
		border: 1px solid color-mix(in srgb, var(--white) 18%, transparent);
		box-shadow: 0 10px 20px rgba(0, 0, 0, 0.52);
		padding: 9%;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}

	.cassette-label {
		position: relative;
		width: 100%;
		height: 74%;
		border-radius: 5px;
		background: var(--surface-2);
		border: 1px solid color-mix(in srgb, var(--white) 14%, transparent);
		overflow: hidden;
		display: grid;
		place-items: center;
	}

	.cassette-label-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0.48;
	}

	.cassette-window {
		position: relative;
		z-index: 1;
		width: 68%;
		height: 44%;
		border-radius: 999px;
		background: color-mix(in srgb, var(--bg) 82%, transparent);
		border: 1px solid color-mix(in srgb, var(--white) 20%, transparent);
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 12%;
		box-sizing: border-box;
	}

	.cassette-reel {
		width: 24%;
		aspect-ratio: 1 / 1;
		border-radius: 999px;
		background: var(--surface-4);
		border: 1.5px solid color-mix(in srgb, var(--white) 45%, transparent);
	}

	.cassette-bottom-trapezoid {
		width: 64%;
		height: 16%;
		margin: 0 auto;
		border-radius: 3px 3px 0 0;
		background: color-mix(in srgb, var(--bg) 70%, transparent);
		border-top: 1px solid color-mix(in srgb, var(--white) 14%, transparent);
	}

	@media (prefers-reduced-motion: reduce) {
		.fan-media-card {
			transition: none;
		}

		.fan-media-card.is-lp .real-media-frame.is-lp,
		.fan-media-card.is-lp .vinyl-disc,
		.fan-media-card.is-cd .real-media-frame.is-cd,
		.fan-media-card.is-cd .cd-disc {
			animation: none;
		}
	}
</style>
