import { goto } from '$app/navigation';
import { api, auth } from '#lib/auth/auth.svelte';
import { resolveGoodsImageUrl, type CatalogGoods } from '#lib/common/catalog/goods';
import { loadImageAverageColor } from '#lib/common/design/fluid/imageColor';
import { GOODS_FORM_OPTIONS } from '#lib/common/type/filterOptions';
import { toast } from '#lib/common/logic';
import { copyCurrentPageLink } from '../../_shared/logic/shareLink';
import { goodsDetailState } from './goodsDetailState.svelte';

export interface GoodsOptionItem {
	id: number;
	name: string;
	size?: string | null;
	price: number;
	qty: number;
	soldOut: boolean;
}

interface GoodsProductDetailDto {
	id: number;
	productType?: string;
	name: string;
	thumbnailUrl?: string | null;
	purchaseUrl?: string | null;
	artistId?: number | null;
	artistName?: string | null;
	category?: string | null;
	options?: GoodsOptionItem[] | null;
}

const GOODS_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
	GOODS_FORM_OPTIONS.map((opt) => [opt.value, opt.label])
);

/**
 * 4-4_merch(굿즈) 상세 페이지 전용 컨트롤러
 * - 캐시 즉시 복원 + GET /api/catalog/products/{id} 상세/옵션 조회
 * - 사이즈/옵션 선택, 수량, 장바구니 담기(PUT /api/cart/items/{optionId}),
 *   아티스트 이동, 링크 공유, 이미지 평균색 앰비언트 글로우 추출을 전담합니다.
 */
export class GoodsDetailController {
	isLoading = $state(false);
	errorMessage = $state<string | null>(null);

	name = $state('');
	categoryLabel = $state('');
	artistId = $state<number | null>(null);
	artistName = $state('');
	imageUrl = $state('');
	purchaseUrl = $state<string | null>(null);
	accentColor = $state<string>('var(--white)');

	options = $state<GoodsOptionItem[]>([]);
	selectedOptionId = $state<number | null>(null);
	qty = $state(1);
	cartSubmitting = $state(false);

	private currentId: number | null = null;
	private loadToken = 0;

	get selectedOption(): GoodsOptionItem | null {
		if (this.options.length === 0) return null;
		if (this.selectedOptionId !== null) {
			const found = this.options.find((o) => o.id === this.selectedOptionId);
			if (found) return found;
		}
		return this.options.find((o) => !o.soldOut) ?? this.options[0];
	}

	get isAllSoldOut(): boolean {
		return this.options.length > 0 && this.options.every((o) => o.soldOut);
	}

	get maxOrderQty(): number {
		const opt = this.selectedOption;
		if (!opt || opt.soldOut) return 1;
		const stockLimit = typeof opt.qty === 'number' && opt.qty > 0 ? opt.qty : 10;
		return Math.max(1, Math.min(10, stockLimit));
	}

	get totalPrice(): number | null {
		const opt = this.selectedOption;
		if (opt && typeof opt.price === 'number') {
			return opt.price * this.qty;
		}
		return null;
	}

	load = (goodsId: number): void => {
		if (this.currentId === goodsId && this.name) return;
		this.currentId = goodsId;
		this.errorMessage = null;
		this.qty = 1;
		this.options = [];
		this.selectedOptionId = null;
		this.purchaseUrl = null;
		this.accentColor = 'var(--white)';

		const cached: CatalogGoods | null = goodsDetailState.getCachedGoods(goodsId);
		if (cached) {
			this.name = cached.name;
			this.categoryLabel = cached.category ?? '';
			this.artistId = cached.artistId ?? null;
			this.artistName = cached.artistName;
			this.imageUrl = resolveGoodsImageUrl(cached);
		} else {
			this.name = '';
			this.categoryLabel = '';
			this.artistId = null;
			this.artistName = '';
			this.imageUrl = '';
		}

		const token = ++this.loadToken;
		void this.fetchDetail(goodsId, token);
	};

	selectOption = (optionId: number): void => {
		this.selectedOptionId = optionId;
		if (this.qty > this.maxOrderQty) {
			this.qty = this.maxOrderQty;
		}
	};

	stepQty = (delta: number): void => {
		this.qty = Math.max(1, Math.min(this.maxOrderQty, this.qty + delta));
	};

	/** 장바구니 담기: PUT /api/cart/items/{optionId} { qty } */
	addToCart = async (): Promise<void> => {
		const opt = this.selectedOption;
		if (!opt || opt.soldOut || this.cartSubmitting) return;

		if (!auth.isLoggedIn) {
			toast.info('로그인 후 장바구니에 담을 수 있습니다.');
			return;
		}

		this.cartSubmitting = true;
		try {
			await api(`/api/cart/items/${opt.id}`, {
				method: 'PUT',
				body: JSON.stringify({ qty: this.qty })
			});
			toast.success('장바구니에 담았습니다.');
		} catch (err) {
			const code = (err as { code?: string })?.code;
			if (code === 'CART_FULL') {
				toast.error('장바구니가 가득 찼습니다. (최대 20종 · 옵션당 10개)');
			} else if (code === 'OUT_OF_STOCK') {
				toast.error('재고가 부족합니다.');
			} else {
				console.error('Add goods to cart failed:', err);
				toast.error('장바구니에 담지 못했습니다. 잠시 후 다시 시도해 주세요.');
			}
		} finally {
			this.cartSubmitting = false;
		}
	};

	goToArtist = (): void => {
		if (this.artistId === null) return;
		void goto(`/artist/${this.artistId}`, { reset: false });
	};

	shareLink = async (): Promise<void> => {
		await copyCurrentPageLink('굿즈 링크가 복사되었습니다.');
	};

	private async fetchDetail(goodsId: number, token: number): Promise<void> {
		if (!this.name) {
			this.isLoading = true;
		}

		try {
			const dto = await api<GoodsProductDetailDto>(`/api/catalog/products/${goodsId}`);
			if (token !== this.loadToken || !dto) return;

			const rawCategory = dto.category?.trim() ?? '';
			this.name = dto.name?.trim() || this.name;
			this.categoryLabel = rawCategory
				? (GOODS_CATEGORY_LABELS[rawCategory] ?? rawCategory)
				: this.categoryLabel;
			this.artistId = dto.artistId ?? this.artistId;
			this.artistName = dto.artistName?.trim() || this.artistName;
			this.imageUrl = dto.thumbnailUrl?.trim() || this.imageUrl;
			this.purchaseUrl = dto.purchaseUrl?.trim() || null;

			const opts = Array.isArray(dto.options) ? dto.options : [];
			this.options = opts;
			const firstAvail = opts.find((o) => !o.soldOut) ?? opts[0] ?? null;
			this.selectedOptionId = firstAvail?.id ?? null;

			if (this.imageUrl) {
				void this.resolveAccentGlow(this.imageUrl, token);
			}
		} catch (err) {
			if (token !== this.loadToken) return;
			console.error('Failed to fetch goods detail:', err);
			if (!this.name) {
				this.errorMessage = '굿즈 정보를 불러오지 못했습니다.';
			}
		} finally {
			if (token === this.loadToken) {
				this.isLoading = false;
			}
		}
	}

	private async resolveAccentGlow(url: string, token: number): Promise<void> {
		const color = await loadImageAverageColor(url);
		if (token !== this.loadToken) return;
		this.accentColor = color ?? 'var(--white)';
	}
}
