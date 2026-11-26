import { prefersReducedMotion } from '#lib/common/type/spring';
import {
	parseMainSectionDetailId,
	resolveMainSectionKey,
	type MainSectionKey
} from './sectionRegistry';

/**
 * 메인 섹션 카테고리별 목록/상세 독립 스크롤 위치 기억 및 전환 스크롤 애니메이션 헬퍼
 */
export class SectionScrollMemory {
	private listScrollPositions = $state<Record<MainSectionKey, number>>({
		artist: 0,
		concert: 0,
		album: 0,
		goods: 0,
		mypage: 0
	});
	private detailScrollPositions: Record<string, number> = {};
	private transitionScrollRafId = 0;

	getSavedScrollY(pathname: string | null | undefined, mobile: boolean): number {
		if (!pathname) return 0;
		const key = resolveMainSectionKey(pathname);
		if (mobile) {
			return key ? this.listScrollPositions[key] : 0;
		}
		const detailId = parseMainSectionDetailId(pathname);
		if (detailId !== null) {
			return this.detailScrollPositions[pathname] ?? 0;
		}
		return key ? this.listScrollPositions[key] : 0;
	}

	getListScrollY(key: MainSectionKey): number {
		return this.listScrollPositions[key] ?? 0;
	}

	saveListScrollY(key: MainSectionKey, y: number): void {
		this.listScrollPositions[key] = y;
	}

	saveDetailScrollY(pathname: string, y: number): void {
		this.detailScrollPositions[pathname] = y;
	}

	cancelAnimation(): void {
		if (this.transitionScrollRafId) {
			cancelAnimationFrame(this.transitionScrollRafId);
			this.transitionScrollRafId = 0;
		}
	}

	animateTo(fromY: number, toY: number, durationMs: number): void {
		this.cancelAnimation();
		if (typeof window === 'undefined') return;
		if (Math.abs(toY - fromY) <= 1 || prefersReducedMotion()) {
			window.scrollTo({ top: toY, left: 0, behavior: 'auto' });
			return;
		}

		window.scrollTo({ top: fromY, left: 0, behavior: 'auto' });
		const startTime = performance.now();
		const delta = toY - fromY;

		const step = (now: number) => {
			const t = Math.min(1, (now - startTime) / durationMs);
			const inv = 1 - t;
			const eased = 1 - inv * inv * inv;
			window.scrollTo({ top: Math.round(fromY + delta * eased), left: 0, behavior: 'auto' });
			if (t < 1) {
				this.transitionScrollRafId = requestAnimationFrame(step);
			} else {
				this.transitionScrollRafId = 0;
				window.scrollTo({ top: toY, left: 0, behavior: 'auto' });
			}
		};

		this.transitionScrollRafId = requestAnimationFrame(step);
	}
}
