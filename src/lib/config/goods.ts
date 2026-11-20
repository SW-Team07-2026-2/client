import { GOODS_FORM_OPTIONS } from '#lib/config/filter';

export type GoodsBadge = 'NEW' | '한정판' | '품절임박' | '품절';

export interface GoodsItemDto {
	id: number;
	artistId?: number | null;
	artistName?: string | null;
	name: string;
	category?: string | null;
	thumbnailUrl?: string | null;
	minPrice?: number | null;
	soldOut?: boolean | null;
}

export interface CatalogGoods {
	id: number;
	artistId?: number | null;
	name: string;
	artistName: string;
	category?: string | null;
	price?: number | null;
	badge?: GoodsBadge | null;
	imageUrl?: string | null;
}

const GOODS_CATEGORY_LABEL_MAP: Record<string, string> = Object.fromEntries(
	GOODS_FORM_OPTIONS.map((opt) => [opt.value, opt.label])
);

export function mapGoodsItem(item: GoodsItemDto): CatalogGoods {
	const rawCategory = item.category?.trim() ?? '';
	const categoryLabel = rawCategory ? (GOODS_CATEGORY_LABEL_MAP[rawCategory] ?? rawCategory) : null;

	return {
		id: item.id,
		artistId: item.artistId ?? null,
		name: item.name ?? '',
		artistName: item.artistName?.trim() ?? '',
		category: categoryLabel,
		price: typeof item.minPrice === 'number' ? item.minPrice : null,
		badge: item.soldOut ? '품절' : null,
		imageUrl: item.thumbnailUrl ?? null
	};
}

export function resolveGoodsImageUrl(goods: Pick<CatalogGoods, 'imageUrl'>): string {
	return goods.imageUrl?.trim() ?? '';
}
