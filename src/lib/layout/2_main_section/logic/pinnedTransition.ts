import { getMainSection, type MainSectionKey } from './sectionRegistry';

/** PC에서 헤더/옵션바를 좌우 슬라이드 대신 제자리 유지 + 부드러운 상단 복귀로 전환하는 스크롤 임계값(px) */
export const PC_PINNED_SCROLL_THRESHOLD = 217;

export type PinnedSlideMode = 'pinned' | 'in' | 'out' | 'none';

export interface PinnedTransitionParams {
	prevKey: MainSectionKey;
	activeKey: MainSectionKey;
	fromY: number;
	toY: number;
	isMobile: boolean;
	fromIsDetail: boolean;
	toIsDetail: boolean;
	headerHeight: number;
	controlHeight: number;
}

export interface PinnedTransitionPlan {
	headerSlideMode: PinnedSlideMode;
	controlSlideMode: PinnedSlideMode;
	headerSection: MainSectionKey | null;
	headerOffsetY: number;
	controlSection: MainSectionKey | null;
	controlOffsetY: number;
}

/** PC 목록 전환 시 이전/다음 페이지 모두 임계값(217px) 이하 스크롤이면 부드러운 수직 이동 + 헤더/옵션바 제자리 유지 */
export function shouldUseSmoothPcScroll(params: {
	isMobile: boolean;
	fromDetailId: number | null;
	toDetailId: number | null;
	fromY: number;
	toY: number;
}): boolean {
	return (
		!params.isMobile &&
		params.fromDetailId === null &&
		params.toDetailId === null &&
		params.fromY <= PC_PINNED_SCROLL_THRESHOLD &&
		params.toY <= PC_PINNED_SCROLL_THRESHOLD &&
		Math.abs(params.toY - params.fromY) > 1
	);
}

/**
 * PC/모바일 제자리 고정 영역(PcContentHeader · PcContentControl · MbContentHeader)의
 * 카테고리 전환 시 슬라이드 참여 여부 및 스크롤 보정 오프셋을 계산합니다.
 */
export function resolvePinnedTransition(params: PinnedTransitionParams): PinnedTransitionPlan {
	const { prevKey, activeKey, fromY, toY, isMobile, fromIsDetail, toIsDetail } = params;

	const fromHasControl = getMainSection(prevKey).supportsOptions && !fromIsDetail;
	const toHasControl = getMainSection(activeKey).supportsOptions && !toIsDetail;

	// 모바일: MbContentHeader는 MbHeader 아래 뷰포트 고정(fixed)이므로
	// 두 페이지 모두 목록(옵션 지원)이면 제자리 유지,
	// 한쪽만 상세 페이지이거나 마이페이지면 해당 페이지와 함께 좌우 슬라이드 인/아웃
	if (isMobile) {
		let controlSlideMode: PinnedSlideMode = 'none';
		let controlSection: MainSectionKey | null = null;

		if (fromHasControl && toHasControl) {
			controlSlideMode = 'pinned';
			controlSection = activeKey;
		} else if (fromHasControl && !toHasControl) {
			controlSlideMode = 'out';
			controlSection = prevKey;
		} else if (!fromHasControl && toHasControl) {
			controlSlideMode = 'in';
			controlSection = activeKey;
		}

		return {
			headerSlideMode: 'none',
			controlSlideMode,
			headerSection: activeKey,
			headerOffsetY: 0,
			controlSection,
			controlOffsetY: 0
		};
	}

	// PC: 상세 페이지 <-> 목록 카테고리 간 전환 처리
	if (fromIsDetail && toIsDetail) {
		return {
			headerSlideMode: 'none',
			controlSlideMode: 'none',
			headerSection: null,
			headerOffsetY: 0,
			controlSection: null,
			controlOffsetY: 0
		};
	}

	if (fromIsDetail && !toIsDetail) {
		if (toY <= PC_PINNED_SCROLL_THRESHOLD) {
			return {
				headerSlideMode: 'in',
				controlSlideMode: toHasControl ? 'in' : 'none',
				headerSection: activeKey,
				headerOffsetY: 0,
				controlSection: toHasControl ? activeKey : null,
				controlOffsetY: 0
			};
		}
		return {
			headerSlideMode: 'none',
			controlSlideMode: 'none',
			headerSection: activeKey,
			headerOffsetY: 0,
			controlSection: toHasControl ? activeKey : null,
			controlOffsetY: 0
		};
	}

	if (!fromIsDetail && toIsDetail) {
		if (fromY <= PC_PINNED_SCROLL_THRESHOLD) {
			return {
				headerSlideMode: 'out',
				controlSlideMode: fromHasControl ? 'out' : 'none',
				headerSection: prevKey,
				headerOffsetY: 0,
				controlSection: fromHasControl ? prevKey : null,
				controlOffsetY: 0
			};
		}
		return {
			headerSlideMode: 'none',
			controlSlideMode: 'none',
			headerSection: null,
			headerOffsetY: 0,
			controlSection: null,
			controlOffsetY: 0
		};
	}

	const headerZone = PC_PINNED_SCROLL_THRESHOLD;
	const pinnedThreshold = PC_PINNED_SCROLL_THRESHOLD;

	// 1) 임계값 이내(PC <= 217px): 헤더·옵션바 제자리 유지, 마이페이지 전환 시만 옵션바 슬라이드
	if (fromY <= pinnedThreshold && toY <= pinnedThreshold) {
		let controlSlideMode: PinnedSlideMode = 'none';
		let controlSection: MainSectionKey | null = null;

		if (fromHasControl && toHasControl) {
			controlSlideMode = 'pinned';
			controlSection = activeKey;
		} else if (fromHasControl && !toHasControl) {
			controlSlideMode = 'out';
			controlSection = prevKey;
		} else if (!fromHasControl && toHasControl) {
			controlSlideMode = 'in';
			controlSection = activeKey;
		}

		return {
			headerSlideMode: 'pinned',
			controlSlideMode,
			headerSection: activeKey,
			headerOffsetY: 0,
			controlSection,
			controlOffsetY: 0
		};
	}

	// 2) 임계값 초과 스크롤 페이지 -> 상단 노출 페이지: 고정 영역이 새 페이지와 함께 좌우 슬라이드 진입
	if (fromY > pinnedThreshold && toY <= headerZone) {
		return {
			headerSlideMode: 'in',
			controlSlideMode: toHasControl ? 'in' : 'none',
			headerSection: activeKey,
			headerOffsetY: 0,
			controlSection: toHasControl ? activeKey : null,
			controlOffsetY: 0
		};
	}

	// 3) 상단 노출 페이지 -> 스크롤된 페이지: 이전 페이지의 고정 영역이 현재 뷰포트 위치에서 좌우 슬라이드 퇴장
	if (fromY <= headerZone && toY > headerZone) {
		const exitTopOffset = Math.max(0, toY - fromY);
		return {
			headerSlideMode: 'out',
			controlSlideMode: fromHasControl ? 'out' : 'none',
			headerSection: prevKey,
			headerOffsetY: exitTopOffset,
			controlSection: fromHasControl ? prevKey : null,
			controlOffsetY: fromHasControl ? exitTopOffset : 0
		};
	}

	// 4) 두 페이지 모두 상단 영역 아래로 스크롤됨: 화면 밖이므로 상태만 동기화
	return {
		headerSlideMode: 'none',
		controlSlideMode: 'none',
		headerSection: activeKey,
		headerOffsetY: 0,
		controlSection: toHasControl ? activeKey : null,
		controlOffsetY: 0
	};
}
