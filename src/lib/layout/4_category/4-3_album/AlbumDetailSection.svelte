<script lang="ts">
	import { AlbumDetailController } from './logic/albumDetail.svelte';
	import AlbumDetail from './design/AlbumDetail.svelte';

	interface Props {
		id: number;
		mobile: boolean;
		backLabel?: string;
		onClose: () => void;
	}

	let { id, mobile, backLabel = '목록으로', onClose }: Props = $props();

	const controller = new AlbumDetailController();

	$effect(() => {
		controller.load(id);
	});
</script>

<!-- 4-3_album 상세 진입점(Shell): AlbumDetailController와 AlbumDetail 뷰 조립 -->
<AlbumDetail
	isLoading={controller.isLoading}
	errorMessage={controller.errorMessage}
	albumTitle={controller.albumTitle}
	albumTypeLabel={controller.albumTypeLabel}
	artistId={controller.artistId}
	artistName={controller.artistName}
	genres={controller.genres}
	releasedAt={controller.releasedAt}
	coverUrl={controller.coverUrl}
	accentColor={controller.accentColor}
	tracks={controller.tracks}
	editions={controller.editions}
	selectedEdition={controller.selectedEdition}
	activeMediaItems={controller.activeMediaItems}
	options={controller.currentOptions}
	optionsLoading={controller.optionsLoading}
	selectedOption={controller.selectedOption}
	qty={controller.qty}
	maxOrderQty={controller.maxOrderQty}
	totalPrice={controller.totalPrice}
	cartSubmitting={controller.cartSubmitting}
	collectionSubmitting={controller.collectionSubmitting}
	isCollected={controller.isCurrentOptionCollected}
	{mobile}
	{backLabel}
	{onClose}
	onGoToArtist={controller.goToArtist}
	onSelectEdition={controller.selectEdition}
	onSelectOption={controller.selectOption}
	onStepQty={controller.stepQty}
	onAddToCart={controller.addToCart}
	onToggleCollection={controller.toggleCollection}
	onShareLink={controller.shareLink}
/>
