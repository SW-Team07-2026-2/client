import type { CatalogCategoryKey } from '#lib/common/catalog/catalogFeed';

export type DetailPhase = 'closed' | 'expanding' | 'open' | 'closing';

export interface CategoryDetailSlot {
	phase: DetailPhase;
	activeId: number | null;
	closingId: number | null;
}

const CATEGORIES: readonly CatalogCategoryKey[] = ['artist', 'concert', 'album', 'goods'];
const MAX_DETAIL_HISTORY = 20;

function normalizeDetailPath(pathname?: string | null): string {
	if (!pathname) return '';
	return pathname.replace(/\/+$/, '') || '/';
}

function createEmptySlot(): CategoryDetailSlot {
	return {
		phase: 'closed',
		activeId: null,
		closingId: null
	};
}

/** `/artist/42`, `/concert/10`, `/album/7`, `/goods/3` 형태의 상세 경로를 파싱합니다. */
export function parseCatalogDetailRoute(
	pathname?: string | null
): { category: CatalogCategoryKey; id: number } | null {
	if (!pathname) return null;
	const match = /^\/(artist|concert|album|goods)\/(\d+)\/?$/.exec(pathname);
	if (!match) return null;
	const id = Number.parseInt(match[2], 10);
	if (!Number.isFinite(id)) return null;
	return {
		category: match[1] as CatalogCategoryKey,
		id
	};
}

/**
 * 카테고리별 상세 페이지 열기/닫기 전환 상태 머신 (`closed` -> `expanding` -> `open` -> `closing` -> `closed`).
 */
class DetailOverlayStore {
	private slots = $state<Record<CatalogCategoryKey, CategoryDetailSlot>>({
		artist: createEmptySlot(),
		concert: createEmptySlot(),
		album: createEmptySlot(),
		goods: createEmptySlot()
	});

	private fallbackTimers = new Map<CatalogCategoryKey, ReturnType<typeof setTimeout>>();
	/** 상세 -> 상세 이동 시 복귀 대상 경로를 추적하는 인앱 히스토리 스택 */
	private historyStack = $state<string[]>([]);

	get previousDetailPath(): string | null {
		return this.historyStack.length > 0 ? this.historyStack[this.historyStack.length - 1] : null;
	}

	get hasPreviousDetail(): boolean {
		return this.historyStack.length > 0;
	}

	/**
	 * 라우트 이동 시 상세 히스토리 스택을 동기화합니다.
	 * - 목록 등 비-상세 페이지로 이동하거나 목록 -> 상세 진입 시 스택을 초기화합니다.
	 * - 상세 -> 상세 이동 시, 직전 스택 최상단으로의 복귀면 pop, 신규 점프면 push합니다.
	 */
	recordNavigation(fromPath?: string | null, toPath?: string | null): void {
		const from = normalizeDetailPath(fromPath);
		const to = normalizeDetailPath(toPath);
		if (!from || !to || from === to) return;

		const fromDetail = parseCatalogDetailRoute(from);
		const toDetail = parseCatalogDetailRoute(to);

		if (!toDetail || !fromDetail) {
			if (this.historyStack.length > 0) {
				this.historyStack = [];
			}
			return;
		}

		const top = this.historyStack[this.historyStack.length - 1];
		if (top === to) {
			this.historyStack = this.historyStack.slice(0, -1);
			return;
		}

		const next = [...this.historyStack, from];
		this.historyStack =
			next.length > MAX_DETAIL_HISTORY ? next.slice(next.length - MAX_DETAIL_HISTORY) : next;
	}

	private clearTimer(category: CatalogCategoryKey): void {
		const timer = this.fallbackTimers.get(category);
		if (timer !== undefined) {
			clearTimeout(timer);
			this.fallbackTimers.delete(category);
		}
	}

	getSlot(category: CatalogCategoryKey): CategoryDetailSlot {
		return this.slots[category];
	}

	getRenderId(category: CatalogCategoryKey): number | null {
		const slot = this.slots[category];
		return slot.activeId ?? slot.closingId;
	}

	isTransitioning(category: CatalogCategoryKey): boolean {
		const phase = this.slots[category].phase;
		return phase === 'expanding' || phase === 'closing';
	}

	hasAnyTransitioning(): boolean {
		return CATEGORIES.some((cat) => this.isTransitioning(cat));
	}

	/** 목록 -> 상세 진입 시작 */
	beginExpand(
		category: CatalogCategoryKey,
		itemId: number,
		opts: { animate: boolean; fallbackMs?: number }
	): void {
		this.clearTimer(category);
		const slot = this.slots[category];
		slot.activeId = itemId;
		slot.closingId = null;

		if (opts.animate) {
			slot.phase = 'expanding';
			const timer = setTimeout(() => {
				this.finishExpand(category);
			}, opts.fallbackMs ?? 600);
			this.fallbackTimers.set(category, timer);
			return;
		}

		slot.phase = 'open';
	}

	finishExpand(category: CatalogCategoryKey): void {
		this.clearTimer(category);
		const slot = this.slots[category];
		if (slot.phase === 'expanding') {
			slot.phase = 'open';
		}
	}

	/** 상세 -> 목록 복귀 닫기 시작 */
	beginClose(
		category: CatalogCategoryKey,
		itemId: number,
		opts: { animate: boolean; fallbackMs?: number }
	): void {
		this.clearTimer(category);

		if (!opts.animate) {
			this.resetSlot(category);
			return;
		}

		const slot = this.slots[category];
		slot.phase = 'closing';
		slot.activeId = null;
		slot.closingId = itemId;

		const timer = setTimeout(() => {
			this.finishClose(category);
		}, opts.fallbackMs ?? 600);
		this.fallbackTimers.set(category, timer);
	}

	finishClose(category: CatalogCategoryKey): void {
		this.clearTimer(category);
		this.resetSlot(category);
	}

	private resetSlot(category: CatalogCategoryKey): void {
		const slot = this.slots[category];
		slot.phase = 'closed';
		slot.activeId = null;
		slot.closingId = null;
	}
}

export const detailOverlay = new DetailOverlayStore();
