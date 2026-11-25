import { goto } from '$app/navigation';
import {
	mapGoodsItem,
	type CatalogGoods,
	type GoodsItemDto
} from '#lib/common/catalog/goods';
import { countActiveFilters } from '#lib/common/type/filterOptions';
import { catalogFeed, isCatalogCategoryReady } from '#lib/common/logic';
import { CatalogFeedController } from '../../_shared/logic/catalogFeedController.svelte';
import { goodsDetailState } from './goodsDetailState.svelte';

export interface GoodsSelectPayload {
	goods: CatalogGoods;
}

/**
 * 4-4_merch(굿즈) 카테고리 전용 컨트롤러
 * - 굿즈 목록 페이지네이션(CatalogFeedController), 캐시 동기화, 상세 진입 이동을 전담합니다.
 */
export class GoodsCategoryController {
	readonly feed: CatalogFeedController<CatalogGoods, GoodsItemDto>;

	constructor() {
		this.feed = new CatalogFeedController<CatalogGoods, GoodsItemDto>({
			category: 'goods',
			entityLabel: '굿즈',
			mapItem: mapGoodsItem,
			onPageLoaded: () => {
				goodsDetailState.cacheGoodsList(this.feed.items);
			}
		});
	}

	get emptyTitle(): string {
		const mode = catalogFeed.resolvedFeedMode;
		const query = catalogFeed.debouncedQuery.trim();
		const hasFilters = this.hasActiveFilters;

		if (mode === 'follow') {
			return query || hasFilters
				? '조건에 맞는 팔로우 아티스트의 굿즈가 없습니다'
				: '팔로우한 아티스트의 굿즈가 없습니다';
		}
		if (query) return `'${query}'에 대한 굿즈가 없습니다`;
		if (hasFilters) return '선택한 조건에 맞는 굿즈가 없습니다';
		return '등록된 굿즈가 없습니다';
	}

	get emptyDescription(): string {
		const mode = catalogFeed.resolvedFeedMode;
		const query = catalogFeed.debouncedQuery.trim();

		if (query || this.hasActiveFilters) {
			return '검색어 또는 필터 조건을 다시 확인해 보세요.';
		}
		if (mode === 'follow') {
			return '관심 있는 아티스트를 팔로우하면 공식 굿즈를 이곳에서 모아볼 수 있습니다.';
		}
		return '새로운 공식 굿즈가 등록되면 이곳에서 만나보실 수 있습니다.';
	}

	private get hasActiveFilters(): boolean {
		return (
			countActiveFilters({
				genres: [],
				regions: [],
				statuses: [],
				concertTypes: [],
				forms: catalogFeed.filterState.forms,
				priceRange: catalogFeed.filterState.priceRange,
				excludeSoldOut: catalogFeed.filterState.excludeSoldOut,
				sort: ''
			}) > 0
		);
	}

	/** 상위 섹션 활성 상태 및 검색/필터/피드 파라미터 동기화 */
	sync = (active: boolean): void => {
		const canSync = active && isCatalogCategoryReady('goods', true);
		this.feed.sync(canSync, {
			feedMode: catalogFeed.resolvedFeedMode,
			query: catalogFeed.debouncedQuery,
			filterState: catalogFeed.filterState,
			refreshTick: catalogFeed.refreshTick
		});
	};

	/** 굿즈 카드 선택 시 캐시 저장 후 상세 라우트 이동 */
	selectGoods = (payload: GoodsSelectPayload): void => {
		goodsDetailState.cacheGoods(payload.goods);
		void goto(`/goods/${payload.goods.id}`, { reset: false });
	};
}
