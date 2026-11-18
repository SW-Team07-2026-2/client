<script module lang="ts">
	export type { CatalogArtist } from '#lib/config/artists';
</script>

<script lang="ts">
	import { goto } from '$app/navigation';
	import FdButton from '#lib/components/ui/FdButton.svelte';
	import FdImage from '#lib/components/ui/FdImage.svelte';
	import { FluidSetting } from '#lib/fluid/setting';
	import { resolveArtistImageUrl, type CatalogArtist } from '#lib/config/artists';
	import { artistTransition } from '#lib/stores';

	interface Props {
		/** 아티스트 데이터 (명세서 C2 CatalogArtistItem 호환) */
		artist: CatalogArtist;
		/** 팔로우 여부 */
		following?: boolean;
		/** 팔로우/취소 요청 진행 중 여부 */
		followLoading?: boolean;
		/** 유체 물결 커스텀 설정 */
		setting?: FluidSetting | Partial<FluidSetting>;
		/** 팔로우/팔로우 취소 버튼 클릭 콜백 */
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
	let extractedWaveColor = $state('#a78bfa');
	let photoProxyEl = $state<HTMLDivElement | null>(null);

	const isActive = $derived(cardHovered || imageHovered || focused);
	const portraitInset = $derived(FluidSetting.from(setting).computedInset);
	const isVtTarget = $derived(artistTransition.vtArtistId === artist.id);

	const followBtnSetting = $derived.by(() => {
		const compactBase = {
			inset: 6,
			layers: 1,
			layerGap: 2,
			waveAmp: 1.8,
			bulge: 4,
			reach: 24
		};
		if (following) {
			return new FluidSetting({
				...compactBase,
				color: 'rgba(255, 255, 255, 0.1)',
				hoverColor: 'rgba(244, 63, 94, 0.24)',
				pressColor: 'rgba(244, 63, 94, 0.36)',
				waveColor: 'rgba(251, 113, 133, 0.55)',
				borderWidth: 1,
				borderColor: 'rgba(255, 255, 255, 0.22)',
				hoverBorderColor: 'rgba(251, 113, 133, 0.72)',
				textColor: '#ffffff'
			});
		}
		return new FluidSetting({
			...compactBase,
			color: '#ffffff',
			hoverColor: '#f4f4f6',
			pressColor: '#e4e4e7',
			waveColor: extractedWaveColor,
			textColor: '#09090d'
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
	style="--artist-dot-color:{extractedWaveColor};"
	onpointerenter={() => {
		cardHovered = true;
	}}
	onpointerleave={() => {
		cardHovered = false;
	}}
	onfocusin={() => {
		focused = true;
	}}
	onfocusout={(e) => {
		const nextTarget = e.relatedTarget as Node | null;
		if (!nextTarget || !e.currentTarget.contains(nextTarget)) {
			focused = false;
		}
	}}
>
	<!-- 상단 아티스트 이미지: FdImage 기반 (원형 -> hover 시 약간 둥근 사각형 모핑 + 앞면 이미지/뒷면 2겹 물결 파동) -->
	<div
		class="artist-stage"
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
		<!-- 이미 팔로우 중인 경우 오른쪽 윗공간에 표시되는 작은 점 (hover 시 사각형으로 변하며 자연스럽게 가려짐) -->
		{#if following}
			<span class="follow-indicator-dot" title="팔로우 중" aria-label="팔로우 중"></span>
		{/if}

		<!-- View Transition 시 캔버스 여백/물결 없이 깔끔한 사진 좌표만 분리해 모핑하기 위한 프록시 레이어 -->
		<div
			bind:this={photoProxyEl}
			class="artist-photo-proxy"
			data-artist-photo={artist.id}
			style:inset="{portraitInset}px"
			style:border-radius={isActive ? '28px' : '999px'}
			aria-hidden="true"
		>
			<img src={resolvedImageSrc} alt="" draggable="false" />
		</div>

		<FdImage
			class="artist-fd-image"
			src={resolvedImageSrc}
			alt={artist.name}
			{setting}
			hoverRadius={28}
			active={isActive}
			bind:hovered={imageHovered}
			bind:extractedWaveColor
			fullWidth
		/>
	</div>

	<!-- 하단 이름 및 팔로우/팔로우 취소 버튼 영역 -->
	<div class="artist-footer">
		<button type="button" class="artist-name-btn" tabindex="-1" onclick={handleCardClick}>
			<span class="artist-name">{artist.name}</span>
		</button>

		<div class="follow-action-slot" aria-hidden={!isActive}>
			<FdButton
				class="artist-follow-btn"
				setting={followBtnSetting}
				disabled={followLoading}
				tabindex={isActive ? 0 : -1}
				onclick={handleFollowClick}
			>
				{following ? '팔로우 취소' : '팔로우'}
			</FdButton>
		</div>
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
		border-radius: 28px;
	}

	:global(.artist-fd-image) {
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
		pointer-events: none;
	}

	.artist-card.is-vt-target .artist-photo-proxy {
		opacity: 1;
		view-transition-name: artist-hero-photo;
	}

	.artist-card.is-vt-target :global(.artist-fd-image),
	.artist-card.is-vt-target .follow-indicator-dot {
		opacity: 0;
	}

	/* 원형 이미지 바깥 오른쪽 윗공간에 위치하는 작은 팔로우 표시 점
	   z-index: 0 이므로 hover 시 원형이 둥근 사각형으로 변하며 확장될 때 자연스럽게 가려짐 */
	.follow-indicator-dot {
		position: absolute;
		top: 13.5%;
		right: 13.5%;
		width: 9px;
		height: 9px;
		border-radius: 999px;
		background: var(--artist-dot-color, #a78bfa);
		box-shadow:
			0 0 10px var(--artist-dot-color, rgba(167, 139, 250, 0.85)),
			0 0 0 2px rgba(7, 7, 9, 0.9);
		z-index: 0;
		pointer-events: none;
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

	.follow-action-slot {
		position: absolute;
		top: 100%;
		left: 50%;
		margin-top: 0.1rem;
		opacity: 0;
		transform: translate(-50%, -0.2rem) scale(0.92);
		pointer-events: none;
		z-index: 15;
		transition:
			opacity 0.26s cubic-bezier(0.22, 1, 0.36, 1),
			transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.artist-card.is-active .follow-action-slot {
		opacity: 1;
		transform: translate(-50%, 0.25rem) scale(1);
		pointer-events: auto;
	}

	:global(.artist-follow-btn) {
		padding: 0.32rem 0.9rem !important;
		font-size: 0.8rem !important;
		font-weight: 700 !important;
		letter-spacing: -0.01em;
		white-space: nowrap;
	}
</style>
