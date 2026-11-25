<script lang="ts">
	import { formatGoodsPrice } from '#lib/common/catalog/goods';
	import { LoadingSpinner } from '#lib/dedicated/loading';
	import DetailAmbientGlow from '../../_shared/design/DetailAmbientGlow.svelte';
	import type { GoodsOptionItem } from '../logic/goodsDetail.svelte';

	interface Props {
		isLoading: boolean;
		errorMessage: string | null;
		name: string;
		categoryLabel: string;
		artistId: number | null;
		artistName: string;
		imageUrl: string;
		purchaseUrl: string | null;
		accentColor: string;
		options: GoodsOptionItem[];
		selectedOption: GoodsOptionItem | null;
		isAllSoldOut: boolean;
		qty: number;
		maxOrderQty: number;
		totalPrice: number | null;
		cartSubmitting: boolean;
		mobile: boolean;
		backLabel?: string;
		onClose: () => void;
		onGoToArtist: () => void;
		onSelectOption: (optionId: number) => void;
		onStepQty: (delta: number) => void;
		onAddToCart: () => void;
		onShareLink: () => void;
	}

	let {
		isLoading,
		errorMessage,
		name,
		categoryLabel,
		artistId,
		artistName,
		imageUrl,
		purchaseUrl,
		accentColor,
		options,
		selectedOption,
		isAllSoldOut,
		qty,
		maxOrderQty,
		totalPrice,
		cartSubmitting,
		mobile,
		backLabel = '목록으로',
		onClose,
		onGoToArtist,
		onSelectOption,
		onStepQty,
		onAddToCart,
		onShareLink
	}: Props = $props();

	const formattedTotalPrice = $derived(formatGoodsPrice(totalPrice));
	const isCurrentSoldOut = $derived(selectedOption ? selectedOption.soldOut : isAllSoldOut);

	function formatOptionLabel(opt: GoodsOptionItem): string {
		if (opt.size && opt.name && opt.size !== opt.name) {
			return `${opt.name} (${opt.size})`;
		}
		return opt.size || opt.name || '기본';
	}
</script>

