import type { CatalogGoods } from '#lib/common/catalog/goods';

/**
 * 굿즈 목록 <-> 상세 간 굿즈 데이터 캐시 스토어.
 */
class GoodsDetailStateStore {
	private cache = new Map<number, CatalogGoods>();

	cacheGoods(goods: CatalogGoods): void {
		const prev = this.cache.get(goods.id);
		this.cache.set(goods.id, { ...prev, ...goods });
	}

	cacheGoodsList(items: CatalogGoods[]): void {
		for (const item of items) {
			this.cacheGoods(item);
		}
	}

	getCachedGoods(goodsId: number): CatalogGoods | null {
		return this.cache.get(goodsId) ?? null;
	}
}

export const goodsDetailState = new GoodsDetailStateStore();
