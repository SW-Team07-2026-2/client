<script lang="ts">
	import { formatAlbumPrice } from '#lib/common/catalog/albums';
	import { LoadingSpinner } from '#lib/dedicated/loading';
	import DetailAmbientGlow from '../../_shared/design/DetailAmbientGlow.svelte';
	import type {
		AlbumPhysicalEdition,
		AlbumTrackItem,
		ProductOptionItem
	} from '../logic/albumDetail.svelte';
	import type { AlbumMediaItem } from '../logic/albumDetailState.svelte';
	import AlbumMediaBack from '../part/AlbumMediaBack.svelte';

	interface Props {
		isLoading: boolean;
		errorMessage: string | null;
		albumTitle: string;
		albumTypeLabel: string;
		artistId: number | null;
		artistName: string;
		genres: string[];
		releasedAt: string | null;
		coverUrl: string;
		accentColor: string;
		tracks: AlbumTrackItem[];
		editions: AlbumPhysicalEdition[];
		selectedEdition: AlbumPhysicalEdition | null;
		activeMediaItems: AlbumMediaItem[];
		options: ProductOptionItem[];
		optionsLoading: boolean;
		selectedOption: ProductOptionItem | null;
		qty: number;
		maxOrderQty: number;
		totalPrice: number | null;
		cartSubmitting: boolean;
		collectionSubmitting: boolean;
		isCollected: boolean;
		mobile: boolean;
		backLabel?: string;
		onClose: () => void;
		onGoToArtist: () => void;
		onSelectEdition: (editionId: number) => void;
		onSelectOption: (optionId: number) => void;
		onStepQty: (delta: number) => void;
		onAddToCart: () => void;
		onToggleCollection: () => void;
		onShareLink: () => void;
	}

	let {
		isLoading,
		errorMessage,
		albumTitle,
		albumTypeLabel,
		artistId,
		artistName,
		genres,
		releasedAt,
		coverUrl,
		accentColor,
		tracks,
		editions,
		selectedEdition,
		activeMediaItems,
		options,
		optionsLoading,
		selectedOption,
		qty,
		maxOrderQty,
		totalPrice,
		cartSubmitting,
		collectionSubmitting,
		isCollected,
		mobile,
		backLabel = '목록으로',
		onClose,
		onGoToArtist,
		onSelectEdition,
		onSelectOption,
		onStepQty,
		onAddToCart,
		onToggleCollection,
		onShareLink
	}: Props = $props();

	let heroHovered = $state(false);

	const formattedDate = $derived(
		releasedAt ? releasedAt.trim().slice(0, 10).replace(/-/g, '.') : ''
	);
	const formattedTotalPrice = $derived(formatAlbumPrice(totalPrice));
	const isCurrentSoldOut = $derived(
		selectedOption ? selectedOption.soldOut : Boolean(selectedEdition?.soldOut)
	);
</script>

