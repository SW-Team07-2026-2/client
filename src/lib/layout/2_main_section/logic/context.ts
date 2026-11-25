import { getContext, setContext } from 'svelte';
import type { MainSectionKey } from './sectionRegistry';

export interface MainSectionContextValue {
	/** 현재 카테고리 좌우 슬라이드 또는 모바일 스와이프 진행 여부 */
	isSlidingOrSwiping: () => boolean;
	/** 특정 카테고리의 보존된 목록 스크롤 Y (모바일 상세 프레임 슬라이드 위치 보정용) */
	getSectionListScrollY: (key: MainSectionKey) => number;
}

const MAIN_SECTION_CONTEXT_KEY = Symbol('indig.mainSection');

export function setMainSectionContext(value: MainSectionContextValue): void {
	setContext(MAIN_SECTION_CONTEXT_KEY, value);
}

export function getMainSectionContext(): MainSectionContextValue | undefined {
	return getContext<MainSectionContextValue | undefined>(MAIN_SECTION_CONTEXT_KEY);
}
