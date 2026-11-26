<script lang="ts">
	import { formatAlbumPrice } from '#lib/common/catalog/albums';
	import ProductDetailLayout from '../../_shared/design/ProductDetailLayout.svelte';
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
		inCart: boolean;
		collectionSubmitting: boolean;
		isCollected: boolean;
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
		onShareLink
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
</script>

<!-- 앨범 상세 뷰 (공용 ProductDetailLayout + ProductPurchasePanel + 3D 플립 커버 · 보유 음반 · 트랙리스트, 순수 렌더링) -->
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
	onBack={onClose}
	onShare={onShareLink}
	{onGoToArtist}
>
	{#snippet visual()}
		<AlbumDetailHeroVisual
			{coverUrl}
			{albumTitle}
			{editions}
			{selectedEdition}
			{selectedOption}
			{waveActive}
			{mobile}
			bind:extractedWaveColor
		/>
	{/snippet}

	{#snippet eyebrow()}
		{#if albumTypeLabel}
			<span class="eyebrow-pill">{albumTypeLabel}</span>
		{/if}
		{#each genres.slice(0, 3) as genre (genre)}
			<span class="eyebrow-text">{genre}</span>
		{/each}
		{#if formattedDate}
			<span class="eyebrow-text is-date">{formattedDate}</span>
		{/if}
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
	{/snippet}
</ProductDetailLayout>

<style>
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
