import { api } from '#lib/auth/auth.svelte';
import {
	DETAIL_GLOW_COLOR_OPTIONS,
	loadImageAverageColor
} from '#lib/common/design/fluid/imageColor';

interface CacheEntry<T = unknown> {
	promise: Promise<T>;
	timestamp: number;
}

const PREFETCH_TTL_MS = 45_000;
const MAX_CACHE_ENTRIES = 60;

const apiPrefetchCache = new Map<string, CacheEntry>();
const warmedImageUrls = new Set<string>();

function pruneCache(): void {
	if (apiPrefetchCache.size <= MAX_CACHE_ENTRIES) return;
	const oldestKey = apiPrefetchCache.keys().next().value;
	if (oldestKey) apiPrefetchCache.delete(oldestKey);
}

/**
 * 카드 호버(PC) 또는 터치 시작(모바일) 시 상세 API 응답을 백그라운드에서 선제 프리페치합니다.
 * 동일 경로가 TTL 내에 이미 요청 중이거나 완료된 경우 중복 요청을 보내지 않습니다.
 */
export function prefetchDetailApi<T = unknown>(path: string): void {
	if (typeof window === 'undefined' || !path) return;
	const now = Date.now();
	const existing = apiPrefetchCache.get(path);
	if (existing && now - existing.timestamp < PREFETCH_TTL_MS) {
		return;
	}

	const promise = api<T>(path).catch((err) => {
		// 실패한 요청은 캐시에서 즉시 제거해 실제 진입 시 재시도할 수 있게 유지
		if (apiPrefetchCache.get(path)?.promise === promise) {
			apiPrefetchCache.delete(path);
		}
		throw err;
	});

	apiPrefetchCache.set(path, { promise, timestamp: now });
	pruneCache();
	// 미처리 rejection 경고 방지
	void promise.catch(() => {});
}

/**
 * 상세 컨트롤러가 API를 조회할 때 선제 프리페치된 프로미스가 유효하면 즉시 재사용하고,
 * 없으면 일반 api<T>(path) 호출을 수행합니다.
 */
export function fetchDetailWithPrefetch<T>(path: string): Promise<T> {
	const existing = apiPrefetchCache.get(path);
	if (existing && Date.now() - existing.timestamp < PREFETCH_TTL_MS) {
		return existing.promise as Promise<T>;
	}
	const promise = api<T>(path);
	apiPrefetchCache.set(path, { promise, timestamp: Date.now() });
	pruneCache();
	return promise.catch((err) => {
		if (apiPrefetchCache.get(path)?.promise === promise) {
			apiPrefetchCache.delete(path);
		}
		throw err;
	});
}

/**
 * 상세 대표 이미지의 CORS 캐시 및 평균색(앰비언트 글로우)을 호버/터치 시점에 미리 워밍합니다.
 */
export function prefetchDetailImage(url?: string | null): void {
	const trimmed = url?.trim();
	if (!trimmed || warmedImageUrls.has(trimmed)) return;
	warmedImageUrls.add(trimmed);
	if (warmedImageUrls.size > 120) {
		const first = warmedImageUrls.values().next().value;
		if (first) warmedImageUrls.delete(first);
	}
	void loadImageAverageColor(trimmed, DETAIL_GLOW_COLOR_OPTIONS);
}
