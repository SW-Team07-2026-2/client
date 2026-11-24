<script lang="ts">
	import type { CatalogCategoryKey } from '#lib/config/catalogFeed';
	import { ArtistDetailController } from './4-1_artist/logic/artistDetail.svelte';
	import ArtistDetail from './4-1_artist/design/ArtistDetail.svelte';

	interface Props {
		category: CatalogCategoryKey;
		id: number;
		mobile: boolean;
		onClose: () => void;
	}

	let { category, id, mobile, onClose }: Props = $props();

	const artistCtrl = new ArtistDetailController();

	$effect(() => {
		if (category === 'artist') {
			artistCtrl.load(id);
		}
	});

	const CATEGORY_TITLES: Record<CatalogCategoryKey, string> = {
		artist: 'ArtistDetail',
		concert: 'ConcertDetail',
		album: 'AlbumDetail',
		goods: 'MerchDetail'
	};
</script>

<!-- 4_category 상세 컴포넌트 통합 디스패처 -->
{#if category === 'artist'}
	<ArtistDetail
		artist={artistCtrl.artist}
		isLoading={artistCtrl.isLoading}
		errorMessage={artistCtrl.errorMessage}
		following={artistCtrl.following}
		followLoading={artistCtrl.followLoading}
		moreOpen={artistCtrl.moreOpen}
		accentColor={artistCtrl.accentColor}
		{mobile}
		{onClose}
		onToggleFollow={artistCtrl.toggleFollow}
		onShareLink={artistCtrl.shareLink}
		onToggleMore={artistCtrl.toggleMore}
		onAccentColorExtracted={artistCtrl.setAccentColor}
	/>
{:else}
	<div class="category-detail-placeholder">
		<button type="button" class="detail-close-btn" onclick={onClose}>← 목록으로</button>
		<p class="detail-placeholder-label">{CATEGORY_TITLES[category]} #{id}</p>
	</div>
{/if}

<style>
	.category-detail-placeholder {
		max-width: var(--content-max-width);
		margin: 0 auto;
		padding: 1.5rem var(--content-padding-x);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 1rem;
	}

	.detail-close-btn {
		height: 36px;
		padding: 0 0.95rem;
		border-radius: 999px;
		border: var(--thin-border);
		background: var(--surface);
		color: var(--fg);
		font: inherit;
		font-size: 0.85rem;
		font-weight: var(--fw-medium);
		cursor: pointer;
	}

	.detail-placeholder-label {
		margin: 0;
		font-size: 0.95rem;
		color: var(--muted);
	}
</style>
