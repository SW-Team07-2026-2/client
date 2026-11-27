<script lang="ts">
	import { formatAlbumPrice } from '#lib/common/catalog/albums';
	import ProductDetailInfoSection from '../../_shared/design/ProductDetailInfoSection.svelte';
	import ProductDetailLayout, {
		type DetailMetaItem
	} from '../../_shared/design/ProductDetailLayout.svelte';
	import ProductPurchasePanel from '../../_shared/design/ProductPurchasePanel.svelte';
	import type { SpringDropdownOption } from '../../_shared/design/SpringDropdown.svelte';
	import { resolveDetailGlowColor } from '../../_shared/logic/detailTheme';
	import type {
		AlbumPhysicalEdition,
		AlbumTrackItem,
		ProductOptionItem
	} from '../logic/albumDetail.svelte';
	import type { AlbumMediaItem } from '../logic/albumDetailState.svelte';
	import AlbumCollectionButton from '../part/AlbumCollectionButton.svelte';
	import AlbumDetailHeroVisual from '../part/AlbumDetailHeroVisual.svelte';
	import AlbumDetailSkeleton from './AlbumDetailSkeleton.svelte';

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
		albumDescription: string;
		editionDescription: string;
		detailImageUrls: readonly string[];
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
		inCart: boolean;
		collectionSubmitting: boolean;
		isCollected: boolean;
		showFlipHint?: boolean;
		waveActive?: boolean;
		mobile: boolean;
		backLabel?: string;
		onClose: () => void;
		onGoToArtist: () => void;
		onSelectEdition: (editionId: number) => void;
		onSelectOption: (optionId: number) => void;
		onStepQty: (delta: number) => void;
		onAddToCart: () => void;
		onGoToCart: () => void;
		onToggleCollection: () => void;
		onShareLink: () => void;
		onDismissFlipHint?: () => void;
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
		albumDescription,
		editionDescription,
		detailImageUrls,
		accentColor,
		tracks,
		editions,
		selectedEdition,
		options,
		optionsLoading,
		selectedOption,
		qty,
		maxOrderQty,
		totalPrice,
		cartSubmitting,
		inCart,
		collectionSubmitting,
		isCollected,
		showFlipHint = false,
		waveActive = true,
		mobile,
		backLabel = '목록으로',
		onClose,
		onGoToArtist,
		onSelectEdition,
		onSelectOption,
		onStepQty,
		onAddToCart,
		onGoToCart,
		onToggleCollection,
		onShareLink,
		onDismissFlipHint
	}: Props = $props();

	let extractedWaveColor = $state('');

	const EDITION_DOT_COLORS: Record<string, string> = {
		lp: 'var(--white-2)',
		cd: 'var(--toast-info-wave)',
		cassette: 'var(--muted)'
	};

	const editionDropdownOptions = $derived<SpringDropdownOption[]>(
		editions.map((ed) => ({
			value: ed.id,
			label: ed.format,
			subLabel: ed.soldOut
				? '품절'
				: ed.minPrice !== null
					? formatAlbumPrice(ed.minPrice)
					: undefined,
			soldOut: ed.soldOut,
			dotColor: EDITION_DOT_COLORS[ed.kind] ?? 'var(--muted)'
		}))
	);

	const optionDropdownOptions = $derived<SpringDropdownOption[]>(
		options.map((opt) => ({
			value: opt.id,
			label: opt.name,
			subLabel: opt.soldOut ? '품절' : formatAlbumPrice(opt.price),
			soldOut: opt.soldOut
		}))
	);

	const glowColor = $derived(resolveDetailGlowColor(extractedWaveColor, accentColor));

	const formattedDate = $derived(
		releasedAt ? releasedAt.trim().slice(0, 10).replace(/-/g, '.') : ''
	);
	const isCurrentSoldOut = $derived(
		selectedOption ? selectedOption.soldOut : Boolean(selectedEdition?.soldOut)
	);

	const metaItems = $derived.by<DetailMetaItem[]>(() => {
		const list: DetailMetaItem[] = [];
		if (albumTypeLabel) {
			list.push({ label: '앨범 유형', value: albumTypeLabel });
		}
		if (genres.length > 0) {
			list.push({ label: '장르', value: genres.join(' · ') });
		}
		if (formattedDate) {
			list.push({ label: '발매일', value: formattedDate });
		}
		return list;
	});
</script>

<!-- 앨범 상세 뷰 (공용 ProductDetailLayout + 공용 메타 표 + ProductPurchasePanel + 3D 플립 커버 · 보유 음반 · 트랙리스트, 순수 렌더링) -->
<ProductDetailLayout
	{mobile}
	{backLabel}
	shareLabel="앨범 링크 공유"
	{glowColor}
	{isLoading}
	{errorMessage}
	title={albumTitle}
	{artistId}
	{artistName}
	{metaItems}
	onBack={onClose}
	onShare={onShareLink}
	{onGoToArtist}
>
	{#snippet skeleton()}
		<AlbumDetailSkeleton />
	{/snippet}

	{#snippet visual()}
		<AlbumDetailHeroVisual
			{coverUrl}
			{albumTitle}
			{editions}
			{selectedEdition}
			{selectedOption}
			{showFlipHint}
			{waveActive}
			{mobile}
			{onDismissFlipHint}
			bind:extractedWaveColor
		/>
	{/snippet}

	{#snippet purchase()}
		{#if editions.length > 0}
			<ProductPurchasePanel
				primaryLabel="음반 형태"
				primaryOptions={editionDropdownOptions}
				primaryValue={selectedEdition?.id ?? null}
				onSelectPrimary={(val) => onSelectEdition(Number(val))}
				optionLabel="옵션"
				options={optionDropdownOptions}
				optionValue={selectedOption?.id ?? null}
				{optionsLoading}
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
			>
				{#snippet leadingAction()}
					<AlbumCollectionButton
						collected={isCollected}
						loading={collectionSubmitting}
						disabled={!selectedOption}
						onclick={onToggleCollection}
					/>
				{/snippet}
			</ProductPurchasePanel>
		{/if}
	{/snippet}

	{#snippet below()}
		{#if albumDescription}
			<section class="album-intro-section" aria-label="앨범 소개">
				<h2 class="section-title">앨범 소개</h2>
				<p class="album-intro-text">{albumDescription}</p>
			</section>
		{/if}

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
											<span class="track-tag">{m}</span>
										{/each}
									</div>
								{/if}
							</div>
						</li>
					{/each}
				</ol>
			</section>
		{/if}

		<ProductDetailInfoSection
			heading={selectedEdition ? `${selectedEdition.format} 판본 정보` : '판본 정보'}
			description={editionDescription}
			{detailImageUrls}
			itemName={albumTitle}
		/>
	{/snippet}
</ProductDetailLayout>

<style>
	.album-intro-section {
		margin-top: 2.75rem;
		padding-top: 2rem;
		border-top: var(--thin-border);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.album-intro-text {
		margin: 0;
		font-size: 0.94rem;
		line-height: 1.72;
		color: var(--fg);
		word-break: keep-all;
		white-space: pre-line;
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
		letter-spacing: -0.02em;
	}

	.section-count {
		font-size: 0.82rem;
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
		padding: 0.85rem 0.4rem;
		border-bottom: var(--thin-border);
	}

	.track-row:last-child {
		border-bottom: none;
	}

	.track-no {
		width: 24px;
		flex-shrink: 0;
		font-size: 0.82rem;
		font-weight: var(--fw-medium);
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.track-main {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.45rem 1rem;
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
</style>
