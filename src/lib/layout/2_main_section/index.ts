export { default as MainSection } from './MainSection.svelte';
export { MainSectionController } from './logic/mainSection.svelte';
export * from './logic/keepAliveSlide';
export * from './logic/mobileSwipe';
export {
	getMainSectionContext,
	setMainSectionContext,
	type MainSectionContextValue
} from './logic/context';
export {
	MAIN_SECTIONS,
	MAIN_SECTION_KEYS,
	getMainSection,
	parseMainSectionDetailId,
	resolveMainSectionIndex,
	resolveMainSectionKey,
	type MainSectionDescriptor,
	type MainSectionKey
} from './logic/sectionRegistry';
