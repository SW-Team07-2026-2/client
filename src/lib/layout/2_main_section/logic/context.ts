import { getContext, setContext } from 'svelte';
import type { MainSectionKey } from './sectionRegistry';

export interface MainStageRect {
	left: number;
	top: number;
	width: number;
	height: number;
}

export interface MainSectionContextValue {
	/** 상세 페이지(DetailOverlayFrame)가 가로 확장 기준으로 삼는 MainSection 스테이지 영역 측정 */
	getStageRect: () => MainStageRect | null;
	/** 현재 활성 카테고리 키 */
	getActiveSection: () => MainSectionKey | null;
	/** 현재 활성 상세 ID (목록일 때 null) */
	getActiveDetailId: () => number | null;
	/** 제자리 고정 상단 영역(pinned header) 높이 측정 (상세 전환 시 점프 보정용) */
	getPinnedHeaderHeight: () => number;
}

const MAIN_SECTION_CONTEXT_KEY = Symbol('indig.mainSection');

export function setMainSectionContext(value: MainSectionContextValue): void {
	setContext(MAIN_SECTION_CONTEXT_KEY, value);
}

export function getMainSectionContext(): MainSectionContextValue | undefined {
	return getContext<MainSectionContextValue | undefined>(MAIN_SECTION_CONTEXT_KEY);
}
