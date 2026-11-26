<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { fade, fly } from 'svelte/transition';
	import FdImage from '#lib/common/design/fluid/FdImage.svelte';
	import { createWaveRectSetting } from '../../_shared/logic/detailTheme';
	import type { AlbumPhysicalEdition, ProductOptionItem } from '../logic/albumDetail.svelte';
	import AlbumMediaShape from './AlbumMediaShape.svelte';

	interface Props {
		coverUrl: string;
		albumTitle: string;
		editions: AlbumPhysicalEdition[];
		selectedEdition: AlbumPhysicalEdition | null;
		selectedOption: ProductOptionItem | null;
		waveActive?: boolean;
		mobile: boolean;
		/** FdImage에서 추출한 커버 대표 물결 색상 (상위 DetailAmbientGlow 연동용) */
		extractedWaveColor?: string;
	}

	let {
		coverUrl,
		albumTitle,
		editions,
		selectedEdition,
		selectedOption,
		waveActive = true,
		mobile,
		extractedWaveColor = $bindable('')
	}: Props = $props();

	const HERO_RADIUS = 26;
	/** 정사각형 한 변당 유지할 물결 개수 (이미지 크기에 비례해 waveLength 자동 조절 — 아티스트 상세와 동일) */
	const HERO_WAVES_PER_EDGE = 2.5;

	let heroFlipped = $state(false);
	let heroMediaWidth = $state(340);

	const canFlipMedia = $derived(editions.length > 0);

	const heroImageSetting = $derived(
		createWaveRectSetting(heroMediaWidth, 1, HERO_RADIUS, HERO_WAVES_PER_EDGE)
	);

	const flipBackCaption = $derived.by(() => {
		if (!selectedEdition) return '';
		const optName = selectedOption?.name?.trim();
		if (optName && optName !== '기본') {
			return `${selectedEdition.format} · ${optName}`;
		}
		return selectedEdition.format;
	});

	/** 결정적 해시 기반(0..1)으로 뒷면 비선택 상품들을 좌우 뒤쪽에 자연스럽게 분산 배치 */
	function seededUnit(seed: number, salt: number): number {
		const h = Math.imul((seed ^ salt) >>> 0, 2654435761) >>> 0;
		return (h % 1000) / 1000;
	}

	const backMediaLayout = $derived.by(() => {
		const selectedId = selectedEdition?.id ?? editions[0]?.id ?? null;
		let otherIdx = 0;

		return editions.map((ed) => {
			const isSelected = ed.id === selectedId;
			if (isSelected) {
				return {
					edition: ed,
					isSelected: true,
					zIndex: 10,
					transform: 'translate3d(0%, -4%, 0) rotate(0deg) scale(1)'
				};
			}

			const slot = otherIdx++;
			const side = slot % 2 === 0 ? -1 : 1;
			const jx = seededUnit(ed.id, 17);
			const jy = seededUnit(ed.id, 53);
			const jr = seededUnit(ed.id, 97);

			const x = side * (30 + jx * 11 + Math.floor(slot / 2) * 5);
			const y = (slot >= 2 ? 4 : -14) + (jy - 0.5) * 14;
			const rot = side * (9 + jr * 11);
			const sc = 0.68 + jx * 0.06;

			return {
				edition: ed,
				isSelected: false,
				zIndex: 4 - Math.min(3, slot),
				transform: `translate3d(${x.toFixed(1)}%, ${y.toFixed(1)}%, 0) rotate(${rot.toFixed(1)}deg) scale(${sc.toFixed(3)})`
			};
		});
	});

	$effect(() => {
		if (!canFlipMedia) {
			heroFlipped = false;
		}
	});

	function handleHeroClick() {
		if (!mobile || !canFlipMedia) return;
		heroFlipped = !heroFlipped;
	}
</script>

<!-- 앨범 상세 전용 3D 플립 히어로 비주얼 (앞면: FdImage 커버 · 뒷면: 선택 상품 중앙 + 나머지 분산 실물 미디어, 순수 렌더링) -->
<div
	class="album-hero-visual"
	class:is-mobile={mobile}
	bind:clientWidth={heroMediaWidth}
	role="presentation"
	onpointerenter={(e) => {
		if (!mobile && e.pointerType === 'mouse' && canFlipMedia) heroFlipped = true;
	}}
	onpointerleave={() => {
		if (!mobile) heroFlipped = false;
	}}
