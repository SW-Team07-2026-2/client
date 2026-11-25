import { goto } from '$app/navigation';
import type { CatalogCategoryKey } from '#lib/common/catalog/catalogFeed';
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
 */
export class DetailStageController {
	readonly category: CatalogCategoryKey;
	private prevDetailId: number | null = null;
	private scrollLocked = false;

	constructor(category: CatalogCategoryKey) {
		this.category = category;
	}

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

	/**
	 * 라우트 detailId 변화에 따라 열기(expanding) / 닫기(closing) 전환을 트리거합니다.
	 */
	sync = (active: boolean, detailId: number | null, mobile: boolean): void => {
		const prev = this.prevDetailId;
		this.prevDetailId = detailId;

		const animate = active && !prefersReducedMotion();

		if (prev === null && detailId !== null) {
			detailOverlay.beginExpand(this.category, detailId, { animate });
		} else if (prev !== null && detailId === null) {
			detailOverlay.beginClose(this.category, prev, { animate });
		} else if (prev !== null && detailId !== null && prev !== detailId) {
			detailOverlay.beginExpand(this.category, detailId, { animate: false });
		}

		// 모바일만 고정 프레임 내부 스크롤을 사용하므로 배경 스크롤 잠금 (PC는 기본 window 스크롤 사용)
		this.syncBodyScrollLock(mobile && active && this.isVisible);
	};

	/** 상세 닫기 요청 -> 해당 카테고리 목록 경로로 복귀 */
	close = (): void => {
		void goto(`/${this.category}`, { reset: false });
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
