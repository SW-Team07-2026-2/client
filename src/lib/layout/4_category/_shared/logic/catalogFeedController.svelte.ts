import { auth } from '#lib/auth';
import {
	CATALOG_DEFAULT_PAGE_SIZE,
	CATALOG_TRANSITION_TIMING,
	fetchCatalogPage,
	resolveCatalogErrorMessage,
	type CatalogCategoryKey,
	type CatalogFeedMode,
	type CatalogPageResult
} from '#lib/common/catalog/catalogFeed';
import {
	cloneContentFilterState,
	type ContentFilterState
} from '#lib/common/type/filterOptions';
import { prefersReducedMotion } from '#lib/common/type/spring';
import { buildCatalogRequestKey } from '#lib/common/logic';

export type CatalogViewStage =
	| 'idle'
	| 'exiting-content'
	| 'skeleton'
	| 'exiting-skeleton'
	| 'content';

export interface CatalogQueryParams {
	feedMode: CatalogFeedMode;
	query: string;
	filterState: ContentFilterState;
	refreshTick: number;
}

export interface CatalogSnapshotSeed<TItem> {
	items: TItem[];
	page: number;
	hasNext: boolean;
	requestKey?: string;
}

export interface CatalogFeedControllerOptions<TItem, TDto> {
	category: CatalogCategoryKey;
	entityLabel: string;
	pageSize?: number;
	mapItem: (dto: TDto) => TItem;
	/** 첫 진입 시 프리페치 스냅샷이 있으면 소비 (예: Artist 스플래시 프리페치) */
	consumeInitialSnapshot?: (requestKey: string) => CatalogSnapshotSeed<TItem> | null;
	/** 페이지 로드 완료 후 카테고리별 후처리 훅 (예: 이미지 프리워밍) */
	onPageLoaded?: (result: CatalogPageResult<TItem>, isFirstPage: boolean) => void;
}

