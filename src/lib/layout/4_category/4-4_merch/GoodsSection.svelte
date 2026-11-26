<script lang="ts">
	import { isMobile } from '#lib/common/logic';
	import type { MainSectionDescriptor } from '../../2_main_section/logic/sectionRegistry';
	import CatalogFeedView from '../_shared/design/CatalogFeedView.svelte';
	import { GoodsCategoryController } from './logic/goodsCategory.svelte';
	import PcGoodsItem from './design/PcGoodsItem.svelte';
	import MbGoodsItem from './design/MbGoodsItem.svelte';
	import PcGoodsSkeleton from './design/PcGoodsSkeleton.svelte';
	import MbGoodsSkeleton from './design/MbGoodsSkeleton.svelte';

	interface Props {
		section: MainSectionDescriptor;
		active: boolean;
	}

	const PC_SKELETON_INDICES = Array.from({ length: 12 }, (_, i) => i);
	const MB_SKELETON_INDICES = Array.from({ length: 8 }, (_, i) => i);

	let { section, active }: Props = $props();

	const controller = new GoodsCategoryController();
	const mobile = $derived(isMobile.current);

	$effect(() => {
		controller.sync(active);
	});
</script>

<!-- 4-4_merch 목록 섹션: 공용 CatalogFeedView에 굿즈 그리드와 스켈레톤 주입 -->
<CatalogFeedView
	category="goods"
	label={section.label}
	{active}
	feed={controller.feed}
	emptyTitle={controller.emptyTitle}
	emptyDescription={controller.emptyDescription}
>
	{#snippet content({ interactive })}
		<div class="goods-grid" class:is-mobile={mobile} class:is-pc={!mobile}>
			{#each controller.feed.items as goods (goods.id)}
				{#if mobile}
					<MbGoodsItem {goods} {interactive} onSelect={controller.selectGoods} />
				{:else}
					<PcGoodsItem
						{goods}
						{interactive}
						cartLoading={controller.isAddingToCart(goods.id)}
						onSelect={controller.selectGoods}
						onQuickAddToCart={controller.quickAddToCart}
					/>
				{/if}
			{/each}
		</div>
	{/snippet}

	{#snippet skeleton()}
		<div class="goods-grid" class:is-mobile={mobile} class:is-pc={!mobile}>
			{#if mobile}
				{#each MB_SKELETON_INDICES as idx (idx)}
					<MbGoodsSkeleton index={idx} />
				{/each}
			{:else}
				{#each PC_SKELETON_INDICES as idx (idx)}
					<PcGoodsSkeleton index={idx} />
				{/each}
			{/if}
		</div>
	{/snippet}
</CatalogFeedView>

<style>
	.goods-grid {
		display: grid;
		width: 100%;
		align-items: start;
	}

	.goods-grid.is-pc {
		grid-template-columns: repeat(auto-fill, minmax(var(--pc-catalog-card-min-width, 180px), 1fr));
		column-gap: var(--pc-catalog-column-gap, 1.85rem);
		row-gap: 2.35rem;
	}

	.goods-grid.is-mobile {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		column-gap: 0.85rem;
		row-gap: 1.65rem;
	}
</style>
