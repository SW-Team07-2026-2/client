import { api, auth } from '#lib/auth/auth.svelte';
import type { CatalogAlbum } from '#lib/common/catalog/albums';
import {
	DETAIL_GLOW_COLOR_OPTIONS,
	getCachedImageAverageColor,
	loadImageAverageColor
} from '#lib/common/design/fluid/imageColor';
import { getGenreLabel } from '#lib/common/type/filterOptions';
import { cartState, toast } from '#lib/common/logic';
import { navigateDetailToDetail } from '#lib/common/logic/detailNavigation';
import { addOptionToCart, goToCart } from '../../_shared/logic/productCart';
import { fetchDetailWithPrefetch } from '../../_shared/logic/detailPrefetch';
import { shareCurrentPage } from '../../_shared/logic/shareLink';
import {
	mapAlbumTracks,
	mapPhysicalEditionsSorted,
	mapProductFallbackEdition,
	resolveAlbumTypeLabel,
	type AlbumDetailFullDto,
	type AlbumPhysicalEdition,
	type AlbumTrackItem,
	type CollectionItemDto,
	type CursorPage,
	type ProductDetailDto,
	type ProductOptionItem
} from './albumDetailMapper';
import { albumDetailState, type AlbumMediaItem } from './albumDetailState.svelte';

export type { AlbumPhysicalEdition, AlbumTrackItem, ProductDetailDto, ProductOptionItem };

/**
 * 4-3_album 상세 페이지 전용 컨트롤러
 * - GET /api/catalog/products/{productId} + GET /api/catalog/albums/{albumId} 병합 조회
 * - 피지컬 에디션(LP·CD·카세트) 전환, 옵션 선택, 수량, 장바구니 담기(PUT /api/cart/items/{optionId}),
 *   보유 음반(콜렉션) 등록/해제, 평균색 앰비언트 글로우 추출을 전담합니다.
 */
export class AlbumDetailController {
	isLoading = $state(false);
	errorMessage = $state<string | null>(null);

	albumId = $state<number | null>(null);
	albumTitle = $state('');
	albumTypeLabel = $state('');
	artistId = $state<number | null>(null);
	artistName = $state('');
	genres = $state<string[]>([]);
	releasedAt = $state<string | null>(null);
	coverUrl = $state('');
	albumDescription = $state('');
	accentColor = $state<string>('');
	tracks = $state<AlbumTrackItem[]>([]);

	editions = $state<AlbumPhysicalEdition[]>([]);
	selectedEditionId = $state<number | null>(null);
	optionsByEdition = $state<Record<number, ProductOptionItem[]>>({});
	descriptionByEdition = $state<Record<number, string>>({});
	detailImagesByEdition = $state<Record<number, string[]>>({});
	optionsLoading = $state(false);
	selectedOptionId = $state<number | null>(null);
	qty = $state(1);

	cartSubmitting = $state(false);
	collectionSubmitting = $state(false);
	/** 모바일 최초 앨범 상세 진입 시 1회성 실물 전환 회전 아이콘 힌트 노출 여부 */
	showFlipHint = $state(false);
	/** optionId -> collectionId 매핑 (보유 음반 여부 및 삭제용) */
	collectionByOption = $state<Record<number, number>>({});

	private currentRouteId: number | null = null;
	private loadToken = 0;
	private flipHintEligible = false;
	private flipHintTimer: ReturnType<typeof setTimeout> | null = null;
	private static readonly FLIP_HINT_DURATION_MS = 2200;

	get selectedEdition(): AlbumPhysicalEdition | null {
		if (this.selectedEditionId === null) return this.editions[0] ?? null;
		return this.editions.find((e) => e.id === this.selectedEditionId) ?? this.editions[0] ?? null;
	}

	get currentOptions(): ProductOptionItem[] {
		const ed = this.selectedEdition;
		if (!ed) return [];
		return this.optionsByEdition[ed.id] ?? [];
	}

	get currentEditionDescription(): string {
		const ed = this.selectedEdition;
		if (!ed) return '';
		return this.descriptionByEdition[ed.id] ?? '';
	}

	get currentEditionDetailImages(): string[] {
		const ed = this.selectedEdition;
		if (!ed) return [];
		return this.detailImagesByEdition[ed.id] ?? [];
	}

