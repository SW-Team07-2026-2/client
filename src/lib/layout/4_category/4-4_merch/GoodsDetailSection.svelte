<script lang="ts">
	import { GoodsDetailController } from './logic/goodsDetail.svelte';
	import GoodsDetail from './design/GoodsDetail.svelte';

	interface Props {
		id: number;
		mobile: boolean;
		backLabel?: string;
		onClose: () => void;
	}

	let { id, mobile, backLabel = '목록으로', onClose }: Props = $props();

	const controller = new GoodsDetailController();

	$effect(() => {
		controller.load(id);
	});
</script>

<!-- 4-4_merch 상세 진입점(Shell): GoodsDetailController와 GoodsDetail 뷰 조립 -->
<GoodsDetail
	isLoading={controller.isLoading}
	errorMessage={controller.errorMessage}
	name={controller.name}
	categoryLabel={controller.categoryLabel}
	artistId={controller.artistId}
	artistName={controller.artistName}
	imageUrl={controller.imageUrl}
	purchaseUrl={controller.purchaseUrl}
	accentColor={controller.accentColor}
	options={controller.options}
	selectedOption={controller.selectedOption}
	isAllSoldOut={controller.isAllSoldOut}
	qty={controller.qty}
	maxOrderQty={controller.maxOrderQty}
	totalPrice={controller.totalPrice}
	cartSubmitting={controller.cartSubmitting}
	{mobile}
	{backLabel}
	{onClose}
	onGoToArtist={controller.goToArtist}
	onSelectOption={controller.selectOption}
	onStepQty={controller.stepQty}
	onAddToCart={controller.addToCart}
	onShareLink={controller.shareLink}
/>
