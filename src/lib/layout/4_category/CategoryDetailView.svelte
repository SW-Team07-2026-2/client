<script lang="ts">
	import type { CatalogCategoryKey } from '#lib/common/catalog/catalogFeed';
	import DetailTopNav from '#lib/common/design/DetailTopNav.svelte';
	import ArtistDetailSection from './4-1_artist/ArtistDetailSection.svelte';
	import ConcertDetailSection from './4-2_concert/ConcertDetailSection.svelte';
	import AlbumDetailSection from './4-3_album/AlbumDetailSection.svelte';
	import GoodsDetailSection from './4-4_merch/GoodsDetailSection.svelte';

	interface Props {
		category: CatalogCategoryKey;
		id: number | null;
		mobile: boolean;
		backLabel?: string;
		onClose: () => void;
	}

	let { category, id, mobile, backLabel = '목록으로', onClose }: Props = $props();

	const CATEGORY_TITLES: Record<CatalogCategoryKey, string> = {
		artist: 'ArtistDetail',
		concert: 'ConcertDetail',
		album: 'AlbumDetail',
		goods: 'MerchDetail'
	};
</script>

<!-- 4_category 상세 통합 디스패처: 각 카테고리 전용 독립 상세 섹션(Shell)으로 분기 -->
{#if category === 'artist'}
	<ArtistDetailSection {id} {mobile} {backLabel} {onClose} />
{:else if category === 'concert'}
	<ConcertDetailSection {id} {mobile} {backLabel} {onClose} />
{:else if category === 'album'}
	<AlbumDetailSection {id} {mobile} {backLabel} {onClose} />
{:else if category === 'goods'}
	<GoodsDetailSection {id} {mobile} {backLabel} {onClose} />
{:else}
	<div class="category-detail-placeholder">
		<DetailTopNav {mobile} {backLabel} onBack={onClose} />
		<p class="detail-placeholder-label">{CATEGORY_TITLES[category]} #{id}</p>
	</div>
{/if}

<style>
	.category-detail-placeholder {
		max-width: var(--content-max-width);
		margin: 0 auto;
		padding: calc(var(--mb-detail-top-offset, 0px) + 1.5rem) var(--content-padding-x) 1.5rem;
		box-sizing: border-box;
	}

	.detail-placeholder-label {
		margin: 0;
		font-size: 0.95rem;
		color: var(--muted);
	}
</style>