<!-- 굿즈 상세 뷰 (공용 앰비언트 글로우 · 4:5 스튜디오 이미지 · 사이즈/옵션 · 수량 · 장바구니 담기, 순수 렌더링) -->
<div class="goods-detail" class:is-mobile={mobile}>
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
				aria-label="굿즈 링크 공유"
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

		{#if isLoading && !name}
			<div class="detail-state-box" role="status" aria-live="polite">
				<LoadingSpinner size={24} />
			</div>
		{:else if errorMessage && !name}
			<div class="detail-state-box" role="alert">
				<p class="detail-error-text">{errorMessage}</p>
			</div>
		{:else}
			<header class="goods-hero">
				<!-- 좌측 4:5 상품 이미지 -->
				<div class="goods-hero-media">
					<div class="hero-image-frame" class:is-sold-out={isAllSoldOut}>
						{#if imageUrl}
							<img class="hero-image" src={imageUrl} alt={name} decoding="async" />
						{:else}
							<div class="hero-image-fallback" aria-hidden="true"></div>
						{/if}

						{#if isAllSoldOut}
							<div class="hero-soldout-overlay">
								<span class="hero-soldout-badge">품절</span>
							</div>
						{/if}
					</div>
				</div>

				<!-- 우측 상품 정보 · 옵션 · 구매 액션 -->
				<div class="goods-hero-info">
					{#if categoryLabel}
						<div class="goods-eyebrow">
							<span class="eyebrow-pill">{categoryLabel}</span>
						</div>
					{/if}

					<h1 class="goods-hero-title">{name}</h1>

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

					<div class="purchase-panel">
						{#if options.length > 0}
							<div class="selector-group">
								<span class="selector-label">옵션 / 사이즈</span>
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
											<span>{formatOptionLabel(opt)}</span>
											{#if opt.soldOut}
												<span class="chip-sub">품절</span>
											{:else}
												<span class="chip-sub">{formatGoodsPrice(opt.price)}</span>
											{/if}
										</button>
									{/each}
								</div>
							</div>
						{/if}

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

							{#if purchaseUrl}
								<a
									class="secondary-link-btn"
									href={purchaseUrl}
									target="_blank"
									rel="noopener noreferrer"
								>
									<span>공식 스토어</span>
									<svg
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										aria-hidden="true"
									>
										<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
										<polyline points="15 3 21 3 21 9" />
										<line x1="10" y1="14" x2="21" y2="3" />
									</svg>
								</a>
							{/if}
						</div>
					</div>
				</div>
			</header>
		{/if}
	</div>
</div>

<style>
	.goods-detail {
		position: relative;
		width: 100%;
		min-height: calc(100dvh - var(--pc-header-height, 70px));
		background: var(--bg);
		color: var(--fg);
		overflow: clip;
		box-sizing: border-box;
		container-type: inline-size;
		container-name: goods-detail;
	}

	.goods-detail.is-mobile {
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

	.goods-detail.is-mobile .detail-container {
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

	.goods-hero {
		display: flex;
		align-items: flex-start;
		gap: clamp(2rem, 4cqi, 3.75rem);
	}

	.goods-hero-media {
		width: clamp(270px, 33cqi, 390px);
		flex-shrink: 0;
	}

	.hero-image-frame {
		position: relative;
		width: 100%;
		aspect-ratio: 4 / 5;
		border-radius: 18px;
		overflow: hidden;
		background: var(--surface);
		border: var(--thin-border);
		box-shadow: 0 18px 44px rgba(0, 0, 0, 0.52);
	}

	.hero-image {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.hero-image-frame.is-sold-out .hero-image {
		opacity: 0.56;
	}

	.hero-image-fallback {
		width: 100%;
		height: 100%;
		background: linear-gradient(155deg, var(--surface-2), var(--surface-dim));
	}

	.hero-soldout-overlay {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		pointer-events: none;
	}

	.hero-soldout-badge {
		padding: 0.4rem 1.05rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--bg) 78%, transparent);
		border: 1px solid color-mix(in srgb, var(--white) 24%, transparent);
		color: var(--white);
		font-size: 0.88rem;
		font-weight: var(--fw-bold);
		letter-spacing: 0.04em;
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
	}

	.goods-hero-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}

	.goods-eyebrow {
		margin-bottom: 0.65rem;
	}

	.eyebrow-pill {
		display: inline-block;
		padding: 0.16rem 0.6rem;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--white-2);
		font-size: 0.76rem;
		font-weight: var(--fw-semibold);
	}

	.goods-hero-title {
		margin: 0;
		font-size: clamp(1.7rem, 3cqi, 2.55rem);
		font-weight: var(--fw-extrabold);
		letter-spacing: -0.03em;
		line-height: 1.18;
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
		font-size: 1rem;
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
		font-size: 1rem;
		font-weight: var(--fw-semibold);
		color: var(--muted);
	}

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
		text-decoration: line-through;
	}

	.chip-sub {
		font-size: 0.78rem;
		opacity: 0.75;
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

	.secondary-link-btn {
		height: 46px;
		padding: 0 1.15rem;
		border-radius: 12px;
		border: var(--thin-border);
		background: var(--surface);
		color: var(--fg);
		text-decoration: none;
		font-size: 0.88rem;
		font-weight: var(--fw-semibold);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		transition:
			background-color 0.16s ease,
			color 0.16s ease;
	}

	.secondary-link-btn:hover {
		background: var(--surface-2);
		color: var(--white);
	}

	@container goods-detail (max-width: 740px) {
		.goods-hero {
			flex-direction: column;
			align-items: stretch;
			gap: 1.5rem;
		}

		.goods-hero-media {
			width: min(100%, 300px);
			margin: 0 auto;
		}
	}
</style>
