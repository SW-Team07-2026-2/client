import type { CatalogCategoryKey } from '#lib/common/catalog/catalogFeed';
import { closeDetailStage } from '#lib/common/logic/detailNavigation';
import {
	detailOverlay,
	type CategoryDetailSlot,
	type DetailPhase
} from '#lib/common/logic/detailOverlayState.svelte';
import { prefersReducedMotion } from '#lib/common/type/spring';

/**
 * 3_content_section 상세 스테이지 컨트롤러
 * - detailOverlay 스토어와 라우트 detailId를 동기화하고,
 *   슬라이드 업/다운 전환, ESC 닫기, 모바일 배경 스크롤 잠금을 관리합니다.
 * - PC(이전 상세 복귀 지원)와 모바일(항상 현재 카테고리 목록 복귀)의 복귀 정책을 분리 적용합니다.
 */
export class DetailStageController {
	readonly category: CatalogCategoryKey;
	readonly mobile: boolean;
	private prevDetailId: number | null = null;
	private scrollLocked = false;
	/** 모바일 상세 프레임 아이템별 독립 스크롤 위치 기억 (display: none 파킹 후 복원용) */
	private scrollPositions = $state<Record<number, number>>({});

	constructor(category: CatalogCategoryKey, mobile: boolean) {
		this.category = category;
		this.mobile = mobile;
	}

	getScrollTop = (itemId: number | null): number => {
		if (itemId === null) return 0;
		return this.scrollPositions[itemId] ?? 0;
	};

	saveScrollTop = (itemId: number | null, scrollTop: number): void => {
		if (itemId === null) return;
		const normalized = Math.max(0, Math.round(scrollTop));
		if (this.scrollPositions[itemId] !== normalized) {
			this.scrollPositions[itemId] = normalized;
		}
	};

	get slot(): CategoryDetailSlot {
		return detailOverlay.getSlot(this.category);
	}

	get phase(): DetailPhase {
		return this.slot.phase;
	}

	get renderId(): number | null {
		return detailOverlay.getRenderId(this.category);
	}

	get isVisible(): boolean {
		return this.phase !== 'closed' && this.renderId !== null;
	}

	get backLabel(): string {
		if (this.mobile) return '목록으로';
		return this.slot.returnPath !== null ? '이전' : '목록으로';
	}

	/**
	 * 라우트 detailId 변화에 따라 열기(expanding) / 닫기(closing) 전환을 트리거합니다.
	 * @param suppressMotion 카테고리 간 좌우 슬라이드 전환 중에는 수직 열기/닫기 모션을 생략하고 즉시 안착합니다.
	 */
	sync = (
		active: boolean,
		detailId: number | null,
		mobile: boolean,
		suppressMotion = false
	): void => {
		const prev = this.prevDetailId;
		this.prevDetailId = detailId;

		const animate = active && !suppressMotion && !prefersReducedMotion();

		if (prev === null && detailId !== null) {
			detailOverlay.beginExpand(this.category, detailId, { animate });
		} else if (prev !== null && detailId === null) {
			delete this.scrollPositions[prev];
			detailOverlay.beginClose(this.category, prev, { animate });
		} else if (prev !== null && detailId !== null && prev !== detailId) {
			detailOverlay.beginExpand(this.category, detailId, { animate: false });
		}

		// 모바일만 고정 프레임 내부 스크롤을 사용하므로 배경 스크롤 잠금 (PC는 기본 window 스크롤 사용)
		this.syncBodyScrollLock(mobile && active && this.isVisible);
	};

	/** PC는 이전 상세(history.back) 또는 목록 복귀, 모바일은 항상 현재 카테고리 목록으로 복귀 */
	close = (): void => {
		closeDetailStage({
			category: this.category,
			mobile: this.mobile,
			returnPath: this.slot.returnPath,
			enteredFromOwnList: this.slot.enteredFromOwnList
		});
	};

	finishExpand = (): void => {
		detailOverlay.finishExpand(this.category);
		// PC는 open 안착 시 문서 흐름으로 전환되므로 상세 상단(y = 0)에서 시작
		if (typeof window !== 'undefined' && !this.scrollLocked) {
			window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
		}
	};

	finishClose = (): void => {
		detailOverlay.finishClose(this.category);
		this.syncBodyScrollLock(false);
	};

	/** ESC 키로 상세 닫기 */
	attachKeydown = (active: boolean): (() => void) | void => {
		if (!active || !this.isVisible || typeof window === 'undefined') return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				this.close();
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => {
			window.removeEventListener('keydown', onKeyDown);
		};
	};

	destroy = (): void => {
		this.syncBodyScrollLock(false);
	};

	private syncBodyScrollLock(shouldLock: boolean): void {
		if (typeof document === 'undefined') return;
		if (shouldLock && !this.scrollLocked) {
			document.documentElement.classList.add('detail-stage-open');
			this.scrollLocked = true;
		} else if (!shouldLock && this.scrollLocked) {
			document.documentElement.classList.remove('detail-stage-open');
			this.scrollLocked = false;
		}
	}
}
