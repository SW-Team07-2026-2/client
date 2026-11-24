import type { CatalogCategoryKey } from '#lib/config/catalogFeed';
import { resolveCatalogCategoryFromPath } from './catalogFeedState.svelte';

export type DetailPhase = 'closed' | 'expanding' | 'open' | 'closing';

export interface DetailRect {
	left: number;
	top: number;
	width: number;
	height: number;
}

export interface DetailMorphSeed {
	category: CatalogCategoryKey;
	itemId: number;
	originRect: DetailRect | null;
	imageSrc?: string;
	/** 카드 미디어 형태: 아티스트 원형('circle'), 공연·앨범·굿즈 둥근 사각형('rounded') */
	shape?: 'circle' | 'rounded';
	/** shape === 'rounded'일 때 모서리 반경(px) */
	shapeRadius?: number;
	accentColor?: string;
}

export interface CategoryDetailSlot {
	phase: DetailPhase;
	activeId: number | null;
	closingId: number | null;
	closeReady: boolean;
	seed: DetailMorphSeed | null;
	closeFrameRect: DetailRect | null;
	closeHeroRect: DetailRect | null;
	closeScrollY: number;
	closeHeaderBottom: number;
}

const CATEGORIES: readonly CatalogCategoryKey[] = ['artist', 'concert', 'album', 'goods'];

function createEmptySlot(): CategoryDetailSlot {
	return {
		phase: 'closed',
		activeId: null,
		closingId: null,
		closeReady: false,
		seed: null,
		closeFrameRect: null,
		closeHeroRect: null,
		closeScrollY: 0,
		closeHeaderBottom: 0
	};
}

/** `/artist/42`, `/concert/10`, `/album/7`, `/goods/3` 형태의 상세 경로를 파싱합니다. */
export function parseCatalogDetailRoute(
	pathname?: string | null
): { category: CatalogCategoryKey; id: number } | null {
	if (!pathname) return null;
	const match = /^\/(artist|concert|album|goods)\/([^/]+)\/?$/.exec(pathname);
	if (!match) return null;
	const id = Number(match[2]);
	if (!Number.isFinite(id)) return null;
	return {
		category: match[1] as CatalogCategoryKey,
		id
	};
}

export function isCatalogDetailPath(pathname?: string | null): boolean {
	return parseCatalogDetailRoute(pathname) !== null;
}

class DetailOverlayStore {
	private slots = $state<Record<CatalogCategoryKey, CategoryDetailSlot>>({
		artist: createEmptySlot(),
		concert: createEmptySlot(),
		album: createEmptySlot(),
		goods: createEmptySlot()
	});

	private pendingSeeds = new Map<string, DetailMorphSeed>();
	private lastOriginRects = new Map<string, DetailRect>();
	private lastImageSrcs = new Map<string, string>();
	private expandCompleteCbs = new Map<CatalogCategoryKey, () => void>();
	private closeCompleteCbs = new Map<CatalogCategoryKey, () => void>();
	private fallbackTimers = new Map<CatalogCategoryKey, ReturnType<typeof setTimeout>>();
	private lastSyncedPath: string | null = null;

