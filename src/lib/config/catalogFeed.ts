import { api } from '#lib/auth/auth.svelte';
import { FluidSetting } from '#lib/fluid/setting';

export interface CatalogPageResult<T> {
	items: T[];
	page: number;
	size: number;
	hasNext: boolean;
}

export function resolveCatalogErrorMessage(err: unknown, entityLabel: string): string {
	if (!err) return `${entityLabel} 목록을 불러오는 중 문제가 발생했습니다.`;
	if (typeof err === 'string') return err;

	const anyErr = err as { status?: number; code?: string; message?: string };
	if (anyErr.status === 503 || anyErr.code === 'SERVICE_UNAVAILABLE') {
		return `${entityLabel} 서비스가 일시적으로 원활하지 않습니다. 잠시 후 다시 시도해 주세요.`;
	}
	if (anyErr.status === 400 || anyErr.code === 'INVALID_REQUEST') {
		return '잘못된 요청입니다. 검색 조건을 확인해 주세요.';
	}
	if (anyErr.status === 404) {
		return `요청하신 ${entityLabel} 정보를 찾을 수 없습니다.`;
	}

	const msg = anyErr.message ?? '';
	if (
		msg.includes('fetch') ||
		msg.includes('network') ||
		msg.includes('Failed to fetch') ||
		msg.includes('NetworkError')
	) {
		return '서버와 연결할 수 없습니다. 네트워크 연결 또는 API 서버 상태를 확인해 주세요.';
	}
	return msg || `${entityLabel} 목록을 불러오는 중 오류가 발생했습니다.`;
}

export function sliceMockCatalogPage<T>(
	items: T[],
	page: number,
	pageSize: number
): CatalogPageResult<T> {
	const safeSize = Math.max(1, pageSize);
	const start = Math.max(0, page) * safeSize;
	const slice = items.slice(start, start + safeSize);
	return {
		items: slice,
		page,
		size: safeSize,
		hasNext: start + safeSize < items.length
	};
}

export function formatKrwPrice(price?: number | null): string {
	if (typeof price !== 'number' || !Number.isFinite(price)) return '';
	return `${price.toLocaleString('ko-KR')}원`;
}

export function buildCatalogActionSetting(
	active: boolean,
	waveColor: string
): FluidSetting {
	const compactBase = {
		inset: 6,
		layers: 1,
		layerGap: 2,
		waveAmp: 1.8,
		bulge: 4,
		reach: 24
	};
	if (active) {
		return new FluidSetting({
			...compactBase,
			color: 'var(--surface-3)',
			hoverColor: 'var(--surface-4)',
			pressColor: 'var(--surface-2)',
			waveColor: 'var(--line-wave)',
			borderWidth: 1,
			borderColor: 'var(--line)',
			hoverBorderColor: 'var(--muted)',
			textColor: 'var(--white)'
		});
	}
	return new FluidSetting({
		...compactBase,
		color: 'var(--white)',
		hoverColor: 'var(--white-2)',
		pressColor: 'var(--white-3)',
		waveColor,
		textColor: 'var(--bg)'
	});
}

export async function fetchCatalogPageWithFallback<T>(opts: {
	endpoint: string;
	page: number;
	pageSize: number;
	query: string;
	genre: string;
	filterMock: () => T[];
}): Promise<CatalogPageResult<T>> {
	const safeSize = Math.min(50, Math.max(1, opts.pageSize));
	try {
		const params = new URLSearchParams();
		params.set('page', String(opts.page));
		params.set('size', String(safeSize));
		if (opts.query.trim()) params.set('q', opts.query.trim());
		if (opts.genre.trim()) params.set('genre', opts.genre.trim());

		const res = await api<CatalogPageResult<T>>(`${opts.endpoint}?${params.toString()}`);
		const fetchedItems = Array.isArray(res?.items) ? res.items : [];
		if (fetchedItems.length > 0) {
			return {
				items: fetchedItems,
				page: typeof res?.page === 'number' ? res.page : opts.page,
				size: safeSize,
				hasNext: Boolean(res?.hasNext)
			};
		}
	} catch {
		// 백엔드 미응답/오프라인 시 목업 데이터 폴백
	}

	return sliceMockCatalogPage(opts.filterMock(), opts.page, safeSize);
}
