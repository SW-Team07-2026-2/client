<script lang="ts">
	import { isMobile } from '#lib/common/logic';
	import type { MainSectionDescriptor } from '../../2_main_section/logic/sectionRegistry';
	import CatalogFeedStatus from '../_shared/design/CatalogFeedStatus.svelte';
	import { ArtistCategoryController } from './logic/artistCategory.svelte';
	import PcArtistItem from './design/PcArtistItem.svelte';
	import MbArtistItem from './design/MbArtistItem.svelte';

	interface Props {
		section: MainSectionDescriptor;
		active: boolean;
	}

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

<!-- 4-1_artist 목록 섹션: 로직 컨트롤러와 PC/모바일 아티스트 그리드 조립 -->
<section
	class="artist-section"
	data-category="artist"
	data-active={active ? 'true' : 'false'}
	aria-label={section.label}
>
	{#if !controller.feed.isLoading && !controller.feed.errorMessage && controller.feed.items.length > 0}
		<div class="artist-grid" class:is-mobile={mobile} class:is-pc={!mobile}>
			{#each controller.feed.items as artist (artist.id)}
				{#if mobile}
					<MbArtistItem
						{artist}
						following={controller.isFollowing(artist.id)}
						followLoading={controller.isFollowPending(artist.id)}
						interactive={active}
						onFollowToggle={controller.toggleFollow}
						onSelect={controller.selectArtist}
					/>
				{:else}
					<PcArtistItem
						{artist}
						following={controller.isFollowing(artist.id)}
						followLoading={controller.isFollowPending(artist.id)}
						interactive={active}
						onFollowToggle={controller.toggleFollow}
						onSelect={controller.selectArtist}
					/>
				{/if}
			{/each}
		</div>
	{/if}

	<CatalogFeedStatus
		isLoading={controller.feed.isLoading}
		isLoadingMore={controller.feed.isLoadingMore}
		isEmpty={controller.feed.isEmpty}
		hasNext={controller.feed.hasNext}
		errorMessage={controller.feed.errorMessage}
		emptyTitle={controller.emptyTitle}
		emptyDescription={controller.emptyDescription}
		onRetry={controller.feed.retry}
		onLoadMore={controller.feed.loadMore}
	/>
</section>

<style>
	.artist-section {
		width: 100%;
	}

	.artist-grid {
		display: grid;
		width: 100%;
		align-items: start;
	}

	.artist-grid.is-pc {
		grid-template-columns: repeat(auto-fill, minmax(176px, 1fr));
		column-gap: 1.8125rem;
		row-gap: 2.6875rem;
	}

	.artist-grid.is-mobile {
		grid-template-columns: repeat(auto-fill, minmax(136px, 1fr));
		column-gap: 1.375rem;
		row-gap: 2.25rem;
	}
</style>