	private makeKey(category: CatalogCategoryKey, itemId: number): string {
		return `${category}:${itemId}`;
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

	hasExpanding(): boolean {
		return CATEGORIES.some((cat) => this.slots[cat].phase === 'expanding');
	}

	hasPendingCloseLock(): boolean {
		return CATEGORIES.some(
			(cat) => this.slots[cat].phase === 'closing' && !this.slots[cat].closeReady
		);
	}

	/** 카드 클릭 시 확장 시작 좌표 및 미디어 정보를 예약합니다. */
	prepareOpen(seed: DetailMorphSeed): void {
		const key = this.makeKey(seed.category, seed.itemId);
		this.pendingSeeds.set(key, seed);
		if (seed.originRect) {
			this.lastOriginRects.set(key, seed.originRect);
		}
		if (seed.imageSrc) {
			this.lastImageSrcs.set(key, seed.imageSrc);
		}
	}

	peekPendingSeed(category: CatalogCategoryKey, itemId: number): DetailMorphSeed | null {
		return this.pendingSeeds.get(this.makeKey(category, itemId)) ?? null;
	}

	getLastOriginRect(category: CatalogCategoryKey, itemId: number): DetailRect | null {
		return this.lastOriginRects.get(this.makeKey(category, itemId)) ?? null;
	}

	getLastImageSrc(category: CatalogCategoryKey, itemId: number): string {
		return this.lastImageSrcs.get(this.makeKey(category, itemId)) ?? '';
	}

	/**
	 * 목록 -> 상세 전환 시작.
	 * 예약된 카드 좌표가 있고 animate=true이면 'expanding', 아니면 즉시 'open'으로 전이합니다.
	 */
	beginExpand(
		category: CatalogCategoryKey,
		itemId: number,
		opts: { animate: boolean; onComplete?: () => void; fallbackMs?: number }
	): boolean {
		this.clearTimer(category);
		this.closeCompleteCbs.delete(category);

		const key = this.makeKey(category, itemId);
		const seed = this.pendingSeeds.get(key) ?? null;
		this.pendingSeeds.delete(key);

		const shouldAnimate = Boolean(opts.animate && seed?.originRect);
		const slot = this.slots[category];
		slot.activeId = itemId;
		slot.closingId = null;
		slot.closeReady = false;
		slot.seed = seed;
		slot.closeFrameRect = null;
		slot.closeHeroRect = null;
		slot.closeScrollY = 0;
		slot.closeHeaderBottom = 0;

		if (shouldAnimate) {
			slot.phase = 'expanding';
			if (opts.onComplete) {
				this.expandCompleteCbs.set(category, opts.onComplete);
			}
			const timer = setTimeout(() => {
				this.finishExpand(category);
			}, opts.fallbackMs ?? 820);
			this.fallbackTimers.set(category, timer);
			return true;
		}

		slot.phase = 'open';
		opts.onComplete?.();
		return false;
	}

	finishExpand(category: CatalogCategoryKey): void {
		this.clearTimer(category);
		const slot = this.slots[category];
		if (slot.phase === 'expanding') {
			slot.phase = 'open';
		}
		const cb = this.expandCompleteCbs.get(category);
		this.expandCompleteCbs.delete(category);
		cb?.();
	}

	/**
	 * 상세 -> 목록 복귀 닫기 시작.
	 * DOM·스크롤이 바뀌기 직전에 현재 화면의 프레임/히어로 좌표를 스냅샷으로 저장한 뒤 'closing'으로 전이합니다.
	 */
	beginClose(
		category: CatalogCategoryKey,
		itemId: number,
		opts: {
			animate: boolean;
			scrollY: number;
			readyImmediately: boolean;
			onComplete?: () => void;
			fallbackMs?: number;
		}
	): boolean {
		this.clearTimer(category);
		this.expandCompleteCbs.delete(category);

		const slot = this.slots[category];

		if (!opts.animate) {
			this.resetSlot(category);
			opts.onComplete?.();
			return false;
		}

		let frameRect: DetailRect | null = null;
		let heroRect: DetailRect | null = null;
		let headerBottom = 0;

		if (typeof document !== 'undefined') {
			const header = document.querySelector<HTMLElement>('.main-header, .mobile-header');
			if (header) {
				headerBottom = Math.max(0, Math.round(header.getBoundingClientRect().bottom));
			}
			const frameEl = document.querySelector<HTMLElement>(
				`[data-detail-frame="${category}-${itemId}"]`
			);
			if (frameEl) {
				const r = frameEl.getBoundingClientRect();
				if (r.width > 0 && r.height > 0) {
					frameRect = { left: r.left, top: r.top, width: r.width, height: r.height };
				}
				const heroEl =
					frameEl.querySelector<HTMLElement>('[data-detail-hero-media] .fd-img') ??
					frameEl.querySelector<HTMLElement>('[data-detail-hero-media] img') ??
					frameEl.querySelector<HTMLElement>('[data-detail-hero-media]');
				if (heroEl) {
					const hr = heroEl.getBoundingClientRect();
					if (hr.width > 0 && hr.height > 0) {
						heroRect = { left: hr.left, top: hr.top, width: hr.width, height: hr.height };
					}
				}
			}
		}

		slot.phase = 'closing';
		slot.activeId = null;
		slot.closingId = itemId;
		slot.closeReady = opts.readyImmediately;
		slot.closeFrameRect = frameRect;
		slot.closeHeroRect = heroRect;
		slot.closeScrollY = Math.max(0, opts.scrollY);
		slot.closeHeaderBottom = headerBottom;

		if (opts.onComplete) {
			this.closeCompleteCbs.set(category, opts.onComplete);
		}
		const timer = setTimeout(() => {
			this.finishClose(category);
		}, opts.fallbackMs ?? 800);
		this.fallbackTimers.set(category, timer);
		return true;
	}

	markCloseReady(category: CatalogCategoryKey): void {
		const slot = this.slots[category];
		if (slot.phase === 'closing' && !slot.closeReady) {
			slot.closeReady = true;
		}
	}

	finishClose(category: CatalogCategoryKey): void {
		this.clearTimer(category);
		this.resetSlot(category);
		const cb = this.closeCompleteCbs.get(category);
		this.closeCompleteCbs.delete(category);
		cb?.();
	}

	/**
	 * 현재 URL 경로와 카테고리 슬롯 상태를 동기화합니다.
	 * 다른 카테고리의 열려 있는 상세 상태는 건드리지 않아 카테고리 이동 후 복귀 시 그대로 유지됩니다.
	 */
	syncRoute(pathname: string): void {
		const normalized = pathname.replace(/\/+$/, '') || '/';
		// 동일 경로에 대한 중복 호출 시 진행 중인 expanding/closing 전환을 건드리지 않음
		if (this.lastSyncedPath === normalized) return;
		this.lastSyncedPath = normalized;

		const parsed = parseCatalogDetailRoute(normalized);
		if (parsed) {
			const slot = this.slots[parsed.category];
			if (slot.activeId !== parsed.id) {
				slot.activeId = parsed.id;
			}
			if (slot.phase === 'closed' || slot.phase === 'closing') {
				slot.closingId = null;
				slot.closeReady = false;
				slot.phase = 'open';
			}
			return;
		}

		const cat = resolveCatalogCategoryFromPath(normalized);
		if (cat && normalized === `/${cat}`) {
			const slot = this.slots[cat];
			if (slot.activeId !== null) {
				slot.activeId = null;
			}
			if (slot.phase !== 'closing' && slot.phase !== 'closed') {
				slot.phase = 'closed';
				slot.closingId = null;
			}
		}
	}

	/** 다른 카테고리로 이탈 시 진행 중인 일시 전환(expanding/closing)만 안전하게 정리합니다. */
	settleTransientTransitions(): void {
		for (const cat of CATEGORIES) {
			const slot = this.slots[cat];
			if (slot.phase === 'expanding') {
				this.finishExpand(cat);
			} else if (slot.phase === 'closing') {
				this.finishClose(cat);
			}
		}
	}

	private resetSlot(category: CatalogCategoryKey): void {
		const slot = this.slots[category];
		slot.phase = 'closed';
		slot.activeId = null;
		slot.closingId = null;
		slot.closeReady = false;
		slot.seed = null;
		slot.closeFrameRect = null;
		slot.closeHeroRect = null;
		slot.closeScrollY = 0;
		slot.closeHeaderBottom = 0;
	}

	destroy(): void {
		for (const cat of CATEGORIES) {
			this.clearTimer(cat);
		}
		this.expandCompleteCbs.clear();
		this.closeCompleteCbs.clear();
	}
}

export const detailOverlay = new DetailOverlayStore();
