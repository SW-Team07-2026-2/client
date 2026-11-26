<script lang="ts">
	import { resolveArtistImageUrl } from '#lib/common/catalog/artists';
	import { isMobile } from '#lib/common/logic';
	import type { MainSectionDescriptor } from '../../2_main_section/logic/sectionRegistry';
	import CatalogFeedView from '../_shared/design/CatalogFeedView.svelte';
	import { prefetchDetailApi, prefetchDetailImage } from '../_shared/logic/detailPrefetch';
	import { ArtistCategoryController } from './logic/artistCategory.svelte';
	import PcArtistItem from './design/PcArtistItem.svelte';
	import MbArtistItem from './design/MbArtistItem.svelte';
	import PcArtistSkeleton from './design/PcArtistSkeleton.svelte';
	import MbArtistSkeleton from './design/MbArtistSkeleton.svelte';

	interface Props {
		section: MainSectionDescriptor;
		active: boolean;
	}

	const PC_SKELETON_INDICES = Array.from({ length: 15 }, (_, i) => i);
	const MB_SKELETON_INDICES = Array.from({ length: 8 }, (_, i) => i);

	let { section, active }: Props = $props();

	const controller = new ArtistCategoryController();
	const mobile = $derived(isMobile.current);

	$effect(() => {
		controller.sync(active);
	});

	$effect(() => {
		controller.syncFollowsForAuth();
	});
</script>

<!-- 4-1_artist 목록 섹션: 공용 CatalogFeedView에 아티스트 그리드와 스켈레톤만 주입 -->
<CatalogFeedView
	category="artist"
	label={section.label}
	{active}
	feed={controller.feed}
	emptyTitle={controller.emptyTitle}
	emptyDescription={controller.emptyDescription}
>
	{#snippet content({ interactive })}
		<div class="artist-grid" class:is-mobile={mobile} class:is-pc={!mobile}>
			{#each controller.feed.items as artist (artist.id)}
				<div
					class="feed-card-slot"
					role="presentation"
					onpointerenter={(e) => {
						if (e.pointerType !== 'mouse') return;
						prefetchDetailApi(`/api/catalog/artists/${artist.id}`);
						prefetchDetailImage(resolveArtistImageUrl(artist));
					}}
					ontouchstart={() => {
						prefetchDetailApi(`/api/catalog/artists/${artist.id}`);
						prefetchDetailImage(resolveArtistImageUrl(artist));
					}}
				>
					{#if mobile}
						<MbArtistItem
							{artist}
							following={controller.isFollowing(artist.id)}
							followLoading={controller.isFollowPending(artist.id)}
							{interactive}
							onFollowToggle={controller.toggleFollow}
							onSelect={controller.selectArtist}
						/>
					{:else}
						<PcArtistItem
							{artist}
							following={controller.isFollowing(artist.id)}
							followLoading={controller.isFollowPending(artist.id)}
							{interactive}
							onFollowToggle={controller.toggleFollow}
							onSelect={controller.selectArtist}
						/>
					{/if}
				</div>
			{/each}
		</div>
	{/snippet}

	{#snippet skeleton()}
		<div class="artist-grid" class:is-mobile={mobile} class:is-pc={!mobile}>
			{#if mobile}
				{#each MB_SKELETON_INDICES as idx (idx)}
					<MbArtistSkeleton index={idx} />
				{/each}
			{:else}
				{#each PC_SKELETON_INDICES as idx (idx)}
					<PcArtistSkeleton index={idx} />
				{/each}
			{/if}
		</div>
	{/snippet}
</CatalogFeedView>

<style>
	.artist-grid {
		display: grid;
		width: 100%;
		align-items: start;
	}

	.artist-grid.is-pc {
		grid-template-columns: repeat(auto-fill, minmax(var(--pc-catalog-card-min-width, 180px), 1fr));
		column-gap: var(--pc-catalog-column-gap, 1.85rem);
		row-gap: 2.6875rem;
	}

	.artist-grid.is-mobile {
		grid-template-columns: repeat(auto-fill, minmax(136px, 1fr));
		column-gap: 1.375rem;
		row-gap: 2.25rem;
	}

	.feed-card-slot {
		min-width: 0;
	}
</style>