<!-- 앨범 상세 뷰 (공용 앰비언트 글로우 · 커버+실물 미디어 히어로 · 에디션/옵션 구매 · 수록곡 트랙리스트, 순수 렌더링) -->
<div class="album-detail" class:is-mobile={mobile}>
	<DetailAmbientGlow color={accentColor} height={mobile ? 380 : 540} />

	<div class="detail-container">
		<div class="detail-top-nav">
			<button type="button" class="detail-back-btn" onclick={onClose}>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="m15 18-6-6 6-6" />
				</svg>
				<span>{backLabel}</span>
			</button>

			<button
				type="button"
				class="detail-share-btn"
				onclick={onShareLink}
				aria-label="앨범 링크 공유"
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.9"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<circle cx="18" cy="5" r="3" />
					<circle cx="6" cy="12" r="3" />
					<circle cx="18" cy="19" r="3" />
					<line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
					<line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
				</svg>
				<span>공유</span>
			</button>
		</div>

		{#if isLoading && !albumTitle}
			<div class="detail-state-box" role="status" aria-live="polite">
				<LoadingSpinner size={24} />
			</div>
		{:else if errorMessage && !albumTitle}
			<div class="detail-state-box" role="alert">
				<p class="detail-error-text">{errorMessage}</p>
			</div>
		{:else}
			<!-- 1. 상단 히어로: 좌측 커버(+실물 미디어) · 우측 메타 + 에디션/옵션 선택 + 장바구니/보유음반 -->
			<header class="album-hero">
				<div
					class="album-hero-visual"
					role="presentation"
					onpointerenter={() => {
						if (!mobile) heroHovered = true;
					}}
					onpointerleave={() => {
						heroHovered = false;
					}}
				>
					<div class="hero-pack">
						{#if activeMediaItems.length > 0}
							<div class="hero-media-peek" class:is-open={heroHovered}>
								<AlbumMediaBack
									items={activeMediaItems}
									{coverUrl}
									open={heroHovered}
									interactive={false}
								/>
							</div>
						{/if}

						<div class="hero-cover-frame">
							{#if coverUrl}
								<img class="hero-cover-img" src={coverUrl} alt={albumTitle} decoding="async" />
							{:else}
								<div class="hero-cover-fallback" aria-hidden="true"></div>
							{/if}
						</div>
					</div>
				</div>

				<div class="album-hero-info">
					<div class="album-eyebrow">
						{#if albumTypeLabel}
							<span class="eyebrow-pill">{albumTypeLabel}</span>
						{/if}
						{#each genres.slice(0, 3) as genre (genre)}
							<span class="eyebrow-text">{genre}</span>
						{/each}
						{#if formattedDate}
							<span class="eyebrow-text is-date">{formattedDate}</span>
						{/if}
					</div>

					<h1 class="album-hero-title">{albumTitle}</h1>

					{#if artistName}
						{#if artistId !== null}
							<button type="button" class="artist-link-btn" onclick={onGoToArtist}>
								<span>{artistName}</span>
								<svg
									width="15"
									height="15"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								>
									<path d="m9 18 6-6-6-6" />
								</svg>
							</button>
						{:else}
							<p class="artist-plain-name">{artistName}</p>
						{/if}
					{/if}

					<!-- 피지컬 에디션(LP · CD · 카세트) & 옵션 선택 -->
					{#if editions.length > 0}
						<div class="purchase-panel">
							{#if editions.length > 1}
								<div class="selector-group">
									<span class="selector-label">음반 형태</span>
									<div class="edition-tabs" role="tablist" aria-label="음반 형태 선택">
										{#each editions as ed (ed.id)}
											{@const isSelected = selectedEdition?.id === ed.id}
											<button
												type="button"
												role="tab"
												aria-selected={isSelected}
												class="choice-chip"
												class:is-selected={isSelected}
												class:is-soldout={ed.soldOut}
												onclick={() => onSelectEdition(ed.id)}
											>
												<span>{ed.format}</span>
												{#if ed.minPrice !== null}
													<span class="chip-sub">{formatAlbumPrice(ed.minPrice)}</span>
												{/if}
											</button>
										{/each}
									</div>
								</div>
							{/if}

							<div class="selector-group">
								<span class="selector-label">옵션</span>
								{#if optionsLoading}
									<div class="options-loading">
										<LoadingSpinner size={16} />
									</div>
								{:else if options.length > 0}
									<div class="option-chips">
										{#each options as opt (opt.id)}
											{@const isSelected = selectedOption?.id === opt.id}
											<button
												type="button"
												class="choice-chip"
												class:is-selected={isSelected}
												class:is-soldout={opt.soldOut}
												onclick={() => onSelectOption(opt.id)}
											>
												<span>{opt.name}</span>
												{#if opt.soldOut}
													<span class="chip-sub">품절</span>
												{:else}
													<span class="chip-sub">{formatAlbumPrice(opt.price)}</span>
												{/if}
											</button>
										{/each}
									</div>
								{/if}
							</div>

							<!-- 수량 + 합계 금액 -->
							<div class="price-qty-row">
								<div class="qty-stepper" aria-label="수량 선택">
									<button
										type="button"
										class="qty-btn"
										disabled={qty <= 1 || isCurrentSoldOut}
										onclick={() => onStepQty(-1)}
										aria-label="수량 감소"
									>
										−
									</button>
									<span class="qty-value">{qty}</span>
									<button
										type="button"
										class="qty-btn"
										disabled={qty >= maxOrderQty || isCurrentSoldOut}
										onclick={() => onStepQty(1)}
										aria-label="수량 증가"
									>
										+
									</button>
								</div>

								<div class="price-summary">
									{#if isCurrentSoldOut}
										<span class="soldout-price-text">품절</span>
									{:else if formattedTotalPrice}
										<span class="total-price-value">{formattedTotalPrice}</span>
									{/if}
								</div>
							</div>

							<!-- 주요 액션 버튼 -->
							<div class="action-buttons">
								<button
									type="button"
									class="primary-cart-btn"
									disabled={isCurrentSoldOut || cartSubmitting || !selectedOption}
									onclick={onAddToCart}
								>
									{#if cartSubmitting}
										담는 중...
									{:else if isCurrentSoldOut}
										품절된 상품입니다
									{:else}
										장바구니 담기
									{/if}
								</button>

								<button
									type="button"
									class="secondary-collection-btn"
									class:is-collected={isCollected}
									disabled={collectionSubmitting || !selectedOption}
									onclick={onToggleCollection}
								>
									<svg
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill={isCollected ? 'currentColor' : 'none'}
										stroke="currentColor"
										stroke-width="1.9"
										stroke-linecap="round"
										stroke-linejoin="round"
										aria-hidden="true"
									>
										<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
									</svg>
									<span>{isCollected ? '보유 음반' : '보유 음반 등록'}</span>
								</button>
							</div>
						</div>
					{/if}
				</div>
			</header>

			<!-- 2. 하단 수록곡 트랙리스트 (글자 + 얇은 구분선 에디토리얼 스타일) -->
			{#if tracks.length > 0}
				<section class="tracklist-section" aria-label="수록곡">
					<div class="section-head">
						<h2 class="section-title">수록곡</h2>
						<span class="section-count">{tracks.length}곡</span>
					</div>

					<ol class="track-list">
						{#each tracks as track (track.id)}
							<li class="track-row">
								<span class="track-no">{String(track.trackNo).padStart(2, '0')}</span>
								<div class="track-main">
									<span class="track-title">{track.title}</span>
									{#if track.moods.length > 0 || track.genres.length > 0}
										<div class="track-tags">
											{#each track.genres.slice(0, 2) as g (g)}
												<span class="track-tag">{g}</span>
											{/each}
											{#each track.moods.slice(0, 2) as m (m)}
												<span class="track-tag is-mood">{m}</span>
											{/each}
										</div>
									{/if}
								</div>
							</li>
						{/each}
					</ol>
				</section>
			{/if}
		{/if}
	</div>
</div>

<style>
	.album-detail {
		position: relative;
		width: 100%;
		min-height: calc(100dvh - var(--pc-header-height, 70px));
		background: var(--bg);
		color: var(--fg);
		overflow: clip;
		box-sizing: border-box;
		container-type: inline-size;
		container-name: album-detail;
	}

	.album-detail.is-mobile {
		min-height: 100%;
	}

	.detail-container {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: var(--content-max-width);
		margin: 0 auto;
		padding: 1.5rem var(--content-padding-x) 4.5rem;
		box-sizing: border-box;
	}

	.album-detail.is-mobile .detail-container {
		padding: 1rem var(--content-padding-x-mobile) 3.5rem;
	}

	.detail-top-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.75rem;
	}

	.detail-back-btn,
	.detail-share-btn {
		height: 34px;
		padding: 0 0.85rem 0 0.65rem;
		border-radius: 999px;
		border: var(--thin-border);
		background: color-mix(in srgb, var(--surface) 75%, transparent);
		color: var(--muted);
		font: inherit;
		font-size: 0.84rem;
		font-weight: var(--fw-medium);
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		cursor: pointer;
		transition:
			color 0.16s ease,
			background-color 0.16s ease;
	}

	.detail-share-btn {
		padding: 0 0.85rem;
	}

	.detail-back-btn:hover,
	.detail-share-btn:hover {
		color: var(--white);
		background: var(--surface-2);
	}

	.detail-state-box {
		min-height: 260px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.detail-error-text {
		margin: 0;
		font-size: 0.94rem;
		color: var(--muted);
	}

	/* ── 히어로 레이아웃 ── */
	.album-hero {
		display: flex;
		align-items: flex-start;
		gap: clamp(2rem, 4cqi, 3.75rem);
	}

	.album-hero-visual {
		position: relative;
		width: clamp(280px, 34cqi, 400px);
		flex-shrink: 0;
		padding-top: 1.4rem;
	}

	.hero-pack {
		position: relative;
		width: 100%;
		aspect-ratio: 1 / 1;
	}

	.hero-media-peek {
		position: absolute;
		inset: 0;
		z-index: 1;
	}

	.hero-cover-frame {
		position: relative;
		z-index: 4;
		width: 100%;
		height: 100%;
		border-radius: 18px;
		overflow: hidden;
		background: var(--surface);
		border: var(--thin-border);
		box-shadow: 0 18px 44px rgba(0, 0, 0, 0.55);
	}

	.hero-cover-img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.hero-cover-fallback {
		width: 100%;
		height: 100%;
		background: linear-gradient(145deg, var(--surface-2), var(--surface-dim));
	}

	.album-hero-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}

	.album-eyebrow {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.6rem;
	}

	.eyebrow-pill {
		padding: 0.16rem 0.58rem;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--white-2);
		font-size: 0.75rem;
		font-weight: var(--fw-semibold);
	}

	.eyebrow-text {
		font-size: 0.82rem;
		color: var(--muted);
	}

	.eyebrow-text.is-date {
		opacity: 0.85;
	}

	.album-hero-title {
		margin: 0;
		font-size: clamp(1.8rem, 3.2cqi, 2.75rem);
		font-weight: var(--fw-extrabold);
		letter-spacing: -0.03em;
		line-height: 1.15;
		color: var(--white);
		word-break: keep-all;
	}

	.artist-link-btn {
		margin-top: 0.55rem;
		padding: 0.2rem 0;
		border: none;
		background: transparent;
		color: var(--muted);
		font: inherit;
		font-size: 1.02rem;
		font-weight: var(--fw-semibold);
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		cursor: pointer;
		transition: color 0.16s ease;
	}

	.artist-link-btn:hover {
		color: var(--white);
	}

	.artist-plain-name {
		margin: 0.55rem 0 0;
		font-size: 1.02rem;
		font-weight: var(--fw-semibold);
		color: var(--muted);
	}

	/* ── 구매 / 옵션 영역 ── */
	.purchase-panel {
		width: 100%;
		margin-top: 1.75rem;
		padding-top: 1.5rem;
		border-top: var(--thin-border);
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.selector-group {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.selector-label {
		font-size: 0.78rem;
		font-weight: var(--fw-semibold);
		color: var(--muted);
		letter-spacing: 0.02em;
	}

	.edition-tabs,
	.option-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.choice-chip {
		height: 38px;
		padding: 0 0.9rem;
		border-radius: 10px;
		border: var(--thin-border);
		background: var(--surface);
		color: var(--fg);
		font: inherit;
		font-size: 0.85rem;
		font-weight: var(--fw-medium);
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		cursor: pointer;
		transition:
			background-color 0.16s ease,
			border-color 0.16s ease,
			color 0.16s ease;
	}

	.choice-chip:hover {
		background: var(--surface-2);
		color: var(--white);
	}

	.choice-chip.is-selected {
		background: var(--white-2);
		border-color: var(--white);
		color: var(--bg);
		font-weight: var(--fw-bold);
	}

	.choice-chip.is-soldout {
		opacity: 0.52;
	}

	.chip-sub {
		font-size: 0.78rem;
		opacity: 0.75;
	}

	.options-loading {
		height: 38px;
		display: flex;
		align-items: center;
	}

	.price-qty-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding-top: 0.25rem;
	}

	.qty-stepper {
		display: inline-flex;
		align-items: center;
		border: var(--thin-border);
		border-radius: 10px;
		background: var(--surface);
		overflow: hidden;
	}

	.qty-btn {
		width: 36px;
		height: 36px;
		border: none;
		background: transparent;
		color: var(--fg);
		font: inherit;
		font-size: 1rem;
		cursor: pointer;
		transition: background-color 0.14s ease;
	}

	.qty-btn:hover:not(:disabled) {
		background: var(--surface-2);
		color: var(--white);
	}

	.qty-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.qty-value {
		min-width: 32px;
		text-align: center;
		font-size: 0.9rem;
		font-weight: var(--fw-semibold);
		color: var(--white);
	}

	.total-price-value {
		font-size: 1.4rem;
		font-weight: var(--fw-extrabold);
		letter-spacing: -0.02em;
		color: var(--white);
	}

	.soldout-price-text {
		font-size: 1.05rem;
		font-weight: var(--fw-bold);
		color: var(--muted);
	}

	.action-buttons {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.65rem;
	}

	.primary-cart-btn {
		flex: 1;
		min-width: 180px;
		height: 46px;
		padding: 0 1.4rem;
		border: none;
		border-radius: 12px;
		background: var(--white-2);
		color: var(--bg);
		font: inherit;
		font-size: 0.94rem;
		font-weight: var(--fw-bold);
		cursor: pointer;
		transition:
			background-color 0.16s ease,
			opacity 0.16s ease;
	}

	.primary-cart-btn:hover:not(:disabled) {
		background: var(--white);
	}

	.primary-cart-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.secondary-collection-btn {
		height: 46px;
		padding: 0 1.15rem;
		border-radius: 12px;
		border: var(--thin-border);
		background: var(--surface);
		color: var(--fg);
		font: inherit;
		font-size: 0.88rem;
		font-weight: var(--fw-semibold);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.42rem;
		cursor: pointer;
		transition:
			background-color 0.16s ease,
			color 0.16s ease,
			border-color 0.16s ease;
	}

	.secondary-collection-btn:hover:not(:disabled) {
		background: var(--surface-2);
		color: var(--white);
	}

	.secondary-collection-btn.is-collected {
		border-color: color-mix(in srgb, var(--white) 42%, transparent);
		color: var(--white);
		background: var(--surface-2);
	}

	/* ── 하단 수록곡 트랙리스트 ── */
	.tracklist-section {
		margin-top: 3.25rem;
		padding-top: 2rem;
		border-top: var(--thin-border);
	}

	.section-head {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		margin-bottom: 1.1rem;
	}

	.section-title {
		margin: 0;
		font-size: 1.15rem;
		font-weight: var(--fw-bold);
		color: var(--white);
	}

	.section-count {
		font-size: 0.84rem;
		color: var(--muted);
	}

	.track-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.track-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.85rem 0.25rem;
		border-bottom: var(--thin-border);
	}

	.track-no {
		width: 24px;
		flex-shrink: 0;
		font-family: var(--font-mono);
		font-size: 0.82rem;
		color: var(--muted);
	}

	.track-main {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.track-title {
		font-size: 0.94rem;
		font-weight: var(--fw-medium);
		color: var(--fg);
	}

	.track-tags {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.track-tag {
		font-size: 0.74rem;
		color: var(--muted);
		padding: 0.12rem 0.45rem;
		border-radius: 999px;
		background: var(--surface);
	}

	/* ── 좁은 화면 / 모바일 세로 스택 ── */
	@container album-detail (max-width: 740px) {
		.album-hero {
			flex-direction: column;
			align-items: stretch;
			gap: 1.5rem;
		}

		.album-hero-visual {
			width: min(100%, 300px);
			margin: 0 auto;
			padding-top: 0.5rem;
		}
	}
</style>
