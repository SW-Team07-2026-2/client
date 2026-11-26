import { goto } from '$app/navigation';
import { api, auth } from '#lib/auth/auth.svelte';
import {
	mapGoodsItem,
	type CatalogGoods,
	type GoodsItemDto
} from '#lib/common/catalog/goods';
import { countActiveFilters } from '#lib/common/type/filterOptions';
import { catalogFeed, isCatalogCategoryReady, toast } from '#lib/common/logic';
import { CatalogFeedController } from '../../_shared/logic/catalogFeedController.svelte';
import { addOptionToCart } from '../../_shared/logic/productCart';
import { goodsDetailState } from './goodsDetailState.svelte';

interface QuickCartOptionDto {
	id: number;
	name?: string | null;
	size?: string | null;
	soldOut: boolean;
}

interface QuickCartProductDto {
	id: number;
	options?: QuickCartOptionDto[] | null;
}

export interface GoodsSelectPayload {
	goods: CatalogGoods;
}

/**
 * 4-4_merch(굿즈) 카테고리 전용 컨트롤러
 * - 굿즈 목록 페이지네이션(CatalogFeedController), 캐시 동기화, 상세 진입 이동,
 *   카드 빠른 장바구니 담기를 전담합니다.
 */
export class GoodsCategoryController {
	readonly feed: CatalogFeedController<CatalogGoods, GoodsItemDto>;
	private addingCartMap = $state<Record<number, boolean>>({});

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

	isAddingToCart = (goodsId: number): boolean => {
		return Boolean(this.addingCartMap[goodsId]);
	};

	/** 목록 카드에서 첫 번째 구매 가능 옵션으로 즉시 장바구니 담기 */
	quickAddToCart = async (goods: CatalogGoods): Promise<void> => {
		if (goods.badge === '품절' || this.addingCartMap[goods.id]) return;

		if (!auth.isLoggedIn) {
			toast.info('로그인 후 장바구니에 담을 수 있습니다.');
			return;
		}

		this.addingCartMap = { ...this.addingCartMap, [goods.id]: true };
		try {
			const dto = await api<QuickCartProductDto>(`/api/catalog/products/${goods.id}`);
			const opts = Array.isArray(dto?.options) ? dto.options : [];
			const firstAvail = opts.find((o) => !o.soldOut);

			if (!firstAvail) {
				toast.info('현재 구매 가능한 옵션이 없습니다.');
				return;
			}

			const optLabel = (firstAvail.size || firstAvail.name || '').trim();
			const suffix = optLabel && optLabel !== '기본' && optLabel !== 'FREE' ? ` (${optLabel})` : '';
			await addOptionToCart(firstAvail.id, 1, {
				successMessage: `장바구니에 담았습니다.${suffix}`
			});
		} catch (err) {
			console.error('Quick add goods to cart failed:', err);
			toast.error('장바구니에 담지 못했습니다. 잠시 후 다시 시도해 주세요.');
		} finally {
			const next = { ...this.addingCartMap };
			delete next[goods.id];
			this.addingCartMap = next;
		}
	};
}
