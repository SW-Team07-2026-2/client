<script lang="ts">
	import { onDestroy } from 'svelte';
	import { scrollReveal } from '#lib/common/logic';
	import FdButton from '#lib/common/design/fluid/FdButton.svelte';
	import FdImage from '#lib/common/design/fluid/FdImage.svelte';
	import { FluidSetting } from '#lib/common/type/fluid';
	import { resolveArtistImageUrl, type CatalogArtist } from '#lib/common/catalog/artists';
	import type { ArtistSelectPayload } from '../logic/artistCategory.svelte';

	interface Props {
		artist: CatalogArtist;
		following?: boolean;
		followLoading?: boolean;
		interactive?: boolean;
		onFollowToggle?: (artist: CatalogArtist, nextFollowing: boolean) => void;
		onSelect?: (payload: ArtistSelectPayload) => void;
	}

	let {
		artist,
		following = false,
		followLoading = false,
		interactive = true,
		onFollowToggle,
		onSelect
	}: Props = $props();

	const LONG_PRESS_MS = 420;
	const LONG_PRESS_MOVE_SLOP = 10;

	const resolvedImageSrc = $derived(resolveArtistImageUrl(artist));

	let followOpen = $state(false);
	let buttonMounted = $state(false);
	let buttonVisible = $state(false);
	let longPressPos = $state<{ x: number; y: number } | null>(null);
	let extractedWaveColor = $state('var(--muted-wave)');
	let stageEl = $state<HTMLDivElement | null>(null);

	let enterRaf = 0;
	let unmountTimer: ReturnType<typeof setTimeout> | undefined;
	let longPressTimer: ReturnType<typeof setTimeout> | undefined;
	let suppressClickTimer: ReturnType<typeof setTimeout> | undefined;
	let suppressNextClick = false;
	let activePointerId: number | null = null;
	let pressStartX = 0;
	let pressStartY = 0;

	const isActive = $derived(interactive && followOpen);

	$effect(() => {
		if (!interactive) {
			followOpen = false;
		}
	});

	// 꾹 누르기로 열린 팔로우 버튼은 바깥 영역 터치 또는 스크롤 시 닫힘
	$effect(() => {
		if (!followOpen || typeof window === 'undefined') return;

		const handleOutsideDown = (e: PointerEvent) => {
			const target = e.target as Node | null;
			if (target && stageEl?.querySelector('.follow-center-slot')?.contains(target)) {
				return;
			}
			followOpen = false;
		};
		const handleScrollClose = () => {
			followOpen = false;
		};

		window.addEventListener('pointerdown', handleOutsideDown, true);
		window.addEventListener('scroll', handleScrollClose, { passive: true });
		return () => {
			window.removeEventListener('pointerdown', handleOutsideDown, true);
			window.removeEventListener('scroll', handleScrollClose);
		};
	});

	$effect(() => {
		if (isActive) {
			clearTimeout(unmountTimer);
			if (!buttonMounted) {
				buttonMounted = true;
				cancelAnimationFrame(enterRaf);
				enterRaf = requestAnimationFrame(() => {
					buttonVisible = true;
				});
			} else {
				buttonVisible = true;
			}
		} else {
			cancelAnimationFrame(enterRaf);
			buttonVisible = false;
			if (buttonMounted) {
				clearTimeout(unmountTimer);
				unmountTimer = setTimeout(() => {
					buttonMounted = false;
					longPressPos = null;
				}, 300);
			}
		}
	});

	function clearLongPressTimer() {
		clearTimeout(longPressTimer);
		longPressTimer = undefined;
		activePointerId = null;
	}

	onDestroy(() => {
		cancelAnimationFrame(enterRaf);
		clearTimeout(unmountTimer);
		clearTimeout(longPressTimer);
		clearTimeout(suppressClickTimer);
	});

	const followBtnSetting = $derived.by(() => {
		const base = {
			radius: 999,
			inset: 8,
			bulge: 4,
			reach: 26,
			waveLength: 56,
			borderWidth: 0,
			color: 'var(--white-2)',
			hoverColor: 'var(--white)',
			pressColor: 'var(--white-3)',
			textColor: 'var(--bg)'
		};
		if (following) {
			return new FluidSetting({
				...base,
				layers: 2,
				layerGap: 2.6,
				waveAmp: 2.6,
				spin: 1.3,
				pauseWhenIdle: false,
				waveColor: extractedWaveColor
			});
		}
		return new FluidSetting({
			...base,
			layers: 1,
			layerGap: 0,
			waveAmp: 0,
			spin: 1.1,
			pauseWhenIdle: true,
			waveColor: 'var(--white-3)'
		});
	});

	function openFollowAt(clientX: number, clientY: number) {
		if (!stageEl) return;
		const rect = stageEl.getBoundingClientRect();
		const halfBtnW = following ? 56 : 46;
		const clampedClientX = Math.max(
			12 + halfBtnW,
			Math.min(window.innerWidth - 12 - halfBtnW, clientX)
		);
		const localX = Math.max(0, Math.min(rect.width, clampedClientX - rect.left));
		const localY = Math.max(20, Math.min(rect.height - 20, clientY - rect.top));

		longPressPos = { x: localX, y: localY };
		followOpen = true;
		suppressNextClick = true;
		clearTimeout(suppressClickTimer);
		suppressClickTimer = setTimeout(() => {
			suppressNextClick = false;
		}, 450);

		try {
			navigator.vibrate?.(12);
		} catch {
			// 진동 미지원 환경 무시
		}
	}

	function handleStagePointerDown(e: PointerEvent) {
		if (e.target && stageEl?.querySelector('.follow-center-slot')?.contains(e.target as Node)) {
			return;
		}
		if (e.pointerType === 'mouse' && e.button !== 0) return;

		clearLongPressTimer();
		activePointerId = e.pointerId;
		pressStartX = e.clientX;
		pressStartY = e.clientY;
		longPressTimer = setTimeout(() => {
			longPressTimer = undefined;
			activePointerId = null;
			openFollowAt(pressStartX, pressStartY);
		}, LONG_PRESS_MS);
	}

	function handleStagePointerMove(e: PointerEvent) {
		if (activePointerId !== e.pointerId || !longPressTimer) return;
		if (Math.hypot(e.clientX - pressStartX, e.clientY - pressStartY) > LONG_PRESS_MOVE_SLOP) {
			clearLongPressTimer();
		}
	}

	function handleStagePointerEnd(e: PointerEvent) {
		if (activePointerId === e.pointerId) {
			clearLongPressTimer();
		}
	}

	function handleSelect() {
		onSelect?.({
			artist,
			waveColor: extractedWaveColor,
			following
		});
	}

	function handleStageClick(e: MouseEvent) {
		if (suppressNextClick) {
			suppressNextClick = false;
			clearTimeout(suppressClickTimer);
			e.preventDefault();
			e.stopPropagation();
			return;
		}
		if (followOpen) {
			followOpen = false;
			e.preventDefault();
			e.stopPropagation();
			return;
		}
		handleSelect();
	}

	function handleFollowClick(e: MouseEvent) {
		e.stopPropagation();
		if (followLoading) return;
		onFollowToggle?.(artist, !following);
		followOpen = false;
	}
