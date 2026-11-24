<script lang="ts">
	import { tick, type Snippet } from 'svelte';
	import FdButton from '#lib/common/design/fluid/FdButton.svelte';
	import FdInput from '#lib/common/design/fluid/FdInput.svelte';
	import WelcomeArtistItem from './WelcomeArtistItem.svelte';
	import FoldText from './part/FoldText.svelte';
	import { FluidSetting } from '#lib/common/type/fluid';
	import type { ArtistItem } from './welcome';

	interface Props {
		/** 화면에 표시할 아티스트 목록 (부모 페이지에서 조립/관리) */
		artists?: ArtistItem[];
		/** 선택된 아티스트 ID 목록 (양방향 바인딩) */
		selectedIds?: string[];
		/** 검색어 (양방향 바인딩) */
		searchQuery?: string;
		/** 인트로 애니메이션 완료 여부 (뒤로갔다 재진입 시 스킵용) */
		introDone?: boolean;
		/** 제출(가입 완료) 처리 중 여부 */
		isSubmitting?: boolean;
		/** '더 추가하기' 로딩 여부 */
		isLoadingMore?: boolean;
		/** 아티스트 선택/해제 및 연관 아티스트 확장 콜백 */
		onToggleArtist?: (
			artist: ArtistItem,
			index: number,
			nextSelected: boolean
		) => Promise<void> | void;
		/** '더 추가하기' 클릭 콜백 */
		onAddMore?: () => Promise<void> | void;
		/** '다음으로' 클릭 콜백 (1명 이상 선택 시) */
		onComplete?: (artists: ArtistItem[], ids: string[]) => void;
		/** 하위 호환용 건너뛰기 콜백 */
		onSkip?: () => void;
		/** 커스텀 디스플레이 슬롯 (미지정 시 artists 기반 기본 플로우 그리드 렌더링) */
		children?: Snippet;
	}

	let {
		artists = [],
		selectedIds = $bindable<string[]>([]),
		searchQuery = $bindable(''),
		introDone = $bindable(false),
		isSubmitting = false,
		isLoadingMore = false,
		onToggleArtist,
		onAddMore,
		onComplete,
		children
	}: Props = $props();

	const MORE_BTN_ID = '__more_btn__';

	// 검색창 FluidSetting: 뒷배경(#070709)과 동일한 배경색 + 연한 회색 테두리
	const SEARCH_INPUT_SETTING = new FluidSetting({
		color: '#070709',
		hoverColor: '#070709',
		pressColor: '#0d0d12',
		waveColor: '#71717a',
		textColor: '#f0f0f0',
		borderWidth: 1,
		borderColor: 'rgba(255, 255, 255, 0.28)',
		hoverBorderColor: 'rgba(255, 255, 255, 0.5)',
		pressBorderColor: 'rgba(255, 255, 255, 0.65)'
	});

	const SEARCH_FOCUS_SETTING = SEARCH_INPUT_SETTING.with({
		color: '#070709',
		hoverColor: '#070709',
		borderColor: 'rgba(255, 255, 255, 0.6)',
		hoverBorderColor: 'rgba(255, 255, 255, 0.75)',
		waveColor: '#a1a1aa',
		pauseWhenIdle: false
	});

	// '더 추가하기' 원형 버튼: WelcomeArtistItem과 동일한 FluidSetting 기본 물결값 사용
	const MORE_BUTTON_SETTING = new FluidSetting({
		color: '#141418',
		hoverColor: '#1e1e26',
		pressColor: '#0e0e12',
		waveColor: '#71717a',
		textColor: '#ffffff',
		borderWidth: 1,
		borderColor: 'rgba(255, 255, 255, 0.22)',
		hoverBorderColor: 'rgba(255, 255, 255, 0.48)',
		pressBorderColor: 'rgba(255, 255, 255, 0.65)',
		pauseWhenIdle: true
	});

	let slotElements = new Map<string, HTMLElement>();

	const selectedArtists = $derived(artists.filter((a) => selectedIds.includes(a.id)));
	const hasSelection = $derived(selectedIds.length > 0);

	$effect(() => {
		if (introDone) return;
		const timer = setTimeout(() => {
			introDone = true;
		}, 1400);
		return () => clearTimeout(timer);
	});

	function registerSlot(el: HTMLElement, id: string) {
		slotElements.set(id, el);
		return {
			update(newId: string) {
				if (newId !== id) {
					slotElements.delete(id);
					id = newId;
					slotElements.set(id, el);
				}
			},
			destroy() {
				slotElements.delete(id);
			}
		};
	}

	/** 현재 화면의 모든 슬롯 중심 좌표를 기록 (FLIP 애니메이션용) */
	function capturePositions(): Map<string, { x: number; y: number }> {
		const map = new Map<string, { x: number; y: number }>();
		for (const [id, el] of slotElements.entries()) {
			const r = el.getBoundingClientRect();
			map.set(id, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
		}
		return map;
	}

	/**
	 * 새 아티스트가 추가될 때:
	 * - 새로 추가된 아티스트들은 클릭한 모체(originId) 중심에서 튀어나오듯 이동
	 * - 기존 아티스트들은 이전 위치에서 새 위치로 부드럽게 슬라이딩
	 */
	function playFlipAnimation(
		beforeMap: Map<string, { x: number; y: number }>,
		originId: string,
		newIds: Set<string>
	) {
		if (
			typeof window !== 'undefined' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		) {
			return;
		}

		const originPos = beforeMap.get(originId);
		let newOrderIdx = 0;

		for (const [id, el] of slotElements.entries()) {
			const rect = el.getBoundingClientRect();
			const curX = rect.left + rect.width / 2;
			const curY = rect.top + rect.height / 2;

			if (newIds.has(id)) {
				if (!originPos) continue;
				const dx = originPos.x - curX;
				const dy = originPos.y - curY;
				const delay = newOrderIdx * 45;
				newOrderIdx++;

				el.animate(
					[
						{
							transform: `translate3d(${dx}px, ${dy}px, 0) scale(0.35)`,
							opacity: 0
						},
						{
							transform: `translate3d(${dx * 0.15}px, ${dy * 0.15}px, 0) scale(1.04)`,
							opacity: 1,
							offset: 0.72
						},
						{
							transform: 'translate3d(0, 0, 0) scale(1)',
							opacity: 1
						}
					],
					{
						duration: 520,
						delay,
						easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
						fill: 'both'
					}
				);
			} else {
				const prev = beforeMap.get(id);
				if (!prev) continue;
				const dx = prev.x - curX;
				const dy = prev.y - curY;
				if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;

				el.animate(
					[
						{ transform: `translate3d(${dx}px, ${dy}px, 0)` },
						{ transform: 'translate3d(0, 0, 0)' }
					],
					{
						duration: 460,
						easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
					}
				);
			}
		}
	}

	async function handleItemClick(artist: ArtistItem, idx: number, nextSelected: boolean) {
		const beforeIds = new Set(artists.map((a) => a.id));
		const beforeMap = capturePositions();

		await onToggleArtist?.(artist, idx, nextSelected);
		await tick();

		const addedIds = new Set(artists.map((a) => a.id).filter((id) => !beforeIds.has(id)));
		if (addedIds.size > 0) {
			playFlipAnimation(beforeMap, artist.id, addedIds);
		}
	}

	async function handleMoreClick() {
		if (isLoadingMore) return;
		const beforeIds = new Set(artists.map((a) => a.id));
		const beforeMap = capturePositions();

		await onAddMore?.();
		await tick();

		const addedIds = new Set(artists.map((a) => a.id).filter((id) => !beforeIds.has(id)));
		if (addedIds.size > 0) {
			playFlipAnimation(beforeMap, MORE_BTN_ID, addedIds);
		}
	}

	function handleNextClick() {
		if (!hasSelection || isSubmitting) return;
		onComplete?.(selectedArtists, selectedIds);
	}
</script>

<main class="welcome-page">
	<!-- 1. 상단 타이틀 (FoldText) + 검색창 & 다음으로 컨트롤 바 -->
	<header class="welcome-hero">
		<div class="hero-title-wrap">
			<FoldText
				text="좋아하는 아티스트를 골라주세요."
				splitBy="char"
				foldStyle="paper"
				hinge="top"
				duration={0.85}
				stagger={0.032}
				staggerFrom="start"
				trigger="mount"
				fontSize="clamp(1.65rem, 3.6vw, 2.55rem)"
				fontWeight={700}
				color="#ffffff"
			/>
		</div>

		<div class="controls-bar">
			<div class="search-wrap">
				<FdInput
					bind:value={searchQuery}
					placeholder="아티스트 검색"
					clearable
					fullWidth
					setting={SEARCH_INPUT_SETTING}
					focusSetting={SEARCH_FOCUS_SETTING}
					placeholderColor="#71717a"
				>
					{#snippet prefix()}
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="17"
							height="17"
							viewBox="0 0 512 512"
							fill="currentColor"
							aria-hidden="true"
						>
							<path
								d="M416 208c0 45.9-14.9 88.3-40 122.7l126.6 126.7c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0s208 93.1 208 208M208 352a144 144 0 1 0 0-288a144 144 0 1 0 0 288"
							/>
						</svg>
					{/snippet}
				</FdInput>
			</div>

			<FdButton
				class="next-step-btn"
				color={hasSelection ? '#ffffff' : '#18181d'}
				hoverColor={hasSelection ? '#f4f4f6' : '#18181d'}
				pressColor={hasSelection ? '#d4d4d8' : '#18181d'}
				waveColor={hasSelection ? '#ffffff' : '#2e2e36'}
				textColor={hasSelection ? '#070709' : '#63636e'}
				disabled={!hasSelection || isSubmitting}
				onclick={handleNextClick}
			>
				다음으로
			</FdButton>
		</div>
	</header>

	<!-- 2. 메인 아티스트 선택 그리드 -->
	<section class="display-section">
		<div class="display-inner">
			{#if children}
				{@render children()}
			{:else}
				<div class="artist-display">
					<div class="artist-flow" role="group" aria-label="관심 아티스트 선택 목록">
						{#each artists as artist, idx (artist.id)}
							{@const isSelected = selectedIds.includes(artist.id)}
							<div class="artist-slot" use:registerSlot={artist.id}>
								<WelcomeArtistItem
									{artist}
									selected={isSelected}
									onclick={() => handleItemClick(artist, idx, !isSelected)}
								/>
							</div>
						{/each}

						{#if onAddMore}
							<!-- 항상 마지막에 위치하는 '더 추가하기' 버튼 (WelcomeArtistItem과 동일한 크기·물결) -->
							<div class="artist-slot" use:registerSlot={MORE_BTN_ID}>
								<FdButton
									class="artist-more-btn"
									onclick={handleMoreClick}
									disabled={isLoadingMore}
									setting={MORE_BUTTON_SETTING}
								>
									<span class="more-center-overlay">
										<svg
											viewBox="0 0 24 24"
											fill="none"
											aria-hidden="true"
											class="plus-icon"
										>
											<path
												d="M12 6V18M6 12H18"
												stroke="currentColor"
												stroke-width="2"
												stroke-linecap="round"
											/>
										</svg>
										<span class="more-label">더 추가하기</span>
									</span>
								</FdButton>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</section>
</main>

<style>
	.welcome-page {
		height: 100dvh;
		max-height: 100dvh;
		background-color: #070709;
		color: #ffffff;
		display: flex;
		flex-direction: column;
		box-sizing: border-box;
		overflow: hidden;
		position: relative;
	}

	/* -------------------------------------------------------------
	   1. 상단 히어로 타이틀(FoldText) & 검색/다음 컨트롤 바
	   ------------------------------------------------------------- */
	.welcome-hero {
		flex-shrink: 0;
		width: 100%;
		max-width: 1040px;
		margin: 0 auto;
		padding: clamp(2rem, 4.5vh, 3.5rem) 1.5rem 1.25rem;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
		z-index: 20;
	}

	.hero-title-wrap {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		letter-spacing: -0.03em;
	}

	/* FoldText가 펼쳐진 직후 약간 느리게 부드럽게 등장 */
	.controls-bar {
		width: 100%;
		max-width: 520px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		opacity: 0;
		animation: slowComponentReveal 0.85s cubic-bezier(0.16, 1, 0.3, 1) 0.28s forwards;
	}

	.search-wrap {
		flex: 1;
		min-width: 0;
	}

	.search-wrap :global(.fd-wrap) {
		margin: calc(-1 * var(--fd-i-inset, 0px));
	}

	.controls-bar :global(button.next-step-btn) {
		font-size: 0.9rem !important;
		font-weight: 600 !important;
		letter-spacing: -0.015em;
		white-space: nowrap;
		padding: 0 1.35rem !important;
		height: 42px !important;
	}

	@keyframes slowComponentReveal {
		from {
			opacity: 0;
			transform: translateY(14px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* -------------------------------------------------------------
	   2. 메인 인터랙션 콘텐츠 영역 & 아티스트 플로우 그리드
	   ------------------------------------------------------------- */
	.display-section {
		flex: 1;
		min-height: 0;
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-width: none;
		-ms-overflow-style: none;
		box-sizing: border-box;
		position: relative;
		opacity: 0;
		animation: slowComponentReveal 0.95s cubic-bezier(0.16, 1, 0.3, 1) 0.42s forwards;
	}

	.display-section::-webkit-scrollbar {
		display: none;
	}

	.display-inner {
		width: 100%;
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
	}

	.artist-display {
		--orb-size: 112px;
		width: 100%;
		padding: 20px 16px 40px;
		box-sizing: border-box;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
	}

	.artist-flow {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: 24px 22px;
		max-width: 980px;
		margin: 0 auto;
	}

	.artist-slot {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		will-change: transform, opacity;
	}

	.artist-slot :global(.lq),
	.artist-slot :global(.fd-wrap) {
		margin: calc(-1 * var(--fd-i-inset, 0px));
	}

	.artist-slot :global(.fd-image-wrap) {
		margin: calc(-1 * var(--fd-i-inset, 0px));
	}

	/* '더 추가하기' 버튼: WelcomeArtistItem과 동일한 원 크기(--orb-size) */
	.artist-slot :global(button.artist-more-btn) {
		box-sizing: content-box !important;
		width: var(--orb-size);
		height: var(--orb-size);
		padding: 0 !important;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.more-center-overlay {
		width: var(--orb-size);
		height: var(--orb-size);
		border-radius: 9999px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		padding: 0.65rem;
		box-sizing: border-box;
		pointer-events: none;
	}

	.plus-icon {
		width: 22px;
		height: 22px;
		color: rgba(255, 255, 255, 0.9);
		transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.artist-slot :global(.fd-wrap[data-hovered] .plus-icon) {
		transform: rotate(90deg);
	}

	.more-label {
		color: rgba(255, 255, 255, 0.92);
		font-size: 0.84rem;
		font-weight: 700;
		line-height: 1.2;
		letter-spacing: -0.02em;
		text-align: center;
		word-break: keep-all;
	}

	@media (max-width: 768px) {
		.artist-display {
			--orb-size: 96px;
		}
		.artist-flow {
			gap: 20px 18px;
		}
		.more-label {
			font-size: 0.78rem;
		}
	}

	@media (max-width: 640px) {
		.welcome-hero {
			padding: 1.75rem 1.25rem 1rem;
			gap: 1.15rem;
		}

		.controls-bar {
			max-width: 100%;
			gap: 0.6rem;
		}
	}

	@media (max-width: 480px) {
		.artist-display {
			--orb-size: 84px;
			padding: 16px 8px 32px;
		}
		.artist-flow {
			gap: 16px 14px;
		}
		.plus-icon {
			width: 18px;
			height: 18px;
		}
		.more-label {
			font-size: 0.74rem;
		}
	}
</style>
