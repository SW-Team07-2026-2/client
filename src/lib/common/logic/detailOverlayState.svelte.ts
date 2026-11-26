import type { CatalogCategoryKey } from '#lib/common/catalog/catalogFeed';

export type DetailPhase = 'closed' | 'expanding' | 'open' | 'closing';

export interface CategoryDetailSlot {
	phase: DetailPhase;
	activeId: number | null;
	closingId: number | null;
	/** [PC 전용] 이 카테고리 상세에서 '이전' 버튼 클릭 시 복귀할 상세 경로 (목록 복귀 시 null) */
	returnPath: string | null;
	/** [모바일 전용] 현재 상세가 자기 카테고리 목록(`/${category}`)에서 바로 진입했는지 여부 */
	enteredFromOwnList: boolean;
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
		closingId: null,
		returnPath: null,
		enteredFromOwnList: false
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
	/** 상세 내부 링크/버튼을 통해 이동한 복귀 대상 경로 스택 */
	private historyStack = $state<string[]>([]);
	/** 상세 내부에서 다른 상세로 이동하기 직전에 등록되는 목표 경로 */
	private pendingInDetailTarget: string | null = null;

	get previousDetailPath(): string | null {
		return this.historyStack.length > 0 ? this.historyStack[this.historyStack.length - 1] : null;
	}

	get hasPreviousDetail(): boolean {
		return this.historyStack.length > 0;
	}

	/**
	 * 상세 페이지 내부의 링크/버튼(예: 앨범 상세 -> 아티스트 상세)으로
	 * 다른 상세 페이지로 이동하기 직전에 호출합니다.
	 * 이 마크가 있을 때만 '이전' 복귀 히스토리에 기록됩니다.
	 */
	markInDetailJump(targetPath: string): void {
		this.pendingInDetailTarget = normalizeDetailPath(targetPath);
	}

	/**
	 * 라우트 이동 시 상세 히스토리 스택과 진입 대상 슬롯의 복귀 상태를 동기화합니다.
	 * - 모바일: '이전' 히스토리를 사용하지 않으며, 자기 카테고리 목록에서 바로 진입했는지 여부만 기록합니다.
	 * - PC: 상세 내부 점프(markInDetailJump)일 때만 히스토리에 push하고, 복귀 시 pop합니다.
	 * - 퇴장하는 출발지 슬롯의 상태는 좌우 슬라이드 중 아이콘이 바뀌지 않도록 유지합니다.
	 */
	recordNavigation(fromPath?: string | null, toPath?: string | null, mobile = false): void {
		const from = normalizeDetailPath(fromPath);
		const to = normalizeDetailPath(toPath);
		const expectedJumpTarget = this.pendingInDetailTarget;
		this.pendingInDetailTarget = null;

		if (!from || !to || from === to) return;

		const fromDetail = parseCatalogDetailRoute(from);
		const toDetail = parseCatalogDetailRoute(to);

		if (mobile) {
			if (this.historyStack.length > 0) {
				this.historyStack = [];
			}
			if (toDetail) {
				const slot = this.slots[toDetail.category];
				slot.returnPath = null;
				slot.enteredFromOwnList = from === `/${toDetail.category}`;
			}
			return;
		}

		if (!toDetail || !fromDetail) {
			if (this.historyStack.length > 0) {
				this.historyStack = [];
			}
			if (toDetail) {
				const slot = this.slots[toDetail.category];
				slot.returnPath = null;
				slot.enteredFromOwnList = from === `/${toDetail.category}`;
			}
			return;
		}

		if (expectedJumpTarget === to) {
			const next = [...this.historyStack, from];
			this.historyStack =
				next.length > MAX_DETAIL_HISTORY ? next.slice(next.length - MAX_DETAIL_HISTORY) : next;
			const slot = this.slots[toDetail.category];
			slot.returnPath = from;
			slot.enteredFromOwnList = false;
			return;
		}

		const top = this.historyStack[this.historyStack.length - 1];
		if (top === to) {
			this.historyStack = this.historyStack.slice(0, -1);
			const slot = this.slots[toDetail.category];
			slot.returnPath = this.previousDetailPath;
			slot.enteredFromOwnList = false;
			return;
		}

		if (this.historyStack.length > 0) {
			this.historyStack = [];
		}
		const slot = this.slots[toDetail.category];
		slot.returnPath = null;
		slot.enteredFromOwnList = false;
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
		slot.returnPath = null;
		slot.enteredFromOwnList = false;
	}
}

export const detailOverlay = new DetailOverlayStore();
