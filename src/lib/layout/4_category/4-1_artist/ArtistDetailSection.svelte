<script lang="ts">
	import { ArtistDetailController } from './logic/artistDetail.svelte';
	import ArtistDetail from './design/ArtistDetail.svelte';

	interface Props {
		id: number;
		mobile: boolean;
		backLabel?: string;
		onClose: () => void;
	}

	let { id, mobile, backLabel = '목록으로', onClose }: Props = $props();

	const controller = new ArtistDetailController();

	$effect(() => {
		controller.load(id);
	});
</script>

<!-- 4-1_artist 상세 진입점(Shell): ArtistDetailController와 ArtistDetail 뷰 조립 -->
<ArtistDetail
	artist={controller.artist}
	isLoading={controller.isLoading}
	errorMessage={controller.errorMessage}
	following={controller.following}
	followLoading={controller.followLoading}
	moreOpen={controller.moreOpen}
	accentColor={controller.accentColor}
	{mobile}
	{backLabel}
	{onClose}
	onToggleFollow={controller.toggleFollow}
	onShareLink={controller.shareLink}
	onToggleMore={controller.toggleMore}
	onAccentColorExtracted={controller.setAccentColor}
/>