	get selectedOption(): ProductOptionItem | null {
		const opts = this.currentOptions;
		if (opts.length === 0) return null;
		if (this.selectedOptionId !== null) {
			const found = opts.find((o) => o.id === this.selectedOptionId);
			if (found) return found;
		}
		return opts.find((o) => !o.soldOut) ?? opts[0];
	}

	get activeMediaItems(): AlbumMediaItem[] {
		const ed = this.selectedEdition;
		if (!ed) return [];
		return [
			{
				id: ed.id,
				kind: ed.kind,
				formatLabel: ed.format,
				imageUrl: ed.thumbnailUrl,
				price: ed.minPrice,
				soldOut: ed.soldOut,
				label: ed.name
			}
		];
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
		const ed = this.selectedEdition;
		if (ed && typeof ed.minPrice === 'number') {
			return ed.minPrice * this.qty;
		}
		return null;
	}

	get isCurrentOptionCollected(): boolean {
		const opt = this.selectedOption;
		if (!opt) return false;
		return typeof this.collectionByOption[opt.id] === 'number';
	}

	get isCurrentOptionInCart(): boolean {
		return cartState.hasOption(this.selectedOption?.id);
	}

	/** productId 변경 시 캐시 즉시 복원 후 상품·앨범 상세·보유 음반 비동기 동기화 */
	load = (productId: number): void => {
		if (this.currentRouteId === productId && this.albumTitle) return;
		this.currentRouteId = productId;
		this.clearFlipHintTimer();
		this.showFlipHint = false;
		this.flipHintEligible = albumDetailState.consumeFirstDetailVisit();
		this.errorMessage = null;
		this.qty = 1;
		this.tracks = [];
		this.albumDescription = '';
		this.editions = [];
		this.optionsByEdition = {};
		this.descriptionByEdition = {};
		this.detailImagesByEdition = {};
		this.selectedEditionId = productId;
		this.selectedOptionId = null;
		this.accentColor = '';

		const cached: CatalogAlbum | null = albumDetailState.getCachedAlbum(productId);
		if (cached) {
			this.albumId = cached.albumId ?? null;
			this.albumTitle = cached.albumTitle || cached.title;
			this.artistId = cached.artistId ?? null;
			this.artistName = cached.artistName;
			this.coverUrl = cached.coverUrl?.trim() ?? '';
			this.selectedEditionId = cached.id;

			const meta = albumDetailState.getAlbumMeta(cached.albumId);
			if (meta?.coverUrl) this.coverUrl = meta.coverUrl;
			if (meta?.title) this.albumTitle = meta.title;
			if (this.coverUrl) {
				this.accentColor =
					getCachedImageAverageColor(this.coverUrl, DETAIL_GLOW_COLOR_OPTIONS) ?? '';
			}
		} else {
			this.albumId = null;
			this.albumTitle = '';
			this.artistId = null;
			this.artistName = '';
			this.coverUrl = '';
		}

		const token = ++this.loadToken;
		if (this.coverUrl && !this.accentColor) {
			void this.resolveAccentGlow(this.coverUrl, token);
		}
		void this.fetchInitial(productId, token);
		if (auth.isLoggedIn) {
			void this.fetchMyCollections(token);
			void cartState.ensureLoaded();
		}
	};

	selectEdition = (editionId: number): void => {
		if (this.selectedEditionId === editionId) return;
		this.selectedEditionId = editionId;
		this.qty = 1;

		const existingOpts = this.optionsByEdition[editionId];
		if (existingOpts) {
			const firstAvail = existingOpts.find((o) => !o.soldOut) ?? existingOpts[0] ?? null;
			this.selectedOptionId = firstAvail?.id ?? null;
			return;
		}

		this.selectedOptionId = null;
		void this.fetchEditionOptions(editionId, this.loadToken);
	};

	selectOption = (optionId: number): void => {
		this.selectedOptionId = optionId;
		if (this.qty > this.maxOrderQty) {
			this.qty = this.maxOrderQty;
		}
	};

	stepQty = (delta: number): void => {
		const next = Math.max(1, Math.min(this.maxOrderQty, this.qty + delta));
		this.qty = next;
	};

	/** 장바구니 담기: PUT /api/cart/items/{optionId} { qty } */
	addToCart = async (): Promise<void> => {
		const opt = this.selectedOption;
		if (!opt || opt.soldOut || this.cartSubmitting) return;

		this.cartSubmitting = true;
		try {
			await addOptionToCart(opt.id, this.qty);
		} finally {
			this.cartSubmitting = false;
		}
	};

