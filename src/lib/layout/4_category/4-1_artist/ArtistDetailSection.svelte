<script lang="ts">
	import { detailOverlay } from '#lib/common/logic';
	import { ArtistDetailController } from './logic/artistDetail.svelte';
	import ArtistDetail from './design/ArtistDetail.svelte';

	interface Props {
		id: number | null;
		mobile: boolean;
		backLabel?: string;
		onClose: () => void;
	}

	let { id, mobile, backLabel = '목록으로', onClose }: Props = $props();

	const controller = new ArtistDetailController();
	const waveActive = $derived(detailOverlay.getSlot('artist').phase === 'open');

	$effect(() => {
		if (id !== null && id > 0) {
			controller.load(id);
		}
	});
</script>

<!-- 4-1_artist 상세 진입점(Shell): ArtistDetailController와 ArtistDetail 뷰 조립 -->
<ArtistDetail
	artist={controller.artist}
	isLoading={controller.isLoading}
	errorMessage={controller.errorMessage}
	following={controller.following}
	followLoading={controller.followLoading}
	accentColor={controller.accentColor}
	{waveActive}
	{mobile}
	{backLabel}
	{onClose}
	onToggleFollow={controller.toggleFollow}
	onShareLink={controller.shareLink}
	onAccentColorExtracted={controller.setAccentColor}
/>
