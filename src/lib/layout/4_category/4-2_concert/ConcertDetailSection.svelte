<script lang="ts">
	import { ConcertDetailController } from './logic/concertDetail.svelte';
	import ConcertDetail from './design/ConcertDetail.svelte';

	interface Props {
		id: number;
		mobile: boolean;
		backLabel?: string;
		onClose: () => void;
	}

	let { id, mobile, backLabel = '목록으로', onClose }: Props = $props();

	const controller = new ConcertDetailController();

	$effect(() => {
		controller.load(id);
	});
</script>

<!-- 4-2_concert 상세 진입점(Shell): ConcertDetailController와 ConcertDetail 뷰 조립 -->
<ConcertDetail
	isLoading={controller.isLoading}
	errorMessage={controller.errorMessage}
	title={controller.title}
	typeLabel={controller.typeLabel}
	genreLabel={controller.genreLabel}
	saleStatusLabel={controller.saleStatusLabel}
	isOnSale={controller.isOnSale}
	isClosed={controller.isClosed}
	startsAtText={controller.startsAtText}
	endsAtText={controller.endsAtText}
	bookingOpenAtText={controller.bookingOpenAtText}
	price={controller.price}
	queueEnabled={controller.queueEnabled}
	maxSeatsPerUser={controller.maxSeatsPerUser}
	ctaLabel={controller.ctaLabel}
	artists={controller.artists}
	venue={controller.venue}
	description={controller.description}
	requirements={controller.requirements}
	terms={controller.terms}
	posterUrl={controller.posterUrl}
	imageUrls={controller.imageUrls}
	accentColor={controller.accentColor}
	{mobile}
	{backLabel}
	{onClose}
	onGoToArtist={controller.goToArtist}
	onStartBooking={controller.startBooking}
	onShareLink={controller.shareLink}
/>