	goToCart = (): void => {
		goToCart();
	};

	/** 보유 음반(콜렉션) 등록 / 해제 */
	toggleCollection = async (): Promise<void> => {
		const ed = this.selectedEdition;
		const opt = this.selectedOption;
		if (!ed || !opt || this.collectionSubmitting) return;

		if (!auth.isLoggedIn) {
			toast.info('로그인 후 보유 음반을 등록할 수 있습니다.');
			return;
		}

		const existingCollectionId = this.collectionByOption[opt.id];
		this.collectionSubmitting = true;

		try {
			if (typeof existingCollectionId === 'number') {
				await api<void>(`/api/members/collections/${existingCollectionId}`, {
					method: 'DELETE'
				});
				const next = { ...this.collectionByOption };
				delete next[opt.id];
				this.collectionByOption = next;
				albumDetailState.notifyCollectionChanged();
			} else {
				const created = await api<CollectionItemDto>('/api/members/collections', {
					method: 'POST',
					body: JSON.stringify({
						physicalAlbumId: ed.id,
						optionId: opt.id
					})
				});
				if (created && typeof created.id === 'number') {
					this.collectionByOption = {
						...this.collectionByOption,
						[opt.id]: created.id
					};
				}
				albumDetailState.notifyCollectionChanged();
			}
		} catch (err) {
			console.error('Collection toggle failed:', err);
			toast.error('보유 음반 상태를 변경하지 못했습니다.');
		} finally {
			this.collectionSubmitting = false;
		}
	};

	goToArtist = (): void => {
		if (this.artistId === null) return;
		navigateDetailToDetail(`/artist/${this.artistId}`);
	};

	shareLink = async (): Promise<void> => {
		const title = this.albumTitle.trim();
		const artist = this.artistName.trim();
		await shareCurrentPage({
			title: title ? `${title} · INDIG` : 'INDIG 앨범',
			text: title && artist ? `${artist} - ${title}` : title || undefined,
			fallbackSuccessMessage: '앨범 링크가 복사되었습니다.'
		});
	};

	private async fetchInitial(productId: number, token: number): Promise<void> {
		if (!this.albumTitle) {
			this.isLoading = true;
		}

		try {
			const product = await fetchDetailWithPrefetch<ProductDetailDto>(
				`/api/catalog/products/${productId}`
			);
			if (token !== this.loadToken || !product) return;

			const opts = Array.isArray(product.options) ? product.options : [];
			this.optionsByEdition = { ...this.optionsByEdition, [product.id]: opts };
			this.storeEditionMeta(product);
			const firstAvail = opts.find((o) => !o.soldOut) ?? opts[0] ?? null;
			this.selectedOptionId = firstAvail?.id ?? null;

			this.artistId = product.artistId ?? this.artistId;
			this.artistName = product.artistName?.trim() || this.artistName;
			this.albumId = product.albumId ?? this.albumId;
			this.albumTitle = product.albumTitle?.trim() || product.name?.trim() || this.albumTitle;
			this.releasedAt = product.releasedAt ?? this.releasedAt;
			if (!this.coverUrl && product.thumbnailUrl) {
				this.coverUrl = product.thumbnailUrl.trim();
			}

			// 상품 1개 기준 기본 에디션 먼저 세팅
			this.editions = [mapProductFallbackEdition(product, opts, firstAvail)];

			// 소속 Album 상세(커버 · 장르 · 수록곡 · 전체 피지컬 에디션) 추가 조회
			if (typeof product.albumId === 'number' && Number.isFinite(product.albumId)) {
				await this.fetchAlbumDetail(product.albumId, product.id, token);
			} else if (this.coverUrl) {
				void this.resolveAccentGlow(this.coverUrl, token);
			}
		} catch (err) {
			if (token !== this.loadToken) return;
			console.error('Failed to fetch album/product detail:', err);
			if (!this.albumTitle) {
				this.errorMessage = '앨범 정보를 불러오지 못했습니다.';
			}
		} finally {
			if (token === this.loadToken) {
				this.isLoading = false;
			}
		}
	}

