<script lang="ts">
	import type { MainSectionDescriptor } from '../2_main_section/logic/sectionRegistry';
	import ArtistSection from './4-1_artist/ArtistSection.svelte';
	import ConcertSection from './4-2_concert/ConcertSection.svelte';
	import AlbumSection from './4-3_album/AlbumSection.svelte';
	import GoodsSection from './4-4_merch/GoodsSection.svelte';
	import MyPageSection from './4-5_mypage/MyPageSection.svelte';

	interface Props {
		section: MainSectionDescriptor;
		active: boolean;
	}

	let { section, active }: Props = $props();
</script>

<!-- 4_category 목록/허브 통합 디스패처: 각 카테고리 전용 독립 섹션으로 분기 -->
{#if section.key === 'artist'}
	<ArtistSection {section} {active} />
{:else if section.key === 'concert'}
	<ConcertSection {section} {active} />
{:else if section.key === 'album'}
	<AlbumSection {section} {active} />
{:else if section.key === 'goods'}
	<GoodsSection {section} {active} />
{:else}
	<MyPageSection {section} {active} />
{/if}
