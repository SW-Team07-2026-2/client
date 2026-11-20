<script module lang="ts">
	export type { CatalogArtist } from '#lib/config/artists';
</script>

<script lang="ts">
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import FdButton from '#lib/components/ui/FdButton.svelte';
	import FdImage from '#lib/components/ui/FdImage.svelte';
	import { FluidSetting } from '#lib/fluid/setting';
	import { resolveArtistImageUrl, type CatalogArtist } from '#lib/config/artists';
	import { artistTransition, isMobile } from '#lib/stores';

	interface Props {
		/** 아티스트 데이터 (명세서 C2 CatalogArtistItem 호환) */
		artist: CatalogArtist;
		/** 팔로우 여부 */
		following?: boolean;
		/** 팔로우/취소 요청 진행 중 여부 */
		followLoading?: boolean;
		/** 유체 물결 커스텀 설정 */
		setting?: FluidSetting | Partial<FluidSetting>;
		/** 팔로우 토글 콜백 */
		onFollowToggle?: (artist: CatalogArtist, nextFollowing: boolean) => void | Promise<void>;
		/** 카드(이미지/이름) 클릭 콜백 */
		onclick?: (artist: CatalogArtist) => void;
		/** 추가 클래스 */
		class?: string;
	}

	let {
		artist,
		following = $bindable(false),
		followLoading = false,
		setting,
		onFollowToggle,
		onclick,
		class: klass = ''
	}: Props = $props();

	const resolvedImageSrc = $derived(resolveArtistImageUrl(artist));

	let cardHovered = $state(false);
	let imageHovered = $state(false);
	let focused = $state(false);
	let lastInputWasTouch = $state(false);
	let buttonMounted = $state(false);
	let buttonVisible = $state(false);
	let extractedWaveColor = $state('var(--muted-wave)');
	let photoProxyEl = $state<HTMLDivElement | null>(null);

	let enterRaf = 0;
	let unmountTimer: ReturnType<typeof setTimeout> | undefined;

	const allowHoverOverlay = $derived(!isMobile.current && !lastInputWasTouch);
	const isActive = $derived(focused || (allowHoverOverlay && (cardHovered || imageHovered)));
	const portraitInset = $derived(FluidSetting.from(setting).computedInset);
	const isVtTarget = $derived(artistTransition.vtArtistId === artist.id);

	// 호버 시 지연 마운트 -> 다음 프레임에 가시화(부드러운 등장), 이탈 시 페이드아웃 후 언마운트
	$effect(() => {
		if (isActive && !isVtTarget) {
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

	function handleCardClick() {
		artistTransition.prepareEnter(artist, photoProxyEl, extractedWaveColor, following);
		if (onclick) {
			onclick(artist);
		} else {
			goto(`/artist/${artist.id}`);
		}
	}

	function handleFollowClick(e: MouseEvent) {
		e.stopPropagation();
		// 마우스 클릭으로 포커스가 남아 마우스 이탈 후에도 호버 상태가 풀리지 않는 현상 방지
		if (e.detail > 0) {
			(e.currentTarget as HTMLElement | null)?.blur();
			focused = false;
		}
		if (followLoading) return;
		const next = !following;
		if (onFollowToggle) {
			onFollowToggle(artist, next);
		} else {
			following = next;
		}
	}
</script>

<article
	class="artist-card {klass}"
	class:is-active={isActive}
	class:is-following={following}
	class:is-vt-target={isVtTarget}
	data-artist-card={artist.id}
	onpointerdown={(e) => {
		if (e.pointerType !== 'mouse') {
			lastInputWasTouch = true;
			cardHovered = false;
		} else {
			lastInputWasTouch = false;
		}
	}}
	onpointerenter={(e) => {
		if (e.pointerType === 'mouse' && !isMobile.current) {
			lastInputWasTouch = false;
			cardHovered = true;
		}
	}}
	onpointermove={(e) => {
		if (e.pointerType === 'mouse' && lastInputWasTouch && !isMobile.current) {
			lastInputWasTouch = false;
		}
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
	<!-- 상단 아티스트 이미지: FdImage 기반 (hover 시에도 원형 유지 + 물결 파동) -->
	<div
		class="artist-stage"
		svg
		role="button"
		tabindex="0"
		aria-label={`${artist.name} 아티스트`}
		onclick={handleCardClick}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				handleCardClick();
			}
		}}
	>
		<!-- 팔로우 상태 표시 점 (순수 CSS scale/opacity 애니메이션) -->
		<span
			class="follow-indicator-dot"
			class:is-visible={following && !isVtTarget}
			title={following ? '팔로우 중' : undefined}
			aria-hidden={!following || isVtTarget}
		></span>

		<!-- View Transition 시 캔버스 여백/물결 없이 깔끔한 사진 좌표만 분리해 모핑하기 위한 프록시 레이어 -->
		<div
			bind:this={photoProxyEl}
			class="artist-photo-proxy"
			data-artist-photo={artist.id}
			style:inset="{portraitInset}px"
			style:border-radius="999px"
			aria-hidden="true"
		>
			<img src={resolvedImageSrc} alt="" draggable="false" />
		</div>

		<FdImage
			class="artist-fd-image"
			src={resolvedImageSrc}
			alt={artist.name}
			objectPosition="50% 40%"
			{setting}
			active={isActive}
			bind:hovered={imageHovered}
			bind:extractedWaveColor
			fullWidth
		/>

		<!-- 호버 시 원형 이미지 중앙에 부드럽게 나타나는 팔로우 버튼 -->
		{#if buttonMounted}
			<div class="follow-center-slot" class:is-visible={buttonVisible} aria-hidden={!buttonVisible}>
				<FdButton
					class="artist-follow-center-btn"
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

	<!-- 하단 이름 영역 -->
	<div class="artist-footer">
		<button type="button" class="artist-name-btn" tabindex="-1" onclick={handleCardClick}>
			<span class="artist-name">{artist.name}</span>
		</button>
	</div>
</article>

<style>
	.artist-card {
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

	.artist-card.is-active {
		z-index: 10;
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
		outline: 2px solid rgba(255, 255, 255, 0.75);
		outline-offset: 6px;
		border-radius: 999px;
	}

	.artist-stage :global(.fd-image-wrap.artist-fd-image) {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		z-index: 1;
	}

	.artist-photo-proxy {
		position: absolute;
		z-index: 2;
		overflow: hidden;
		opacity: 0;
		pointer-events: none;
		user-select: none;
	}

	.artist-photo-proxy img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 50% 40%;
		pointer-events: none;
	}

	.artist-card.is-vt-target .artist-photo-proxy {
		opacity: 1;
		view-transition-name: artist-hero-photo;
	}

	.artist-card.is-vt-target :global(.artist-fd-image) {
		opacity: 0;
	}

	/* 원형 이미지 바깥 오른쪽 상단에 위치하는 하얀색 팔로우 표시 점 */
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

	@media (prefers-reduced-motion: reduce) {
		.follow-indicator-dot,
		.follow-indicator-dot.is-visible {
			transition: none;
		}
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
		color: #f4f4f6;
		transition:
			transform 0.34s cubic-bezier(0.22, 1, 0.36, 1),
			color 0.25s ease;
		transform: translateY(0);
	}

	/* 호버 시 파동이 일렁이며 아래쪽 이름이 살짝 움직이고 팔로우 버튼이 아래 여백에 나타남 */
	.artist-card.is-active .artist-name-btn {
		transform: translateY(0.2rem);
		color: #ffffff;
	}

	.artist-name {
		display: block;
		font-size: 1.02rem;
		font-weight: 500;
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

	:global(.artist-follow-center-btn) {
		padding: 0.42rem 0.92rem !important;
		font-size: 0.82rem !important;
		font-weight: 700 !important;
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
		.follow-suffix-shell {
			transition: none;
		}
	}
</style>
