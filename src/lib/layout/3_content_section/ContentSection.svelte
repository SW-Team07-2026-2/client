<script lang="ts">
	import { isMobile } from '#lib/common/logic';
	import type { MainSectionDescriptor } from '../2_main_section/logic/sectionRegistry';
	import PcContentSection from './PcContentSection.svelte';
	import MbContentSection from './MbContentSection.svelte';

	interface Props {
		section: MainSectionDescriptor;
		active: boolean;
		detailId?: number | null;
	}

	let { section, active, detailId = null }: Props = $props();
</script>

{#if isMobile.current}
	<MbContentSection {section} {active} {detailId} />
{:else}
	<PcContentSection {section} {active} {detailId} />
{/if}
