export type GoodsBadge = 'NEW' | '한정판' | '품절임박' | '품절';

export interface CatalogGoods {
	id: number;
	name: string;
	artistName: string;
	category?: string | null;
	price?: number | null;
	badge?: GoodsBadge | null;
	imageUrl?: string | null;
}

export const MOCK_CATALOG_GOODS: CatalogGoods[] = [
	{
		id: 301,
		name: 'SILICA GEL 2026 투어 오버핏 후디',
		artistName: '실리카겔',
		category: '어패럴',
		price: 78000,
		badge: 'NEW',
		imageUrl: 'https://picsum.photos/seed/goods_301/480/480'
	},
	{
		id: 302,
		name: 'DAY6 공식 데니멀즈 키링 세트',
		artistName: '데이식스',
		category: '액세서리',
		price: 26000,
		badge: '품절임박',
		imageUrl: 'https://picsum.photos/seed/goods_302/480/480'
	},
	{
		id: 303,
		name: '잔나비 레트로 에코 토트백',
		artistName: '잔나비',
		category: '가방',
		price: 34000,
		badge: null,
		imageUrl: 'https://picsum.photos/seed/goods_303/480/480'
	},
	{
		id: 304,
		name: 'LUCY 스타라이트 공식 응원봉 Ver.2',
		artistName: '루시',
		category: '응원도구',
		price: 45000,
		badge: 'NEW',
		imageUrl: 'https://picsum.photos/seed/goods_304/480/480'
	},
	{
		id: 305,
		name: 'wave to earth 턴테이블 슬립매트',
		artistName: '웨이브투어스',
		category: '리빙/바이닐',
		price: 29000,
		badge: '한정판',
		imageUrl: 'https://picsum.photos/seed/goods_305/480/480'
	},
	{
		id: 306,
		name: 'THORNAPPLE 불구경 아카이브 포토북',
		artistName: '쏜애플',
		category: '출판/포토',
		price: 42000,
		badge: '한정판',
		imageUrl: 'https://picsum.photos/seed/goods_306/480/480'
	},
	{
		id: 307,
		name: 'HYUKOH 그래픽 롱슬리브 티셔츠',
		artistName: '혁오',
		category: '어패럴',
		price: 54000,
		badge: null,
		imageUrl: 'https://picsum.photos/seed/goods_307/480/480'
	},
	{
		id: 308,
		name: 'TOUCHED 시그니처 메탈 핀 배지',
		artistName: '터치드',
		category: '액세서리',
		price: 15000,
		badge: null,
		imageUrl: 'https://picsum.photos/seed/goods_308/480/480'
	},
	{
		id: 309,
		name: 'Lacuna 드림캐처 패브릭 포스터',
		artistName: '라쿠나',
		category: '리빙/인테리어',
		price: 28000,
		badge: 'NEW',
		imageUrl: 'https://picsum.photos/seed/goods_309/480/480'
	},
	{
		id: 310,
		name: '너드커넥션 나이트 가든 머그컵',
		artistName: '너드커넥션',
		category: '리빙/테이블',
		price: 22000,
		badge: null,
		imageUrl: 'https://picsum.photos/seed/goods_310/480/480'
	},
	{
		id: 311,
		name: 'NELL Christmas Room 스노우볼',
		artistName: '넬',
		category: '한정 굿즈',
		price: 48000,
		badge: '한정판',
		imageUrl: 'https://picsum.photos/seed/goods_311/480/480'
	},
	{
		id: 312,
		name: '자우림 25주년 메탈 텀블러',
		artistName: '자우림',
		category: '리빙/테이블',
		price: 36000,
		badge: null,
		imageUrl: 'https://picsum.photos/seed/goods_312/480/480'
	},
	{
		id: 313,
		name: '10CM 어쿠스틱 기타 피크 팩',
		artistName: '10CM',
		category: '액세서리',
		price: 12000,
		badge: '품절임박',
		imageUrl: 'https://picsum.photos/seed/goods_313/480/480'
	},
	{
		id: 314,
		name: '카더가든 빈티지 볼캡 (Charcoal)',
		artistName: '카더가든',
		category: '어패럴',
		price: 39000,
		badge: null,
		imageUrl: 'https://picsum.photos/seed/goods_314/480/480'
	},
	{
		id: 315,
		name: '새소년 황소윤 일러스트 스티커팩',
		artistName: '새소년',
		category: '문구',
		price: 9000,
		badge: 'NEW',
		imageUrl: 'https://picsum.photos/seed/goods_315/480/480'
	},
	{
		id: 316,
		name: '검정치마 TEEN TROUBLES 카세트 키링',
		artistName: '검정치마',
		category: '액세서리',
		price: 18000,
		badge: '품절',
		imageUrl: 'https://picsum.photos/seed/goods_316/480/480'
	}
];

export function resolveGoodsImageUrl(goods: Pick<CatalogGoods, 'id' | 'imageUrl'>): string {
	return goods.imageUrl && goods.imageUrl.trim().length > 0
		? goods.imageUrl
		: `https://picsum.photos/seed/goods_${goods.id}/480/480`;
}
