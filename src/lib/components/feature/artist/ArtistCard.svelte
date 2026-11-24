<script module lang="ts">
	export type { CatalogArtist } from '#lib/config/artists';
</script>

<script lang="ts">
	import { onDestroy } from 'svelte';
	import FdButton from '#lib/common/design/fluid/FdButton.svelte';
	import FdImage from '#lib/common/design/fluid/FdImage.svelte';
	import { FluidSetting } from '#lib/common/type/fluid';
	import { resolveArtistImageUrl, type CatalogArtist } from '#lib/config/artists';
	import { isMobile } from '#lib/common/logic';

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
		/** 카드(이미지/이름) 선택 콜백 (확장 애니메이션용 좌표·추출 색상 포함) */
		onSelect?: (payload: {
			artist: CatalogArtist;
			originRect: { left: number; top: number; width: number; height: number } | null;
			waveColor: string;
			following: boolean;
		}) => void;
		/** 카드(이미지/이름) 클릭 콜백 */
		onclick?: (artist: CatalogArtist) => void;
		/** 목록 레이어 활성 여부 (비활성 전환 시 잔여 호버 상태 정리) */
		interactive?: boolean;
		/** 추가 클래스 */
		class?: string;
	}

	let {
		artist,
		following = $bindable(false),
		followLoading = false,
		setting,
		onFollowToggle,
		onSelect,
		onclick,
		interactive = true,
		class: klass = ''
	}: Props = $props();

	const resolvedImageSrc = $derived(resolveArtistImageUrl(artist));

	let cardHovered = $state(false);
	let imageHovered = $state(false);
	let focused = $state(false);
	let lastInputWasTouch = $state(false);
	let buttonMounted = $state(false);
	let buttonVisible = $state(false);
	let mobileFollowOpen = $state(false);
	let longPressPos = $state<{ x: number; y: number } | null>(null);
	let extractedWaveColor = $state('var(--muted-wave)');
	let imageBoxEl = $state<HTMLDivElement | null>(null);
	let stageEl = $state<HTMLDivElement | null>(null);

	let enterRaf = 0;
	let unmountTimer: ReturnType<typeof setTimeout> | undefined;
	let longPressTimer: ReturnType<typeof setTimeout> | undefined;
	let suppressClickTimer: ReturnType<typeof setTimeout> | undefined;
	let suppressNextClick = false;
	let activeTouchPointerId: number | null = null;
	let pressStartX = 0;
	let pressStartY = 0;

	const LONG_PRESS_MS = 420;
	const LONG_PRESS_MOVE_SLOP = 10;

	const allowHoverOverlay = $derived(!isMobile.current && !lastInputWasTouch);
	const isActive = $derived(
		interactive &&
			(mobileFollowOpen || focused || (allowHoverOverlay && (cardHovered || imageHovered)))
	);

	// 목록 레이어가 상세 화면 뒤로 숨겨질 때 잔여 호버/포커스 상태 정리
	$effect(() => {
		if (!interactive) {
			cardHovered = false;
			imageHovered = false;
			focused = false;
			mobileFollowOpen = false;
		}
	});

	// 모바일 꾹 누르기로 열린 팔로우 버튼은 바깥 영역 터치 또는 스크롤 시 닫힘
	$effect(() => {
		if (!mobileFollowOpen || typeof window === 'undefined') return;

		const handleOutsideDown = (e: PointerEvent) => {
			const target = e.target as Node | null;
			if (target && stageEl?.querySelector('.follow-center-slot')?.contains(target)) {
				return;
			}
			mobileFollowOpen = false;
		};
		const handleScrollClose = () => {
			mobileFollowOpen = false;
		};

		window.addEventListener('pointerdown', handleOutsideDown, true);
		window.addEventListener('scroll', handleScrollClose, { passive: true });
		return () => {
			window.removeEventListener('pointerdown', handleOutsideDown, true);
			window.removeEventListener('scroll', handleScrollClose);
		};
	});

	// 호버 시 지연 마운트 -> 다음 프레임에 가시화(부드러운 등장), 이탈 시 페이드아웃 후 언마운트
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
		activeTouchPointerId = null;
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

	function openMobileFollowAt(clientX: number, clientY: number) {
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
		mobileFollowOpen = true;
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
		if (!isMobile.current) return;
		if (e.target && stageEl?.querySelector('.follow-center-slot')?.contains(e.target as Node)) {
			return;
		}
		if (e.pointerType === 'mouse' && e.button !== 0) return;

		clearLongPressTimer();
		activeTouchPointerId = e.pointerId;
		pressStartX = e.clientX;
		pressStartY = e.clientY;
		longPressTimer = setTimeout(() => {
			longPressTimer = undefined;
			activeTouchPointerId = null;
			openMobileFollowAt(pressStartX, pressStartY);
		}, LONG_PRESS_MS);
	}

	function handleStagePointerMove(e: PointerEvent) {
		if (activeTouchPointerId !== e.pointerId || !longPressTimer) return;
		if (Math.hypot(e.clientX - pressStartX, e.clientY - pressStartY) > LONG_PRESS_MOVE_SLOP) {
			clearLongPressTimer();
		}
	}

	function handleStagePointerEnd(e: PointerEvent) {
		if (activeTouchPointerId === e.pointerId) {
			clearLongPressTimer();
		}
	}

	function handleStageClick(e: MouseEvent) {
		if (suppressNextClick) {
			suppressNextClick = false;
			clearTimeout(suppressClickTimer);
			e.preventDefault();
			e.stopPropagation();
			return;
		}
		if (isMobile.current && mobileFollowOpen) {
			mobileFollowOpen = false;
			e.preventDefault();
			e.stopPropagation();
			return;
		}
		handleCardClick();
	}

	function handleCardClick() {
		const targetEl =
			imageBoxEl?.querySelector<HTMLElement>('.fd-img') ?? imageBoxEl;
		const domRect = targetEl?.getBoundingClientRect();
		const originRect =
			domRect && domRect.width > 0 && domRect.height > 0
				? {
						left: domRect.left,
						top: domRect.top,
						width: domRect.width,
						height: domRect.height
					}
				: null;
		onSelect?.({
			artist,
			originRect,
			waveColor: extractedWaveColor,
			following
		});
		onclick?.(artist);
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
	data-artist-card={artist.id}
	class:is-active={isActive}
	class:is-following={following}
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
		bind:this={stageEl}
		class="artist-stage"
		role="button"
		tabindex="0"
		aria-label={`${artist.name} 아티스트`}
		onpointerdown={handleStagePointerDown}
		onpointermove={handleStagePointerMove}
		onpointerup={handleStagePointerEnd}
		onpointercancel={handleStagePointerEnd}
		oncontextmenu={(e) => {
			if (isMobile.current) e.preventDefault();
		}}
		onclick={handleStageClick}
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
			{setting}
			disableWave={isMobile.current}
			active={!isMobile.current && isActive}
			bind:hovered={imageHovered}
			bind:extractedWaveColor
			bind:boxEl={imageBoxEl}
			fullWidth
		/>

		<!-- 호버 시 원형 이미지 중앙(모바일 꾹 누르기 시 누른 위치)에 부드럽게 나타나는 팔로우 버튼 -->
		{#if buttonMounted}
			<div
				class="follow-center-slot"
				class:is-visible={buttonVisible}
				style:left={longPressPos ? `${longPressPos.x.toFixed(1)}px` : undefined}
				style:top={longPressPos ? `${longPressPos.y.toFixed(1)}px` : undefined}
				aria-hidden={!buttonVisible}
			>
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
							<span class="follow-suffix-inner">&nbsp;{isMobile.current ? '취소' : '중'}</span>
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
