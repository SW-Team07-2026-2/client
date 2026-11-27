<script lang="ts">
	import { formatGoodsPrice } from '#lib/common/catalog/goods';
	import FdImage from '#lib/common/design/fluid/FdImage.svelte';
	import ProductDetailInfoSection from '../../_shared/design/ProductDetailInfoSection.svelte';
	import ProductDetailLayout, {
		type DetailMetaItem
	} from '../../_shared/design/ProductDetailLayout.svelte';
	import ProductPurchasePanel from '../../_shared/design/ProductPurchasePanel.svelte';
	import type { SpringDropdownOption } from '../../_shared/design/SpringDropdown.svelte';
	import {
		createWaveRectSetting,
		resolveDetailGlowColor
	} from '../../_shared/logic/detailTheme';
	import type { GoodsOptionItem } from '../logic/goodsDetail.svelte';

	interface Props {
		isLoading: boolean;
		errorMessage: string | null;
		name: string;
		categoryLabel: string;
		artistId: number | null;
		artistName: string;
		imageUrl: string;
		description: string;
		detailImageUrls: readonly string[];
		accentColor: string;
		options: GoodsOptionItem[];
		selectedOption: GoodsOptionItem | null;
		isAllSoldOut: boolean;
		qty: number;
		maxOrderQty: number;
		totalPrice: number | null;
		cartSubmitting: boolean;
		inCart: boolean;
		waveActive?: boolean;
		mobile: boolean;
		backLabel?: string;
		onClose: () => void;
		onGoToArtist: () => void;
		onSelectOption: (optionId: number) => void;
		onStepQty: (delta: number) => void;
		onAddToCart: () => void;
		onGoToCart: () => void;
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
		description,
		detailImageUrls,
		accentColor,
		options,
		selectedOption,
		isAllSoldOut,
		qty,
		maxOrderQty,
		totalPrice,
		cartSubmitting,
		inCart,
		waveActive = true,
		mobile,
		backLabel = '목록으로',
		onClose,
		onGoToArtist,
		onSelectOption,
		onStepQty,
		onAddToCart,
		onGoToCart,
		onShareLink
	}: Props = $props();

	const HERO_RADIUS = 24;
	/** 4:5 직사각형 기준 한 변당 유지할 물결 개수 */
	const HERO_WAVES_PER_EDGE = 2.5;

	let extractedWaveColor = $state('');
	let heroMediaWidth = $state(340);

	const glowColor = $derived(resolveDetailGlowColor(extractedWaveColor, accentColor));

	const heroImageSetting = $derived(
		createWaveRectSetting(heroMediaWidth, 1.25, HERO_RADIUS, HERO_WAVES_PER_EDGE)
	);

	const isCurrentSoldOut = $derived(selectedOption ? selectedOption.soldOut : isAllSoldOut);

	function formatOptionLabel(opt: GoodsOptionItem): string {
		if (opt.size && opt.name && opt.size !== opt.name) {
			return `${opt.name} (${opt.size})`;
		}
		return opt.size || opt.name || '기본';
	}

	const optionDropdownOptions = $derived<SpringDropdownOption[]>(
		options.map((opt) => ({
			value: opt.id,
			label: formatOptionLabel(opt),
			subLabel: opt.soldOut ? '품절' : formatGoodsPrice(opt.price),
			soldOut: opt.soldOut
		}))
	);

	const metaItems = $derived.by<DetailMetaItem[]>(() => {
		const list: DetailMetaItem[] = [];
		if (categoryLabel) {
			list.push({ label: '카테고리', value: categoryLabel });
		}
		list.push({
			label: '판매 상태',
			value: isAllSoldOut ? '품절' : '판매중',
			tone: isAllSoldOut ? 'muted' : 'accent'
		});
		return list;
	});
</script>

<!-- 굿즈 상세 뷰 (공용 ProductDetailLayout + 공용 메타 표 + ProductPurchasePanel + 4:5 FdImage 히어로, 순수 렌더링) -->
<ProductDetailLayout
	{mobile}
	{backLabel}
	shareLabel="굿즈 링크 공유"
	{glowColor}
	{isLoading}
	{errorMessage}
	title={name}
	{artistId}
	{artistName}
	{metaItems}
	onBack={onClose}
	onShare={onShareLink}
	{onGoToArtist}
>
	{#snippet visual()}
		<div class="goods-hero-media" class:is-soldout={isAllSoldOut} bind:clientWidth={heroMediaWidth}>
			{#if imageUrl}
				<FdImage
					class="goods-hero-image"
					src={imageUrl}
					alt={name}
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
				<div class="goods-hero-fallback" aria-hidden="true"></div>
			{/if}

			{#if isAllSoldOut}
				<div class="goods-soldout-overlay">
					<span class="goods-soldout-badge">품절</span>
				</div>
			{/if}
		</div>
	{/snippet}

	{#snippet purchase()}
		<ProductPurchasePanel
			optionLabel="옵션"
			options={optionDropdownOptions}
			optionValue={selectedOption?.id ?? null}
			onSelectOption={(val) => onSelectOption(Number(val))}
			{qty}
			maxQty={maxOrderQty}
			{onStepQty}
			{totalPrice}
			soldOut={isCurrentSoldOut}
			{cartSubmitting}
			canSubmitCart={Boolean(selectedOption)}
			{inCart}
			{onAddToCart}
			{onGoToCart}
		/>
	{/snippet}

	{#snippet below()}
		<ProductDetailInfoSection
			heading="상세 정보"
			{description}
			{detailImageUrls}
			itemName={name}
		/>
	{/snippet}
</ProductDetailLayout>

<style>
	.goods-hero-media {
		position: relative;
		width: 100%;
		aspect-ratio: 4 / 5;
	}

	.goods-hero-media :global(.fd-image-wrap.goods-hero-image) {
		width: 100%;
		height: 100%;
	}

	.goods-hero-media.is-soldout :global(.fd-image-wrap.goods-hero-image) {
		opacity: 0.62;
	}

	.goods-hero-fallback {
		width: 100%;
		height: 100%;
		border-radius: 24px;
		background: linear-gradient(155deg, var(--surface-2), var(--surface-dim));
	}

	.goods-soldout-overlay {
		position: absolute;
		inset: 0;
		z-index: 3;
		display: grid;
		place-items: center;
		pointer-events: none;
	}

	.goods-soldout-badge {
		padding: 0.42rem 1.15rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--bg) 78%, transparent);
		border: 1px solid color-mix(in srgb, var(--white) 24%, transparent);
		color: var(--white);
		font-size: 0.9rem;
		font-weight: var(--fw-bold);
		letter-spacing: 0.04em;
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
	}
</style>