function waitMs(ms: number): Promise<void> {
	if (ms <= 0) return Promise.resolve();
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 4_category 카탈로그(artist · concert · album · goods) 공용 피드 컨트롤러 기반
 * - 검색어·필터·피드모드·새로고침 변화를 단일 requestKey로 추적해 중복 요청과 경쟁 조건을 차단합니다.
 * - 기존 아이템 퇴장 -> 스켈레톤 등장/유지/퇴장 -> 새 아이템 등장 단계를 관리해 부드러운 전환을 제공합니다.
 * - 비활성(Keep-Alive 백그라운드) 상태에서는 즉시 API를 호출하지 않고, 활성화 시점에 변경분이 있으면 동기화합니다.
 */
export class CatalogFeedController<TItem, TDto = unknown> {
	items = $state<TItem[]>([]);
	page = $state(0);
	hasNext = $state(false);
	degraded = $state(false);
	isLoading = $state(false);
	isLoadingMore = $state(false);
	errorMessage = $state<string | null>(null);
	hasLoadedOnce = $state(false);
	stage = $state<CatalogViewStage>('idle');
	contentRevision = $state(0);

	private readonly opts: CatalogFeedControllerOptions<TItem, TDto>;
	private readonly pageSize: number;
	private lastCompletedKey = '';
	private lastRequestedKey = '';
	private requestToken = 0;
	private latestParams: CatalogQueryParams | null = null;

	constructor(options: CatalogFeedControllerOptions<TItem, TDto>) {
		this.opts = options;
		this.pageSize = options.pageSize ?? CATALOG_DEFAULT_PAGE_SIZE;
	}

	get isEmpty(): boolean {
		return (
			this.hasLoadedOnce &&
			this.stage === 'content' &&
			!this.isLoading &&
			!this.errorMessage &&
			this.items.length === 0
		);
	}

	get showContent(): boolean {
		return (
			(this.stage === 'content' || this.stage === 'exiting-content') &&
			!this.errorMessage &&
			this.items.length > 0
		);
	}

	get showSkeleton(): boolean {
		return this.stage === 'skeleton' || this.stage === 'exiting-skeleton';
	}

	/**
	 * 현재 섹션의 활성 여부와 최신 검색/필터/피드/새로고침 파라미터를 동기화합니다.
	 * - active가 false면 요청을 보류하고, active가 true가 되는 순간 마지막 완료 키와 다를 때만 조회합니다.
	 */
	sync = (active: boolean, params: CatalogQueryParams): void => {
		this.latestParams = {
			feedMode: params.feedMode,
			query: params.query,
			filterState: cloneContentFilterState(params.filterState),
			refreshTick: params.refreshTick
		};

		if (!active) return;

		const key = this.buildKey(this.latestParams);
		if (key === this.lastCompletedKey || key === this.lastRequestedKey) return;

		// 최초 진입 시 스플래시 프리페치 스냅샷이 있으면 네트워크 요청 없이 즉시 복원
		if (!this.hasLoadedOnce && this.opts.consumeInitialSnapshot) {
			const snapshot = this.opts.consumeInitialSnapshot(key);
			if (snapshot && snapshot.items.length > 0) {
				this.items = [...snapshot.items];
				this.page = snapshot.page;
				this.hasNext = snapshot.hasNext;
				this.degraded = false;
				this.errorMessage = null;
				this.isLoading = false;
				this.hasLoadedOnce = true;
				this.stage = 'content';
				this.contentRevision += 1;
				this.lastCompletedKey = key;
				this.lastRequestedKey = key;
				return;
			}
		}

		void this.fetchFirstPage(this.latestParams, key);
	};

	/** 오류 발생 시 현재 조건으로 1페이지 재시도 */
	retry = (): void => {
		if (!this.latestParams) return;
		this.lastCompletedKey = '';
		this.lastRequestedKey = '';
		const key = this.buildKey(this.latestParams);
		void this.fetchFirstPage(this.latestParams, key);
	};

	/** 무한 스크롤 다음 페이지 로드 */
	loadMore = async (): Promise<void> => {
		if (
			!this.latestParams ||
			!this.hasNext ||
			this.isLoading ||
			this.isLoadingMore ||
			this.stage !== 'content'
		) {
			return;
		}

		const token = this.requestToken;
		const nextPage = this.page + 1;
		this.isLoadingMore = true;

		try {
			const res = await fetchCatalogPage<TItem, TDto>({
				category: this.opts.category,
				feedMode: this.latestParams.feedMode,
				page: nextPage,
				pageSize: this.pageSize,
				query: this.latestParams.query,
				filterState: this.latestParams.filterState,
				mapItem: this.opts.mapItem
			});
			if (token !== this.requestToken) return;

			this.items = [...this.items, ...res.items];
			this.page = res.page;
			this.hasNext = res.hasNext;
			this.degraded = res.degraded;
			this.opts.onPageLoaded?.(res, false);
		} catch (err) {
			if (token !== this.requestToken) return;
			this.errorMessage = resolveCatalogErrorMessage(err, this.opts.entityLabel);
		} finally {
			if (token === this.requestToken) {
				this.isLoadingMore = false;
			}
		}
	};

	/** 외부 상태(예: 팔로우/찜 토글) 변경 시 현재 items 배열의 특정 항목만 국소 패치 */
	patchItems = (updater: (items: TItem[]) => TItem[]): void => {
		this.items = updater(this.items);
	};

	private buildKey(params: CatalogQueryParams): string {
		return buildCatalogRequestKey(this.opts.category, {
			feedMode: params.feedMode,
			query: params.query,
			filterState: params.filterState,
			refreshTick: params.refreshTick,
			authKey: `${auth.isLoggedIn}:${auth.isVerified}`
		});
	}

	private async fetchFirstPage(params: CatalogQueryParams, key: string): Promise<void> {
		const token = ++this.requestToken;
		this.lastRequestedKey = key;
		this.isLoading = true;
		this.isLoadingMore = false;

		const reduced = prefersReducedMotion();
		const hadVisibleContent = this.stage === 'content' && this.items.length > 0 && !this.errorMessage;
		const wasShowingSkeleton = this.stage === 'skeleton';

		this.errorMessage = null;

		// 네트워크 요청은 기존 콘텐츠 퇴장 애니메이션과 병렬로 즉시 시작
		const fetchPromise: Promise<
			{ ok: true; res: CatalogPageResult<TItem> } | { ok: false; err: unknown }
		> = fetchCatalogPage<TItem, TDto>({
			category: this.opts.category,
			feedMode: params.feedMode,
			page: 0,
			pageSize: this.pageSize,
			query: params.query,
			filterState: params.filterState,
			mapItem: this.opts.mapItem
		}).then(
			(res) => ({ ok: true as const, res }),
			(err) => ({ ok: false as const, err })
		);

		let settled = false;
		void fetchPromise.finally(() => {
			settled = true;
		});

		// 1) 기존 아이템이 있으면 먼저 부드럽게 퇴장
		if (hadVisibleContent && !reduced) {
			this.stage = 'exiting-content';
			await waitMs(CATALOG_TRANSITION_TIMING.contentExitMs);
			if (token !== this.requestToken) return;
		}

		// 2) 퇴장 후에도 아직 응답이 안 왔거나 초기 진입이면 스켈레톤 표시
		let skeletonEnteredAt = 0;
		if (!settled || !hadVisibleContent) {
			this.stage = 'skeleton';
			skeletonEnteredAt = performance.now();
		} else if (wasShowingSkeleton) {
			skeletonEnteredAt = performance.now();
		}

		const outcome = await fetchPromise;
		if (token !== this.requestToken) return;

		// 3) 스켈레톤이 표시됐다면 최소 유지 시간 후 부드럽게 퇴장
		if (this.stage === 'skeleton' && !reduced) {
			const elapsed = performance.now() - skeletonEnteredAt;
			const minHold = CATALOG_TRANSITION_TIMING.skeletonMinMs;
			if (elapsed < minHold) {
				await waitMs(minHold - elapsed);
				if (token !== this.requestToken) return;
			}
			this.stage = 'exiting-skeleton';
			await waitMs(CATALOG_TRANSITION_TIMING.skeletonExitMs);
			if (token !== this.requestToken) return;
		}

		// 4) 최종 결과 반영 및 새 콘텐츠 등장
		if (outcome.ok) {
			this.items = outcome.res.items;
			this.page = outcome.res.page;
			this.hasNext = outcome.res.hasNext;
			this.degraded = outcome.res.degraded;
			this.hasLoadedOnce = true;
			this.lastCompletedKey = key;
			this.opts.onPageLoaded?.(outcome.res, true);
		} else {
			this.errorMessage = resolveCatalogErrorMessage(outcome.err, this.opts.entityLabel);
			this.hasLoadedOnce = true;
			this.lastRequestedKey = '';
		}

		this.isLoading = false;
		this.stage = 'content';
		this.contentRevision += 1;
	}
}