	private async fetchAlbumDetail(
		albumId: number,
		activeProductId: number,
		token: number
	): Promise<void> {
		try {
			const dto = await fetchDetailWithPrefetch<AlbumDetailFullDto>(
				`/api/catalog/albums/${albumId}`
			);
			if (token !== this.loadToken || !dto) return;

			this.albumTitle = dto.title?.trim() || this.albumTitle;
			this.albumTypeLabel = resolveAlbumTypeLabel(dto.type);
			this.artistId = dto.artistId ?? this.artistId;
			this.artistName = dto.artistName?.trim() || this.artistName;
			this.releasedAt = dto.releasedAt ?? this.releasedAt;
			this.albumDescription = dto.description?.trim() ?? '';
			this.genres = Array.isArray(dto.genres)
				? dto.genres.map((g) => getGenreLabel(g)).filter(Boolean)
				: [];

			if (dto.thumbnailUrl?.trim()) {
				this.coverUrl = dto.thumbnailUrl.trim();
			}
			if (this.coverUrl) {
				void this.resolveAccentGlow(this.coverUrl, token);
			}

			this.tracks = mapAlbumTracks(dto.tracks);

			if (Array.isArray(dto.physicalAlbums) && dto.physicalAlbums.length > 0) {
				const mappedEditions = mapPhysicalEditionsSorted(dto.physicalAlbums);

				this.editions = mappedEditions;
				if (!mappedEditions.some((e) => e.id === activeProductId) && mappedEditions.length > 0) {
					this.selectedEditionId = mappedEditions[0].id;
				}
			}
		} catch (err) {
			console.warn('Failed to fetch parent album detail:', err);
		}
	}

	private async fetchEditionOptions(editionId: number, token: number): Promise<void> {
		this.optionsLoading = true;
		try {
			const product = await api<ProductDetailDto>(`/api/catalog/products/${editionId}`);
			if (token !== this.loadToken || !product) return;
			const opts = Array.isArray(product.options) ? product.options : [];
			this.optionsByEdition = { ...this.optionsByEdition, [editionId]: opts };
			this.storeEditionMeta(product);
			if (this.selectedEditionId === editionId) {
				const firstAvail = opts.find((o) => !o.soldOut) ?? opts[0] ?? null;
				this.selectedOptionId = firstAvail?.id ?? null;
			}
		} catch (err) {
			console.warn('Failed to fetch edition options:', err);
		} finally {
			if (token === this.loadToken) {
				this.optionsLoading = false;
			}
		}
	}

	private async fetchMyCollections(token: number): Promise<void> {
		try {
			const page = await api<CursorPage<CollectionItemDto>>('/api/members/collections?size=50');
			if (token !== this.loadToken || !page || !Array.isArray(page.items)) return;
			const map: Record<number, number> = {};
			for (const item of page.items) {
				if (typeof item.optionId === 'number' && typeof item.id === 'number') {
					map[item.optionId] = item.id;
				}
			}
			this.collectionByOption = map;
		} catch {
			// 보유 음반 목록 조회 실패 시 무시
		}
	}

	private storeEditionMeta(product: ProductDetailDto): void {
		const desc = product.description?.trim() ?? '';
		const imgs = Array.isArray(product.detailImageUrls)
			? product.detailImageUrls.map((u) => u?.trim()).filter((u): u is string => Boolean(u))
			: [];
		this.descriptionByEdition = { ...this.descriptionByEdition, [product.id]: desc };
		this.detailImagesByEdition = { ...this.detailImagesByEdition, [product.id]: imgs };
	}

	/** 모바일 최초 진입 시 상세 전환이 완료되고 실물 에디션이 준비되면 1회만 힌트 노출 후 자동 숨김 */
	syncFlipHint = (mobile: boolean, active: boolean): void => {
		if (!this.flipHintEligible || !mobile || !active || this.editions.length === 0) return;
		this.flipHintEligible = false;
		this.showFlipHint = true;
		this.clearFlipHintTimer();
		this.flipHintTimer = setTimeout(() => {
			this.showFlipHint = false;
			this.flipHintTimer = null;
		}, AlbumDetailController.FLIP_HINT_DURATION_MS);
	};

	dismissFlipHint = (): void => {
		this.flipHintEligible = false;
		this.showFlipHint = false;
		this.clearFlipHintTimer();
	};

	destroy = (): void => {
		this.clearFlipHintTimer();
	};

	private clearFlipHintTimer(): void {
		if (this.flipHintTimer !== null) {
			clearTimeout(this.flipHintTimer);
			this.flipHintTimer = null;
		}
	}

	private async resolveAccentGlow(url: string, token: number): Promise<void> {
		const color = await loadImageAverageColor(url);
		if (token !== this.loadToken || !color) return;
		this.accentColor = color;
	}
}