>
	<button
		type="button"
		class="hero-flip-stage"
		class:is-flipped={heroFlipped}
		class:is-interactive={canFlipMedia}
		disabled={!mobile || !canFlipMedia}
		aria-pressed={mobile && canFlipMedia ? heroFlipped : undefined}
		aria-label={canFlipMedia
			? heroFlipped
				? '앨범 커버 보기'
				: '선택한 실물 음반 보기'
			: albumTitle}
		onclick={handleHeroClick}
	>
		<div class="hero-flip-card">
			<!-- 앞면: FdImage 유체 물결 앨범 커버 -->
			<div class="hero-face is-front">
				{#if coverUrl}
					<FdImage
						class="album-hero-image"
						src={coverUrl}
						alt={albumTitle}
						loading="eager"
						decoding="async"
						objectPosition="50% 50%"
						radius={HERO_RADIUS}
						setting={heroImageSetting}
						active={waveActive}
						disableWave={false}
						bind:extractedWaveColor
						fullWidth
					/>
				{:else}
					<div class="hero-cover-fallback" aria-hidden="true"></div>
				{/if}

				{#if mobile && canFlipMedia}
					<span class="hero-flip-hint" aria-hidden="true">
						<svg
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
							<path d="M3 3v5h5" />
							<path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
							<path d="M16 16h5v5" />
						</svg>
						<span>실물 보기</span>
					</span>
				{/if}
			</div>

			<!-- 뒷면: 전체 실물 미디어 표시 (선택 상품은 정가운데 최전면 · 나머지는 뒤쪽 좌우 분산, 회전 없음) -->
			{#if canFlipMedia}
				<div class="hero-face is-back">
					<div class="hero-back-stage">
						{#each backMediaLayout as entry (entry.edition.id)}
							<div
								class="hero-back-media is-{entry.edition.kind}"
								class:is-selected={entry.isSelected}
								style:transform={entry.transform}
								style:z-index={entry.zIndex}
							>
								<AlbumMediaShape
									kind={entry.edition.kind}
									imageUrl={entry.edition.thumbnailUrl}
									{coverUrl}
									spinning={false}
									alt={entry.edition.name}
								/>
							</div>
						{/each}
					</div>

					{#if flipBackCaption}
						{#key flipBackCaption}
							<span
								class="hero-back-caption"
								in:fly={{ y: 5, duration: 220, easing: cubicOut }}
								out:fade={{ duration: 120 }}
							>
								{flipBackCaption}
							</span>
						{/key}
					{/if}
				</div>
			{/if}
		</div>
	</button>
</div>

<style>
	.album-hero-visual {
		position: relative;
		width: 100%;
	}

	.hero-flip-stage {
		position: relative;
		display: block;
		width: 100%;
		aspect-ratio: 1 / 1;
		padding: 0;
		margin: 0;
		border: none;
		background: transparent;
		font: inherit;
		color: inherit;
		perspective: 1100px;
		cursor: default;
		-webkit-tap-highlight-color: transparent;
	}

	.album-hero-visual.is-mobile .hero-flip-stage.is-interactive {
		cursor: pointer;
	}

	.hero-flip-stage:focus-visible {
		outline: 2px solid var(--white-2);
		outline-offset: 4px;
		border-radius: 26px;
	}

	.hero-flip-card {
		position: relative;
		width: 100%;
		height: 100%;
		transform-style: preserve-3d;
		transform: rotateY(0deg);
		will-change: transform;
		transition: transform 0.68s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.hero-flip-stage.is-flipped .hero-flip-card {
		transform: rotateY(180deg);
	}

	.hero-face {
		position: absolute;
		inset: 0;
		border-radius: 26px;
		-webkit-backface-visibility: hidden;
		backface-visibility: hidden;
	}

	.hero-face.is-front {
		overflow: visible;
		background: transparent;
	}

	.hero-face.is-front :global(.fd-image-wrap.album-hero-image) {
		width: 100%;
		height: 100%;
	}

	.hero-face.is-back {
		transform: rotateY(180deg);
		overflow: hidden;
		border: var(--thin-border);
		box-shadow: 0 18px 44px rgba(0, 0, 0, 0.55);
		background: radial-gradient(circle at 50% 44%, var(--surface-2) 0%, var(--bg) 88%);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.hero-back-stage {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.hero-back-media {
		position: absolute;
		width: 68%;
		height: 68%;
		opacity: 0.72;
		filter: brightness(0.76);
		will-change: transform, opacity;
		transition:
			transform 0.52s cubic-bezier(0.22, 1, 0.36, 1),
			opacity 0.32s ease,
			filter 0.32s ease;
	}

	.hero-back-media.is-cassette {
		width: 72%;
		height: 50%;
	}

	.hero-back-media.is-selected {
		opacity: 1;
		filter: brightness(1);
	}

	.hero-back-caption {
		position: absolute;
		left: 50%;
		bottom: 0.9rem;
		z-index: 12;
		transform: translateX(-50%);
		max-width: calc(100% - 1.5rem);
		color: var(--white-2);
		font-size: 0.8rem;
		font-weight: var(--fw-semibold);
		letter-spacing: -0.01em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		text-shadow: 0 1px 6px rgba(0, 0, 0, 0.65);
		pointer-events: none;
	}

	.hero-flip-hint {
		position: absolute;
		right: 0.75rem;
		bottom: 0.75rem;
		z-index: 3;
		padding: 0.3rem 0.65rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--bg) 72%, transparent);
		border: var(--thin-border);
		color: var(--white-2);
		font-size: 0.74rem;
		font-weight: var(--fw-semibold);
		display: inline-flex;
		align-items: center;
		gap: 0.32rem;
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
		pointer-events: none;
	}

	.hero-cover-fallback {
		width: 100%;
		height: 100%;
		border-radius: 26px;
		background: linear-gradient(145deg, var(--surface-2), var(--surface-dim));
	}

	@media (prefers-reduced-motion: reduce) {
		.hero-flip-card,
		.hero-back-media {
			transition: none;
		}
	}
</style>
