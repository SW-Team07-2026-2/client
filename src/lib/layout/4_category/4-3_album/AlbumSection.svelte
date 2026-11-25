<script lang="ts">
	import { isMobile } from '#lib/common/logic';
	import type { MainSectionDescriptor } from '../../2_main_section/logic/sectionRegistry';
	import CatalogFeedView from '../_shared/design/CatalogFeedView.svelte';
	import { AlbumCategoryController } from './logic/albumCategory.svelte';
	import PcAlbumItem from './design/PcAlbumItem.svelte';
	import MbAlbumItem from './design/MbAlbumItem.svelte';
	import PcAlbumSkeleton from './design/PcAlbumSkeleton.svelte';
	import MbAlbumSkeleton from './design/MbAlbumSkeleton.svelte';

	interface Props {
		section: MainSectionDescriptor;
		active: boolean;
	}

	const PC_SKELETON_INDICES = Array.from({ length: 12 }, (_, i) => i);
	const MB_SKELETON_INDICES = Array.from({ length: 8 }, (_, i) => i);

	let { section, active }: Props = $props();

	const controller = new AlbumCategoryController();
	const mobile = $derived(isMobile.current);

	$effect(() => {
		controller.sync(active);
	});
</script>

<!-- 4-3_album 목록 섹션: 공용 CatalogFeedView에 앨범 그리드와 스켈레톤 주입 -->
<CatalogFeedView
	category="album"
	label={section.label}
	{active}
	feed={controller.feed}
	emptyTitle={controller.emptyTitle}
	emptyDescription={controller.emptyDescription}
>
	{#snippet content({ interactive })}
		<div class="album-grid" class:is-mobile={mobile} class:is-pc={!mobile}>
			{#each controller.groupedAlbums as group (group.key)}
				{#if mobile}
					<MbAlbumItem {group} {interactive} onSelect={controller.selectAlbum} />
				{:else}
					<PcAlbumItem {group} {interactive} onSelect={controller.selectAlbum} />
				{/if}
			{/each}
		</div>
	{/snippet}

	{#snippet skeleton()}
		<div class="album-grid" class:is-mobile={mobile} class:is-pc={!mobile}>
			{#if mobile}
				{#each MB_SKELETON_INDICES as idx (idx)}
					<MbAlbumSkeleton index={idx} />
				{/each}
			{:else}
				{#each PC_SKELETON_INDICES as idx (idx)}
					<PcAlbumSkeleton index={idx} />
				{/each}
			{/if}
		</div>
	{/snippet}
</CatalogFeedView>

<style>
	.album-grid {
		display: grid;
		width: 100%;
		align-items: start;
	}

	.album-grid.is-pc {
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		column-gap: 2rem;
		row-gap: 3.25rem;
		padding-top: 2.25rem;
	}

	.album-grid.is-mobile {
		grid-template-columns: 1fr;
		column-gap: 0;
		row-gap: 0.15rem;
		padding-top: 0.15rem;
	}
</style>
