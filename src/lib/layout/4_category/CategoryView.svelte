<script lang="ts">
	import type { MainSectionDescriptor } from '../2_main_section/logic/sectionRegistry';
	import ArtistSection from './4-1_artist/ArtistSection.svelte';
	import ConcertCategory from './4-2_concert/ConcertCategory.svelte';
	import AlbumCategory from './4-3_album/AlbumCategory.svelte';
	import GoodsCategory from './4-4_merch/GoodsCategory.svelte';
	import MyPageCategory from './4-5_mypage/MyPageCategory.svelte';

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
	<ConcertCategory {section} {active} />
{:else if section.key === 'album'}
	<AlbumCategory {section} {active} />
{:else if section.key === 'goods'}
	<GoodsCategory {section} {active} />
{:else}
	<MyPageCategory {section} {active} />
{/if}