</script>

<!-- 모바일 전용 아티스트 카드 아이템 (순수 렌더링 · 웨이브 비활성 · 꾹 누르기 팔로우 · 스크롤 진입/이탈 모션) -->
<article
	use:scrollReveal
	class="mb-artist-item mb-scroll-reveal"
	class:is-active={isActive}
	class:is-following={following}
>
	<div
		bind:this={stageEl}
		class="artist-stage"
		role="button"
		tabindex="0"
		aria-label={`${artist.name} 아티스트`}
		onpointerdown={handleStagePointerDown}
		onpointermove={handleStagePointerMove}
		onpointerup={handleStagePointerEnd}
		onpointercancel={handleStagePointerEnd}
		oncontextmenu={(e) => e.preventDefault()}
		onclick={handleStageClick}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				handleSelect();
			}
		}}
	>
		<span
			class="follow-indicator-dot"
			class:is-visible={following}
			title={following ? '팔로우 중' : undefined}
			aria-hidden={!following}
		></span>

		<FdImage
			class="artist-fd-image"
			src={resolvedImageSrc}
			alt={artist.name}
			loading="eager"
			decoding="async"
			objectPosition="50% 40%"
			disableWave={true}
			active={false}
			bind:extractedWaveColor
			fullWidth
		/>

		{#if buttonMounted}
			<div
				class="follow-center-slot"
				class:is-visible={buttonVisible}
				style:left={longPressPos ? `${longPressPos.x.toFixed(1)}px` : undefined}
				style:top={longPressPos ? `${longPressPos.y.toFixed(1)}px` : undefined}
				aria-hidden={!buttonVisible}
			>
				<FdButton
					class="mb-artist-follow-btn"
					setting={followBtnSetting}
					aria-disabled={followLoading || undefined}
					aria-busy={followLoading || undefined}
					tabindex={buttonVisible ? 0 : -1}
					aria-pressed={following}
					onclick={handleFollowClick}
				>
					<span class="follow-label">
						<span>팔로우</span><span
							class="follow-suffix-shell"
							class:is-active={following}
							aria-hidden={!following}
						>
							<span class="follow-suffix-inner">&nbsp;취소</span>
						</span>
					</span>
				</FdButton>
			</div>
		{/if}
	</div>

	<div class="artist-footer">
		<button type="button" class="artist-name-btn" tabindex="-1" onclick={handleSelect}>
			<span class="artist-name">{artist.name}</span>
		</button>
	</div>
</article>

<style>
	.mb-artist-item {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		padding: 0;
		box-sizing: border-box;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
	}

	.mb-artist-item.is-active {
		z-index: 20;
	}

	.artist-stage {
		position: relative;
		width: 100%;
		aspect-ratio: 1 / 1;
		cursor: pointer;
		outline: none;
		display: grid;
		place-items: center;
		-webkit-touch-callout: none;
	}

	.artist-stage :global(.fd-image-wrap.artist-fd-image) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		z-index: 1;
	}

	.follow-indicator-dot {
		position: absolute;
		top: 9.5%;
		right: 9.5%;
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: var(--white);
		box-shadow:
			0 0 8px color-mix(in srgb, var(--white) 55%, transparent),
			0 0 0 2px var(--bg);
		z-index: 3;
		opacity: 0;
		transform: scale(0);
		pointer-events: none;
		transition:
			transform 0.22s cubic-bezier(0.22, 1, 0.36, 1),
			opacity 0.18s ease;
	}

	.follow-indicator-dot.is-visible {
		opacity: 1;
		transform: scale(1);
		transition:
			transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1),
			opacity 0.2s ease;
	}

	.artist-footer {
		position: relative;
		z-index: 2;
		width: 100%;
		margin-top: -0.2rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
	}

	.artist-name-btn {
		display: block;
		appearance: none;
		border: none;
		background: transparent;
		padding: 0;
		margin: 0;
		font: inherit;
		line-height: 1;
		cursor: pointer;
		color: var(--fg);
	}

	.artist-name {
		display: block;
		font-size: 0.94rem;
		font-weight: var(--fw-medium);
		letter-spacing: -0.02em;
		line-height: 1.35;
		text-align: center;
		word-break: keep-all;
	}

	.follow-center-slot {
		position: absolute;
		top: 50%;
		left: 50%;
		z-index: 4;
		opacity: 0;
		transform: translate(-50%, -50%) scale(0.84);
		pointer-events: none;
		transition:
			opacity 0.24s cubic-bezier(0.22, 1, 0.36, 1),
			transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.follow-center-slot.is-visible {
		opacity: 1;
		transform: translate(-50%, -50%) scale(1);
		pointer-events: auto;
	}

	:global(.mb-artist-follow-btn) {
		padding: 0.42rem 0.92rem !important;
		font-size: 0.82rem !important;
		font-weight: var(--fw-bold) !important;
		letter-spacing: -0.01em;
		white-space: nowrap;
	}

	.follow-label {
		display: inline-flex;
		align-items: center;
		white-space: nowrap;
	}

	.follow-suffix-shell {
		display: inline-grid;
		grid-template-columns: 0fr;
		opacity: 0;
		transform: translateX(-3px);
		transition:
			grid-template-columns 0.26s cubic-bezier(0.22, 1, 0.36, 1),
			opacity 0.2s ease,
			transform 0.26s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.follow-suffix-shell.is-active {
		grid-template-columns: 1fr;
		opacity: 1;
		transform: translateX(0);
	}

	.follow-suffix-inner {
		min-width: 0;
		overflow: hidden;
		white-space: pre;
	}

	@media (prefers-reduced-motion: reduce) {
		.follow-indicator-dot,
		.follow-indicator-dot.is-visible,
		.follow-suffix-shell {
			transition: none;
		}
	}
</style>
