<script lang="ts">
	import { onDestroy } from 'svelte';
	import FdButton from '#lib/common/design/fluid/FdButton.svelte';
	import FdImage from '#lib/common/design/fluid/FdImage.svelte';
	import { FluidSetting } from '#lib/common/type/fluid';
	import { resolveArtistImageUrl, type CatalogArtist } from '#lib/config/artists';
	import { measureOriginRect } from '#lib/common/logic';
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

	const resolvedImageSrc = $derived(resolveArtistImageUrl(artist));

	let cardHovered = $state(false);
	let imageHovered = $state(false);
	let focused = $state(false);
	let buttonMounted = $state(false);
	let buttonVisible = $state(false);
	let extractedWaveColor = $state('var(--muted-wave)');
	let originEl = $state<HTMLDivElement | null>(null);

	let enterRaf = 0;
	let unmountTimer: ReturnType<typeof setTimeout> | undefined;

	const isActive = $derived(interactive && (focused || cardHovered || imageHovered));

	$effect(() => {
		if (!interactive) {
			cardHovered = false;
			imageHovered = false;
			focused = false;
		}
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
				}, 300);
			}
		}
	});

	onDestroy(() => {
		cancelAnimationFrame(enterRaf);
		clearTimeout(unmountTimer);
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

	function handleSelect() {
		onSelect?.({
			artist,
			originRect: measureOriginRect(originEl),
			waveColor: extractedWaveColor,
			following
		});
	}

	function handleFollowClick(e: MouseEvent) {
		e.stopPropagation();
		if (e.detail > 0) {
			(e.currentTarget as HTMLElement | null)?.blur();
			focused = false;
		}
		if (followLoading) return;
		onFollowToggle?.(artist, !following);
	}
</script>

<!-- PC 전용 아티스트 카드 아이템 (순수 렌더링) -->
<article
	class="pc-artist-item"
	data-detail-card="artist-{artist.id}"
	class:is-active={isActive}
	class:is-following={following}
	onpointerenter={(e) => {
		if (e.pointerType === 'mouse') cardHovered = true;
	}}
	onpointerleave={() => {
		cardHovered = false;
	}}
	onpointercancel={() => {
		cardHovered = false;
	}}
	onfocusin={(e) => {
		if ((e.target as HTMLElement | null)?.matches?.(':focus-visible')) {
			focused = true;
		}
	}}
	onfocusout={(e) => {
		const nextTarget = e.relatedTarget as Node | null;
		if (!nextTarget || !e.currentTarget.contains(nextTarget)) {
			focused = false;
		}
	}}
>
	<div
		class="artist-stage"
		role="button"
		tabindex="0"
		aria-label={`${artist.name} 아티스트`}
		onclick={handleSelect}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				handleSelect();
			}
		}}
	>
		<!-- 아티스트 이미지 뒤쪽 상세 확장·축소 기준 요소 (필수 data-detail-origin) -->
		<div
			bind:this={originEl}
			class="artist-morph-origin"
			data-detail-origin
			aria-hidden="true"
		></div>

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
			disableWave={false}
			active={isActive}
			bind:hovered={imageHovered}
			bind:extractedWaveColor
			fullWidth
		/>

		{#if buttonMounted}
			<div class="follow-center-slot" class:is-visible={buttonVisible} aria-hidden={!buttonVisible}>
				<FdButton
					class="pc-artist-follow-btn"
					setting={followBtnSetting}
					aria-disabled={followLoading || undefined}
					aria-busy={followLoading || undefined}
					tabindex={buttonVisible ? 0 : -1}
					aria-pressed={following}
					onclick={handleFollowClick}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
					}}
				>
					<span class="follow-label">
						<span>팔로우</span><span
							class="follow-suffix-shell"
							class:is-active={following}
							aria-hidden={!following}
						>
							<span class="follow-suffix-inner">&nbsp;중</span>
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
	.pc-artist-item {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		padding: 0;
		box-sizing: border-box;
		user-select: none;
	}

	.pc-artist-item.is-active {
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
	}

	.artist-stage:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--white) 75%, transparent);
		outline-offset: 6px;
		border-radius: 999px;
	}

	.artist-morph-origin {
		position: absolute;
		width: 64%;
		height: 64%;
		border-radius: 999px;
		background: var(--detail-frame-bg);
		z-index: 0;
		pointer-events: none;
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
		width: 9px;
		height: 9px;
		border-radius: 999px;
		background: var(--white);
		box-shadow:
			0 0 10px color-mix(in srgb, var(--white) 55%, transparent),
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
		margin-top: -0.25rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
	}

	.artist-name-btn {
		appearance: none;
		border: none;
		background: transparent;
		padding: 0;
		margin: 0;
		cursor: pointer;
		color: var(--fg);
		transition:
			transform 0.34s cubic-bezier(0.22, 1, 0.36, 1),
			color 0.25s ease;
		transform: translateY(0);
	}

	.pc-artist-item.is-active .artist-name-btn {
		transform: translateY(0.2rem);
		color: var(--white);
	}

	.artist-name {
		display: block;
		font-size: 1.02rem;
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
		filter: blur(4px);
		transform: translate(-50%, -50%) scale(0.84);
		pointer-events: none;
		transition:
			opacity 0.28s cubic-bezier(0.22, 1, 0.36, 1),
			transform 0.32s cubic-bezier(0.22, 1, 0.36, 1),
			filter 0.26s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.follow-center-slot.is-visible {
		opacity: 1;
		filter: blur(0px);
		transform: translate(-50%, -50%) scale(1);
		pointer-events: auto;
	}

	:global(.pc-artist-follow-btn) {
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
		filter: blur(3px);
		transform: translateX(-3px);
		transition:
			grid-template-columns 0.28s cubic-bezier(0.22, 1, 0.36, 1),
			opacity 0.22s ease,
			filter 0.24s ease,
			transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.follow-suffix-shell.is-active {
		grid-template-columns: 1fr;
		opacity: 1;
		filter: blur(0px);
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
